from langgraph.graph import StateGraph, END
from state import TravelPlanState
from nodes import (
    supervisor_node,
    destination_researcher_node,
    transport_agent_node,
    accommodation_agent_node,
    itinerary_agent_node,
    budget_tracker_node,
)

# ── Router ────────────────────────────────────────────────────────────────────
def route_from_supervisor(state: TravelPlanState) -> str:
    return state["next_agent"]


def route_from_budget_tracker(state: TravelPlanState) -> str:
    """Loop back to supervisor if over budget (max 2 re-routes to avoid infinite loops)."""
    if state["budget_overrun"] and state.get("reroute_count", 0) < 2:
        return "supervisor"
    return END


# ── Build graph ───────────────────────────────────────────────────────────────
def build_graph() -> StateGraph:
    graph = StateGraph(TravelPlanState)

    # Register nodes
    graph.add_node("supervisor",             supervisor_node)
    graph.add_node("destination_researcher", destination_researcher_node)
    graph.add_node("transport_agent",        transport_agent_node)
    graph.add_node("accommodation_agent",    accommodation_agent_node)
    graph.add_node("itinerary_agent",        itinerary_agent_node)
    graph.add_node("budget_tracker",         budget_tracker_node)

    # Entry point
    graph.set_entry_point("supervisor")

    # Supervisor routes to any agent (or FINISH)
    graph.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        {
            "destination_researcher": "destination_researcher",
            "transport_agent":        "transport_agent",
            "accommodation_agent":    "accommodation_agent",
            "itinerary_agent":        "itinerary_agent",
            "budget_tracker":         "budget_tracker",
            "finish":                 END,
        }
    )

    # All agents report back to supervisor after completing
    for agent in [
        "destination_researcher",
        "transport_agent",
        "accommodation_agent",
        "itinerary_agent",
    ]:
        graph.add_edge(agent, "supervisor")

    # Budget tracker either finishes or loops back
    graph.add_conditional_edges(
        "budget_tracker",
        route_from_budget_tracker,
        {
            "supervisor": "supervisor",
            END: END,
        }
    )

    return graph.compile()


travel_planner = build_graph()