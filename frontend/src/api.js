const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const TOKEN_KEY = "ironlog-token";

export const UNAUTHORIZED_EVENT = "ironlog:unauthorized";

// In-memory copy keeps the session working when storage is blocked;
// it just won't survive a reload then.
let memoryToken = null;

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setToken(token) {
  memoryToken = token || null;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Storage unavailable: memoryToken still holds the session.
  }
}

async function authorizedFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (response.status === 401 && !path.startsWith("/api/auth/")) {
    setToken(null);
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  return response;
}

// `json` is the request body as a plain value: it is sent as JSON with the matching header.
export async function fetchJson(path, { json, ...options } = {}) {
  if (json !== undefined) {
    options.headers = { "Content-Type": "application/json", ...options.headers };
    options.body = JSON.stringify(json);
  }
  const response = await authorizedFetch(path, options);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
}

// Downloads a file response, named by the server's Content-Disposition.
export async function downloadFile(path, fallbackName) {
  const response = await authorizedFetch(path);
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  const disposition = response.headers.get("Content-Disposition") || "";
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
