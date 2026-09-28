# Liens sociaux — lot frontend

Sources gelées le 28 septembre 2026, préparées uniquement dans `staging/frontend`. Huit fichiers :

- `src/lib/reseaux-sociaux.ts` (nouveau) : registre des quatre réseaux, validation et normalisation, filtrage des liens affichables.
- `src/components/profile/LiensSociauxProfil.tsx` (nouveau) : carte commune avec icônes, noms, retour à la ligne et ouverture externe protégée.
- `src/components/onboarding/StepInformations.tsx` : champs LinkedIn, Facebook, Instagram et TikTok facultatifs, préremplissage, messages français et focus sur la première erreur.
- `src/components/profile/ProfilMembre.tsx` : valeurs relationnelles `/users/me`, carte commune et conservation du lien de modification existant.
- `src/components/directory/ProfilPublic.tsx` : carte commune indépendante des coordonnées privées, sans doublonner LinkedIn.
- `src/types/index.ts`, `src/types/profile.ts`, `src/components/directory/types.ts` : quatre champs optionnels `string | null`.

## Parcours

Les champs apparaissent dans **Informations**, après création du compte. **Modifier mes infos** sur le profil ouvre déjà `/onboarding?etape=informations`, qui utilise ce même formulaire. Aucune duplication dans `/register/details`.

L’objet `informations` complet est déjà conservé par le conteneur onboarding dans son cache, entre les étapes et dans le POST final ; le conteneur ne nécessite donc pas de modification. Le GET `/onboarding` fournit les valeurs relationnelles actualisées (contrat backend de ce lot), notamment les `null` qui remplacent les anciennes valeurs du cache. La sauvegarde serveur suit le fonctionnement existant : terminer le parcours, et non seulement cliquer sur Continuer à la première étape. Les profils affichés utilisent leurs réponses API, sans reprendre le cache local.

Une chaîne vide est envoyée explicitement pour effacer un lien. Les URL sont nettoyées et normalisées par `new URL()`, limitées à 500 caractères avant et après normalisation, avec HTTP(S), nom d’hôte et sans identifiants. Les anciens liens invalides ne sont pas rendus. Pas de restriction aux domaines des marques, ni requête distante de vérification. Aucun ajout au PDF.

## Vérifications locales

- `node output/2026-09-28-liens-sociaux/verify-liens-sociaux.cjs` : **7 groupes réussis**, sources réelles dans un transport et un stockage mémoire, rendu React statique, aucun réseau/base/mail.
- `node output/2026-09-28-liens-sociaux/verify-frontend-overlay.cjs` : **8 fichiers, 0 diagnostic**, aucune émission de build.

Les contrôles couvrent les protocoles/identifiants/limites Unicode, les champs obligatoires malgré `noValidate`, la préremplissage et les erreurs accessibles, les effacements, les anciens brouillons, la priorité du GET sur le cache, toutes les étapes jusqu’au POST final, le stockage refusé, les deux profils et l’absence de liens invalides ou de LinkedIn dupliqué. La vérification navigateur/mobile est conduite par la session principale après intégration ; aucune publication n’a été exécutée par ce sous-agent.
