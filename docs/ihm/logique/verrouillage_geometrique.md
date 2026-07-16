# Verrouillage géométrique

Date de mise à jour: 2026-07-16

## Objectif

- Protéger les coordonnées du plan et les profils de hauteur contre les modifications géométriques accidentelles.
- Refuser immédiatement une interaction interdite avant toute modification du brouillon local.
- Dériver l'état verrouillé des pièces, murs, profils et côtes depuis les points persistés, sans multiplier les types de verrous.
- Distinguer ce verrouillage manuel du futur verrou collaboratif global du projet, reporté après la V1.0.

## Sources persistées

- Un sommet du plan porte un booléen persistant `isLocked`, initialisé à `false`.
- Un point de profil de hauteur porte un booléen persistant `isLocked`, initialisé à `false`.
- Une pièce, un mur, un profil de hauteur, une côte et une ouverture ne portent aucun verrou géométrique propre persistant.
- Une ouverture reste déplaçable, redimensionnable et supprimable même lorsque son mur support est verrouillé.

## États calculés

- Un mur est verrouillé lorsque ses deux sommets sont verrouillés.
- Une pièce est verrouillée lorsque tous les murs de son contour sont verrouillés.
- Une côte rattachée à un mur verrouillé, ou utilisant un point verrouillé comme référence, est verrouillée pour ses interactions géométriques.
- Un profil de hauteur est verrouillé lorsque tous ses points sont verrouillés.
- Lorsque les profils gauche et droit sont liés, les états de verrouillage de leurs points correspondants sont synchronisés.
- Un mur mitoyen n'existe qu'une fois: son état calculé est identique depuis chacune des pièces liées.
- Un point partagé transmet volontairement son état aux calculs de tous les murs et pièces qui le référencent.

## Actions de verrouillage

- Le clic droit sur un sommet du plan propose l'action `Verrouiller` ou `Déverrouiller`.
- Le clic droit sur un point de profil propose la même action.
- Le bouton de verrouillage du bloc d'édition d'un mur verrouille ou déverrouille ses deux sommets.
- Le bouton de verrouillage du bloc d'édition d'une pièce verrouille ou déverrouille tous les sommets des murs de son contour.
- Le bouton de verrouillage d'un profil verrouille ou déverrouille tous ses points.
- Lorsque les profils sont liés, toute action de verrouillage sur un profil ou l'un de ses points applique le même état au profil opposé et à son point correspondant.
- Les effets sur les murs et pièces voisins partageant un point sont immédiats et volontaires.
- Le propriétaire et les collaborateurs en écriture peuvent modifier les verrous; un collaborateur en lecture consulte uniquement leur état.

## Brouillon et sauvegarde

- L'état chargé depuis la base initialise les verrous du brouillon.
- Verrouiller un point dans le brouillon le rend immédiatement non déplaçable.
- Déverrouiller un point dans le brouillon le rend immédiatement déplaçable.
- Une interaction interdite est refusée avant toute mutation visuelle, métier ou d'historique.
- Le verrouillage, le déverrouillage et les modifications géométriques autorisées peuvent être sauvegardés dans une transaction atomique unique.
- La frontière transactionnelle refuse une modification géométrique d'un point verrouillé dans l'état courant de la base, sauf si la même transaction contient son déverrouillage autorisé.
- En cas d'échec, la base conserve son état précédent complet et le brouillon local est conservé pour une nouvelle tentative.

## Modifications bloquées

- Un sommet verrouillé ne peut être ni déplacé ni supprimé.
- Un mur verrouillé ne peut pas être déplacé, détaché, scindé, supprimé ni recevoir une modification d'épaisseur.
- Une pièce verrouillée ne peut pas être déplacée, transformée topologiquement ni supprimée.
- Une côte verrouillée ne peut pas être repositionnée ni supprimée.
- Un point de profil verrouillé ne peut pas être déplacé, modifié ni supprimé.
- Un profil verrouillé ne peut recevoir aucune modification géométrique.
- Une transformation est refusée dans son ensemble si elle devrait déplacer, supprimer ou remplacer un point verrouillé.

## Modifications non bloquées

- Le verrou géométrique d'un mur ne bloque pas son matériau, son isolation ni ses notes.
- Le verrou géométrique d'une pièce ne bloque pas son nom, son type, sa couleur de sol ni ses notes.
- Les ouvertures n'ont pas de verrou propre: leur position, leurs dimensions, leurs propriétés et leur suppression restent disponibles selon les droits projet et les validations géométriques ordinaires.
- Les profils de hauteur sont indépendants du verrouillage géométrique du segment en plan.

## Modification de longueur d'un mur

- Si le sommet de début est verrouillé et le sommet de fin déverrouillé, le sommet de début reste l'ancrage et seul le sommet de fin se déplace.
- Si le sommet de fin est verrouillé et le sommet de début déverrouillé, le sommet de fin reste l'ancrage et seul le sommet de début se déplace.
- Si aucun sommet n'est verrouillé, le sommet de début reste l'ancrage par défaut et le sommet de fin se déplace.
- Si les deux sommets sont verrouillés, la modification de longueur est refusée avant toute modification du brouillon.
- L'orientation courante du mur est conservée pendant cette modification.

## Affichage

- Un sommet verrouillé expose un état visuel distinct et reste sélectionnable.
- Un mur calculé verrouillé est affiché en rouge sur le plan.
- Une pièce calculée verrouillée affiche un cadenas à côté de son nom.
- Un profil et ses points affichent leur état verrouillé dans WallEditorView.
- La sélection, la surbrillance et la consultation restent disponibles pour tous les objets verrouillés.

## Critères d'acceptation

- Given un sommet est verrouillé au chargement, When l'utilisateur tente de le déplacer, Then le geste est refusé avant toute modification du brouillon.
- Given un sommet est déverrouillé dans le brouillon, When l'utilisateur le déplace, Then le déplacement devient immédiatement disponible sans attendre la sauvegarde.
- Given un mur est verrouillé depuis son bloc d'édition, When l'action est appliquée, Then ses deux sommets deviennent verrouillés et le mur apparaît en rouge dans toutes les pièces liées.
- Given une pièce est verrouillée, When l'action est appliquée, Then tous les sommets de ses murs sont verrouillés et les murs mitoyens apparaissent verrouillés depuis les pièces voisines.
- Given un mur partage un sommet avec un autre mur, When ce sommet est déverrouillé, Then l'état calculé de tous les murs et pièces concernés est immédiatement recalculé.
- Given un mur possède un seul sommet verrouillé, When sa longueur est modifiée, Then seul l'autre sommet se déplace en conservant l'orientation.
- Given les deux sommets d'un mur sont verrouillés, When sa longueur ou son épaisseur est modifiée, Then l'action est refusée sans brouillon ni historique partiel.
- Given un mur est verrouillé, When son matériau, son isolation, ses notes ou une ouverture sont modifiés, Then l'action reste disponible si les autres validations sont satisfaites.
- Given un profil est verrouillé, When un point est déplacé ou supprimé, Then l'action est refusée avant toute mutation du brouillon.
- Given les profils sont liés, When un point est verrouillé ou déverrouillé sur une face, Then le point correspondant de l'autre face reçoit immédiatement le même état.
- Given un déverrouillage et une modification géométrique sont présents dans le même brouillon, When la sauvegarde réussit, Then les deux changements sont persistés atomiquement.
- Given un point reste verrouillé dans la base et aucun déverrouillage n'est soumis, When une écriture tente de modifier sa géométrie, Then la transaction entière est refusée.

## Références

- Contrat géométrique: [geometry.md](./geometry.md)
- Synchronisation de sélection: [edition_2D_synchronisation_selection.md](./edition_2D_synchronisation_selection.md)
- Canvas: [../composants/canvas.md](../composants/canvas.md)
- Sections: [../composants/sections.md](../composants/sections.md)
- Éditeur global: [../vues/editeur_2d_global.md](../vues/editeur_2d_global.md)
- Éditeur pièce: [../vues/room_editor_2d_view.md](../vues/room_editor_2d_view.md)
- Vue mur: [../vues/wall_editor_view.md](../vues/wall_editor_view.md)
