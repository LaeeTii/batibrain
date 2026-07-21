# Modèle de données BatiBrain

Date de mise à jour: 2026-07-20

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
| Authentification / session / profil | Stabilisé | Contrats détaillés disponibles dans LoginView, AccountModal et PreferencesModal. |
| Collaboration projet | Stabilisé | Propriété, rôles globaux et invitations applicatives définis pour la V1. |
| Verrouillage géométrique | Stabilisé | Verrous persistés sur les sommets et points de profils; états des autres objets calculés. |
| Exports PDF plan et plan + détail | Stabilisé | Matrice complète de templates et données minimales définies. |
| Tâches | Legacy minimal | Intention et exigences minimales définies, détail IHM à compléter. |
| Documents | Legacy minimal | Intention et exigences minimales définies, détail IHM à compléter. |
| Photos | Legacy minimal | Intention uniquement, détail IHM à compléter. |
| Travaux | Legacy minimal | Intention uniquement, détail IHM à compléter. |
| Planning | Legacy minimal | Intention uniquement, détail IHM à compléter. |
| Métriques projet avancées | Stabilisé | Trois projections, filtres, tris et périmètre d'export définis; le contrat détaillé des formats d'export reste un prérequis d'implémentation. |

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
- `updatedAt`
- `isSoftDeleted`

Règles:
- Le projet courant est le contexte global des vues métier.
- Si aucun projet n'est explicitement sélectionné, le projet courant par défaut est le dernier projet modifié.
- Un projet supprimé logiquement est exclu des listes actives par défaut.
- Un projet possède un propriétaire unique.
- Un utilisateur accède à un projet s'il en est propriétaire ou si une collaboration acceptée le lui autorise.
- La création d'un projet exige un profil BatiBrain approuvé; sa modification et sa suppression logique passent par `update_owned_project`, réservé au propriétaire.
- Le verrou collaboratif global du projet est reporté après la V1.0 et sera respécifié avant implémentation.
- Les éventuels champs techniques legacy de verrou collaboratif ne font pas partie du contrat métier cible de la V1.

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
- Le profil initial est créé uniquement lors de l'approbation serveur; les écritures directes de `user_profiles` sont révoquées au rôle authentifié.
- L'utilisateur authentifié peut lire son propre profil et le modifier uniquement par `update_own_profile`.
- Tout nouveau compte approuvé reçoit le rôle `user`.
- Le rôle est modifiable uniquement par un administrateur et n'est jamais accepté depuis une mise à jour de profil personnelle.
- Le premier administrateur est promu manuellement dans Supabase après la création de son compte, selon la [procédure dédiée](./exploitation-premier-administrateur.md), sans donnée personnelle ni provisionnement dans les migrations.
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
- Les insertions, modifications et suppressions directes de demandes sont révoquées aux rôles applicatifs afin d'empêcher tout contournement de ces deux frontières.
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
- Les modifications de rôle et retraits passent respectivement par `change_project_collaborator_role` et `remove_project_collaborator`; les écritures directes sont révoquées au rôle authentifié.

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
- L'adresse invitée doit correspondre à un compte BatiBrain approuvé disposant d'un profil; une identité Supabase Auth sans profil ne suffit pas.
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

Règles:
- Si `name` est vide à la création, la valeur par défaut est `Nouvelle pièce`.
- `type` est obligatoire et vaut `autre` par défaut.
- L'icône n'est pas persistée: le frontend la dérive du type avec `react-icons`.
- Les correspondances sont: toque, lit, sofa, baignoire, WC, bureau, voiture, porte ouverte, pion et livre; `autre` ne produit aucune icône.
- La suppression dans le dashboard est logique (`isSoftDeleted = true`).
- Les pièces supprimées logiquement sont masquées par défaut et exclues des exports globaux par défaut.
- Le passage à l'état supprimé est une transformation topologique: les relations actives mur-pièce sont recalculées et l'opération entière est refusée si elle devrait supprimer ou remplacer un sommet verrouillé.
- L'état verrouillé de la pièce est calculé: tous les murs de son contour, et donc tous leurs sommets, doivent être verrouillés.
- Verrouiller ou déverrouiller une pièce modifie les verrous de tous les sommets des murs de son contour.
- Une pièce calculée verrouillée ne peut pas être déplacée, transformée topologiquement ni supprimée; son nom, son type, sa couleur de sol et ses notes restent modifiables.

### Vertex
Sommet topologique 2D partagé dans le repère du niveau.

Champs minimaux:
- `id` (recommandé)
- `levelId`
- `xCm`
- `yCm`
- `isLocked` (booléen; initialisé à `false` par le domaine)

Règles:
- Un sommet possède une identité unique même lorsqu'il est référencé par plusieurs murs ou contours de pièces.
- Le sommet est persisté une seule fois dans `vertices`; une pièce est un polygone fermé ordonné dont l’ordre est porté par l’association `piece_vertices`.
- L'ordre des sommets d'une pièce doit rester stable pour garantir le calcul des murs, angles, surfaces et périmètres.
- Le sommet est l'unique source persistée du verrouillage géométrique du plan.
- Un sommet verrouillé ne peut être ni déplacé ni supprimé.
- Un point partagé transmet son état verrouillé à tous les murs, pièces et côtes qui le référencent.

Garanties de persistance:
- `vertices.level_id` fixe le repère commun du niveau.
- `piece_vertices` garantit un ordre unique par pièce et interdit la répétition d’un même sommet dans un contour.
- Les extrémités d’un mur référencent directement les identifiants canoniques de `vertices`.

### Wall
Segment support et propriétés métier associées.

Champs minimaux:
- `id`
- `linkedRoomIds` (association topologique contenant zéro, un ou deux identifiants de pièce)
- `startVertexId`
- `endVertexId`
- `thicknessCm`
- `heightProfilesLinked` (booléen; initialisé à `true` par le domaine)
- `material` (optionnel)
- `insulation` (optionnel)

Règles:
- La longueur métier de référence est la longueur intérieure.
- Un mur peut être lié à 0, 1 ou 2 pièces.
- Un mur est une entité autonome: son existence ne dépend pas d'une pièce unique, tandis que chaque segment de contour d'une pièce référence le mur qui matérialise cette frontière.
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
- L'état verrouillé du mur est calculé: ses deux sommets doivent être verrouillés.
- Verrouiller ou déverrouiller un mur modifie le verrou de ses deux sommets.
- Un mur calculé verrouillé ne peut pas être déplacé, détaché, scindé, supprimé ni recevoir une modification d'épaisseur.
- Son matériau, son isolation et ses notes restent modifiables.
- Une modification de longueur conserve le sommet verrouillé comme ancrage; si aucun sommet n'est verrouillé, le sommet de début est l'ancrage par défaut; si les deux le sont, la modification est refusée.

Garanties de persistance:
- `walls.level_id` rattache aussi les murs détachés à un niveau.
- Un trigger structurel refuse l’insertion d’une troisième relation dans `wall_pieces` et toute relation entre un mur et une pièce de niveaux différents.
- Le mur ne possède plus de colonne de verrou métier; son état est toujours projeté depuis ses deux sommets.

### WallFaceHeightProfilePoint
Point du profil de hauteur d'une face d'un mur.

Champs minimaux:
- `id`
- `wallId`
- `faceSide` (`gauche`, `droite`)
- `positionCm` (distance horizontale depuis `startVertexId`)
- `heightCm` (hauteur locale au point)
- `isLocked` (booléen; initialisé à `false` par le domaine)

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
- Le point de profil est l'unique source persistée du verrouillage géométrique de sa face.
- Un point de profil verrouillé ne peut pas être déplacé, modifié ni supprimé.
- Un profil est calculé verrouillé lorsque tous ses points sont verrouillés.
- Verrouiller ou déverrouiller un profil modifie le verrou de tous ses points.
- Lorsque les profils sont liés, les états `isLocked` des points correspondants sont synchronisés avec leurs positions et hauteurs.

Garantie transactionnelle:
- Un point verrouillé ne peut être modifié ou supprimé par `save_level_geometry` que si le même instantané contient son déverrouillage autorisé.

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
- `orientation` (`normal` ou `inverse`)
- `hingeSide` (`left` ou `right`)

Règles:
- Une ouverture doit rester entièrement comprise dans son mur support.
- Les ouvertures d'un même mur ne se chevauchent pas.
- La hauteur utile de l'ouverture doit respecter la hauteur disponible du mur.
- `placementType` reprend la caractéristique du template utilisé; il n'est pas déduit du mur lors de la pose.
- Une ouverture intérieure est compatible uniquement avec un mur lié à deux pièces.
- Une ouverture extérieure est compatible uniquement avec un mur lié à une pièce.
- Après une modification topologique, une ouverture devenue incompatible avec la qualification calculée du mur est supprimée.
- Une ouverture ne possède aucun verrou géométrique propre.
- Le sens et le côté ouvrant sont persistés pour tous les types d'ouverture et modifiables indépendamment.
- Sa position, ses dimensions, ses propriétés et sa suppression restent modifiables lorsque son mur support est verrouillé, sous réserve des droits projet et des autres validations.
- Aucune colonne de verrou n’est persistée sur une ouverture.

## Frontière transactionnelle géométrique

- `load_level_geometry(levelId)` renvoie les pièces actives ainsi que tous les sommets et murs du niveau, y compris les murs autonomes sans pièce, avec leurs relations, profils complets, ouvertures, templates et la révision courante.
- `save_level_geometry(levelId, expectedRevision, snapshot)` est l’unique écriture géométrique V1.
- Le domaine valide l’instantané avant l’appel: contours, arêtes, cardinalité, profils, ouvertures et verrous.
- PostgreSQL verrouille la ligne du niveau, contrôle la révision attendue et revérifie les sommets et points de profils verrouillés avant la première mutation.
- Avant de réécrire l'instantané, la transaction retire aussi les murs autonomes déjà persistés et leurs sommets devenus orphelins; leurs identifiants peuvent ainsi être réutilisés sans conflit lors des sauvegardes successives.
- Un déverrouillage et la modification du même point peuvent être persistés ensemble.
- Toute erreur restaure l’état complet précédent, y compris ouvertures, profils et révision.
- Les anciennes RPC partielles et les écritures directes des tables géométriques ne sont plus exposées au rôle applicatif.

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
- Une cote est calculée verrouillée pour ses interactions géométriques lorsqu'elle référence un mur verrouillé ou un sommet verrouillé.
- Une cote calculée verrouillée ne peut pas être repositionnée ni supprimée.

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
- `snapGuides`
- `snapDistanceCm`

Règles:
- `snapGuides` vaut `true` par défaut et active l'accrochage séparé sur les axes horizontaux et verticaux des sommets de référence.
- Les lignes de guide sont un état visuel temporaire calculé pendant le geste; seules les préférences de magnétisme sont persistées.

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
- Les préférences déterminent les unités de saisie et d'affichage, sans modifier l'unité interne des données déjà enregistrées.
- Les coordonnées et longueurs sont normalisées en centimètres, et les surfaces en centimètres carrés, avant calcul ou persistance.
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
- `Level` 1..n `Vertex`
- `Room` n..n `Vertex` via une association de contour ordonnée
- `Room` n..n `Wall` via une association topologique limitée à deux pièces par mur
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
- Unités internes: centimètre pour la géométrie et les longueurs, centimètre carré pour les surfaces.
- Unités de saisie et d'affichage: préférences de l'utilisateur courant, avec `cm` et `m2` comme valeurs initiales.
- Les coordonnées partagent le même repère au sein d'un niveau.
- Les valeurs dérivées (surface, angle, périmètre, orientation) sont calculées, pas stockées comme source primaire.
- Après modification topologique (coupe/intersection), recalculer segments élémentaires et relations mur-pièce.
- Refuser avant toute mutation du brouillon une modification géométrique qui déplacerait, remplacerait ou supprimerait un sommet ou un point de profil verrouillé.
- Une jonction entre trois pièces est représentée par trois murs distincts autour d'un sommet partagé; elle ne crée jamais une troisième liaison sur un même mur.
- En cas d'édition d'un mur mitoyen, la cohérence des deux pièces doit être conservée.
- La qualification intérieure ou extérieure d'un mur est dérivée de son nombre de pièces liées et n'est pas persistée comme source primaire.
- L'orientation d'une face vers une pièce ou vers l'extérieur est dérivée de la topologie; seule sa position stable gauche/droite et son profil sont persistés.
- Une ouverture doit respecter la hauteur disponible sur les deux faces du mur à toute position qu'elle occupe.
- Lorsque `heightProfilesLinked` est actif, les deux profils sont enregistrés atomiquement et restent strictement identiques.
- Après recalcul topologique, supprimer toute ouverture dont `placementType` est incompatible avec la qualification de son mur support.
- Les seuls verrous géométriques persistés sont ceux des sommets du plan et des points de profils.
- Les états verrouillés des murs, pièces, côtes et profils sont calculés depuis leurs points.
- Le propriétaire et les collaborateurs en écriture peuvent modifier ces verrous; un collaborateur en lecture consulte leur état sans pouvoir le modifier.
- Le contrôle du droit d'écriture précède le changement de verrou.
- Les effets sur les objets partageant un point sont volontaires et recalculés immédiatement dans le brouillon.
- Le contrat complet est défini dans [verrouillage_geometrique.md](./ihm/logique/verrouillage_geometrique.md).

## Persistance et suppression
- Source de vérité persistée: Supabase/PostgreSQL.
- La source de vérité des règles métier et des valeurs initiales est `web/src/domain/`; PostgreSQL stocke le résultat explicitement fourni par l'application.
- PostgreSQL ne porte pas de valeur par défaut fonctionnelle ni de validation métier évolutive.
- Les écritures liées qui ne peuvent pas être partiellement appliquées utilisent une transaction, notamment la mise à jour de deux profils de hauteur liés.
- Le domaine refuse toute interaction géométrique impliquant un point verrouillé avant la première mutation du brouillon.
- Une sauvegarde peut déverrouiller des points et appliquer leurs modifications géométriques dans une transaction unique; en cas d'échec, la base conserve son état précédent complet.
- La transaction refuse une modification géométrique d'un point verrouillé dans l'état courant persisté, sauf si le même instantané autorisé contient son déverrouillage.
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
