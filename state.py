from typing import TypedDict, Optional, List, Literal

class TravelPlanState(TypedDict):
    # ── User inputs ──────────────────────────────────────
    user_budget: float
    origin: str
    destination: Optional[str]
    start_date: str
    end_date: str
    num_days: int
    num_travelers: int
    travel_style: Literal["budget-backpacker", "mid-range", "comfort-budget"]
    interests: List[str]

    # ── Agent outputs ────────────────────────────────────
    destination_research: Optional[dict]
    transport_plan: Optional[dict]
    accommodation_plan: Optional[dict]
    itinerary: Optional[dict]
    budget_summary: Optional[dict]

    # ── Control flow ─────────────────────────────────────
    next_agent: str
    budget_overrun: bool
    overrun_amount: float
    reroute_count: int          # guard against infinite re-route loops
    messages: List[dict]
    final_plan_ready: bool