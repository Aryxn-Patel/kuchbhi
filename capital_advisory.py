"""
Minimum viable capital advisory.

The tool previously accepted any positive `available_capital` (even Rs. 500)
for any business category and produced a full report as if the business were
realistically startable — including "Dairy", which needs at least one animal
plus a shed. This module adds a rough, indicative minimum own-contribution
figure per category, and flags when the user's capital falls short, along
with which categories *would* be realistic at their budget.

These numbers are deliberately conservative ballpark estimates for a rural
Indian context (not sourced from an official schedule of costs) — they exist
to stop obviously unviable submissions from silently producing a polished
report, not to be a precise costing tool. Treat them as configurable/tunable.
"""

from dataclasses import dataclass
from typing import List

try:
    from rapidfuzz import fuzz
except ImportError:  # pragma: no cover
    fuzz = None


# Indicative minimum *own contribution* (10% margin money) needed to
# realistically start each category, in rupees. Kept intentionally rough.
MIN_VIABLE_CAPITAL = {
    "General Store": 5_000,
    "Retail": 5_000,
    "Textiles": 8_000,
    "Food Processing": 10_000,
    "Dairy": 25_000,
}

_CANONICAL_CATEGORIES = list(MIN_VIABLE_CAPITAL.keys())

DEFAULT_MIN_VIABLE_CAPITAL = 5_000  # fallback for an unrecognised category


@dataclass
class CapitalAdvisory:
    is_sufficient: bool
    min_recommended_capital: float
    category_min_capital: float
    viable_categories: List[str]


def _normalize_category(business_category: str) -> str:
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


def get_capital_advisory(business_category: str, available_capital: float) -> CapitalAdvisory:
    category = _normalize_category(business_category)
    category_min = MIN_VIABLE_CAPITAL.get(category, DEFAULT_MIN_VIABLE_CAPITAL)

    is_sufficient = available_capital >= category_min

    # Categories that *would* be realistic at the user's current capital,
    # cheapest first, so the frontend can suggest alternatives.
    viable = sorted(
        [c for c, min_cap in MIN_VIABLE_CAPITAL.items() if available_capital >= min_cap],
        key=lambda c: MIN_VIABLE_CAPITAL[c],
    )

    return CapitalAdvisory(
        is_sufficient=is_sufficient,
        min_recommended_capital=min(MIN_VIABLE_CAPITAL.values()),
        category_min_capital=category_min,
        viable_categories=viable,
    )
