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
  const [budget, setBudget] = useState(1000);
  const [origin, setOrigin] = useState("pune");
  const [destination, setDestination] = useState("mumbai");
  const [startDate, setStartDate] = useState("2026-05-26");
  const [endDate, setEndDate] = useState("2026-05-27");
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
      <aside className="w-[30%] min-w-[280px] max-w-[420px] border-r border-border bg-card flex flex-col overflow-hidden shrink-0">
        {/* Sidebar header */}
        <div className="px-5 py-4 border-b border-border shrink-0">
          <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
            ✨ AI Travel Planner
          </p>
          <h1 className="text-lg font-bold text-foreground leading-tight mb-1">
            Plan Your Trip
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Fill in your details and generate a complete budget-aware travel
            plan.
          </p>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={submitPlan} className="p-5 space-y-4">
            {/* Budget & Travelers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Total Budget
                </label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  placeholder="1000"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <span>Travelers</span>
                </label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  value={travelers}
                  onChange={(e) => setTravelers(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Origin */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <MapPin size={12} className="text-primary" /> Origin
              </label>
              <input
                className="form-input"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Pune, India"
              />
            </div>

            {/* Destination */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <MapPin size={12} className="text-primary" /> Destination
              </label>
              <input
                className="form-input"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Leave blank for AI recommendation"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Calendar size={12} className="text-primary" /> Start
                </label>
                <input
                  className="form-input"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Calendar size={12} className="text-primary" /> End
                </label>
                <input
                  className="form-input"
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Days (auto) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                Duration
              </label>
              <input
                className="form-input opacity-60 cursor-not-allowed"
                type="number"
                value={days}
                readOnly
              />
            </div>

            {/* Travel style */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Zap size={12} className="text-primary" /> Travel Style
              </label>
              <select
                className="form-input"
                value={style}
                onChange={(e) => setStyle(e.target.value as TravelStyle)}
              >
                <option value="budget-backpacker">Budget Backpacker</option>
                <option value="mid-range">Mid Range</option>
                <option value="comfort-budget">Comfort Budget</option>
              </select>
            </div>

            {/* Interests */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                Interests
              </label>
              <input
                className="form-input"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="e.g. culture, street food, temples"
              />
              <span className="text-xs text-muted-foreground">
                Comma-separated
              </span>
            </div>

            {/* Budget allocation */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Budget Split
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${allocationTotal > 100 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                >
                  {allocationTotal}%
                </span>
              </div>
              <div className="space-y-3">
                {(Object.keys(allocation) as (keyof Allocation)[]).map(
                  (key) => (
                    <div key={key} className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground capitalize">
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
                        className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                  ),
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Planning...
                </>
              ) : (
                <>
                  <Zap size={15} />
                  Generate Travel Plan
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
            <div className="w-10 h-10 border-4 border-border border-t-primary rounded-full animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-foreground">
                Planning your adventure...
              </p>
              <p className="text-sm mt-1">This may take a moment</p>
            </div>
          </div>
        ) : plan ? (
          <div className="p-6">
            <PlanResult plan={plan} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground px-8">
            <PlaneTakeoff size={52} className="text-border" />
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground mb-2">
                Your travel plan will appear here
              </h2>
              <p className="text-sm max-w-xs">
                Fill in your travel details on the left and click "Generate
                Travel Plan" to get started.
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
    <section className="results">
      <div className="resultHeader">
        <div>
          <p className="eyebrow">🎉 Your Generated Plan</p>
          <h2>{plan.destination || "Recommended destination"}</h2>
        </div>
        <div className={`status ${statusClass}`}>
          {plan.final_plan_ready ? (
            <span className="flex items-center gap-2">
              <CheckCircle size={16} /> Ready to Go
            </span>
          ) : summary?.status === "TIGHT_FIT" ? (
            <span className="flex items-center gap-2">
              <AlertCircle size={16} /> Tight Fit
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <AlertCircle size={16} /> Review Budget
            </span>
          )}
        </div>
      </div>

      {/* Budget Summary */}
      {summary && (
        <div className="panel p-6">
          <h3>Budget Summary</h3>
          <div className="metrics">
            <Metric
              label="Your Budget"
              value={money(summary.total_budget, plan)}
            />
            <Metric
              label="Estimated Total"
              value={money(summary.total_estimated_cost, plan)}
            />
            <Metric
              label="Remaining"
              value={money(summary.remaining_buffer, plan)}
            />
            <Metric label="Status" value={summary.status.replace(/_/g, " ")} />
          </div>
          <p className="verdict">{summary.verdict}</p>

          {summary.breakdown && (
            <div className="breakdown">
              <p className="section-label">Cost Breakdown</p>
              {Object.entries(summary.breakdown as Record<string, number>).map(
                ([k, v]) => (
                  <div className="breakdown-row" key={k}>
                    <span>{k.replace(/_/g, " ")}</span>
                    <strong>{money(v, plan)}</strong>
                  </div>
                ),
              )}
            </div>
          )}

          {summary.top_savings_opportunities?.length > 0 && (
            <div className="tips-box">
              <p className="section-label">💰 Savings Opportunities</p>
              <ul className="tip-list">
                {summary.top_savings_opportunities.map(
                  (tip: string, i: number) => (
                    <li key={i}>{tip}</li>
                  ),
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Destination Research */}
      {research?.destinations?.length > 0 && (
        <div className="panel p-6">
          <h3>Destination Options</h3>
          <p className="text-muted-foreground text-sm mb-4">
            AI-recommended based on your budget
          </p>
          <div className="dest-grid">
            {research?.destinations.map((d: any, i: number) => (
              <div
                className={`dest-card ${d.city === plan.destination?.split(",")[0] ? "dest-card--selected" : ""}`}
                key={i}
              >
                <div className="dest-card-header">
                  <strong>
                    {d.city}, {d.country}
                  </strong>
                  <span
                    className={`confidence confidence--${d.confidence?.toLowerCase()}`}
                  >
                    {d.confidence}
                  </span>
                </div>
                <p>{d.why_fits_budget}</p>
                <div className="dest-meta">
                  <span>~{money(d.daily_cost_estimate, plan)}/day</span>
                  <span>{d.best_travel_months}</span>
                </div>
                {d.visa_notes && <p className="visa-note">{d.visa_notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transport */}
      {transport && (
        <div className="panel p-6">
          <h3>Getting Around</h3>

          {/* Recommended intercity option */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                Recommended
              </span>
              <span className="text-lg font-semibold text-primary capitalize">
                {transport.intercity?.mode}
              </span>
            </div>
            <div className="kv-list">
              <div>
                <span>Cost per person</span>
                <strong>
                  {money(transport.intercity?.estimated_cost_per_person, plan)}
                </strong>
              </div>
              <div>
                <span>Total cost</span>
                <strong>{money(transport.intercity?.total_cost, plan)}</strong>
              </div>
            </div>
            <p className="muted-text mt-1">
              {transport.intercity?.booking_tips}
            </p>
          </div>

          {/* All available options grouped by type */}
          {transport.available_options && (
            <div className="mt-2">
              <p className="section-label">All Available Options</p>

              {/* Trains */}
              {transport.available_options.trains?.length > 0 && (
                <div className="mb-5">
                  <p className="text-sm font-bold text-foreground mb-2">
                    🚂 Trains
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {transport.available_options.trains.map(
                      (t: any, i: number) => (
                        <div
                          key={i}
                          className="p-3 bg-secondary border border-border rounded-xl"
                        >
                          <p className="text-sm font-semibold text-foreground mb-1">
                            {t.train_number} · {t.name}
                          </p>
                          <p className="text-sm text-muted-foreground mb-2">
                            {t.departure} → {t.arrival}
                          </p>
                          {t.classes?.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {t.classes.map((cls: any, j: number) => (
                                <span
                                  key={j}
                                  className="px-2.5 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full"
                                >
                                  {cls.class_name}: {plan.currency_symbol}
                                  {Number(cls.price).toLocaleString()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Buses */}
              {transport.available_options.buses?.length > 0 && (
                <div className="mb-5">
                  <p className="text-sm font-bold text-foreground mb-2">
                    🚌 Buses
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {transport.available_options.buses.map(
                      (b: any, i: number) => (
                        <div
                          key={i}
                          className="p-3 bg-secondary border border-border rounded-xl"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-sm font-semibold text-foreground">
                              {b.operator}
                            </span>
                            <span className="text-sm font-bold text-primary whitespace-nowrap">
                              {plan.currency_symbol}
                              {Number(b.price).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1.5">
                            {b.departure} → {b.arrival}
                            {b.duration && (
                              <span className="ml-2 text-xs bg-background px-1.5 py-0.5 rounded">
                                {b.duration}
                              </span>
                            )}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {b.bus_type && <span>{b.bus_type}</span>}
                            {b.seats_available > 0 && (
                              <span>{b.seats_available} seats left</span>
                            )}
                            {b.rating && <span>⭐ {b.rating}</span>}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Flights */}
              {transport.available_options.flights?.length > 0 && (
                <div className="mb-5">
                  <p className="text-sm font-bold text-foreground mb-2">
                    ✈️ Flights
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {transport.available_options.flights.map(
                      (f: any, i: number) => (
                        <div
                          key={i}
                          className="p-3 bg-secondary border border-border rounded-xl"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-sm font-semibold text-foreground">
                              {f.airline}
                              {f.flight_number ? ` · ${f.flight_number}` : ""}
                            </span>
                            <span className="text-sm font-bold text-primary whitespace-nowrap">
                              {plan.currency_symbol}
                              {Number(f.price).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1.5">
                            {f.departure} → {f.arrival}
                            {f.duration && (
                              <span className="ml-2 text-xs bg-background px-1.5 py-0.5 rounded">
                                {f.duration}
                              </span>
                            )}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {f.seat_class && <span>{f.seat_class}</span>}
                            {f.seats_available > 0 && (
                              <span>{f.seats_available} seats left</span>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Local transport & airport transfer */}
          <div className="grid two" style={{ marginTop: 20 }}>
            {/* <div>
              <p className="section-label">Local Transport</p>
              <div className="kv-list">
                <div>
                  <span>Daily per person</span>
                  <strong>{money(transport.local_transport?.daily_cost_per_person, plan)}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>{money(transport.local_transport?.total_local_transport, plan)}</strong>
                </div>
              </div>
              {transport.local_transport?.recommended_options?.length > 0 && (
                <ul className="option-chips">
                  {transport.local_transport.recommended_options.map((opt: string, i: number) => (
                    <li key={i}>{opt}</li>
                  ))}
                </ul>
              )}
            </div> */}
            <div>
              <p className="section-label">Airport Transfer</p>
              <div className="kv-list">
                <div>
                  <span>Mode</span>
                  <strong>
                    {transport.airport_transfer?.recommended_mode}
                  </strong>
                </div>
                <div>
                  <span>Cost</span>
                  <strong>
                    {money(transport.airport_transfer?.cost, plan)}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {transport.savings_tips && (
            <p className="savings-tip">💡 {transport.savings_tips}</p>
          )}
        </div>
      )}

      {/* Accommodation */}
      {accommodation && (
        <div className="panel p-6">
          <h3>Where to Stay</h3>
          {accommodation.options?.length > 0 ? (
            <div className="accom-grid">
              {accommodation.options.map((opt: any, i: number) => (
                <div
                  className={`accom-card ${opt.tier === accommodation.recommended_tier ? "accom-card--recommended" : ""}`}
                  key={i}
                >
                  <div className="accom-card-header">
                    <span
                      className={`tier-badge tier-badge--${opt.tier?.replace(" ", "_").toLowerCase()}`}
                    >
                      {opt.tier}
                    </span>
                    {opt.tier === accommodation.recommended_tier && (
                      <span className="recommended-tag">Recommended</span>
                    )}
                  </div>
                  <p className="accom-type">{opt.type}</p>
                  <div className="kv-list">
                    <div>
                      <span>Per night</span>
                      <strong>
                        {money(opt.estimated_price_per_night, plan)}
                      </strong>
                    </div>
                    <div>
                      <span>Total stay</span>
                      <strong>{money(opt.total_cost, plan)}</strong>
                    </div>
                    <div>
                      <span>Book via</span>
                      <strong>{opt.booking_platform}</strong>
                    </div>
                  </div>
                  <p className="muted-text">{opt.location_notes}</p>
                  {opt.amenities?.length > 0 && (
                    <ul className="option-chips">
                      {opt.amenities.map((a: string, j: number) => (
                        <li key={j}>{a}</li>
                      ))}
                    </ul>
                  )}
                  {opt.pro_tip && (
                    <p className="savings-tip">💡 {opt.pro_tip}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No accommodation found within your budget.
            </p>
          )}
        </div>
      )}

      {/* Itinerary */}
      {itinerary.length > 0 && (
        <div className="panel p-6">
          <h3>Day-by-Day Itinerary</h3>
          <div className="days">
            {itinerary.map((day: any) => (
              <article className="day" key={day.day}>
                <h4>
                  Day {day.day}: {day.theme}
                </h4>

                <div className="day-section">
                  <p className="section-label">🌅 Morning</p>
                  <p>
                    {day.morning?.activity}{" "}
                    <span className="cost-inline">
                      {money(day.morning?.cost, plan)}
                    </span>
                  </p>
                  <p className="meal-row">
                    🍳 Breakfast · {day.breakfast?.place_type}{" "}
                    <span className="cost-inline">
                      {money(day.breakfast?.cost, plan)}
                    </span>
                  </p>
                </div>

                <div className="day-section">
                  <p className="section-label">☀️ Afternoon</p>
                  <p>
                    {day.afternoon?.activity}{" "}
                    <span className="cost-inline">
                      {money(day.afternoon?.cost, plan)}
                    </span>
                  </p>
                  <p className="meal-row">
                    🍽️ Lunch · {day.lunch?.place_type}{" "}
                    <span className="cost-inline">
                      {money(day.lunch?.cost, plan)}
                    </span>
                  </p>
                </div>

                <div className="day-section">
                  <p className="section-label">🌙 Evening</p>
                  <p>
                    {day.evening?.activity}{" "}
                    <span className="cost-inline">
                      {money(day.evening?.cost, plan)}
                    </span>
                  </p>
                  <p className="meal-row">
                    🍴 Dinner · {day.dinner?.place_type}{" "}
                    <span className="cost-inline">
                      {money(day.dinner?.cost, plan)}
                    </span>
                  </p>
                </div>

                <div className="day-footer">
                  <span>
                    Local transport: {money(day.local_transport, plan)}
                  </span>
                  <strong>Day total: {money(day.day_total, plan)}</strong>
                </div>

                {day.budget_tip && (
                  <p className="savings-tip">💡 {day.budget_tip}</p>
                )}
              </article>
            ))}
          </div>

          {plan.itinerary?.money_saving_hacks?.length > 0 && (
            <div className="tips-box" style={{ marginTop: 20 }}>
              <p className="section-label">💰 Money-Saving Hacks</p>
              <ul className="tip-list">
                {(plan.itinerary?.money_saving_hacks as string[]).map(
                  (h, i) => (
                    <li key={i}>{h}</li>
                  ),
                )}
              </ul>
            </div>
          )}

          {plan.itinerary?.free_time_suggestions?.length > 0 && (
            <div className="tips-box" style={{ marginTop: 12 }}>
              <p className="section-label">🎯 Free Time Ideas</p>
              <ul className="tip-list">
                {(plan.itinerary?.free_time_suggestions as string[]).map(
                  (s, i) => (
                    <li key={i}>{s}</li>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
