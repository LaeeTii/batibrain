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
- la compatibilité intérieur/extérieur entre un template d'ouverture et son mur support est une validation métier géométrique portée par le domaine frontend avant persistance
- la qualification intérieure ou extérieure d'un mur est calculée depuis le nombre de pièces liées et n'est pas persistée comme donnée source
- après toute modification topologique, les relations mur-pièce et la compatibilité des ouvertures sont recalculées avant persistance; les ouvertures devenues incompatibles sont supprimées
- le type de pièce est persisté dans Supabase/PostgreSQL; son icône est une projection frontend produite avec `react-icons` et n'est pas stockée
- les options d'affichage des surfaces et des icônes de pièces sont persistées avec les autres préférences de vue et appliquées aux canvas comme aux exports PDF

## Séquencement
1. Prototype géométrique web
2. Persistance Supabase
3. V1 - application web pour gestion des plans, métriques et socle métier
4. V2 - documents et photos
5. V2.1 - PWA (installation, offline de base, expérience mobile)
6. V3 - tâches, travaux et planning
7. V4 - assistant IA avec actions sécurisées
8. V5 - moteur 3D complet
