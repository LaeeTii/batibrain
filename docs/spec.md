
# SPEC — Plan d’action + Prompts Copilot

## 🎯 Objectif
Construire progressivement une application de gestion de travaux avec un moteur géométrique robuste.

---

# PHASE 1 — Géométrie (priorité max)

## 1.1 Suppression de sommet
### Tâche
Permettre de supprimer un sommet tout en gardant un polygone valide.

### Prompt Copilot
```ts
// Permettre de supprimer un sommet sélectionné
// Empêcher qu'une pièce ait moins de 3 sommets
```

---

## 1.2 Insertion de sommet
### Tâche
Ajouter un sommet entre deux existants.

### Prompt Copilot
```ts
// Implémente une fonction pour insérer un vertex entre deux autres
// Met à jour correctement l'ordre du polygone
```

---

## 1.3 Drag amélioré
### Tâche
Améliorer le drag des points.

### Prompt Copilot
```ts
// Améliorer le drag & drop des sommets avec limitation de vitesse
// éviter les glitches lors du déplacement rapide
```

---

## 1.4 Snapping basique
### Tâche
Snapping horizontal / vertical.

### Prompt Copilot
```ts
// Ajouter un snapping pour alignement horizontal et vertical
// si un point est proche d’un axe
```

---

## 1.5 Edition longueur mur
### Tâche
Modifier la longueur d’un mur en éditant la zone de saisie

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
### Prompt
```ts
// Garder la création de projet séparée de la sélection du projet actif
// Créer un formulaire de niveau séparé de la sélection du niveau actif
// Créer une liste déroulante de pièces dont la sélection change la vue du canvas
// et garder la création de pièce dans un formulaire séparé
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

## 7.1 Lecture
### Prompt
```ts
// Créer une app Expo qui affiche les pièces depuis Supabase
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
