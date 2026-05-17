from typing import TypedDict, Optional, List, Literal, Dict

class TravelPlanState(TypedDict):
    # ── User inputs ──────────────────────────────────────
    user_budget: float
    currency: str
    currency_symbol: str
    origin: str
    destination: Optional[str]
    start_date: str
    end_date: str
    num_days: int
    num_travelers: int
    travel_style: Literal["budget-backpacker", "mid-range", "comfort-budget"]
    interests: List[str]
    budget_allocation: Dict[str, float]

    # ── Agent outputs ────────────────────────────────────
    destination_research: Optional[dict]
    transport_plan: Optional[dict]
    accommodation_plan: Optional[dict]
    itinerary: Optional[dict]
    budget_summary: Optional[dict]

    # ── Control flow ─────────────────────────────────────
    budget_overrun: bool
    overrun_amount: float
    budget_constraint_message: Optional[str]
    reroute_count: int
    step_count: int
    messages: List[dict]
    final_plan_ready: bool
