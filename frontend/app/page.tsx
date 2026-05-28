"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  MapPin,
  Calendar,
  Zap,
  AlertCircle,
  CheckCircle,
  PlaneTakeoff,
} from "lucide-react";

type TravelStyle = "budget-backpacker" | "mid-range" | "comfort-budget";

type Allocation = {
  transport: number;
  accommodation: number;
  food: number;
  activities: number;
  misc: number;
};

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
  raw_search_destination?: string | null;
  raw_search_transport?: string | null;
  raw_search_accommodation?: string | null;
  raw_search_itinerary?: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const defaultAllocation: Allocation = {
  transport: 35,
  accommodation: 35,
  food: 15,
  activities: 10,
  misc: 5,
};

export default function Home() {
  const [budget, setBudget] = useState(15000);
  const [origin, setOrigin] = useState("Pune");
  const [destination, setDestination] = useState("Mumbai");
  const [startDate, setStartDate] = useState("2026-05-29");
  const [endDate, setEndDate] = useState("2026-05-30");
  const [days, setDays] = useState(1);
  const [travelers, setTravelers] = useState(1);
  const [style, setStyle] = useState<TravelStyle>("budget-backpacker");
  const [interests, setInterests] = useState(
    "culture, street food, temples, markets",
  );
  const [allocation, setAllocation] = useState<Allocation>(defaultAllocation);
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const allocationTotal = useMemo(
    () => Object.values(allocation).reduce((sum, v) => sum + v, 0),
    [allocation],
  );

  function recalcDays(start: string, end: string) {
    const diff = Math.round(
      (new Date(end).getTime() - new Date(start).getTime()) / 86400000,
    );
    if (diff > 0) setDays(diff);
  }

  function handleStartDate(value: string) {
    setStartDate(value);
    if (endDate) recalcDays(value, endDate);
  }

  function handleEndDate(value: string) {
    setEndDate(value);
    if (startDate) recalcDays(startDate, value);
  }

  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPlan(null);

    if (allocationTotal > 100) {
      setError("Budget allocation must be 100% or less.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/travel-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_budget: budget,
          origin,
          destination,
          start_date: startDate,
          end_date: endDate,
          num_days: days,
          num_travelers: travelers,
          travel_style: style,
          interests: interests
            .split(",")
            .map((i) => i.trim())
            .filter(Boolean),
          budget_allocation: allocation,
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.detail || "Unable to generate a travel plan.");
      setPlan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function updateAllocation(key: keyof Allocation, value: number) {
    setAllocation((cur) => ({ ...cur, [key]: value }));
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── LEFT SIDEBAR: Input Form ───────────────────────────────── */}
      <aside className="w-[32%] min-w-[300px] max-w-[480px] border-r border-border bg-card flex flex-col overflow-hidden shrink-0">
        {/* Sidebar header */}
        <div className="px-6 py-5 border-b border-border shrink-0 bg-gradient-to-br from-card to-secondary/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">✈️</span>
            <p className="text-xs font-bold text-primary uppercase tracking-widest">
              Travel Planner
            </p>
          </div>
          <h1 className="text-2xl font-bold text-foreground leading-tight mb-2">
            Plan Your Adventure
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tell us where you want to go and we&apos;ll create a perfectly
            balanced budget plan.
          </p>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={submitPlan} className="p-6 space-y-5">
            {/* Budget & Travelers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">
                  Budget
                </label>
                <input
                  className="px-3 py-2.5 rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  type="number"
                  min="1"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  placeholder="15000"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">
                  Travelers
                </label>
                <input
                  className="px-3 py-2.5 rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  type="number"
                  min="1"
                  value={travelers}
                  onChange={(e) => setTravelers(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Origin */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MapPin size={16} className="text-primary" /> Origin
              </label>
              <input
                className="px-3 py-2.5 rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Pune"
              />
            </div>

            {/* Destination */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MapPin size={16} className="text-primary" /> Destination
              </label>
              <input
                className="px-3 py-2.5 rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Leave blank for AI recommendation"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Calendar size={16} className="text-primary" /> Start
                </label>
                <input
                  className="px-3 py-2.5 rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Calendar size={16} className="text-primary" /> End
                </label>
                <input
                  className="px-3 py-2.5 rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Days (auto) */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground">
                Duration
              </label>
              <div className="px-3 py-2.5 rounded-lg border border-border bg-muted/50 text-foreground flex items-center">
                <span className="font-medium">
                  {days} day{days !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Travel style */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap size={16} className="text-primary" /> Travel Style
              </label>
              <select
                className="px-3 py-2.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                value={style}
                onChange={(e) => setStyle(e.target.value as TravelStyle)}
              >
                <option value="budget-backpacker">Budget Backpacker</option>
                <option value="mid-range">Mid Range</option>
                <option value="comfort-budget">Comfort Budget</option>
              </select>
            </div>

            {/* Interests */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground">
                Interests
              </label>
              <input
                className="px-3 py-2.5 rounded-lg border border-border bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="culture, temples, street food..."
              />
              <span className="text-xs text-muted-foreground">
                Comma-separated
              </span>
            </div>

            {/* Budget allocation */}
            <div className="border-t border-border pt-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-foreground uppercase tracking-wider">
                  Budget Allocation
                </span>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${allocationTotal > 100 ? "bg-destructive/10 text-destructive" : "bg-green-100/50 text-green-700"}`}
                >
                  {allocationTotal}%
                </span>
              </div>
              <div className="space-y-4">
                {(Object.keys(allocation) as (keyof Allocation)[]).map(
                  (key) => (
                    <div key={key} className="flex flex-col gap-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground font-medium capitalize">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="font-semibold text-primary">
                          {allocation[key]}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={allocation[key]}
                        onChange={(e) =>
                          updateAllocation(key, Number(e.target.value))
                        }
                        className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                  ),
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-3 bg-destructive/5 border border-destructive/20 text-destructive rounded-lg text-sm">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  <span>Planning your trip...</span>
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Generate Plan
                </>
              )}
            </button>
          </form>
        </div>
      </aside>

      {/* ── RIGHT PANEL: Results ───────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-background">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <div className="w-12 h-12 border-4 border-border border-t-primary rounded-full animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-foreground text-lg">
                Planning your adventure...
              </p>
              <p className="text-sm mt-2 text-muted-foreground">
                This may take a moment
              </p>
            </div>
          </div>
        ) : plan ? (
          <div className="p-8">
            <PlanResult plan={plan} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground px-8">
            <PlaneTakeoff size={60} className="text-border/50" />
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Your travel plan awaits
              </h2>
              <p className="text-base text-muted-foreground max-w-sm">
                Fill in your travel details on the left and click "Generate
                Plan" to get started.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function money(value: number, plan: TravelPlan) {
  return `${plan.currency_symbol}${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${plan.currency}`.trim();
}

function PlanResult({ plan }: { plan: TravelPlan }) {
  const summary = plan.budget_summary?.budget_summary;
  const itinerary: any[] = plan.itinerary?.itinerary || [];
  const transport = plan.transport_plan;
  const accommodation = plan.accommodation_plan;
  const research = plan.destination_research;

  const statusClass =
    summary?.status === "OVER_BUDGET"
      ? "bad"
      : summary?.status === "TIGHT_FIT"
        ? "review"
        : "ready";

  return (
    <section className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col gap-3 mb-8">
        <div className="flex items-baseline gap-3">
          <h2 className="text-4xl font-bold text-foreground">
            {plan.destination || "Recommended destination"}
          </h2>
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
              plan.final_plan_ready
                ? "bg-green-100/50 text-green-700"
                : summary?.status === "TIGHT_FIT"
                  ? "bg-yellow-100/50 text-yellow-700"
                  : "bg-destructive/10 text-destructive"
            }`}
          >
            {plan.final_plan_ready ? (
              <>
                <CheckCircle size={16} /> Ready to Go
              </>
            ) : summary?.status === "TIGHT_FIT" ? (
              <>
                <AlertCircle size={16} /> Tight Fit
              </>
            ) : (
              <>
                <AlertCircle size={16} /> Review Budget
              </>
            )}
          </div>
        </div>
        <p className="text-muted-foreground">
          🎉 Your AI-generated travel plan
        </p>
      </div>

      {/* Budget Summary */}
      {summary && (
        <div className="bg-card rounded-2xl border border-border p-8">
          <h3 className="text-xl font-bold text-foreground mb-6">
            Budget Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
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

          <p className="text-muted-foreground mb-6 leading-relaxed">
            {summary.verdict}
          </p>

          {summary.breakdown && (
            <div className="mb-6">
              <p className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">
                Cost Breakdown
              </p>
              <div className="space-y-3">
                {Object.entries(
                  summary.breakdown as Record<string, number>,
                ).map(([k, v]) => (
                  <div className="flex justify-between items-center" key={k}>
                    <span className="text-muted-foreground capitalize">
                      {k.replace(/_/g, " ")}
                    </span>
                    <strong className="text-foreground">
                      {money(v, plan)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.top_savings_opportunities?.length > 0 && (
            <div className="bg-accent/5 rounded-xl p-4 border border-accent/10">
              <p className="text-sm font-bold text-foreground mb-3">
                💰 Savings Opportunities
              </p>
              <ul className="space-y-2">
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
          <h3 className="text-xl font-bold text-foreground">
            Destination Options
          </h3>
          <p className="text-muted-foreground text-sm">
            AI-recommended based on your budget and interests
          </p>
          <div className="grid gap-4">
            {research?.destinations.map((d: any, i: number) => (
              <div
                className={`bg-card rounded-2xl border-2 p-6 transition ${
                  d.city === plan.destination?.split(",")[0]
                    ? "border-primary/30 bg-primary/5"
                    : "border-border"
                }`}
                key={i}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h4 className="font-bold text-foreground">
                      {d.city}, {d.country}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
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
                  <p className="text-xs text-muted-foreground mt-3 italic">
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
          <h3 className="text-xl font-bold text-foreground">Getting Around</h3>
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
              const rawByMode: Record<string, any[]> = {
                flight: transport.available_options?.flights || [],
                train: transport.available_options?.trains || [],
                bus: transport.available_options?.buses || [],
              };
              const rawOptions: any[] = rawByMode[key] || [];
              if (!aiOptions.length && !rawOptions.length) return null;

              const isRecommended = transport.intercity?.recommended_mode
                ?.toLowerCase()
                .includes(key);
              const optionCount = aiOptions.length || rawOptions.length;

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
                    className={`flex items-center gap-3 px-6 py-4 ${
                      isRecommended ? "bg-primary/10" : "bg-secondary/30"
                    }`}
                  >
                    <span className="text-2xl">{icon}</span>
                    <span className="text-lg font-bold text-foreground">
                      {label}
                    </span>
                    {isRecommended && (
                      <span className="px-3 py-1 bg-green-100/50 text-green-700 text-xs font-bold rounded-full">
                        ✓ Recommended
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {optionCount} option{optionCount > 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* AI-processed options — 3-column grid */}
                  {aiOptions.length > 0 && (
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

                  {/* Fallback: raw parsed options — 3-column grid */}
                  {aiOptions.length === 0 && rawOptions.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 p-4">
                      {key === "train" &&
                        rawOptions.map((t: any, i: number) => (
                          <div
                            key={i}
                            className="flex flex-col gap-2 bg-background border border-border rounded-xl p-4"
                          >
                            <p className="font-semibold text-foreground text-sm leading-snug">
                              {t.train_number} · {t.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t.departure} → {t.arrival}
                            </p>
                            {t.classes?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {t.classes.map((cls: any, j: number) => (
                                  <span
                                    key={j}
                                    className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full"
                                  >
                                    {cls.class_name}: {plan.currency_symbol}
                                    {Number(cls.price).toLocaleString()}
                                  </span>
                                ))}
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
                              {b.operator}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {b.departure} → {b.arrival}
                              {b.duration && (
                                <span className="ml-1.5 bg-secondary px-1.5 py-0.5 rounded">
                                  {b.duration}
                                </span>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              {b.bus_type && <span>{b.bus_type}</span>}
                              {b.seats_available > 0 && (
                                <span>{b.seats_available} seats</span>
                              )}
                              {b.rating && <span>⭐ {b.rating}</span>}
                            </div>
                            {b.price > 0 && (
                              <p className="text-xl font-bold text-primary mt-auto pt-2 border-t border-border">
                                {plan.currency_symbol}
                                {Number(b.price).toLocaleString()}
                              </p>
                            )}
                          </div>
                        ))}
                      {key === "flight" &&
                        rawOptions.map((f: any, i: number) => (
                          <div
                            key={i}
                            className="flex flex-col gap-2 bg-background border border-border rounded-xl p-4"
                          >
                            <p className="font-semibold text-foreground text-sm leading-snug">
                              {f.airline}
                              {f.flight_number ? ` · ${f.flight_number}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {f.departure} → {f.arrival}
                              {f.duration && (
                                <span className="ml-1.5 bg-secondary px-1.5 py-0.5 rounded">
                                  {f.duration}
                                </span>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              {f.seat_class && <span>{f.seat_class}</span>}
                              {f.seats_available > 0 && (
                                <span>{f.seats_available} seats</span>
                              )}
                            </div>
                            {f.price > 0 && (
                              <p className="text-xl font-bold text-primary mt-auto pt-2 border-t border-border">
                                {plan.currency_symbol}
                                {Number(f.price).toLocaleString()}
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
              <div className="flex items-center justify-between px-6 py-4 bg-secondary/30 rounded-2xl border border-border">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Airport Transfer
                  </p>
                  <p className="text-base font-semibold text-foreground mt-1">
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
          <h3 className="text-xl font-bold text-foreground">Where to Stay</h3>
          {accommodation.options?.length > 0 ? (
            <div className="rounded-2xl border-2 border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 bg-secondary/30">
                <span className="text-2xl">🏨</span>
                <span className="text-lg font-bold text-foreground">
                  Accommodation
                </span>
                {accommodation.recommended_tier && (
                  <span className="px-3 py-1 bg-green-100/50 text-green-700 text-xs font-bold rounded-full">
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
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-foreground">
            Day-by-Day Itinerary
          </h3>
          <div className="space-y-5">
            {itinerary.map((day: any) => (
              <div
                key={day.day}
                className="bg-card rounded-2xl border border-border overflow-hidden"
              >
                <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-6 py-4 border-b border-border">
                  <h4 className="font-bold text-foreground text-lg">
                    Day {day.day}: {day.theme}
                  </h4>
                </div>

                <div className="p-6 space-y-5">
                  <div>
                    <p className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">
                      🌅 Morning
                    </p>
                    <div className="space-y-2 text-sm">
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

                  <div className="border-t border-border pt-5">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">
                      ☀️ Afternoon
                    </p>
                    <div className="space-y-2 text-sm">
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

                  <div className="border-t border-border pt-5">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">
                      🌙 Evening
                    </p>
                    <div className="space-y-2 text-sm">
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

                  <div className="border-t border-border pt-5 flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Local transport: {money(day.local_transport, plan)}
                    </span>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">
                        Day Total
                      </p>
                      <p className="text-lg font-bold text-primary">
                        {money(day.day_total, plan)}
                      </p>
                    </div>
                  </div>
                </div>

                {day.budget_tip && (
                  <div className="px-6 py-4 bg-accent/5 border-t border-border text-xs text-muted-foreground">
                    💡 {day.budget_tip}
                  </div>
                )}
              </div>
            ))}
          </div>

          {plan.itinerary?.money_saving_hacks?.length > 0 && (
            <div className="bg-accent/5 border border-accent/10 rounded-xl p-6">
              <p className="font-bold text-foreground mb-3">
                💰 Money-Saving Hacks
              </p>
              <ul className="space-y-2">
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
            <div className="bg-accent/5 border border-accent/10 rounded-xl p-6">
              <p className="font-bold text-foreground mb-3">
                🎯 Free Time Ideas
              </p>
              <ul className="space-y-2">
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
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
        {label}
      </span>
      <strong className="text-2xl text-foreground leading-tight">
        {value}
      </strong>
    </div>
  );
}
