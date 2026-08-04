from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, END
from state import TravelPlanState
from nodes import (
    collect_info_node,
    confirm_budget_node,
    live_data_research_node,
    route_after_collect_info,
)


def build_graph() -> StateGraph:
    graph = StateGraph(TravelPlanState)

    graph.add_node("collect_info", collect_info_node)
    graph.add_node("confirm_budget", confirm_budget_node)
    graph.add_node("live_data_research", live_data_research_node)

    graph.set_entry_point("collect_info")
    graph.add_conditional_edges(
        "collect_info",
        route_after_collect_info,
        {"collect_info": "collect_info", "confirm_budget": "confirm_budget"},
    )
    graph.add_edge("confirm_budget", "live_data_research")
    graph.add_edge("live_data_research", END)

    return graph.compile(checkpointer=MemorySaver())


travel_planner = build_graph()
