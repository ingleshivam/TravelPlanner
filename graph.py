from langgraph.graph import StateGraph, END
from state import TravelPlanState
from nodes import (
    supervisor_node,
    live_data_research_node,
    trip_planner_node,
    budget_tracker_node,
)

def route_from_supervisor(state: TravelPlanState) -> str:
    if not state.get("live_trip_data"):
        return "live_data_research"
    if not state.get("transport_plan"):
        return "trip_planner"
    if not state.get("budget_summary"):
        return "budget_tracker"

    return "finish"



def build_graph() -> StateGraph:
    graph = StateGraph(TravelPlanState)

    graph.add_node("supervisor",           supervisor_node)
    graph.add_node("live_data_research",   live_data_research_node)
    graph.add_node("trip_planner",         trip_planner_node)
    graph.add_node("budget_tracker",       budget_tracker_node)

    graph.set_entry_point("supervisor")

    graph.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        {
            "live_data_research": "live_data_research",
            "trip_planner":       "trip_planner",
            "budget_tracker":     "budget_tracker",
            "finish":             END,
        }
    )

    for agent in [
        "live_data_research",
        "trip_planner",
    ]:
        graph.add_edge(agent, "supervisor")

    graph.add_edge("budget_tracker", END)

    return graph.compile()


travel_planner = build_graph()
