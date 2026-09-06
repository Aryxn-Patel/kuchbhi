import os
import requests
import pandas as pd
from langchain.agents import initialize_agent, AgentType
from langchain_openai import ChatOpenAI
from langchain.agents.agent_toolkits import create_pandas_dataframe_agent
from langchain.tools import tool
from dotenv import load_dotenv
load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")


# Sector mapping to match the broad categories with valid Google Places API types
SECTOR_MAPPING = {
    "food processing / agro / rice mills": ["grocery_store", "supermarket", "food_product_supplier"],
    "manufacturing / general msme / retail": ["store", "hardware_store", "clothing_store", "convenience_store"],
    "large industrial / service units": ["establishment", "corporate_office"],
    "handloom, handicrafts & bamboo crafts": ["home_goods_store", "clothing_store", "art_gallery"],
    "technology / it / digital services": ["electronics_store", "corporate_office"]
}


@tool("analyze_market_feasibility")
def analyze_market_feasibility(village_name: str, district_name: str, state_name: str, business_type: str) -> str:
    """Performs an on-demand check for location coordinates and live competitor density using Google APIs."""

    # 1. On-Demand Geocoding to fetch lat/lng from user input location
    address = f"{village_name}, {district_name}, {state_name}, India"
    geocode_url = f"https://maps.googleapis.com/maps/api/geocode/json?address={requests.utils.quote(address)}&key={GOOGLE_MAPS_API_KEY}"

    try:
        geo_res = requests.get(geocode_url).json()
        if not geo_res.get('results'):
            return f"Could not find geographic coordinates for location: {address}."

        location = geo_res['results'][0]['geometry']['location']
        lat, lng = location['lat'], location['lng']
    except Exception as e:
        return f"Error connecting to Geocoding API: {str(e)}"

    # 2. Map user's selected sector to valid Google Places types
    normalized_business = business_type.lower().strip()
    target_types = SECTOR_MAPPING.get(
        normalized_business, ["store", "establishment", "convenience_store"])

    # 3. On-Demand Google Places API call for competitor saturation
    places_url = "https://places.googleapis.com/v1/places:searchNearby"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "places.displayName"
    }
    payload = {
        "includedTypes": target_types,
        "maxResultCount": 20,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": 5000  # 5 km radius
            }
        }
    }

    try:
        places_res = requests.post(places_url, json=payload, headers=headers)
        competitor_count = 0
        if places_res.status_code == 200:
            places = places_res.json().get('places', [])
            competitor_count = len(places)
    except Exception as e:
        competitor_count = "Unavailable"

    return (
        f"Location Analysis for {village_name}, {district_name} ({state_name}):\n"
        f"- Coordinates: Latitude {lat}, Longitude {lng}\n"
        f"- Sector Evaluated: {business_type}\n"
        f"- Live Competitor Density: Found {competitor_count} related establishment(s) within a 5 km radius."
    )


def create_market_intelligence_agent(csv_path: str):
    df = pd.read_csv(csv_path)
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    # Register the on-demand API tool
    custom_tools = [analyze_market_feasibility]

    agent = create_pandas_dataframe_agent(
        llm,
        df,
        extra_tools=custom_tools,
        verbose=True,
        agent_type=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION,
        handle_parsing_errors=True
    )

    return agent
