
# SPEC — Plan d’action + Prompts Copilot

## 🎯 Objectif
Construire progressivement BatiBrain, une application de gestion de travaux avec un moteur géométrique robuste.

---

# PHASE 1 — Géométrie (priorité max)

## 1.1 Suppression de sommet
### Tâche
Permettre de supprimer un sommet tout en gardant un polygone valide. Suivre la maquette correspondante pour la vue concernée.

### Prompt Copilot
```ts
// Permettre de supprimer un sommet sélectionné
// Empêcher qu'une pièce ait moins de 3 sommets
```

---

## 1.2 Insertion de sommet
### Tâche
Ajouter un sommet entre deux existants. Suivre la maquette correspondante pour la vue concernée.

### Prompt Copilot
```ts
// Implémente une fonction pour insérer un vertex entre deux autres
// Met à jour correctement l'ordre du polygone
```

---

## 1.3 Drag amélioré
### Tâche
Améliorer le drag des points. Suivre la maquette correspondante pour la vue concernée.

### Prompt Copilot
```ts
// Améliorer le drag & drop des sommets avec limitation de vitesse
// éviter les glitches lors du déplacement rapide
```

---

## 1.4 Snapping basique
### Tâche
Snapping horizontal / vertical. Suivre la maquette correspondante pour la vue concernée.

### Prompt Copilot
```ts
// Ajouter un snapping pour alignement horizontal et vertical
// si un point est proche d’un axe
```

---

## 1.5 Edition longueur mur
### Tâche
Modifier la longueur d’un mur en éditant la zone de saisie. Suivre la maquette correspondante pour la vue concernée.

### Prompt Copilot
```ts
//Implémenter une fonction pour modifier la longueur d’un mur
// en modifiant la valeur dans un input
```

---

# PHASE 2 — Persistance Supabase

## 2.1 CRUD pièce
### Prompt
```ts
// Créer un service pour créer, lire, mettre à jour une pièce dans Supabase
// Initialiser une nouvelle pièce avec un carré 200x200 cm
// et des murs 10 cm / 250 cm par défaut
```

---

## 2.2 Sauvegarde vertices
### Prompt
```ts
// Sauvegarder tous les vertices d’une pièce dans la table piece_vertices
```

---

## 2.3 Chargement
### Prompt
```ts
// Charger une pièce avec ses vertices et reconstruire le polygone
```

---

# PHASE 3 — Murs & ouvertures

## 3.1 Propriétés mur
### Prompt
```ts
// Ajouter des propriétés (épaisseur, hauteur, matériau) sur un mur
```

---

## 3.2 Ouvertures
### Prompt
```ts
// Implémenter l’ajout d’une ouverture sur un mur avec position et dimensions
```

---

## 3.3 Validation
### Prompt
```ts
// Vérifier qu’une ouverture ne dépasse pas les limites du mur
// Que deux ouvertures ne se chevauchent pas
```

---

# PHASE 4 — Multi pièces

## 4.1 Vue étage
### Prompt
```ts
// Afficher plusieurs pièces dans un même canvas avec coordonnées globales
```

---

## 4.2 Navigation
### 4.2.1 Tableau de bord — Liste des pièces
#### Tâche
Créer la vue web d’entrée qui liste les pièces du niveau actif sans mélanger création et sélection. Suivre la maquette web correspondante.

#### Prompt Copilot
```ts
/**
 * CONTEXTE PRODUIT :
 * BatiBrain, app de gestion de rénovation maison avec navigation par pièces. (plus de mode démo/prototype)
 * Dashboard = point d'entrée principal.
 *
 * OBJECTIF :
 * Implémenter une page Dashboard complète avec :
 * - header projet
 * - liste de pièces
 *
 * DONNÉES :
 * type Piece = {
 *   id: string
 *   name: string
 *   surface: number
 * }
 *
 * UI :
 * - Header :
 *   - Titre "Tableau de bord"
 *   - choix du projet actif
 *   - Bouton d'ajout de niveau

 * - Contenu principal :
 *   - Choix du niveau actif
 *   - Bouton de vue d'ensemble du niveau
 *   - Bouton d'ajout de pièce
 *   - grille de cartes
 *   - chaque carte = pièce
 *   - hover effect
 * 
 * - Footer : 
 *   - nombre de pièces
 *   - surface totale
 *   - nombre de murs extérieurs
 *   - nombre d'ouvertures
 *   - Bouton de vue d'ensemble du projet
 *
 *
 * DESIGN SYSTEM :
 * - spacing cohérent
 * - font moderne
 * - couleurs neutres + bleu accent
 * - ombres légères
 * - transitions fluides
 * - Cf maquettes dans /Users/56593p/workspaces/perso/app-maison/docs/maquettes/web/web-tableau de bord.png
 *
 * COMPORTEMENT :
 * - clic sur bouton vue d'ensemble du projet → vue projet
 * - clic sur bouton vue d'ensemble du niveau → vue étage
 * - clic ajout pièce → vue pièce avec pièce vide
 * - clic carte → vue pièce
 * - affichage surface formatée (m²)
 *
 * BONUS :
 * - état vide (aucune pièce)
 * - skeleton loading
 */
```

### 4.2.2 Vue globale — Étage
#### Tâche
Créer la vue web de plan global correspondant à la maquette d’étage, avec navigation niveau/projet et résumé latéral. Suivre la maquette web correspondante.

#### Prompt Copilot
```ts
// Créer une vue étage avec sélection du projet et du niveau actif
// afficher toutes les pièces du niveau sur un même canvas avec grille, murs et mesures activables
// permettre zoom, déplacement, export du plan et sélection d'une pièce depuis le plan
// afficher un résumé latéral du niveau avec surface totale, nombre de pièces, hauteurs et ouvertures
```

### 4.2.3 Éditeur de pièce — Vue du dessus
#### Tâche
Créer la vue web d’édition d’une pièce en conservant la liste des pièces du niveau, les outils de dessin et le panneau de propriétés. Suivre la maquette web correspondante.

#### Prompt Copilot
```ts
// Créer une vue pièce avec breadcrumb projet > niveau > pièce et liste des pièces du niveau
// afficher les outils dessiner, sélectionner, déplacer, mesurer et annoter sur le canvas
// afficher les métriques de la pièce, la liste de ses murs et les propriétés du mur sélectionné
// ajouter une navigation explicite vers la vue de face du mur sélectionné
```

### 4.2.4 Vue de face d’un mur
#### Tâche
Créer la vue web d’élévation d’un mur avec aperçu, propriétés, ouvertures et retour au plan. Suivre la maquette web correspondante.

#### Prompt Copilot
```ts
// Créer une vue d'élévation de mur avec onglets propriétés, ouvertures, revêtements et annotations
// afficher la géométrie du mur avec ses hauteurs gauche/droite, sa longueur et ses ouvertures positionnées
// permettre l'ajout et l'édition d'ouvertures depuis la vue et depuis un tableau récapitulatif
// garder un retour simple vers la vue plan de la pièce sans perdre le mur sélectionné
```

---

# PHASE 5 — Travaux

## 5.1 Tâches
### Prompt
```ts
// Implémenter CRUD des tâches liées à une pièce
```

---

## 5.2 Documents
### Prompt
```ts
// Implémenter upload de documents dans Supabase Storage
```

---

# PHASE 6 — LLM

## 6.1 Actions
### Prompt
```ts
// Transformer une commande texte en action JSON structurée
```

---

# PHASE 7 — Mobile

## 7.1 Tableau de bord mobile
### Tâche
Créer l’entrée mobile Expo qui reprend la maquette de liste des pièces avec navigation principale et sélection du projet actif. Suivre la maquette mobile correspondante.

### Prompt Copilot
```ts
// Créer une app Expo avec navigation par onglets en bas et shell mobile cohérent avec les maquettes
// afficher le projet actif puis une liste de pièces avec surface, revêtement, nombre de murs et d'ouvertures
// proposer un changement de mode d'affichage liste/grille et une action d'ajout de pièce adaptée au mobile
// charger les données depuis Supabase sans dupliquer la logique métier partagée
```

## 7.2 Vue étage mobile
### Tâche
Créer la vue mobile de plan global d’un niveau avec sélection, mesures et résumé compact. Suivre la maquette mobile correspondante.

### Prompt Copilot
```ts
// Créer une vue mobile de plan global avec canvas tactile, mesures visibles et sélection d'une pièce
// ajouter les contrôles d'affichage, de focus plein écran et un résumé repliable du niveau
// permettre la navigation retour vers la liste des pièces et l'ouverture d'une pièce depuis le plan
```

## 7.3 Vue pièce mobile
### Tâche
Créer la vue mobile d’une pièce avec édition tactile du plan, métriques et liste des murs. Suivre la maquette mobile correspondante.

### Prompt Copilot
```ts
// Créer une vue mobile de pièce avec bascule plan / élévation et outils adaptés au tactile
// afficher la surface, le périmètre et la liste des murs sous le canvas
// permettre la sélection d'un mur, l'édition des sommets et l'accès aux propriétés sans surcharge visuelle
// préparer une action flottante pour ajouter un élément contextuel sans casser le plan
```

## 7.4 Vue mur mobile
### Tâche
Créer la vue mobile de face d’un mur avec navigation entre murs, propriétés et ouvertures. Suivre la maquette mobile correspondante.

### Prompt Copilot
```ts
// Créer une vue mobile d'élévation de mur avec navigation mur précédent / suivant
// afficher longueur, hauteurs gauche/droite, matériau, isolation et la liste des ouvertures
// permettre l'ajout d'ouverture depuis un CTA mobile et un retour rapide vers le plan de la pièce
// rester cohérent avec le périmètre MVP: pas de moteur 3D complet, seulement les vues 2D prévues
```

---

# ✅ Priorité absolue
1. Géométrie
2. Sauvegarde
3. Murs
4. Multi pièces
5. Travaux
6. LLM
7. Mobile

---

👉 Règle : ne jamais passer à la suite sans stabiliser l’étape actuelle.
