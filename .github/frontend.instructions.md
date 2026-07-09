---
description: Regles frontend pour web (React + Mantine + react-icons)
applyTo: web/src/**/*.{ts,tsx,css}
---

# Frontend Guidelines (app-maison)

## Scope
- Regles pour les vues, composants metier et styles dans [web/](../web/).
- Ces regles completent [\.github/copilot-instructions.md](./copilot-instructions.md).
- Ce fichier est la reference pour toutes les contraintes techniques frontend.

## Sources de verite
- [docs/ihm.md](../docs/ihm.md)
- [docs/ihm_editeur_2d_global.md](../docs/ihm_editeur_2d_global.md)
- [docs/edition_2D_synchronisation_selection.md](../docs/edition_2D_synchronisation_selection.md)
- [docs/geometry.md](../docs/geometry.md)

## Stack frontend imposee
- Utiliser React + TypeScript.
- Utiliser Mantine pour les composants UI generiques.
- Utiliser react-icons pour les icones.

## Regles de composants
- Utiliser Mantine par defaut pour les composants UI interactifs afin de garantir la coherence visuelle et comportementale.
- Utiliser HTML natif pour la structure semantique (section, article, nav, header, main) et les cas simples non couverts par Mantine.
- Si un element interactif natif est utilise par exception, il doit respecter les tokens de theme et les regles d'accessibilite du projet.
- Creer un composant metier seulement s'il est reutilise a plusieurs endroits.
- Creer un composant metier si sa complexite justifie une isolation pour clarifier le code.
- Garder la logique metier hors des vues et hors des composants UI generiques.

## Regles de structure
- Les vues vivent dans [web/src/views](../web/src/views).
- Les composants metier vivent dans [web/src/components](../web/src/components).
- Les services et adaptateurs de donnees vivent dans [web/src/services](../web/src/services).
- Les utilitaires frontend vivent dans [web/src/lib](../web/src/lib).
- Les calculs geometriques metier restent dans [shared/](../shared/).

## Regles Mantine
- Preferer les composants Mantine pour modal, formulaire, accordion, menu, tabs, tooltip, select et multiselect.
- Importer les composants depuis @mantine/core.
- Importer les hooks depuis @mantine/hooks.
- Eviter les wrappers inutiles autour de composants Mantine simples.

## Regles react-icons
- Utiliser react-icons pour toutes les icones de l'application.
- Garder un set d'icones coherent dans une meme vue.
- Eviter les tailles/couleurs hardcodees repetitives. Preferer props et theme.

## Strategie de selection des icones
- Quand une demande mentionne une intention (exemple: "icone home", "icone menu"), choisir l'icone react-icons la plus pertinente sans demander a l'utilisateur une liste predefinie.
- Prioriser la coherence visuelle avec la vue courante en reutilisant d'abord le meme pack deja present dans le fichier ou la vue.
- Si aucun pack n'est present, utiliser un pack par defaut unique pour la vue et rester sur ce pack.
- Privilegier des formes simples et lisibles (outline ou filled) en restant coherent dans un meme bloc UI.
- Eviter de melanger plusieurs styles d'icones dans une meme barre d'actions sauf besoin explicite.
- En cas d'ambiguite, choisir l'option la plus standard du domaine (home, menu, settings, search, edit, delete, close).
- Pour un bouton uniquement icone, toujours fournir un libelle accessible (aria-label ou title selon le composant).
- Si une icone est decorative uniquement, la marquer comme non annoncee aux lecteurs d'ecran.

## Convention de fallback icones
- Ordre de selection recommande: 1) pack deja utilise dans le composant ou la vue; 2) pack majoritaire du projet; 3) pack par defaut de l'ecran si aucun contexte.
- Une fois un pack choisi pour un ecran, conserver ce pack pour les actions principales de cet ecran.

## Styles et theming
- Preferer le theme Mantine et les props de style Mantine.
- Eviter les styles inline repetes.
- Si CSS necessaire, centraliser les tokens globaux dans [web/src/index.css](../web/src/index.css).
- Ne pas multiplier des classes historiques liees a un ancien design si Mantine couvre le besoin.

## Couleurs et themes
- Toutes les couleurs doivent etre variabilisees pour permettre les themes (clair, sombre, futurs themes metier).
- Interdire les couleurs hardcodees dans les composants (`#hex`, `rgb`, `hsl`) sauf cas exceptionnel documente.
- Prioriser les tokens de theme Mantine (`theme.colors`, `theme.primaryColor`, etc.) pour les composants Mantine.
- Si une couleur doit etre partagee hors Mantine, la definir comme variable CSS globale dans [web/src/index.css](../web/src/index.css) puis la reutiliser.
- Nommer les variables par intention (ex: `--color-surface`, `--color-text-primary`, `--color-border-muted`) et non par couleur brute.
- Lors de l'ajout d'un nouveau composant, verifier que ses couleurs fonctionnent avec plusieurs themes sans modification de code metier.

## Etats UI requis
- Toute vue de donnees gere explicitement loading, empty et error.
- Les actions destructives doivent avoir une confirmation explicite.
- Les interactions critiques doivent etre accessibles clavier et lecteur d'ecran.

## Checklist rapide avant merge
- La vue respecte les sources de verite docs.
- Les composants generiques viennent de Mantine.
- Les icones viennent de react-icons.
- Aucun composant custom duplique un composant natif/Mantine sans raison.
- Les couleurs sont toutes tokenisees et compatibles theming (pas de hardcode couleur non justifie).
- TypeScript est propre (pas d'erreur typecheck).
