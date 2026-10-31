import api from "@/lib/api";
import { fermerSocket } from "@/hooks/useSocket";
import { lireJetonSession, terminerSession } from "@/lib/session";

/**
 * Déconnecte cet appareil : la session est révoquée côté serveur (le jeton
 * devient inutilisable même s'il a été copié), puis effacée localement.
 * Un serveur injoignable n'empêche jamais de se déconnecter localement.
 */
export async function deconnecterSession() {
  const jeton = lireJetonSession();
  fermerSocket();
  if (jeton) {
    try { await api.post("/auth/logout", undefined, { timeout: 4000 }); } catch { /* déconnexion locale malgré tout */ }
  }
  terminerSession();
  localStorage.removeItem("mali_wuli_registration_token");
}
