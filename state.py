from typing import TypedDict, Optional, List, Literal, Dict, Annotated

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages

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
    live_trip_data: Optional[dict]
    destination_research: Optional[dict]
    transport_plan: Optional[dict]
    accommodation_plan: Optional[dict]
    itinerary: Optional[dict]
    budget_summary: Optional[dict]
    master_plan: Optional[dict]

    # ── Raw Tavily search results (per agent) ────────────
    raw_search_destination: Optional[str]
    raw_search_transport: Optional[str]
    raw_search_accommodation: Optional[str]
    raw_search_itinerary: Optional[str]

    # ── Control flow ─────────────────────────────────────
    budget_overrun: bool
    overrun_amount: float
    budget_constraint_message: Optional[str]
    reroute_count: int
    step_count: int
    # Internal scratch history used by collect_info/confirm_budget to build LLM
    # context. Distinct from the AG-UI-managed "messages" channel (which the
    # CopilotKit LangGraph adapter owns and stores as LangChain BaseMessage
    # objects) so the two never collide in type or ownership.
    conversation_log: List[dict]
    final_plan_ready: bool

    # ── AG-UI / CopilotKit managed channels ───────────────
    # Populated by the ag_ui_langgraph adapter: real chat transcript (LangChain
    # message objects) and forwarded frontend action schemas, respectively.
    # Only used by plan_chat_node, once the plan is ready.
    messages: Annotated[List[AnyMessage], add_messages]
    copilotkit: dict
