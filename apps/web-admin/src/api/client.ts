const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new ApiClientError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  get: <T>(path: string, token: string | null) => request<T>(path, token),
  post: <T>(path: string, token: string | null, body?: unknown) => request<T>(path, token, jsonInit("POST", body)),
  put: <T>(path: string, token: string | null, body?: unknown) => request<T>(path, token, jsonInit("PUT", body)),
  patch: <T>(path: string, token: string | null, body?: unknown) => request<T>(path, token, jsonInit("PATCH", body)),
  delete: <T>(path: string, token: string | null) => request<T>(path, token, { method: "DELETE" }),
  // No Content-Type header — the browser sets multipart/form-data with the
  // correct boundary itself, which it can only do if we don't pre-set it.
  upload: <T>(path: string, token: string | null, formData: FormData) => request<T>(path, token, { method: "POST", body: formData }),
};

export { API_BASE_URL };
