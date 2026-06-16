import json
from schemas import MasterPlanOutput
from state import TravelPlanState
from agents import master_chain, invoke_with_retry
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


def _build_real_time_data(live: dict) -> str:
    parts = []
    if live.get("flights"):
        parts.append("=== FLIGHTS ===\n" + json.dumps(live["flights"], indent=2))
    if live.get("trains"):
        parts.append("=== TRAINS ===\n" + json.dumps(live["trains"], indent=2))
    if live.get("buses"):
        parts.append("=== BUSES ===\n" + json.dumps(live["buses"], indent=2))
    if live.get("accommodation"):
        acc = live["accommodation"]
        acc_text = json.dumps(acc, indent=2) if isinstance(acc, list) else str(acc)
        parts.append("=== ACCOMMODATION ===\n" + acc_text)
    if live.get("activities_food"):
        parts.append("=== ACTIVITIES & FOOD ===\n" + str(live["activities_food"]))
    return "\n\n".join(parts)


# ── Graph nodes ────────────────────────────────────────────────────────────────

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
        "live_trip_data":   live_data,
        "master_plan":      full_plan,
        "final_plan_ready": bool(full_plan),
        "budget_summary":   full_plan.get("budget_summary"),
        "transport_plan":   full_plan.get("transport"),
        "accommodation_plan": full_plan.get("accommodation"),
        "itinerary":        full_plan.get("itinerary"),
    }

    resolved_dest = (
        state.get("destination")
        or full_plan.get("recommended_destination")
        or overview.get("destination")
    )
    if resolved_dest:
        update["destination"] = resolved_dest

    return update


def trip_planner_node(state: TravelPlanState) -> dict:
    """Calls the master LLM with SerpAPI data and returns the complete travel plan."""
    live = state.get("live_trip_data") or {}
    real_time_data = _build_real_time_data(live)

    master_input = json.dumps({
        "origin": state["origin"],
        "destination": state.get("destination"),
        "travel_dates": {"start": state["start_date"], "end": state["end_date"]},
        "num_days": state["num_days"],
        "num_travelers": state["num_travelers"],
        "total_budget": state["user_budget"],
        "currency": state["currency"],
        "currency_symbol": state["currency_symbol"],
        "travel_style": state["travel_style"],
        "interests": state["interests"],
        "accommodation_preferences": state["interests"],
        "real_time_search_data": real_time_data,
    })

    master: MasterPlanOutput = invoke_with_retry(master_chain, {"input": master_input})

    resolved_dest = (
        state.get("destination")
        or master.recommended_destination
        or master.trip_overview.destination
    )

    t = master.transport
    all_options = (
        [{"mode": "flight", **o.model_dump()} for o in t.flights.options]
        + [{"mode": "train", **o.model_dump(by_alias=True)} for o in t.trains.options]
        + [{"mode": "bus", **o.model_dump()} for o in t.buses.options]
    )

    transport_plan = {
        "intercity": {
            "all_options": all_options,
            "recommended_mode": t.recommended_mode,
            "estimated_cost_per_person": t.recommended_cost_per_person,
            "total_cost": t.recommended_total_cost,
            "booking_tips": t.savings_tips,
        },
        "local_transport": t.local_transport.model_dump(),
        "airport_transfer": t.airport_transfer.model_dump(),
        "total_transport_cost": t.total_transport_cost,
        "within_budget": t.within_budget,
        "savings_tips": t.savings_tips,
        "flights": t.flights.model_dump(),
        "trains": t.trains.model_dump(),
        "buses": t.buses.model_dump(),
        "recommended_operator": t.recommended_operator,
        "recommended_cost_per_person": t.recommended_cost_per_person,
        "recommended_total_cost": t.recommended_total_cost,
    }

    itin = master.itinerary
    itinerary = {
        "daily_budget_target": itin.daily_budget_target,
        "itinerary": [d.model_dump() for d in itin.days],
        "total_food_and_activities": itin.total_food_and_activities,
        "free_time_suggestions": itin.free_time_suggestions,
        "money_saving_hacks": itin.money_saving_hacks,
    }

    full_plan = master.model_dump()

    return {
        "destination": resolved_dest,
        "destination_research": (
            {"destinations": [o.model_dump() for o in master.destination_options],
             "recommended": master.recommended_destination}
            if master.destination_options else None
        ),
        "transport_plan": transport_plan,
        "accommodation_plan": master.accommodation.model_dump(),
        "itinerary": itinerary,
        "budget_summary": master.budget_summary.model_dump(),
        "master_plan": full_plan,
        "final_plan_ready": True,
        "raw_search_transport": real_time_data,
        "raw_search_accommodation": str(live.get("accommodation", "")),
        "raw_search_itinerary": str(live.get("activities_food", "")),
    }
