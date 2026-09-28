# Suppressions et droits — 28 septembre 2026

## État courant

Lot publié et vérifié : frontend/backend `versions/20260928-suppressions-droits`, build `cNI0N04igTlrU9KwyDz4k`. 230 sources, 25 routes et 62 ressources publiques contrôlées. Base inchangée, 14 migrations. Voir `verification.json`. Ne pas rejouer les scripts figés sans relire les deux liens current.

Source active : `/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration`. Branche `ibrahima-catalogue-scolaire-partage`, HEAD `0d01264b98b460863d90cafeb8c50b7d345cd37f`. Beaucoup de changements antérieurs non committés : conserver l’arbre entier. `installed.json` contient les 31 fichiers touchés pendant ce lot ; `before/` permet la comparaison ciblée seulement.

## Fonctionnement livré

- Bouton « Supprimer la publication » dans le fil et sur le profil pour l’auteur, l’administrateur général ou le rôle Publications. Confirmation avant suppression définitive ; commentaires/réactions liés retirés.
- Un auteur peut supprimer ses commentaires et les commentaires de ses propres publications. Publications donne cette modération sur tout le fil.
- Responsable désigné d’association ou rôle Associations : suppression fiche, affiliations et images. Les comptes des membres sont conservés. Le modèle actuel n’a pas de créateur permanent : le responsable assigné est l’interlocuteur qui gère/supprime la fiche.
- Auteur d’offre ou rôle Offres ; organisateur d’événement ou rôle Événements : suppression visible depuis détails, y compris propositions et modération.
- Permissions fournies par l’API via `peutSupprimer`, pas déduites d’un bouton Modifier. Contrôles serveur sur chaque requête. Opérations liées atomiques ; nettoyage des médias après commit sans faux échec si fichier déjà absent.
- Comptes : choix conservateur annoncé en l’absence de réponse sur le retrait des comptes, **désactivation réversible**, pas effacement définitif. `SUSPENDU` bloque connexion et retire profil des listes éligibles. Données conservées. Rétablir passe en `EN_ATTENTE`, revalidation obligatoire. Sessions et OTP révoqués ; aucun mail envoyé par cette action.
- Deux rôles cumulables supplémentaires : `PUBLICATIONS` → `PUBLICATIONS_MODERER`, `MEMBRES` → `MEMBRES_GERER`. Sept rôles au total. Seul le propriétaire attribue les rôles ; les délégations existantes ne sont pas modifiées. Le gestionnaire Membres ne peut agir ni sur lui-même, ni sur l’administrateur, ni sur un compte privilégié (toute délégation, même inconnue, ou MODERATEUR historique). L’administrateur peut gérer les délégués, mais jamais désactiver son propre compte.
- L’ancien MODERATEUR ne reçoit aucun droit nouveau implicitement. Chaque domaine reste indépendant, conformément à la dernière décision explicite de l’utilisateur.

## Fichiers et contrats

- Backend `lib/roles.ts` : registre, permissions, révision incluant statut. Services `publication-suppression.service.ts`, `association.service.ts`, `admin-membres.service.ts` et routes associées.
- `PATCH /admin/membres/:id/statut` : `{action:"DESACTIVER"|"RETABLIR", expectedRevision}` ; retour membre/flags/message. Transaction sérialisable, contrôle concurrent, révocation après succès.
- `GET /admin/membres` et `/admin/roles` accessibles au rôle Membres, mais flags d’édition des rôles absents ; PATCH roles reste propriétaire uniquement.
- Frontend `community/SupprimerContenu.tsx` partagé ; `feed/ActualiteFeed.tsx` garde les IDs supprimés contre réponses GET anciennes et utilise le total de commentaires retourné par l’API. GestionMembres affiche actions séparées avec confirmations et erreurs.

## Vérifications et limites

81 tests backend sur faux delegates Prisma ; aucun serveur SQL, SMTP ou compte réel. 8 groupes de tests UI (dont courses socket/HTTP), 4 scénarios fixtures, 6 groupes garde déploiement. TypeScript valide.

QA navigateur RAM : publication propre/autre, annulation, suppression réussie, refus403, commentaire personnel et compteur, association retirée de l’annuaire, désactivation/rétablissement, protections délégué, mobile320/375. Voir `browser-qa.json` et captures. Pas de téléphone physique/Safari ; les sockets sont testés en mocks, pas dans le serveur fixture HTTP.

Aucune migration : schéma et 14 migrations inchangés. Contrôles production uniquement en lecture ; **aucune suppression, désactivation ou attribution de rôle réelle pour les tests**.

## Exploitation du lot

Version publiée frontend/backend `versions/20260928-suppressions-droits`. Ancienne version `versions/20260928-priorite-membres-home`, build `dj5SeEGNIha9psRUR-GDY`. Sources avant226, consolidées230. Manifest exact comparé côté serveur.

Backend build réussi. Frontend : connexion SSH interrompue lors de npm ci ; reprise contrôlée avec nouvelle installation dans la candidate seulement. Premier build reprend mais échoue sur `next/font` Fraunces (URL non reconnue). Lecture suivante du CSS public Google : trois URLwoff2 valides ; relance simple sans changement de police/code/dependances. Relance réussie sans modification applicative : build `cNI0N04igTlrU9KwyDz4k`. Contrôles candidate puis HTTPS public réussis. Résultats dans `verification.json`, `build-frontend-retry.log` et `frontend-public.json`.

Pour future livraison, adapter à une nouvelle release les scripts, les cibles attendues, le manifeste de référence et le contrat DB. Ne pas recopier aveuglément les anciens scripts. Comparer sources et migrations, build Linux avec URLs publiques, QA Unix privée, baseline publique, backend puis frontend puis contrôles HTTPS. Préserver `.env`, uploads persistants, anciennes versions. Aucune commande de migration ni script métier mutable n’est utilisé ici.

Décision utilisateur confirmée : « Oui, droits par domaine cumulables ». Les nouvelles délégations restent choisies par le propriétaire. Serveurs et onglets QA arrêtés/fermés, viewport rétabli. Aucun commit ni push ; état Git final : 69 fichiers suivis modifiés, 88 entrées non suivies (162 fichiers), HEAD inchangé.
