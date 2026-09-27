export function asaasBase() {
  return process.env["ASAAS_ENV"] === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

export async function asaas<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env["ASAAS_API_KEY"];
  if (!key) throw new Error("Pagamentos ainda não configurados");
  const res = await fetch(asaasBase() + path, {
    ...init,
    headers: { "Content-Type": "application/json", access_token: key, "User-Agent": "Livronauta", ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Asaas error", res.status, JSON.stringify(body));
    const msg = (body as any)?.errors?.[0]?.description ?? "Falha ao comunicar com o Asaas";
    throw new Error(msg);
  }
  return body as T;
}
