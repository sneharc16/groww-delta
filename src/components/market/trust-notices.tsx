"use client";
import { useState } from "react";
import type { TrustNotice } from "@/domain/trust/types";
import { apiFetch } from "@/lib/api/client";
import { formatINRLevelFromPaise, formatISTTime } from "@/lib/format/market";
import { Button } from "@/components/ui/button";

export function TrustNotices({ notices, throughSequence, environment, onChanged }: { notices: TrustNotice[]; throughSequence: number; environment?: string; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function decide(notice: TrustNotice, decision: "ADJUST" | "KEEP" | "LATER") {
    if (!notice.action) return;
    setBusy(true); setError(null);
    try {
      await apiFetch(`/api/watch-intents/${encodeURIComponent(notice.action.logicalIntentId)}/corporate-action`, { method: "POST", headers: environment ? { "X-Delta-Environment": environment } : {}, body: JSON.stringify({ eventId: notice.action.eventId, decision }) });
      await onChanged();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Could not save this decision."); }
    finally { setBusy(false); }
  }
  async function markSeen(notice: TrustNotice) {
    if (!notice.instrumentId) return;
    setBusy(true);
    try {
      await apiFetch("/api/catch-up/acknowledge", { method: "POST", body: JSON.stringify({ instrumentIds: [notice.instrumentId], throughSequence }) });
      await onChanged();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Could not acknowledge this update."); }
    finally { setBusy(false); }
  }
  if (!notices.length) return null;
  return <section className="trust-notices" aria-label="Data status notices">
    {error ? <p role="alert">{error}</p> : null}
    {notices.map((notice) => <article className={`card trust-notice trust-${notice.severity.toLowerCase()}`} key={notice.id} data-testid={`trust-${notice.type}-${notice.instrumentId?.split(":").at(-1) ?? "provider"}`}>
      <h2>{notice.title}</h2><p>{notice.message}</p>
      <small>Occurred at {formatISTTime(notice.occurredAt)} IST · Simulated data</small>
      {notice.metadata.lastSuccessfulUpdate ? <p>Last confirmed update: {formatISTTime(String(notice.metadata.lastSuccessfulUpdate))} IST</p> : null}
      {notice.action ? <div className="action-row">
        <Button disabled={busy} onClick={() => void decide(notice, "ADJUST")}>Update to {formatINRLevelFromPaise(notice.action.adjustedTargetPaise)}</Button>
        <Button variant="secondary" disabled={busy} onClick={() => void decide(notice, "KEEP")}>Keep {formatINRLevelFromPaise(notice.action.originalTargetPaise)}</Button>
        <Button variant="ghost" disabled={busy || notice.action.decision === "LATER"} onClick={() => void decide(notice, "LATER")}>{notice.action.decision === "LATER" ? "Saved for later review" : "Review later"}</Button>
      </div> : null}
      {notice.type === "CORRECTED_INFORMATION" ? <Button variant="secondary" disabled={busy} onClick={() => void markSeen(notice)}>Mark correction seen</Button> : null}
    </article>)}
  </section>;
}
