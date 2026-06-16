import json
from schemas import AccommodationPlanOutput, BudgetTrackerOutput, DestinationResearchOutput, ItineraryOutput, TransportPlanOutput
from state import TravelPlanState
from agents import (
    researcher_chain, transport_chain,
    accommodation_chain, itinerary_chain, budget_chain,
    invoke_with_retry,
)
from search import search_live_trip_data

DEFAULT_BUDGET_ALLOCATION = {
    "transport": 40,
    "accommodation": 35,
    "food": 15,
    "activities": 5,
    "misc": 5,
}


def _allocation_ratio(state: TravelPlanState, category: str) -> float:
    allocation = state.get("budget_allocation") or DEFAULT_BUDGET_ALLOCATION
    value = allocation.get(category, DEFAULT_BUDGET_ALLOCATION[category])
    return value / 100 if value > 1 else value


def _allocation_amount(state: TravelPlanState, category: str) -> float:
    return state["user_budget"] * _allocation_ratio(state, category)


def _validate_budget_allocation(state: TravelPlanState) -> None:
    total = sum(
        _allocation_ratio(state, category)
        for category in DEFAULT_BUDGET_ALLOCATION
    )
    if total > 1.0:
        raise ValueError(
            f"Budget allocation total is {total * 100:.1f}%. "
            "Please keep transport + accommodation + food + activities + misc at or below 100%."
        )


def supervisor_node(state: TravelPlanState) -> dict:
    return {"step_count": state.get("step_count", 0) + 1}


_ZERO_TRANSPORT_PLAN = {
    "intercity": {
        "all_options": [],
        "recommended_mode": "Not budgeted",
        "estimated_cost_per_person": 0,
        "total_cost": 0,
        "booking_tips": "No transport budget allocated.",
    },
    "local_transport": {"daily_cost_per_person": 0, "total_local_transport": 0, "recommended_options": []},
    "airport_transfer": {"cost": 0, "recommended_mode": "N/A"},
    "total_transport_cost": 0,
    "within_budget": True,
    "savings_tips": "",
    "available_options": {"flights": [], "buses": [], "trains": []},
}


def live_data_research_node(state: TravelPlanState) -> dict:
    """Single SerpAPI `google_ai_mode` call that replaces the old per-category
    destination/transport/accommodation/itinerary searches (~8 separate Tavily/
    Firecrawl calls). Runs once per plan so usage stays within the free-tier
    SerpAPI quota. Also the first real node in the graph, so budget allocation
    is validated here before that call is made."""
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
        currency=state["currency"],
    )
    update = {"live_trip_data": live_data}
    dest_research = live_data.get("destination_research")
    if not state.get("destination") and dest_research and dest_research.get("recommended"):
        update["destination"] = dest_research["recommended"]
    return update


def trip_planner_node(state: TravelPlanState) -> dict:
    """Replaces destination_researcher_node + transport_agent_node +
    accommodation_agent_node + itinerary_agent_node. Structures the single
    live_trip_data blob (already fetched by live_data_research_node) into the
    same plan outputs, reusing the existing per-category LLM chains — no
    additional SerpAPI calls happen here."""
    live = state.get("live_trip_data") or {}
    result: dict = {}

    # Destination research — only needed when the destination wasn't already known.
    dest_research = live.get("destination_research")
    if not state.get("destination_research") and dest_research:
        dr_result: DestinationResearchOutput = invoke_with_retry(researcher_chain, {"input": json.dumps({
            "total_budget": state["user_budget"],
            "num_days": state["num_days"],
            "origin": state["origin"],
            "travel_style": state["travel_style"],
            "preferences": state["interests"],
            "num_travelers": state["num_travelers"],
            "currency": state["currency"],
            "currency_symbol": state["currency_symbol"],
            "real_time_search_data": json.dumps(dest_research),
        })})
        result["destination_research"] = dr_result.model_dump()
        result["destination"] = dr_result.recommended or state.get("destination")
        result["raw_search_destination"] = json.dumps(dest_research)

    destination = result.get("destination") or state.get("destination")

    # Transport
    if _allocation_amount(state, "transport") == 0:
        result["transport_plan"] = _ZERO_TRANSPORT_PLAN
    else:
        _MAX = 1200
        available_options = {
            "flights": live.get("flights", []),
            "trains":  live.get("trains", []),
            "buses":   live.get("buses", []),
        }

        # Compute cheapest mode in Python so the LLM cannot get it wrong
        mode_min_fares = {}
        for f in available_options["flights"]:
            fare = f.get("flight_fare") or 0
            if fare > 0:
                mode_min_fares["flight"] = min(mode_min_fares.get("flight", fare), fare)
        for t in available_options["trains"]:
            fare = t.get("train_fare") or 0
            if fare > 0:
                mode_min_fares["train"] = min(mode_min_fares.get("train", fare), fare)
        for b in available_options["buses"]:
            fare = b.get("bus_fare") or 0
            if fare > 0:
                mode_min_fares["bus"] = min(mode_min_fares.get("bus", fare), fare)
        cheapest_mode = min(mode_min_fares, key=mode_min_fares.get) if mode_min_fares else None
        print(f"\n\nMode min fares: {mode_min_fares} → cheapest: {cheapest_mode}")

        # Put trains and buses first so truncation doesn't hide them
        ordered = {"trains": available_options["trains"], "buses": available_options["buses"], "flights": available_options["flights"]}
        live_transport_data = json.dumps(ordered)[:_MAX]

        transport_input = {
            "origin": state["origin"],
            "destination": destination,
            "travel_dates": {"start": state["start_date"], "end": state["end_date"]},
            "num_travelers": state["num_travelers"],
            "budget_for_transport": _allocation_amount(state, "transport"),
            "travel_style": state["travel_style"],
            "currency": state["currency"],
            "currency_symbol": state["currency_symbol"],
            "cheapest_mode": cheapest_mode,
            "real_time_search_data": live_transport_data,
        }
        transport_result: TransportPlanOutput = invoke_with_retry(transport_chain, {"input": json.dumps(transport_input)})
        plan = transport_result.model_dump()
        plan["available_options"] = available_options
        result["transport_plan"] = plan
        result["raw_search_transport"] = live_transport_data

    # Accommodation
    accommodation_live_data = live.get("accommodation", "")
    accommodation_input = {
        "destination": destination,
        "num_days": state["num_days"],
        "num_travelers": state["num_travelers"],
        "budget_for_accommodation": _allocation_amount(state, "accommodation"),
        "travel_style": state["travel_style"],
        "preferences": state["interests"],
        "currency": state["currency"],
        "currency_symbol": state["currency_symbol"],
        "real_time_search_data": accommodation_live_data,
    }
    acc_result: AccommodationPlanOutput = invoke_with_retry(accommodation_chain, {"input": json.dumps(accommodation_input)})
    result["accommodation_plan"] = acc_result.model_dump()
    result["raw_search_accommodation"] = accommodation_live_data

    # Itinerary
    food_and_activities_budget = (
        _allocation_amount(state, "food") + _allocation_amount(state, "activities")
    )
    itinerary_live_data = live.get("activities_food", "")
    itinerary_input = {
        "destination": destination,
        "num_days": state["num_days"],
        "remaining_budget_for_food_and_activities": food_and_activities_budget,
        "travel_style": state["travel_style"],
        "interests": state["interests"],
        "num_travelers": state["num_travelers"],
        "currency": state["currency"],
        "currency_symbol": state["currency_symbol"],
        "real_time_search_data": itinerary_live_data,
    }
    itin_result: ItineraryOutput = invoke_with_retry(itinerary_chain, {"input": json.dumps(itinerary_input)})
    result["itinerary"] = itin_result.model_dump()
    result["raw_search_itinerary"] = itinerary_live_data

    return result


def budget_tracker_node(state: TravelPlanState) -> dict:
    t = state["transport_plan"]
    a = state["accommodation_plan"]
    i = state["itinerary"]
    food_ratio = _allocation_ratio(state, "food")
    activities_ratio = _allocation_ratio(state, "activities")
    food_activity_total = food_ratio + activities_ratio
    food_share = food_ratio / food_activity_total if food_activity_total else 0.6

    result: BudgetTrackerOutput = invoke_with_retry(budget_chain, {"input": json.dumps({
        "total_budget": state["user_budget"],
        "num_travelers": state["num_travelers"],
        "currency": state["currency"],
        "currency_symbol": state["currency_symbol"],
        "cost_breakdown": {
            "flights_and_transport": t["intercity"]["total_cost"],
            "local_transport":       t["local_transport"]["total_local_transport"],
            "airport_transfers":     t["airport_transfer"]["cost"],
            "accommodation":         a["total_accommodation_cost"],
            "food":                  i["total_food_and_activities"] * food_share,
            "activities":            i["total_food_and_activities"] * (1 - food_share),
            "misc_buffer":           _allocation_amount(state, "misc"),
        },
    })})

    summary = result.budget_summary
    overrun = summary.status == "OVER_BUDGET"

    return {
        "budget_summary":   result.model_dump(),
        "budget_overrun":   overrun,
        "overrun_amount":   max(0, -summary.remaining_buffer),
        "reroute_count":    state.get("reroute_count", 0) + (1 if overrun else 0),
        "final_plan_ready": not overrun,
    }
