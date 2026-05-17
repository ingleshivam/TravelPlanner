import json
from schemas import AccommodationPlanOutput, BudgetTrackerOutput, DestinationResearchOutput, ItineraryOutput, TransportPlanOutput
from state import TravelPlanState
from agents import (
    researcher_chain, transport_chain,
    accommodation_chain, itinerary_chain, budget_chain,
)
from utils import infer_currency


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


def currency_inference_node(state: TravelPlanState) -> dict:
    _validate_budget_allocation(state)
    location = state.get("destination") or state["origin"]
    code, symbol = infer_currency(location)
    return {"currency": code, "currency_symbol": symbol}


def supervisor_node(state: TravelPlanState) -> dict:
    updates: dict = {"step_count": state.get("step_count", 0) + 1}

    if state.get("budget_overrun") and state.get("reroute_count", 0) < 2:
        sym = state.get("currency_symbol", "")
        cur = state.get("currency", "")
        overrun = state.get("overrun_amount", 0)
        updates["budget_constraint_message"] = (
            f"BUDGET OVERRUN: trip is {sym}{overrun:,.0f} {cur} over the user's limit. "
            "You MUST find significantly cheaper alternatives. Prioritise the absolute "
            "cheapest options — hostels, buses, free activities."
        )
        # Clear plans so route_from_supervisor re-dispatches the agents
        updates["transport_plan"] = None
        updates["accommodation_plan"] = None
        updates["itinerary"] = None
        updates["budget_summary"] = None
        updates["budget_overrun"] = False

    return updates


def destination_researcher_node(state: TravelPlanState) -> dict:
    result: DestinationResearchOutput = researcher_chain.invoke({"input": json.dumps({
        "total_budget": state["user_budget"],
        "num_days": state["num_days"],
        "origin": state["origin"],
        "travel_style": state["travel_style"],
        "preferences": state["interests"],
        "num_travelers": state["num_travelers"],
        "currency": state["currency"],
        "currency_symbol": state["currency_symbol"],
    })})
    return {
        "destination_research": result.model_dump(),
        "destination": result.recommended or state.get("destination"),
    }


def transport_agent_node(state: TravelPlanState) -> dict:
    input_data = {
        "origin": state["origin"],
        "destination": state["destination"],
        "travel_dates": {"start": state["start_date"], "end": state["end_date"]},
        "num_travelers": state["num_travelers"],
        "budget_for_transport": _allocation_amount(state, "transport"),
        "travel_style": state["travel_style"],
        "currency": state["currency"],
        "currency_symbol": state["currency_symbol"],
    }
    if state.get("budget_constraint_message"):
        input_data["constraint"] = state["budget_constraint_message"]

    result: TransportPlanOutput = transport_chain.invoke({"input": json.dumps(input_data)})
    return {"transport_plan": result.model_dump()}


def accommodation_agent_node(state: TravelPlanState) -> dict:
    input_data = {
        "destination": state["destination"],
        "num_days": state["num_days"],
        "num_travelers": state["num_travelers"],
        "budget_for_accommodation": _allocation_amount(state, "accommodation"),
        "travel_style": state["travel_style"],
        "preferences": state["interests"],
        "currency": state["currency"],
        "currency_symbol": state["currency_symbol"],
    }
    if state.get("budget_constraint_message"):
        input_data["constraint"] = state["budget_constraint_message"]

    result: AccommodationPlanOutput = accommodation_chain.invoke({"input": json.dumps(input_data)})
    return {"accommodation_plan": result.model_dump()}


def itinerary_agent_node(state: TravelPlanState) -> dict:
    food_and_activities_budget = (
        _allocation_amount(state, "food") + _allocation_amount(state, "activities")
    )
    result: ItineraryOutput = itinerary_chain.invoke({"input": json.dumps({
        "destination": state["destination"],
        "num_days": state["num_days"],
        "remaining_budget_for_food_and_activities": food_and_activities_budget,
        "travel_style": state["travel_style"],
        "interests": state["interests"],
        "num_travelers": state["num_travelers"],
        "currency": state["currency"],
        "currency_symbol": state["currency_symbol"],
    })})
    return {"itinerary": result.model_dump()}


def budget_tracker_node(state: TravelPlanState) -> dict:
    t = state["transport_plan"]
    a = state["accommodation_plan"]
    i = state["itinerary"]
    food_ratio = _allocation_ratio(state, "food")
    activities_ratio = _allocation_ratio(state, "activities")
    food_activity_total = food_ratio + activities_ratio
    food_share = food_ratio / food_activity_total if food_activity_total else 0.6

    result: BudgetTrackerOutput = budget_chain.invoke({"input": json.dumps({
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
