# Architecture technique

## Stack cible
- **Web** : React + TypeScript + Vite
- **Mobile** : PWA (Progressive Web App) basée sur l'application web
- **Backend** : Supabase
- **Base de données** : PostgreSQL
- **Stockage fichiers** : Supabase Storage
- **Auth** : Supabase Auth

## Structure monorepo
- `docs/` : cadrage produit et technique
- `web/src/domain/` : types métier + géométrie du frontend
- `web/` : application web (incluant la cible PWA)
- `supabase/` : migrations SQL et configuration

## Principes d'architecture
- la logique métier géométrique vit dans `web/src/domain/`
- l'UI vit dans `web/`, avec adaptation responsive et capacités PWA pour les usages mobiles
- la spec est la source de vérité pour le produit (docs/ihm/ihm.md)
- les projections (métriques, angles, vues dérivées) sont calculées
- les préférences utilisateur (unités, thème, sécurité de session) sont persistées côté Supabase/PostgreSQL et relues à l'ouverture de session pour initialiser l'interface
- la propriété des projets, les collaborations et les invitations sont persistées dans Supabase/PostgreSQL
- l'accès aux données est limité côté backend aux projets possédés par l'utilisateur authentifié ou partagés avec lui après acceptation de l'invitation
- les autorisations de lecture et d'écriture sont contrôlées côté backend selon le rôle projet; l'interface ne constitue pas la barrière de sécurité
- le contrôle du droit d'écriture précède l'acquisition du verrou d'édition simple
- le verrou manuel persistant d'une pièce, d'un mur ou d'une ouverture est distinct du verrou d'édition collaboratif; il est contrôlé avant toute modification ou suppression de la ressource, sans empêcher sa sélection ni sa consultation
- les verrous manuels sont indépendants entre pièce, mur et ouverture et ne se propagent pas en cascade
- la compatibilité intérieur/extérieur entre un template d'ouverture et son mur support est une validation métier géométrique portée par le domaine frontend avant persistance
- la qualification intérieure ou extérieure d'un mur est calculée depuis le nombre de pièces liées et n'est pas persistée comme donnée source
- un mur ne peut jamais être lié à trois pièces; lorsqu'une troisième pièce rejoint l'intérieur d'un segment existant, la logique géométrique crée un sommet de jonction, scinde le segment initial en deux et persiste trois murs distincts autour de ce sommet
- après toute modification topologique, les relations mur-pièce et la compatibilité des ouvertures sont recalculées avant persistance; les ouvertures devenues incompatibles sont supprimées
- le type de pièce est persisté dans Supabase/PostgreSQL; son icône est une projection frontend produite avec `react-icons` et n'est pas stockée
- les options d'affichage des surfaces et des icônes de pièces sont persistées avec les autres préférences de vue et appliquées aux canvas comme aux exports PDF
- chaque mur persiste deux profils de hauteur ordonnés, un par face stable du segment; ils sont liés par défaut et peuvent être dissociés, tandis que l'association visuelle d'une face à une pièce ou à l'extérieur est calculée depuis la topologie
- chaque mur persiste également l'état de liaison de ses profils, actif par défaut; lorsqu'il est actif, les écritures sur les deux profils sont validées et persistées dans une même transaction
- les hauteurs intermédiaires, contours de face et mesures affichées dans la vue Mur sont projetés depuis les points persistés et ne sont pas stockés comme valeurs dérivées

## Répartition des validations et des valeurs par défaut
- les valeurs par défaut fonctionnelles sont définies dans `web/src/domain/`, testées avec la logique métier et envoyées explicitement lors de chaque création; elles ne reposent pas sur des clauses `DEFAULT` PostgreSQL
- les règles métier évolutives sont validées dans `web/src/domain/` avant persistance, notamment les règles géométriques, les compatibilités, les bornes fonctionnelles et les transitions d'état
- l'interface peut répéter ces validations pour fournir un retour immédiat, mais elle s'appuie sur le domaine pour prendre la décision métier
- PostgreSQL garantit uniquement l'intégrité technique indispensable: identité, présence des données structurelles, clés étrangères, unicité technique, sécurité RLS et cohérence transactionnelle
- une contrainte `CHECK` PostgreSQL n'est ajoutée que si elle protège une propriété structurelle durable et indépendante d'une règle produit susceptible d'évoluer
- les opérations qui doivent rester indivisibles sont persistées dans une même transaction, sans déplacer pour autant leur décision métier dans la base de données
- toute modification d'une règle ou d'une valeur par défaut fonctionnelle doit pouvoir être réalisée dans le code et ses tests sans nécessiter de migration SQL

## Séquencement
1. Prototype géométrique web
2. Persistance Supabase
3. V1 - application web pour gestion des plans, métriques et socle métier
4. V2 - documents et photos
5. V2.1 - PWA (installation, offline de base, expérience mobile)
6. V3 - tâches, travaux et planning
7. V4 - assistant IA avec actions sécurisées
8. V5 - moteur 3D complet
