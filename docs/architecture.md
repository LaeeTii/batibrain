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
- `shared/` : types + géométrie partagés
- `web/` : application web (incluant la cible PWA)
- `supabase/` : migrations SQL et configuration

## Principes d'architecture
- la logique métier géométrique vit dans `shared/`
- l'UI vit dans `web/`, avec adaptation responsive et capacités PWA pour les usages mobiles
- la spec est la source de vérité pour le produit (docs/ihm/ihm.md)
- les projections (métriques, angles, vues dérivées) sont calculées

## Séquencement
1. Prototype géométrique web
2. Persistance Supabase
3. V1 - application web pour gestion des plans, métriques et socle métier
4. V2 - documents et photos
5. V2.1 - PWA (installation, offline de base, expérience mobile)
6. V3 - tâches, travaux et planning
7. V4 - assistant IA avec actions sécurisées
8. V5 - moteur 3D complet
