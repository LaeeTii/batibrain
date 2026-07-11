# Composants - Cards

## Objectif
- Definir le contrat fonctionnel des cartes de la vue dashboard, centrees sur la consultation et les actions rapides sur une pièce.

## Liste des composants
- RoomCard

## Responsabilites
- Afficher une synthese exploitable de la pièce (nom, niveau, apercu, informations utiles).
- Exposer les actions rapides de la pièce via des icones.
- Permettre l'ouverture de la pièce en édition par clic principal sur la carte.
- Exposer les actions d'export PDF pièce avec choix de variante.

## Props et contrat
- Données d'entree minimales:
	- id de pièce,
	- nom de pièce,
	- type de pièce,
	- surface de la pièce,
	- niveau de rattachement,
	- données d'apercu du plan,
	- metadonnees de synthese utiles.
- Etat d'affichage:
	- pièce active/inactive,
	- pièce supprimee logiquement (masquee par defaut au niveau vue).
- Callbacks:
	- onOpenRoom,
	- onAddNote,
	- onSoftDelete,
	- onExportPdf(mode: plan | détail).

## Etats et interactions
- Le clic sur la surface principale de la carte ouvre l'édition de la pièce.
- Les actions secondaires sont affichees sous forme d'icones uniquement.
- L'icone export ouvre un menu a deux choix: plan simple, plan + détail.
- La suppression logique demande confirmation avant execution.

## Règles metier
- Le nom de pièce est obligatoire; si vide a la creation, la valeur par defaut est Nouvelle pièce.
- L'icône est dérivée du type avec `react-icons` et affichée sous le nom et la surface.
- Le type `autre` n'affiche aucune icône et ne réserve aucun emplacement vide.
- Les pièces supprimees logiquement ne sont pas affichees par defaut dans la grille dashboard.
- Les actions de la carte sont executees dans le contexte du projet courant.

## Cas limites
- Pièce non accessible au moment du clic (obsolescence de données): feedback d'erreur controle sans blocage global.
- Échec export PDF: message d'erreur explicite et conservation du contexte.
- Nom de pièce manquant dans les données retournees: affichage du nom normalise Nouvelle pièce.

## Criteres d'acceptation testables
- Given une RoomCard visible, When l'utilisateur clique sur la carte, Then la pièce correspondante s'ouvre en édition.
- Given l'utilisateur clique sur l'icone export, When le menu s'ouvre, Then les deux choix plan simple et plan + détail sont disponibles.
- Given l'utilisateur clique sur l'icone suppression, When il confirme, Then la suppression logique est declenchee.
- Given une pièce sans nom est creee, When la carte est affichee, Then son libelle est Nouvelle pièce.
- Given une pièce possède un type différent de `autre`, When sa RoomCard est affichée, Then l'icône correspondante apparaît sous son nom et sa surface.
- Given une pièce est de type `autre`, When sa RoomCard est affichée, Then aucune icône de type n'est rendue.

## References
- Referentiel global : [ihm.md](../ihm.md)
- Vue associee : [dashboard_view.md](../vues/dashboard_view.md)
- Logique géométrique : [geometry.md](../logique/geometry.md)
