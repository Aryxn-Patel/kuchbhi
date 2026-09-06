import os, requests, json
from dotenv import load_dotenv
load_dotenv()

key = os.environ.get("GOOGLE_MAPS_API_KEY")

url = "https://places.googleapis.com/v1/places:searchNearby"
headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": key,
    "X-Goog-FieldMask": "places.displayName"
}
payload = {
    "includedTypes": ["store"],
    "maxResultCount": 5,
    "locationRestriction": {
        "circle": {
            "center": {"latitude": 26.1157917, "longitude": 91.7085933},
            "radius": 5000
        }
    }
}

res = requests.post(url, json=payload, headers=headers)
print(res.status_code)
print(json.dumps(res.json(), indent=2))