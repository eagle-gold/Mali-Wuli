# Contrat événements et photos — 28 septembre 2026

Implémentation locale autorisée. Aucune migration/publication de ce nouveau lot sans accord explicite (l’accord précédent portait sur associations). Ne pas écrire en base pour les tests.

## Affichage et données

Réutiliser design Inter/Playfair, sable/terre/vert, listes chronologiques groupées par mois et prochain événement mis en avant. Les maquettes sont la référence de structure, pas une autorisation de créer leurs événements en base. Conserver Paris 8e si un exemple est utilisé. Liste publique de l’espace membre = événements publiés ; propositions privées accessibles dans « Mes propositions ». Ne pas promettre un délai de validation de 48 h sans procédure réelle.

Types communs : `staging/frontend/src/types/evenements.ts` (root propriétaire). Les anciens champs type/lieu/dateDebut/dateFin/capacite/valide/nbParticipants/estInscrit/estProprietaire restent inchangés. Ajouter pays, ville, fuseauHoraire (IANA), photoCouverture, programme [{heure,libelle}], resume, statut dérivé VALIDE/EN_ATTENTE/REFUSE, estPasse, peutModifier, peutAjouterPhotos, peutModerer. `organisateur` utilise le résumé Profil existant (id = Profil.id, prenom/nom/nomComplet/photo/titre...). DateDebut et DateFin ISO UTC, fuseau conservé pour affichage exact de l’heure du lieu.

## Routes /api/evenements

- GET `/` conserve `evenements, meta` et paramètres q/type/periode/participation/page/limite. Ajoute pays/ville/statut (`publies`, `en_attente`, `refuses`, `mes`). Sans statut préserver l’ancien contrat visible ; le nouveau frontend envoie `publies`. en_attente/refuses réservés ADMIN/MODERATEUR. `mes` = organisateur courant, tous statuts. Ajoute `compteurs:{aVenir,passes,aValider,mesPropositions}`, `facettes:{pays:string[],villes:string[]}`, `peutModerer:boolean`. Compteurs à venir/passés portent sur publiés sous filtres q/type/pays/ville (indépendants de la pagination/période). aValider global modérateur uniquement, 0 sinon. `estPasse` et filtre: dateFin ou dateDebut <= now ; un événement en cours reste à venir tant qu’une dateFin existe et n’est pas dépassée.
- GET `/:id` => `{evenement,participants:ProfilEvenement[],totalParticipants,photos:PhotoEvenement[],totalPhotos}`. 12 participants, 24 photos initialement. Non publié visible organisateur/modérateur seulement. Participants exposés = comptes validés, profils onboarding terminé. Champs privés jamais retournés.
- GET `/:id/participants?page&limite` => `{participants,meta}` ; GET `/:id/photos?page&limite` => `{photos,meta}`.
- POST `/` JSON et PATCH `/:id` JSON => `{evenement,message}`. Titre3..150, description10..5000, type; pays/ville requis pour nouveau présentiel/hybride, lieu adresse facultative si ville connue ; lienVideo requis en ligne/hybride. Dates futures à la création, fin>début ; cap 2..50000 ou null. Champs programme/summary facultatifs ; resume texte. Pour les PATCH hérités sans nouveaux champs préserver les données. Modifier titre/date/lieu/contenu d’un événement par organisateur remet en attente comme existant, admin conserve état. Le formulaire peut proposer modification via `?modifier=id`.
- PATCH `/:id/validation` `{valide:boolean}` compat : true valide/publie, false refuse et distingue en_attente. Réservé ADMIN/MODERATEUR. Notification organisateur.
- POST `/:id/participer` et DELETE même route : inscription/désinscription existante. Vérifier capacity transactionnel et empêcher inscriptions après début. Déjà inscrit traité de façon idempotente. Historique participant après événement préservé : désinscription passée rejetée (pour éviter de contourner album/présence). Retour `{estInscrit,message}`.
- POST `/:id/couverture` multipart champ `couverture`, DELETE même route => `{evenement}`. Organisateur/modérateur seulement, y compris proposition. Taille <=10 Mio, JPEG PNG WebP.
- POST `/:id/photos` multipart champ `photo`, légende facultative <=300 => `{photo,message}` ; un fichier par requête, frontend multi sélection les envoie séquentiellement avec bilan partiel précis. Droit contrôlé AVANT upload et au moment sauvegarde: participant inscrit d’un événement publié OU organisateur/modérateur. Autorisé après événement. Tous les participants peuvent contribuer ; la restriction organisateur de la maquette est remplacée. Photos visibles directement.
- DELETE `/:id/photos/:photoId` => `{message}` : auteur photo, organisateur ou modérateur, rattachement id vérifié. Supprimer fichier seulement après succès DB ; cleanup fichier créé si échec. Pas de mutation d’un autre événement.
- DELETE `/:id` existante conservée compatible, cleanup photos/couverture après DB ; interface n’est pas obligée de proposer suppression permanente.

Couverture à la création : créer JSON d’abord, envoyer couverture ensuite. Si upload échoue, événement est créé ; montrer erreur et proposer réessayer sur la fiche, NE PAS recréer une proposition. Finir ou réessayer ne doit pas doubler POST création.

## Pages

- `/evenements` : tabs À venir/Passés, compteurs, pays/ville/format, pagination, hero du plus proche, groupes mensuels, CTA participer/annuler pour futur, « Voir le résumé » passé vers détail. Mes propositions permet retrouver attente/refus (query statut=mes). Admin link conditionnel vers `/admin/evenements`.
- `/evenements/proposer` : formulaire pleine page + aperçu, couverture, format, jour/heures, fuseau IANA, pays/ville/adresse, description, programme facultatif, capacité. `?modifier=id` possible pour propriétaire/admin. Pas de promesse 48h.
- `/evenements/[id]` : couverture, date/lieu/programme/description, auteur contact, places et participation, album contributif, participants paginés. Boutons calendrier ICS (download local avec UID/date UTC échappés), partager (copier URL propre). Aucun envoi de message automatique. Contact crée conversation existante seulement au clic.
- `/admin/evenements` : liste en attente, détail de propositions (lien), valider/refuser, erreurs par action ; lien depuis admin index.
- Liens existants depuis agenda/fil vers nouvelles fiches. Conserver synergies et associations.

## Délégation

Backend : school_backend (tous fichiers backend de ce lot). Frontend liste/détail/album/styles : school_frontend. Formulaire/admin et composant style dédié : project_status. Root : types communs, helpers dates/ICS + tests, liens agenda/fil et admin index, intégration, QA, journal.
