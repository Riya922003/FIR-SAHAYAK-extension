"""
Free police station search using OpenStreetMap APIs.
No API key or billing account required.
- Nominatim: free geocoding (address → lat/lng)
- Overpass:  free POI search (police stations near a point)
"""

import re
import httpx
from typing import Optional

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URL  = "https://overpass-api.de/api/interpreter"

_HEADERS = {"User-Agent": "FIR-Sahayak/1.0 (github.com/Riya922003/FIR-SAHAYAK-extension)"}

# Matches "Near X,", "Opposite X,", "Behind X," etc. at the start of an address
_LANDMARK_RE = re.compile(
    r"^\s*(near|opp\.?|opposite|behind|next\s+to|beside|in\s+front\s+of|nr\.?|adj\.?|adjacent\s+to)"
    r"\s+[^,]+,?\s*",
    re.IGNORECASE,
)


def _geocoding_candidates(address: str) -> list[str]:
    """
    Return address variants to try, from most-specific to least-specific.
    Handles informal Indian addresses like "Near SBI ATM, Sector 21, Noida".
    """
    candidates = []

    # 1. Strip "Near X," prefix → "Sector 21, Noida"
    stripped = _LANDMARK_RE.sub("", address).strip().strip(",").strip()
    if stripped and stripped != address:
        candidates.append(stripped)

    # 2. Original address (as-is)
    candidates.append(address)

    # 3. Last 2 comma-parts → "Sector 21, Noida"
    parts = [p.strip() for p in address.split(",") if p.strip()]
    if len(parts) >= 2:
        candidates.append(", ".join(parts[-2:]))

    # 4. Last 1 part → "Noida"
    if len(parts) >= 1:
        candidates.append(parts[-1])

    # Deduplicate while preserving order
    seen: set[str] = set()
    result = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            result.append(c)
    return result


async def geocode_nominatim(address: str) -> Optional[dict]:
    """
    Convert a free-text Indian address → {lat, lng, state, district}.
    Tries multiple address variants so informal descriptions like
    "Near SBI ATM, Sector 21, Noida" still resolve correctly.
    Returns None only if every candidate fails.
    """
    async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
        for candidate in _geocoding_candidates(address):
            r = await client.get(NOMINATIM_URL, params={
                "q": candidate,
                "format": "json",
                "limit": 1,
                "countrycodes": "in",
                "addressdetails": "1",
            })
            results = r.json()
            if results:
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
    return None


async def overpass_police_stations(lat: float, lng: float, radius: int = 5000) -> list[dict]:
    """
    Search OpenStreetMap Overpass for police stations within `radius` metres.
    Returns up to 10 results.
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
        tags  = el.get("tags", {})
        name  = tags.get("name") or tags.get("name:en") or "Police Station"
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
            elat   = center.get("lat", lat)
            elng   = center.get("lon", lng)

        stations.append({
            "name":    name,
            "address": address,
            "lat":     elat,
            "lng":     elng,
        })
    return stations
