from state import TravelPlanState
from search import search_live_trip_data

DEFAULT_BUDGET_ALLOCATION = {
    "transport": 35,
    "accommodation": 35,
    "food": 15,
    "activities": 10,
    "misc": 5,
}


def _allocation_ratio(state: TravelPlanState, category: str) -> float:
    allocation = state.get("budget_allocation") or DEFAULT_BUDGET_ALLOCATION
    value = allocation.get(category, DEFAULT_BUDGET_ALLOCATION[category])
    return value / 100 if value > 1 else value


def _validate_budget_allocation(state: TravelPlanState) -> None:
    total = sum(_allocation_ratio(state, k) for k in DEFAULT_BUDGET_ALLOCATION)
    if total > 1.0:
        raise ValueError(
            f"Budget allocation total is {total * 100:.1f}%. "
            "Keep transport + accommodation + food + activities + misc at or below 100%."
        )


def live_data_research_node(state: TravelPlanState) -> dict:
    """Calls SerpAPI once; the AI Mode response IS the complete plan — no second LLM needed."""
    _validate_budget_allocation(state)
    live_data = search_live_trip_data(
        origin=state["origin"],
        destination=state.get("destination"),
        start_date=state["start_date"],
        end_date=state["end_date"],
        num_days=state["num_days"],
        num_travelers=state["num_travelers"],
        travel_style=state["travel_style"],
        interests=state["interests"],
        user_budget=state["user_budget"],
        budget_allocation=state.get("budget_allocation"),
    )

    full_plan = live_data.get("full_plan") or {}
    overview  = full_plan.get("trip_overview") or {}

    update: dict = {
        "live_trip_data":     live_data,
        "master_plan":        full_plan,
        "final_plan_ready":   bool(full_plan),
        "budget_summary":     full_plan.get("budget_summary"),
        "transport_plan":     full_plan.get("transport"),
        "accommodation_plan": full_plan.get("accommodation"),
        "itinerary":          full_plan.get("itinerary"),
    }

    resolved_dest = (
        state.get("destination")
        or full_plan.get("recommended_destination")
        or overview.get("destination")
    )
    if resolved_dest:
        update["destination"] = resolved_dest

    return update
