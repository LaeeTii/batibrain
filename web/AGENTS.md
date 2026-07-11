# Instructions frontend et IHM

Ces règles complètent le `AGENTS.md` racine.

## Documentation

- Avant toute modification d’interface, lire `docs/ihm/ihm.md`.
- Pour une vue ou un composant, lire aussi son fichier dans `docs/ihm/vues/` ou `docs/ihm/composants/`.
- Pour les règles transverses, lire les fichiers concernés dans `docs/ihm/logique/`.
- En cas de conflit entre le code et la documentation IHM, signaler le conflit et appliquer la documentation.
- Si une information manque, faire l’hypothèse minimale cohérente et la rendre explicite.
- Mettre à jour le fichier IHM correspondant lorsqu’un comportement documenté change.

## Stack et structure

- Utiliser React, TypeScript, Mantine et `react-icons`.
- Placer les vues dans `web/src/views`, les composants métier dans `web/src/components`, les services dans `web/src/services` et les utilitaires dans `web/src/lib`.
- Conserver les types métier dans `web/src/domain/types.ts` sans les dupliquer ailleurs.
- Conserver la logique géométrique et ses validations dans `web/src/domain/geometry.ts`.
- Garder la logique métier hors des vues et des composants UI génériques.
- Créer un composant métier s’il est réutilisé ou si sa complexité justifie son isolation.
- Préférer Mantine pour les éléments interactifs génériques et éviter les wrappers inutiles.

## Interface

- Réutiliser le pack d’icônes présent dans la vue ou choisir un pack unique et cohérent.
- Fournir un libellé accessible aux boutons composés uniquement d’une icône.
- Masquer les icônes purement décoratives aux lecteurs d’écran.
- Gérer explicitement les états de chargement, vide et erreur.
- Demander une confirmation avant toute action destructive.
- Rendre les interactions critiques accessibles au clavier et aux lecteurs d’écran.
- Préférer le thème Mantine et centraliser les tokens CSS globaux dans `web/src/index.css`.
- Ne pas coder les couleurs en dur, sauf exception documentée.
- Exécuter le typecheck et les vérifications frontend applicables.

## Modèle métier et géométrie

- Appliquer cet ordre documentaire : `docs/ihm/`, puis `docs/data-model.md`, puis les fichiers `AGENTS.md`.
- Demander un arbitrage explicite avant l’implémentation en cas de conflit documentaire.
- Utiliser les centimètres pour la géométrie et les distances, et les mètres carrés pour les surfaces affichées.
- Ne pas persister comme source primaire les surfaces, périmètres, angles ou orientations calculés.
- Préserver l’ordre des sommets et la cohérence topologique après toute modification.
- Pour un mur mitoyen, maintenir une persistance cohérente pour les deux pièces concernées.
- Ne pas ajouter de champ spéculatif non sourcé par `docs/ihm/`.
- Ne pas introduire de schéma définitif pour les domaines legacy sans arbitrage explicite.
- Vérifier `docs/data-model.md`, `docs/ihm/logique/geometry.md` et `docs/ihm/logique/edition_2D_synchronisation_selection.md` lors d’une évolution concernée.
- Vérifier les impacts sur la persistance et la suppression logique des pièces.
- Mettre à jour dans le même changement `docs/data-model.md` et les fichiers concernés de `docs/ihm/`.
