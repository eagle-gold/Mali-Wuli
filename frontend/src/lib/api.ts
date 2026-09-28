import axios, { type AxiosRequestConfig } from "axios";
import { invaliderSessionCourante, lireJetonSession } from "@/lib/session";

/** Lecture facultative depuis une page publique : expire la session sans quitter cette page. */
export type OptionsSessionPassive = AxiosRequestConfig & { sessionPassive?: boolean };

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  // Le jeton d’inscription reste réservé au corps de POST /auth/register.
  const token = lireJetonSession();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const config = error.config as OptionsSessionPassive | undefined;
    const route = String(config?.url || "");
    const estRouteAuthentification = route.startsWith("/auth/");
    if (error.response?.status === 401 && !estRouteAuthentification && typeof window !== "undefined") {
      const headers = config?.headers;
      const autorisation = typeof headers?.get === "function"
        ? headers.get("Authorization")
        : headers?.Authorization ?? headers?.authorization;
      const jetonEnvoye = typeof autorisation === "string" && autorisation.startsWith("Bearer ") ? autorisation.slice(7).trim() : "";
      const courant = lireJetonSession();
      // Une réponse 401 d’une ancienne requête n’affecte pas le nouveau compte connecté.
      const invalidee = jetonEnvoye ? invaliderSessionCourante(jetonEnvoye) : false;
      if (!config?.sessionPassive && (invalidee || (!jetonEnvoye && !courant))) window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
