# BatiBrain

Application web de gestion de travaux

Ce starter pack fournit une base **MVP** pour démarrer rapidement :

- cadrage produit
- architecture cible
- modèle de données PostgreSQL / Supabase
- moteur géométrique TypeScript intégré au domaine frontend
- premier éditeur React interactif pour dessiner une pièce polygonale

## Structure

```
bati-brain/
├── docs/
├── web/src/domain/
├── web/src/components/
├── web/src/views/
└── supabase/migrations/
```

## Démarrage recommandé

1. Lire `docs/product.md`
2. Lire `docs/geometry.md`
3. Parcourir `web/src/domain/types.ts` et `web/src/domain/geometry.ts`
4. Ouvrir `web/src/components/RoomCanvas.tsx`
5. Appliquer dans l'ordre les migrations de `supabase/migrations/`

## Lancer le prototype web

Depuis `web/` :

```bash
npm install
npm run dev
```

Vérifications utiles :

```bash
npm run lint
npm run test
npm run typecheck
npm run build
npm run check
```

## Configurer Supabase

1. Créer un projet Supabase et appliquer dans l'ordre les migrations de `supabase/migrations/`
2. Copier `web/.env.example` vers `web/.env.local`
3. Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
4. Utiliser le client exposé par `web/src/lib/supabase.ts` et les helpers de `web/src/services/rooms.ts`

### Exécuter les migrations

Deux options sont possibles pour appliquer la chaîne de migrations sur votre projet Supabase.

#### Option 1 — SQL Editor Supabase

La méthode la plus rapide pour un premier démarrage :

1. Ouvrir le projet dans le dashboard Supabase
2. Aller dans **SQL Editor**
3. Créer une nouvelle requête
4. Copier et exécuter chaque fichier de `supabase/migrations/` dans l'ordre de son horodatage
5. Ne jamais modifier ni rejouer isolément une migration déjà appliquée

#### Option 2 — Supabase CLI

La méthode recommandée pour garder un historique de migrations versionnées :

1. Installer la CLI :

```bash
brew install supabase/tap/supabase
```

2. Se connecter à Supabase :

```bash
supabase login
```

3. Initialiser la configuration locale depuis la racine du projet :

```bash
cd /Users/56593p/workspaces/perso/bati-brain
supabase init
```

4. Lier le dépôt au projet Supabase distant :

```bash
supabase link --project-ref TON_PROJECT_REF
```

Le `project ref` est visible dans l'URL du dashboard Supabase ou dans les paramètres du projet.

5. Pousser les migrations vers la base distante :

```bash
supabase db push
```

Notes utiles :

- Les variables d'environnement de `web/.env.local` servent au frontend React, pas à l'exécution des migrations.
- Si la CLI demande le mot de passe de base de données, il est disponible dans le dashboard Supabase, section **Database**.
- Si des migrations ont déjà été exécutées manuellement sur un projet existant, leur historique doit être aligné avant d'utiliser `supabase db push`.
- Une base neuve est créée en rejouant toute la chaîne. Un éventuel schéma consolidé doit être généré depuis cette chaîne et ne doit pas être maintenu manuellement.
- La création du premier administrateur est effectuée après les migrations avec la procédure décrite dans `docs/exploitation-premier-administrateur.md`; aucun profil utilisateur n'est provisionné par une migration.

Exemple de démarrage :

```ts
import { loadRoomSnapshot } from './src/services/rooms';

const snapshot = await loadRoomSnapshot('piece-id');
```

Note : le helper `replaceRoomVertices` remplace actuellement l'ensemble des sommets d'une pièce. C'est suffisant pour la phase de prototype géométrique, mais la persistance des sommets devra passer par une opération transactionnelle côté base avant d'introduire des murs dépendants des identifiants de sommets.

## Priorité de développement

1. Stabiliser l'éditeur 2D web
2. Sauvegarder / charger les pièces depuis Supabase
3. Enrichir les murs et ouvertures
4. Ajouter tâches et documents
5. Brancher l'assistant avec validation humaine

## Notes

- Les angles ne sont **pas stockés** : ils sont calculés à partir des sommets.
- Les coordonnées sont **globales à l'étage** pour pouvoir afficher plusieurs pièces ensemble.
- Le mobile peut venir plus tard, une fois la logique géométrique stabilisée.
