export const API_BASE_URL = (() => {
  if (typeof window === "undefined") return "";

  const configured = (window as unknown as { __API_BASE_URL__?: string }).__API_BASE_URL__;
  if (configured && configured.length > 0) return configured.replace(/\/$/, "");

  const host = window.location.hostname;
  const protocol = window.location.protocol;
  return `${protocol}//${host}:8000`;
})();

export const toList = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "results" in data) {
    const results = (data as { results?: unknown }).results;
    return Array.isArray(results) ? (results as T[]) : [];
  }
  return [];
};

export async function fetchList<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("authToken") : null;
  const headers: HeadersInit = token ? { Authorization: `Token ${token}` } : {};
  const response = await fetch(`${API_BASE_URL}${path}`, { signal, headers });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  const data = await response.json();
  return toList<T>(data);
}

export async function fetchOne<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("authToken") : null;
  const headers: HeadersInit = token ? { Authorization: `Token ${token}` } : {};
  const response = await fetch(`${API_BASE_URL}${path}`, { signal, headers });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}
