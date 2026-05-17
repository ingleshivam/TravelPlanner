"use client";

import { FormEvent, useMemo, useState } from "react";

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
  const [budget, setBudget] = useState(15000);
  const [origin, setOrigin] = useState("Pune, India");
  const [destination, setDestination] = useState("Mumbai, India");
  const [startDate, setStartDate] = useState("2026-09-10");
  const [endDate, setEndDate] = useState("2026-09-12");
  const [days, setDays] = useState(2);
  const [travelers, setTravelers] = useState(1);
  const [style, setStyle] = useState<TravelStyle>("budget-backpacker");
  const [interests, setInterests] = useState("culture, street food, temples, markets");
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
      if (!response.ok) throw new Error(data.detail || "Unable to generate a travel plan.");
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
    <main className="shell">
      <section className="planner">
        <div className="intro">
          <p className="eyebrow">AI Travel Planner</p>
          <h1>Build a budget-aware trip plan</h1>
          <p>
            Configure the route, dates, style, interests, and exactly how the
            budget should be split.
          </p>
        </div>

        <form className="panel form" onSubmit={submitPlan}>
          <div className="grid two">
            <label>
              Total budget
              <input
                type="number"
                min="1"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
              />
            </label>
            <label>
              Travelers
              <input
                type="number"
                min="1"
                value={travelers}
                onChange={(e) => setTravelers(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="grid two">
            <label>
              Origin
              <input value={origin} onChange={(e) => setOrigin(e.target.value)} />
            </label>
            <label>
              Destination <span className="muted-label">(leave blank to let AI pick)</span>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Tokyo, Japan"
              />
            </label>
          </div>

          <div className="grid three">
            <label>
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDate(e.target.value)}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDate(e.target.value)}
              />
            </label>
            <label>
              Days (auto)
              <input type="number" min="1" value={days} readOnly className="readonly" />
            </label>
          </div>

          <label>
            Travel style
            <select value={style} onChange={(e) => setStyle(e.target.value as TravelStyle)}>
              <option value="budget-backpacker">Budget backpacker</option>
              <option value="mid-range">Mid range</option>
              <option value="comfort-budget">Comfort budget</option>
            </select>
          </label>

          <label>
            Interests (comma-separated)
            <input value={interests} onChange={(e) => setInterests(e.target.value)} />
          </label>

          <div className="allocationHeader">
            <h2>Budget allocation</h2>
            <span className={allocationTotal > 100 ? "bad" : "good"}>{allocationTotal}%</span>
          </div>

          <div className="sliders">
            {(Object.keys(allocation) as (keyof Allocation)[]).map((key) => (
              <label className="slider" key={key}>
                <span>
                  {key.replace("_", " ")}
                  <strong>{allocation[key]}%</strong>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={allocation[key]}
                  onChange={(e) => updateAllocation(key, Number(e.target.value))}
                />
              </label>
            ))}
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Planning your trip..." : "Generate plan"}
          </button>
        </form>
      </section>

      {plan && <PlanResult plan={plan} />}
    </main>
  );
}

// ── Result components ─────────────────────────────────────────────────────────

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
          <p className="eyebrow">Generated plan</p>
          <h2>{plan.destination || "Recommended destination"}</h2>
        </div>
        <span className={`status ${statusClass}`}>
          {plan.final_plan_ready ? "Ready" : summary?.status === "TIGHT_FIT" ? "Tight fit" : "Review budget"}
        </span>
      </div>

      {/* Budget summary */}
      {summary && (
        <div className="panel">
          <h3>Budget summary</h3>
          <div className="metrics">
            <Metric label="Your budget" value={money(summary.total_budget, plan)} />
            <Metric label="Estimated total" value={money(summary.total_estimated_cost, plan)} />
            <Metric label="Remaining" value={money(summary.remaining_buffer, plan)} />
            <Metric label="Status" value={summary.status.replace("_", " ")} />
          </div>
          <p className="verdict">{summary.verdict}</p>

          {summary.breakdown && (
            <div className="breakdown">
              <p className="section-label">Cost breakdown</p>
              {Object.entries(summary.breakdown as Record<string, number>).map(([k, v]) => (
                <div className="breakdown-row" key={k}>
                  <span>{k.replace(/_/g, " ")}</span>
                  <strong>{money(v, plan)}</strong>
                </div>
              ))}
            </div>
          )}

          {summary.top_savings_opportunities?.length > 0 && (
            <div className="tips-box">
              <p className="section-label">Savings opportunities</p>
              <ul className="tip-list">
                {summary.top_savings_opportunities.map((tip: string, i: number) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Destination research */}
      {research?.destinations?.length > 0 && (
        <div className="panel">
          <h3>Destination options considered</h3>
          <div className="dest-grid">
            {research.destinations.map((d: any, i: number) => (
              <div
                className={`dest-card ${d.city === plan.destination?.split(",")[0] ? "dest-card--selected" : ""}`}
                key={i}
              >
                <div className="dest-card-header">
                  <strong>{d.city}, {d.country}</strong>
                  <span className={`confidence confidence--${d.confidence}`}>{d.confidence}</span>
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
        <div className="panel">
          <h3>Transport</h3>
          <div className="grid two">
            <div>
              <p className="section-label">Intercity</p>
              <p className="transport-mode">{transport.intercity?.mode}</p>
              <div className="kv-list">
                <div><span>Cost per person</span><strong>{money(transport.intercity?.estimated_cost_per_person, plan)}</strong></div>
                <div><span>Total cost</span><strong>{money(transport.intercity?.total_cost, plan)}</strong></div>
              </div>
              <p className="muted-text">{transport.intercity?.booking_tips}</p>
              {transport.intercity?.budget_airlines_or_options?.length > 0 && (
                <ul className="option-chips">
                  {transport.intercity.budget_airlines_or_options.map((opt: string, i: number) => (
                    <li key={i}>{opt}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="section-label">Local transport</p>
              <div className="kv-list">
                <div><span>Daily per person</span><strong>{money(transport.local_transport?.daily_cost_per_person, plan)}</strong></div>
                <div><span>Total</span><strong>{money(transport.local_transport?.total_local_transport, plan)}</strong></div>
              </div>
              {transport.local_transport?.recommended_options?.length > 0 && (
                <ul className="option-chips">
                  {transport.local_transport.recommended_options.map((opt: string, i: number) => (
                    <li key={i}>{opt}</li>
                  ))}
                </ul>
              )}
              <p className="section-label" style={{ marginTop: 16 }}>Airport transfer</p>
              <div className="kv-list">
                <div><span>Mode</span><strong>{transport.airport_transfer?.recommended_mode}</strong></div>
                <div><span>Cost</span><strong>{money(transport.airport_transfer?.cost, plan)}</strong></div>
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
        <div className="panel">
          <h3>Accommodation</h3>
          {accommodation.options?.length > 0 ? (
            <div className="accom-grid">
              {accommodation.options.map((opt: any, i: number) => (
                <div
                  className={`accom-card ${opt.tier === accommodation.recommended_tier ? "accom-card--recommended" : ""}`}
                  key={i}
                >
                  <div className="accom-card-header">
                    <span className={`tier-badge tier-badge--${opt.tier}`}>
                      {opt.tier.replace("_", " ")}
                    </span>
                    {opt.tier === accommodation.recommended_tier && (
                      <span className="recommended-tag">Recommended</span>
                    )}
                  </div>
                  <p className="accom-type">{opt.type}</p>
                  <div className="kv-list">
                    <div><span>Per night</span><strong>{money(opt.estimated_price_per_night, plan)}</strong></div>
                    <div><span>Total stay</span><strong>{money(opt.total_cost, plan)}</strong></div>
                    <div><span>Book via</span><strong>{opt.booking_platform}</strong></div>
                  </div>
                  <p className="muted-text">{opt.location_notes}</p>
                  {opt.amenities?.length > 0 && (
                    <ul className="option-chips">
                      {opt.amenities.map((a: string, j: number) => <li key={j}>{a}</li>)}
                    </ul>
                  )}
                  {opt.pro_tip && <p className="savings-tip">💡 {opt.pro_tip}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p>No accommodation found within the allocated budget.</p>
          )}
        </div>
      )}

      {/* Itinerary */}
      {itinerary.length > 0 && (
        <div className="panel">
          <h3>Day-by-day itinerary</h3>
          <div className="days">
            {itinerary.map((day: any) => (
              <article className="day" key={day.day}>
                <h4>Day {day.day}: {day.theme}</h4>

                <div className="day-section">
                  <p className="section-label">Morning</p>
                  <p>{day.morning?.activity} <span className="cost-inline">{money(day.morning?.cost, plan)}</span></p>
                  <p className="meal-row">Breakfast · {day.breakfast?.place_type} <span className="cost-inline">{money(day.breakfast?.cost, plan)}</span></p>
                </div>

                <div className="day-section">
                  <p className="section-label">Afternoon</p>
                  <p>{day.afternoon?.activity} <span className="cost-inline">{money(day.afternoon?.cost, plan)}</span></p>
                  <p className="meal-row">Lunch · {day.lunch?.place_type} <span className="cost-inline">{money(day.lunch?.cost, plan)}</span></p>
                </div>

                <div className="day-section">
                  <p className="section-label">Evening</p>
                  <p>{day.evening?.activity} <span className="cost-inline">{money(day.evening?.cost, plan)}</span></p>
                  <p className="meal-row">Dinner · {day.dinner?.place_type} <span className="cost-inline">{money(day.dinner?.cost, plan)}</span></p>
                </div>

                <div className="day-footer">
                  <span>Local transport: {money(day.local_transport, plan)}</span>
                  <strong>Day total: {money(day.day_total, plan)}</strong>
                </div>

                {day.budget_tip && <p className="savings-tip">💡 {day.budget_tip}</p>}
              </article>
            ))}
          </div>

          {plan.itinerary?.money_saving_hacks?.length > 0 && (
            <div className="tips-box" style={{ marginTop: 18 }}>
              <p className="section-label">Money-saving hacks</p>
              <ul className="tip-list">
                {plan.itinerary.money_saving_hacks.map((h: string, i: number) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {plan.itinerary?.free_time_suggestions?.length > 0 && (
            <div className="tips-box" style={{ marginTop: 12 }}>
              <p className="section-label">Free time ideas</p>
              <ul className="tip-list">
                {plan.itinerary.free_time_suggestions.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
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
