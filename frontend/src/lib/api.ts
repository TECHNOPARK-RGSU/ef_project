export const API_BASE_URL = (() => {
  if (typeof window === "undefined") return "";

  const configured = (window as unknown as { __API_BASE_URL__?: string }).__API_BASE_URL__;
  if (configured && configured.length > 0) return configured.replace(/\/$/, "");

  const host = window.location.hostname;
  const protocol = window.location.protocol;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal) return `${protocol}//${host}:26111`;
  if (host === "projectaris.ru" || host === "www.projectaris.ru") return "https://api.projectaris.ru";
  return `${protocol}//${host}:8000`;
})();

const withCacheBust = (url: string): string => {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_=${Date.now()}`;
};

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
  const response = await fetch(withCacheBust(`${API_BASE_URL}${path}`), { signal, headers, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  const data = await response.json();
  return toList<T>(data);
}

export async function fetchOne<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("authToken") : null;
  const headers: HeadersInit = token ? { Authorization: `Token ${token}` } : {};
  const response = await fetch(withCacheBust(`${API_BASE_URL}${path}`), { signal, headers, cache: "no-store" });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}

/** Загрузка одной страницы списка (DRF PageNumberPagination). Возвращает { results, count }. */
export async function fetchPage<T>(
  path: string,
  params?: { page?: number; page_size?: number; search?: string; [k: string]: string | number | undefined },
  signal?: AbortSignal,
): Promise<{ results: T[]; count: number }> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("authToken") : null;
  const headers: HeadersInit = token ? { Authorization: `Token ${token}` } : {};
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") searchParams.set(k, String(v));
    });
  }
  const query = searchParams.toString();
  const sep = path.includes("?") ? "&" : "?";
  const url = query ? `${API_BASE_URL}${path}${sep}${query}` : `${API_BASE_URL}${path}`;
  const response = await fetch(withCacheBust(url), { signal, headers, cache: "no-store" });
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  const data = (await response.json()) as { results?: T[]; count?: number };
  const results = Array.isArray(data.results) ? data.results : [];
  const count = typeof data.count === "number" ? data.count : results.length;
  return { results, count };
}
