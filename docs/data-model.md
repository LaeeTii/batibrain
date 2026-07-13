# Modèle de données BatiBrain

Date de mise à jour: 2026-07-12

## Objectif
Ce document décrit le modèle de données métier actuel, reconstruit à partir des spécifications dans `docs/ihm/`.

Ce document ne remplace pas les sources fonctionnelles principales (`docs/ihm/`), mais fournit un référentiel unifié pour:
- les entités métier,
- leurs relations,
- les invariants transverses,
- les règles du domaine et les garanties minimales de persistance,
- le niveau de maturité de chaque domaine.

## Portée des règles
- Sauf mention contraire, les règles et valeurs par défaut de ce document sont des règles métier implémentées dans `web/src/domain/`.
- À la création, le code applicatif fournit explicitement toutes les valeurs par défaut fonctionnelles à Supabase.
- Ces règles ne deviennent pas automatiquement des clauses `DEFAULT` ou `CHECK` PostgreSQL.
- La base de données conserve les garanties structurelles durables: clés étrangères, unicité technique, données structurelles obligatoires, RLS et atomicité des écritures liées.
- Une validation défensive côté base n'est justifiée que si elle protège l'intégrité technique ou la sécurité, indépendamment de l'évolution du produit.

## Sources utilisées
- `docs/ihm/logique/geometry.md`
- `docs/ihm/logique/edition_2D_synchronisation_selection.md`
- `docs/ihm/vues/dashboard_view.md`
- `docs/ihm/vues/editeur_2d_global.md`
- `docs/ihm/vues/room_editor_2d_view.md`
- `docs/ihm/vues/wall_editor_view.md`
- `docs/ihm/composants/sections.md`
- `docs/ihm/composants/transverses.md`
- `docs/ihm/composants/pdf.md`
- `docs/ihm/vues/tasks_view.md`
- `docs/ihm/vues/documents_view.md`
- `docs/ihm/vues/photos_view.md`
- `docs/ihm/vues/works_view.md`
- `docs/ihm/vues/planning_view.md`
- `docs/ihm/vues/project_metrics_view.md`

## Statut de maturité par domaine
| Domaine | Statut | Commentaire |
|---|---|---|
| Projet / niveaux / pièces / murs / faces / profils de hauteur / ouvertures / côtes / notes | Stabilisé | Contrats IHM détaillés disponibles (vues + logique + composants). |
| Authentification / session / profil | Stabilisé | Contrats détaillés disponibles dans LoginView et SettingsModal. |
| Collaboration projet | Stabilisé | Propriété, rôles globaux et invitations applicatives définis pour la V1. |
| Verrouillage manuel | Stabilisé | État persistant indépendant pour les pièces, murs et ouvertures. |
| Exports PDF plan et plan + détail | Stabilisé | Matrice complète de templates et données minimales définies. |
| Tâches | Legacy minimal | Intention et exigences minimales définies, détail IHM à compléter. |
| Documents | Legacy minimal | Intention et exigences minimales définies, détail IHM à compléter. |
| Photos | Legacy minimal | Intention uniquement, détail IHM à compléter. |
| Travaux | Legacy minimal | Intention uniquement, détail IHM à compléter. |
| Planning | Legacy minimal | Intention uniquement, détail IHM à compléter. |
| Métriques projet avancées | Legacy minimal | Orientation globale définie, KPIs détaillés à arbitrer. |

## Entités coeur (stabilisées)

### UserSession
Représente la session d'authentification active.

Champs minimaux:
- `userId`
- `accessToken`
- `refreshToken` (selon provider)
- `rememberMe`
- `expiresAt`

Règles:
- L'accès aux vues métier nécessite une session valide.
- Sans session valide, redirection vers LoginView.
- Après déconnexion, la session locale est invalidée.

### Project
Projet courant de rénovation.

Champs minimaux:
- `id`
- `name`
- `description` (optionnel)
- `ownerUserId`
- `editingLockUserId` (optionnel)
- `editingLockLastActivityAt` (optionnel)
- `updatedAt`
- `isSoftDeleted`

Règles:
- Le projet courant est le contexte global des vues métier.
- Si aucun projet n'est explicitement sélectionné, le projet courant par défaut est le dernier projet modifié.
- Un projet supprimé logiquement est exclu des listes actives par défaut.
- Un projet possède un propriétaire unique.
- Un utilisateur accède à un projet s'il en est propriétaire ou si une collaboration acceptée le lui autorise.
- Le verrou d'édition collaboratif porte sur le projet entier et n'est actif que si `editingLockUserId` est renseigné et si `editingLockLastActivityAt` date de moins de deux minutes selon l'heure du serveur.
- La première modification persistée sur un projet libre ou dont le verrou a expiré attribue atomiquement le verrou à son auteur autorisé.
- Chaque modification effectivement persistée par le détenteur met à jour `editingLockLastActivityAt`; une tentative refusée ou invalide ne le renouvelle pas.
- Pendant les deux minutes suivant la dernière modification, les autres utilisateurs conservent la lecture mais aucune écriture sur les objets du projet.
- Après deux minutes sans modification, le verrou est considéré comme libre sans remise à zéro préalable des deux champs; l'acquisition suivante les remplace atomiquement.

### UserProfile
Représente les informations applicatives du compte, distinctes des identifiants gérés par Supabase Auth.

Champs minimaux:
- `userId`
- `displayName`
- `firstName`
- `lastName`
- `avatarStoragePath` (optionnel)
- `role` (`user`, `admin`)

Règles:
- Un profil appartient à un unique utilisateur Supabase Auth et partage son identifiant.
- `displayName` est obligatoire et unique parmi les profils BatiBrain.
- Le prénom et le nom sont persistés séparément.
- L'avatar est stocké dans un bucket Supabase Storage privé; seul son chemin est persisté dans le profil.
- Un avatar est une image JPEG, PNG, WebP ou GIF de 5 Mio maximum, stockée sous le préfixe privé de l'identifiant utilisateur.
- La modification personnelle passe par `update_own_profile`, qui ne reçoit jamais le rôle et refuse tout chemin d'avatar appartenant à un autre utilisateur.
- L'utilisateur authentifié peut créer, lire et modifier uniquement son propre profil.
- Tout nouveau compte approuvé reçoit le rôle `user`.
- Le rôle est modifiable uniquement par un administrateur et n'est jamais accepté depuis une mise à jour de profil personnelle.
- Le premier administrateur est promu manuellement dans Supabase après la création de son compte.
- Un administrateur ne peut ni rétrograder ni supprimer son propre compte.
- Toute modification de rôle ou suppression de compte doit conserver au moins un administrateur.
- La suppression est confirmée avec le nombre courant de projets possédés; le serveur refuse l'opération si ce nombre a changé depuis l'affichage.
- La suppression du compte Supabase Auth cascade physiquement sur son profil, ses projets possédés et toutes les données dépendantes de ces projets.
- L'adresse e-mail et le mot de passe ne sont pas dupliqués dans le profil: ils restent gérés par Supabase Auth.
- Une nouvelle adresse e-mail devient l'adresse active uniquement après confirmation du flux Supabase Auth.

### AccountCreationRequest
Représente une demande de compte déposée avant la création de l'utilisateur Supabase Auth.

Champs minimaux:
- `id`
- `email`
- `displayName`
- `firstName`
- `lastName`
- `status` (`en_attente`, `approuvée`)
- `approvedByUserId` (optionnel)
- `approvedAt` (optionnel)
- `createdAt`

Règles:
- La demande ne contient aucun mot de passe et n'accorde aucun accès à l'application.
- Une seule demande en attente peut exister pour une même adresse e-mail ou un même nom d'affichage.
- Les administrateurs voient chaque demande en attente comme une notification.
- L'approbation crée le compte Supabase Auth, crée son profil avec le rôle `user` et envoie l'invitation de définition du mot de passe.
- Si l'adresse e-mail ou le nom d'affichage n'est plus disponible au moment de l'approbation, celle-ci échoue explicitement sans créer de compte partiel.
- Le dépôt utilise la RPC publique `submit_account_creation_request`; elle normalise l'adresse e-mail et sérialise les contrôles d'unicité concurrents avant l'insertion.
- L'approbation est initiée par la fonction serveur `approve-account-request`, réservée à un administrateur authentifié. La création du profil et la mise à jour de la demande sont déclenchées dans la transaction d'insertion `auth.users`, afin qu'aucun utilisateur Auth partiel ne subsiste en cas d'échec.
- Les demandes `en_attente`, lisibles uniquement par les administrateurs, constituent la source de leurs notifications de compte sans duplication dans une table dédiée.

### ProjectCollaboration
Représente l'accès accepté d'un utilisateur à l'ensemble d'un projet.

Champs minimaux:
- `id`
- `projectId`
- `userId`
- `role` (`lecture`, `écriture`)

Règles:
- Une collaboration porte sur le projet entier et toutes ses ressources.
- Le rôle lecture autorise consultation, navigation et exports, sans création, modification ni suppression.
- Le rôle écriture autorise l'édition, sauf gestion des collaborateurs et modification du projet lui-même.
- Le droit d'écriture est contrôlé avant le verrou d'édition applicable.
- Seul le propriétaire peut modifier le rôle ou retirer la collaboration.

### ProjectInvitation
Représente une invitation en attente adressée à un compte BatiBrain existant.

Champs minimaux:
- `id`
- `projectId`
- `invitedUserId`
- `invitedEmail`
- `role` (`lecture`, `écriture`)
- `status` (`en_attente`, `acceptée`, `annulée`)

Règles:
- L'adresse invitée doit correspondre à un compte existant.
- L'acceptation explicite transforme l'accès en collaboration effective.
- Une invitation en attente peut être renvoyée ou annulée par le propriétaire.
- Aucune action de refus et aucune expiration ne sont prévues.

### Level
Niveau d'un projet.

Champs minimaux:
- `id`
- `projectId`
- `name`
- `levelNumber` (entier)
- `isVisible`
- `isSoftDeleted`

Règles:
- Un niveau appartient à un seul projet.
- Le niveau `0` est obligatoire et non supprimable.
- Au moins un niveau doit rester visible dans l'éditeur global.
- Un seul niveau est éditable à un instant donné.
- Un niveau supprimé logiquement est exclu des listes actives par défaut.

### Room
Pièce d'un niveau.

Champs minimaux:
- `id`
- `projectId`
- `levelId`
- `name`
- `type` (`cuisine`, `chambre`, `salon`, `salle_de_bain`, `toilettes`, `bureau`, `garage`, `hall`, `salle_de_jeu`, `bibliotheque`, `autre`)
- `floorColor`
- `wallThicknessCm`
- `wallHeightCm`
- `isSoftDeleted`
- `isLocked` (booléen; initialisé à `false` par le domaine)

Règles:
- Si `name` est vide à la création, la valeur par défaut est `Nouvelle pièce`.
- `type` est obligatoire et vaut `autre` par défaut.
- L'icône n'est pas persistée: le frontend la dérive du type avec `react-icons`.
- Les correspondances sont: toque, lit, sofa, baignoire, WC, bureau, voiture, porte ouverte, pion et livre; `autre` ne produit aucune icône.
- La suppression dans le dashboard est logique (`isSoftDeleted = true`).
- Les pièces supprimées logiquement sont masquées par défaut et exclues des exports globaux par défaut.
- Une pièce verrouillée reste sélectionnable et consultable, mais ne peut être ni modifiée ni supprimée avant son déverrouillage.

### Vertex
Sommet 2D d'une pièce dans le repère du niveau.

Champs minimaux:
- `id` (recommandé)
- `roomId`
- `orderIndex`
- `xCm`
- `yCm`

Règles:
- Une pièce est un polygone fermé ordonné de sommets.
- L'ordre des sommets doit rester stable pour garantir le calcul des murs, angles, surfaces et périmètres.

### Wall
Segment support et propriétés métier associées.

Champs minimaux:
- `id`
- `roomId` (ou liaison topologique équivalente)
- `startVertexId`
- `endVertexId`
- `thicknessCm`
- `heightProfilesLinked` (booléen; initialisé à `true` par le domaine)
- `material` (optionnel)
- `insulation` (optionnel)
- `isLocked` (booléen; initialisé à `false` par le domaine)

Règles:
- La longueur métier de référence est la longueur intérieure.
- Un mur peut être lié à 0, 1 ou 2 pièces.
- Un mur ne peut jamais être lié à 3 pièces.
- Lorsqu'une troisième pièce rejoint l'intérieur d'un mur existant, un sommet est créé au point de jonction: le mur existant est remplacé par deux murs partageant ce sommet et le mur aboutissant de la troisième pièce constitue le troisième mur de la jonction.
- Mur lié à 1 pièce: extérieur pour cette pièce.
- Mur lié à 2 pièces: intérieur/mitoyen pour les deux.
- Un mur possède exactement deux faces stables, `gauche` et `droite`, définies relativement au segment ordonné de `startVertexId` vers `endVertexId`.
- Chaque face possède son propre profil de hauteur ordonné; les profils peuvent être liés ou indépendants.
- `heightProfilesLinked = true` impose des listes de positions et de hauteurs strictement identiques sur les deux faces.
- Lorsque le lien est actif, toute modification est appliquée aux deux profils dans une même transaction.
- Désactiver le lien conserve les deux profils sans les modifier.
- Réactiver le lien après divergence remplace, après confirmation, le profil de la face opposée par celui de la face affichée.
- Lors d'une inversion du segment, les profils sont permutés afin de rester rattachés à la même face physique.
- Dans RoomEditor2DView, la suppression d'un mur mitoyen est interdite.
- Un mur verrouillé reste sélectionnable et consultable, mais ne peut être ni modifié ni supprimé avant son déverrouillage.

### WallFaceHeightProfilePoint
Point du profil de hauteur d'une face d'un mur.

Champs minimaux:
- `id`
- `wallId`
- `faceSide` (`gauche`, `droite`)
- `positionCm` (distance horizontale depuis `startVertexId`)
- `heightCm` (hauteur locale au point)

Règles:
- Les points sont triés par `positionCm` croissante au sein de chaque couple `wallId`/`faceSide`.
- Chaque face possède au minimum un point à `0` et un point à la longueur du mur.
- À la création d'une pièce ou d'un mur, ces deux points utilisent `defaultWallHeightCm` sur chacune des deux faces.
- À la création, `heightProfilesLinked` vaut `true`.
- `positionCm` reste dans l'intervalle `[0, longueurDuMurCm]` et deux points d'une même face ne partagent pas la même position.
- `heightCm` est strictement positive.
- Deux points couvrent un profil uniforme ou une pente simple; plus de deux points couvrent un profil multi-hauteurs.
- Pour un mur mitoyen, l'association affichée entre face et pièce est calculée depuis la topologie.
- Pour un mur extérieur, l'association affichée distingue la face intérieure de la face extérieure; les deux profils restent éditables.

### Opening
Ouverture positionnée sur un mur (porte, fenêtre, baie, autre).

Champs minimaux:
- `id`
- `wallId`
- `templateId`
- `type`
- `placementType` (`intérieur`, `extérieur`)
- `startRatio` ou position équivalente
- `widthCm`
- `heightCm`
- `bottomCm` (allège)
- `orientation` (si applicable)
- `isLocked` (booléen; initialisé à `false` par le domaine)

Règles:
- Une ouverture doit rester entièrement comprise dans son mur support.
- Les ouvertures d'un même mur ne se chevauchent pas.
- La hauteur utile de l'ouverture doit respecter la hauteur disponible du mur.
- `placementType` reprend la caractéristique du template utilisé; il n'est pas déduit du mur lors de la pose.
- Une ouverture intérieure est compatible uniquement avec un mur lié à deux pièces.
- Une ouverture extérieure est compatible uniquement avec un mur lié à une pièce.
- Après une modification topologique, une ouverture devenue incompatible avec la qualification calculée du mur est supprimée.
- Une ouverture verrouillée reste sélectionnable et consultable, mais ne peut être ni modifiée ni supprimée avant son déverrouillage.

### OpeningTemplate
Modèle sélectionnable utilisé pour créer une ouverture.

Champs minimaux:
- `id`
- `name`
- `type` (`porte`, `fenêtre`, `baie vitrée`, `autre`)
- `placementType` (`intérieur`, `extérieur`)

Règles:
- Chaque template déclare explicitement une caractéristique intérieur ou extérieur.
- Cette caractéristique détermine les murs admissibles pendant la pose.
- Le type intérieur/extérieur du template n'est jamais déduit automatiquement du mur survolé.

### Dimension
Cote de mesure rattachée au niveau actif.

Champs minimaux:
- `id`
- `levelId`
- `name`
- `type` (`point-point`, `wall-wall`, `point-on-wall`)
- `distanceCm`
- `offsetCm`
- `referenceA`
- `referenceB`

Règles:
- Une cote de distance nulle est invalide.
- Une cote devient persistante après validation du décalage.

### Note
Note métier rattachée au projet ou à un objet (pièce, mur, point, ouverture, niveau).

Champs minimaux:
- `id`
- `projectId`
- `originType`
- `originId` (optionnel si note projet)
- `text`

Règles:
- Sans sélection d'objet, une note est rattachée au projet.
- Si l'objet parent disparaît, la note reste accessible via son rattachement projet.

### DisplayOptions
Options d'affichage (affichage/masquage) de l'éditeur.

Champs minimaux:
- `showGrid`
- `showRules`
- `showDimensions`
- `showAngles`
- `showNotes`
- `showRoomSurfaces`
- `showRoomIcons`

Règles:
- `showRoomSurfaces` vaut `true` par défaut.
- `showRoomIcons` vaut `true` par défaut.
- Ces options pilotent les surfaces et les icônes sur tous les canvas et dans leurs exports PDF.

### SnappingOptions
Options de magnétisme (snapping).

Champs minimaux:
- `snapGrid`
- `snapVertices`
- `snapIntersections`
- `snapWalls`
- `snapMidpoints`
- `snapDistanceCm`

### SelectionState
État de sélection transverse.

Champs minimaux:
- `selectedType`
- `selectedId`
- `selectedLevelId` (si applicable)
- `source` (`canvas`, `creation-list`, `detail-tree`, `project-notes-bubble`)

Règles:
- La sélection active est unique à un instant donné.
- La dernière intention explicite gagne.
- Une sélection invalide est nettoyée.

### UserPreferences
Préférences persistées de l'utilisateur courant.

Champs minimaux:
- `userId`
- `lengthUnit` (`cm`, `m`, `mm`)
- `surfaceUnit` (`m2`, `cm2`, `mm2`)
- `theme` (`clair`, `foncé`, `system`)
- `defaultWallHeightCm`
- `defaultWallThicknessCm`

Règles:
- Les préférences sont spécifiques à l'utilisateur authentifié.
- Les valeurs par défaut sont `cm` pour les longueurs et `m2` pour les surfaces.
- Les valeurs initiales sont `250 cm` pour `defaultWallHeightCm` et `10 cm` pour `defaultWallThicknessCm`.
- La hauteur et l'épaisseur de mur par défaut sont strictement positives et persistées en centimètres, quelle que soit l'unité d'affichage.
- Leur modification s'applique uniquement aux pièces et murs créés ensuite et ne modifie aucune donnée métier existante.
- Les préférences sont relues au démarrage de session pour initialiser l'UI.

## Entités legacy minimales (à compléter)

### Task
Intention minimale: CRUD de tâches avec statut et priorité, filtrées par projet, niveau, pièce, mur.

Champs minimaux connus:
- `id`
- `projectId`
- `levelId` (optionnel)
- `roomId` (optionnel)
- `wallId` (optionnel)
- `title`
- `status`
- `priority`

Points à arbitrer:
- Taxonomie détaillée des statuts.
- Affectation utilisateur.
- Échéances, récurrence, dépendances.

### Document
Intention minimale: upload, listing, suppression, rattachement projet/pièce/mur.

Champs minimaux connus:
- `id`
- `projectId`
- `roomId` (optionnel)
- `wallId` (optionnel)
- `name`
- `storagePath`
- `mimeType`

Points à arbitrer:
- Quotas, versioning, droits fins, workflow de validation.

### Photo
Intention minimale: gestion des photos de chantier dans le contexte projet.

Champs minimaux connus:
- `id`
- `projectId`
- `name` (optionnel)
- `storagePath`

Points à arbitrer:
- Métadonnées, annotation, tri, rattachements fins.

### WorkItem
Intention minimale: module de suivi des travaux distinct des tâches et documents.

Champs minimaux connus:
- `id`
- `projectId`
- `name`

Points à arbitrer:
- Workflow, états, KPIs, interactions avec tâches/planning.

### PlanningItem
Intention minimale: vue de planification dans le contexte du projet courant.

Champs minimaux connus:
- `id`
- `projectId`
- `name`

Points à arbitrer:
- Horizon, granularité temporelle, jalons, contraintes, dépendances.

### ProjectKpi
ProjectMetricsView ne correspond pas à une entité persistée. Elle projette les données du projet courant dans trois tableaux ordonnés:
- pièces;
- murs;
- ouvertures.

Les colonnes exposent les propriétés sources utiles à l'identification et toutes les métriques calculables applicables, notamment:
- pour une pièce: niveau, nom, type, surface, périmètre, centroïde, nombre de sommets, nombre de murs et hauteurs ou épaisseurs de référence applicables;
- pour un mur: niveau, pièces liées, longueur intérieure, épaisseur, qualification intérieure ou extérieure, profils liés et hauteurs de ses deux faces;
- pour une ouverture: niveau, pièce ou pièces adjacentes, mur support, template, type, distance depuis le début du mur, largeur, hauteur, altitude et surfaces calculables.

Chaque colonne est filtrable et triable selon son type. Une valeur sans objet est non applicable, jamais assimilée à zéro. Les valeurs suivent les unités choisies par l'utilisateur et restent calculées depuis les entités sources.

## Relations
- `Project` 1..n `Level`
- `Project` 1..n `ProjectCollaboration`
- `Project` 1..n `ProjectInvitation`
- `Level` 1..n `Room`
- `Room` 1..n `Vertex`
- `Room` 1..n `Wall` (ou liaison topologique équivalente)
- `Wall` 4..n `WallFaceHeightProfilePoint` (au moins deux points ordonnés sur chacune des deux faces)
- `Wall` 1..n `Opening`
- `OpeningTemplate` 1..n `Opening`
- `Level` 1..n `Dimension`
- `Project` 1..n `Note`
- `UserSession` 1..1 `UserPreferences`
- `UserSession` 1..1 `UserProfile`
- `UserProfile` 1..n `AccountCreationRequest` approuvées en tant qu'administrateur
- `Project` 1..n `Task` (legacy minimal)
- `Project` 1..n `Document` (legacy minimal)
- `Project` 1..n `Photo` (legacy minimal)
- `Project` 1..n `WorkItem` (legacy minimal)
- `Project` 1..n `PlanningItem` (legacy minimal)

## Invariants transverses
- Les données accessibles à un utilisateur appartiennent à ses projets ou aux projets dont il a accepté la collaboration.
- Les politiques RLS appliquent la même matrice à toutes les ressources imbriquées du projet: propriétaire en gestion complète, collaborateur `lecture` en consultation, collaborateur `écriture` en consultation et écriture métier, utilisateur sans accès sans lecture ni écriture.
- La modification du projet, des invitations et des collaborations reste réservée au propriétaire; chaque collaborateur peut uniquement lire sa propre ligne d'accès et chaque utilisateur invité peut lire sa propre invitation.
- Une invitation en attente ne satisfait jamais les droits de lecture ou d'écriture du projet.
- Les options de vue sont des réglages propres à l'utilisateur: il peut créer ou modifier uniquement les siennes lorsqu'il dispose au moins d'un accès en lecture au projet.
- Un utilisateur ne peut écrire que son propre profil et ses propres objets d'avatar.
- Seul un administrateur peut lire l'ensemble des profils, modifier les rôles, consulter ou approuver les demandes de compte et supprimer un utilisateur.
- La suppression d'un utilisateur propriétaire supprime physiquement ses projets puis, par cascade, l'ensemble des données qui en dépendent.
- La gestion des collaborateurs est réservée au propriétaire du projet.
- Unités métier: centimètre pour géométrie et mesures; m2 pour surfaces.
- Les coordonnées partagent le même repère au sein d'un niveau.
- Les valeurs dérivées (surface, angle, périmètre, orientation) sont calculées, pas stockées comme source primaire.
- Après modification topologique (coupe/intersection), recalculer segments élémentaires et relations mur-pièce.
- Une jonction entre trois pièces est représentée par trois murs distincts autour d'un sommet partagé; elle ne crée jamais une troisième liaison sur un même mur.
- En cas d'édition d'un mur mitoyen, la cohérence des deux pièces doit être conservée.
- La qualification intérieure ou extérieure d'un mur est dérivée de son nombre de pièces liées et n'est pas persistée comme source primaire.
- L'orientation d'une face vers une pièce ou vers l'extérieur est dérivée de la topologie; seule sa position stable gauche/droite et son profil sont persistés.
- Une ouverture doit respecter la hauteur disponible sur les deux faces du mur à toute position qu'elle occupe.
- Lorsque `heightProfilesLinked` est actif, les deux profils sont enregistrés atomiquement et restent strictement identiques.
- Après recalcul topologique, supprimer toute ouverture dont `placementType` est incompatible avec la qualification de son mur support.
- Les verrous manuels d'une pièce, d'un mur et d'une ouverture sont persistés indépendamment et ne se propagent pas en cascade.
- Le propriétaire et les collaborateurs en écriture peuvent verrouiller ou déverrouiller ces ressources; un collaborateur en lecture consulte leur état sans pouvoir le modifier.
- Le contrôle du droit d'écriture précède le changement de verrou manuel; le verrou manuel est contrôlé avant toute autre modification ou suppression de la ressource et ne remplace pas le verrou d'édition collaboratif.

## Persistance et suppression
- Source de vérité persistée: Supabase/PostgreSQL.
- La source de vérité des règles métier et des valeurs initiales est `web/src/domain/`; PostgreSQL stocke le résultat explicitement fourni par l'application.
- PostgreSQL ne porte pas de valeur par défaut fonctionnelle ni de validation métier évolutive.
- Les écritures liées qui ne peuvent pas être partiellement appliquées utilisent une transaction, notamment la mise à jour de deux profils de hauteur liés.
- Suppression logique explicitement définie pour les pièces dans le dashboard.
- Les suppressions physiques et politiques d'archivage des autres domaines restent à arbitrer.

## Exports PDF (données minimales)
Templates stabilisés:
- `pdf_dashboard_global_plan_simple`
- `pdf_dashboard_global_plan_detail`
- `pdf_global_editor_plan_simple`
- `pdf_global_editor_plan_detail`
- `pdf_room_editor_piece_plan_simple`
- `pdf_room_editor_piece_plan_detail`

Contraintes:
- Les options d'affichage actives influencent le rendu.
- Les options de magnétisme n'influencent pas le rendu.
- Les sections obligatoires du détail incluent au minimum: contexte document, plan de la pièce, meta export.

## Hors périmètre à arbitrer explicitement
- Taxonomie complète des statuts de tâche et règles de cycle de vie.
- Modèle détaillé documents/photos (droits, versioning, quotas).
- Modèle complet travaux/planning.
- Modèle final des KPIs produit.

## Note de gouvernance
En cas de conflit entre ce document et une spécification dans `docs/ihm/`, demander un arbitrage explicite à l'utilisateur avant implémentation.
