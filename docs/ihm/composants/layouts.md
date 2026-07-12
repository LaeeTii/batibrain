# Composants - Layouts

## Objectif
- Documenter de facon legere le shell de page du dashboard sans en faire un composant transverse majeur tant que sa reutilisation n'est pas confirmee.

## Liste des composants
- DashboardLayout

## Responsabilites
- Assembler la sidebar applicative et la zone principale de contenu.
- Garantir une structure stable de page pour DashboardView.

## Props et contrat
- Entree principale:
	- contenu principal de la vue (children).
- Contraintes:
	- le layout ne porte pas de logique metier propre,
	- le contexte projet et les actions restent geres par la vue.

## Etats et interactions
- Pas d'etat metier specifique au layout.
- Le layout reflète l'état ouvert ou fermé d'AppSidebar sans le gérer lui-même.
- Lorsque la side bar est fermée, la zone principale utilise l'espace libéré et le bouton icône menu reste disponible en haut à gauche de l'application.

## Règles metier
- Ce composant est actuellement specifique a DashboardView.
- Toute evolution vers la reutilisation multi-vues fera l'objet d'une spec plus complete.

## Cas limites
- Si la sidebar n'est pas disponible, la vue ne doit pas casser le rendu de la zone principale.
- Si le contenu principal est vide, le layout conserve une structure lisible.

## Criteres d'acceptation testables
- Given DashboardView est affichee, When le layout est rendu, Then la sidebar et la zone principale sont presentes.
- Given la sidebar est fermée, When le layout est rendu, Then la zone principale reste utilisable et le bouton icône menu permet de rouvrir la sidebar.
- Given le contenu principal change, When le layout est rendu, Then la structure de page reste stable sans logique metier additionnelle.

## References
- Referentiel global : [ihm.md](../ihm.md)
- Vue associee : [dashboard_view.md](../vues/dashboard_view.md)
