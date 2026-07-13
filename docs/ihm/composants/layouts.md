# Composants - Layouts

## Objectif
- Documenter le conteneur de contenu du dashboard à l'intérieur de la coquille applicative transverse.

## Liste des composants
- DashboardLayout

## Responsabilites
- Garantir une structure stable pour le contenu de DashboardView.
- Laisser la coquille applicative transverse assembler AppSidebar, le header global et la vue active.

## Props et contrat
- Entree principale:
	- contenu principal de la vue (children).
- Contraintes:
	- le layout ne porte pas de logique metier propre,
	- le contexte projet et les actions restent geres par la vue.

## Etats et interactions
- Pas d'etat metier specifique au layout.
- L'état ouvert ou fermé d'AppSidebar est géré par la coquille applicative, hors de DashboardLayout.

## Règles metier
- Ce composant est actuellement specifique a DashboardView.
- Toute evolution vers la reutilisation multi-vues fera l'objet d'une spec plus complete.

## Cas limites
- Si le contenu principal est vide, le layout conserve une structure lisible.

## Criteres d'acceptation testables
- Given DashboardView est affichée dans la coquille applicative, When le layout est rendu, Then la zone principale est présente sans dupliquer AppSidebar ni le header global.
- Given le contenu principal change, When le layout est rendu, Then la structure de page reste stable sans logique metier additionnelle.

## References
- Referentiel global : [ihm.md](../ihm.md)
- Vue associee : [dashboard_view.md](../vues/dashboard_view.md)
