# App web + mobile de gestion de travaux

Ce starter pack fournit une base **MVP** pour démarrer rapidement :

- cadrage produit
- architecture cible
- modèle de données PostgreSQL / Supabase
- moteur géométrique TypeScript partagé
- premier éditeur React interactif pour dessiner une pièce polygonale

## Structure

```
app-maison/
├── docs/
├── shared/src/
├── web/src/components/
├── web/src/views/
└── supabase/migrations/
```

## Démarrage recommandé

1. Lire `docs/product.md`
2. Lire `docs/geometry.md`
3. Parcourir `shared/src/types.ts` et `shared/src/geometry.ts`
4. Ouvrir `web/src/components/RoomCanvas.tsx`
5. Adapter et exécuter la migration `supabase/migrations/20260703_000001_init.sql`

## Lancer le prototype web

Depuis `web/` :

```bash
npm install
npm run dev
```

Vérifications utiles :

```bash
npm run typecheck
npm run build
```

## Configurer Supabase

1. Créer un projet Supabase et appliquer la migration [supabase/migrations/20260703_000001_init.sql](supabase/migrations/20260703_000001_init.sql)
2. Copier `web/.env.example` vers `web/.env.local`
3. Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
4. Utiliser le client exposé par `web/src/lib/supabase.ts` et les helpers de `web/src/services/rooms.ts`

### Exécuter la migration

Deux options sont possibles pour appliquer [supabase/migrations/20260703_000001_init.sql](supabase/migrations/20260703_000001_init.sql) sur votre projet Supabase.

#### Option 1 — SQL Editor Supabase

La méthode la plus rapide pour un premier démarrage :

1. Ouvrir le projet dans le dashboard Supabase
2. Aller dans **SQL Editor**
3. Créer une nouvelle requête
4. Copier le contenu de [supabase/migrations/20260703_000001_init.sql](supabase/migrations/20260703_000001_init.sql)
5. Exécuter la requête

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
cd /Users/56593p/workspaces/perso/app-maison
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
- Si la migration a déjà été exécutée manuellement sur un projet existant, `supabase db push` peut signaler que certains objets existent déjà.

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
