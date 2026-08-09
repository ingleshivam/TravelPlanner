"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Armchair,
  BedDouble,
  Bus,
  Calendar,
  CheckCircle,
  Clock,
  Hotel,
  Lightbulb,
  MapPin,
  MapPinned,
  Moon,
  PiggyBank,
  Plane,
  PlaneTakeoff,
  Plus,
  Repeat,
  Route,
  SendHorizonal,
  Sparkles,
  Sun,
  Sunrise,
  Train,
  Utensils,
  Users,
  Wallet,
} from "lucide-react";
import {
  ThreadsProvider,
  useCoAgent,
  useCopilotAction,
  useLangGraphInterrupt,
} from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import TripMap from "@/components/trip-map";

type TripOverview = {
  origin: string;
  destination: string;
  country: string;
  travel_dates: { start: string; end: string; num_days: number };
  num_travelers: number;
  travel_style: string;
  total_budget: number;
  currency: string;
  currency_symbol: string;
};

type TransportOption = {
  rank: number;
  estimated_cost_per_person: number;
  total_cost: number;
  booking_platform?: string;
  booking_tips?: string;
  departure_time?: string;
  arrival_time?: string;
  duration?: string;
  airline?: string;
  flight_number?: string;
  stops?: string;
  train_name?: string;
  train_number?: string;
  operator?: string;
  class?: string;
  bus_type?: string;
};

type TransportMode = {
  options: TransportOption[];
  recommended_rank: number;
  total_options_found: number;
};

type AccommodationOption = {
  rank: number;
  property_name: string;
  type: string;
  estimated_price_per_night: number;
  total_cost: number;
  location_notes: string;
  amenities: string[];
  booking_platform: string;
  breakfast_included: boolean;
  pro_tip: string;
};

type Meal = { place_type: string; recommended_dish: string; cost: number };
type Activity = {
  activity: string;
  location: string;
  entry_fee: number;
  notes: string;
};

type Day = {
  day: number;
  date: string;
  theme: string;
  morning: Activity;
  breakfast: Meal;
  afternoon: Activity;
  lunch: Meal;
  evening: Activity;
  dinner: Meal;
  local_transport: number;
  day_total: number;
  budget_tip: string;
};

type MasterPlan = {
  trip_overview?: TripOverview;
  destination_options?: unknown[];
  recommended_destination?: string;
  transport?: {
    flights: TransportMode;
    trains: TransportMode;
    buses: TransportMode;
    recommended_mode: string;
    recommended_operator: string;
    recommended_cost_per_person: number;
    recommended_total_cost: number;
    local_transport: {
      daily_cost_per_person: number;
      total_local_transport: number;
      recommended_options: string[];
    };
    airport_transfer: { cost: number; recommended_mode: string; notes: string };
    total_transport_cost: number;
    within_budget: boolean;
    savings_tips: string;
  };
  accommodation?: {
    options: AccommodationOption[];
    recommended_rank: number;
    total_options_found: number;
    total_accommodation_cost: number;
    within_budget: boolean;
  };
  itinerary?: {
    daily_budget_target: number;
    days: Day[];
    total_food_and_activities: number;
    free_time_suggestions: string[];
    money_saving_hacks: string[];
  };
  budget_summary?: {
    total_budget: number;
    breakdown: Record<string, number>;
    total_estimated_cost: number;
    remaining_buffer: number;
    status: "WITHIN_BUDGET" | "TIGHT_FIT" | "OVER_BUDGET";
    verdict: string;
    top_savings_opportunities: string[];
  };
};

type AgentState = {
  master_plan?: MasterPlan;
};

type MissingFieldsEvent = {
  type: "missing_fields_form";
  missing_fields: string[];
  collected: Record<string, unknown>;
  prompt: string;
};

type BudgetAllocationEvent = {
  type: "budget_allocation_form";
  total_budget: number;
  currency: string;
  currency_symbol: string;
  default_allocation: Record<string, number>;
  allocation_amounts: Record<string, number>;
  prompt: string;
};

const EXAMPLE_PROMPTS = [
  {
    title: "Budget beach",
    message:
      "Plan a 3-day budget trip from Pune to Goa in June for 2 people, budget Rs. 20,000",
  },
  {
    title: "Culture and food",
    message:
      "5 days in Rajasthan from Delhi, Rs. 30,000, mid-range, culture and food",
  },
  {
    title: "Weekend surprise",
    message:
      "Weekend trip from Mumbai, budget Rs. 10,000, surprise me with a destination",
  },
];

const NODE_LABELS: Record<string, string> = {
  collect_info: "Reading your trip details...",
  confirm_budget: "Working out your budget split...",
  live_data_research: "Searching transport, stays and building your itinerary...",
};

export default function Home() {
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    let sid = localStorage.getItem("travel_session_id") ?? "";
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem("travel_session_id", sid);
    }
    setSessionId(sid);
  }, []);

  function startNewChat() {
    const sid = crypto.randomUUID();
    localStorage.setItem("travel_session_id", sid);
    setSessionId(sid);
  }

  return (
    <div className="flex h-screen flex-col bg-[radial-gradient(circle_at_top_left,var(--secondary),transparent_34%),linear-gradient(180deg,var(--background),var(--background))]">
      <header className="shrink-0 border-b border-border/70 bg-card/85 px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <PlaneTakeoff size={18} />
          </div>
          <div>
            <span className="block text-sm font-semibold leading-tight text-foreground">
              AI Travel Planner
            </span>
            <span className="text-xs text-muted-foreground">
              Budget-aware itineraries
            </span>
          </div>
          <button
            onClick={startNewChat}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-primary/30 hover:text-foreground"
          >
            <Plus size={15} />
            New Chat
          </button>
        </div>
      </header>

      {sessionId && (
        <ThreadsProvider key={sessionId} threadId={sessionId}>
          <div className="flex flex-1 overflow-hidden">
            <div className="flex w-[420px] shrink-0 flex-col border-r border-border/70 bg-card/40">
              <CopilotChat
                className="h-full"
                labels={{
                  initial:
                    "Tell me your origin, destination (optional), dates, budget, travel style and interests — I'll turn it into a full itinerary.",
                }}
                suggestions={EXAMPLE_PROMPTS}
              />
            </div>
            <main className="flex-1 overflow-y-auto">
              <PlanCanvas />
            </main>
          </div>
        </ThreadsProvider>
      )}
    </div>
  );
}

function PlanCanvas() {
  const { state, running, nodeName } = useCoAgent<AgentState>({
    name: "travel_planner",
    initialState: {},
  });

  useLangGraphInterrupt<MissingFieldsEvent>({
    enabled: ({ eventValue }) => eventValue?.type === "missing_fields_form",
    render: ({ event, resolve }) => (
      <InterruptForm prompt={event.value.prompt} resolve={resolve} />
    ),
  });

  useLangGraphInterrupt<BudgetAllocationEvent>({
    enabled: ({ eventValue }) => eventValue?.type === "budget_allocation_form",
    render: ({ event, resolve }) => (
      <BudgetInterruptForm event={event.value} resolve={resolve} />
    ),
  });

  const plan = state?.master_plan;
  const ov = plan?.trip_overview;
  const f = (v: number) => fmt(v, ov?.currency_symbol ?? "", ov?.currency ?? "");

  useCopilotAction({
    name: "show_map",
    description:
      "Show a map centered on a place from the trip (hotel, attraction, or the destination itself).",
    available: "enabled",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Place name or address to center the map on, ideally including the city",
        required: true,
      },
    ],
    render: ({ args }) => <TripMap query={args.query ?? ""} />,
  });

  useCopilotAction({
    name: "compare_transport_options",
    description:
      "Show a detailed comparison of the flight, train, and bus options already found for this trip.",
    available: "enabled",
    parameters: [],
    render: () =>
      plan?.transport ? (
        <TransportSection transport={plan.transport} f={f} />
      ) : (
        <p className="text-sm text-muted-foreground">No transport data yet.</p>
      ),
  });

  useCopilotAction({
    name: "highlight_day",
    description: "Scroll to and highlight a specific day in the itinerary.",
    available: "enabled",
    parameters: [
      { name: "day", type: "number", description: "Day number to highlight", required: true },
    ],
    render: ({ args }) => (args.day != null ? <HighlightDayAction day={args.day} /> : <></>),
  });

  if (plan && Object.keys(plan).length > 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-7 px-4 py-8">
        <PlanResult plan={plan} />
      </div>
    );
  }

  if (running) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <ProgressPanel
          label={
            (nodeName && NODE_LABELS[nodeName]) || "Working on your trip..."
          }
        />
      </div>
    );
  }

  return <WelcomeScreen />;
}

function InterruptForm({
  prompt,
  resolve,
}: {
  prompt: string;
  resolve: (resolution: string) => void;
}) {
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);

  function submit() {
    if (!value.trim() || sent) return;
    setSent(true);
    resolve(value.trim());
  }

  return (
    <div className="mt-3 w-full space-y-3 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {prompt}
      </p>
      {!sent ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Type your reply..."
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={submit}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <SendHorizonal size={15} />
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Sent: &ldquo;{value}&rdquo;</p>
      )}
    </div>
  );
}

function BudgetInterruptForm({
  event,
  resolve,
}: {
  event: BudgetAllocationEvent;
  resolve: (resolution: string) => void;
}) {
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);

  function submit(text: string) {
    if (!text.trim() || sent) return;
    setSent(true);
    resolve(text.trim());
  }

  return (
    <div className="mt-3 w-full space-y-3 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {event.prompt}
      </p>
      {!sent ? (
        <>
          <button
            onClick={() => submit("Looks good, proceed with the default allocation.")}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <CheckCircle size={15} />
            Looks good, proceed
          </button>
          <div className="flex items-center gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(value)}
              placeholder="Or tell me what to adjust..."
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              onClick={() => submit(value)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground shadow-sm transition hover:border-primary/30"
            >
              <SendHorizonal size={15} />
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Sent: &ldquo;{value || "Looks good, proceed with the default allocation."}&rdquo;</p>
      )}
    </div>
  );
}

function ProgressPanel({ label }: { label: string }) {
  return (
    <div className="max-w-md space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles size={16} className="text-primary" />
        Building your travel plan
      </div>
      <div className="flex items-center gap-2.5 text-sm text-foreground">
        <span className="flex h-5 w-5 items-center justify-center gap-0.5 rounded-full bg-primary/10">
          {[0, 1, 2].map((j) => (
            <span
              key={j}
              className="h-1 w-1 animate-bounce rounded-full bg-primary"
              style={{ animationDelay: `${j * 0.15}s` }}
            />
          ))}
        </span>
        {label}
      </div>
    </div>
  );
}

function HighlightDayAction({ day }: { day: number }) {
  useEffect(() => {
    const el = document.getElementById(`day-${day}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "ring-offset-2");
    const timer = setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
    }, 2000);
    return () => clearTimeout(timer);
  }, [day]);

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-card px-4 py-2.5 text-sm text-foreground shadow-sm">
      <CheckCircle size={15} className="text-primary" />
      Jumped to Day {day}
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col justify-center gap-7 px-4 py-6">
      <div className="grid items-center gap-7 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles size={14} />
            Smart routes, stays, food and budget in one chat
          </div>
          <div className="space-y-3">
            <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem]">
              Plan trips that fit your time, taste and budget.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
              Tell me the origin, destination, dates and budget. I&apos;ll turn
              it into a practical itinerary with transport choices, stay
              options, daily activities and spending guardrails.
            </p>
          </div>
          <div className="grid max-w-xl gap-3 sm:grid-cols-3">
            <SmallPill icon={<Route size={15} />} label="Routes" />
            <SmallPill icon={<Hotel size={15} />} label="Stays" />
            <SmallPill icon={<Wallet size={15} />} label="Budget" />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-xl shadow-primary/5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-amber-400" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Sample Plan
                </p>
                <h2 className="text-xl font-bold text-foreground">
                  Pune to Goa
                </h2>
              </div>
              <StatusBadge status="WITHIN_BUDGET" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <PreviewMetric icon={<Calendar size={15} />} label="3 days" />
              <PreviewMetric icon={<Users size={15} />} label="2 travelers" />
              <PreviewMetric icon={<Train size={15} />} label="Train pick" />
              <PreviewMetric icon={<PiggyBank size={15} />} label="Rs. 20k" />
            </div>
            <div className="grid gap-3 rounded-2xl bg-secondary/45 p-4 sm:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-2">
                <PlanPreviewRow
                  icon={<Route size={14} />}
                  label="Route"
                  value="Pune -> Goa"
                />
                <PlanPreviewRow
                  icon={<Hotel size={14} />}
                  label="Stay"
                  value="Near Calangute"
                />
                <PlanPreviewRow
                  icon={<Wallet size={14} />}
                  label="Buffer"
                  value="Rs. 2,400 left"
                />
              </div>
              <div className="space-y-2 border-t border-border pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                {[
                  "Beach arrival",
                  "Fort Aguada and cafes",
                  "Markets and sunset",
                ].map((item, i) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanResult({ plan }: { plan: MasterPlan }) {
  const ov = plan.trip_overview;
  const sym = ov?.currency_symbol ?? "";
  const cur = ov?.currency ?? "";
  const f = (v: number) => fmt(v, sym, cur);

  return (
    <section className="space-y-6">
      {ov && (
        <div className="overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-sm">
          <div className="bg-gradient-to-r from-primary/12 via-accent/10 to-amber-400/10 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Trip Overview
                </p>
                <h2 className="mt-1 text-2xl font-bold text-foreground">
                  {ov.destination}
                  {ov.country ? `, ${ov.country}` : ""}
                </h2>
                <p className="text-sm text-muted-foreground">
                  from {ov.origin}
                </p>
              </div>
              <StatusBadge status={plan.budget_summary?.status} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
            <OverviewChip
              icon={<Calendar size={14} />}
              label="Dates"
              value={`${ov.travel_dates?.start} -> ${ov.travel_dates?.end}`}
            />
            <OverviewChip
              icon={<Clock size={14} />}
              label="Duration"
              value={`${ov.travel_dates?.num_days} days`}
            />
            <OverviewChip
              icon={<Users size={14} />}
              label="Travelers"
              value={`${ov.num_travelers} person${ov.num_travelers > 1 ? "s" : ""}`}
            />
            <OverviewChip
              icon={<Wallet size={14} />}
              label="Budget"
              value={f(ov.total_budget)}
            />
          </div>
        </div>
      )}

      {plan.budget_summary && (
        <Panel
          title="Budget Summary"
          icon={<PiggyBank size={17} />}
          action={<StatusBadge status={plan.budget_summary.status} />}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricCard
              label="Your Budget"
              value={f(plan.budget_summary.total_budget)}
            />
            <MetricCard
              label="Estimated Total"
              value={f(plan.budget_summary.total_estimated_cost)}
            />
            <MetricCard
              label="Remaining"
              value={f(plan.budget_summary.remaining_buffer)}
            />
          </div>
          {plan.budget_summary.verdict && (
            <p className="rounded-2xl bg-secondary/45 p-4 text-sm leading-relaxed text-muted-foreground">
              {plan.budget_summary.verdict}
            </p>
          )}
          {plan.budget_summary.breakdown && (
            <div className="space-y-2">
              {Object.entries(plan.budget_summary.breakdown).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="capitalize text-muted-foreground">
                    {k.replace(/_/g, " ")}
                  </span>
                  <strong className="text-foreground">{f(v)}</strong>
                </div>
              ))}
            </div>
          )}
          <TipList
            title="Savings Opportunities"
            tips={plan.budget_summary.top_savings_opportunities}
          />
        </Panel>
      )}

      {plan.transport && <TransportSection transport={plan.transport} f={f} />}
      {plan.accommodation && (
        <AccommodationSection accommodation={plan.accommodation} f={f} />
      )}
      {(plan.itinerary?.days?.length ?? 0) > 0 && (
        <ItinerarySection itinerary={plan.itinerary!} f={f} />
      )}
    </section>
  );
}

function TransportSection({
  transport,
  f,
}: {
  transport: NonNullable<MasterPlan["transport"]>;
  f: (v: number) => string;
}) {
  const modes = [
    { key: "flights" as const, label: "Flights", icon: <Plane size={16} /> },
    { key: "trains" as const, label: "Trains", icon: <Train size={16} /> },
    { key: "buses" as const, label: "Buses", icon: <Bus size={16} /> },
  ];
  const recMode = transport.recommended_mode?.toLowerCase() ?? "";

  return (
    <Panel title="Getting There" icon={<Route size={17} />}>
      {modes.map(({ key, label, icon }) => {
        const mode = transport[key];
        if (!mode?.options?.length) return null;
        const isRec = recMode.includes(key.slice(0, -1));

        return (
          <div
            key={key}
            className={`overflow-hidden rounded-2xl border ${
              isRec
                ? "border-primary/35 bg-primary/5"
                : "border-border bg-background"
            }`}
          >
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
              <span className="text-primary">{icon}</span>
              <span className="font-bold text-foreground">{label}</span>
              {isRec && <Badge>Recommended</Badge>}
              <span className="ml-auto text-xs text-muted-foreground">
                {mode.total_options_found ?? mode.options.length} found |
                showing {mode.options.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {mode.options.map((opt) => (
                <TransportCard
                  key={`${key}-${opt.rank}`}
                  opt={opt}
                  f={f}
                  isRec={opt.rank === mode.recommended_rank}
                />
              ))}
            </div>
          </div>
        );
      })}

      <div className="grid gap-3 sm:grid-cols-2">
        {transport.local_transport?.daily_cost_per_person > 0 && (
          <CompactCostCard
            icon={<MapPinned size={16} />}
            label="Local Transport"
            title={
              transport.local_transport.recommended_options?.join(", ") ||
              "Public transit"
            }
            value={f(transport.local_transport.daily_cost_per_person)}
            suffix="per day"
          />
        )}
        {transport.airport_transfer?.cost > 0 && (
          <CompactCostCard
            icon={<PlaneTakeoff size={16} />}
            label="Airport Transfer"
            title={transport.airport_transfer.recommended_mode}
            note={transport.airport_transfer.notes}
            value={f(transport.airport_transfer.cost)}
          />
        )}
      </div>

      {transport.savings_tips && (
        <Insight icon={<Lightbulb size={15} />}>
          {transport.savings_tips}
        </Insight>
      )}
    </Panel>
  );
}

function AccommodationSection({
  accommodation,
  f,
}: {
  accommodation: NonNullable<MasterPlan["accommodation"]>;
  f: (v: number) => string;
}) {
  if (!accommodation.options?.length) return null;

  return (
    <Panel
      title="Where to Stay"
      icon={<BedDouble size={17} />}
      action={
        <span className="text-xs text-muted-foreground">
          {accommodation.total_options_found ?? accommodation.options.length}{" "}
          found
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accommodation.options.map((opt, i) => {
          const isRec = opt.rank === accommodation.recommended_rank;
          return (
            <div
              key={`${opt.rank}-${i}`}
              className={`flex flex-col gap-3 rounded-2xl border p-4 ${
                isRec
                  ? "border-primary/35 bg-primary/5"
                  : "border-border bg-background"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {opt.property_name || opt.type}
                  </p>
                  <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                    {opt.type}
                  </p>
                </div>
                {isRec && <Badge>Pick</Badge>}
              </div>
              {opt.location_notes && (
                <IconText icon={<MapPin size={12} />}>
                  {opt.location_notes}
                </IconText>
              )}
              {opt.amenities?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {opt.amenities.slice(0, 4).map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-secondary/60 px-2 py-0.5 text-xs text-foreground"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}
              {opt.breakfast_included && (
                <IconText icon={<Utensils size={12} />}>
                  Breakfast included
                </IconText>
              )}
              <div className="mt-auto border-t border-border pt-3">
                {opt.estimated_price_per_night > 0 && (
                  <>
                    <p className="text-lg font-bold leading-tight text-primary">
                      {f(opt.estimated_price_per_night)}
                    </p>
                    <p className="text-xs text-muted-foreground">per night</p>
                  </>
                )}
                {opt.total_cost > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Total:{" "}
                    <strong className="text-foreground">
                      {f(opt.total_cost)}
                    </strong>
                  </p>
                )}
                {opt.booking_platform && (
                  <p className="text-xs text-muted-foreground">
                    via{" "}
                    <strong className="text-foreground">
                      {opt.booking_platform}
                    </strong>
                  </p>
                )}
              </div>
              {opt.pro_tip && (
                <Insight icon={<Lightbulb size={13} />}>{opt.pro_tip}</Insight>
              )}
            </div>
          );
        })}
      </div>
      {accommodation.total_accommodation_cost > 0 && (
        <p className="text-right text-sm text-muted-foreground">
          Total accommodation:{" "}
          <strong className="text-foreground">
            {f(accommodation.total_accommodation_cost)}
          </strong>
        </p>
      )}
    </Panel>
  );
}

function ItinerarySection({
  itinerary,
  f,
}: {
  itinerary: NonNullable<MasterPlan["itinerary"]>;
  f: (v: number) => string;
}) {
  return (
    <Panel
      title="Day-by-Day Itinerary"
      icon={<MapPinned size={17} />}
      action={
        itinerary.daily_budget_target > 0 ? (
          <span className="text-xs text-muted-foreground">
            Target:{" "}
            <strong className="text-foreground">
              {f(itinerary.daily_budget_target)}/day
            </strong>
          </span>
        ) : null
      }
    >
      <div className="space-y-4">
        {itinerary.days.map((day) => (
          <div
            key={day.day}
            id={`day-${day.day}`}
            className="overflow-hidden rounded-2xl border border-border bg-background transition-shadow"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/35 px-5 py-3">
              <div>
                <h4 className="font-bold text-foreground">
                  Day {day.day}: {day.theme}
                </h4>
                {day.date && (
                  <p className="text-xs text-muted-foreground">{day.date}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Day Total</p>
                <p className="text-base font-bold text-primary">
                  {f(day.day_total)}
                </p>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <TimeSlot
                icon={<Sunrise size={14} />}
                label="Morning"
                activity={day.morning}
                meal={day.breakfast}
                mealLabel="Breakfast"
                f={f}
              />
              <TimeSlot
                icon={<Sun size={14} />}
                label="Afternoon"
                activity={day.afternoon}
                meal={day.lunch}
                mealLabel="Lunch"
                f={f}
              />
              <TimeSlot
                icon={<Moon size={14} />}
                label="Evening"
                activity={day.evening}
                meal={day.dinner}
                mealLabel="Dinner"
                f={f}
              />
              {day.local_transport > 0 && (
                <div className="flex justify-between border-t border-border pt-3 text-sm">
                  <IconText icon={<Bus size={13} />}>Local transport</IconText>
                  <span className="font-medium text-foreground">
                    {f(day.local_transport)}
                  </span>
                </div>
              )}
            </div>
            {day.budget_tip && (
              <div className="border-t border-border bg-accent/5 px-5 py-3">
                <Insight icon={<Lightbulb size={13} />}>
                  {day.budget_tip}
                </Insight>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TipList
          title="Money-Saving Ideas"
          tips={itinerary.money_saving_hacks}
        />
        <TipList
          title="Free Time Ideas"
          tips={itinerary.free_time_suggestions}
        />
      </div>
    </Panel>
  );
}

function TransportCard({
  opt,
  f,
  isRec,
}: {
  opt: TransportOption;
  f: (v: number) => string;
  isRec: boolean;
}) {
  const name =
    opt.airline ?? opt.train_name ?? opt.operator ?? `Option ${opt.rank}`;
  const number = opt.flight_number ?? opt.train_number ?? opt.bus_type ?? "";

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 ${
        isRec ? "border-primary/35 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold leading-snug text-foreground">
            {name}
          </p>
          {number && (
            <p className="mt-0.5 text-xs font-medium text-primary">{number}</p>
          )}
        </div>
        {isRec && <Badge>Pick</Badge>}
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        {opt.departure_time && (
          <IconText icon={<Clock size={12} />}>
            {opt.departure_time}
            {opt.arrival_time ? ` -> ${opt.arrival_time}` : ""}
          </IconText>
        )}
        {opt.duration && (
          <IconText icon={<Clock size={12} />}>{opt.duration}</IconText>
        )}
        {opt.stops && (
          <IconText icon={<Repeat size={12} />}>{opt.stops}</IconText>
        )}
        {opt.class && (
          <IconText icon={<Armchair size={12} />}>{opt.class}</IconText>
        )}
      </div>
      <div className="mt-auto border-t border-border pt-3">
        {opt.estimated_cost_per_person > 0 && (
          <>
            <p className="text-lg font-bold leading-tight text-primary">
              {f(opt.estimated_cost_per_person)}
            </p>
            <p className="text-xs text-muted-foreground">per person</p>
          </>
        )}
        {opt.total_cost > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Total:{" "}
            <strong className="text-foreground">{f(opt.total_cost)}</strong>
          </p>
        )}
        {opt.booking_platform && (
          <p className="text-xs text-muted-foreground">
            via{" "}
            <strong className="text-foreground">{opt.booking_platform}</strong>
          </p>
        )}
      </div>
      {opt.booking_tips && (
        <Insight icon={<Lightbulb size={13} />}>{opt.booking_tips}</Insight>
      )}
    </div>
  );
}

function TimeSlot({
  icon,
  label,
  activity,
  meal,
  mealLabel,
  f,
}: {
  icon: React.ReactNode;
  label: string;
  activity?: Activity;
  meal?: Meal;
  mealLabel: string;
  f: (v: number) => string;
}) {
  return (
    <div className="border-b border-border pb-4 last:border-0 last:pb-0">
      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </p>
      <div className="space-y-2 text-sm">
        {activity?.activity && (
          <div className="flex justify-between gap-4">
            <div>
              <span className="text-foreground">{activity.activity}</span>
              {activity.location && (
                <IconText icon={<MapPin size={12} />}>
                  {activity.location}
                </IconText>
              )}
              {activity.notes && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {activity.notes}
                </p>
              )}
            </div>
            {activity.entry_fee > 0 && (
              <span className="shrink-0 font-semibold text-primary">
                {f(activity.entry_fee)}
              </span>
            )}
          </div>
        )}
        {meal && (
          <div className="flex justify-between gap-4 text-muted-foreground">
            <IconText icon={<Utensils size={12} />}>
              {mealLabel} | {meal.place_type}
              {meal.recommended_dish ? ` (${meal.recommended_dish})` : ""}
            </IconText>
            {meal.cost > 0 && (
              <span className="font-medium text-foreground">
                {f(meal.cost)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function OverviewChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-3">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </span>
      <span className="mt-1 block text-sm font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <strong className="mt-1 block text-xl leading-tight text-foreground">
        {value}
      </strong>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const cfg =
    status === "WITHIN_BUDGET"
      ? {
          cls: "bg-green-100 text-green-700 border-green-200",
          icon: <CheckCircle size={12} />,
          label: "Within Budget",
        }
      : status === "TIGHT_FIT"
        ? {
            cls: "bg-amber-100 text-amber-700 border-amber-200",
            icon: <AlertCircle size={12} />,
            label: "Tight Fit",
          }
        : {
            cls: "bg-red-100 text-red-700 border-red-200",
            icon: <AlertCircle size={12} />,
            label: "Over Budget",
          };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.cls}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
      <CheckCircle size={11} />
      {children}
    </span>
  );
}

function SmallPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm">
      <span className="text-primary">{icon}</span>
      {label}
    </div>
  );
}

function PreviewMetric({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-3 text-sm font-semibold text-foreground">
      <span className="text-primary">{icon}</span>
      {label}
    </div>
  );
}

function PlanPreviewRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-background/75 px-3 py-2">
      <span className="text-primary">{icon}</span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-xs font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function CompactCostCard({
  icon,
  label,
  title,
  note,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  note?: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-5 py-4">
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="text-primary">{icon}</span>
          {label}
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">{title}</p>
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-primary">{value}</p>
        {suffix && <p className="text-xs text-muted-foreground">{suffix}</p>}
      </div>
    </div>
  );
}

function TipList({ title, tips }: { title: string; tips?: string[] }) {
  if (!tips?.length) return null;
  return (
    <div className="rounded-2xl border border-accent/15 bg-accent/5 p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
        <Lightbulb size={14} className="text-primary" />
        {title}
      </p>
      <ul className="space-y-1.5">
        {tips.map((tip) => (
          <li key={tip} className="flex gap-2 text-sm text-muted-foreground">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Insight({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <p className="flex gap-2 rounded-xl bg-secondary/45 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
      {children}
    </p>
  );
}

function IconText({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
      <span>{children}</span>
    </span>
  );
}

function fmt(value: number, sym: string, cur: string) {
  return `${sym}${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })} ${cur}`.trim();
}
