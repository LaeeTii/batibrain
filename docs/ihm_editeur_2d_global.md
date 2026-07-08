# IHM editeur 2D global

## Perimetre du document
- Ce document decrit les parcours utilisateur, les etats d'interface, les panneaux, les modes et les regles d'interaction.
- Le contrat geometrique appartient a [geometry.md](./geometry.md).
- Les regles de synchronisation de selection appartiennent a [edition_2D_synchronisation_selection.md](./edition_2D_synchronisation_selection.md).

## Vue globale - description
## Un sidebar menu a gauche
## Header principal
    ### Ligne 1 : Nom du projet (horizontal cadre a gauche)

## Une section principale avec :
    ### Header :
        #### Ligne 1
            ##### Checkbox pour afficher / cacher les cotes, angles, grille, regles, notes (horizontal cadre a gauche)
            ##### Menu pour activer ou desactiver le magnetisme (horizontal cadre a gauche a la suite) :
             - Cases a cocher : grille, sommets, intersections, murs, milieux
             - Curseur magnetique : distance de magnetisme (input number positif)
            ##### Bouton pour exporter le plan en PDF (horizontal cadre a droite)
        #### Ligne 2 :
            ###### Menu multi-selection pour afficher / cacher les niveaux (horizontal cadre a gauche)
            ###### Selecteur de niveau pour choisir le niveau editable (horizontal cadre a gauche a la suite)
    ### Section avec 3 colonnes :
        #### Panneau menu creation (gauche - dim 1/6 de la section principale)
            ##### Bouton "retour" (retour au menu creation - tous accordeons fermes)
            ##### Accordeon "Niveaux" - ferme par defaut
                ###### Bloc de creation d'etage :
                    ####### Ligne 1 : Nom (input text)
                    ####### Ligne 2 : Niveau (input number entier, positif ou negatif)
                    ####### Ligne 3 : Bouton "Creer" (actif uniquement si Nom et Niveau sont renseignes)
                ###### Liste des niveaux existants avec possibilite de les cocher pour les afficher, et bouton "X" en fin de ligne pour les supprimer (archivage en cascade)
            ##### Accordeon "Pieces" - ferme par defaut
                ###### Bloc de creation de piece :
                    ####### Zone d'indication : "Cliquez sur le plan et deplacez-vous pour dessiner une piece."
                    ####### Ligne 1 : Nom (input text) - "nouvelle piece" par defaut dans le niveau actif
                    ####### Ligne 2 : Type (select) (optionnel)
                    ####### Ligne 3 : Couleur du sol (select) (couleur par defaut : #E5FFFC, choix de couleurs pastels)
                    ####### Ligne 4 : Epaisseur (input number positif) valeur par defaut 10 cm
                    ####### Ligne 5 : Hauteur (input number positif) valeur par defaut 250 cm
                ###### Accordeon "Liste" - ferme par defaut
                    ####### Liste des pieces existantes avec possibilite de les selectionner en cliquant dessus et un bouton supprimer "X" au bout de la ligne
            ##### Accordeon "Murs" - ferme par defaut
                ###### Bloc de creation de mur :
                    ####### Zone d'indication : "Cliquez sur le plan et deplacez-vous pour dessiner un mur."
                    ####### Ligne 1 : Epaisseur (input number positif)
                    ####### Ligne 2 : Materiau (select avec creation possible d'un nouveau materiau) (optionnel)
                    ####### Ligne 3 : Isolation (select avec creation possible d'une nouvelle isolation) (optionnel)
                ###### Accordeon "Liste" - ferme par defaut
                    ####### Liste des murs existants avec possibilite de les supprimer
                ###### Bloc edition de mur (visible uniquement si un mur est selectionne dans le canvas (plan))
                    ####### Memes champs que pour la creation de mur, mais pre-remplis avec les valeurs du mur selectionne
                    ####### Ligne 5 : Couper en deux (bouton)
                    ####### Ligne 6 : Detacher (bouton)
                    ####### Ligne 7 : Supprimer (bouton)
            ##### Accordeon "Ouvertures" - ferme par defaut
                ###### Bloc de creation d'ouverture :
                    ####### Zone d'indication : "Choisissez une ouverture dans la liste des templates, puis survolez un mur pour la positionner et cliquez pour la poser."
                    ####### Ligne 1 : Filtre (select : porte / fenetre / baie vitree / autre) - par defaut aucun filtre
                    ####### Liste des ouvertures templates en fonction du filtre (schema de face de l'ouverture + nom de l'ouverture)
                ###### Bloc edition d'ouverture (visible uniquement si une ouverture existante est selectionnee)
                    ####### Memes champs que pour la creation d'ouverture, mais pre-remplis avec les valeurs de l'ouverture selectionnee
                    ####### Inverser le sens de l'ouverture (bouton)
                    ####### Ouvrant gauche / droite (switch) (si applicable)
                    ####### Ligne 5 : Supprimer (bouton)
                ###### Accordeon "Liste" - ferme par defaut
                    ####### Liste des ouvertures existantes avec possibilite de les selectionner en cliquant dessus et un bouton supprimer "X" au bout de la ligne
            ##### Accordeon "Cotes" - ferme par defaut
                ###### Bloc de creation de cote :
                    ####### Zone d'indication : "Cliquez pour placer le premier point, cliquez pour placer le second point, puis deplacez la souris pour regler le decalage et cliquez pour valider la cote."
                    ####### Ligne 1 : Nom (input text) - si vide, valeur "nouvelle cote"
                    ####### Types de mesure supportes : point a point, mur a mur, point sur mur
                ###### Bloc edition de cote (visible uniquement si une cote existante est selectionnee)
                    ####### Ligne 1 : Nom (input text)
                    ####### Ligne 2 : Repositionner le decalage (bouton)
                    ####### Ligne 3 : Supprimer (bouton)
                ###### Accordeon "Liste" - ferme par defaut
                    ####### Liste des cotes existantes avec possibilite de les selectionner en cliquant dessus et un bouton supprimer "X" au bout de la ligne
            ##### Accordeon "Notes" - ferme par defaut
                ###### Bloc de creation de note :
                    ####### Zone d'indication : "Selectionnez l'objet de votre note. Sans selection, la note sera attribuee au projet."
                    ####### Ligne 1 : Texte (textarea) - sans limite de longueur
                    ####### Origine dynamique avant validation : suit la selection courante (piece, mur, point, ouverture). Sans selection, origine projet.
                ###### Bloc edition de note (visible uniquement si une note existante est selectionnee)
                    ####### Ligne 1 : Texte (textarea)
                    ####### Ligne 2 : Changer origine (bouton)
                    ####### Ligne 3 : Supprimer (bouton)
                ###### Accordeon "Liste" - ferme par defaut
                    ####### Liste des notes existantes avec possibilite de les selectionner en cliquant dessus et un bouton supprimer "X" au bout de la ligne. Format origine affiche : "nom_niveau-nom_piece-id_mur" ou "nom_niveau-nom_piece" ou "nom_projet-01"
        #### Canvas (plan) (centre - dim 4/6 de la section principale ou dim 5/6 si le panneau detail est ferme)
            - Bouton "Detail" en haut a droite du canvas (plan) pour ouvrir le panneau detail
            - Zone de dessin avec grille et regles, affichage des cotes et angles selon les options d'affichage.
            - Affichage des pieces, murs, ouvertures, cotes et notes selon le menu multi-selection de niveaux.
            - Les murs sont affiches avec leur epaisseur graphique.
            - Le niveau editable est celui selectionne dans la ligne 2 du header.
            - Les niveaux inferieurs et superieurs selectionnes sont affiches mais non editables.
            - Rendu visuel des autres niveaux : teinte gris/rose pour les niveaux inferieurs, teinte gris/bleu pour les niveaux superieurs, avec une opacite variable de -20% par ecart de niveau.
            - Affichage des cotes : 100% d'opacite sur le niveau actif et opacite reduite sur les autres niveaux coches.
            - Affichage des notes liees au niveau actif a 100% d'opacite et opacite reduite sur les autres niveaux coches.
            - Une note apparait avec une petite bulle et un icone "note" relies par un trait a l'objet lie.
            - Les notes de projet (non liees a un objet) apparaissent dans une bulle en bas a droite du canvas, sous forme de liste cliquable.
            - Possibilite de selectionner un objet du niveau editable (piece, mur, ouverture, cote, note, point) en cliquant dessus.
            - L'objet selectionne peut etre deplace avec la souris.
            - Une echelle graphique est affichee en bas a droite du canvas.
            - Les details de propagation de selection, d'ouverture automatique des accordeons et de surbrillance croisee sont definis dans [edition_2D_synchronisation_selection.md](./edition_2D_synchronisation_selection.md).
            - Boutons "+", "-" et "[o]" pour zoomer / dezoomer / reinitialiser le zoom du canvas (plan) en bas a droite du canvas.
        #### Panneau detail (droite - dim 1/6 de la section principale quand ouvert, sinon dim 0/6)
            ##### Titre : "Detail"
            ##### Arbre de navigation
                - Bouton "-" pour fermer le panneau detail, en haut a droite
                - Niveau 1 : Nom, nb de pieces
                    - Notes niveau : liste des notes liees au niveau
                    - Cote 1 : nom, valeur
                    - Piece 1 : Nom, surface
                        - Notes piece : liste des notes liees a la piece
                        - Mur 1 : id, longueur, epaisseur, materiau, isolation, hauteur, type (int/ext)
                            - Notes mur : liste des notes liees au mur
                            - Ouverture 1 : type, longueur, hauteur, allege, interieur/exterieur
                                - Notes ouverture : liste des notes liees a l'ouverture
                        - Angle 1 : id, valeur
                - Notes projet : liste des notes liees au projet

## Regles metiers
- Les accordeons de 1er niveau (Niveaux, Pieces, Murs, Ouvertures, Cotes, Notes) sont mutuellement exclusifs : un seul accordeon peut etre ouvert a la fois.
- Les sous-sections internes (exemple : "Liste") peuvent rester ouvertes en meme temps que le bloc creation/edition de leur accordeon.
- Le bouton "retour" ferme tous les accordeons et quitte le mode d'edition actif du canvas.

- Niveaux :
    - Le niveau 0 est cree automatiquement a la creation d'un projet.
    - Le niveau 0 est obligatoire et ne peut pas etre supprime.
    - Au moins un niveau doit toujours etre coche (impossible d'avoir 0 niveau coche).
    - Le niveau editable est choisi explicitement dans le selecteur de niveau du header (ligne 2).
    - Le champ Niveau est un entier uniquement.
    - La suppression d'un niveau est un archivage en cascade des objets enfants.

- Modes d'edition selon l'accordeon ouvert :
        - Accordeon "Niveaux" : pas de mode d'edition sur le canvas.
        - Accordeon "Pieces" :
      Avec la souris, on place le premier point de la piece (rectangulaire par defaut) puis on place le coin oppose pour creer la piece.
      Entre les deux clics, on voit la longueur et la largeur de la piece en temps reel.
            Les evolutions vers une piece polygonale sont possibles.
        - Accordeon "Murs" :
      Avec la souris, on place le premier point du mur puis on place le point final pour creer le mur.
      Entre les deux clics, on voit la longueur du mur en temps reel.
        - Accordeon "Ouvertures" :
      On choisit d'abord une ouverture template dans la liste.
            Au survol d'un mur, l'ouverture suit la souris en affichant les mesures a gauche et a droite.
      Au clic, l'ouverture est posee sur le mur a l'endroit choisi.
      Si aucun mur valide n'est detecte, le mode creation d'ouverture se ferme et l'interface revient avec tous les accordeons fermes.
        - Accordeon "Cotes" :
            On clique pour placer le premier point, puis on clique pour placer le second point.
            La distance est calculee automatiquement.
            On deplace la souris pour regler la position de la cote (decalage), puis on clique pour valider.
            La touche Echap annule la creation en cours.
            Le snapping applique les memes options que le magnetisme global (grille, sommets, intersections, murs, milieux).
            Les cotes sont associees au niveau actif lors de leur creation.
        - Accordeon "Notes" :
            C'est un formulaire texte avec selection d'objet.
            Tant que la note n'est pas validee, son origine est dynamique et suit la selection courante (piece, mur, point, ouverture).
            S'il n'y a pas de selection, la note est attribuee au projet.
            La touche Echap annule la creation en cours.

- Actions de blocs edition :
    - Pour les murs :
        - Couper en deux : le mur est coupe en deux a l'endroit du clic. Le snapping est uniquement sur le milieu.
        - Detacher : les points d'ancrage sont mis en surbrillance avec un petit "-" et l'utilisateur clique sur le point souhaite pour le deplacer. Le mur est detache du mur auquel il etait lie.
        - Supprimer : le mur est retire du canvas.
    - Pour les pieces :
        - Supprimer : la piece est retiree du canvas.
    - Pour les ouvertures :
        - Inverser le sens de l'ouverture : l'ouverture est inversee dans le mur auquel elle est liee (ouvrant change de piece).
        - Ouvrant gauche / droite : permet d'inverser l'ouvrant selon le mur support.
        - Supprimer : l'ouverture est retiree du canvas.
    - Pour les cotes :
        - Nom : modifiable; si vide, la valeur devient "nouvelle cote".
        - Repositionner le decalage : permet de deplacer la ligne de cote plus ou moins loin de la distance mesuree.
        - Supprimer : la cote est retiree du canvas.
    - Pour les notes :
        - Texte : modifiable (textarea, sans limite de longueur).
        - Changer origine : permet de reassocier la note a un autre objet (piece, mur, point, ouverture) ou au projet.
        - Supprimer : la note est retiree du canvas.


- Etats et feedback utilisateur :
    - Les mesures sont affichees en cm dans le canvas (plan) et dans les panneaux, avec un arrondi a 1 decimale.
    - Si la base est active, les modifications sont visibles en temps reel.
    - En cas d'echec d'ecriture persistant, l'interface fait un rollback visuel et affiche un message d'erreur.

- Regles d'affichage des mesures sur le canvas :
    - En mode sans edition, si la case d'affichage des cotes est cochee, le canvas affiche par defaut les longueurs exterieures du niveau actif.
    - En mode sans edition, si la case d'affichage des cotes est cochee, le canvas affiche par defaut les longueurs interieures des pieces.
    - En mode sans edition, si la case d'affichage des angles est cochee, le canvas affiche uniquement les angles differents de 90 degres.
    - En mode sans edition, si la case d'affichage des cotes est cochee, le canvas affiche toujours les cotes ajoutees manuellement.
    - En mode sans edition, si la case d'affichage des cotes est cochee, le canvas affiche les distances horizontales des ouvertures.
    - En mode sans edition, si la case d'affichage des cotes est cochee, chaque fenetre affiche son allege et sa hauteur au format "allege/hauteur" a cote de l'ouverture.
    - L'echelle graphique en bas a droite du canvas reste visible hors edition.
    - En mode edition "Piece", "Mur" ou "Ouverture", le focus visuel se fait sur les mesures directement liees a l'objet edite.
    - En mode edition "Piece", "Mur" ou "Ouverture", les autres mesures restent visibles mais attenuees tant que la case d'affichage des cotes ou des angles correspondante reste cochee.
    - En mode edition, les mesures directement liees a l'objet edite restent toujours affichees, meme si la case d'affichage globale correspondante est decochee.
    - En mode edition d'une ouverture, les distances horizontales gauche et droite restent toujours visibles autour de l'ouverture editee.
    - En mode edition d'une fenetre, l'annotation "allege/hauteur" reste toujours visible pour l'ouverture editee.

- Panneaux :
    - On peut reduire le panneau "creation" en cliquant sur un bouton "-" en haut a droite du panneau.
    - Le panneau "creation" reduit affiche un bouton "+" carre pour le rouvrir.
    - Le panneau "detail" est ferme par defaut.
    - Quand le panneau "detail" est reduit, un petit bouton "!" permet de le rouvrir.
    - Quand le panneau "detail" est developpe, son titre est "Detail".

- Export PDF :
    - Export "Plan" : inclut uniquement les niveaux selectionnes et les affichages selectionnes (regles, cotes, angles, grille, notes).
    - Export "Detail" : inclut le plan de chaque niveau avec les affichages selectionnes (regles, cotes, angles, grille, notes) et un tableau reprenant le contenu du panneau detail.

