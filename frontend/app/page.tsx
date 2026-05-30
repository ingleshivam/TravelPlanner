"use client";

import { useEffect, useRef, useState } from "react";
import {
  PlaneTakeoff,
  SendHorizonal,
  Plus,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type TravelPlan = {
  currency: string;
  currency_symbol: string;
  destination: string | null;
  destination_research?: Record<string, any> | null;
  transport_plan?: Record<string, any> | null;
  accommodation_plan?: Record<string, any> | null;
  itinerary?: Record<string, any> | null;
  budget_summary?: Record<string, any> | null;
  final_plan_ready: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  plan?: TravelPlan;
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
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading || !sessionId) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const thinkingMsg: ChatMessage = {
      id: "thinking",
      role: "assistant",
      content: "",
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setInput("");
    setLoading(true);

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
      {/* Header */}
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

      {/* Messages area */}
      <main className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <WelcomeScreen onSelect={(p) => sendMessage(p)} />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your trip... (e.g. 3 days in Goa from Pune, ₹15,000 budget)"
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

const MD_COMPONENTS = {
  p: ({ children }: any) => <p className="leading-relaxed my-1">{children}</p>,
  h1: ({ children }: any) => <h1 className="text-xl font-bold mt-4 mb-1">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-lg font-bold mt-3 mb-1">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-base font-bold mt-2 mb-1">{children}</h3>,
  strong: ({ children }: any) => <strong className="font-semibold text-foreground">{children}</strong>,
  ul: ({ children }: any) => <ul className="list-disc list-inside space-y-1 my-1">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-inside space-y-1 my-1">{children}</ol>,
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  hr: () => <hr className="border-border my-3" />,
  code: ({ children }: any) => (
    <code className="text-xs bg-secondary px-1 py-0.5 rounded font-mono">{children}</code>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead>{children}</thead>,
  tbody: ({ children }: any) => <tbody>{children}</tbody>,
  tr: ({ children }: any) => <tr className="border-b border-border">{children}</tr>,
  th: ({ children }: any) => (
    <th className="text-left px-3 py-2 bg-secondary/50 font-semibold text-foreground border border-border">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="px-3 py-2 border border-border text-muted-foreground">{children}</td>
  ),
};

function WelcomeScreen({ onSelect }: { onSelect: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-16 gap-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <PlaneTakeoff size={32} className="text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            AI Travel Planner
          </h1>
          <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
            Tell me where you&apos;d like to go. I&apos;ll find transport,
            accommodation, and build a day-by-day itinerary within your budget.
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
            {msg.plan && <PlanResult plan={msg.plan} />}
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

// ── Helpers ────────────────────────────────────────────────────────────────

function money(value: number, plan: TravelPlan) {
  return `${plan.currency_symbol}${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${plan.currency}`.trim();
}

// ── Plan display (rendered inline inside the chat) ─────────────────────────

function PlanResult({ plan }: { plan: TravelPlan }) {
  const summary = plan.budget_summary?.budget_summary;
  const itinerary: any[] = plan.itinerary?.itinerary || [];
  const transport = plan.transport_plan;
  const accommodation = plan.accommodation_plan;
  const research = plan.destination_research;

  return (
    <section className="space-y-8">
      {/* Destination header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="text-3xl font-bold text-foreground">
            {plan.destination || "Recommended destination"}
          </h2>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
              plan.final_plan_ready
                ? "bg-green-100/50 text-green-700"
                : summary?.status === "TIGHT_FIT"
                  ? "bg-yellow-100/50 text-yellow-700"
                  : "bg-destructive/10 text-destructive"
            }`}
          >
            {plan.final_plan_ready ? (
              <>
                <CheckCircle size={13} /> Ready to Go
              </>
            ) : summary?.status === "TIGHT_FIT" ? (
              <>
                <AlertCircle size={13} /> Tight Fit
              </>
            ) : (
              <>
                <AlertCircle size={13} /> Review Budget
              </>
            )}
          </div>
        </div>
      </div>

      {/* Budget Summary */}
      {summary && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="text-lg font-bold text-foreground mb-5">
            Budget Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
            <MetricCard
              label="Your Budget"
              value={money(summary.total_budget, plan)}
            />
            <MetricCard
              label="Estimated Total"
              value={money(summary.total_estimated_cost, plan)}
            />
            <MetricCard
              label="Remaining"
              value={money(summary.remaining_buffer, plan)}
            />
            <MetricCard
              label="Status"
              value={summary.status.replace(/_/g, " ")}
            />
          </div>

          <p className="text-muted-foreground mb-5 leading-relaxed text-sm">
            {summary.verdict}
          </p>

          {summary.breakdown && (
            <div className="mb-5">
              <p className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">
                Cost Breakdown
              </p>
              <div className="space-y-2.5">
                {Object.entries(
                  summary.breakdown as Record<string, number>,
                ).map(([k, v]) => (
                  <div className="flex justify-between items-center" key={k}>
                    <span className="text-muted-foreground text-sm capitalize">
                      {k.replace(/_/g, " ")}
                    </span>
                    <strong className="text-foreground text-sm">
                      {money(v, plan)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.top_savings_opportunities?.length > 0 && (
            <div className="bg-accent/5 rounded-xl p-4 border border-accent/10">
              <p className="text-sm font-bold text-foreground mb-2">
                💰 Savings Opportunities
              </p>
              <ul className="space-y-1.5">
                {summary.top_savings_opportunities.map(
                  (tip: string, i: number) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground flex gap-2"
                    >
                      <span className="text-accent">•</span>
                      {tip}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Destination Research */}
      {research?.destinations?.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground">
            Destination Options
          </h3>
          <p className="text-muted-foreground text-sm">
            AI-recommended based on your budget and interests
          </p>
          <div className="grid gap-3">
            {research?.destinations.map((d: any, i: number) => (
              <div
                className={`bg-card rounded-2xl border-2 p-5 transition ${
                  d.city === plan.destination?.split(",")[0]
                    ? "border-primary/30 bg-primary/5"
                    : "border-border"
                }`}
                key={i}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <h4 className="font-bold text-foreground">
                      {d.city}, {d.country}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {d.why_fits_budget}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary whitespace-nowrap">
                    {d.confidence}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>~{money(d.daily_cost_estimate, plan)}/day</span>
                  <span>{d.best_travel_months}</span>
                </div>
                {d.visa_notes && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {d.visa_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transport */}
      {transport && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground">Getting Around</h3>
          <div className="space-y-4">
            {(
              [
                { key: "flight", label: "Flights", icon: "✈️" },
                { key: "train", label: "Trains", icon: "🚂" },
                { key: "bus", label: "Buses", icon: "🚌" },
              ] as const
            ).map(({ key, label, icon }) => {
              const aiOptions = (
                (transport.intercity?.all_options || []) as any[]
              ).filter((o) => o.mode?.toLowerCase().includes(key));
              const fareField: Record<string, string> = {
                flight: "flight_fare",
                train: "train_fare",
                bus: "bus_fare",
              };
              const rawByMode: Record<string, any[]> = {
                flight: transport.available_options?.flights || [],
                train: transport.available_options?.trains || [],
                bus: transport.available_options?.buses || [],
              };
              const rawOptions: any[] = [...(rawByMode[key] || [])]
                .sort(
                  (a, b) =>
                    (a[fareField[key]] || 0) - (b[fareField[key]] || 0),
                )
                .slice(0, 5);
              if (!aiOptions.length && !rawOptions.length) return null;

              const isRecommended = transport.intercity?.recommended_mode
                ?.toLowerCase()
                .includes(key);
              const optionCount = rawOptions.length || aiOptions.length;

              return (
                <div
                  key={key}
                  className={`rounded-2xl border-2 overflow-hidden ${
                    isRecommended
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div
                    className={`flex items-center gap-3 px-5 py-3 ${
                      isRecommended ? "bg-primary/10" : "bg-secondary/30"
                    }`}
                  >
                    <span className="text-xl">{icon}</span>
                    <span className="font-bold text-foreground">{label}</span>
                    {isRecommended && (
                      <span className="px-2.5 py-0.5 bg-green-100/50 text-green-700 text-xs font-bold rounded-full">
                        ✓ Recommended
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {optionCount} option{optionCount > 1 ? "s" : ""}
                    </span>
                  </div>

                  {rawOptions.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 p-4">
                      {key === "train" &&
                        rawOptions.map((t: any, i: number) => (
                          <div
                            key={i}
                            className="flex flex-col gap-2 bg-background border border-border rounded-xl p-4"
                          >
                            <div>
                              {t.train_number && (
                                <p className="text-xs text-primary font-bold mb-0.5">
                                  {t.train_number}
                                </p>
                              )}
                              <p className="font-semibold text-foreground text-sm leading-snug">
                                {t.train_name}
                              </p>
                            </div>
                            {t.departure_time && (
                              <p className="text-xs text-muted-foreground">
                                🕐 Departs {t.departure_time}
                              </p>
                            )}
                            {t.train_fare > 0 && (
                              <div className="mt-auto pt-2 border-t border-border">
                                <p className="text-xl font-bold text-primary leading-tight">
                                  {plan.currency_symbol}
                                  {Number(t.train_fare).toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  fare
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      {key === "bus" &&
                        rawOptions.map((b: any, i: number) => (
                          <div
                            key={i}
                            className="flex flex-col gap-2 bg-background border border-border rounded-xl p-4"
                          >
                            <p className="font-semibold text-foreground text-sm leading-snug">
                              {b.bus_name || "Bus"}
                            </p>
                            {b.bus_number && (
                              <p className="text-xs text-primary font-medium">
                                {b.bus_number}
                              </p>
                            )}
                            {b.bus_time && (
                              <p className="text-xs text-muted-foreground">
                                🕐 Departs {b.bus_time}
                              </p>
                            )}
                            {b.bus_fare > 0 && (
                              <div className="mt-auto pt-2 border-t border-border">
                                <p className="text-xl font-bold text-primary">
                                  {plan.currency_symbol}
                                  {Number(b.bus_fare).toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  per person
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      {key === "flight" &&
                        rawOptions.map((f: any, i: number) => (
                          <div
                            key={i}
                            className="flex flex-col gap-2 bg-background border border-border rounded-xl p-4"
                          >
                            <div>
                              <p className="font-semibold text-foreground text-sm leading-snug">
                                {f.flight_name}
                              </p>
                              {f.flight_number && (
                                <p className="text-xs text-primary font-medium">
                                  {f.flight_number}
                                </p>
                              )}
                            </div>
                            {f.flight_time && (
                              <p className="text-xs text-muted-foreground">
                                🕐 Departs {f.flight_time}
                              </p>
                            )}
                            {f.flight_fare > 0 && (
                              <div className="mt-auto pt-2 border-t border-border">
                                <p className="text-xl font-bold text-primary">
                                  {plan.currency_symbol}
                                  {Number(f.flight_fare).toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  per person
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                  {rawOptions.length === 0 && aiOptions.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 p-4">
                      {aiOptions.map((opt: any, i: number) => (
                        <div
                          key={i}
                          className="flex flex-col gap-2 bg-background border border-border rounded-xl p-4"
                        >
                          <p className="font-semibold text-foreground text-sm leading-snug">
                            {opt.operator}
                          </p>
                          {opt.duration && (
                            <p className="text-xs text-muted-foreground">
                              ⏱ {opt.duration}
                            </p>
                          )}
                          <div className="mt-auto pt-2 border-t border-border">
                            {opt.estimated_cost_per_person > 0 && (
                              <>
                                <p className="text-xl font-bold text-primary leading-tight">
                                  {money(opt.estimated_cost_per_person, plan)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  per person
                                </p>
                              </>
                            )}
                            {opt.total_cost > 0 && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Total:{" "}
                                <strong className="text-foreground">
                                  {money(opt.total_cost, plan)}
                                </strong>
                              </p>
                            )}
                          </div>
                          {opt.booking_tips && (
                            <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-2 py-1.5 leading-relaxed">
                              💡 {opt.booking_tips}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {transport.airport_transfer?.recommended_mode &&
            transport.airport_transfer.recommended_mode !== "N/A" && (
              <div className="flex items-center justify-between px-5 py-4 bg-secondary/30 rounded-2xl border border-border">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Airport Transfer
                  </p>
                  <p className="text-base font-semibold text-foreground mt-0.5">
                    {transport.airport_transfer.recommended_mode}
                  </p>
                </div>
                {transport.airport_transfer.cost > 0 && (
                  <p className="text-xl font-bold text-primary">
                    {money(transport.airport_transfer.cost, plan)}
                  </p>
                )}
              </div>
            )}

          {transport.savings_tips && (
            <p className="text-sm text-muted-foreground bg-accent/5 rounded-xl p-4 border border-accent/10">
              💡 {transport.savings_tips}
            </p>
          )}
        </div>
      )}

      {/* Accommodation */}
      {accommodation && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground">Where to Stay</h3>
          {accommodation.options?.length > 0 ? (
            <div className="rounded-2xl border-2 border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 bg-secondary/30">
                <span className="text-xl">🏨</span>
                <span className="font-bold text-foreground">Accommodation</span>
                {accommodation.recommended_tier && (
                  <span className="px-2.5 py-0.5 bg-green-100/50 text-green-700 text-xs font-bold rounded-full">
                    ✓ {accommodation.recommended_tier} recommended
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {accommodation.options.length} option
                  {accommodation.options.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 p-4">
                {accommodation.options.map((opt: any, i: number) => (
                  <div
                    key={i}
                    className={`flex flex-col gap-2 rounded-xl p-4 border ${
                      opt.tier === accommodation.recommended_tier
                        ? "bg-primary/5 border-primary/30"
                        : "bg-background border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-foreground text-sm leading-snug">
                        {opt.type}
                      </p>
                      {opt.tier === accommodation.recommended_tier && (
                        <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-green-100/50 text-green-700">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {opt.tier}
                    </p>
                    {opt.location_notes && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {opt.location_notes}
                      </p>
                    )}
                    {opt.amenities?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {opt.amenities
                          .slice(0, 3)
                          .map((a: string, j: number) => (
                            <span
                              key={j}
                              className="text-xs bg-secondary/30 text-foreground rounded-full px-2 py-0.5"
                            >
                              {a}
                            </span>
                          ))}
                      </div>
                    )}
                    <div className="mt-auto pt-2 border-t border-border">
                      {opt.estimated_price_per_night > 0 && (
                        <>
                          <p className="text-xl font-bold text-primary leading-tight">
                            {money(opt.estimated_price_per_night, plan)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            per night
                          </p>
                        </>
                      )}
                      {opt.total_cost > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Total:{" "}
                          <strong className="text-foreground">
                            {money(opt.total_cost, plan)}
                          </strong>
                        </p>
                      )}
                      {opt.booking_platform && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          via{" "}
                          <strong className="text-foreground">
                            {opt.booking_platform}
                          </strong>
                        </p>
                      )}
                    </div>
                    {opt.pro_tip && (
                      <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-2 py-1.5 leading-relaxed">
                        💡 {opt.pro_tip}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm bg-secondary/30 rounded-xl p-4">
              No accommodation found within your budget.
            </p>
          )}
        </div>
      )}

      {/* Itinerary */}
      {itinerary.length > 0 && (
        <div className="space-y-5">
          <h3 className="text-lg font-bold text-foreground">
            Day-by-Day Itinerary
          </h3>
          <div className="space-y-4">
            {itinerary.map((day: any) => (
              <div
                key={day.day}
                className="bg-card rounded-2xl border border-border overflow-hidden"
              >
                <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-5 py-3 border-b border-border">
                  <h4 className="font-bold text-foreground">
                    Day {day.day}: {day.theme}
                  </h4>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">
                      🌅 Morning
                    </p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-foreground">
                          {day.morning?.activity}
                        </span>
                        <span className="font-semibold text-primary">
                          {money(day.morning?.cost, plan)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>🍳 Breakfast · {day.breakfast?.place_type}</span>
                        <span className="text-foreground font-medium">
                          {money(day.breakfast?.cost, plan)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">
                      ☀️ Afternoon
                    </p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-foreground">
                          {day.afternoon?.activity}
                        </span>
                        <span className="font-semibold text-primary">
                          {money(day.afternoon?.cost, plan)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>🍽️ Lunch · {day.lunch?.place_type}</span>
                        <span className="text-foreground font-medium">
                          {money(day.lunch?.cost, plan)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">
                      🌙 Evening
                    </p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-foreground">
                          {day.evening?.activity}
                        </span>
                        <span className="font-semibold text-primary">
                          {money(day.evening?.cost, plan)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>🍴 Dinner · {day.dinner?.place_type}</span>
                        <span className="text-foreground font-medium">
                          {money(day.dinner?.cost, plan)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Local transport: {money(day.local_transport, plan)}
                    </span>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        Day Total
                      </p>
                      <p className="text-lg font-bold text-primary">
                        {money(day.day_total, plan)}
                      </p>
                    </div>
                  </div>
                </div>

                {day.budget_tip && (
                  <div className="px-5 py-3 bg-accent/5 border-t border-border text-xs text-muted-foreground">
                    💡 {day.budget_tip}
                  </div>
                )}
              </div>
            ))}
          </div>

          {plan.itinerary?.money_saving_hacks?.length > 0 && (
            <div className="bg-accent/5 border border-accent/10 rounded-xl p-5">
              <p className="font-bold text-foreground mb-2">
                💰 Money-Saving Hacks
              </p>
              <ul className="space-y-1.5">
                {(plan.itinerary?.money_saving_hacks as string[]).map(
                  (h, i) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground flex gap-2"
                    >
                      <span className="text-accent">•</span>
                      {h}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}

          {plan.itinerary?.free_time_suggestions?.length > 0 && (
            <div className="bg-accent/5 border border-accent/10 rounded-xl p-5">
              <p className="font-bold text-foreground mb-2">
                🎯 Free Time Ideas
              </p>
              <ul className="space-y-1.5">
                {(plan.itinerary?.free_time_suggestions as string[]).map(
                  (s, i) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground flex gap-2"
                    >
                      <span className="text-accent">•</span>
                      {s}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
        {label}
      </span>
      <strong className="text-xl text-foreground leading-tight">{value}</strong>
    </div>
  );
}
