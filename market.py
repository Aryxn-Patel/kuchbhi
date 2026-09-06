import os
import requests
import pandas as pd
from langchain.agents import initialize_agent, AgentType
from langchain_openai import ChatOpenAI
from langchain.agents.agent_toolkits import create_pandas_dataframe_agent
from langchain.tools import tool

GOOGLE_MAPS_API_KEY = os.getenv(
    "GOOGLE_MAPS_API_KEY", "AIzaSyCGTM2nmlELS3K1BtZHJU4LRSSumudyUzI")

@tool("analyze_market_feasibility")
def analyze_market_feasibility(village_name: str, district_name: str, state_name: str, selected_business_types: str) -> str:
    """Performs an on-demand check for location coordinates and live competitor density using Google APIs."""

    # 1. On-Demand Geocoding to fetch lat/lng
    address = f"{village_name}, {district_name}, {state_name}, India"
    geocode_url = f"https://maps.googleapis.com/maps/api/geocode/json?address={requests.utils.quote(address)}&key={GOOGLE_MAPS_API_KEY}"

    geo_res = requests.get(geocode_url).json()
    if not geo_res.get('results'):
        return f"0 {selected_business_types} nearby"

    location = geo_res['results'][0]['geometry']['location']
    lat, lng = location['lat'], location['lng']

    # 2. Format the selected business types
    types_list = [t.strip().lower().replace(" ", "_") for t in selected_business_types.split(",") if t.strip()]

    # 3. On-Demand Google Places API call
    places_url = "https://places.googleapis.com/v1/places:searchNearby"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "places.displayName"
    }
    payload = {
        "includedTypes": types_list,
        "maxResultCount": 20,  # Max limit set to 20 to check the threshold
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": 5000  
            }
        }
    }

    places_res = requests.post(places_url, json=payload, headers=headers)
    competitor_count = 0
    
    if places_res.status_code == 200:
        places = places_res.json().get('places', [])
        competitor_count = len(places)
    else:
        return f"API Error: {places_res.status_code}"

    # 4. Format output to exactly "<count> <business_type> nearby"
    display_count = "20+" if competitor_count >= 20 else str(competitor_count)
    
    return f"{display_count} {selected_business_types} nearby"
