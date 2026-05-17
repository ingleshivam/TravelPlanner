from langgraph.graph import StateGraph, END
from state import TravelPlanState
from nodes import (
    currency_inference_node,
    supervisor_node,
    destination_researcher_node,
    transport_agent_node,
    accommodation_agent_node,
    itinerary_agent_node,
    budget_tracker_node,
)

# ── Router ────────────────────────────────────────────────────────────────────
def route_from_supervisor(state: TravelPlanState) -> str:
    if state.get("step_count", 0) > 8:
        return "finish"

    destination_known = bool(state.get("destination"))

    if not destination_known and not state.get("destination_research"):
        return "destination_researcher"
    if not state.get("transport_plan"):
        return "transport_agent"
    if not state.get("accommodation_plan"):
        return "accommodation_agent"
    if not state.get("itinerary"):
        return "itinerary_agent"
    if not state.get("budget_summary"):
        return "budget_tracker"

    return "finish"


def route_from_budget_tracker(state: TravelPlanState) -> str:
    """Loop back to supervisor if over budget (max 2 re-routes to avoid infinite loops)."""
    if state["budget_overrun"] and state.get("reroute_count", 0) < 2:
        return "supervisor"
    return END


# ── Build graph ───────────────────────────────────────────────────────────────
def build_graph() -> StateGraph:
    graph = StateGraph(TravelPlanState)

    # Register nodes
    graph.add_node("currency_inference",     currency_inference_node)
    graph.add_node("supervisor",             supervisor_node)
    graph.add_node("destination_researcher", destination_researcher_node)
    graph.add_node("transport_agent",        transport_agent_node)
    graph.add_node("accommodation_agent",    accommodation_agent_node)
    graph.add_node("itinerary_agent",        itinerary_agent_node)
    graph.add_node("budget_tracker",         budget_tracker_node)

    # Entry point — infer currency first, then hand off to supervisor
    graph.set_entry_point("currency_inference")
    graph.add_edge("currency_inference", "supervisor")

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