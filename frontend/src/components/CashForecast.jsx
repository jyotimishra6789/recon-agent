import React, { useEffect, useState } from "react";
import { api } from "../api";

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function CashForecast() {
  const [values, setValues] = useState({ current_cash: "", expected_settlements: "", upcoming_expenses: "" });
  const [forecast, setForecast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const update = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));

  const calculate = async (event) => {
    if (event) event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const inputs = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === "" ? null : Number(value)]));
      setForecast(await api.getCashForecast(inputs));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="cash-forecast panel">
      <div className="forecast-heading">
        <div><span className="section-title">Forward planning</span><h2>Cash forecast</h2></div>
        <span className="forecast-badge">Auto-calculated</span>
      </div>
      <form className="forecast-form" onSubmit={calculate}>
        <label>Current cash<input type="number" min="0" step="0.01" value={values.current_cash} onChange={update("current_cash")} placeholder="100000" /></label>
        <label>Expected settlements<input type="number" min="0" step="0.01" value={values.expected_settlements} onChange={update("expected_settlements")} placeholder="50000" /></label>
        <label>Upcoming expenses<input type="number" min="0" step="0.01" value={values.upcoming_expenses} onChange={update("upcoming_expenses")} placeholder="120000" /></label>
        <button className="forecast-btn" type="submit" disabled={busy}>{busy ? "Calculating..." : "Calculate forecast"}</button>
      </form>
      {forecast && <div className="forecast-result">
        <div><span>Projected balance</span><strong className={forecast.projected_balance < 0 ? "negative" : ""}>{money(forecast.projected_balance)}</strong></div>
        <p>{money(forecast.current_cash)} + {money(forecast.expected_settlements)} - {money(forecast.upcoming_expenses)} = <b>{money(forecast.projected_balance)}</b></p>
      </div>}
      {error && <div className="forecast-error">{error}</div>}
    </section>
  );
}