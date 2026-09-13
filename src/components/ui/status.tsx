"use client";
import { useState } from "react";
import { startNewSession } from "@/lib/api/client";
import { AlertCircle, LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <div className="state-message" role="status"><LoaderCircle className="spin" size={20} />{label}</div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  async function recover() { try { await startNewSession(); window.location.reload(); } catch { setRecoveryError("A new session could not be started. Please retry."); } }
  return (
    <div className="state-message error-message" role="alert">
      <AlertCircle size={20} />
      <span>{recoveryError ?? message}</span>
      {/session expired|session could not be opened/i.test(message) ? <button type="button" className="text-button" onClick={() => void recover()}>Start a new anonymous demo</button> : null}
      {retry ? <button type="button" className="text-button" onClick={retry}>Try again</button> : null}
    </div>
  );
}

export function DemoBadge() {
  return <span className="demo-badge">SIMULATED · DEMO DATA</span>;
}
