// Lightweight API client. All requests go to the same origin and are proxied
// to the backend by next.config rewrites. Auth uses httpOnly JWT cookies;
// state-changing requests carry the CSRF token from the readable cookie.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ApiOptions extends RequestInit {
  /** internal: prevents infinite refresh loops */
  _retried?: boolean;
}

async function rawFetch(path: string, options: ApiOptions = {}): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!SAFE_METHODS.has(method)) {
    const csrf = getCookie("csrf_token");
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  return fetch(`/api${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
  });
}

export async function api<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  let res = await rawFetch(path, options);

  // transparent one-shot refresh on expired access token
  if (res.status === 401 && !options._retried && path !== "/auth/refresh") {
    const refreshed = await rawFetch("/auth/refresh", { method: "POST" });
    if (refreshed.ok) {
      res = await rawFetch(path, { ...options, _retried: true });
    }
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const detail = data?.detail || data?.message || res.statusText;
    throw new ApiError(res.status, typeof detail === "string" ? detail : "Request failed");
  }
  return data as T;
}

// --- typed helpers ---------------------------------------------------------
export interface User {
  id: number;
  email: string;
  username: string;
  search_source: "arxiv" | "scholar";
  has_llm_key: boolean;
  llm_base_url: string | null;
  llm_model: string | null;
  has_serpapi_key: boolean;
}

export interface Paper {
  url: string;
  title: string;
  author: string | null;
  conference: string | null;
  pages: number | null;
  date: string | null;
  abstract: string | null;
  cite_num: number | null;
  submitted: boolean;
  relevant_no: number;
  tier: number;
  source: string;
}

export interface SearchResponse {
  query: string;
  source: string;
  count: number;
  results: Paper[];
}

export const authApi = {
  me: () => api<User>("/auth/me"),
  login: (identifier: string, password: string) =>
    api<User>("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) }),
  register: (email: string, username: string, password: string) =>
    api<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password }),
    }),
  logout: () => api("/auth/logout", { method: "POST" }),
};

export const searchApi = {
  search: (q: string, source?: string, maxResults = 30) => {
    const params = new URLSearchParams({ q, max_results: String(maxResults) });
    if (source) params.set("source", source);
    return api<SearchResponse>(`/search?${params.toString()}`);
  },
};

export const settingsApi = {
  update: (body: Record<string, unknown>) =>
    api<User>("/settings", { method: "PUT", body: JSON.stringify(body) }),
};

export const translateApi = {
  translate: (text: string, target_lang = "Japanese") =>
    api<{ translated: string; model: string }>("/translate", {
      method: "POST",
      body: JSON.stringify({ text, target_lang }),
    }),
};
