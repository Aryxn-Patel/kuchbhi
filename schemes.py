"""
Static catalogue of central-government schemes relevant to rural micro-enterprises,
matched against the user's business category and project cost.

This is deliberately static (not LLM-generated): scheme eligibility rules are
official and shouldn't be left to a language model to invent. The frontend is
responsible for localizing each scheme's display name/description via its
`id` — see `frontend/src/lib/i18n.tsx`.
"""

from dataclasses import dataclass
from typing import List

try:
    from rapidfuzz import fuzz
except ImportError:  # pragma: no cover - fallback if rapidfuzz isn't installed
    fuzz = None


@dataclass
class Scheme:
    id: str
    name: str
    description: str
    categories: List[str]  # business categories this scheme applies to; ["*"] = all
    max_project_cost: float  # scheme's own project-cost ceiling, in rupees


SCHEMES: List[Scheme] = [
    Scheme(
        id="pmfme",
        name="PM Formalisation of Micro Food Processing Enterprises (PMFME)",
        description=(
            "Credit-linked subsidy for micro food processing units — supports setup, "
            "branding, and common infrastructure for food-based enterprises."
        ),
        categories=["Food Processing", "Dairy"],
        max_project_cost=1_000_000,
    ),
    Scheme(
        id="nlm",
        name="National Livestock Mission (NLM)",
        description=(
            "Entrepreneurship support for livestock and dairy-based ventures, including "
            "capital subsidy for setting up dairy processing and value-addition units."
        ),
        categories=["Dairy"],
        max_project_cost=5_000_000,
    ),
    Scheme(
        id="mudra",
        name="Pradhan Mantri Mudra Yojana (PMMY)",
        description=(
            "Collateral-free loans up to ₹10 lakh for non-farm micro and small "
            "enterprises — retail, trading, and small manufacturing units."
        ),
        categories=["Retail", "General Store", "Textiles"],
        max_project_cost=1_000_000,
    ),
    Scheme(
        id="pmegp",
        name="Prime Minister's Employment Generation Programme (PMEGP)",
        description=(
            "Margin-money subsidy for setting up new micro-enterprises, covering "
            "manufacturing and service-sector projects up to ₹50 lakh."
        ),
        categories=["*"],
        max_project_cost=5_000_000,
    ),
    Scheme(
        id="handloom",
        name="National Handloom Development Programme (NHDP)",
        description=(
            "Support for weavers and textile artisans — raw material subsidy, design "
            "development, and marketing assistance."
        ),
        categories=["Textiles"],
        max_project_cost=1_000_000,
    ),
    Scheme(
        id="standup_india",
        name="Stand-Up India",
        description=(
            "Bank loans between ₹10 lakh and ₹1 crore for setting up a greenfield "
            "enterprise — geared toward first-time entrepreneurs."
        ),
        categories=["*"],
        max_project_cost=10_000_000,
    ),
]

_CANONICAL_CATEGORIES = ["Dairy", "Retail", "Textiles", "Food Processing", "General Store"]


def normalize_category(business_category: str) -> str:
    """Fuzzy-correct a possibly misspelled/colloquial category to the closest known one."""
    if not business_category:
        return business_category

    cleaned = business_category.strip()
    for c in _CANONICAL_CATEGORIES:
        if cleaned.lower() == c.lower():
            return c

    if fuzz is None:
        return cleaned

    best_match, best_score = cleaned, 0
    for c in _CANONICAL_CATEGORIES:
        score = fuzz.token_sort_ratio(cleaned.lower(), c.lower())
        if score > best_score:
            best_match, best_score = c, score

    return best_match if best_score >= 60 else cleaned


def get_applicable_schemes(business_category: str, project_cost: float) -> List[Scheme]:
    category = normalize_category(business_category)
    matched = [
        s
        for s in SCHEMES
        if project_cost <= s.max_project_cost and ("*" in s.categories or category in s.categories)
    ]
    # PMEGP and Stand-Up India are broad catch-alls; keep them last so
    # category-specific schemes surface first.
    matched.sort(key=lambda s: s.categories == ["*"])
    return matched
