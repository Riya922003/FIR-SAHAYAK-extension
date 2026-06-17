"""
Free police station search using OpenStreetMap APIs.
No API key or billing account required.
- Nominatim: free geocoding (address → lat/lng)
- Overpass:  free POI search (police stations near a point)
"""

import httpx
from typing import Optional

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URL  = "https://overpass-api.de/api/interpreter"

_HEADERS = {"User-Agent": "FIR-Sahayak/1.0 (https://github.com/Riya922003/FIR-SAHAYAK-extension)"}


async def geocode_nominatim(address: str) -> Optional[dict]:
    """
    Convert a free-text Indian address → {lat, lng, state, district}.
    Returns None if the address can't be found.
    """
    async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
        r = await client.get(NOMINATIM_URL, params={
            "q": address,
            "format": "json",
            "limit": 1,
            "countrycodes": "in",
            "addressdetails": "1",
        })
        results = r.json()

    if not results:
        return None

    hit  = results[0]
    addr = hit.get("address", {})
    state    = addr.get("state", "India")
    district = (
        addr.get("city_district")
        or addr.get("county")
        or addr.get("city")
        or addr.get("town")
        or addr.get("village")
        or ""
    )
    return {
        "lat":      float(hit["lat"]),
        "lng":      float(hit["lon"]),
        "state":    state,
        "district": district,
    }


async def overpass_police_stations(lat: float, lng: float, radius: int = 5000) -> list[dict]:
    """
    Search OpenStreetMap Overpass API for police stations within `radius`
    metres of (lat, lng). Returns up to 10 results.
    """
    query = (
        f"[out:json][timeout:30];"
        f"("
        f'node["amenity"="police"](around:{radius},{lat},{lng});'
        f'way["amenity"="police"](around:{radius},{lat},{lng});'
        f");"
        f"out body center;"
    )
    async with httpx.AsyncClient(timeout=35) as client:
        r = await client.post(OVERPASS_URL, data={"data": query})
        data = r.json()

    stations = []
    for el in data.get("elements", [])[:10]:
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("name:en") or "Police Station"

        addr_parts = [
            tags.get("addr:housenumber", ""),
            tags.get("addr:street", ""),
            tags.get("addr:suburb", "") or tags.get("addr:locality", ""),
            tags.get("addr:city", "") or tags.get("addr:town", ""),
            tags.get("addr:state", ""),
        ]
        address = ", ".join(p for p in addr_parts if p) or tags.get("addr:full", "")

        if el["type"] == "node":
            elat, elng = el["lat"], el["lon"]
        else:
            center = el.get("center", {})
            elat = center.get("lat", lat)
            elng = center.get("lon", lng)

        stations.append({
            "name":    name,
            "address": address,
            "lat":     elat,
            "lng":     elng,
        })

    return stations
