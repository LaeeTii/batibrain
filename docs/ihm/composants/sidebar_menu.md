# Side bar menu- description

## Structure (colone de gauche)
- Bouton icône de fermeture de la side bar.
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

Lorsque la side bar est fermée, elle est masquée et un bouton icône menu reste visible en haut à gauche de l'application pour la rouvrir.

## Règles métiers

- L'utilisateur peut fermer la side bar depuis son bouton icône de fermeture.

- La fermeture masque uniquement la side bar et ne modifie ni le projet courant, ni la vue active, ni les données affichées.

- Le bouton icône menu situé en haut à gauche de l'application permet de rouvrir la side bar.

- L'état ouvert ou fermé est conservé lors des changements de vue pendant la session applicative courante.

- L'état n'est pas persisté après un rechargement de l'application.

- Le bouton "Créer un projet" ouvre un modal avec les champs suivants :
    - Nom du projet (input text)
    - Description (input text)
    - Bouton "Créer" (button actif que si le champ nom est rempli)

- Après la création d'un projet, la modale se ferme, Le projet est créé dans la base de données et le champ séléction du projet courant est mis à jour avec le projet créé. 

- le projet courant détermine le contexte de l'application, toutes les vues affichent les données du projet courant.

- le sélecteur de projet contient les projets possédés par l'utilisateur et les projets partagés dont il a accepté l'invitation.

- un projet faisant l'objet d'une invitation encore en attente n'apparaît pas dans le sélecteur.

- la modale de paramètres permet de changer le thème (clair/sombre), l'unité de mesure (cm/m/mm, avec cm par défaut) et l'unité de surface (cm2/m2/mm2, avec m2 par défaut). Ces paramètres sont persistés dans la base de données pour l'utilisateur courant. On peut aussi se déconnecter de l'application depuis cette modale. La déconnexion redirige vers la page de login.

## Critères d'acceptation testables

- Given la side bar est ouverte, When l'utilisateur active son bouton icône de fermeture, Then la side bar est masquée et la zone principale reste affichée.
- Given la side bar est fermée, When l'utilisateur active le bouton icône menu en haut à gauche de l'application, Then la side bar est rouverte.
- Given la side bar est fermée, When l'utilisateur change de vue, Then la nouvelle vue conserve la side bar fermée et le bouton icône menu reste disponible.
- Given la side bar est fermée, When l'application est rechargée, Then la side bar retrouve son état ouvert par défaut.
