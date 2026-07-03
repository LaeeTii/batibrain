# Architecture technique

## Stack cible
- **Web** : React + TypeScript + Vite
- **Mobile** : React Native + Expo
- **Backend** : Supabase
- **Base de données** : PostgreSQL
- **Stockage fichiers** : Supabase Storage
- **Auth** : Supabase Auth

## Structure monorepo
- `docs/` : cadrage produit et technique
- `shared/` : types + géométrie partagés
- `web/` : application web
- `mobile/` : application mobile
- `supabase/` : migrations SQL et configuration

## Principes d'architecture
- la logique métier géométrique vit dans `shared/`
- l'UI reste dans `web/` et `mobile/`
- la base est la source de vérité métier
- les projections (métriques, angles, vues dérivées) sont calculées

## Séquencement recommandé
1. Prototype géométrique web
2. Persistance Supabase
3. Tâches et documents
4. Version mobile
5. Assistant LLM avec actions sécurisées
