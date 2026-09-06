import os
import json
import pandas as pd
from dataclasses import dataclass
from typing import Optional
from groq import Groq

try:
    from rapidfuzz import process, fuzz
except ImportError:  # pragma: no cover
    process = None
    fuzz = None

CSV_PATH = "sih_local_market_db.csv"

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
TRANSLATION_MODEL_NAME = "openai/gpt-oss-120b"

FUZZY_MATCH_THRESHOLD = 70  # 0-100; below this we keep the original (translated) value

_df_cache: Optional[pd.DataFrame] = None


class MarketDataError(Exception):
    pass


class TranslationError(Exception):
    pass


@dataclass
class MarketMetrics:
    state_name: str
    district_name: str
    village_name: str
    subdistrict_name: str
    total_population: float
    land_area_sq_km: float
    market_density: float
    business_saturation_index: float
    true_disposable_wealth: float
    infrastructure_readiness_score: float
    economy_type_ratio: float


@dataclass
class TranslatedInput:
    state_name: str
    district_name: str
    village_name: str
    business_category: str


def _load_dataframe() -> pd.DataFrame:
    global _df_cache
    if _df_cache is None:
        try:
            df = pd.read_csv(CSV_PATH)
        except FileNotFoundError:
            raise MarketDataError(f"Data file not found at '{CSV_PATH}'.")

        numeric_columns_to_clean = [
            "total_firms_count",
            "total_employment",
            "services_employment",
            "poverty_rate",
        ]
        for column in numeric_columns_to_clean:
            if column in df.columns:
                df[column] = pd.to_numeric(df[column], errors="coerce")
                df[column] = df[column].fillna(0)

        _df_cache = df

    return _df_cache


def _fuzzy_resolve(value: str, choices) -> str:
    """Snap a possibly-misspelled value to the closest known choice.

    Falls back to the original value untouched if rapidfuzz isn't installed,
    if there are no choices, or if the best match is below the threshold.
    """
    if not value or process is None:
        return value

    choices = list(choices)
    if not choices:
        return value

    match = process.extractOne(value, choices, scorer=fuzz.WRatio)
    if match and match[1] >= FUZZY_MATCH_THRESHOLD:
        return match[0]
    return value


def translate_user_input(state_name: str, district_name: str, village_name: str,
                          business_category: str) -> TranslatedInput:

    if not GROQ_API_KEY:
        raise TranslationError("GROQ_API_KEY environment variable is not set.")

    prompt = f"""
You are a translation and normalization assistant for an Indian government database
lookup system. The user may have typed the following fields in a regional script or
language (for example Assamese, Hindi, or Bengali), or in English with inconsistent
spelling or capitalization.

Translate and normalize each field into its standard English form, as it would appear
in an official Indian administrative or Census database. For business_category,
normalize it to a standard English business category name (for example "Dairy",
"Retail", "Textiles", "Food Processing", "General Store").

INPUT:
state_name: {state_name}
district_name: {district_name}
village_name: {village_name}
business_category: {business_category}

Return ONLY valid JSON, no markdown formatting, no code fences, in exactly this shape:

{{
  "state_name": "standardized English state name",
  "district_name": "standardized English district name",
  "village_name": "standardized English village name",
  "business_category": "standardized English business category"
}}

Do not add any explanation or extra text outside the JSON object.
"""

    client = Groq(api_key=GROQ_API_KEY)

    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=TRANSLATION_MODEL_NAME,
        )
    except Exception as e:
        raise TranslationError(f"Groq translation call failed: {e}")

    raw_text = response.choices[0].message.content.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]

    try:
        data = json.loads(raw_text.strip())
    except json.JSONDecodeError as e:
        raise TranslationError(f"Failed to parse translation output as JSON: {e}\nRaw output: {raw_text}")

    state = data.get("state_name", state_name)
    district = data.get("district_name", district_name)
    village = data.get("village_name", village_name)
    category = data.get("business_category", business_category)

    # Fuzzy-correct against the real dataset so small misspellings/colloquial
    # phrasing that survived translation still resolve to a real record.
    try:
        state = _fuzzy_resolve(state, get_available_states())
        district = _fuzzy_resolve(district, get_available_districts(state))
        village = _fuzzy_resolve(village, get_available_villages(state, district))
    except MarketDataError:
        pass  # dataset lookup failed (e.g. bad state) - let downstream raise a clearer error

    return TranslatedInput(
        state_name=state,
        district_name=district,
        village_name=village,
        business_category=category,
    )


def _find_village_row(state_name: str, district_name: str, village_name: str,
                       subdistrict_name: Optional[str] = None) -> pd.Series:
    df = _load_dataframe()

    mask = (
        df["state_name"].str.strip().str.lower() == state_name.strip().lower()
    ) & (
        df["district_name"].str.strip().str.lower() == district_name.strip().lower()
    ) & (
        df["village_name"].str.strip().str.lower() == village_name.strip().lower()
    )
    if subdistrict_name:
        mask &= df["subdistrict_name"].str.strip().str.lower() == subdistrict_name.strip().lower()

    matches = df[mask]

    if matches.empty:
        raise MarketDataError(
            f"No record found for village='{village_name}', district='{district_name}', "
            f"state='{state_name}'. Check spelling and confirm this location exists in the dataset."
        )

    if len(matches) > 1:
        matches = matches.iloc[[0]]

    return matches.iloc[0]


def calculate_market_density(row: pd.Series) -> float:
    land_area = row["land_area_sq_km"]
    if land_area is None or pd.isna(land_area) or land_area <= 0:
        return 0.0
    return round(row["total_population"] / land_area, 2)


def calculate_business_saturation_index(row: pd.Series) -> float:
    population = row["total_population"]
    if population is None or pd.isna(population) or population <= 0:
        return 0.0
    return round((row["total_firms_count"] / population) * 1000, 2)


def calculate_true_disposable_wealth(row: pd.Series) -> float:
    per_capita_consumption = row["per_capita_consumption"]
    poverty_rate = row["poverty_rate"]

    if pd.isna(per_capita_consumption) or pd.isna(poverty_rate):
        return 0.0

    return round(per_capita_consumption * (1.0 - poverty_rate), 2)


def calculate_infrastructure_readiness_score(row: pd.Series) -> float:
    fields = [
        "all_weather_road_access",
        "commercial_power_supply",
        "commercial_bank_availability",
        "cooperative_bank_availability",
        "local_market_availability",
    ]

    total = 0
    for field_name in fields:
        value = row[field_name]
        total += int(value) if not pd.isna(value) else 0

    return float(total)


def calculate_economy_type_ratio(row: pd.Series) -> float:
    total_employment = row["total_employment"]
    if total_employment is None or pd.isna(total_employment) or total_employment <= 0:
        return 0.0
    return round(row["services_employment"] / total_employment, 3)


def get_market_metrics(state_name: str, district_name: str, village_name: str,
                        subdistrict_name: Optional[str] = None) -> MarketMetrics:
    row = _find_village_row(state_name, district_name, village_name, subdistrict_name)

    return MarketMetrics(
        state_name=row["state_name"],
        district_name=row["district_name"],
        village_name=row["village_name"],
        subdistrict_name=row["subdistrict_name"],
        total_population=float(row["total_population"]),
        land_area_sq_km=float(row["land_area_sq_km"]),
        market_density=calculate_market_density(row),
        business_saturation_index=calculate_business_saturation_index(row),
        true_disposable_wealth=calculate_true_disposable_wealth(row),
        infrastructure_readiness_score=calculate_infrastructure_readiness_score(row),
        economy_type_ratio=calculate_economy_type_ratio(row),
    )


def get_available_states() -> list:
    df = _load_dataframe()
    return sorted(df["state_name"].dropna().unique().tolist())


def get_available_districts(state_name: str) -> list:
    df = _load_dataframe()
    filtered = df[df["state_name"].str.strip().str.lower() == state_name.strip().lower()]
    return sorted(filtered["district_name"].dropna().unique().tolist())


def get_available_blocks(state_name: str, district_name: str) -> list:
    df = _load_dataframe()
    filtered = df[
        (df["state_name"].str.strip().str.lower() == state_name.strip().lower())
        & (df["district_name"].str.strip().str.lower() == district_name.strip().lower())
    ]
    return sorted(filtered["subdistrict_name"].dropna().unique().tolist())


def get_available_villages(state_name: str, district_name: str, subdistrict_name: Optional[str] = None) -> list:
    df = _load_dataframe()
    mask = (
        (df["state_name"].str.strip().str.lower() == state_name.strip().lower())
        & (df["district_name"].str.strip().str.lower() == district_name.strip().lower())
    )
    if subdistrict_name:
        mask &= df["subdistrict_name"].str.strip().str.lower() == subdistrict_name.strip().lower()
    filtered = df[mask]
    return sorted(filtered["village_name"].dropna().unique().tolist())
