# Plan d’implémentation de la V1

Date de mise à jour : 2026-07-12

## Mode d’emploi

Ce document est une file de tâches ordonnée. Chaque tâche est conçue pour être confiée seule à un agent IA et terminée en une intervention comprenant l’analyse ciblée, le code, les tests et la documentation directement concernée.

Pour avancer, demander simplement : `Implémente V1-XX`.

Les tâches doivent être réalisées dans l’ordre. Il n’est pas nécessaire de demander l’implémentation d’un lot.

## Règles communes

- Lire `docs/projet.md`, puis les spécifications concernées avant chaque tâche.
- Considérer `docs/ihm/` comme source fonctionnelle principale.
- Placer les types et la logique métier frontend dans `web/src/domain/`.
- Utiliser Supabase/PostgreSQL comme source des données persistées.
- Conserver les migrations appliquées immuables et ajouter toute évolution de persistance dans une nouvelle migration `<YYYYMMDDHHMMSS>_<description>.sql` sous `supabase/migrations/`, avec un préfixe numérique unique avant le premier `_`.
- Calculer les données dérivées au lieu de les persister.
- Ne pas prendre le code actuel de `web/` comme référence fonctionnelle.
- Ne pas introduire de fonctionnalité prévue après la V1.
- Terminer chaque tâche par les tests pertinents, `npm run check` et la mise à jour documentaire concernée.

## Tâches ordonnées

### V1-01 — Restructurer le socle frontend et installer les tests

Auditer le code existant face aux specs, créer les répertoires domaine, données, fonctionnalités, composants et vues, configurer le client Supabase et ses variables, puis installer les tests unitaires et d’intégration. La tâche est terminée lorsque l’application démarre, qu’une configuration invalide est signalée et que le test témoin ainsi que `npm run check` passent.

### V1-02 — Implémenter les primitives et calculs géométriques

Définir point, segment et polygone, puis implémenter distance, vecteur, projection, longueur intérieure, surface, périmètre, centroïde, orientation et angles en centimètres. Couvrir rectangles, polygones concaves, orientation inversée, coordonnées négatives et cas dégénérés par des tests unitaires.

### V1-03 — Implémenter le domaine des pièces

Définir pièce et sommets ordonnés, les valeurs initiales 200 × 200 cm, le type, la couleur, la fermeture implicite et les validations de nombre de sommets, coordonnées et auto-intersections. Chaque invalidité doit produire une erreur métier exploitable par l’interface.

### V1-04 — Implémenter le domaine des murs et la topologie

Définir mur, faces stables et relations mur-pièce, générer les murs depuis les sommets, calculer leur caractère intérieur ou extérieur, conserver leurs propriétés après modification et scinder un mur lorsqu’une troisième pièce rejoint son intérieur. Tester qu’aucun mur n’est lié à plus de deux pièces.

### V1-05 — Implémenter les profils de hauteur

Définir les points ordonnés distance/hauteur, initialiser deux profils uniformes à 250 cm et liés, valider leurs bornes, gérer liaison, dissociation, remise en liaison et permutation des faces lors d’une inversion du segment. Tester les profils liés et indépendants.

### V1-06 — Implémenter le domaine des ouvertures

Définir templates et instances, placement, dimensions, caractère intérieur/extérieur, adjacence et validation contre les deux profils du mur. Une ouverture incompatible doit être refusée avant persistance ou identifiée pour suppression après une modification topologique.

### V1-07 — Aligner la migration initiale Supabase sur le domaine V1

Aligner la migration initiale sur profils, préférences, demandes de compte, projets, collaborations, invitations, niveaux, pièces, sommets, murs, faces, profils, ouvertures, côtes, notes, options de vue et verrous manuels. Retirer du schéma cible les domaines hors V1 non nécessaires. Vérifier l’initialisation complète d’une base vide. Après son application, cette migration devient immuable et les tâches suivantes ajoutent des migrations incrémentales.

### V1-08 — Implémenter les transactions métier Supabase

Créer les opérations transactionnelles pour la création complète d’une pièce, la scission topologique avec recalcul des relations et ouvertures, et l’écriture des profils liés. Tester que chaque opération réussit entièrement ou laisse la base inchangée.

### V1-09 — Implémenter les politiques RLS des projets

Écrire et tester les politiques de toutes les ressources projet pour propriétaire, collaborateur en lecture, collaborateur en écriture et utilisateur sans accès. La matrice de tests doit couvrir lecture, écriture, gestion du projet et gestion des collaborateurs.

### V1-10 — Implémenter la session et LoginView

Implémenter connexion Supabase, restauration et expiration de session, option « se souvenir de moi », déconnexion, gardes de routes, formulaire de connexion et mot de passe oublié selon `login_view.md`. Tester les erreurs et la redirection sans session valide.

### V1-11 — Implémenter la demande et l’approbation de compte

Créer le formulaire sans mot de passe, les contrôles d’unicité, la notification administrateur et la fonction serveur d’approbation créant le compte `user`, son profil et l’invitation Supabase. Garantir l’absence de création partielle et de secret Auth Admin dans le frontend.

### V1-12 — Implémenter le profil et les paramètres de compte

Implémenter nom d’affichage unique, prénom, nom, avatar privé, changement d’e-mail avec confirmation et changement de mot de passe. Tester les contrôles d’unicité, de fichier et l’accès limité au compte courant.

### V1-13 — Implémenter l’administration des comptes

Créer AdminModal pour lister demandes et utilisateurs, approuver, changer un rôle et supprimer un compte via des fonctions serveur. Empêcher l’auto-rétrogradation, l’auto-suppression et la suppression du dernier administrateur, puis tester la suppression en cascade d’un propriétaire.

### V1-14 — Implémenter la coquille applicative

Créer les routes V1, AppSidebar avec liens et icônes, vue active, destinations futures désactivées, ouverture/fermeture de session, actions Notifications et Paramètres, thème Mantine et contrat iconographique. Vérifier l’accessibilité clavier et le comportement au rechargement.

Statut : implémentée le 2026-07-13.

### V1-15 — Implémenter PreferencesModal et AccountModal

Séparer PreferencesModal, accessible par la roue crantée, et AccountModal, accessible par le profil du header. Gérer unités, thème, hauteur et épaisseur de mur par défaut et options d’affichage. Relire les préférences à la connexion, conserver les centimètres comme unité métier et ne pas modifier rétroactivement les murs existants.

### V1-16 — Implémenter les projets et le contexte courant

Implémenter création, lecture, modification, suppression logique et sélection du projet courant, avec choix par défaut du dernier projet modifié. Couvrir les états vide, chargement, erreur et droits insuffisants.

### V1-17 — Implémenter invitations et collaborations

Créer ProjectCollaborationModal, AppNotifications et les capacités frontend centralisées. Gérer invitation d’un compte existant, rôles lecture/écriture, renvoi, annulation, acceptation, changement de rôle et retrait. Vérifier qu’il n’existe aucun accès avant acceptation et que seul le propriétaire gère le partage.

### V1-18 — Implémenter le verrou d’édition collaboratif

Implémenter le verrou au niveau du projet, son acquisition atomique lors d’une modification persistée, son renouvellement à chaque modification persistée du détenteur et son expiration deux minutes après la dernière activité selon l’heure du serveur. Tester avec deux sessions qu’un seul éditeur écrit et que la lecture reste possible.

### V1-19 — Implémenter les verrous manuels

Ajouter les actions verrouiller et déverrouiller pour pièce, mur et ouverture, avec états persistants indépendants et contrôle avant modification ou suppression. Tester la consultation maintenue, l’absence de cascade et l’interdiction pour le rôle lecture.

### V1-20 — Implémenter niveaux et cartes de pièces du Dashboard

Créer DashboardLayout, la gestion du niveau 0 obligatoire, des niveaux visibles et du niveau éditable, puis RoomCard avec création atomique d’une pièce, renommage, type, couleur, icône dérivée et suppression logique. Utiliser les préférences courantes lors des créations.

### V1-21 — Implémenter le canvas 2D partagé

Créer Canvas2D, grille, zoom, panoramique, indicateur d’échelle, repère global et rendu des pièces, murs et ouvertures. Ajouter les options d’affichage des notes, surfaces, icônes, angles et côtes. Vérifier que la navigation visuelle n’altère jamais les coordonnées métier.

### V1-22 — Implémenter sélection, panneaux et historique

Créer les panneaux de création et détail, DetailTree, les sections métier, SelectionSyncBridge et la sélection synchronisée canvas/arbre/panneau. Ajouter l’historique limité à 20 actions avec boutons et raccourcis Annuler/Rétablir, puis tester les états lecture seule et verrouillé.

### V1-23 — Implémenter l’affichage de l’éditeur 2D global

Créer GlobalEditor2DView, charger projet et niveau, brancher canvas et panneaux, gérer le changement de niveau, l’affichage multi-pièces et les états vide, erreur, lecture seule et verrouillé. Cette tâche ne modifie pas encore la géométrie.

### V1-24 — Implémenter l’édition géométrique globale

Ajouter création et déplacement des pièces et sommets, magnétisme, validation polygonale, mise à jour des murs et relations, jonctions à trois pièces et compatibilité des ouvertures avec sauvegarde transactionnelle. Tester qu’aucune géométrie invalide ou opération partielle n’est persistée.

### V1-25 — Implémenter les objets secondaires de l’éditeur global

Ajouter les commandes et formulaires de création, modification, suppression et sélection des murs, ouvertures, côtes et notes. Appliquer droits, verrous, validations, historique et raccourci Suppr, avec erreurs explicites sans écriture partielle.

### V1-26 — Implémenter RoomEditor2DView

Créer le contexte projet/niveau/pièce, réutiliser le canvas et permettre l’édition des sommets, murs, ouvertures, côtes et notes, dont la longueur intérieure d’un mur. Brancher magnétisme, sauvegarde, droits, verrous et historique. Tester la synchronisation globale et l’interdiction de supprimer un mur mitoyen.

### V1-27 — Implémenter WallEditorView en lecture

Créer la route et le contexte, déterminer la face initiale selon la pièce d’origine et la topologie, puis afficher sélecteur, contour, ouvertures, profils et mesures calculées. Vérifier que les deux faces sont consultables et qu’aucune projection n’est persistée.

### V1-28 — Implémenter l’édition des profils dans WallEditorView

Permettre d’ajouter, déplacer, modifier et supprimer les points, de lier ou dissocier les profils et de confirmer leur remise en liaison. Ajouter validation des ouvertures, persistance atomique, droits, verrous et historique. Tester que la remise en liaison est annulable.

### V1-29 — Implémenter les exports PDF des vues existantes

Produire les six documents définis dans `docs/ihm/composants/pdf.md` pour dashboard, éditeur global et éditeur pièce, en version simple et détaillée. Respecter nommage, unités, options d’affichage et droits, puis tester projet vide, multi-niveaux, pièces supprimées et rôle lecture.

### V1-30 — Implémenter ProjectMetricsView

Créer des sélecteurs réutilisant le domaine, puis implémenter les trois tableaux pièces, murs et ouvertures avec leurs propriétés et métriques calculables. Ajouter filtre et tri sur chaque colonne, unités et états vide/erreur. Vérifier l’identité des valeurs entre éditeurs et vue métriques.

### V1-31 — Implémenter les exports des métriques

**Prérequis : V1-30 terminée.** Produire les exports PDF, Excel et CSV en respectant filtres, tris, unités, droits et contenu validé. Vérifier que les trois fichiers s’ouvrent et correspondent exactement à la vue filtrée.

### V1-32 — Réaliser la recette de sécurité et de concurrence

Tester propriétaire, collaborateur lecture, collaborateur écriture, administrateur et intrus sur toutes les données et commandes. Tester deux sessions sur les verrous collaboratifs et manuels. Documenter la matrice et corriger tout écart entre capacités UI et RLS.

### V1-33 — Réaliser la recette fonctionnelle V1

Tester de bout en bout compte, projet, partage, niveaux, pièces, topologie, ouvertures, profils, métriques et exports. Vérifier accessibilité, performances, initialisation Supabase à zéro, compilation de production et cohérence documentaire, puis établir la checklist de publication 1.0.

## Sources de référence

- `docs/projet.md` : gouvernance et Definition of Done.
- `docs/product.md` : périmètre de la V1.
- `docs/spec.md` : features prioritaires et critères.
- `docs/architecture.md` : responsabilités techniques.
- `docs/data-model.md` : entités, relations et persistance.
- `docs/ihm/` : comportements des vues et composants.
