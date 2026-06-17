"""Google Geocoding + Places Nearby Search helpers."""

import httpx
from typing import Optional

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
NEARBY_URL  = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"


async def geocode_address(address: str, api_key: str) -> Optional[dict]:
    """
    Convert a free-text address to {lat, lng, state, district}.
    Returns None if Google can't resolve it.
    """
    query = address if "india" in address.lower() else f"{address}, India"
    async with httpx.AsyncClient(timeout=8) as client:
        r = await client.get(GEOCODE_URL, params={
            "address": query,
            "key": api_key,
            "region": "in",
        })
        data = r.json()

    if data.get("status") != "OK" or not data.get("results"):
        return None

    result = data["results"][0]
    state, district = "India", ""

    for comp in result.get("address_components", []):
        types = comp.get("types", [])
        if "administrative_area_level_1" in types:
            state = comp["long_name"]
        if "administrative_area_level_2" in types and not district:
            district = comp["long_name"]
        elif "locality" in types and not district:
            district = comp["long_name"]

    loc = result["geometry"]["location"]
    return {
        "lat": loc["lat"],
        "lng": loc["lng"],
        "state": state,
        "district": district,
    }


async def nearby_police_stations(
    lat: float, lng: float, api_key: str, radius: int = 5000
) -> list[dict]:
    """
    Search Google Places for police stations within `radius` metres of (lat, lng).
    Returns up to 10 results.
    """
    async with httpx.AsyncClient(timeout=8) as client:
        r = await client.get(NEARBY_URL, params={
            "location": f"{lat},{lng}",
            "radius": radius,
            "type": "police",
            "keyword": "police station thana",
            "key": api_key,
        })
        data = r.json()

    results = []
    for place in data.get("results", [])[:10]:
        results.append({
            "place_id": place.get("place_id", ""),
            "name": place.get("name", ""),
            "address": place.get("vicinity", ""),
            "lat": place["geometry"]["location"]["lat"],
            "lng": place["geometry"]["location"]["lng"],
        })
    return results
