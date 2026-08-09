from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, END
from state import TravelPlanState
from nodes import (
    collect_info_node,
    confirm_budget_node,
    live_data_research_node,
    plan_chat_node,
    route_after_collect_info,
)


def _entry_router(state: TravelPlanState) -> str:
    """Threads that already have a finished plan skip straight to plan_chat
    instead of re-running collect_info/confirm_budget (which would otherwise
    re-interrupt asking to reconfirm the budget on every follow-up message)."""
    return "plan_chat" if state.get("master_plan") else "collect_info"


def build_graph() -> StateGraph:
    graph = StateGraph(TravelPlanState)

    graph.add_node("collect_info", collect_info_node)
    graph.add_node("confirm_budget", confirm_budget_node)
    graph.add_node("live_data_research", live_data_research_node)
    graph.add_node("plan_chat", plan_chat_node)

    graph.set_conditional_entry_point(
        _entry_router,
        {"collect_info": "collect_info", "plan_chat": "plan_chat"},
    )
    graph.add_conditional_edges(
        "collect_info",
        route_after_collect_info,
        {"collect_info": "collect_info", "confirm_budget": "confirm_budget"},
    )
    graph.add_edge("confirm_budget", "live_data_research")
    graph.add_edge("live_data_research", "plan_chat")
    graph.add_edge("plan_chat", END)

    return graph.compile(checkpointer=MemorySaver())


travel_planner = build_graph()
