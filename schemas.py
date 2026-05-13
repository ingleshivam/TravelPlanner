from pydantic import BaseModel, Field
from typing import List, Literal, Optional


# Destination Researcher
class DestinationOption(BaseModel):
    city: str
    country: str
    why_fits_budget: str
    daily_cost_estimate_usd: float
    best_travel_months: str
    visa_notes: str
    confidence: Literal["high", "medium", "low"]

class DestinationResearchOutput(BaseModel):
    destinations: List[DestinationOption]
    recommended: str = Field(description="City name of top recommended destination")


# Transport Agent
class IntercityTransport(BaseModel):
    mode: str
    estimated_cost_per_person_usd: float
    total_cost_usd: float
    booking_tips: str
    budget_airlines_or_options: List[str]

class LocalTransport(BaseModel):
    daily_cost_per_person_usd: float
    total_local_transport_usd: float
    recommended_options: List[str]

class AirportTransfer(BaseModel):
    cost_usd: float
    recommended_mode: str

class TransportPlanOutput(BaseModel):
    intercity: IntercityTransport
    local_transport: LocalTransport
    airport_transfer: AirportTransfer
    total_transport_cost_usd: float
    within_budget: bool
    savings_tips: str


# Accommodation Agent
class AccommodationOption(BaseModel):
    tier: Literal["budget", "best_value", "stretch"]
    type: str
    estimated_price_per_night_usd: float
    total_cost_usd: float
    location_notes: str
    amenities: List[str]
    booking_platform: str
    pro_tip: str

class AccommodationPlanOutput(BaseModel):
    options: List[AccommodationOption]
    recommended_tier: Literal["budget", "best_value", "stretch"]
    total_accommodation_cost_usd: float
    within_budget: bool


# Itinerary Agent
class Meal(BaseModel):
    place_type: str
    cost_usd: float

class Activity(BaseModel):
    activity: str
    cost_usd: float

class DayPlan(BaseModel):
    day: int
    theme: str
    morning: Activity
    breakfast: Meal
    afternoon: Activity
    lunch: Meal
    evening: Activity
    dinner: Meal
    local_transport_usd: float
    day_total_usd: float
    budget_tip: str

class ItineraryOutput(BaseModel):
    daily_budget_target_usd: float
    itinerary: List[DayPlan]
    total_food_and_activities_usd: float
    free_time_suggestions: List[str]
    money_saving_hacks: List[str]


# Budget Tracker
class CostBreakdown(BaseModel):
    flights_and_intercity_transport: float
    local_transport: float
    accommodation: float
    food: float
    activities: float
    airport_transfers: float
    emergency_buffer_10pct: float

class BudgetSummaryInner(BaseModel):
    total_budget_usd: float
    breakdown: CostBreakdown
    total_estimated_cost_usd: float
    remaining_buffer_usd: float
    status: Literal["WITHIN_BUDGET", "OVER_BUDGET", "TIGHT_FIT"]
    verdict: str
    top_savings_opportunities: List[str]

class BudgetTrackerOutput(BaseModel):
    budget_summary: BudgetSummaryInner