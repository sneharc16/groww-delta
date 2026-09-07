"use client";

import { RotateCcw, StepForward } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CatchUpDto, DemoStateDto, WatchlistDto } from "@/server/dto/types";
import { apiFetch } from "@/lib/api/client";
import { formatINRFromPaise, formatISTTime } from "@/lib/format/market";
import { Button } from "@/components/ui/button";
import { DemoBadge, ErrorState, LoadingState } from "@/components/ui/status";
import { EngineDebug } from "./engine-debug";

export function DemoScreen() {
  const [scenarios, setScenarios] = useState<Array<{ id: string; name: string }>>([]);
  const [state, setState] = useState<DemoStateDto | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistDto | null>(null);
  const [catchUp, setCatchUp] = useState<CatchUpDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [demoState, watchlistData, catchUpData] = await Promise.all([apiFetch<DemoStateDto>("/api/demo/state"), apiFetch<WatchlistDto>("/api/watchlist"), apiFetch<CatchUpDto>("/api/catch-up")]);
      setScenarios((await apiFetch<{ scenarios: Array<{ id: string; name: string }> }>("/api/demo/scenarios")).scenarios);
      setError(null);
      setState(demoState);
      setWatchlist(watchlistData);
      setCatchUp(catchUpData);
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Could not load the demo."); }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function change(action: "advance" | "reset") {
    setBusy(true); setMessage(null);
    try {
      const result = await apiFetch<DemoStateDto & { advanced?: boolean; message?: string }>(`/api/demo/${action}`, { method: "POST" });
      await load();
      setMessage(result.message ?? (action === "advance" ? "The simulated market advanced by 30 minutes." : "Scenario reset to the starting point."));
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Could not update the demo."); }
    finally { setBusy(false); }
  }

  async function configure(kind: "scenario" | "provider", value: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/demo/${kind}`, { method: "POST", body: JSON.stringify(kind === "scenario" ? { scenarioId: value } : { status: value }) });
      await load();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Could not change demo controls."); }
    finally { setBusy(false); }
  }

  if ((!state || !watchlist || !catchUp) && !error) return <LoadingState label="Loading the replay scenario…" />;
  if (error) return <ErrorState message={error} retry={() => void load()} />;
  if (!state || !watchlist || !catchUp) return null;

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">Deterministic replay</p><h1>Demo controls</h1><p>Move one fixed market step at a time. Refreshing the browser keeps this position.</p></div>
        <DemoBadge />
      </div>
      <div className="two-column">
        <section className="card section-card demo-controller">
          <div className="demo-clock"><span>Current simulated time</span><strong data-testid="demo-time">{formatISTTime(state.currentTime)}</strong><small>Asia/Kolkata · Step {state.currentStep} / {state.scenario.totalSteps}</small></div>
          <div className="progress-track" aria-label={`Replay step ${state.currentStep} of ${state.scenario.totalSteps}`}>
            <span style={{ width: `${(state.currentStep / state.scenario.totalSteps) * 100}%` }} />
          </div>
          <div className="action-row">
            <Button onClick={() => void change("advance")} disabled={busy || state.atFinalStep}><StepForward size={17} />Advance market 30 minutes</Button>
            <Button variant="secondary" onClick={() => void change("reset")} disabled={busy || state.currentStep === 0}><RotateCcw size={16} />Reset scenario</Button>
            <Link href="/" className="button button-ghost">View Catch Up</Link>
          </div>
          {message ? <p className="notice" role="status">{message}</p> : null}
          {state.atFinalStep ? <p className="muted">The demo market is at its final step.</p> : null}
        </section>
        <aside className="card section-card">
          <div className="section-title"><h2>Scenario</h2></div>
          <label className="form-field">Demo scenario<select aria-label="Demo scenario" value={state.scenario.id} disabled={busy} onChange={(event) => void configure("scenario", event.target.value)}>{scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select></label>
          <label className="form-field">Provider status<select aria-label="Provider status" value={catchUp.providerHealth.status} disabled={busy} onChange={(event) => void configure("provider", event.target.value)}><option value="HEALTHY">Healthy</option><option value="DEGRADED">Degraded</option><option value="UNAVAILABLE">Unavailable</option></select></label>
          <dl className="detail-list"><div><dt>Name</dt><dd>{state.scenario.name}</dd></div><div><dt>ID</dt><dd>{state.scenario.id}</dd></div><div><dt>Sequence</dt><dd>{state.currentSequence}</dd></div></dl>
        </aside>
      </div>
      <section className="card section-card demo-prices">
        <div className="section-title"><div><h2>Current simulated prices</h2><p>Fixed values for the current replay position</p></div><DemoBadge /></div>
        <div className="price-list">
          {watchlist.items.map((item) => <div key={item.id}><span><strong>{item.instrument.symbol}</strong><small>{item.instrument.name}</small></span><strong data-testid={`demo-price-${item.instrument.symbol}`}>{item.snapshot ? formatINRFromPaise(item.snapshot.pricePaise) : "—"}</strong></div>)}
        </div>
      </section>
      {state.scenario.id === "groww-delta-default" ? <section className="card section-card upcoming-card">
        <div className="section-title"><div><h2>Demo walkthrough</h2><p>Expected qualitative behavior from deterministic market inputs</p></div></div>
        <ol className="walkthrough-list">
          <li className={state.currentStep === 0 ? "current" : ""}><strong>Step 0 · Baseline</strong><span>The user starts caught up.</span></li>
          <li className={state.currentStep === 1 ? "current" : ""}><strong>Step 1 · Normal movement</strong><span>Expected: nothing meaningful.</span></li>
          <li className={state.currentStep === 2 ? "current" : ""}><strong>Step 2 · Meaningful changes</strong><span>Expected: four direct intent matches and Reliance significance.</span></li>
          <li className={state.currentStep === 3 ? "current" : ""}><strong>Step 3 · Novelty test</strong><span>After Step 2 acknowledgement, old changes should not return.</span></li>
          <li className={state.currentStep === 4 ? "current" : ""}><strong>Step 4 · Contextual relevance</strong><span>A Crude event reaches IndiGo through the user-confirmed fuel-cost relationship.</span></li>
        </ol>
        <details><summary>Upcoming simulated events</summary><p>Future event detail is not revealed by default. Events become available to the engine only at their assigned sequence.</p></details>
      </section>
      : <section className="card section-card"><h2>Resilience walkthrough</h2><p>Advance the selected scenario and inspect its data status, attention, and trust notices in Catch Up.</p></section>}
      <EngineDebug catchUp={catchUp} />
    </>
  );
}
