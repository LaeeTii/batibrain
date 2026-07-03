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
