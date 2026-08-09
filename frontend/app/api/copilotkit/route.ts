import { NextRequest } from "next/server";
import { HttpAgent } from "@ag-ui/client";
import {
  CopilotRuntime,
  EmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";

const BACKEND_URL = process.env.TRAVEL_PLANNER_BACKEND_URL || "http://localhost:8000";

const runtime = new CopilotRuntime({
  agents: {
    travel_planner: new HttpAgent({ url: `${BACKEND_URL}/copilotkit` }),
  },
});

export async function POST(req: NextRequest) {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new EmptyAdapter(),
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
}
