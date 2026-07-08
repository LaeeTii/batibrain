# Side bar - description

## Structure (colone de gauche)
- Logo + nom de l'application
- Avatar + nom de l'utilisateur connecté
- Séléction du projet courant (dropdown)
- "créer un projet" (bouton) -> ouvre une modale.
- "Tableau de bord" (bouton) -> ouvre la vue tableau de bord
- "Édition globale" (bouton) -> ouvre la vue édition globale du projet
- "Métriques" (bouton) -> ouvre la vue métriques
- "Photos" (bouton) -> ouvre la vue photos (désactivé pour le moment)
- "Documents" (bouton) -> ouvre la vue documents (désactivé pour le moment)
- "Travaux" (bouton) -> ouvre la vue travaux (désactivé pour le moment)
- "Tâches" (bouton) -> ouvre la vue tâches (désactivé pour le moment)
- "planning" (bouton) -> ouvre la vue planning (désactivé pour le moment)
- "Paramètres" (bouton) ancré en bas de la side bar -> ouvre une modale avec les paramètres de l'application (langue, thème, etc., unité de mesure, etc.)

## Règles métiers

- Le bouton "Créer un projet" ouvre un modal avec les champs suivants :
    - Nom du projet (input text)
    - Description (input text)
    - Bouton "Créer" (button actif que si le champ nom est rempli)

- Après la création d'un projet, la modale se ferme, Le projet est créé dans la base de données et le champ séléction du projet courant est mis à jour avec le projet créé. 

- le projet courant détermine le contexte de l'application, toutes les vues affichent les données du projet courant.

- la modale de paramètres permet de changer la langue de l'application, le thème (clair/sombre) et l'unité de mesure (cm/m/mm). Ces paramètres sont persistés dans la base de données pour l'utilisateur courant. On peut aussi se déconnecter de l'application depuis cette modale. La déconnexion redirige vers la page de login.


