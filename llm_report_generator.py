import os
import json
from groq import Groq
from dataclasses import dataclass
from typing import List, Optional

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
MODEL_NAME = "openai/gpt-oss-120b"


@dataclass
class SWOT:
    strengths: List[str]
    weaknesses: List[str]
    opportunities: List[str]
    threats: List[str]


@dataclass
class GovernmentScheme:
    scheme_name: str
    subsidy_benefit: str
    eligibility_fit: str


@dataclass
class BusinessReport:
    swot: SWOT
    threats_summary: str
    pricing_suggestion: str
    pricing_value_estimate: str
    recommended_schemes: List[GovernmentScheme]
    language: str


class LLMReportError(Exception):
    pass


# ---------------------------------------------------------------------------
# Fallback scheme-name translations.
#
# LLMs are inconsistent about translating official government scheme names —
# they often treat acronyms like "PMEGP" or "MUDRA" as untranslatable proper
# nouns even when explicitly instructed to write everything in the target
# language. Rather than relying on the model to comply every time, we
# normalize known scheme names after the fact using this lookup table.
#
# Add more entries here as you see new scheme names showing up in English.
# Matching is done as a case-insensitive substring search against whatever
# the LLM returned, so partial names / extra wording around the acronym
# still match.
# ---------------------------------------------------------------------------
SCHEME_NAME_TRANSLATIONS = {
    "hindi": {
        "PMEGP": "प्रधानमंत्री रोजगार सृजन कार्यक्रम (PMEGP)",
        "MUDRA": "प्रधानमंत्री मुद्रा योजना",
        "CLSS": "क्रेडिट लिंक्ड सब्सिडी योजना (CLSS)",
        "STAND-UP INDIA": "स्टैंड-अप इंडिया योजना",
        "PMFME": "प्रधानमंत्री सूक्ष्म खाद्य प्रसंस्करण उद्यम योजना (PMFME)",
        "NABARD": "नाबार्ड ऋण योजना",
        "NATIONAL LIVESTOCK MISSION": "राष्ट्रीय पशुधन मिशन",
    },
    # Add more languages here as needed, e.g. "assamese": {...}
}


def normalize_scheme_name(name: str, language: str) -> str:
    """
    Force known government scheme names into the target language, regardless
    of what the LLM actually returned. Falls back to the LLM's original text
    if the language isn't in our table or no known scheme matches.
    """
    lang_map = SCHEME_NAME_TRANSLATIONS.get(language.strip().lower())
    if not lang_map or not name:
        return name

    for key, translated in lang_map.items():
        if key.lower() in name.lower():
            return translated
    return name


def build_prompt(location: str, business_category: str, available_capital: float,
                  market_density: float, business_saturation_index: float,
                  true_disposable_wealth: float, infrastructure_readiness_score: float,
                  economy_type_ratio: float, language: str,
                  live_competitor_count: Optional[int] = None) -> str:

    live_competitor_line = (
        f"- Live Competitor Count (within 5km, Google Maps data): {live_competitor_count}"
        if live_competitor_count is not None
        else "- Live Competitor Count: unavailable (rely on Business Saturation Index instead)"
    )

    return f"""
You are an expert rural business consultant in India. Generate a business feasibility
analysis for a first-time entrepreneur based on the following real data. Do not invent
numbers beyond what is given. Keep language extremely simple, suitable for someone with
limited formal education. Respond ONLY in {language}.

LOCATION: {location}
PROPOSED BUSINESS: {business_category}
ENTREPRENEUR'S AVAILABLE CAPITAL: Rs. {available_capital}

CALCULATED MARKET METRICS:
- Market Density (people per sq km): {market_density}
- Business Saturation Index (firms per 1,000 people): {business_saturation_index}
- True Disposable Wealth Index (Rs.): {true_disposable_wealth}
- Infrastructure Readiness Score (0 to 5): {infrastructure_readiness_score}
- Economy Type Ratio (services employment / total employment): {economy_type_ratio}
{live_competitor_line}

HOW TO INTERPRET EACH METRIC:
1. Market Density: High density means walk-in foot traffic. Low means marketing needed.
2. Business Saturation Index: High means proven but competitive. Low means untapped or poor infrastructure.
3. True Disposable Wealth Index: Use this to justify your pricing suggestion.
4. Infrastructure Readiness Score: 4-5 means easy setup. 0-1 means real capital challenges (power/roads). Highlight low scores in Weaknesses/Threats.
5. Economy Type Ratio: > 0.5 favors consumer/services. < 0.5 favors industrial/agri.
6. Live Competitor Count: If available, this is real-time ground data and takes priority over the Business Saturation Index for competitor-related points. If unavailable, use the Business Saturation Index instead and do not mention live data.

GOVERNMENT SCHEME MATCHING:
Using your knowledge of Indian central and state government policies, subsidies, and
credit schemes (such as PMFME, PMEGP, MUDRA, Stand-Up India, National Livestock Mission,
NABARD schemes, and relevant state-specific grants), recommend 2-3 schemes that are the
best fit for this entrepreneur, based on their business type, location, and available
capital. Only suggest schemes that are plausibly real and relevant — do not invent scheme
names.

CRITICAL LANGUAGE RULE FOR SCHEME NAMES:
"scheme_name" must be written FULLY in {language} script — including the scheme's
official meaning, not just the English acronym. Spell out what the acronym stands for
in {language}, and you may keep the English short-code in brackets after it, but the
short-code alone is NOT acceptable as the whole field.
Example for Hindi:
  WRONG: "scheme_name": "PMEGP"
  WRONG: "scheme_name": "Prime Minister's Employment Generation Programme (PMEGP)"
  RIGHT: "scheme_name": "प्रधानमंत्री रोजगार सृजन कार्यक्रम (PMEGP)"
Apply the same rule to every other field — "subsidy_benefit" and "eligibility_fit" must
also be natively written in {language}, not transliterated and not left in English.

Return ONLY valid JSON, no markdown formatting, no code fences, in exactly this shape:
{{
  "strengths": ["point 1", "point 2"],
  "weaknesses": ["point 1", "point 2"],
  "opportunities": ["point 1", "point 2"],
  "threats": ["point 1", "point 2"],
  "threats_summary": "one short paragraph on the biggest local risk",
  "pricing_suggestion": "one short paragraph suggesting a pricing approach",
  "pricing_value_estimate": "a specific suggested price range, e.g. Rs. 30-40 per unit",
  "recommended_schemes": [
    {{
      "scheme_name": "name of a relevant central or state government scheme, fully in {language} per the rule above",
      "subsidy_benefit": "one short line on the subsidy/loan/credit benefit it offers",
      "eligibility_fit": "one short line on why it fits this entrepreneur's business, location, and capital"
    }}
  ]
}}

Each list should have 2-3 short items, each under 15 words.
"recommended_schemes" must contain 2-3 entries.
"""


def parse_llm_response(raw_text: str) -> dict:
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise LLMReportError(f"Failed to parse LLM output as JSON: {e}\nRaw output: {raw_text}")


def generate_business_report(location: str, business_category: str, available_capital: float,
                              market_density: float, business_saturation_index: float,
                              true_disposable_wealth: float, infrastructure_readiness_score: float,
                              economy_type_ratio: float, language: str = "English",
                              live_competitor_count: Optional[int] = None) -> BusinessReport:

    if not GROQ_API_KEY:
        raise LLMReportError("GROQ_API_KEY environment variable is not set.")

    prompt = build_prompt(
        location=location, business_category=business_category, available_capital=available_capital,
        market_density=market_density, business_saturation_index=business_saturation_index,
        true_disposable_wealth=true_disposable_wealth, infrastructure_readiness_score=infrastructure_readiness_score,
        economy_type_ratio=economy_type_ratio, language=language,
        live_competitor_count=live_competitor_count,
    )

    client = Groq(api_key=GROQ_API_KEY)
    try:
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL_NAME,
        )
    except Exception as e:
        raise LLMReportError(f"Groq API call failed: {e}")

    data = parse_llm_response(response.choices[0].message.content)

    swot = SWOT(
        strengths=data.get("strengths", []),
        weaknesses=data.get("weaknesses", []),
        opportunities=data.get("opportunities", []),
        threats=data.get("threats", []),
    )

    recommended_schemes = [
        GovernmentScheme(
            scheme_name=normalize_scheme_name(s.get("scheme_name", ""), language),
            subsidy_benefit=s.get("subsidy_benefit", ""),
            eligibility_fit=s.get("eligibility_fit", ""),
        )
        for s in data.get("recommended_schemes", [])
    ]

    return BusinessReport(
        swot=swot,
        threats_summary=data.get("threats_summary", ""),
        pricing_suggestion=data.get("pricing_suggestion", ""),
        pricing_value_estimate=data.get("pricing_value_estimate", ""),
        recommended_schemes=recommended_schemes,
        language=language,
    )