# Produit et interface — passation du 26 septembre 2026

Ce document décrit les décisions finales de l’utilisateur et l’interface observée dans le code local de **MALI-WULI-hostinger-integration**. Le dernier déploiement observé dans cette session date du **21 septembre 2026**. La rédaction du 26 septembre repose sur une lecture du code et des preuves conservées ; elle ne constitue pas une nouvelle vérification du site en production.

Le dépôt lu est `/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration`. Aucune modification de l’application ni aucun déploiement n’a été effectué pour cette passation. Les identifiants et valeurs privées de configuration sont volontairement absents.

## 1. Décisions finales à conserver

Les échanges ont comporté plusieurs itérations. Les choix ci-dessous sont les derniers retenus, même lorsqu’une ancienne capture ou une preuve intermédiaire montre autre chose.

| Sujet | État final demandé et présent dans le code |
| --- | --- |
| Polices | Retour aux polices initiales : **Inter** pour le texte et **Playfair Display** pour les titres. L’essai Source Sans 3 a été annulé. |
| Titre du profil | Afficher **prénom + nom**. Le titre générique « Votre profil » n’est plus le choix final. |
| Navigation publique | Avant connexion, ne pas montrer les rubriques du réseau membre. L’en-tête public présente le logo et les accès au compte. |
| École et lycée | Une même fiche **École / lycée** peut couvrir toute la scolarité dans un établissement et porter plusieurs diplômes. |
| Diplômes scolaires | Pouvoir saisir **brevet ou DEF**, bac et autres diplômes, chacun avec son année, sa mention et sa série ou spécialité si pertinente. |
| Programme scolaire | Il est indépendant du pays où se trouve l’établissement : Liberté à Bamako peut suivre le programme français. |
| Ordre des parcours | **Décision remplacée le 28/09/2026 : du plus récent au plus ancien**, selon la date de début, indépendamment de l’ordre de saisie. Dates absentes en dernier, égalités stables. |
| Insertion | Questions d’insertion professionnelle réservées au **supérieur**. Elles ne doivent pas apparaître pour une école ou un lycée. |
| L1 | Afficher **Licence**, sans « 1re année ». Conserver le complément de spécialité : « L1 - Chimie » devient « Licence - Chimie ». |
| Catalogue | Retirer le badge et l’explication « Proposition en validation » / « Ajout au catalogue à vérifier » des fiches enregistrées. La modération du catalogue reste un mécanisme interne. |
| Champs diplômes | Menus de choix avec **Autre** et saisie personnalisée, puis **Revenir à la liste**. Les champs à suggestions natives du navigateur ont été remplacés. |
| Statut individuel du diplôme | Afficher « Obtenu / En préparation » uniquement lorsque la formation globale est **En cours**. |
| Vocabulaire brevet | Bouton **Ajouter le brevet / DEF**, catégorie **Brevet / DEF**, textes d’aide « brevet ou DEF ». Les noms réels des diplômes enregistrés ne sont pas renommés. |
| Couverture du profil | Une action permet d’ajouter ou de remplacer l’image de couverture. |

Ces décisions ne sont pas des pistes de refonte. Ne pas restaurer une solution intermédiaire sur la seule base d’une capture ancienne.

## 2. Parcours scolaire : modèle et comportement

Le point d’entrée principal est [StepFormations.tsx](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/components/onboarding/StepFormations.tsx). Les deux actions d’ajout sont « Ajouter une école / un lycée » et « Ajouter un établissement supérieur ».

Les types historiques `ecole`, `lycee` et `universite` existent encore pour la compatibilité des données. `ecole` et `lycee` utilisent désormais la même interface scolaire. Cela n’impose pas de réécrire arbitrairement les types canoniques de tous les établissements en base.

### Une fiche, plusieurs diplômes

Une fiche scolaire conserve sa période de fréquentation de l’établissement et contient `diplomesScolaires`. Chaque élément possède :

```ts
{
  type: "BREVET" | "BAC" | "AUTRE";
  libelle: string;
  anneeObtention: string;
  mention: string;
  serie: string;
  statut?: "OBTENU" | "EN_COURS";
}
```

`BREVET` regroupe la catégorie d’interface brevet / DEF, dont les libellés précis peuvent être DNB, DEF ou BEPC suivant le programme. Un brevet de technicien, un BTS ou un brevet professionnel appartient à `AUTRE` : la présence du mot « brevet » ne suffit pas à le classer dans la première catégorie.

Les anciens champs simples `diplome`, `anneePromo`, `mention`, `specialite` sont encore alimentés à partir du diplôme ayant l’année la plus récente. Ils servent à la compatibilité avec les consommateurs historiques. Le tableau multi-diplômes reste à préserver ; ne pas l’aplatir à nouveau en un seul diplôme lors d’une modification.

[parcours-scolaire.ts](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/lib/education/parcours-scolaire.ts) centralise :

- `typeDiplomeScolaire` : classement du diplôme, avec exclusion préalable des brevets techniques et professionnels ;
- `diplomesDuParcoursScolaire` : reprise d’une ancienne fiche à diplôme unique, sans perte de son libellé, année, mention ou série ; un tableau déjà présent fait autorité ;
- `diplomeScolairePrincipal` : choix du diplôme de l’année la plus récente pour les champs historiques ;
- `erreurDiplomeScolaire` : validation du libellé et de l’année de chaque diplôme.

### Périodes et statuts

Le cas de référence demandé par l’utilisateur est **Liberté, scolarité 2012–2019, brevet en 2014 et bac en 2019**. Les deux années sont valides. L’obtention du brevet n’a pas à correspondre à la fin de la scolarité.

Dans le formulaire actuel, une année de diplôme contient quatre chiffres et se situe dans la période de fréquentation. Un diplôme obtenu ne peut pas avoir une année future. Un diplôme en préparation peut avoir une année future, tout en respectant la période saisie. Le formulaire demande actuellement aussi une année pour un diplôme en préparation ; ne pas confondre une éventuelle tolérance de l’API avec cette validation de l’interface.

Les quatre statuts globaux restent : obtenu, en cours, non obtenu et formation non diplômante. Lorsque le statut global est **En cours**, chaque diplôme peut être obtenu ou en préparation : cela permet par exemple un brevet acquis et un bac en préparation sur la même fiche. Le passage du statut global à **Obtenu** force tous les diplômes à `OBTENU` via `choisirStatutDiplome`. Le contrôle de sauvegarde refuse une combinaison incohérente.

Le sélecteur individuel de statut est masqué lorsque le statut global n’est pas `EN_COURS`. Ce masquage répond à la remarque de l’utilisateur sur un champ inutile lorsqu’il ne proposait qu’« Obtenu ».

### Regroupement prudent des anciennes fiches

`fusionnerParcoursScolairesCompatibles`, dans `StepFormations.tsx`, rapproche localement certaines anciennes fiches école et lycée à l’ouverture de l’étape. Il faut notamment le **même identifiant canonique d’établissement**, le même pays, la même ville normalisée, le même programme éducatif effectif et le même statut global. Les deux fiches doivent contenir des diplômes, leurs périodes doivent être compatibles, leurs avis ne doivent pas se contredire et elles ne doivent pas porter de proposition ou de synchronisation catalogue problématique.

Les diplômes sont réunis, la période est étendue et les champs historiques sont recalculés. Des périodes éloignées de plus d’un an ou des données incompatibles ne sont pas fusionnées automatiquement. Les fiches manuelles à identifiant `autre:` sont également exclues.

Ce mécanisme ne signifie **ni que toutes les fiches personnelles anciennes sont regroupées, ni que tout le catalogue d’établissements est dédoublonné**. Il ne faut pas fusionner deux écoles, cycles ou campus parce que leurs noms se ressemblent.

## 3. Programme éducatif, références et libellés

### Programme indépendant de la localisation

`paysCode` décrit la localisation ; `systemeEducatifCode` décrit le programme suivi. Le programme français reste donc possible pour une école située au Mali. Le formulaire peut déduire un programme connu de l’établissement choisi, mais conserve un choix explicite de l’utilisateur.

[reference.ts](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/lib/education/reference.ts) fournit notamment `getSystemeEducatifCode`, `getDiplomes`, `getSeries`, `libelleSystemeEducatif`, `cleReferencesFormation` et `referencesFormationDisponibles`.

Les valeurs du programme sont des codes pays du catalogue, ou `AUTRE` pour un autre programme / programme international. **Ne pas réintroduire `INT`**, qui n’est pas une valeur reconnue par le contrat backend actuel.

Trois routes Next.js participent aux recherches et références :

- [institutions/route.ts](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/app/api/education/institutions/route.ts) : recherche d’établissements et gestion du repli de catalogue ;
- [reference/route.ts](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/app/api/education/reference/route.ts) : références de diplômes et séries, avec le programme éducatif demandé ;
- [programmes/route.ts](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/app/api/education/programmes/route.ts) : recherche des formations du supérieur et normalisation de leur présentation.

Une régression réellement rencontrée venait d’une réponse réseau encore chargée pour le Mali au moment où Liberté basculait vers le programme français. Un clic rapide sur « Ajouter le brevet » ou « Ajouter le bac » créait alors un mauvais diplôme. La correction compare une clé de contexte **type + pays + programme éducatif + établissement** à celle des données reçues. En cas de décalage, `referencesFormationDisponibles` utilise immédiatement les références locales du bon programme. Ne jamais réutiliser aveuglément les anciennes options pendant un chargement.

Autre piège : une ancienne fiche malienne peut posséder des identifiants cachés de diplôme, série ou programme. Après correction vers le programme français, ces références ne doivent pas partir telles quelles au serveur. Le formulaire scolaire efface les identifiants uniques devenus obsolètes et conserve l’identifiant d’établissement. Les libellés personnalisés, eux, doivent rester visibles et ne pas être écrasés silencieusement.

### « Licence » : une normalisation de présentation

`libelleProgramme` dans `reference.ts` est le point central. Il transforme `L1` en `Licence` et reprend aussi les anciennes chaînes déjà enregistrées sous la forme « Licence — 1re année ». Le complément de discipline est conservé. L2 et L3 conservent leur présentation antérieure avec l’année : la dernière demande ne concernait que L1.

Le helper intervient dans les suggestions, la valeur initiale du formulaire, les cartes et le profil, y compris le champ de spécialité susceptible de contenir un ancien libellé brut. La route de recherche sait rechercher à la fois le terme présenté « Licence… » et la forme canonique `L1…`.

**Ce changement ne transforme pas une inscription en L1 en diplôme de licence obtenu.** Le statut et les diplômes acquis restent des données séparées. Les identifiants du catalogue sont conservés, et une réponse backend peut encore contenir un nom canonique commençant par L1 : l’affichage doit continuer à passer par le helper.

## 4. Menus de diplômes et saisie « Autre »

La solution finale réutilise `SelectAvecAutre` et son adaptateur scolaire `SelectScolaireAvecAutre`, tous deux dans `StepFormations.tsx`. Le diplôme, la mention et la série / spécialité utilisent un vrai menu déroulant. Choisir **Autre** ouvre une saisie libre ; **Revenir à la liste** rétablit le menu. Les anciennes listes natives `<datalist>` ne sont plus présentes dans ce composant.

Les mentions proposées comprennent Passable, Assez bien, Bien, Très bien, Très honorable et Félicitations du jury, ainsi qu’Autre. La mention est facultative et peut rester vide.

Une valeur enregistrée mais absente des options — par exemple la mention « Excellence » — doit se rouvrir dans la saisie personnalisée. Le composant mémorise le texte personnalisé lors d’un aller-retour liste → Autre. Si un changement de programme rend le libellé courant inconnu, celui-ci reste visible dans la saisie libre au lieu de produire un menu apparemment vide.

Les lignes de diplômes possèdent des clés stables propres à l’interface. Supprimer la première ligne ne doit pas déplacer le mode « Autre » ou le texte personnalisé de la deuxième. Ces clés ne sont pas des identifiants métier à enregistrer dans l’API.

## 5. Tri, avis et insertion

**Ancienne règle remplacée le 28 septembre 2026 sur demande explicite :** le tri ancien → récent devient récent → ancien. [periode.ts](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/lib/periode.ts) fournit `trierParDateDebut`, décroissant par défaut (année et mois de début), sans mutation ; les dates inconnues restent à la fin et les égalités conservent leur ordre. Ce choix couvre le profil personnel/public et les formulaires expériences/formations. L’option interne `"croissant"` reste obligatoire dans `fusionnerParcoursScolairesCompatibles`, dont l’algorithme rapproche les périodes de la plus ancienne à la plus récente. Le poste affiché dans le titre du profil reste le poste actuel ou le plus récent.

[suivi.ts](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/lib/education/suivi.ts) porte les règles de recul et d’insertion. Pour une école ou un lycée, l’avis devient disponible après obtention et **un an après la sortie de l’établissement**, pas un an après le brevet intermédiaire. Avant cette échéance, la fiche peut être enregistrée sans avis. Lorsque l’avis est demandé, le formulaire attend les trois notes et le commentaire. Les valeurs d’avis devenues inéligibles sont nettoyées lors de l’enregistrement.

Les questions d’insertion sont affichées uniquement pour `universite` lorsque la formation n’est plus en cours. Elles distinguent recherche d’emploi, poursuite d’études ou autre démarche, puis le délai de première activité et son lien avec la formation lorsque pertinent. Les champs d’insertion d’une fiche scolaire sont remis à `null` à la sauvegarde.

Ne pas confondre « pas d’insertion pour le scolaire » avec « pas d’avis sur le scolaire ». Ne pas calculer un taux d’emploi en prenant tous les anciens étudiants comme dénominateur : les règles de suivi distinguent les personnes recherchant un emploi et les réponses suffisamment anciennes et exploitables.

## 6. Sauvegarde : ce que les boutons font réellement

Le contrôleur est [la page onboarding](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/app/(auth)/onboarding/page.tsx). Le parcours comprend l’accueil, les informations, les formations, les expériences, le mentorat, puis la confirmation. Les paramètres `?etape=informations`, `formations`, `experiences` ou `mentorat` permettent d’ouvrir une étape depuis le profil.

| Action | Effet actuel |
| --- | --- |
| Saisir une formation | État React du formulaire ouvert. |
| « Enregistrer cette formation » / « Enregistrer les modifications » | Met à jour la liste React interne de `StepFormations` et ferme l’éditeur. **Ne sauvegarde pas encore le profil via `/onboarding`.** |
| « Continuer » vers l’étape suivante | Appelle `onNext`, met à jour l’état de la page parent et son brouillon dans `localStorage`. |
| Terminer l’étape mentorat | `terminerOnboarding` agrège le profil et effectue **POST `/onboarding`**. La confirmation n’est affichée qu’après succès. |
| Erreur de ce POST final | Message d’erreur, brouillon local conservé, pas de confirmation de succès. |

Le cache utilise la clé applicative `mali_wuli_onboarding_profile`. Au chargement, la page lit ce cache puis lance **GET `/onboarding`**. Une réponse serveur réussie remplace l’état et le cache local. Si la requête échoue, le cache permet de reprendre temporairement ; un cache illisible est ignoré.

**Limite actuelle à connaître :** recharger ou quitter avant « Continuer » peut perdre les modifications de la liste locale de l’étape. Même après « Continuer », une réouverture avec un GET serveur réussi peut remplacer un brouillon non encore envoyé par l’ancienne version serveur. Il n’existe pas, dans ce flux observé, de sauvegarde serveur à chaque étape ni de résolution des conflits entre brouillon et profil serveur. Ce sont des améliorations possibles, pas des fonctionnalités livrées.

Deux exceptions empêchent de résumer toute l’application par « aucun POST avant la fin » :

- Les nouveaux termes de catalogue peuvent déclencher immédiatement **POST `/education/catalogue/suggestions`** depuis l’enregistrement d’une fiche. Cette requête porte les propositions de catalogue, pas l’ensemble du profil.
- La photo de profil et la couverture ont leurs propres enregistrements immédiats depuis le profil.

L’enregistrement final exige que les étapes informations, formations et expériences aient été parcourues et présentes dans l’objet complet ; les tableaux vides sont admis. Pour un test de persistance, aller jusqu’à la confirmation puis rouvrir le parcours est indispensable.

### Le badge catalogue supprimé ne supprime pas la modération

Les informations `propositionsCatalogue` et `synchronisationCatalogue` existent toujours. L’interface conserve les retours transitoires **ENREGISTREMENT…** et **SYNCHRONISATION À REFAIRE** en cas d’échec, mais n’affiche plus le badge de validation après réussite. Ne pas supprimer le traitement des suggestions backend pour justifier ce choix d’affichage.

## 7. Profil, navigation et apparence

[ProfilMembre.tsx](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/components/profile/ProfilMembre.tsx) adapte les données du profil, trie formations et expériences, affiche les diplômes scolaires avec leur programme, année, mention et série, et utilise `libelleProgramme` pour les libellés du supérieur. Le titre assemble le prénom et le nom, avec un repli générique si aucun nom n’est disponible. Les types associés sont dans [profile.ts](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/types/profile.ts).

La couverture utilise un envoi multipart sur **POST `/users/me/couverture`**, champ `couverture`. L’interface accepte JPEG, PNG et WebP jusqu’à 10 Mio, met à jour `profil.photoCouverture` après succès et conserve un fond par défaut en l’absence d’image. La résolution des médias passe par [media.ts](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/lib/media.ts). Ne pas confondre cette image avec la photo de profil ni rattacher son enregistrement à la fin de l’onboarding.

[MaliWuliHeader.tsx](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/components/MaliWuliHeader.tsx) contient **PublicHeader et MemberHeader dans le même fichier**. Le public voit les accès création de compte / connexion, ou les accès à son espace lorsque la session locale est présente. Les rubriques du réseau appartiennent à l’en-tête membre. Les contrôles desktop et mobile sont tous deux nécessaires. Le masquage d’un lien n’est pas une protection d’accès : [PlatformAuthGuard.tsx](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/components/auth/PlatformAuthGuard.tsx) et les contrôles backend restent des sujets distincts.

Les polices sont configurées dans [layout.tsx](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/app/layout.tsx), [tailwind.config.ts](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/tailwind.config.ts) et [globals.css](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/app/globals.css). Le rendu final attendu est **Inter / Playfair Display**. Une première preuve de déploiement mentionne Source Sans 3 ; la preuve du rollback, postérieure, l’emporte.

L’écran de confirmation construit un lien d’invitation `/register?parrain=<id>` à partir de l’identifiant renvoyé par `/users/me`, avec un lien d’inscription générique en repli. Cela décrit l’entrée visible du parrainage ; ne pas en déduire l’existence de récompenses ou d’automatismes sans vérifier les règles backend.

## 8. Vérifications utiles avant une nouvelle livraison

Les scénarios suivants couvrent les demandes et les régressions réellement rencontrées. Utiliser des données de test, puis vérifier la réouverture après sauvegarde finale pour les cas de persistance.

| Scénario | Résultat attendu |
| --- | --- |
| Liberté, Mali, programme français, période 2012–2019 | Une seule fiche, brevet/DNB 2014 et bac français 2019 acceptés ; aucune obligation d’aligner le brevet sur 2019. |
| Choisir Liberté et ajouter immédiatement brevet puis bac, avant retour réseau | Références françaises dès les premiers clics ; jamais un ancien bac malien ni un brevet de technicien utilisé comme brevet scolaire. |
| Modifier une ancienne fiche ML en programme FR | Pas d’erreur causée par un identifiant caché de diplôme/série ML ; établissement et données personnalisées conservés. |
| Scolarité globale en cours : brevet obtenu et bac en préparation | Deux statuts individuels possibles. Passer le global à obtenu force les deux à obtenu et masque les menus individuels. |
| Année de diplôme avant/après la période, année sur trois chiffres, diplôme obtenu dans le futur | Sauvegarde bloquée avec retour compréhensible. |
| Mention existante « Excellence », puis Revenir à la liste → Autre | La saisie personnalisée réapparaît ; Très honorable et la valeur vide restent disponibles dans la liste. |
| Trois diplômes avec plusieurs champs personnalisés, puis suppression du premier | Les autres lignes conservent leurs valeurs et leur mode de saisie. Sauvegarde finale puis réouverture identiques. |
| Changement FR → ML alors qu’un libellé français était choisi | Le libellé devient une valeur personnalisée visible s’il n’est plus dans la nouvelle liste ; aucun menu vide masquant la donnée. |
| Ajouter les périodes 2008, 2005 puis 2006 | Cartes formations, expériences et profil classées 2008 → 2006 → 2005 (nouvelle décision du 28/09). |
| Rechercher L1 - Chimie, Licence - Chimie et ancien libellé Licence — 1re année - Chimie | Présentation Licence - Chimie et identifiant canonique conservé ; aucune mention « 1re année » résiduelle sur formulaire/carte/profil. |
| École/lycée puis supérieur terminé | Aucune insertion sur le scolaire ; questions pertinentes sur le supérieur. L’avis scolaire reste soumis à un an après la sortie. |
| Anciennes fiches école/lycée du même établissement | Fusion seulement si toutes les conditions de compatibilité sont réunies ; conserver séparées les fiches ambiguës. |
| Fiche avec suggestion catalogue réussie | Pas de badge Proposition en validation / Ajout au catalogue à vérifier ; un échec réel garde son retour de synchronisation. |
| Modifier, enregistrer la fiche, continuer et terminer | POST complet au dernier écran, puis données retrouvées après réouverture. Distinguer ce test de la simple mise à jour visuelle locale. |
| Profil et pages publiques sur desktop, 390 px et 320 px | Prénom + nom, absence de débordement, boutons photo/couverture utilisables, navigation membre absente en visite anonyme. |
| Couverture valide puis fichier invalide | Image valide persistée ; fichier refusé sans écraser la précédente. |
| Police calculée dans le navigateur | Corps Inter ; titres Playfair Display. |

Le fichier [parcours-scolaire.test.ts](/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend/src/lib/education/parcours-scolaire.test.ts) comporte neuf régressions ciblées : multi-diplômes et dates, futur, reprise d’ancien format, tri, références françaises, libellé Licence, ouverture des avis, réponse de références périmée et brevets professionnels.

Depuis la racine du dépôt d’intégration, les commandes employées étaient :

```sh
npm run type-check --prefix frontend
backend/node_modules/.bin/tsx --test frontend/src/lib/education/parcours-scolaire.test.ts
```

Ces contrôles ont été rapportés comme réussis lors des travaux du 21 septembre ; ils n’ont pas été relancés pour écrire ce document. Le runner `tsx` utilisé se trouve dans les dépendances backend, et ne correspond pas à un script `test` frontend dédié.

## 9. Preuves et limites de la passation

Les preuves locales suivantes sont disponibles dans ce dossier :

- [Profil, écoles, navigation et première livraison](preuves/verification-profile-schools-2026-09-21.json) : neuf tests frontend, contrôles multi-diplômes, curriculum, profil et responsive. **La police de cette première livraison a été remplacée ensuite.**
- [Libellé Licence](preuves/verification-licence-label-2026-09-21.json) : recherches des trois variantes et identifiants préservés.
- [Menus Autre et retour aux polices initiales](preuves/verification-school-selects-font-rollback-2026-09-21.json) : polices calculées, valeurs personnalisées, retrait d’une ligne et sauvegarde complète suivie d’une réouverture.
- [Statuts des diplômes](preuves/verification-diploma-status-2026-09-21.json) : affichage conditionnel et cohérence globale.
- [Libellé brevet / DEF](preuves/verification-brevet-def-label-2026-09-21.json) : quatre textes de présentation, sans changement des diplômes stockés.

La déduplication exhaustive du catalogue n’est pas acquise. Un audit a été mené, distinct des corrections ciblées et du regroupement local de fiches scolaires. Des noms proches, coordonnées communes ou noms de villages ne suffisent pas à autoriser une fusion globale.

Les améliorations de sauvegarde intermédiaire et de gestion des conflits brouillon/serveur restent à concevoir si elles sont demandées. Une donnée historique anormale « formation obtenue, diplôme encore en préparation » peut être bloquée par la validation ; le changement explicite vers le statut global obtenu normalise les lignes, mais il ne faut pas présenter cela comme une migration automatique de tout l’historique.

Pour reprendre le travail, partir des décisions finales ci-dessus, lire le composant concerné et son helper, puis choisir les scénarios QA liés à la modification. Les anciennes captures et versions de preuve doivent toujours être replacées dans leur ordre chronologique.
