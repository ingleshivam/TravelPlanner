from pydantic import BaseModel, BeforeValidator, Field
from typing import Annotated, Any, List, Literal, Optional


def _null_to_zero(v: Any) -> float:
    return float(v) if v is not None else 0.0

def _null_to_empty(v: Any) -> str:
    return str(v) if v is not None else ""

FloatOrZero = Annotated[float, BeforeValidator(_null_to_zero)]
StrOrEmpty  = Annotated[str,   BeforeValidator(_null_to_empty)]


# Destination Researcher
class DestinationOption(BaseModel):
    city: StrOrEmpty = ""
    country: StrOrEmpty = ""
    why_fits_budget: StrOrEmpty = ""
    daily_cost_estimate: FloatOrZero = 0.0
    best_travel_months: StrOrEmpty = ""
    visa_notes: StrOrEmpty = ""
    confidence: Literal["high", "medium", "low"] = "medium"

class DestinationResearchOutput(BaseModel):
    destinations: List[DestinationOption]
    recommended: str = Field(description="City name of top recommended destination")


# Transport Agent
class TransportOption(BaseModel):
    mode: StrOrEmpty = ""
    operator: StrOrEmpty = ""
    estimated_cost_per_person: FloatOrZero = 0.0
    total_cost: FloatOrZero = 0.0
    duration: StrOrEmpty = ""
    booking_tips: StrOrEmpty = ""

class IntercityTransport(BaseModel):
    all_options: List[TransportOption]
    recommended_mode: StrOrEmpty = ""
    estimated_cost_per_person: FloatOrZero = 0.0
    total_cost: FloatOrZero = 0.0
    booking_tips: StrOrEmpty = ""

class LocalTransport(BaseModel):
    daily_cost_per_person: FloatOrZero = 0.0
    total_local_transport: FloatOrZero = 0.0
    recommended_options: List[str] = []

class AirportTransfer(BaseModel):
    cost: FloatOrZero = 0.0
    recommended_mode: StrOrEmpty = ""

class TransportPlanOutput(BaseModel):
    intercity: IntercityTransport
    local_transport: LocalTransport = Field(default_factory=LocalTransport)
    airport_transfer: AirportTransfer = Field(default_factory=AirportTransfer)
    total_transport_cost: FloatOrZero = 0.0
    within_budget: bool = True
    savings_tips: StrOrEmpty = ""


# Accommodation Agent
class AccommodationOption(BaseModel):
    tier: Literal["budget", "best_value", "stretch"]
    type: StrOrEmpty = ""
    estimated_price_per_night: FloatOrZero = 0.0
    total_cost: FloatOrZero = 0.0
    location_notes: StrOrEmpty = ""
    amenities: List[str] = []
    booking_platform: StrOrEmpty = ""
    pro_tip: StrOrEmpty = ""

class AccommodationPlanOutput(BaseModel):
    options: List[AccommodationOption]
    recommended_tier: Optional[Literal["budget", "best_value", "stretch"]] = None
    total_accommodation_cost: FloatOrZero = 0.0
    within_budget: bool


# Itinerary Agent
class Meal(BaseModel):
    place_type: StrOrEmpty = ""
    cost: FloatOrZero = 0.0

class Activity(BaseModel):
    activity: StrOrEmpty = ""
    cost: FloatOrZero = 0.0

class DayPlan(BaseModel):
    day: int
    theme: StrOrEmpty = ""
    morning: Activity
    breakfast: Meal
    afternoon: Activity
    lunch: Meal
    evening: Activity
    dinner: Meal
    local_transport: FloatOrZero = 0.0
    day_total: FloatOrZero = 0.0
    budget_tip: StrOrEmpty = ""

class ItineraryOutput(BaseModel):
    daily_budget_target: FloatOrZero = 0.0
    itinerary: List[DayPlan]
    total_food_and_activities: FloatOrZero = 0.0
    free_time_suggestions: List[str]
    money_saving_hacks: List[str]


# Budget Tracker
class CostBreakdown(BaseModel):
    flights_and_intercity_transport: FloatOrZero = 0.0
    local_transport: FloatOrZero = 0.0
    accommodation: FloatOrZero = 0.0
    food: FloatOrZero = 0.0
    activities: FloatOrZero = 0.0
    airport_transfers: FloatOrZero = 0.0
    emergency_buffer_10pct: FloatOrZero = 0.0

class BudgetSummaryInner(BaseModel):
    total_budget: FloatOrZero = 0.0
    breakdown: CostBreakdown
    total_estimated_cost: FloatOrZero = 0.0
    remaining_buffer: FloatOrZero = 0.0
    status: Literal["WITHIN_BUDGET", "OVER_BUDGET", "TIGHT_FIT"]
    verdict: StrOrEmpty = ""
    top_savings_opportunities: List[str]

class BudgetTrackerOutput(BaseModel):
    budget_summary: BudgetSummaryInner
