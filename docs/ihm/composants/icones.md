# Composants - Icônes

## Objectif
- Définir le contrat iconographique transverse de l'application.
- Garantir une représentation cohérente, lisible et accessible des actions, états et concepts métier.
- Éviter que les vues et composants redéfinissent localement les règles communes.

## Portée
- Ce contrat est obligatoire pour toutes les vues et tous les composants IHM existants et à venir.
- Les spécifications locales restent responsables du choix concret de l'icône et précisent si elle est affichée seule ou avec un libellé visible.
- Une même action ou un même concept utilise la même icône dans toute l'application.
- Toute dérogation doit être explicitement indiquée et justifiée dans la spécification concernée.

## Bibliothèque de référence
- Utiliser `react-icons` pour toutes les icônes de l'application, conformément aux instructions frontend.
- Utiliser par défaut le pack Lucide fourni par `react-icons/lu` pour les actions, la navigation et les états transverses.
- Les pictogrammes métier de type de pièce conservent leur correspondance fonctionnelle validée et peuvent utiliser un autre pack de `react-icons` lorsqu'aucun équivalent Lucide adéquat n'existe.
- Ne pas mélanger plusieurs packs dans une même barre d'actions ou un même groupe de contrôles.

## Icône seule ou icône avec texte
- Une icône seule est réservée aux actions universelles, répétitives et immédiatement reconnaissables dans leur contexte, par exemple fermer, supprimer, annuler, rétablir ou zoomer.
- Une icône avec un libellé visible est obligatoire pour:
	- une action principale de la vue;
	- une action métier ambiguë ou peu fréquente;
	- une action dont la conséquence ne peut pas être comprise sans contexte;
	- un choix entre plusieurs variantes proches.
- Une action destructive inhabituelle conserve un libellé visible; une action destructive répétitive peut être présentée par une icône seule si son contexte est sans ambiguïté et qu'une confirmation est demandée.
- Une icône décorative ne remplace jamais une information portée par le texte.

## Accessibilité
- Tout bouton présenté uniquement par une icône possède un nom accessible décrivant son action.
- Tout bouton présenté uniquement par une icône affiche une infobulle au survol et à la prise de focus.
- Une icône décorative est ignorée par les technologies d'assistance.
- Un état ne doit jamais être communiqué uniquement par une icône ou par une couleur: il est également exposé par un libellé accessible et, lorsque nécessaire à la compréhension, par un texte visible.
- L'état actif, sélectionné, désactivé ou indisponible reste perceptible visuellement et par les technologies d'assistance.

## Cohérence visuelle
- Les icônes d'une même zone utilisent une taille, une épaisseur de trait et un alignement cohérents.
- Une icône placée avec un libellé est alignée avec celui-ci et ne concurrence pas sa lecture.
- Le rouge est réservé en priorité aux erreurs et aux actions destructives.
- Une icône désactivée reste identifiable sans pouvoir être activée.
- Les états actif et inactif ne reposent pas uniquement sur une variation de couleur.

## Règles documentaires
- La spécification du composant réutilisable porte les choix iconographiques communs à toutes ses occurrences.
- La spécification d'une vue porte uniquement les choix propres à cette vue et référence le composant lorsqu'un contrat réutilisable existe.
- Pour chaque action iconographique locale, la spécification indique au minimum:
	- le nom de l'action;
	- l'icône fonctionnelle retenue;
	- le mode `icône seule` ou `icône + texte`.
- Les règles d'accessibilité, de cohérence visuelle et de comportement commun ne sont pas répétées dans chaque spécification.

## Critères d'acceptation testables
- Given une même action est disponible dans plusieurs vues, When ses contrôles sont affichés, Then elle utilise la même icône dans chaque vue.
- Given un bouton est affiché uniquement sous forme d'icône, When il reçoit le focus ou est survolé, Then son action est décrite par une infobulle et un nom accessible.
- Given une action métier ambiguë ou principale est affichée, When l'utilisateur consulte son contrôle, Then l'icône est accompagnée d'un libellé visible.
- Given une icône exprime un état, When cet état est affiché, Then il reste compréhensible sans dépendre uniquement de la couleur ou de l'icône.
- Given une spécification locale introduit une action iconographique, When son contrat est relu, Then l'icône retenue et son mode d'affichage sont explicitement indiqués.

## Références
- Référentiel global : [ihm.md](../ihm.md)
- Composants transverses : [transverses.md](./transverses.md)
