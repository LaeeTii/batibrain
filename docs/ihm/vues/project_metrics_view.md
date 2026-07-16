# IHM — ProjectMetricsView

## Objectif

Fournir une lecture tabulaire exhaustive des pièces, murs et ouvertures du projet courant, avec leurs propriétés sources et toutes les métriques qui peuvent en être calculées.

## Périmètre

- Consultation du projet courant uniquement.
- Trois tableaux affichés dans l'ordre: pièces, murs, ouvertures.
- Filtre et tri sur chaque colonne.
- Export du résultat en PDF, Excel et CSV.
- Aucun comparatif entre projets et aucune période temporelle en V1.

## Structure écran

- Socle applicatif authentifié défini dans `ihm.md`.
- Header avec le nom du projet courant et les actions d'export PDF, Excel et CSV.
- Sections `Pièces`, `Murs` et `Ouvertures`, dans cet ordre.
- Chaque en-tête de colonne porte ses commandes de filtre et de tri.

## Interactions utilisateur

- Trier une colonne en ordre ascendant ou descendant, puis annuler son tri.
- Filtrer chaque colonne selon son type: recherche textuelle, sélection de valeurs ou intervalle numérique.
- Combiner les filtres de plusieurs colonnes d'un même tableau.
- Réinitialiser séparément les filtres et tris de chaque tableau.
- Exporter les lignes actuellement filtrées et triées.
- Un changement de projet recharge les tableaux et réinitialise filtres et tris.

## Règles métier

- Seuls les objets actifs du projet courant sont affichés.
- Les valeurs dérivées utilisent les fonctions partagées de `web/src/domain/` et ne sont pas persistées.
- Les unités suivent les préférences utilisateur.
- Les valeurs internes restent calculées en centimètres et centimètres carrés, puis sont converties pour la saisie, l'affichage et l'export.
- Une métrique non applicable est affichée `Non applicable`, jamais zéro.
- Les valeurs sont identiques à celles des éditeurs et des exports.
- Le rôle lecture peut consulter, filtrer, trier et exporter.
- Aucun tableau ne permet de modifier les données métier.

## Données affichées

### Tableau Pièces

- niveau;
- nom et type;
- surface et périmètre;
- coordonnées du centroïde;
- nombres de sommets et de murs;
- épaisseur et hauteur de mur de référence.

### Tableau Murs

- niveau et pièces liées;
- longueur intérieure et épaisseur;
- qualification intérieure ou extérieure;
- état lié ou dissocié des profils;
- hauteurs minimale et maximale de chaque face;
- nombre d'ouvertures.

### Tableau Ouvertures

- niveau, pièces adjacentes et mur support;
- template et type intérieur ou extérieur;
- distance depuis le début du mur;
- largeur, hauteur et altitude;
- surface de l'ouverture.

Toute autre propriété source ou métrique calculable ajoutée au domaine doit rejoindre le tableau correspondant lorsqu'elle apporte une information distincte et compréhensible.

## Contrat des exports à compléter avant implémentation

Invariants déjà validés:

- chaque export reprend uniquement les lignes visibles après application des filtres;
- l'ordre des lignes suit le tri actif de chaque tableau;
- les valeurs et libellés d'unité sont identiques à ceux affichés au déclenchement;
- les objets supprimés logiquement restent exclus;
- le rôle lecture peut produire les mêmes exports que le propriétaire sans modifier les données.

Décisions encore à documenter avant V1-31:

- structure et pagination du PDF;
- nombre, nom et ordre des feuilles Excel;
- conditionnement CSV en un ou plusieurs fichiers;
- convention de nommage des fichiers et métadonnées communes.

V1-31 ne peut commencer tant que ces décisions ne sont pas inscrites dans cette vue ou dans un composant d'export dédié.

## États et feedback

- Chargement: squelette par tableau.
- Tableau vide: message explicite.
- Filtres sans résultat: message et action de réinitialisation.
- Erreur: message et action `Réessayer`.
- Export en cours: action désactivée avec progression visible.
- Échec d'export: message sans perte des filtres ni des tris.

## Cas limites

- Projet sans pièce.
- Donnée invalide héritée empêchant une métrique: valeur indisponible sans bloquer les autres lignes.
- Mur lié à zéro, une ou deux pièces.
- Profils de mur dissociés.
- Valeur non applicable ou absente lors d'un filtre numérique.

## Critères d'acceptation testables

- Trois tableaux apparaissent dans l'ordre pièces, murs, ouvertures.
- Chaque colonne est filtrable et triable selon son type.
- Les filtres d'un tableau se combinent et se réinitialisent sans affecter les autres.
- Les métriques correspondent au domaine et aux unités choisies.
- Les objets supprimés logiquement sont absents.
- Le rôle lecture peut filtrer, trier et exporter sans modifier les données.
- Les exports reproduisent lignes, ordre, unités et valeurs de la vue filtrée.
- Une valeur non applicable est distinguée de zéro.

## Références

- Référentiel global: [ihm.md](../ihm.md)
- Géométrie: [geometry.md](../logique/geometry.md)
- Préférences et droits: [transverses.md](../composants/transverses.md)
- Registre produit: [spec.md](../../spec.md)
