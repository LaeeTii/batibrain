# Vue globale - description
## un side-bar menu à gauche
## Header principal
    ### Ligne 1 : Nom du projet (horizontal cadré à gauche)
    
## Une section principale avec :
    ### header :
        #### Ligne 1 
            ##### Checkbox pour afficher / cacher les côtes, angles, grille, règles (horizontal cadré à gauche)
            ##### Menu pour activer ou désactiver le magnétisme (horizontal cadré à gauche à la suite) :
             - Cases à cocher : grille, sommets, intersections, murs, milieux
             - Curseur magnétique : distance de magnétisme (input number positif)
            ##### bouton pour exporter le plan en PDF (horizontal cadré à droite)
        #### Ligne 2 :
            ###### Menu multi-séléction pour afficher / cacher les niveaux (horizontal cadré à gauche)
            ###### Sélecteur de niveau pour choisir le niveau éditable (horizontal cadré à gauche à la suite)
    ### Section avec 3 colonnes :
        #### Panneau menu création ( gauche - dim 1/6 de la section principale )
            ##### Bouton "retour" (Retour au menu création - tout accordéon fermé)
            ##### Accordéon "Niveaux" - fermé par défaut
                ###### Bloc de création d'étage :
                    ####### Ligne 1 : Nom (input text)
                    ####### Ligne 2 : Niveau (input number positif ou négatif)
                    ####### Ligne 3 : Bouton -> "Créer" (button actif que si le champ est rempli)
                ###### Liste des niveaux existants avec possibilité de les cocher pour les afficher et bouton "X en fin de ligne pour les supprimer.
            ##### Accordéon "Pièces" - fermé par défaut
                ###### Bloc de création de pièce :
                    ####### Zone d'indication : "Cliquez sur le plan et déplacez vous pour dessiner une pièce."
                    ####### Ligne 1 : Nom (input text) - "nouvelle pièce" par défaut
                    ####### Ligne 2 : Niveau (select) - par défaut le niveau le plus haut sélectionné dans le menu de multi-séléction de niveau
                    ####### Ligne 3 : Type (select) (optionnel)
                    ####### Ligne 4 : Couleur du sol ( select ) (couleur par défaut : #E5FFFC , choix de couleurs pastels)
                    ####### Ligne 5 : Epaisseur (input number positif) valeur par défaut 10cm
                    ####### Ligne 6 : Hauteur (input number positif) valeur par défaut 250cm
                ###### Accordéon "Liste" - fermé par défaut
                    ####### Liste des pièces existantes avec possibilité de les séléctionner en cliquant dessus et un bouton supprimer "X" au bout de la ligne. La séléction d'une pièce dans la liste ouvre l'accordéon "Pièces" et affiche le bloc édition de pièce et met en surbrillance la pièce sélectionnée dans le canvas (plan)
            ##### Accordéon "Murs" - fermé par défaut
                ###### Bloc de création de mur :
                    ####### Zone d'indication : "Cliquez sur le plan et déplacez vous pour dessiner un mur."
                    ####### Ligne 1 : Epaisseur (input number positif)
                    ####### Ligne 2 : Matériau (select avec création possible d'un nouveau matériau) (optionnel)
                    ####### Ligne 3 : Isolation (select avec création possible d'une nouvelle isolation) (optionnel)
                ###### Accordéon "Liste" - fermé par défaut
                    ####### Liste des murs existants avec possibilité de les supprimer
                ###### Bloc édition de mur (visible uniquement si un mur est sélectionné dans le canvas (plan) )
                    ####### Mêmes champs que pour la création de mur, mais pré-remplis avec les valeurs du mur sélectionné
                    ####### Ligne 5 : Couper en deux ( bouton )
                    ####### Ligne 6 : Détacher ( bouton )
                    ####### Ligne 7 : Supprimer ( bouton )
            ##### Accordéon "Ouvertures" - fermé par défaut
                ###### Bloc de création d'ouverture :
                    ####### Zone d'indication : "Cliquez sur le plan et déplacez vous pour dessiner une ouverture."
                    ####### Ligne 1: Filtre (select : porte / fenêtre / baie vitrée / autre) - par défaut aucun filtre
                    ####### Liste des ouvertures en fonction du filtre (schéma de face de l'ouverture + nom de l'ouverture)
                ###### Bloc édition d'ouverture (visible uniquement si une ouverture dans la liste des existante est sélectionnée ou si elle l'est dans le canvas (plan))
                    ####### Mêmes champs que pour la création d'ouverture, mais pré-remplis avec les valeurs de l'ouverture sélectionnée
                    ####### Inverser le sens de l'ouverture ( bouton )
                    ####### Ouvrant gauche / droite ( switch ) (si applicable)
                    ####### Ligne 5 : Supprimer ( bouton )
                ###### Accordéon "Liste" - fermé par défaut
                    ####### Liste des ouvertures existantes avec possibilité de les séléctionner en cliquant dessus et un bouton supprimer "X" au bout de la ligne. La séléction d'une ouverture dans la liste ouvre l'accordéon "Ouvertures" et affiche le bloc édition d'ouverture et met en surbrillance l'ouverture sélectionnée dans le canvas (plan)
        #### canvas (plan) ( centre - dim 4/6 de la section principale ou dim 5/6 si le panneau détail est fermé )
            - Bouton "Détail" en haut à droite du canvas (plan) pour ouvrir le panneau détail
            - Zone de dessin avec grille et règles, affichage des côtes et angles selon le menu de multi-séléction pour afficher / cacher les côtes, angles, grille, règles.
            Affichage des pièces, murs et ouvertures selon le menu de multi-séléction de niveau. Le niveau éditable est celui séléctionné dans la ligne deux du headr . Les niveaux inférieurs sont affichés mais non éditables si séléctionné et plus ils sont bas et plus ils sont clairs en niveau de gris/rose. Les niveaux suppérieurs sont affichés mais non éditables si séléctionné et plus ils sont haut et plus ils sont foncés en niveau de gris/bleu.
            Possibilité de sélectionner un objet du niveau éditable (pièce, mur, ouverture) en cliquant dessus.
            L'objet sélectionné est mis en surbrillance et son accordéon correspondant est ouvert dans le panneau menu création. Le bloc édition de l'objet sélectionné est affiché et les champs sont pré-remplis avec les valeurs de l'objet sélectionné.
            L'objet séléctionné peut être déplacé avec la souris. Les modifications sont appliquées en temps réel sur le canvas (plan) et dans la base de données.
            - Bouton "+" "-" et "[o]" pour zoomer / dézoomer / réinitialiser le zoom du canvas (plan)
        #### Panneau détail ( droite - dim 1/6 de la section principale quand ouvert, sinon dim 0/6 )
            ##### Arbre de navigation
                - bouton "fermer" (ferme le panneau détail) en haut à droite du panneau détail
                - Niveau 1 : Nom, nb de pièces.
                    - Pièce 1 : Nom, surface
                        - Mur 1 : id, longueur, épaisseur, matériau, isolation, hauteur, type (int/ext)
                            - Ouverture 1 : type, longueur, hauteur, allège, interieur/extérieur
                        - Angle 1 : id, valeur



Règles métiers :
- les acccordéons de 1er niveau (Niveaux, Pièces, Murs, Ouvertures) sont mutuellement exclusifs : un seul accordéon peut être ouvert à la fois
- Au clic sur l'accordéon, selon celui ouvert le mode d'édition ouvert change sur le canvas (plan) : 
    - si accordéon "Niveaux" ouvert : pas de mode d'édition sur le canvas (plan)
    - si accordéon "Pièces" ouvert : mode édition pièce :
    Avec la souris, on place le premier point de la pièce (réctangulaire par défaut) puis on place le coin opposé pour créer la pièce. Entre les deux clics, on voit la longueur et la largeur de la pièce en temps réel.
    - si accordéon "Murs" ouvert : mode édition mur : 
    Avec la souris, on place le premier point du mur puis on place le point final pour créer le mur. Entre les deux clics, on voit la longueur du mur en temps réel. Si un point du mur est sur un mur existant, le mur créé sera "lié" au mur existant.
    - si accordéon "Ouvertures" ouvert : mode édition ouverture
    Avec la souris, on place l'ouverture puis on place le point final pour créer l'ouverture. Entre les deux clics, on voit la longueur de l'ouverture et ses distanceen temps réel. L'ouverture créée sera "liée" au mur existant.

- si on séléctionne un objet dans le canvas et que la liste des objets du même type est ouverte dans le panneau menu création, l'objet sélectionné est mis en surbrillance dans la liste et dans le panneau détail s'il est ouvert.
- si on séléctionne une objet dans la liste du panneau menu création ou dans le panneau de détail, l'objet sélectionné est mis en surbrillance dans le canvas (plan) et dans l'autre panneau.

-> la séléction d'un objet est sychronisée entre le canvas (plan), la liste du panneau menu création et le panneau détail.

- dans le canvas (plan) on peut séléctionner un objet en cliquant dessus.
    - Pour murs, ouvertures et pièces, ça ouvre l'accordéon du type séléctionné (Pièces, Murs, Ouvertures) et affiche le bloc édition. (le reste de l'accordéon est masqué)
        - Dans les blocs édition, les champs sont pré-remplis avec les valeurs de l'objet sélectionné. Les modifications sont appliquées en temps réel sur le canvas (plan) et dans la base de données.
        Il a des actions dans les blocs :
            - pour les murs : 
                - couper en deux : le mur est coupé en deux à l'endroit du clic de la souris. Le mur  de gauche devient celui qui à le focus et le mur de droite est créé avec les mêmes propriétés que le mur d'origine.
                - détacher : Les points d'encrage sont mis en surbrillance avec un petit "-" et on demande à l'utilisateur de cliquer sur le point souhaité pour le déplacer. Le mur est détaché du mur auquel il était lié et le point d'encrage est déplacé à l'endroit du clic de la souris.
                - supprimer : le mur est supprimé du canvas (plan)
            - pour les ouvertures :
                - supprimer : l'ouverture est supprimée du canvas (plan)
            - pour les pièces :
                - supprimer : la pièce est supprimée du canvas (plan)
            - pour les ouvertures :
                - inverser le sens de l'ouverture : l'ouverture est inversée dans le mur auquel elle est liée (ouvrant change de pièce)
                - ouvrant gauche / droit : l'ouverture est inversée dans le mur auquel elle est liée
                - supprimer : l'ouverture est supprimée du canvas (plan)

- Un mur peut être lié à deux pièces différentes. Dans ce cas, le mur est considéré comme un mur "intérieur" pour les deux pièces. Si le mur est lié à une seule pièce, il est considéré comme un mur "extérieur" pour cette pièce.

- un objet supprimé dans le canvas n'est pas supprimé de la base de données, il est juste marqué comme "supprimé" et n'est plus affiché dans le canvas.

- les mesures sont affichée en cm dans le canvas (plan) et dans les panneaux.

- Le niveau 0 est créé automatiquement à la création d'un projet. Il est obligatoire et ne peut pas être supprimé. Il est affiché par défaut dans le canvas (plan) et dans les panneaux.

- on peut réduire le panneau "création" en cliquant sur un bouton "-" en haut à droite du panneau. Le panneau "création" est réduit à un bouton "+" carré qui ouvre le panneau quand on clique dessus.

- Le panneau "détail" est fermé par défaut. On peut l'ouvrir en cliquant sur un bouton "!" carré  en haut à droite du canvas (plan). Il se ferme en cliquant sur le bouton "-" carré en haut à droite du panneau.

