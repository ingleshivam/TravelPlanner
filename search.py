import json
import os
from typing import List, Optional

from pydantic import BaseModel, ConfigDict
import serpapi


# ── Structured shapes for transport/accommodation returned by AI Mode ──────
# extra='allow' preserves every field SerpAPI returns so the master LLM sees
# the full richness without us stripping anything at validation time.

class _FlightOption(BaseModel):
    model_config = ConfigDict(extra="allow")
    airline: str = ""
    flight_number: str = ""
    departure_time: str = ""
    arrival_time: str = ""
    duration: str = ""
    stops: str = ""
    flight_fare: float = 0.0

class _FlightResult(BaseModel):
    flights: List[_FlightOption] = []


class _TrainOption(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)
    train_name: str = ""
    train_number: str = ""
    operator: str = ""
    departure_time: str = ""
    arrival_time: str = ""
    duration: str = ""
    train_fare: float = 0.0

class _TrainResult(BaseModel):
    trains: List[_TrainOption] = []


class _BusOption(BaseModel):
    model_config = ConfigDict(extra="allow")
    operator: str = ""
    bus_type: str = ""
    departure_time: str = ""
    arrival_time: str = ""
    duration: str = ""
    bus_fare: float = 0.0

class _BusResult(BaseModel):
    buses: List[_BusOption] = []


class _AccommodationOption(BaseModel):
    model_config = ConfigDict(extra="allow")
    property_name: str = ""
    type: str = ""
    price_per_night: float = 0.0
    location: str = ""
    amenities: List[str] = []

class _AccommodationResult(BaseModel):
    accommodation: List[_AccommodationOption] = []


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
    """Pull the JSON code block out of a google_ai_mode SerpAPI response.

    SerpAPI truncates long responses mid-code-block and continues the content
    as subsequent paragraph blocks. We stitch them together before parsing.
    """
    try:
        text_blocks = results.get("text_blocks") or []

        json_block_idx = None
        code = None
        for i, b in enumerate(text_blocks):
            if b.get("type") == "code_block" and b.get("language") == "json":
                json_block_idx = i
                code = b.get("code", "")
                break

        if code is None:
            return None

        try:
            return json.loads(code)
        except json.JSONDecodeError:
            pass

        # Truncated — stitch with subsequent paragraph snippets
        for b in text_blocks[json_block_idx + 1:]:
            if b.get("type") == "paragraph":
                code += b.get("snippet", "")
            elif b.get("type") == "code_block":
                break

        return json.loads(code)
    except Exception as e:
        print(f"[ai-mode] failed to parse JSON block: {e}")
        return None


_ZERO_LIVE_TRIP_DATA = {
    "destination_research": None,
    "flights": [], "trains": [], "buses": [],
    "accommodation": [], "activities_food": "",
}

_LIVE_TRIP_DATA_PROMPT_KNOWN_DEST = """
INPUT DATA:

origin              : {origin}
destination         : {destination}
start_date          : {start_date}
end_date            : {end_date}
num_days            : {num_days}
num_travelers       : {num_travelers}
total_budget        : {user_budget}
travel_style        : {travel_style}
interests           : {interests}
budget_allocation   : {budget_allocation}

PROMPT:

You are a Master Budget Travel Planner. Given the input data above, produce one complete structured JSON plan covering destination, transport, accommodation, itinerary, and budget.

## PLANNING STEPS

1. DESTINATION: destination is already provided — skip destination research.
2. BUDGET SPLIT: flights_transport 30-40%, accommodation 20-25%, food 15-20%, activities 10-15%, airport_transfers 3-5%, misc_buffer 10%.
3. TRANSPORT: find all options per mode → sort each by fare ascending → keep TOP 5 per mode.
4. ACCOMMODATION: find all options → sort by price_per_night ascending → keep TOP 5.
5. ITINERARY: activity priority: sightseeing > monuments > temples > museums > nature > culture > food > markets. Every day needs 1+ meaningful attraction. No filler activities.
6. BUDGET CHECK: remaining = total_budget - total_estimated_cost. WITHIN_BUDGET if remaining >= 8% of budget. TIGHT_FIT if 0 <= remaining < 8%. OVER_BUDGET if negative.

## OUTPUT (strict JSON, exact field names)

{{
  "trip_overview": {{
    "origin": str,
    "destination": str,
    "country": str,
    "travel_dates": {{ "start": str, "end": str, "num_days": int }},
    "num_travelers": int,
    "travel_style": str,
    "total_budget": float,
    "currency": str,          # Find based on origin
    "currency_symbol": str    # Find based on origin
  }},

  "destination_options": [],
  "recommended_destination": str,

  "transport": {{
    "flights": {{
      "options": [
        {{
          "rank": int,
          "airline": str,
          "flight_number": str,
          "departure_time": str,
          "arrival_time": str,
          "duration": str,
          "stops": str,
          "estimated_cost_per_person": float,
          "total_cost": float,
          "booking_platform": str,
          "booking_tips": str
        }}
      ],
      "recommended_rank": int,
      "total_options_found": int
    }},
    "trains": {{
      "options": [
        {{
          "rank": int,
          "train_name": str,
          "train_number": str,
          "operator": str,
          "departure_time": str,
          "arrival_time": str,
          "duration": str,
          "class": str,
          "estimated_cost_per_person": float,
          "total_cost": float,
          "booking_platform": str,
          "booking_tips": str
        }}
      ],
      "recommended_rank": int,
      "total_options_found": int
    }},
    "buses": {{
      "options": [
        {{
          "rank": int,
          "operator": str,
          "bus_type": str,
          "departure_time": str,
          "arrival_time": str,
          "duration": str,
          "estimated_cost_per_person": float,
          "total_cost": float,
          "booking_platform": str,
          "booking_tips": str
        }}
      ],
      "recommended_rank": int,
      "total_options_found": int
    }},
    "recommended_mode": str,
    "recommended_operator": str,
    "recommended_cost_per_person": float,
    "recommended_total_cost": float,
    "local_transport": {{
      "daily_cost_per_person": float,
      "total_local_transport": float,
      "recommended_options": list
    }},
    "airport_transfer": {{
      "cost": float,
      "recommended_mode": str,
      "notes": str
    }},
    "total_transport_cost": float,
    "within_budget": bool,
    "savings_tips": str
  }},

  "accommodation": {{
    "options": [
      {{
        "rank": int,
        "property_name": str,
        "type": str,
        "estimated_price_per_night": float,
        "total_cost": float,
        "location_notes": str,
        "amenities": list,
        "booking_platform": str,
        "breakfast_included": bool,
        "pro_tip": str
      }}
    ],
    "recommended_rank": int,
    "total_options_found": int,
    "total_accommodation_cost": float,
    "within_budget": bool
  }},

  "itinerary": {{
    "daily_budget_target": float,
    "days": [
      {{
        "day": int,
        "date": str,
        "theme": str,
        "morning":   {{ "activity": str, "location": str, "entry_fee": float, "notes": str }},
        "breakfast": {{ "place_type": str, "recommended_dish": str, "cost": float }},
        "afternoon": {{ "activity": str, "location": str, "entry_fee": float, "notes": str }},
        "lunch":     {{ "place_type": str, "recommended_dish": str, "cost": float }},
        "evening":   {{ "activity": str, "location": str, "entry_fee": float, "notes": str }},
        "dinner":    {{ "place_type": str, "recommended_dish": str, "cost": float }},
        "local_transport": float,
        "day_total": float,
        "budget_tip": str
      }}
    ],
    "total_food_and_activities": float,
    "free_time_suggestions": list,
    "money_saving_hacks": list
  }},

  "budget_summary": {{
    "total_budget": float,
    "breakdown": {{
      "flights_and_intercity_transport": float,
      "local_transport": float,
      "airport_transfers": float,
      "accommodation": float,
      "food": float,
      "activities": float,
      "emergency_buffer_10pct": float
    }},
    "total_estimated_cost": float,
    "remaining_buffer": float,
    "status": "WITHIN_BUDGET" | "TIGHT_FIT" | "OVER_BUDGET",
    "verdict": str,
    "top_savings_opportunities": list
  }}
}}

## RULES
1. All monetary values in the currency specified by the input data.
2. Use exact field names above — no renaming, no currency suffixes.
3. Never invent prices — only use real, verified fares and rates.
4. destination_options must be an empty list [] since destination is already provided.
5. budget_summary.breakdown values must sum to total_estimated_cost.
6. Include highly famous attractions in nearby cities within 70 km if globally renowned; calculate regional transport cost to get there.
7. If budget cannot accommodate a flight, present the train option and add a budget_warnings field explaining how much extra is needed for a flight.
8. day_total must equal the sum of all cost fields in that day.
9. TIGHT_FIT: remaining_buffer between 0 and 8% of total_budget.
10. top_savings_opportunities: always 3 items when status is TIGHT_FIT or OVER_BUDGET; [] otherwise.
11. Sort flights/trains/buses by estimated_cost_per_person ASC, accommodation by estimated_price_per_night ASC — keep TOP 5 each. rank 1 = cheapest.
12. recommended_rank points to the best-fit option within budget.
"""


def search_live_trip_data(
    origin: str, destination: Optional[str], start_date: str, end_date: str,
    num_days: int, num_travelers: int, travel_style: str, interests: list,
    user_budget: float, budget_allocation: Optional[dict] = None,
) -> dict:
    """Single SerpAPI `google_ai_mode` call that gathers everything the old
    destination/transport/accommodation/itinerary nodes used to fetch via ~8
    separate Tavily/Firecrawl searches — capped at exactly 1 SerpAPI call per
    plan to stay within the free-tier quota."""
    interests_str = ", ".join(interests) if interests else "general sightseeing"

    alloc = budget_allocation or {"transport": 35, "accommodation": 35, "food": 15, "activities": 10, "misc": 5}
    prompt = _LIVE_TRIP_DATA_PROMPT_KNOWN_DEST.format(
        origin=origin, destination=destination, start_date=start_date, end_date=end_date,
        num_days=num_days, num_travelers=num_travelers, user_budget=user_budget,
        travel_style=travel_style, interests=interests_str,
        budget_allocation=json.dumps(alloc),
    )

    try:
        results = _get_serpapi().search({"engine": "google_ai_mode", "q": prompt})
        results = dict(results)

        if os.getenv("DEBUG_SERPAPI"):
            with open("serpapi_result.txt", "w", encoding="utf-8") as f:
                json.dump(results, f, indent=2)

        data = _extract_ai_mode_json(results)
        if data is None:
            print("[live-trip-data] no JSON block found in AI Mode response")
            return dict(_ZERO_LIVE_TRIP_DATA)

        # Validate sub-sections so downstream code gets clean typed lists,
        # but keep the full raw plan intact so nothing is lost for GenUI.
        transport = data.get("transport") or {}
        accommodation = data.get("accommodation") or {}
        merged = {**_ZERO_LIVE_TRIP_DATA, **data}
        merged["flights"]       = _FlightResult(flights=transport.get("flights", {}).get("options") or []).model_dump()["flights"]
        merged["trains"]        = _TrainResult(trains=transport.get("trains", {}).get("options") or []).model_dump()["trains"]
        merged["buses"]         = _BusResult(buses=transport.get("buses", {}).get("options") or []).model_dump()["buses"]
        merged["accommodation"] = _AccommodationResult(accommodation=accommodation.get("options") or []).model_dump()["accommodation"]
        merged["full_plan"]     = data   # complete SerpAPI plan — used directly as master_plan
        return merged
    except Exception as e:
        print(f"[live-trip-data] SerpAPI call failed: {e}")
        return dict(_ZERO_LIVE_TRIP_DATA)
