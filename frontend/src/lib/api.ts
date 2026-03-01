/**
 * Custom fetch wrapper to automatically include Authorization header.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const getAuthToken = () => {
  if (typeof window === "undefined") return null;
  // 1. Check cookies
  const match = document.cookie.match(new RegExp("(^| )auth_token=([^;]+)"));
  if (match) return match[2];

  // 2. Check URL search params (initial login redirect)
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token");
  if (urlToken) {
    setAuthToken(urlToken);
    return urlToken;
  }

  return null;
};

export const setAuthToken = (token: string) => {
  document.cookie = `auth_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
};

export const clearAuthToken = () => {
  document.cookie = "auth_token=; path=/; max-age=0";
};

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Default to JSON content type for POST/PUT/PATCH
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Optional: Clear token and redirect to login if session is invalid
    // clearAuthToken();
    // window.location.href = "/";
  }

  return response;
}
