# SPEC PRODUIT ET TECHNIQUE — BATIBRAIN (registre features consolidé)

Date de mise à jour: 2026-07-12

## Statut du document
- Ce document remplace l'ancien format par phases et tâches.
- Les prompts de génération ont été retirés volontairement.
- Le document décrit uniquement les features, leur niveau de priorité et leur définition fonctionnelle.
- La numérotation du backlog est conservée pour traçabilité legacy et ne constitue pas, à elle seule, le plan de versions.
- La source de vérité de l'IHM reste `docs/ihm/`.
- Les fichiers historiques `docs/product.md` et ancienne version de `docs/spec.md` sont conservés comme contexte legacy.

## Décisions de priorisation validées
- Priorité immédiate:
	- Features de V1, incluant le verrouillage d'édition simple.
- Priorité différée:
	- Features de V2, V2.1 et V3.
- Priorité lointaine:
	- Features de V4 et V5.

## Décisions de versioning validées
- V1:
	- Collaboration projet asynchrone simple.
	- Verrouillage d'édition simple pour éviter les conflits d'édition (sans temps réel complexe).
	- Validation d'adjacence des ouvertures intérieures.
	- Icône de pièce configurable.
	- Vue Mur dédiée (vue de face).
	- Profils de hauteur multiples sur un mur.
	- ProjectMetricsView avec tableau, filtres et exports PDF/Excel/CSV.
- V2:
	- DocumentsView.
	- PhotosView.
- V2.1:
	- PWA (installation, expérience mobile web, offline de base).
- V3:
	- TasksView.
	- WorksView.
	- PlanningView.
- V4:
	- Assistant IA orienté intentions avec validation humaine.
- V5:
	- Moteur 3D complet.
- Hors périmètre actuel:
	- Collaboration temps réel complexe.
	- Moteur de contraintes CAO avancé (aucun besoin additionnel identifié à ce stade).

## Backlog features priorisé (1 = plus prioritaire)

### 0) Paramètres d'application
- Statut: terminée.
- Objectif:
	- Permettre à l'utilisateur de configurer les préférences de base de l'application depuis la barre latérale.
- Portée fonctionnelle cible:
	- Choix des unités de mesure.
	- Choix des unités de surface.
	- Modification du mot de passe.
	- Choix du thème UI, limité pour l'instant à clair, foncé ou system.
- Règles métier minimales:
	- Les paramètres sont accessibles depuis l'entrée Paramètres de la side bar.
	- Le changement de mot de passe est proposé dans le contexte du compte authentifié.
	- La déconnexion est accessible depuis la modale de paramètres.
	- Le thème appliqué reste cohérent sur l'interface courante après sélection.
- Critères d'acceptation:
	- L'utilisateur peut ouvrir la modale de paramètres depuis la side bar.
	- L'utilisateur peut modifier l'unité de mesure sans quitter sa session.
	- L'utilisateur peut choisir une unité de mesure parmi cm, m ou mm, avec cm par défaut.
	- L'utilisateur peut choisir une unité de surface parmi cm2, m2 ou mm2, avec m2 par défaut.
	- L'utilisateur peut choisir un thème clair, foncé ou system, avec system par défaut.
	- L'utilisateur peut lancer le flux de changement de mot de passe depuis les paramètres.
	- L'utilisateur peut se déconnecter depuis les paramètres et revenir à l'écran de login.

### 1) Collaboration projet asynchrone simple (legacy #7)
- Version cible validée: V1.
- Statut: terminée.
- Objectif:
	- Permettre le partage de projet sans temps réel complexe.
- Portée fonctionnelle cible:
	- Un propriétaire unique par projet.
	- Une liste de collaborateurs et d'invitations en attente.
	- Deux rôles collaborateurs appliqués à tout le projet et à toutes ses ressources: lecture et écriture.
	- Invitation par l'adresse e-mail d'un compte BatiBrain existant.
	- Gestion des accès par le propriétaire: inviter, renvoyer ou annuler une invitation, modifier un rôle et retirer un collaborateur.
	- Acceptation explicite depuis la liste des notifications de l'application.
- Règles métier minimales:
	- Seul le propriétaire gère les collaborateurs.
	- Un collaborateur en lecture peut consulter, naviguer et exporter, mais ne peut ni créer, ni modifier, ni supprimer de donnée du projet.
	- Un collaborateur en écriture dispose des droits d'édition sur tout le projet, mais ne gère ni les collaborateurs ni le projet lui-même.
	- Le droit d'écriture est vérifié avant le verrouillage d'édition; détenir ce droit ne dispense pas d'obtenir le verrou requis.
	- Une invitation ne donne accès au projet qu'après son acceptation.
	- Les invitations n'ont ni action de refus ni date d'expiration.
	- La collaboration temps réel complexe et le transfert de propriété restent hors périmètre.
- Critères d'acceptation:
	- Le propriétaire ouvre la gestion des collaborateurs depuis le contexte du projet dans la sidebar.
	- Le propriétaire peut inviter l'adresse e-mail d'un compte existant avec un rôle lecture ou écriture.
	- L'utilisateur invité voit une notification comptabilisée dans le badge de la cloche de l'application.
	- L'utilisateur invité peut accepter l'invitation depuis le bouton situé sur sa ligne descriptive.
	- Après acceptation, le projet partagé apparaît parmi ses projets accessibles.
	- Le propriétaire peut renvoyer ou annuler une invitation en attente, modifier le rôle d'un collaborateur et retirer son accès.
	- Les consultations, exports et modifications respectent le rôle effectif.

### 2) Validation d'adjacence pour ouvertures intérieures (legacy #8)
- Version cible validée: V1.
- Statut: terminée.
- Objectif:
	- Éviter les incohérences métier de pose d'ouvertures intérieures et extérieures.
- Portée fonctionnelle cible:
	- Caractéristique intérieur/extérieur portée par chaque template d'ouverture, sans déduction automatique lors de la pose.
	- Qualification calculée du mur à partir du nombre de pièces auxquelles il appartient.
	- Validation de pose conditionnée à la compatibilité entre le template et le mur support.
- Règles métier minimales:
	- Un mur lié à deux pièces est intérieur; un template intérieur peut y être posé.
	- Un mur lié à une seule pièce est extérieur; un template extérieur peut y être posé.
	- Un template intérieur est refusé sur un mur extérieur et un template extérieur est refusé sur un mur intérieur.
	- Il n'existe pas de détection d'adjacence entre deux murs distincts, de tolérance géométrique ni de recouvrement partiel pour cette règle.
	- Au survol d'un mur incompatible, aucune prévisualisation de l'ouverture n'est affichée.
	- Après une modification topologique, toute ouverture devenue incompatible avec la nouvelle qualification de son mur est supprimée.
- Critères d'acceptation:
	- Un template intérieur peut être posé sur un mur lié à deux pièces et ne peut pas être posé sur un mur lié à une pièce.
	- Un template extérieur peut être posé sur un mur lié à une pièce et ne peut pas être posé sur un mur lié à deux pièces.
	- Aucun aperçu n'est visible lors du survol d'un mur incompatible.
	- Une ouverture intérieure ou extérieure devenue incompatible après recalcul topologique est supprimée.

### 3) Icône de pièce configurable (legacy #9)
- Version cible validée: V1.
- Statut: terminée.
- Objectif:
	- Associer un pictogramme métier à une pièce.
- Portée fonctionnelle cible:
	- Type de pièce persistant choisi dans une liste déroulante à la création et à l'édition.
	- Icône dérivée du type dans le frontend avec `react-icons`, sans champ icône persistant.
	- Affichage sous le nom et la surface dans le dashboard et les vues plan.
	- Options d'affichage des icônes et des surfaces actives par défaut sur tous les canvas et appliquées aux exports PDF.
- Règles métier minimales:
	- Types autorisés: cuisine, chambre, salon, salle de bain, toilettes, bureau, garage, hall, salle de jeu, bibliothèque et autre.
	- Le type `autre` est appliqué par défaut et n'affiche aucune icône.
	- Correspondances: toque, lit, sofa, baignoire, WC, bureau, voiture, porte ouverte, pion et livre.
	- Seul le type est persisté; l'icône est recalculée par le frontend.
- Critères d'acceptation:
	- Le type choisi est restitué après rechargement et produit l'icône correspondante.
	- Une pièce de type `autre` n'affiche aucune icône.
	- Les icônes peuvent être masquées ou réaffichées sur tous les canvas.
	- Les surfaces peuvent être masquées ou réaffichées sur tous les canvas.
	- Les exports PDF respectent ces options d'affichage.

### 4) Vue Mur dédiée (vue de face) (legacy #10)
- Version cible validée: V1.
- Statut: terminée.
- Objectif:
	- Fournir un écran dédié à la lecture et à l'édition d'un mur en vue de face, cohérent avec les autres vues à canvas.
- Portée fonctionnelle cible:
	- Navigation depuis l'action `Ouvrir la vue Mur` du bloc d'édition d'un mur dans les éditeurs 2D global et par pièce.
	- Canvas de face affichant le profil de hauteur, les ouvertures et les mesures pertinentes du côté choisi.
	- Choix entre les deux faces du mur; chaque face porte un profil de hauteur ordonné, lié par défaut à celui de l'autre face et dissociable.
	- Pour un mur mitoyen, chaque face est présentée selon la pièce vers laquelle elle est orientée.
	- Pour un mur extérieur, les faces intérieure et extérieure restent toutes deux éditables.
	- À la création d'une pièce ou d'un mur, les deux faces reçoivent un profil uniforme de 250 cm.
- Règles métier minimales:
	- La vue mur opère dans le contexte projet/niveau/mur courant et conserve la pièce d'origine lorsqu'elle vient de la vue par pièce.
	- Les modifications restent cohérentes avec les invariants géométriques partagés.
	- Le simple changement de face ne modifie ni le mur sélectionné ni les profils.
	- Depuis la vue par pièce, la face initiale est celle orientée vers la pièce d'origine.
	- Sans pièce d'origine, la face initiale est la face intérieure pour un mur extérieur, puis la face gauche dans les autres cas.
	- Les ouvertures sont validées contre la hauteur disponible sur chacune des deux faces.
- Critères d'acceptation:
	- L'action d'édition d'un mur ouvre la vue de face en conservant le contexte courant.
	- L'utilisateur peut afficher et modifier indépendamment le profil de chacune des deux faces.
	- La face affichée initialement respecte la pièce d'origine, puis le caractère extérieur du mur, puis le choix par défaut de la face gauche.
	- Un mur nouvellement créé possède deux profils uniformes de 250 cm.
	- Le propriétaire et le collaborateur en écriture peuvent modifier les profils sous réserve du verrou; le collaborateur en lecture peut les consulter sans les modifier.
	- Une modification invalide pour une ouverture est refusée avec un message explicite.

### 5) Profils de hauteur multiples sur un mur (legacy #12)
- Version cible validée: V1.
- Statut: terminée.
- Objectif:
	- Permettre plus de deux hauteurs sur chacune des deux faces d'un mur via deux profils discrets, liés par défaut et dissociables.
- Portée fonctionnelle cible:
	- Liste ordonnée de points de hauteur pour chaque face d'un mur.
	- Chaque point stocke une distance horizontale depuis le début du mur + hauteur associée.
	- Possibilité de lier les deux profils afin de conserver des positions et hauteurs identiques, avec lien actif par défaut.
- Règles métier minimales:
	- Distances ordonnées et dans les bornes du mur, indépendamment pour chaque face.
	- Cohérence de chaque profil avec les validations existantes des ouvertures.
	- Lorsque le lien est actif, toute modification d'une face est appliquée transactionnellement à l'autre face.
	- Désactiver le lien conserve les deux profils existants et autorise ensuite leur édition indépendante.
	- Réactiver le lien lorsque les profils diffèrent demande confirmation, puis remplace le profil opposé par celui de la face affichée.
- Critères d'acceptation:
	- Chaque face d'un mur supporte plus de deux hauteurs et, lorsque le lien est désactivé, peut être modifiée sans changer l'autre face.
	- Un nouveau mur possède des profils liés par défaut.
	- Lorsque les profils sont liés, toute modification produit deux profils strictement identiques.
	- Après désactivation du lien, chaque face peut être modifiée indépendamment.
	- La remise en liaison confirmée utilise la face affichée comme source et peut être annulée depuis l'historique.
	- Les profils invalides sont refusés avec erreur explicite.

### 6) DocumentsView (legacy #1)
- Fichier IHM cible: `docs/ihm/vues/documents_view.md`.
- Objectif:
	- Centraliser les documents utiles au chantier.
- Portée fonctionnelle legacy explicite:
	- Upload de documents vers Supabase Storage.
	- Listing des documents.
	- Suppression des documents.
	- Rattachement d'un document au projet, à la pièce ou au mur.
- Critère legacy explicite:
	- Upload, listing et suppression opérationnels via Supabase Storage.
- Trous legacy à combler dans la spec IHM détaillée:
	- Types de fichiers autorisés, tailles, quotas, versionning, droits fins.

### 7) TasksView (legacy #2)
- Fichier IHM cible: `docs/ihm/vues/tasks_view.md`.
- Objectif:
	- Gérer les actions de travaux rattachées au projet, à la pièce ou au mur.
- Portée fonctionnelle legacy explicite:
	- CRUD complet des tâches.
	- Gestion du statut de tâche.
	- Gestion de la priorité.
	- Filtrage par projet, pièce et mur.
- Critère legacy explicite:
	- CRUD complet avec statut et priorité.
- Trous legacy à combler dans la spec IHM détaillée:
	- Taxonomie des statuts, dates, affectation, récurrence, dépendances.

### 8) WorksView (legacy #3)
- Fichier IHM cible: `docs/ihm/vues/works_view.md`.
- Version cible validée: V3.
- Objectif:
	- Offrir un module dédié au suivi des travaux, distinct des tâches unitaires.
- Portée fonctionnelle legacy explicite:
	- Intention métier de pilotage travaux confirmée.
- Trous legacy à combler dans la spec IHM détaillée:
	- Contrat écran, objets métier, workflow, états, indicateurs et interactions.

### 9) PhotosView (legacy #4)
- Fichier IHM cible: `docs/ihm/vues/photos_view.md`.
- Objectif:
	- Permettre la gestion des photos de chantier dans le contexte du projet courant.
- Portée fonctionnelle legacy explicite:
	- Existence du module Photos dans la navigation produit.
- Trous legacy à combler dans la spec IHM détaillée:
	- Upload, métadonnées, rattachement métier, tri, suppression, annotation et droits.

### 10) PlanningView (legacy #5)
- Fichier IHM cible: `docs/ihm/vues/planning_view.md`.
- Objectif:
	- Offrir une vue de planification projet.
- Portée fonctionnelle legacy explicite:
	- Présence de la vue Planning dans la navigation.
- Trous legacy à combler dans la spec IHM détaillée:
	- Horizon, granularité temporelle, capacité, jalons, contraintes, dépendances.

### 11) ProjectMetricsView (legacy #6)
- Fichier IHM cible: `docs/ihm/vues/project_metrics_view.md`.
- Version cible validée: V1.
- Objectif:
	- Consolider les indicateurs métier du projet courant.
- Portée fonctionnelle legacy explicite:
	- Cohabitation avec les calculs métier déjà identifiés: surface, périmètre, centroid, angles, génération des murs depuis les sommets.
	- Cohérence attendue entre métriques vues, édition et exports.
- Portée fonctionnelle validée complémentaire:
	- Affichage des métriques sous forme de tableau.
	- Filtres sur les métriques affichées.
	- Exports des métriques en PDF, Excel et CSV.
- Trous legacy à combler dans la spec IHM détaillée:
	- Liste finale des KPIs, segmentations, filtres, comparatifs et périodes.

### 12) Assistant IA orienté intentions avec validation humaine (legacy #11)
- Objectif:
	- Convertir une demande texte en actions structurées, toujours validées avant exécution.
- Portée fonctionnelle cible:
	- Interprétation d'intentions utilisateur.
	- Proposition d'actions prévisualisables.
	- Validation explicite obligatoire avant toute application.
- Critères d'acceptation:
	- Aucune action n'est appliquée sans validation explicite utilisateur.
	- Les actions proposées sont compréhensibles et auditables avant exécution.

### 13) Verrouillage d'édition simple
- Version cible validée: V1.
- Objectif:
	- Empêcher des modifications concurrentes conflictuelles sans implémenter de collaboration temps réel complexe.
- Portée fonctionnelle cible:
	- Verrouillage au niveau du contexte d'édition (projet/niveau/pièce selon le périmètre retenu).
	- Acquisition et libération explicites ou automatiques du verrou.
	- Information visuelle claire lorsqu'un contenu est verrouillé par un autre utilisateur.
- Règles métier minimales:
	- Un seul éditeur actif par ressource verrouillée.
	- Lecture autorisée, écriture bloquée en l'absence de verrou détenu.
	- Expiration ou reprise contrôlée d'un verrou abandonné.
- Critères d'acceptation:
	- Un utilisateur ne peut pas enregistrer des modifications sur une ressource verrouillée par un autre.
	- La vue affiche un état explicite de verrouillage et propose une action adaptée.

### 14) Moteur 3D complet
- Version cible validée: V5.
- Objectif:
	- Fournir une représentation et des interactions 3D complètes du projet.
- Portée fonctionnelle cible:
	- Visualisation 3D cohérente avec les données métier 2D.
	- Navigation, inspection et manipulation 3D selon les règles produit validées.
	- Synchronisation 2D/3D des données de référence.
- Trous à combler dans la spec IHM détaillée:
	- Contrats d'interaction 3D, niveaux de détail, performances attendues, règles de rendu et workflows d'édition.

### 15) PWA (mobile web)
- Version cible validée: V2.1.
- Objectif:
	- Remplacer la cible mobile native initiale par une cible PWA basée sur l'application web.
- Portée fonctionnelle cible:
	- Installation de l'application depuis le navigateur (desktop/mobile).
	- Expérience responsive adaptée aux usages terrain.
	- Support offline de base sur les parcours critiques définis.
	- Capacités web natives PWA (manifest, service worker, stratégie de cache) selon les contraintes métier.
- Trous à combler dans la spec IHM détaillée:
	- Liste des parcours offline prioritaires, politique de synchronisation, résolution de conflits en reprise réseau et critères de performance perçue.

## Invariants métier à conserver (rappel)
- Une pièce est définie par une liste ordonnée de sommets x,y.
- Un mur est le segment entre deux sommets consécutifs.
- Les angles sont calculés, pas stockés.
- Les coordonnées sont globales au niveau.
- Les calculs métier utilisent le centimètre.
- La base est la source de vérité.
- Les valeurs dérivées sont calculées à la lecture.
- La longueur métier de référence d'un mur est la longueur intérieure.

## Informations legacy conservées sans changement de priorité
- Les sujets ci-dessous restent documentés comme acquis ou largement couverts dans l'IHM actuelle:
	- Édition polygonale des pièces avec garde-fous de validité.
	- Magnétisme horizontal/vertical lors du déplacement de sommets.
	- Édition longueur de mur en plan.
	- Calculs géométriques partagés (surface, périmètre, centroid, angles, génération des murs).
	- Persistance Supabase des objets métier principaux.
	- Valeurs par défaut pièce/mur (200x200, 10 cm, 250 cm).
	- Gestion des propriétés mur et des ouvertures avec validations de base.
	- Vue multi-pièces, dashboard, exports PDF plan simple et détail.
	- Vue RoomEditor2D et contrats transverses de sélection/synchronisation.

## Règle de maintenance documentaire
- Toute évolution fonctionnelle d'une feature de ce document doit être reportée dans le fichier IHM cible dans le même changement.
- Si une décision contredit ce document, la décision doit être inscrite ici explicitement pour garder l'historique de priorisation.
