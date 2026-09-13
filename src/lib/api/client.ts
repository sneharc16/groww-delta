interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

let sessionReady: Promise<void> | null = null;
async function ensureSession() {
  if (!sessionReady) sessionReady = fetch("/api/session", { method: "POST" }).then(async response => {
    if (!response.ok) {
      const body = await response.json() as ErrorEnvelope;
      throw new Error(body.error?.message ?? "Your demo session could not be opened.");
    }
  }).catch(error => { sessionReady = null; throw error; });
  await sessionReady;
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  await ensureSession();
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.method && init.method !== "GET" ? { "Idempotency-Key": crypto.randomUUID() } : {}), ...init?.headers },
  });
  const body = await response.json() as T & ErrorEnvelope;
  if (!response.ok) throw new Error(body.error?.message ?? "Request failed.");
  return body;
}

export async function startNewSession() {
  const response = await fetch("/api/session/new", { method: "POST" });
  if (!response.ok) throw new Error("A new session could not be started. Please retry.");
  sessionReady = null;
}
