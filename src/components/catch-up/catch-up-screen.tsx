"use client";

import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { DemoStateDto, WatchlistDto } from "@/server/dto/types";
import { apiFetch } from "@/lib/api/client";
import { summarizeIntent } from "@/domain/intent/summary";
import { formatINRFromPaise, formatISTTime } from "@/lib/format/market";
import { DemoBadge, ErrorState, LoadingState } from "@/components/ui/status";

export function CatchUpScreen() {
  const [watchlist, setWatchlist] = useState<WatchlistDto | null>(null);
  const [demo, setDemo] = useState<DemoStateDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [watchlistData, demoState] = await Promise.all([apiFetch<WatchlistDto>("/api/watchlist"), apiFetch<DemoStateDto>("/api/demo/state")]);
      setWatchlist(watchlistData); setDemo(demoState); setError(null);
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Could not load Groww Delta."); }
  }, []);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  if ((!watchlist || !demo) && !error) return <LoadingState label="Loading your baseline…" />;
  if (error) return <ErrorState message={error} retry={() => void load()} />;
  if (!watchlist || !demo) return null;
  const atStart = demo.currentStep === 0;

  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">The Living Watchlist</p><h1>Catch Up</h1><p>A calm place for the stocks you care about and the reasons you saved.</p></div><DemoBadge /></div>
      <section className="baseline-card card">
        <div className="baseline-icon"><Clock3 size={22} /></div>
        <div>
          <h2>{atStart ? "You're at the starting point" : "The simulated market has advanced."}</h2>
          <p>{atStart ? "Groww Delta has captured the baseline market state." : "Meaningful-change analysis will be added in Build 2."}</p>
          <p className="muted">{atStart ? "Advance the demo market to create future changes." : `Current simulated market time: ${formatISTTime(demo.currentTime)} IST`}</p>
          <Link href="/demo" className="button button-primary">{atStart ? "Open demo controls" : "View demo position"}<ArrowRight size={16} /></Link>
        </div>
      </section>
      <section className="card section-card current-watchlist">
        <div className="section-title"><div><h2>Currently watching</h2><p>{watchlist.items.length} stocks in {watchlist.watchlist.name}</p></div><Link href="/watchlist" className="text-button">View watchlist</Link></div>
        <div className="catchup-list">
          {watchlist.items.map((item) => (
            <Link href={`/stock/${item.instrument.symbol}`} key={item.id}>
              <span><strong>{item.instrument.symbol}</strong><small>{item.activeIntents[0] ? summarizeIntent(item.activeIntents[0]) : "No watch reason set"}</small></span>
              <strong>{item.snapshot ? formatINRFromPaise(item.snapshot.pricePaise) : "—"}</strong>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
