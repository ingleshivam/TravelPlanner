from langgraph.graph import StateGraph, END
from state import TravelPlanState
from nodes import live_data_research_node


def build_graph() -> StateGraph:
    graph = StateGraph(TravelPlanState)

    graph.add_node("live_data_research", live_data_research_node)

    graph.set_entry_point("live_data_research")
    graph.add_edge("live_data_research", END)

    return graph.compile()


travel_planner = build_graph()
