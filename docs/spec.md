# SPEC PRODUIT ET TECHNIQUE — BATIBRAIN

Date de mise à jour: 2026-07-06

Objectif: garder une feuille de route unique, claire et exploitable, avec distinction entre ce qui est déjà fait et ce qu'il reste à faire.

Mode d'exécution: projet personnel, sans sprint. On avance par tâches détaillées et validables.

## 1) Etat des développements

### 1.1 Déjà effectué

- Géométrie pièce en vue plan: déplacement de sommets, insertion, suppression avec garde-fous de validité.
- Snapping horizontal/vertical lors du déplacement des sommets.
- Edition de la longueur d'un mur depuis le plan.
- Calculs géométriques partagés: surface, périmètre, centroid, angles, génération des murs depuis les sommets.
- Persistance Supabase des projets, niveaux, pièces, sommets, murs, ouvertures.
- Initialisation des nouvelles pièces en carré 200 cm x 200 cm avec murs par défaut 10 cm et 250 cm.
- Gestion des propriétés mur (épaisseur, hauteur, matériau).
- Ajout et suppression d'ouvertures (porte, fenêtre, autre) sur mur.
- Validation des ouvertures: bornes mur, chevauchement, prise en compte de la hauteur disponible y compris murs en pente.
- Vue multi-pièces d'un niveau, avec coordonnées globales partagées.
- Tableau de bord web avec navigation projet/niveau/pièce et métriques globales.
- Vue niveau avec zoom, déplacement, grille, mesures, focus pièce, liste détaillée des ouvertures.
- Affichage des angles calculés dans la vue pièce (liste textuelle).
- Export PDF simple en vue niveau: plan lisible avec grille, échelle graphique et cartouche minimal (projet, niveau, date).
- Export PDF détaillé en vue niveau: plan, métriques globales et tableaux pièces, murs, ouvertures avec dimensions.

### 1.2 Partiellement effectué

- Dessin des ouvertures sur plan: rendu de base présent, mais pas encore de conventions visuelles métier avancées.

### 1.3 Non effectué

- Prise en compte complète de l'épaisseur des murs dans le rendu plan, avec convention explicite de longueur intérieure.
- Distinction porte intérieure vs porte extérieure.
- Règles d'adjacence entre pièces pour les ouvertures intérieures.
- Affichage des angles directement sur le plan (overlay activable).
- Icône de pièce configurable et affichable.
- Lignes de côte complètes (longueur, hauteur, épaisseur) dans les vues concernées.
- Authentification simple et partage collaboratif de projet.
- Premier déploiement GitHub Pages.

## 2) Règles à respecter

- Une pièce est définie par une liste ordonnée de sommets x,y.
- Un mur est le segment entre deux sommets consécutifs.
- Les angles sont calculés, pas stockés.
- Les coordonnées sont globales au niveau.
- Les calculs métier utilisent le centimètre.
- La base reste la source de vérité.
- Les valeurs dérivées restent calculées à la lecture.

Règle produit ajoutée pour la suite:
- La longueur métier d'un mur correspond à la longueur intérieure.

## 3) Priorisation globale

Ordre de travail à suivre:
1. Finaliser le plan 2D web et les exports.
2. Finaliser les règles métier murs/ouvertures avancées.
3. Ajouter authentification et collaboration simple.
4. Faire un premier déploiement web GitHub Pages.
5. Reprendre les modules Travaux.
6. Reprendre le module Assistant LLM.
7. Lancer le volet Mobile.

## 4) Backlog détaillé par phase

### Phase 1 — Finalisation plan 2D web

#### Tâche 1.1 — Export simple PDF (niveau)
Objectif:
- Exporter un plan lisible avec grille, échelle et cartouche minimal.

Inclut:
- Bouton d'export actif.
- Génération PDF côté web.
- Nom de fichier stable avec projet, niveau, date.

Critères d'acceptation:
- Le PDF contient le plan, la grille, l'échelle graphique et le nom du niveau.
- Le rendu est lisible en A4 portrait ou paysage défini.

Prompt Copilot (texte brut):
Implémente la génération d'un PDF de plan simple depuis la vue niveau. Le document doit inclure le plan, la grille, une échelle graphique en cm et un cartouche avec projet, niveau et date. Branche le bouton d'export existant et ajoute des tests manuels décrits dans la PR.

#### Tâche 1.2 — Export détaillé PDF (niveau)
Objectif:
- Produire un export riche pour exploitation travaux.

Inclut:
- Plan du niveau.
- Liste des pièces avec surfaces.
- Liste des murs et ouvertures avec dimensions.

Critères d'acceptation:
- Le PDF détaillé contient au minimum surface par pièce, nombre de portes/fenêtres, et métriques principales.
- Les valeurs du PDF correspondent aux données affichées dans l'application.

Prompt Copilot (texte brut):
Ajoute un export PDF détaillé dans la vue niveau avec plan, métriques globales et tableau des pièces et ouvertures. Réutilise les fonctions de calcul existantes pour éviter les divergences de valeurs entre UI et PDF.

#### Tâche 1.3 — Dessins métier des ouvertures sur plans
Objectif:
- Améliorer la lisibilité du plan avec conventions visuelles explicites.

Inclut:
- Style distinct porte, fenêtre, autre.
- Légende minimale.

Critères d'acceptation:
- Un utilisateur distingue visuellement une porte d'une fenêtre sans ouvrir le panneau latéral.

Prompt Copilot (texte brut):
Améliore le rendu des ouvertures dans les canvas pièce et niveau avec des styles visuels distincts pour porte, fenêtre et autre. Ajoute une légende simple et vérifie la lisibilité sur fond clair.

#### Tâche 1.4 — Affichage des angles sur les plans
Objectif:
- Afficher les angles directement dans le dessin, avec option activable.

Inclut:
- Toggle afficher/masquer angles.
- Labels d'angle positionnés sans chevauchement majeur.

Critères d'acceptation:
- Les angles sont visibles sur le plan pièce quand l'option est activée.
- L'option est mémorisée au moins pendant la session.

Prompt Copilot (texte brut):
Ajoute un affichage optionnel des angles dans le plan de pièce avec un toggle UI. Les valeurs doivent reprendre les calculs existants et rester lisibles pendant le zoom et le déplacement.

#### Tâche 1.5 — Icône de pièce
Objectif:
- Permettre d'associer un pictogramme à une pièce.

Inclut:
- Champ icône sur la pièce.
- Affichage de l'icône dans dashboard et vues plan.

Critères d'acceptation:
- Une pièce peut être enregistrée avec une icône et l'icône est visible après rechargement.

Prompt Copilot (texte brut):
Ajoute la notion d'icône de pièce avec persistance et affichage dans le dashboard et les plans. Prévois un set restreint d'icônes et une valeur par défaut neutre.

### Phase 2 — Murs et ouvertures avancés

#### Tâche 2.1 — Epaisseur des murs sur plan avec longueur intérieure
Objectif:
- Représenter l'épaisseur des murs graphiquement et fiabiliser la convention métier.

Inclut:
- Rendu mural compatible avec l'épaisseur.
- Clarification de la longueur intérieure comme longueur de référence affichée et exportée.

Critères d'acceptation:
- Le plan montre l'épaisseur des murs.
- Les mesures de longueur affichées correspondent à la longueur intérieure.

Prompt Copilot (texte brut):
Fais évoluer le rendu des murs pour afficher leur épaisseur en plan. La longueur métier affichée et exportée doit être la longueur intérieure. Documente la convention dans la spec et aligne les libellés UI.

#### Tâche 2.2 — Portes intérieures vs extérieures
Objectif:
- Distinguer clairement les portes selon leur contexte d'usage.

Inclut:
- Nouveau typage métier pour les portes.
- Saisie UI explicite.
- Rendu visuel distinct.

Critères d'acceptation:
- Une porte peut être marquée intérieure ou extérieure.
- Le filtre et les métriques reflètent cette distinction.

Prompt Copilot (texte brut):
Ajoute la distinction porte intérieure et porte extérieure dans le modèle de données, les formulaires et les vues. Mets à jour les métriques et l'affichage des listes d'ouvertures.

#### Tâche 2.3 — Adjacence des pièces pour ouvertures intérieures
Objectif:
- Empêcher les incohérences métier sur les ouvertures intérieures.

Inclut:
- Détection des murs adjacents entre pièces.
- Validation contextuelle des ouvertures intérieures.

Critères d'acceptation:
- Une ouverture intérieure ne peut être placée que sur un mur admissible selon les règles définies.
- Les erreurs de validation sont explicites et actionnables.

Prompt Copilot (texte brut):
Implémente une détection d'adjacence entre pièces au niveau des murs et ajoute une validation des ouvertures intérieures basée sur cette adjacence. Les messages d'erreur doivent expliquer pourquoi l'ouverture est refusée.

#### Tâche 2.4 — Lignes de côte (longueur, hauteur, épaisseur)
Objectif:
- Donner une lecture technique directe des dimensions.

Inclut:
- Cotes de longueur sur plan.
- Cotes de hauteur et d'épaisseur dans les vues appropriées.

Critères d'acceptation:
- Les cotes affichent les bonnes unités.
- Les cotes restent lisibles aux niveaux de zoom usuels.

Prompt Copilot (texte brut):
Ajoute des lignes de côte pour les longueurs en plan et pour hauteur et épaisseur dans les vues pertinentes. Garantis la cohérence des unités en centimètres et évite les chevauchements visuels majeurs.

### Phase 3 — Authentification et collaboration simple

#### Tâche 3.1 — Authentification simple
Objectif:
- Permettre une connexion basique et sécurisée.

Inclut:
- Ecran de connexion.
- Session utilisateur.
- Protection minimale des données utilisateur.

Critères d'acceptation:
- Un utilisateur non connecté ne peut pas consulter les projets privés.
- La session persiste après rechargement navigateur.

Prompt Copilot (texte brut):
Implémente une authentification simple avec Supabase Auth pour le web, incluant un flux de connexion minimal, la gestion de session et la protection des données par utilisateur.

#### Tâche 3.2 — Collaboration projet asynchrone
Objectif:
- Autoriser le partage de projet sans temps réel complexe.

Inclut:
- Propriétaire de projet.
- Liste de collaborateurs.
- Droits de base lecture/écriture.

Critères d'acceptation:
- Le propriétaire peut inviter un collaborateur.
- Un collaborateur autorisé peut modifier le projet partagé.

Prompt Copilot (texte brut):
Ajoute une collaboration simple par partage de projet avec rôles de base. Implémente le modèle de permissions minimal côté base et adapte les écrans de gestion du projet.

### Phase 4 — Premier déploiement web

#### Tâche 4.1 — Déploiement GitHub Pages
Objectif:
- Publier une première version web accessible publiquement pour test.

Inclut:
- Workflow CI de build et publication.
- Configuration Vite pour base path compatible Pages.

Critères d'acceptation:
- Le site est disponible sur GitHub Pages.
- Les routes principales et les assets se chargent correctement.

Prompt Copilot (texte brut):
Configure un premier déploiement de l'application web sur GitHub Pages avec un workflow GitHub Actions. Adapte la configuration Vite pour que les assets et routes fonctionnent en environnement Pages.

### Phase 5 — Travaux (après priorités ci-dessus)

#### Tâche 5.1 — Tâches
Objectif:
- Gérer les actions de travaux liées au projet, à la pièce ou au mur.

Critères d'acceptation:
- CRUD complet des tâches avec statut et priorité.

Prompt Copilot (texte brut):
Implémente un module tâches avec création, édition, suivi d'état et filtrage par projet, pièce et mur.

#### Tâche 5.2 — Documents
Objectif:
- Centraliser les documents utiles au chantier.

Critères d'acceptation:
- Upload, listing et suppression de documents via Supabase Storage.

Prompt Copilot (texte brut):
Ajoute la gestion des documents avec upload vers Supabase Storage et rattachement au projet, à la pièce ou au mur.

### Phase 6 — Assistant LLM (après phases 1 à 5)

#### Tâche 6.1 — Interprétation d'intentions
Objectif:
- Transformer une demande texte en action structurée validable.

Critères d'acceptation:
- Chaque proposition d'action est présentée pour validation explicite avant exécution.

Prompt Copilot (texte brut):
Crée une première brique d'assistant qui transforme des demandes texte en actions structurées et demande toujours une validation utilisateur avant application.

### Phase 7 — Mobile (après phases 1 à 6)

#### Tâche 7.1 — Dashboard mobile
#### Tâche 7.2 — Vue niveau mobile
#### Tâche 7.3 — Vue pièce mobile
#### Tâche 7.4 — Vue mur mobile

Objectif global:
- Porter les capacités web stabilisées vers mobile sans diverger de la logique métier partagée.

Critères d'acceptation globaux:
- Les calculs métier restent dans le module partagé.
- Les vues principales mobile couvrent consultation et édition de base.

Prompt Copilot (texte brut):
Crée les écrans mobiles essentiels du produit en s'appuyant sur la logique métier partagée existante, en commençant par dashboard, niveau, pièce puis mur.

## 5) Checklist de suivi

- Chaque tâche commence par une mini spécification d'acceptation.
- Chaque changement de comportement met à jour ce fichier.
- Aucun passage à la phase suivante sans validation fonctionnelle de la phase courante.
- Les prompts restent en texte brut, faciles à copier-coller dans le chat.
