import Link from "next/link";
import type { MarketContext as MarketContextData } from "@/domain/market/context";
import type { AttentionItemDto } from "@/server/dto/types";
import { formatPercentage } from "@/lib/format/market";

export function MarketContextPanel({ context, grouped }: { context: MarketContextData | null; grouped: AttentionItemDto[] }) {
  if (!context?.calmModeActive) return null;
  return <section className="card section-card calm-panel" data-testid="calm-mode">
    <p className="eyebrow">Market context · Calm Mode</p>
    <h2>Markets are moving broadly today</h2><p>{context.summary}</p>
    <p>Nifty 50: {formatPercentage(context.benchmarkDeltaBps / 100)} · {context.sameDirectionCount} of {context.equityCount} watched stocks moving in the same direction</p>
    <Link className="text-button" href="/watchlist">View full watchlist</Link>
    {grouped.length ? <details><summary>Show grouped market moves ({grouped.length})</summary>
      <ul>{grouped.map((item) => <li key={item.instrument.id}><Link href={`/stock/${item.instrument.symbol}`}>{item.instrument.symbol}</Link> · {formatPercentage(item.priceDeltaBps / 100)} since its knowledge baseline</li>)}</ul>
    </details> : null}
  </section>;
}
