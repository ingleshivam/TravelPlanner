from datetime import date, timedelta

from langgraph.types import interrupt

from state import TravelPlanState
from search import search_live_trip_data

DEFAULT_BUDGET_ALLOCATION = {
    "transport": 35,
    "accommodation": 35,
    "food": 15,
    "activities": 10,
    "misc": 5,
}

# ── Info collection (human-in-the-loop) ─────────────────────────────────────

_REQUIRED_STATE_FIELDS = [
    "origin", "user_budget", "start_date", "num_days", "num_travelers", "travel_style",
]

_FIELD_LABELS = {
    "origin": "your starting city",
    "user_budget": "your total budget",
    "start_date": "your travel start date",
    "num_days": "how many days you're traveling",
    "num_travelers": "the number of travelers",
    "travel_style": "your travel style (budget-backpacker / mid-range / comfort-budget)",
}

# state field name -> chat_session param name (chat_session.extract_params returns the latter)
_STATE_TO_PARAM = {
    "user_budget": "budget",
    "currency": "currency",
    "currency_symbol": "currency_symbol",
    "origin": "origin",
    "destination": "destination",
    "start_date": "start_date",
    "num_days": "num_days",
    "num_travelers": "num_travelers",
    "travel_style": "travel_style",
    "interests": "interests",
}
_PARAM_TO_STATE = {v: k for k, v in _STATE_TO_PARAM.items()}


def _params_from_state(state: TravelPlanState) -> dict:
    return {
        param: state[field]
        for field, param in _STATE_TO_PARAM.items()
        if state.get(field) is not None
    }


def _missing_state_fields(state: TravelPlanState) -> list:
    missing = [f for f in _REQUIRED_STATE_FIELDS if not state.get(f)]
    if "start_date" not in missing and state.get("start_date"):
        try:
            if date.fromisoformat(state["start_date"]) < date.today():
                missing.append("start_date")
        except ValueError:
            missing.append("start_date")
    return missing


def _missing_prompt(missing: list) -> str:
    labels = [_FIELD_LABELS.get(f, f.replace("_", " ")) for f in missing]
    if len(labels) == 1:
        return f"Could you share {labels[0]}?"
    return "Could you share " + ", ".join(labels[:-1]) + f" and {labels[-1]}?"


def route_after_collect_info(state: TravelPlanState) -> str:
    return "collect_info" if _missing_state_fields(state) else "confirm_budget"


def collect_info_node(state: TravelPlanState) -> dict:
    """Asks for whatever's missing and interrupts; loops back via route_after_collect_info
    until all required trip params are present. No LLM call happens before interrupt(), so
    resuming this node never re-runs expensive work."""
    missing = _missing_state_fields(state)
    if not missing:
        return {}

    history = state.get("messages") or []
    question = _missing_prompt(missing)

    human_reply = interrupt({
        "type": "missing_fields_form",
        "missing_fields": missing,
        "collected": _params_from_state(state),
        "prompt": question,
    })

    history = history + [
        {"role": "assistant", "content": question},
        {"role": "user", "content": human_reply},
    ]

    import chat_session as cs
    extracted = cs.extract_params(history)
    update = {
        _PARAM_TO_STATE.get(k, k): v
        for k, v in extracted.items()
        if v is not None
    }
    update["messages"] = history
    return update


def confirm_budget_node(state: TravelPlanState) -> dict:
    """Shows the default budget split and interrupts once for the user to confirm/adjust it."""
    import chat_session as cs

    total = float(state["user_budget"])
    amounts = {k: round(total * v / 100, 2) for k, v in DEFAULT_BUDGET_ALLOCATION.items()}
    message = cs.budget_allocation_message(_params_from_state(state), DEFAULT_BUDGET_ALLOCATION, amounts)

    human_reply = interrupt({
        "type": "budget_allocation_form",
        "total_budget": total,
        "currency": state.get("currency", ""),
        "currency_symbol": state.get("currency_symbol", ""),
        "default_allocation": DEFAULT_BUDGET_ALLOCATION,
        "allocation_amounts": amounts,
        "prompt": message,
    })

    history = (state.get("messages") or []) + [
        {"role": "assistant", "content": message},
        {"role": "user", "content": human_reply},
    ]
    budget_allocation = cs.extract_budget_allocation(history, DEFAULT_BUDGET_ALLOCATION)

    end_date = (
        date.fromisoformat(state["start_date"]) + timedelta(days=int(state["num_days"]))
    ).isoformat()

    return {
        "messages": history,
        "budget_allocation": budget_allocation,
        "end_date": end_date,
    }


# ── Planning ─────────────────────────────────────────────────────────────────

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
        interests=state.get("interests") or [],
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
