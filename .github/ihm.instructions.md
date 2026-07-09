# IHM Instructions

## Objectif
- Ce fichier est un routeur de lecture pour la documentation IHM.
- La source de verite reste les fichiers dans `docs/ihm/`.

## Regles de lecture obligatoires
- Avant toute modification UI (vue, composant, comportement front), lire `docs/ihm/ihm.md`.
- Pour une vue, lire aussi le fichier cible dans `docs/ihm/vues/`.
- Pour un composant, lire aussi le fichier cible dans `docs/ihm/composants/`.
- Pour les regles transverses (geometrie IHM, synchronisation de selection, interactions globales), lire les fichiers de `docs/ihm/logique/`.

## Regles de decision
- En cas de conflit entre code et documentation IHM, signaler le conflit explicitement et appliquer la documentation.
- En cas de manque dans la documentation IHM, faire l'hypothese minimale coherente avec `docs/ihm/ihm.md`, puis la rendre explicite.
- Si un changement modifie un comportement documente, mettre a jour le fichier correspondant dans `docs/ihm/` dans le meme changement.

## Perimetre
- Ces regles s'appliquent aux modifications front web/mobile liees aux vues, composants, flux de navigation, interactions canvas et panneaux.
