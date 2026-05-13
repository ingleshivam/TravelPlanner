import json
from schemas import AccommodationPlanOutput, BudgetTrackerOutput, DestinationResearchOutput, ItineraryOutput, TransportPlanOutput
from state import TravelPlanState
from agents import (
    supervisor_chain, researcher_chain, transport_chain,
    accommodation_chain, itinerary_chain, budget_chain,
)


def supervisor_node(state: TravelPlanState) -> TravelPlanState:
    context = {
        "budget": state["user_budget"],
        "origin": state["origin"],
        "destination": state.get("destination"),
        "num_days": state["num_days"],
        "num_travelers": state["num_travelers"],
        "travel_style": state["travel_style"],
        "interests": state["interests"],
        "completed": {
            "destination_research": bool(state.get("destination_research")),
            "transport_plan":       bool(state.get("transport_plan")),
            "accommodation_plan":   bool(state.get("accommodation_plan")),
            "itinerary":            bool(state.get("itinerary")),
            "budget_summary":       bool(state.get("budget_summary")),
        },
        "budget_overrun": state.get("budget_overrun", False),
        "overrun_amount": state.get("overrun_amount", 0),
    }
    print("Context :", context)
    response = supervisor_chain.invoke({
        "input": (
            f"Current state:\n{json.dumps(context, indent=2)}\n\n"
            "Which agent should run next? Reply with ONLY ONE of: "
            "destination_researcher | transport_agent | accommodation_agent | "
            "itinerary_agent | budget_tracker | FINISH"
        )
    })
    print("Response : ", response)
    return {**state, "next_agent": response.content.strip().lower()}


def destination_researcher_node(state: TravelPlanState) -> TravelPlanState:
    result: DestinationResearchOutput = researcher_chain.invoke({"input": json.dumps({
        "total_budget": state["user_budget"],
        "num_days": state["num_days"],
        "origin": state["origin"],
        "travel_style": state["travel_style"],
        "preferences": state["interests"],
        "num_travelers": state["num_travelers"],
    })})
    # result is a typed Pydantic object — access fields directly
    return {
        **state,
        "destination_research": result.model_dump(),
        "destination": result.recommended or state.get("destination"),
    }


def transport_agent_node(state: TravelPlanState) -> TravelPlanState:
    result: TransportPlanOutput = transport_chain.invoke({"input": json.dumps({
        "origin": state["origin"],
        "destination": state["destination"],
        "travel_dates": {"start": state["start_date"], "end": state["end_date"]},
        "num_travelers": state["num_travelers"],
        "budget_for_transport": state["user_budget"] * 0.40,
        "travel_style": state["travel_style"],
    })})
    return {**state, "transport_plan": result.model_dump()}


def accommodation_agent_node(state: TravelPlanState) -> TravelPlanState:
    result: AccommodationPlanOutput = accommodation_chain.invoke({"input": json.dumps({
        "destination": state["destination"],
        "num_days": state["num_days"],
        "num_travelers": state["num_travelers"],
        "budget_for_accommodation": state["user_budget"] * 0.35,
        "travel_style": state["travel_style"],
        "preferences": state["interests"],
    })})
    return {**state, "accommodation_plan": result.model_dump()}


def itinerary_agent_node(state: TravelPlanState) -> TravelPlanState:
    transport_cost     = state["transport_plan"]["total_transport_cost_usd"]
    accommodation_cost = state["accommodation_plan"]["total_accommodation_cost_usd"]
    remaining          = state["user_budget"] - transport_cost - accommodation_cost

    result: ItineraryOutput = itinerary_chain.invoke({"input": json.dumps({
        "destination": state["destination"],
        "num_days": state["num_days"],
        "remaining_budget_for_food_and_activities": remaining,
        "travel_style": state["travel_style"],
        "interests": state["interests"],
        "num_travelers": state["num_travelers"],
    })})
    return {**state, "itinerary": result.model_dump()}


def budget_tracker_node(state: TravelPlanState) -> TravelPlanState:
    t = state["transport_plan"]
    a = state["accommodation_plan"]
    i = state["itinerary"]

    result: BudgetTrackerOutput = budget_chain.invoke({"input": json.dumps({
        "total_budget_usd": state["user_budget"],
        "num_travelers": state["num_travelers"],
        "cost_breakdown": {
            "flights_and_transport": t["intercity"]["total_cost_usd"],
            "local_transport":       t["local_transport"]["total_local_transport_usd"],
            "airport_transfers":     t["airport_transfer"]["cost_usd"],
            "accommodation":         a["total_accommodation_cost_usd"],
            "food":                  i["total_food_and_activities_usd"] * 0.6,
            "activities":            i["total_food_and_activities_usd"] * 0.4,
            "misc_buffer":           state["user_budget"] * 0.10,
        },
    })})

    summary = result.budget_summary
    overrun = summary.status == "OVER_BUDGET"

    return {
        **state,
        "budget_summary":  result.model_dump(),
        "budget_overrun":  overrun,
        "overrun_amount":  max(0, -summary.remaining_buffer_usd),
        "reroute_count":   state.get("reroute_count", 0) + (1 if overrun else 0),
        "final_plan_ready": not overrun,
    }