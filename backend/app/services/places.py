"""Google Places Text Search — finds police stations near a text address."""

import httpx

TEXTSEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"


async def search_police_stations_by_text(address: str, api_key: str) -> list[dict]:
    """
    Single-API-call approach: Places Text Search for police stations near
    the given address. Only requires Places API to be enabled — no Geocoding
    API needed.
    Returns up to 10 results, each with place_id, name, address, lat, lng.
    Raises ValueError with the API status on a non-retriable error.
    """
    query = f"police station near {address}"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(TEXTSEARCH_URL, params={
            "query": query,
            "type": "police",
            "region": "in",
            "key": api_key,
        })
        data = r.json()

    status = data.get("status", "UNKNOWN")
    if status == "ZERO_RESULTS":
        return []
    if status != "OK":
        raise ValueError(f"Google Places API error: {status}")

    results = []
    for place in data.get("results", [])[:10]:
        results.append({
            "place_id": place.get("place_id", ""),
            "name": place.get("name", ""),
            "address": place.get("formatted_address", ""),
            "lat": place["geometry"]["location"]["lat"],
            "lng": place["geometry"]["location"]["lng"],
        })
    return results
