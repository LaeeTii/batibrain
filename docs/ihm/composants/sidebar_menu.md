# Side bar menu- description

## Structure (colone de gauche)
- Logo + nom de l'application
- Avatar + nom de l'utilisateur connecté
- Séléction du projet courant (dropdown)
- Action de gestion des collaborateurs dans le contexte du projet courant, visible uniquement pour son propriétaire, ouvrant ProjectCollaborationModal.
- "créer un projet" (bouton) -> ouvre une modale.
- "Tableau de bord" (bouton) -> ouvre la vue tableau de bord
- "Édition globale" (bouton) -> ouvre la vue édition globale du projet
- "Métriques" (bouton) -> ouvre la vue métriques
- "Photos" (bouton) -> ouvre la vue photos (désactivé pour le moment)
- "Documents" (bouton) -> ouvre la vue documents (désactivé pour le moment)
- "Travaux" (bouton) -> ouvre la vue travaux (désactivé pour le moment)
- "Tâches" (bouton) -> ouvre la vue tâches (désactivé pour le moment)
- "planning" (bouton) -> ouvre la vue planning (désactivé pour le moment)
- "Paramètres" (bouton) ancré en bas de la side bar -> ouvre la modale SettingsModal du composant transverse avec les paramètres de l'application.

## Règles métiers

- Le bouton "Créer un projet" ouvre un modal avec les champs suivants :
    - Nom du projet (input text)
    - Description (input text)
    - Bouton "Créer" (button actif que si le champ nom est rempli)

- Après la création d'un projet, la modale se ferme, Le projet est créé dans la base de données et le champ séléction du projet courant est mis à jour avec le projet créé. 

- le projet courant détermine le contexte de l'application, toutes les vues affichent les données du projet courant.

- le sélecteur de projet contient les projets possédés par l'utilisateur et les projets partagés dont il a accepté l'invitation.

- un projet faisant l'objet d'une invitation encore en attente n'apparaît pas dans le sélecteur.

- la modale de paramètres permet de changer le thème (clair/sombre), l'unité de mesure (cm/m/mm, avec cm par défaut) et l'unité de surface (cm2/m2/mm2, avec m2 par défaut). Ces paramètres sont persistés dans la base de données pour l'utilisateur courant. On peut aussi se déconnecter de l'application depuis cette modale. La déconnexion redirige vers la page de login.

