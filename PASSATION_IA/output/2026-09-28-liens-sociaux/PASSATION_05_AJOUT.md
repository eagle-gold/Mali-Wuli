## 28 septembre 2026 — liens sociaux, intégration terminée et publication en cours

**Demande utilisateur :** LinkedIn, Facebook, Instagram et TikTok facultatifs dans les informations du compte, modifiables depuis le profil et cliquables sur le profil personnel et la fiche membre. Le formulaire commun **Informations** est réutilisé par `/onboarding?etape=informations` ; aucune duplication dans la création de compte. Présentation par icône et nom, ouverture externe protégée, styles existants conservés.

Contrat : champs plats `linkedin/facebook/instagram/tiktok`, `string | null`. GET `/users/me` dans `profil`, GET `/users/:id` dans la fiche membre ; PUT/PATCH `/users/me` acceptent ces champs. GET/POST `/onboarding` les utilisent dans `informations`. Le GET remplace les anciennes valeurs de snapshot par le relationnel, y compris les effacements. Omission = conserver ; vide/espaces/null = effacer. HTTP(S), sans identifiants, trim et normalisation, limite 500 avant/après encodage Unicode. Liens invalides anciens masqués ; aucun appel aux réseaux sociaux. Aucun ajout des trois nouveaux réseaux au PDF.

**Limite de parcours inchangée :** Continuer à la première étape garde un brouillon local ; terminer l’onboarding enregistre en base. Les profils affichés lisent l’API relationnelle. La fiche dite publique demeure soumise aux accès membres existants ; ce lot ne rend pas les profils accessibles anonymement.

État à la rédaction : 14 fichiers intégrés, 235 sources empaquetées, TypeScript des deux applications confirmé par la session principale. 17 tests backend et 7 groupes frontend mémoire réussis, overlay 8 fichiers / 0 diagnostic. QA navigateur, builds Linux, sauvegarde/migration et publication restent à documenter ; `verification.json` est encore `in_progress`. **Ne pas annoncer ce lot publié sur cette seule note.**

Version préparée : `20260928-liens-sociaux`. Migration ciblée `20260928220000_profile_social_links` : LinkedIn élargi à 500 et trois colonnes optionnelles, aucune reprise/effacement de données. 15 migrations attendues après succès, 14 auparavant. Référence production en lecture seule confirmée le 28 septembre à 18:43:37 UTC : frontend `versions/20260928-home-session-r2`/`ZbOkxHyHSm-qkR0dR9Qeh`, backend `versions/20260928-suppressions-droits`.

Preuves et reprise : `output/2026-09-28-liens-sociaux/LIRE_REPRISE.md`, `installed.json`, `source-manifest.json`, `package-contract.json`, `tests-backend-social.json`, `frontend-social-tests.log`, `production-baseline-readonly.json`. Compléter cette entrée avec le build, la sauvegarde, les cibles activées et les résultats publics après vérification finale. Un rollback applicatif n’annule pas le DDL ; conserver les colonnes ajoutées plutôt que supprimer des liens.

