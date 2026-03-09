const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const buildApiUrl = (path: string) => {
  if (!path) return API_BASE_URL;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const apiFetch = (input: string, init?: RequestInit) => {
  const url = buildApiUrl(input);
  return fetch(url, init);
};

export const API_URL = API_BASE_URL;
