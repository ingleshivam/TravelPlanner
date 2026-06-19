"use client";

import { useEffect, useRef, useState } from "react";
import {
  PlaneTakeoff,
  SendHorizonal,
  Plus,
  CheckCircle,
  AlertCircle,
  MapPin,
  Calendar,
  Users,
  Wallet,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MOCK_REPLIES, MOCK_PLAN } from "@/lib/mock-data";

const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

// ── Types matching master_plan returned by SerpAPI Google AI Mode ─────────────

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
  // flight
  airline?: string;
  flight_number?: string;
  stops?: string;
  // train
  train_name?: string;
  train_number?: string;
  operator?: string;
  class?: string;
  // bus
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
type Activity = { activity: string; location: string; entry_fee: number; notes: string };

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
  destination_options?: any[];
  recommended_destination?: string;
  transport?: {
    flights: TransportMode;
    trains: TransportMode;
    buses: TransportMode;
    recommended_mode: string;
    recommended_operator: string;
    recommended_cost_per_person: number;
    recommended_total_cost: number;
    local_transport: { daily_cost_per_person: number; total_local_transport: number; recommended_options: string[] };
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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  plan?: MasterPlan;
  isLoading?: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const EXAMPLE_PROMPTS = [
  "Plan a 3-day budget trip from Pune to Goa in June for 2 people, budget ₹20,000",
  "5 days in Rajasthan from Delhi, ₹30,000, mid-range, culture & food",
  "Weekend trip from Mumbai, budget ₹10,000, surprise me with a destination",
];

export default function Home() {
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mockStep, setMockStep] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let sid = localStorage.getItem("travel_session_id") ?? "";
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem("travel_session_id", sid);
    }
    setSessionId(sid);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [input]);

  function startNewChat() {
    const sid = crypto.randomUUID();
    localStorage.setItem("travel_session_id", sid);
    setSessionId(sid);
    setMessages([]);
    setInput("");
    setMockStep(0);
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading || !sessionId) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const thinkingMsg: ChatMessage = { id: "thinking", role: "assistant", content: "", isLoading: true };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setInput("");
    setLoading(true);

    if (MOCK_MODE) {
      await new Promise((r) => setTimeout(r, 800));
      const step = Math.min(mockStep, MOCK_REPLIES.length - 1);
      const mock = MOCK_REPLIES[step];
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: mock.reply,
        plan: mock.stage === "complete" ? MOCK_PLAN : undefined,
      };
      setMessages((prev) => [...prev.slice(0, -1), assistantMsg]);
      setMockStep((s) => s + 1);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Something went wrong.");

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        plan: data.plan ?? undefined,
      };
      setMessages((prev) => [...prev.slice(0, -1), assistantMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: err instanceof Error ? err.message : "Something went wrong.",
      };
      setMessages((prev) => [...prev.slice(0, -1), errMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2.5">
          <PlaneTakeoff size={20} className="text-primary" />
          <span className="font-semibold text-foreground">AI Travel Planner</span>
        </div>
        <button
          onClick={startNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
        >
          <Plus size={15} />
          New Chat
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <WelcomeScreen onSelect={sendMessage} />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      <div className="shrink-0 border-t border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your trip… (e.g. 3 days in Goa from Pune, ₹15,000 budget)"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition disabled:opacity-50"
              style={{ minHeight: "48px", maxHeight: "128px" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0"
            >
              <SendHorizonal size={17} />
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Markdown renderer ──────────────────────────────────────────────────────────

const MD_COMPONENTS = {
  p: ({ children }: any) => <p className="leading-relaxed my-1">{children}</p>,
  h2: ({ children }: any) => <h2 className="text-lg font-bold mt-3 mb-1">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-base font-bold mt-2 mb-1">{children}</h3>,
  strong: ({ children }: any) => <strong className="font-semibold text-foreground">{children}</strong>,
  ul: ({ children }: any) => <ul className="list-disc list-inside space-y-1 my-1">{children}</ul>,
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  hr: () => <hr className="border-border my-3" />,
  code: ({ children }: any) => (
    <code className="text-xs bg-secondary px-1 py-0.5 rounded font-mono">{children}</code>
  ),
};

// ── Welcome screen ─────────────────────────────────────────────────────────────

function WelcomeScreen({ onSelect }: { onSelect: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-16 gap-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <PlaneTakeoff size={32} className="text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">AI Travel Planner</h1>
          <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
            Tell me where you&apos;d like to go. I&apos;ll find transport, accommodation,
            and build a day-by-day itinerary within your budget.
          </p>
        </div>
      </div>
      <div className="grid gap-3 w-full max-w-lg">
        {EXAMPLE_PROMPTS.map((p, i) => (
          <button
            key={i}
            onClick={() => onSelect(p)}
            className="text-left px-4 py-3 rounded-xl border border-border bg-card hover:bg-secondary/50 text-sm text-foreground transition"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Chat bubble ────────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] px-4 py-3 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-sm leading-relaxed whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <PlaneTakeoff size={14} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0 space-y-5">
        {msg.isLoading ? (
          <ThinkingDots />
        ) : (
          <>
            {msg.content && (
              <div className="text-sm text-foreground leading-relaxed space-y-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            )}
            {msg.plan && Object.keys(msg.plan).length > 0 && (
              <PlanResult plan={msg.plan} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(value: number, sym: string, cur: string) {
  return `${sym}${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${cur}`.trim();
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const cfg =
    status === "WITHIN_BUDGET"
      ? { cls: "bg-green-100/50 text-green-700", icon: <CheckCircle size={12} />, label: "Within Budget" }
      : status === "TIGHT_FIT"
      ? { cls: "bg-yellow-100/50 text-yellow-700", icon: <AlertCircle size={12} />, label: "Tight Fit" }
      : { cls: "bg-red-100/50 text-red-700", icon: <AlertCircle size={12} />, label: "Over Budget" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Plan sections ──────────────────────────────────────────────────────────────

function PlanResult({ plan }: { plan: MasterPlan }) {
  const ov = plan.trip_overview;
  const sym = ov?.currency_symbol ?? "";
  const cur = ov?.currency ?? "";
  const f = (v: number) => fmt(v, sym, cur);

  return (
    <section className="space-y-6">
      {/* Trip Overview */}
      {ov && (
        <div className="bg-gradient-to-br from-primary/10 to-accent/5 rounded-2xl border border-primary/20 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {ov.destination}{ov.country ? `, ${ov.country}` : ""}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">from {ov.origin}</p>
            </div>
            <StatusBadge status={plan.budget_summary?.status} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
            <OverviewChip icon={<Calendar size={14} />} label="Dates"
              value={`${ov.travel_dates?.start} → ${ov.travel_dates?.end}`} />
            <OverviewChip icon={<Calendar size={14} />} label="Duration"
              value={`${ov.travel_dates?.num_days} days`} />
            <OverviewChip icon={<Users size={14} />} label="Travelers"
              value={`${ov.num_travelers} person${ov.num_travelers > 1 ? "s" : ""}`} />
            <OverviewChip icon={<Wallet size={14} />} label="Budget"
              value={f(ov.total_budget)} />
          </div>
          {ov.travel_style && (
            <span className="inline-block mt-3 text-xs font-medium px-2.5 py-1 bg-primary/10 text-primary rounded-full capitalize">
              {ov.travel_style.replace(/-/g, " ")}
            </span>
          )}
        </div>
      )}

      {/* Budget Summary */}
      {plan.budget_summary && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-5">
          <h3 className="font-bold text-foreground text-base">Budget Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <MetricCard label="Your Budget"     value={f(plan.budget_summary.total_budget)} />
            <MetricCard label="Estimated Total" value={f(plan.budget_summary.total_estimated_cost)} />
            <MetricCard label="Remaining"       value={f(plan.budget_summary.remaining_buffer)} />
          </div>

          {plan.budget_summary.verdict && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {plan.budget_summary.verdict}
            </p>
          )}

          {plan.budget_summary.breakdown && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-foreground uppercase tracking-wide">Breakdown</p>
              {Object.entries(plan.budget_summary.breakdown).map(([k, v]) => (
                <div key={k} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                  <strong className="text-foreground">{f(v)}</strong>
                </div>
              ))}
            </div>
          )}

          {(plan.budget_summary.top_savings_opportunities?.length ?? 0) > 0 && (
            <div className="bg-accent/5 rounded-xl p-4 border border-accent/10">
              <p className="text-sm font-bold text-foreground mb-2">💰 Savings Opportunities</p>
              <ul className="space-y-1.5">
                {plan.budget_summary.top_savings_opportunities.map((tip, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-accent">•</span>{tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Transport */}
      {plan.transport && <TransportSection transport={plan.transport} f={f} />}

      {/* Accommodation */}
      {plan.accommodation && <AccommodationSection accommodation={plan.accommodation} f={f} />}

      {/* Itinerary */}
      {(plan.itinerary?.days?.length ?? 0) > 0 && (
        <ItinerarySection itinerary={plan.itinerary!} f={f} />
      )}
    </section>
  );
}

function OverviewChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
        {icon} {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

// ── Transport ──────────────────────────────────────────────────────────────────

function TransportSection({ transport, f }: { transport: NonNullable<MasterPlan["transport"]>; f: (v: number) => string }) {
  const modes = [
    { key: "flights" as const, label: "Flights",  icon: "✈️" },
    { key: "trains"  as const, label: "Trains",   icon: "🚂" },
    { key: "buses"   as const, label: "Buses",    icon: "🚌" },
  ];

  const recMode = transport.recommended_mode?.toLowerCase() ?? "";

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-foreground text-base">Getting There</h3>

      {modes.map(({ key, label, icon }) => {
        const mode = transport[key];
        if (!mode?.options?.length) return null;
        const isRec = recMode.includes(key.slice(0, -1)); // "flight", "train", "bus"

        return (
          <div
            key={key}
            className={`rounded-2xl border-2 overflow-hidden ${isRec ? "border-primary/30" : "border-border"}`}
          >
            <div className={`flex items-center gap-3 px-5 py-3 ${isRec ? "bg-primary/10" : "bg-secondary/30"}`}>
              <span className="text-lg">{icon}</span>
              <span className="font-bold text-foreground">{label}</span>
              {isRec && (
                <span className="px-2 py-0.5 bg-green-100/50 text-green-700 text-xs font-bold rounded-full">
                  ✓ Recommended
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {mode.total_options_found ?? mode.options.length} found · showing {mode.options.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {mode.options.map((opt) => {
                const isRecOption = opt.rank === mode.recommended_rank;
                const name =
                  opt.airline ?? opt.train_name ?? opt.operator ?? `Option ${opt.rank}`;
                const number = opt.flight_number ?? opt.train_number ?? opt.bus_type ?? "";

                return (
                  <div
                    key={opt.rank}
                    className={`flex flex-col gap-2 rounded-xl p-4 border ${
                      isRecOption ? "bg-primary/5 border-primary/30" : "bg-background border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground text-sm leading-snug">{name}</p>
                        {number && <p className="text-xs text-primary font-medium mt-0.5">{number}</p>}
                      </div>
                      {isRecOption && (
                        <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-green-100/50 text-green-700">✓</span>
                      )}
                    </div>

                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      {opt.departure_time && <p>🕐 {opt.departure_time}{opt.arrival_time ? ` → ${opt.arrival_time}` : ""}</p>}
                      {opt.duration && <p>⏱ {opt.duration}</p>}
                      {opt.stops && <p>🔁 {opt.stops}</p>}
                      {opt.class && <p>💺 {opt.class}</p>}
                    </div>

                    <div className="mt-auto pt-2 border-t border-border">
                      {opt.estimated_cost_per_person > 0 && (
                        <>
                          <p className="text-lg font-bold text-primary leading-tight">{f(opt.estimated_cost_per_person)}</p>
                          <p className="text-xs text-muted-foreground">per person</p>
                        </>
                      )}
                      {opt.total_cost > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Total: <strong className="text-foreground">{f(opt.total_cost)}</strong>
                        </p>
                      )}
                      {opt.booking_platform && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          via <strong className="text-foreground">{opt.booking_platform}</strong>
                        </p>
                      )}
                    </div>

                    {opt.booking_tips && (
                      <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-2 py-1.5 leading-relaxed">
                        💡 {opt.booking_tips}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Local transport + airport transfer */}
      <div className="grid sm:grid-cols-2 gap-3">
        {transport.local_transport?.daily_cost_per_person > 0 && (
          <div className="flex items-center justify-between px-5 py-4 bg-secondary/30 rounded-2xl border border-border">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Local Transport</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {transport.local_transport.recommended_options?.join(", ") || "Public transit"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-primary">{f(transport.local_transport.daily_cost_per_person)}</p>
              <p className="text-xs text-muted-foreground">per day</p>
            </div>
          </div>
        )}
        {transport.airport_transfer?.cost > 0 && (
          <div className="flex items-center justify-between px-5 py-4 bg-secondary/30 rounded-2xl border border-border">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Airport Transfer</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{transport.airport_transfer.recommended_mode}</p>
              {transport.airport_transfer.notes && (
                <p className="text-xs text-muted-foreground mt-0.5">{transport.airport_transfer.notes}</p>
              )}
            </div>
            <p className="text-lg font-bold text-primary">{f(transport.airport_transfer.cost)}</p>
          </div>
        )}
      </div>

      {transport.savings_tips && (
        <p className="text-sm text-muted-foreground bg-accent/5 rounded-xl p-4 border border-accent/10">
          💡 {transport.savings_tips}
        </p>
      )}
    </div>
  );
}

// ── Accommodation ──────────────────────────────────────────────────────────────

function AccommodationSection({ accommodation, f }: { accommodation: NonNullable<MasterPlan["accommodation"]>; f: (v: number) => string }) {
  if (!accommodation.options?.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground text-base">Where to Stay</h3>
        <span className="text-xs text-muted-foreground">
          {accommodation.total_options_found ?? accommodation.options.length} found · showing {accommodation.options.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {accommodation.options.map((opt) => {
          const isRec = opt.rank === accommodation.recommended_rank;
          return (
            <div
              key={opt.rank}
              className={`flex flex-col gap-2 rounded-2xl p-4 border-2 ${
                isRec ? "bg-primary/5 border-primary/30" : "bg-card border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground text-sm leading-snug">{opt.property_name || opt.type}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{opt.type}</p>
                </div>
                {isRec && (
                  <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-green-100/50 text-green-700">✓ Pick</span>
                )}
              </div>

              {opt.location_notes && (
                <p className="text-xs text-muted-foreground flex gap-1">
                  <MapPin size={11} className="shrink-0 mt-0.5" />{opt.location_notes}
                </p>
              )}

              {opt.amenities?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {opt.amenities.slice(0, 4).map((a, j) => (
                    <span key={j} className="text-xs bg-secondary/50 text-foreground rounded-full px-2 py-0.5">{a}</span>
                  ))}
                </div>
              )}

              {opt.breakfast_included && (
                <span className="text-xs text-green-700 font-medium">🍳 Breakfast included</span>
              )}

              <div className="mt-auto pt-2 border-t border-border">
                {opt.estimated_price_per_night > 0 && (
                  <>
                    <p className="text-lg font-bold text-primary leading-tight">{f(opt.estimated_price_per_night)}</p>
                    <p className="text-xs text-muted-foreground">per night</p>
                  </>
                )}
                {opt.total_cost > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Total: <strong className="text-foreground">{f(opt.total_cost)}</strong>
                  </p>
                )}
                {opt.booking_platform && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    via <strong className="text-foreground">{opt.booking_platform}</strong>
                  </p>
                )}
              </div>

              {opt.pro_tip && (
                <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-2 py-1.5 leading-relaxed">
                  💡 {opt.pro_tip}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {accommodation.total_accommodation_cost > 0 && (
        <p className="text-sm text-muted-foreground text-right">
          Total accommodation cost:{" "}
          <strong className="text-foreground">{f(accommodation.total_accommodation_cost)}</strong>
        </p>
      )}
    </div>
  );
}

// ── Itinerary ──────────────────────────────────────────────────────────────────

function ItinerarySection({ itinerary, f }: { itinerary: NonNullable<MasterPlan["itinerary"]>; f: (v: number) => string }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground text-base">Day-by-Day Itinerary</h3>
        {itinerary.daily_budget_target > 0 && (
          <span className="text-xs text-muted-foreground">
            Target: <strong className="text-foreground">{f(itinerary.daily_budget_target)}/day</strong>
          </span>
        )}
      </div>

      <div className="space-y-4">
        {itinerary.days.map((day) => (
          <div key={day.day} className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-5 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h4 className="font-bold text-foreground">Day {day.day}: {day.theme}</h4>
                {day.date && <p className="text-xs text-muted-foreground mt-0.5">{day.date}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Day Total</p>
                <p className="text-base font-bold text-primary">{f(day.day_total)}</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Morning */}
              <TimeSlot label="🌅 Morning" activity={day.morning} meal={day.breakfast} mealLabel="Breakfast" f={f} />
              {/* Afternoon */}
              <div className="border-t border-border pt-4">
                <TimeSlot label="☀️ Afternoon" activity={day.afternoon} meal={day.lunch} mealLabel="Lunch" f={f} />
              </div>
              {/* Evening */}
              <div className="border-t border-border pt-4">
                <TimeSlot label="🌙 Evening" activity={day.evening} meal={day.dinner} mealLabel="Dinner" f={f} />
              </div>

              {/* Local transport for the day */}
              {day.local_transport > 0 && (
                <div className="border-t border-border pt-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">🚌 Local transport</span>
                  <span className="font-medium text-foreground">{f(day.local_transport)}</span>
                </div>
              )}
            </div>

            {day.budget_tip && (
              <div className="px-5 py-3 bg-accent/5 border-t border-border text-xs text-muted-foreground">
                💡 {day.budget_tip}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Hacks + suggestions */}
      <div className="grid sm:grid-cols-2 gap-4">
        {itinerary.money_saving_hacks?.length > 0 && (
          <div className="bg-accent/5 border border-accent/10 rounded-xl p-4">
            <p className="font-bold text-foreground mb-2 text-sm">💰 Money-Saving Hacks</p>
            <ul className="space-y-1.5">
              {itinerary.money_saving_hacks.map((h, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-accent">•</span>{h}
                </li>
              ))}
            </ul>
          </div>
        )}
        {itinerary.free_time_suggestions?.length > 0 && (
          <div className="bg-accent/5 border border-accent/10 rounded-xl p-4">
            <p className="font-bold text-foreground mb-2 text-sm">🎯 Free Time Ideas</p>
            <ul className="space-y-1.5">
              {itinerary.free_time_suggestions.map((s, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-accent">•</span>{s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function TimeSlot({
  label, activity, meal, mealLabel, f,
}: {
  label: string;
  activity?: Activity;
  meal?: Meal;
  mealLabel: string;
  f: (v: number) => string;
}) {
  return (
    <div>
      <p className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">{label}</p>
      <div className="space-y-1.5 text-sm">
        {activity?.activity && (
          <div className="flex justify-between gap-4">
            <div>
              <span className="text-foreground">{activity.activity}</span>
              {activity.location && (
                <span className="text-muted-foreground text-xs ml-2">📍 {activity.location}</span>
              )}
              {activity.notes && (
                <p className="text-xs text-muted-foreground mt-0.5">{activity.notes}</p>
              )}
            </div>
            {activity.entry_fee > 0 && (
              <span className="font-semibold text-primary shrink-0">{f(activity.entry_fee)}</span>
            )}
          </div>
        )}
        {meal && (
          <div className="flex justify-between text-muted-foreground">
            <span>
              🍽️ {mealLabel} · {meal.place_type}
              {meal.recommended_dish && (
                <span className="italic text-xs ml-1">({meal.recommended_dish})</span>
              )}
            </span>
            {meal.cost > 0 && (
              <span className="text-foreground font-medium">{f(meal.cost)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared UI ──────────────────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
      <strong className="text-xl text-foreground leading-tight">{value}</strong>
    </div>
  );
}
