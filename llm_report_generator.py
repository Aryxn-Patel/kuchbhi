import os
import json
from groq import Groq
from dataclasses import dataclass
from typing import List

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
MODEL_NAME = "openai/gpt-oss-120b"

@dataclass
class SWOT:
    strengths: List[str]
    weaknesses: List[str]
    opportunities: List[str]
    threats: List[str]

@dataclass
class BusinessReport:
    swot: SWOT
    threats_summary: str
    pricing_suggestion: str
    pricing_value_estimate: str
    language: str

class LLMReportError(Exception):
    pass

def build_prompt(location: str, business_category: str, available_capital: float,
                  market_density: float, business_saturation_index: float,
                  true_disposable_wealth: float, infrastructure_readiness_score: float,
                  economy_type_ratio: float, language: str) -> str:

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

HOW TO INTERPRET EACH METRIC:
1. Market Density: High density means walk-in foot traffic. Low means marketing needed.
2. Business Saturation Index: High means proven but competitive. Low means untapped or poor infrastructure.
3. True Disposable Wealth Index: Use this to justify your pricing suggestion.
4. Infrastructure Readiness Score: 4-5 means easy setup. 0-1 means real capital challenges (power/roads). Highlight low scores in Weaknesses/Threats.
5. Economy Type Ratio: > 0.5 favors consumer/services. < 0.5 favors industrial/agri.

Return ONLY valid JSON, no markdown formatting, no code fences, in exactly this shape:
{{
  "strengths": ["point 1", "point 2"],
  "weaknesses": ["point 1", "point 2"],
  "opportunities": ["point 1", "point 2"],
  "threats": ["point 1", "point 2"],
  "threats_summary": "one short paragraph on the biggest local risk",
  "pricing_suggestion": "one short paragraph suggesting a pricing approach",
  "pricing_value_estimate": "a specific suggested price range, e.g. Rs. 30-40 per unit"
}}
Each list should have 2-3 short items, each under 15 words.
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
                              economy_type_ratio: float, language: str = "English") -> BusinessReport:

    if not GROQ_API_KEY:
        raise LLMReportError("GROQ_API_KEY environment variable is not set.")

    prompt = build_prompt(
        location=location, business_category=business_category, available_capital=available_capital,
        market_density=market_density, business_saturation_index=business_saturation_index,
        true_disposable_wealth=true_disposable_wealth, infrastructure_readiness_score=infrastructure_readiness_score,
        economy_type_ratio=economy_type_ratio, language=language
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

    return BusinessReport(
        swot=swot,
        threats_summary=data.get("threats_summary", ""),
        pricing_suggestion=data.get("pricing_suggestion", ""),
        pricing_value_estimate=data.get("pricing_value_estimate", ""),
        language=language,
    )