import json
import os
from typing import List, Optional

from pydantic import BaseModel
import serpapi


# ── Structured shapes for transport options returned by AI Mode ────────────
# Used only to validate/coerce the JSON SerpAPI hands back — no LLM call involved.

class _FlightOption(BaseModel):
    flight_name: str = ""
    flight_number: str = ""
    flight_time: str = ""
    flight_fare: float = 0.0

class _FlightResult(BaseModel):
    flights: List[_FlightOption] = []


class _TrainOption(BaseModel):
    train_number: str = ""
    train_name: str = ""
    departure_time: str = ""
    train_fare: float = 0.0

class _TrainResult(BaseModel):
    trains: List[_TrainOption] = []


class _BusOption(BaseModel):
    bus_name: str = ""
    bus_number: str = ""
    bus_fare: float = 0.0
    bus_time: str = ""

class _BusResult(BaseModel):
    buses: List[_BusOption] = []


_serpapi_client: serpapi.Client | None = None


def _get_serpapi() -> serpapi.Client:
    global _serpapi_client
    if _serpapi_client is None:
        key = os.getenv("SERPAPI_API_KEY")
        if not key:
            raise RuntimeError("Missing SERPAPI_API_KEY. Add it to .env.")
        _serpapi_client = serpapi.Client(api_key=key)
    return _serpapi_client


def _extract_ai_mode_json(results) -> Optional[dict]:
    """Pull the JSON code block out of a google_ai_mode SerpAPI response."""
    try:
        text_blocks = results.get("text_blocks") or []
        code_block = next(
            (b.get("code") for b in text_blocks if b.get("type") == "code_block" and b.get("language") == "json"),
            None,
        )
        return json.loads(code_block) if code_block else None
    except Exception as e:
        print(f"[ai-mode] failed to parse JSON block: {e}")
        return None


_ZERO_LIVE_TRIP_DATA = {
    "destination_research": None,
    "flights": [], "trains": [], "buses": [],
    "accommodation": "", "activities_food": "",
}

# TODO: replace these with your own AI Mode prompts — placeholders modeled on test.py.
_LIVE_TRIP_DATA_PROMPT_KNOWN_DEST = """
Find trains, flights and buses from {origin} to {destination} on {start_date}.
Also find budget accommodation options in {destination} for {num_travelers} traveler(s)
checking in {start_date} and checking out {end_date}, and the top activities and food
spots in {destination} for a {travel_style} traveler interested in {interests}.

Return the result as a single JSON object with exactly this structure:
{{
  "trains": [{{"train_number": "", "train_name": "", "departure_time": "", "train_fare": 0}}],
  "flights": [{{"flight_name": "", "flight_number": "", "flight_time": "", "flight_fare": 0}}],
  "buses": [{{"bus_name": "", "bus_number": "", "bus_fare": 0, "bus_time": ""}}],
  "accommodation": "free-text summary of hotel/hostel options with name, price per night and location",
  "activities_food": "free-text summary of top attractions, activities and food spots"
}}
"""

_LIVE_TRIP_DATA_PROMPT_UNKNOWN_DEST = """
Recommend 2-3 budget-friendly destinations reachable from {origin} for a {num_days}-day,
{travel_style} trip with a total budget of {currency} {user_budget} for {num_travelers}
traveler(s) interested in {interests}. Pick the single best destination, then for that
destination find trains, flights and buses from {origin} on {start_date}, budget
accommodation options for {num_travelers} traveler(s) checking in {start_date} and
checking out {end_date}, and the top activities and food spots matching the interests above.

Return the result as a single JSON object with exactly this structure:
{{
  "destination_research": {{
    "destinations": [{{"city": "", "country": "", "why_fits_budget": "", "daily_cost_estimate": 0,
                        "best_travel_months": "", "visa_notes": "", "confidence": "high"}}],
    "recommended": "city name of the top pick"
  }},
  "trains": [{{"train_number": "", "train_name": "", "departure_time": "", "train_fare": 0}}],
  "flights": [{{"flight_name": "", "flight_number": "", "flight_time": "", "flight_fare": 0}}],
  "buses": [{{"bus_name": "", "bus_number": "", "bus_fare": 0, "bus_time": ""}}],
  "accommodation": "free-text summary of hotel/hostel options with name, price per night and location",
  "activities_food": "free-text summary of top attractions, activities and food spots"
}}
"""


def search_live_trip_data(
    origin: str, destination: Optional[str], start_date: str, end_date: str,
    num_days: int, num_travelers: int, travel_style: str, interests: list,
    user_budget: float, currency: str,
) -> dict:
    """Single SerpAPI `google_ai_mode` call that gathers everything the old
    destination/transport/accommodation/itinerary nodes used to fetch via ~8
    separate Tavily/Firecrawl searches — capped at exactly 1 SerpAPI call per
    plan to stay within the free-tier quota."""
    interests_str = ", ".join(interests) if interests else "general sightseeing"
    if destination:
        prompt = _LIVE_TRIP_DATA_PROMPT_KNOWN_DEST.format(
            origin=origin, destination=destination, start_date=start_date, end_date=end_date,
            num_travelers=num_travelers, travel_style=travel_style, interests=interests_str,
        )
    else:
        prompt = _LIVE_TRIP_DATA_PROMPT_UNKNOWN_DEST.format(
            origin=origin, start_date=start_date, end_date=end_date, num_days=num_days,
            num_travelers=num_travelers, travel_style=travel_style, interests=interests_str,
            user_budget=user_budget, currency=currency,
        )
    try:
        results = _get_serpapi().search({"engine": "google_ai_mode", "q": prompt})
        data = _extract_ai_mode_json(results)
        if data is None:
            print("[live-trip-data] no JSON block found in AI Mode response")
            return dict(_ZERO_LIVE_TRIP_DATA)
        merged = {**_ZERO_LIVE_TRIP_DATA, **data}
        merged["flights"] = _FlightResult(flights=merged.get("flights") or []).model_dump()["flights"]
        merged["trains"]  = _TrainResult(trains=merged.get("trains") or []).model_dump()["trains"]
        merged["buses"]   = _BusResult(buses=merged.get("buses") or []).model_dump()["buses"]
        return merged
    except Exception as e:
        print(f"[live-trip-data] SerpAPI call failed: {e}")
        return dict(_ZERO_LIVE_TRIP_DATA)
