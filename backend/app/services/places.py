"""
Free police station search using OpenStreetMap APIs.
No API key or billing account required.
- Nominatim: free geocoding (address → lat/lng)
- Overpass:  free POI search (police stations near a point)
"""

import re
import math
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
    Capped at 3 candidates so geocoding stays under ~12s total.
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

    # 4. Last 1 part → "Noida" (city-only fallback)
    if len(parts) >= 1:
        candidates.append(parts[-1])

    # Deduplicate while preserving order, cap at 3 to bound worst-case latency
    seen: set[str] = set()
    result = []
    for c in candidates:
        if c not in seen and len(result) < 3:
            seen.add(c)
            result.append(c)
    return result


async def geocode_nominatim(address: str) -> Optional[dict]:
    """
    Convert a free-text Indian address → {lat, lng, state, district}.
    Per-attempt timeout: 4s. Max 3 candidates → worst-case ~12s total.
    Returns None only if every candidate fails or times out.
    """
    async with httpx.AsyncClient(timeout=4, headers=_HEADERS) as client:
        for candidate in _geocoding_candidates(address):
            try:
                r = await client.get(NOMINATIM_URL, params={
                    "q": candidate,
                    "format": "json",
                    "limit": 1,
                    "countrycodes": "in",
                    "addressdetails": "1",
                })
                results = r.json()
            except (httpx.TimeoutException, httpx.HTTPError, ValueError):
                continue
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


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in km between two coordinates."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def _normalize_name(name: str) -> str:
    """Lowercase + strip common affixes so near-duplicates collapse."""
    n = name.lower().strip()
    for pfx in ("police station ", "police chowki ", "police outpost ", "police post "):
        if n.startswith(pfx):
            n = n[len(pfx):]
    for sfx in (" police station", " police chowki", " police outpost", " police post", " police", " ps"):
        if n.endswith(sfx):
            n = n[: -len(sfx)]
    return n.strip()


def _deduplicate(stations: list[dict], origin_lat: float, origin_lng: float) -> list[dict]:
    """Remove near-duplicates (same normalised name) keeping the closest one."""
    # Sort nearest-first so we keep the closer copy when deduplicating
    stations.sort(key=lambda s: _distance_km(origin_lat, origin_lng, s["lat"], s["lng"]))
    seen: set[str] = set()
    result = []
    for s in stations:
        key = _normalize_name(s["name"])
        if key not in seen:
            seen.add(key)
            result.append(s)
    return result


def _parse_overpass_elements(elements: list, fallback_lat: float, fallback_lng: float) -> list[dict]:
    stations = []
    seen_ids: set = set()
    for el in elements[:20]:
        el_id = (el["type"], el["id"])
        if el_id in seen_ids:
            continue
        seen_ids.add(el_id)

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
            elat = center.get("lat", fallback_lat)
            elng = center.get("lon", fallback_lng)

        # Preserve per-station state/district from OSM tags (may be empty)
        stations.append({
            "name":     name,
            "address":  address,
            "lat":      elat,
            "lng":      elng,
            "state":    tags.get("addr:state", ""),
            "district": tags.get("addr:city", "") or tags.get("addr:town", ""),
        })
    return stations


async def overpass_police_stations(lat: float, lng: float, radius: int = 8000) -> list[dict]:
    """
    Search OpenStreetMap Overpass for police stations within `radius` metres.
    Uses both amenity=police AND name-based search ("Police Station", "Thana")
    because OSM data in India is often incomplete — many stations have a name
    tag but no amenity tag.
    Default radius: 8 km (keeps results close to the search point).
    Overpass query timeout: 10s. HTTP client timeout: 13s.
    Returns results sorted nearest-first, deduplicated. [] on error.
    """
    query = (
        f"[out:json][timeout:10];"
        f"("
        # Standard amenity tag
        f'node["amenity"="police"](around:{radius},{lat},{lng});'
        f'way["amenity"="police"](around:{radius},{lat},{lng});'
        # Name-based: covers stations tagged by name only (common in India)
        f'node["name"~"[Pp]olice [Ss]tation"](around:{radius},{lat},{lng});'
        f'way["name"~"[Pp]olice [Ss]tation"](around:{radius},{lat},{lng});'
        f'node["name"~"[Tt]hana",i](around:{radius},{lat},{lng});'
        f'node["name"~"[Cc]hau?ki",i](around:{radius},{lat},{lng});'
        f");"
        f"out body center;"
    )
    try:
        async with httpx.AsyncClient(timeout=13) as client:
            r = await client.post(OVERPASS_URL, data={"data": query})
            data = r.json()
    except (httpx.TimeoutException, httpx.HTTPError, ValueError):
        return []

    raw = _parse_overpass_elements(data.get("elements", []), lat, lng)
    return _deduplicate(raw, lat, lng)


async def nominatim_police_stations(lat: float, lng: float) -> list[dict]:
    """
    Fallback search: ask Nominatim for amenity=police within a ~9 km bounding box.
    Used when Overpass returns nothing (sparse OSM data in the area).
    Smaller box avoids pulling in stations from distant cities.
    Timeout: 5s.
    """
    delta = 0.08  # ~9 km in each direction
    params = {
        "amenity": "police",
        "format": "json",
        "limit": 15,
        "countrycodes": "in",
        "viewbox": f"{lng - delta},{lat + delta},{lng + delta},{lat - delta}",
        "bounded": "1",
        "addressdetails": "1",
    }
    try:
        async with httpx.AsyncClient(timeout=5, headers=_HEADERS) as client:
            r = await client.get(NOMINATIM_URL, params=params)
            results = r.json()
    except (httpx.TimeoutException, httpx.HTTPError, ValueError):
        return []

    stations = []
    for hit in results:
        addr = hit.get("address", {})
        name = hit.get("name") or "Police Station"
        addr_parts = [
            addr.get("road", ""),
            addr.get("suburb", "") or addr.get("neighbourhood", ""),
            addr.get("city", "") or addr.get("town", "") or addr.get("county", ""),
            addr.get("state", ""),
        ]
        address = ", ".join(p for p in addr_parts if p)
        stations.append({
            "name":     name,
            "address":  address,
            "lat":      float(hit["lat"]),
            "lng":      float(hit["lon"]),
            # Nominatim gives us accurate per-station state/district
            "state":    addr.get("state", ""),
            "district": addr.get("city", "") or addr.get("town", "") or addr.get("county", ""),
        })
    return _deduplicate(stations, lat, lng)
