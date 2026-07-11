# SPEC PRODUIT ET TECHNIQUE — BATIBRAIN (registre features consolidé)

Date de mise à jour: 2026-07-10

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
- Objectif:
	- Éviter les incohérences métier de pose d'ouvertures intérieures.
- Portée fonctionnelle cible:
	- Détection des murs adjacents entre pièces.
	- Validation de pose conditionnée à l'adjacence admissible.
- Règles métier minimales:
	- Une ouverture intérieure n'est autorisée que sur un mur admissible.
	- Message explicite quand la règle est violée.
- Critères d'acceptation:
	- Pose refusée sur mur non admissible avec explication.
	- Pose acceptée sur mur admissible.

### 3) Icône de pièce configurable (legacy #9)
- Objectif:
	- Associer un pictogramme métier à une pièce.
- Portée fonctionnelle cible:
	- Champ icône dans le modèle pièce.
	- Affichage de l'icône en dashboard et vues plan.
	- Set restreint d'icônes + valeur par défaut neutre.
- Règles métier minimales:
	- Une pièce sans icône explicite conserve la valeur par défaut.
	- L'icône persiste et est restituée après rechargement.
- Critères d'acceptation:
	- Changement d'icône visible et persistant.

### 4) Vue Mur dédiée (vue de face) (legacy #10)
- Objectif:
	- Fournir un écran dédié à l'édition/lecture d'un mur selon la maquette cible.
- Portée fonctionnelle cible:
	- Navigation vers une vue mur dédiée depuis le flux produit.
	- Structure et interactions conformes à la maquette de référence.
	- Affichage/édition des propriétés mur, ouvertures et cotes pertinentes en vue de face.
- Règles métier minimales:
	- La vue mur opère dans le contexte projet/niveau/pièce/mur courant.
	- Les modifications restent cohérentes avec les invariants géométriques partagés.
- Critères d'acceptation:
	- Vue mur disponible et utilisable.
	- Alignement maquette validé.

### 5) Profils de hauteur multiples sur un mur (legacy #12)
- Objectif:
	- Permettre plus de deux hauteurs sur un même mur via un profil discret.
- Portée fonctionnelle cible:
	- Liste ordonnée de points de hauteur pour un mur.
	- Chaque point stocke une distance horizontale depuis le début du mur + hauteur associée.
- Règles métier minimales:
	- Distances ordonnées et dans les bornes du mur.
	- Cohérence du profil avec les validations existantes des ouvertures.
- Critères d'acceptation:
	- Un mur supporte plus de deux hauteurs.
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
