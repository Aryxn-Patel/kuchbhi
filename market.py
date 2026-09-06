import os
import requests
from dataclasses import dataclass
from typing import Optional

GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")

# Sector mapping to match the broad categories with valid Google Places API (New) types.
# IMPORTANT: only use types from Google's official supported list —
# https://developers.google.com/maps/documentation/places/web-service/place-types
# Invalid types cause a 400 Bad Request on the whole request, not a partial result.
SECTOR_MAPPING = {
    "food processing / agro / rice mills": ["grocery_store", "supermarket"],
    "manufacturing / general msme / retail": ["store", "hardware_store", "clothing_store", "convenience_store"],
    "large industrial / service units": ["store"],
    "handloom, handicrafts & bamboo crafts": ["home_goods_store", "clothing_store", "art_gallery"],
    "technology / it / digital services": ["electronics_store"],
    # fallback for canonical categories used elsewhere in the app
    "dairy": ["grocery_store", "supermarket"],
    "retail": ["store", "convenience_store", "clothing_store"],
    "textiles": ["clothing_store", "home_goods_store"],
    "food processing": ["grocery_store", "supermarket"],
    "general store": ["convenience_store", "store"],
}

DEFAULT_TYPES = ["store", "convenience_store"]


class LiveMarketError(Exception):
    pass


@dataclass
class LiveCompetitorData:
    latitude: float
    longitude: float
    competitor_count: int
    competitor_breakdown: str  # Frontend par dikhane ke liye nayi field
    radius_km: float
    sector_types_checked: list


def _geocode(village_name: str, district_name: str, state_name: str) -> tuple:
    if not GOOGLE_MAPS_API_KEY:
        raise LiveMarketError("GOOGLE_MAPS_API_KEY is not configured.")

    address = f"{village_name}, {district_name}, {state_name}, India"
    url = (
        "https://maps.googleapis.com/maps/api/geocode/json"
        f"?address={requests.utils.quote(address)}&key={GOOGLE_MAPS_API_KEY}"
    )

    try:
        resp = requests.get(url, timeout=10).json()
    except Exception as e:
        raise LiveMarketError(f"Geocoding request failed: {e}")

    if resp.get("status") != "OK" or not resp.get("results"):
        raise LiveMarketError(
            f"Could not geocode '{address}' (status={resp.get('status')})."
        )

    location = resp["results"][0]["geometry"]["location"]
    return location["lat"], location["lng"]


def get_live_competitor_density(
    village_name: str,
    district_name: str,
    state_name: str,
    business_type: str,
    radius_km: float = 5.0,
) -> LiveCompetitorData:
    """
    Geocodes the given location and counts nearby businesses matching the
    sector via Google Places (New) searchNearby. Raises LiveMarketError on
    any failure — callers should treat this as best-effort and fall back
    to the static census-derived business_saturation_index if it fails.
    """
    lat, lng = _geocode(village_name, district_name, state_name)

    normalized = business_type.lower().strip()
    target_types = SECTOR_MAPPING.get(normalized, DEFAULT_TYPES)

    url = "https://places.googleapis.com/v1/places:searchNearby"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.primaryType", # Yahan FieldMask update kiya gaya hai
    }
    payload = {
        "includedTypes": target_types,
        "maxResultCount": 20,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": radius_km * 1000,
            }
        },
    }

    try:
        res = requests.post(url, json=payload, headers=headers, timeout=10)
        res.raise_for_status()
        places = res.json().get("places", [])
        
        # Har category ka alag count nikalne ka logic
        category_counts = {}
        for place in places:
            primary_type = place.get('primaryType', 'Other')
            category_counts[primary_type] = category_counts.get(primary_type, 0) + 1
            
        # Format: "Grocery Store: 10, Convenience Store: 5"
        breakdown_list = [f"{k.replace('_', ' ').title()}: {v}" for k, v in category_counts.items()]
        breakdown_str = ", ".join(breakdown_list) if breakdown_list else "No active competitors found"

    except Exception as e:
        raise LiveMarketError(f"Places API call failed: {e}")

    return LiveCompetitorData(
        latitude=lat,
        longitude=lng,
        competitor_count=len(places),
        competitor_breakdown=breakdown_str, # Naya breakdown data include kiya gaya hai
        radius_km=radius_km,
        sector_types_checked=target_types,
    )