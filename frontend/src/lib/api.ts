import type {
  AuditOut,
  KeywordOut,
  RankCheckResult,
  RankHistoryOut,
  Token,
  UserOut,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.detail ?? message;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// --- Auth ---

export async function signup(email: string, password: string): Promise<UserOut> {
  return request<UserOut>("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string): Promise<Token> {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);

  return request<Token>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

// --- Keywords ---

export async function getKeywords(token: string): Promise<KeywordOut[]> {
  return request<KeywordOut[]>("/keywords", {}, token);
}

export async function createKeyword(
  token: string,
  keyword_text: string,
  target_domain: string,
  competitor_domains: string[] = []
): Promise<KeywordOut> {
  return request<KeywordOut>(
    "/keywords",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword_text, target_domain, competitor_domains }),
    },
    token
  );
}

export async function updateKeyword(
  token: string,
  keywordId: number,
  competitor_domains: string[]
): Promise<KeywordOut> {
  return request<KeywordOut>(
    `/keywords/${keywordId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitor_domains }),
    },
    token
  );
}

export async function deleteKeyword(token: string, keywordId: number): Promise<void> {
  return request<void>(`/keywords/${keywordId}`, { method: "DELETE" }, token);
}

export async function checkKeyword(
  token: string,
  keywordId: number
): Promise<RankCheckResult> {
  return request<RankCheckResult>(
    `/keywords/${keywordId}/check`,
    { method: "POST" },
    token
  );
}

export async function getKeywordHistory(
  token: string,
  keywordId: number
): Promise<RankHistoryOut[]> {
  return request<RankHistoryOut[]>(`/keywords/${keywordId}/history`, {}, token);
}

// --- Audits ---

export async function getAudits(token: string): Promise<AuditOut[]> {
  return request<AuditOut[]>("/audits", {}, token);
}

export async function createAudit(
  token: string,
  payload: { content?: string; url?: string; title?: string }
): Promise<AuditOut> {
  return request<AuditOut>(
    "/audits",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    token
  );
}

export async function getAudit(token: string, auditId: number): Promise<AuditOut> {
  return request<AuditOut>(`/audits/${auditId}`, {}, token);
}

// --- Users ---

export async function getCurrentUser(token: string): Promise<UserOut> {
  return request<UserOut>("/users/me", {}, token);
}
