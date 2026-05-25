import json
from schemas import AccommodationPlanOutput, BudgetTrackerOutput, DestinationResearchOutput, ItineraryOutput, TransportPlanOutput
from state import TravelPlanState
from pydantic import AliasChoices, BaseModel, Field
from agents import (
    _structured_chain, researcher_chain, transport_chain,
    accommodation_chain, itinerary_chain, budget_chain,
)
from utils import infer_currency, parse_transport_options
from search import search_destination_info, search_transport_prices, search_accommodation_prices

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

    class CurrencyStructure(BaseModel):
        model_config = {"populate_by_name": True}
        code: str = Field(validation_alias=AliasChoices("code", "currency_code", "currency"))
        symbol: str = Field(validation_alias=AliasChoices("symbol", "currency_symbol"))

    try:
        chain = _structured_chain(
            system_prompt=(
                "Return the ISO 4217 currency code and symbol for the given city or country. "
                "Examples: India/Pune/Mumbai → INR/₹, USA/New York → USD/$, UK/London → GBP/£, Europe/Paris → EUR/€. "
                "Respond with JSON only."
            ),
            schema=CurrencyStructure,
        )
        result: CurrencyStructure = chain.invoke({"input": f"City or country: {location}"})
        print("Currency Result : ", result)
        return {"currency": result.code, "currency_symbol": result.symbol}
    except Exception as e:
        print("Exception occur in currency function : ", str(e))
        code, symbol = infer_currency(location)
        return {"currency": code, "currency_symbol": symbol}


def supervisor_node(state: TravelPlanState) -> dict:
    return {"step_count": state.get("step_count", 0) + 1}


def destination_researcher_node(state: TravelPlanState) -> dict:
    dest_hint = state.get("destination") or "Asia budget destinations"
    live_data = search_destination_info(dest_hint, state["origin"], state["num_days"])

    result: DestinationResearchOutput = researcher_chain.invoke({"input": json.dumps({
        "total_budget": state["user_budget"],
        "num_days": state["num_days"],
        "origin": state["origin"],
        "travel_style": state["travel_style"],
        "preferences": state["interests"],
        "num_travelers": state["num_travelers"],
        "currency": state["currency"],
        "currency_symbol": state["currency_symbol"],
        "real_time_search_data": live_data,
    })})
    return {
        "destination_research": result.model_dump(),
        "destination": result.recommended or state.get("destination"),
    }


_ZERO_TRANSPORT_PLAN = {
    "intercity": {
        "mode": "Not budgeted", "estimated_cost_per_person": 0,
        "total_cost": 0, "booking_tips": "No transport budget allocated.",
        "budget_airlines_or_options": [],
    },
    "local_transport": {"daily_cost_per_person": 0, "total_local_transport": 0, "recommended_options": []},
    "airport_transfer": {"cost": 0, "recommended_mode": "N/A"},
    "total_transport_cost": 0,
    "within_budget": True,
    "savings_tips": "",
    "available_options": {"flights": [], "buses": [], "trains": []},
}


def transport_agent_node(state: TravelPlanState) -> dict:
    if _allocation_amount(state, "transport") == 0:
        return {"transport_plan": _ZERO_TRANSPORT_PLAN}

    transport_data = search_transport_prices(
        state["origin"], state["destination"], state["start_date"]
    )
    live_data = transport_data["text"]
    llm_flights = transport_data.get("flights", [])

    print("Live Data : ", live_data)

    input_data = {
        "origin": state["origin"],
        "destination": state["destination"],
        "travel_dates": {"start": state["start_date"], "end": state["end_date"]},
        "num_travelers": state["num_travelers"],
        "budget_for_transport": _allocation_amount(state, "transport"),
        "travel_style": state["travel_style"],
        "currency": state["currency"],
        "currency_symbol": state["currency_symbol"],
        "real_time_search_data": live_data,
    }
    print("INPUT DATA : ", input_data)
    result: TransportPlanOutput = transport_chain.invoke({"input": json.dumps(input_data)})
    print("TRANSPORT AGENT DATA : ", result)
    plan = result.model_dump()
    available = parse_transport_options(live_data)
    if llm_flights:
        available["flights"] = llm_flights
    plan["available_options"] = available
    return {"transport_plan": plan}


def accommodation_agent_node(state: TravelPlanState) -> dict:
    live_data = search_accommodation_prices(
        state["destination"], state["start_date"], state["end_date"], state["num_travelers"],
    )

    input_data = {
        "destination": state["destination"],
        "num_days": state["num_days"],
        "num_travelers": state["num_travelers"],
        "budget_for_accommodation": _allocation_amount(state, "accommodation"),
        "travel_style": state["travel_style"],
        "preferences": state["interests"],
        "currency": state["currency"],
        "currency_symbol": state["currency_symbol"],
        "real_time_search_data": live_data,
    }


    result: AccommodationPlanOutput = accommodation_chain.invoke({"input": json.dumps(input_data)})
    print("Accommodation chain result:", result)
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
