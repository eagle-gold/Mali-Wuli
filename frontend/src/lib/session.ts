export const EVENEMENT_SESSION = "mali-wuli:session-modifiee";

export function lireJetonSession() {
  if (typeof window === "undefined") return "";
  try { return window.localStorage.getItem("mali_wuli_token")?.trim() || ""; }
  catch { return ""; }
}

/** Notifie le document courant après une modification effective des clés de session.
 * L’événement natif storage ne se déclenche que dans les autres documents. */
function modifierSession(modifier: (stockage: Storage) => void) {
  if (typeof window === "undefined") return false;
  const stockage = window.localStorage;
  const jetonAvant = stockage.getItem("mali_wuli_token");
  const utilisateurAvant = stockage.getItem("mali_wuli_user_id");
  let modifiee = false;
  try { modifier(stockage); }
  finally {
    modifiee = jetonAvant !== stockage.getItem("mali_wuli_token") || utilisateurAvant !== stockage.getItem("mali_wuli_user_id");
    if (modifiee) window.dispatchEvent(new Event(EVENEMENT_SESSION));
  }
  return modifiee;
}

export function enregistrerSession(jeton: string, utilisateurId: string) {
  return modifierSession((stockage) => {
    stockage.setItem("mali_wuli_user_id", utilisateurId);
    stockage.setItem("mali_wuli_token", jeton);
  });
}

export function terminerSession() {
  return modifierSession((stockage) => {
    stockage.removeItem("mali_wuli_token");
    stockage.removeItem("mali_wuli_user_id");
  });
}

/** Une réponse ancienne ne doit jamais supprimer une session ouverte depuis. */
export function invaliderSessionCourante(jeton: string) {
  if (!jeton || lireJetonSession() !== jeton) return false;
  try { return terminerSession(); }
  catch { return false; }
}

type IdentiteSession = {
  id?: string;
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
  role?: string | null;
  permissions?: string[];
  rolesDelegues?: string[];
  revisionDroits?: string;
  statut?: string;
  profil?: { id?: string; photo?: string | null; titre?: string | null; onboardingFini?: boolean } | null;
};

export type CompteSession = IdentiteSession & { user?: IdentiteSession | null };

/** Le questionnaire d’accueil reste prioritaire sur la destination demandée. */
export function destinationSession(compte: CompteSession, destination = "/dashboard") {
  const profil = compte.profil || compte.user?.profil;
  if (profil?.onboardingFini !== true) return "/onboarding";
  return destination;
}
