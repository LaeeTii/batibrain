# IHM - WallEditorView

## Objectif

- Fournir une vue de travail dédiée à un mur, représenté de face.
- Permettre de consulter et modifier indépendamment le profil de hauteur de chacune de ses deux faces.
- Afficher les ouvertures et les mesures pertinentes dans le contexte du projet, du niveau, de la pièce et du mur sélectionnés.
- Conserver les conventions de structure, de droits, de sauvegarde et d'historique des autres vues métier à canvas.

## Périmètre

- In-scope:
  - ouverture depuis le bloc d'édition d'un mur dans GlobalEditor2DView ou RoomEditor2DView;
  - choix de la face affichée;
  - consultation et édition du profil ordonné de hauteurs de la face active;
  - affichage et édition des propriétés du mur et de ses ouvertures;
  - affichage des mesures pertinentes en vue de face;
  - gestion des droits projet, du verrouillage géométrique des profils, de l'auto-save et de l'historique.
- Out-of-scope:
  - modification de la géométrie en plan du segment support;
  - création ou suppression du mur;
  - édition simultanée des deux faces;
  - export propre à WallEditorView;
  - choix d'implémentation frontend.

## Contexte d'entrée

- La vue reçoit `projectId`, `levelId`, `wallId` et, lorsqu'elle est ouverte depuis RoomEditor2DView, `roomId`.
- `roomId` indique la pièce d'origine et détermine la face initiale orientée vers cette pièce lorsqu'elle est liée au mur.
- Le mur reste l'objet de contexte pendant toute la présence dans la vue.
- La sélection locale active peut cibler le mur, un point de profil ou une ouverture, sans remplacer le mur de contexte.
- Si le mur n'appartient plus au niveau ou n'est plus accessible, la vue passe en erreur locale bloquante.

## Structure écran

- Layout global:
  - AppSidebar masquable à gauche selon son contrat transverse;
  - zone principale de travail à droite.
- Header principal:
  - nom du projet, du niveau, identifiant court du mur et, lorsqu'elle existe, pièce d'origine;
  - qualification calculée du mur: extérieur ou mitoyen;
  - sélecteur de face;
  - état de sauvegarde: en cours, synchronisé ou échec;
  - bouton `Sauvegarder` pour forcer la persistance du brouillon;
  - boutons icônes `Annuler` et `Rétablir` en haut à droite;
  - action `Retour` vers la vue d'origine.
- Zone de travail:
  - WallElevationCanvas (React-Konva) au centre;
  - panneau d'édition latéral regroupant les propriétés du mur, le profil de la face active et les ouvertures.
- Le canvas conserve les contrôles de zoom, de dézoom, de réinitialisation et l'indicateur d'échelle définis pour les autres canvas.

## Sélecteur de face

### Iconographie propre à la vue
- Retour vers la vue d'origine: `LuArrowLeft`, icône + texte.
- Changer de face: `LuFlipHorizontal2`, icône + texte avec le nom de la face cible.
- Lier ou dissocier les profils: `LuLink` ou `LuUnlink`, icône + texte.
- Ajouter un point intermédiaire: `LuPlus`, icône + texte.
- Supprimer un point intermédiaire: `LuTrash2`, icône seule dans la liste répétitive.
- Verrouiller ou déverrouiller le mur en plan: `LuLock` ou `LuLockOpen`, icône + texte.
- Verrouiller ou déverrouiller le profil affiché: `LuLock` ou `LuLockOpen`, icône + texte.
- Verrouiller ou déverrouiller un point de profil: `LuLock` ou `LuLockOpen`, action de menu contextuel au clic droit.
- États d'auto-sauvegarde, toujours accompagnés d'un texte visible: `LuLoaderCircle`, `LuCircleCheck` et `LuCloudAlert`.
- Les contrôles de zoom et les actions d'historique reprennent les contrats transverses du canvas et du référentiel IHM.

- Tout mur expose exactement deux choix correspondant à ses faces stables gauche et droite.
- Pour un mur mitoyen, chaque choix est libellé avec la pièce vers laquelle la face est orientée.
- Pour un mur extérieur, les choix sont libellés `Face intérieure` et `Face extérieure`.
- Le choix initial applique cet ordre de priorité:
  - face orientée vers la pièce transmise par `roomId` lorsque la vue vient de RoomEditor2DView;
  - face intérieure lorsque le mur est extérieur et qu'aucune pièce d'origine applicable n'est transmise;
  - face gauche dans les autres cas.
- Changer de face:
  - conserve le mur sélectionné et le zoom courant;
  - remplace le profil affiché et les libellés d'orientation;
  - ne modifie pas le profil de la face quittée;
  - ne crée pas d'action dans l'historique tant qu'aucune donnée métier n'est modifiée.
- Le contrôle `Lier les hauteurs des deux faces` est visible à proximité du sélecteur et actif par défaut pour un nouveau mur.

## Canvas de face

- L'axe horizontal représente la longueur du mur depuis son sommet de départ vers son sommet d'arrivée.
- Le sol constitue la référence verticale zéro.
- Le contour supérieur relie les points ordonnés du profil de hauteur de la face active.
- Le profil de la face opposée est rendu en filigrane derrière la face active, avec un contour atténué et pointillé; il n'est ni sélectionnable ni modifiable depuis le canvas.
- Les verticales des extrémités gauche et droite du mur sont affichées en trait plein entre le sol et le contour supérieur.
- La verticale de chaque point intermédiaire est affichée en pointillé entre le sol et le contour supérieur.
- Les ouvertures sont projetées selon leur position, largeur, hauteur et allège.
- Les mesures affichables pertinentes sont:
  - longueur du mur;
  - position et hauteur de chaque point du profil;
  - largeur, hauteur et allège des ouvertures;
  - distances entre une ouverture et les extrémités du mur.
- Une ouverture sélectionnée est mise en surbrillance sur le canvas et dans le panneau d'édition.

## Panneau d'édition

- Bloc `Mur`:
  - action contextuelle `Verrouiller` ou `Déverrouiller`, appliquée aux deux sommets du segment en plan;
  - épaisseur;
  - matériau optionnel;
  - isolation optionnelle;
  - longueur intérieure calculée, non éditable dans cette vue.
- Bloc `Profil de hauteur`:
  - contrôle `Lier les hauteurs des deux faces` et état courant du lien;
  - liste ordonnée des points de la face active;
  - une ligne par point regroupant les champs `Position` et `Hauteur`;
  - identification des extrémités par `Gauche` et `Droite`, et des points intermédiaires par lettres successives `A`, `B`, puis `C`, etc.;
  - position horizontale et hauteur de chaque point;
  - ajout d'un point intermédiaire;
  - modification de la position ou de la hauteur;
  - suppression d'un point intermédiaire.
- Bloc `Ouvertures`:
  - liste des ouvertures du mur;
  - sélection d'une ouverture;
  - propriétés existantes applicables: position, largeur, hauteur, allège et orientation;
  - aucune création d'ouverture depuis WallEditorView.
- Bloc `Profil de hauteur`:
  - action `Verrouiller` ou `Déverrouiller` appliquée à tous les points de la face affichée;
  - état verrouillé calculé depuis tous les points du profil.

## Interactions et sauvegarde

- Un point intermédiaire peut être ajouté depuis le panneau ou sur un emplacement valide du contour supérieur.
- Un point peut être déplacé sur le canvas ou modifié numériquement dans le panneau.
- Les points aux deux extrémités sont obligatoires et ne peuvent pas être supprimés.
- Lorsque le lien est actif, l'ajout, le déplacement, la modification ou la suppression d'un point est reproduit à la même position et hauteur sur l'autre face dans la même action.
- Désactiver le lien conserve les deux profils dans leur état courant et autorise leurs modifications indépendantes.
- Réactiver le lien:
  - ne demande aucune confirmation si les profils sont déjà identiques;
  - demande une confirmation explicite s'ils diffèrent;
  - après confirmation, copie le profil de la face affichée vers l'autre face et active le lien;
  - constitue une seule action annulable dans l'historique.
- Toute modification valide est d'abord appliquée au brouillon local et alimente le même historique de 20 actions que les boutons et raccourcis transverses.
- Un déplacement continu d'un point de profil prévisualise les positions intermédiaires sans les historiser; le relâchement crée une seule action dont l'annulation restaure l'état précédant l'appui.
- Une auto-sauvegarde est lancée toutes les 5 minutes tant que le brouillon contient des changements non sauvegardés.
- Le bouton `Sauvegarder` force la persistance immédiate.
- Une nouvelle action après annulation vide la pile de rétablissement.
- En cas d'échec d'auto-sauvegarde, le brouillon est conservé, un seul message d'erreur non redondant reste visible et une nouvelle tentative intervient au cycle suivant.
- Une sortie effective de la vue avec des changements non sauvegardés demande une confirmation explicite; changer de face ou de sélection locale ne déclenche aucune confirmation.
- Aucun message de succès générique n'est affiché après une sauvegarde standard.

## Règles métier

- Chaque face porte son propre profil; les profils deviennent indépendants lorsque leur lien est désactivé.
- Pour un mur mitoyen, chaque profil physique reste synchronisé dans les projections des deux pièces; si leurs segments sont orientés en sens opposés, les libellés locaux gauche et droite sont permutés et les positions sont inversées.
- Le mur porte un état persistant de liaison des profils, actif par défaut.
- Lorsque le lien est actif, les deux profils contiennent strictement les mêmes positions et hauteurs.
- À la création d'une pièce ou d'un mur, chaque face possède un profil uniforme utilisant la hauteur de mur par défaut de l'utilisateur courant, matérialisé par un point à chaque extrémité.
- Les positions des points sont strictement ordonnées, uniques et comprises entre zéro et la longueur du mur.
- Les hauteurs sont strictement positives.
- La hauteur d'un point d'extrémité commun à deux murs adjacents est propagée au point correspondant du mur voisin, face intérieure avec face intérieure et face extérieure avec face extérieure.
- Une modification de profil ne peut rendre aucune ouverture incompatible avec la hauteur disponible sur l'une des deux faces.
- Lorsque le lien est inactif, le profil de la face opposée reste inchangé lors de l'édition de la face active; lorsqu'il est actif, les deux profils sont modifiés atomiquement.
- Les associations entre faces, pièces et extérieur sont calculées depuis la topologie et ne sont pas éditables dans cette vue.

## Droits et verrouillage

- Le propriétaire et le collaborateur en écriture peuvent modifier les propriétés et ouvertures; l'épaisseur exige que le mur en plan soit déverrouillé et les modifications de profils exigent que les points de hauteur affectés soient déverrouillés.
- Le collaborateur en lecture peut changer de face, consulter le canvas et utiliser le zoom, sans modifier de donnée.
- En lecture seule, les contrôles d'écriture, d'annulation et de rétablissement sont désactivés ou masqués et un indicateur explicite est affiché.
- Toute écriture indirecte est contrôlée côté backend selon les droits du projet.
- Les points de profils portent les seuls verrous persistés de la vue; un profil est calculé verrouillé lorsque tous ses points sont verrouillés.
- Le mur en plan est calculé verrouillé lorsque ses deux sommets sont verrouillés; son bouton de verrouillage modifie ces deux sommets.
- Lorsque le mur en plan est verrouillé, son épaisseur est indisponible, mais son matériau, son isolation et ses notes restent modifiables.
- Un point ou un profil verrouillé reste sélectionnable et consultable, mais ses modifications géométriques sont bloquées.
- Le propriétaire et les collaborateurs en écriture peuvent verrouiller ou déverrouiller un point par clic droit ou le profil depuis son bloc d'édition; le collaborateur en lecture consulte uniquement l'état.
- Lorsque les profils sont liés, les états de verrouillage de leurs points correspondants sont synchronisés.
- Le verrouillage géométrique du segment en plan ne verrouille pas automatiquement les profils de hauteur.
- Les ouvertures ne portent aucun verrou propre et restent modifiables selon les validations de hauteur ordinaires.
- Le verrou collaboratif global du projet est hors périmètre de la V1.0 et sera respécifié dans une version ultérieure.

## Navigation

- L'action `Retour` revient exactement à la vue d'origine.
- Le retour vers GlobalEditor2DView restaure le niveau et le mur sélectionnés.
- Le retour vers RoomEditor2DView restaure la pièce et le mur sélectionnés.
- Le changement de face ne change jamais la pièce de contexte utilisée pour le retour.

## États et feedback

- Chargement initial: spinner global et actions inactives.
- État normal: face, profil, ouvertures et mesures affichés.
- Auto-save en cours: indicateur visible dans le header.
- Auto-sauvegarde en échec: brouillon conservé, unique message persistant et nouvelle tentative au cycle suivant.
- Lecture seule: données consultables et édition désactivée.
- Verrouillage d'un point ou du profil: élément consultable, état explicite et contrôles géométriques indisponibles jusqu'au déverrouillage.
- Mur introuvable ou inaccessible: erreur locale bloquante et action de retour visible.
- Validation refusée: ancienne valeur conservée et message explicite à proximité du contrôle concerné.
- Remise en liaison de profils différents: confirmation indiquant que le profil de la face affichée remplacera celui de l'autre face.

## Cas limites

- Si la pièce d'origine n'est plus liée au mur, la vue conserve le mur et applique le choix initial par défaut: face intérieure pour un mur extérieur, sinon face gauche.
- Si une modification topologique inverse le sens du segment, les profils gauche et droit sont permutés pour rester attachés aux mêmes faces physiques.
- Si une pièce voisine est supprimée, les profils existants sont conservés; seuls les libellés intérieur/extérieur sont recalculés.
- Si une ouverture disparaît pendant son édition, sa sélection est nettoyée et le mur reste affiché.
- Un point intermédiaire ne peut pas être déplacé au-delà de ses voisins ni sur la même position qu'eux.
- Si l'enregistrement de l'un des deux profils liés échoue, aucun des deux profils ni l'état du lien n'est modifié.
- Si les profils sont liés, toute action de verrouillage ou de déverrouillage conserve des états identiques entre points correspondants.
- Une remise en liaison annulée dans la confirmation conserve les deux profils indépendants et laisse le lien inactif.

## Critères d'acceptation testables

- Given un mur est sélectionné dans un éditeur 2D, When l'utilisateur clique sur `Ouvrir la vue Mur`, Then WallEditorView s'ouvre avec les contextes projet, niveau et mur conservés, ainsi que la pièce d'origine si l'action vient de RoomEditor2DView.
- Given WallEditorView est ouverte depuis RoomEditor2DView, When le mur est chargé, Then la face orientée vers la pièce d'origine est affichée.
- Given WallEditorView est ouverte sans pièce d'origine sur un mur extérieur, When le mur est chargé, Then la face intérieure est affichée.
- Given WallEditorView est ouverte sans pièce d'origine sur un mur mitoyen, When le mur est chargé, Then la face gauche est affichée.
- Given un mur mitoyen relie deux pièces, When le sélecteur de face est affiché, Then chaque choix identifie la pièce vers laquelle la face est orientée.
- Given le profil d'une face physique d'un mur mitoyen est modifié depuis une pièce, When le mur est consulté depuis l'autre pièce, Then le profil correspondant présente les mêmes hauteurs aux mêmes emplacements physiques, avec permutation des faces et inversion des positions si le segment local est opposé.
- Given un mur extérieur est affiché, When le sélecteur de face est ouvert, Then les faces intérieure et extérieure sont toutes deux disponibles et éditables selon les droits.
- Given le lien des profils est désactivé et l'utilisateur modifie une face, When il affiche l'autre face, Then le profil de cette dernière est inchangé.
- Given un mur vient d'être créé, When ses faces sont chargées, Then chacune possède deux points d'extrémité à la hauteur de mur par défaut active au moment de sa création.
- Given un mur vient d'être créé, When le panneau de profil est affiché, Then le lien des hauteurs est actif.
- Given un point intermédiaire valide est ajouté, When l'auto-save réussit, Then le contour est mis à jour et l'état devient synchronisé.
- Given deux murs adjacents partagent un sommet, When la hauteur de cette extrémité est modifiée sur la face intérieure de l'un, Then seule l'extrémité de la face intérieure de l'autre reçoit la même hauteur; si les deux faces sont modifiées, leurs deux extrémités sont synchronisées.
- Given un profil comporte des points intermédiaires, When la vue de face et son panneau sont affichés, Then les limites gauche et droite sont en trait plein, les guides intermédiaires sont en pointillé et chaque ligne de saisie porte son repère `Gauche`, `A`, `B`, puis `Droite`.
- Given une face est active dans WallEditorView, When le canvas est rendu, Then son profil est affiché au premier plan et le profil de l'autre face apparaît en filigrane non interactif à l'arrière-plan.
- Given les profils sont liés, When un point est ajouté, déplacé, modifié ou supprimé sur une face, Then les deux profils restent strictement identiques après l'auto-save.
- Given le lien est désactivé, When une face est modifiée, Then le profil de l'autre face reste inchangé.
- Given deux profils différents et le lien inactif, When l'utilisateur demande sa réactivation, Then une confirmation annonce que la face affichée sera utilisée comme source.
- Given la remise en liaison est confirmée, When l'auto-save réussit, Then le profil opposé est remplacé par celui de la face affichée et le lien devient actif dans une seule action annulable.
- Given une modification ferait dépasser une ouverture du profil disponible, When l'utilisateur la valide, Then elle est refusée et un message explicite est affiché.
- Given le rôle projet est lecture, When la vue est affichée, Then les deux faces restent consultables et aucune modification n'est possible.
- Given un point de profil est verrouillé, When l'utilisateur tente de le déplacer, Then le geste est refusé avant toute mutation du brouillon.
- Given un point de profil déverrouillé est déplacé par un geste continu, When l'utilisateur relâche le clic, Then une seule action est ajoutée à l'historique, Annuler restaure l'état précédant l'appui et Rétablir restaure la position finale.
- Given les deux sommets du mur en plan sont verrouillés, When l'utilisateur tente de modifier son épaisseur, Then l'action est refusée, mais le matériau, l'isolation et les notes restent modifiables.
- Given tous les points du profil sont verrouillés, When le profil est affiché, Then son état verrouillé est explicite et aucune modification géométrique n'est possible.
- Given les profils sont liés, When un point est verrouillé sur une face, Then le point correspondant de l'autre face reçoit le même état.
- Given des changements non sauvegardés existent, When l'utilisateur demande le retour, Then une confirmation explicite est affichée avant la sortie.

## Références

- Référentiel global: [ihm.md](../ihm.md)
- Canvas: [canvas.md](../composants/canvas.md)
- Sections métier: [sections.md](../composants/sections.md)
- Composants transverses: [transverses.md](../composants/transverses.md)
- Géométrie: [geometry.md](../logique/geometry.md)
- Synchronisation de sélection: [edition_2D_synchronisation_selection.md](../logique/edition_2D_synchronisation_selection.md)
- Éditeur global: [editeur_2d_global.md](./editeur_2d_global.md)
- Éditeur par pièce: [room_editor_2d_view.md](./room_editor_2d_view.md)

## État d’implémentation V1-R20

- WallEditorView est routée depuis les éditeurs global et pièce et charge l’instantané canonique du niveau.
- WallElevationCanvas React-Konva affiche une face, son profil ordonné, ses ouvertures, ses mesures et les contrôles de zoom partagés.
- Les propriétés du mur, profils multi-points, liaisons, ouvertures et verrous sont appliqués au brouillon local puis sauvegardés atomiquement.
- Les droits de lecture seule, l’historique, la sauvegarde manuelle, l’auto-sauvegarde et la confirmation de sortie utilisent les contrats transverses des éditeurs.
