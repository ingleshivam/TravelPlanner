import json
from datetime import date, timedelta
from typing import Dict, List, Optional

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

_REQUIRED = ["origin", "budget", "currency", "currency_symbol", "start_date", "num_days", "num_travelers", "travel_style"]
_sessions: Dict[str, dict] = {}

DEFAULT_ALLOCATION = {
    "transport": 35,
    "accommodation": 35,
    "food": 15,
    "activities": 10,
    "misc": 5,
}

_ALLOCATION_LABELS = {
    "transport": "Transport (flights / trains / buses)",
    "accommodation": "Accommodation",
    "food": "Food & dining",
    "activities": "Activities & sightseeing",
    "misc": "Miscellaneous buffer",
}


class _ExtractedParams(BaseModel):
    budget: Optional[float] = None
    currency: Optional[str] = None
    currency_symbol: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[str] = None
    num_days: Optional[int] = None
    num_travelers: Optional[int] = None
    travel_style: Optional[str] = None
    interests: Optional[List[str]] = None


class _BudgetAllocation(BaseModel):
    transport: int = DEFAULT_ALLOCATION["transport"]
    accommodation: int = DEFAULT_ALLOCATION["accommodation"]
    food: int = DEFAULT_ALLOCATION["food"]
    activities: int = DEFAULT_ALLOCATION["activities"]
    misc: int = DEFAULT_ALLOCATION["misc"]


def _today() -> str:
    return date.today().isoformat()


def _extract_prompt() -> str:
    return (
        f"Today is {_today()}. Extract travel parameters from the ENTIRE conversation into JSON.\n"
        "- Convert relative dates (next Saturday, this weekend, June 10) to YYYY-MM-DD.\n"
        "- If the user corrects a value later in the conversation, use the latest value.\n"
        "- Set start_date to null if the date is in the past (before today).\n"
        "- Map styles: budget/backpacker→budget-backpacker, mid/moderate→mid-range, comfort/luxury→comfort-budget.\n"
        "- currency must be an ISO 4217 code (e.g. INR, USD, EUR) and currency_symbol its symbol (e.g. ₹, $, €), "
        "exactly as stated by the user. Do not guess one from the other or from the origin/destination.\n"
        "- Extract ALL values mentioned anywhere in the conversation, not just the latest message.\n"
        'Schema: {"budget": null, "currency": null, "currency_symbol": null, "origin": null, "destination": null, '
        '"start_date": null, "num_days": null, "num_travelers": null, "travel_style": null, "interests": null}'
    )


def _followup_prompt() -> str:
    return (
        f"Today is {_today()}. You are a friendly AI travel planning assistant. "
        "Ask the user for the missing information listed below. "
        "Be brief (1-2 sentences). Ask for all missing items in one go."
    )


def _budget_alloc_prompt(default: dict) -> str:
    return (
        "The user was shown a default budget allocation and asked if they want to change it. "
        f"Default: {json.dumps(default)}. "
        "If the user confirms (yes, ok, looks good, proceed, sure, etc.) return the default values. "
        "If they request changes, adjust only the mentioned categories and redistribute the remaining "
        "percentage so all five values still sum to 100. "
        'Return JSON: {"transport": int, "accommodation": int, "food": int, "activities": int, "misc": int}'
    )


def _history_text(history: list) -> str:
    return "\n".join(f"{m['role'].upper()}: {m['content']}" for m in history[-10:])



# ── Public API ─────────────────────────────────────────────────────────────────

def get_or_create(session_id: str) -> dict:
    if session_id not in _sessions:
        _sessions[session_id] = {
            "stage": "info_collection",
            "history": [],
            "params": {},
            "budget_allocation": None,
        }
    return _sessions[session_id]


def clear(session_id: str) -> None:
    _sessions.pop(session_id, None)


def extract_params(history: list) -> dict:
    from agents import llm
    prompt = ChatPromptTemplate.from_messages([
        ("system", _extract_prompt()),
        ("human", "{conv}"),
    ])
    chain = prompt | llm.with_structured_output(_ExtractedParams, method="json_mode")
    try:
        result = chain.invoke({"conv": _history_text(history)})
        return {k: v for k, v in result.model_dump().items() if v is not None}
    except Exception as e:
        print(f"[chat_session] extract_params failed: {e}")
        return {}


def missing_fields(params: dict) -> list:
    missing = [f for f in _REQUIRED if not params.get(f)]
    if "start_date" not in missing and params.get("start_date"):
        try:
            if date.fromisoformat(params["start_date"]) < date.today():
                missing.append("start_date")
        except ValueError:
            missing.append("start_date")
    return missing


def follow_up_question(history: list, missing: list) -> str:
    from agents import llm
    prompt = ChatPromptTemplate.from_messages([
        ("system", _followup_prompt()),
        ("human", "Conversation:\n{conv}\n\nMissing info needed: {missing}"),
    ])
    chain = prompt | llm
    try:
        return chain.invoke({
            "conv": _history_text(history),
            "missing": ", ".join(f.replace("_", " ") for f in missing),
        }).content
    except Exception:
        return f"Could you share your {missing[0].replace('_', ' ')}?"


def budget_allocation_message(params: dict, alloc: dict, amounts: dict) -> str:
    sym = params.get("currency_symbol", "")
    total = float(params["budget"])
    lines = [
        f"I have everything I need! Here's the default budget split for your "
        f"{sym}{total:,.0f} {params.get('currency', '')} trip:",
        "",
    ]
    for k, pct in alloc.items():
        lines.append(f"• {_ALLOCATION_LABELS.get(k, k.title())}: {pct}%  ({sym}{amounts[k]:,.0f})")
    lines += ["", "Proceed with this allocation, or tell me what you'd like to adjust."]
    return "\n".join(lines)


def extract_budget_allocation(history: list, default_alloc: dict) -> dict:
    from agents import llm
    prompt = ChatPromptTemplate.from_messages([
        ("system", _budget_alloc_prompt(default_alloc)),
        ("human", "{conv}"),
    ])
    chain = prompt | llm.with_structured_output(_BudgetAllocation, method="json_mode")
    try:
        result = chain.invoke({"conv": _history_text(history)})
        return result.model_dump()
    except Exception as e:
        print(f"[chat_session] extract_budget_allocation failed: {e}")
        return default_alloc.copy()


def process_travel_plan(params: dict, budget_allocation: dict) -> dict:
    """Invokes the LangGraph pipeline: SerpAPI → save txt → master LLM → plan."""
    from graph import travel_planner

    start = date.fromisoformat(params["start_date"])
    end_date = (start + timedelta(days=int(params["num_days"]))).isoformat()

    initial_state = {
        "user_budget": float(params["budget"]),
        "currency": params["currency"],
        "currency_symbol": params.get("currency_symbol", ""),
        "origin": params["origin"],
        "destination": params.get("destination"),
        "start_date": params["start_date"],
        "end_date": end_date,
        "num_days": int(params["num_days"]),
        "num_travelers": int(params["num_travelers"]),
        "travel_style": params["travel_style"],
        "interests": params.get("interests") or [],
        "budget_allocation": budget_allocation,
        "live_trip_data": None,
        "destination_research": None,
        "transport_plan": None,
        "accommodation_plan": None,
        "itinerary": None,
        "budget_summary": None,
        "master_plan": None,
        "raw_search_destination": None,
        "raw_search_transport": None,
        "raw_search_accommodation": None,
        "raw_search_itinerary": None,
        "budget_overrun": False,
        "overrun_amount": 0.0,
        "budget_constraint_message": None,
        "reroute_count": 0,
        "step_count": 0,
        "messages": [],
        "final_plan_ready": False,
    }

    result = travel_planner.invoke(initial_state)
    return result.get("master_plan") or {}
