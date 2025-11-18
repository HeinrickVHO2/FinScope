import dotenv from "dotenv";
dotenv.config();

const CAKTO_API = "https://api.cakto.com.br";

// Cache do token de OAuth para evitar rate-limit
let caktoTokenCache: {
  token: string | null;
  expires: number;
} = {
  token: null,
  expires: 0,
};

/**
 * Obtém e cacheia o token OAuth da Cakto
 */
export async function getCaktoToken(): Promise<string> {
  const now = Date.now();

  // Se o token existe e ainda não expirou (com 60s de margem)
  if (caktoTokenCache.token && caktoTokenCache.expires > now + 60000) {
    return caktoTokenCache.token;
  }

  const params = new URLSearchParams({
    client_id: process.env.CAKTO_CLIENT_ID!,
    client_secret: process.env.CAKTO_CLIENT_SECRET!,
    grant_type: "client_credentials",
  });

  const res = await fetch(`${CAKTO_API}/oauth/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[CAKTO OAUTH ERROR]", text);
    throw new Error("Erro ao gerar token OAuth da Cakto");
  }

  const data: any = await res.json();

  caktoTokenCache = {
    token: data.access_token,
    expires: now + data.expires_in * 1000,
  };

  return data.access_token as string;
}

/**
 * Faz requisições autenticadas à API pública da Cakto
 */
export async function caktoFetch(path: string, init: RequestInit = {}) {
  const token = await getCaktoToken();

  const res = await fetch(`${CAKTO_API}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`[CAKTO API ERROR] ${res.status}:`, errorBody);
    throw new Error(`Erro Cakto: HTTP ${res.status}`);
  }

  // Se a resposta for JSON válida
  try {
    return await res.json();
  } catch (err) {
    console.warn("[CAKTO WARN] Resposta não é JSON, retornando texto bruto");
    return {};
  }
}
