# Data Model Guidelines (app-maison)

**Scope** : Règles pour le modèle de données, les types, les entités et les calculs géométriques.
**Priorité** : Complète les règles définies dans `docs/data-model.md` et `.github/copilot-instructions.md`.

**Fichiers de référence** :
- `shared/src/types.ts` (définitions des types TypeScript)
- `shared/src/geometry.ts` (calculs géométriques)
- `docs/data-model.md` (documentation du modèle de données)
- `docs/geometry.md` (règles géométriques)

---

## 📐 Modèle de Données

### Entités Principales
| **Entité**       | **Fichier TypeScript**       | **Table Supabase** | **Description**                                  |
|------------------|-----------------------------|--------------------|------------------------------------------------|
| `Project`        | `shared/src/types.ts`       | `projects`         | Projet (ex: "Maison principale").              |
| `Level`          | `shared/src/types.ts`       | `levels`          | Niveau d'un projet (ex: "Rez-de-chaussée").    |
| `Room`           | `shared/src/types.ts`       | `rooms`           | Pièce (ex: "Salon").                           |
| `Vertex`         | `shared/src/types.ts`       | JSON dans `rooms` | Point `(x, y)` en centimètres.                |
| `Wall`           | `shared/src/types.ts`       | JSON dans `rooms` | Segment entre deux `Vertex` consécutifs.       |
| `Opening`        | `shared/src/types.ts`       | JSON dans `rooms` | Ouverture (porte/fenêtre) sur un mur.          |

### Règles de Persistance
- **Source de vérité** : Supabase/PostgreSQL.
- **Unités** :
  - **Toujours** utiliser les **centimètres** pour les coordonnées (`x`, `y`) et les dimensions.
  - **Ne jamais** stocker de valeurs dérivées (ex: surface, angles) en base. Elles doivent être **calculées** à la volée.
- **Relations** :
  - Un `Project` contient plusieurs `Level`.
  - Un `Level` contient plusieurs `Room`.
  - Une `Room` est définie par :
    - Une liste **ordonnée** de `Vertex` (sens horaire ou anti-horaire).
    - Une liste de `Wall` (chaque `Wall` relie deux `Vertex` consécutifs).
    - Une liste de `Opening` (chaque `Opening` est associée à un `Wall`).

---

## 🔢 Types TypeScript

### Définitions Centralisées
- **Tous les types partager entre `web/` et `mobile/`** doivent être définis dans `shared/src/types.ts`.
- **Ne pas** dupliquer les types dans `web/` ou `mobile/`.

### Exemple de Type
```typescript
// shared/src/types.ts
export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface Level {
  id: string;
  projectId: string;
  name: string;
}

export interface Vertex {
  x: number; // en centimètres
  y: number; // en centimètres
}

export interface Wall {
  startVertexIndex: number; // Index dans la liste des vertices
  endVertexIndex: number;
  thickness?: number; // Épaisseur en cm (optionnel)
}

export interface Opening {
  wallIndex: number; // Index du mur dans la liste des walls
  startRatio: number; // Position relative (0 à 1) sur le mur
  width: number; // Largeur en cm
  type: 'door' | 'window' | 'other';
}

export interface Room {
  id: string;
  levelId: string;
  name: string;
  vertices: Vertex[];
  walls: Wall[];
  openings: Opening[];
  notes?: string;
}
```

---

## 📏 Calculs Géométriques

### Règles Générales
- **Toutes les fonctions de calcul** doivent être dans `shared/src/geometry.ts`.
- **Ne jamais** recalculer une valeur déjà disponible dans la structure (ex: surface, longueur des murs).
- **Unités** :
  - Entrées : **toujours en centimètres**.
  - Sorties : **toujours en centimètres**, sauf pour l'affichage (ex: `m²` pour les surfaces).

### Fonctions Clés
| **Fonction**               | **Description**                                  | **Fichier**               | **Exemple**                                  |
|----------------------------|------------------------------------------------|---------------------------|---------------------------------------------|
| `getRoomAreaM2`           | Calcule la surface en m² d'une pièce.         | `web/src/lib/roomMetrics.ts` | `getRoomAreaM2(vertices)` → `20.5 m²`       |
| `countExteriorWalls`       | Compte les murs extérieurs d'une pièce.        | `web/src/lib/roomMetrics.ts` | `countExteriorWalls(snapshots)` → `3`       |
| `getWallLength`           | Calcule la longueur d'un mur en cm.            | `shared/src/geometry.ts`   | `getWallLength(vertex1, vertex2)` → `400`  |
| `getRoomPerimeter`        | Calcule le périmètre d'une pièce en cm.        | `shared/src/geometry.ts`   | `getRoomPerimeter(vertices)` → `1200`       |

### Exemple de Fonction
```typescript
// shared/src/geometry.ts
/**
 * Calcule la longueur d'un mur en cm.
 * @param start - Vertex de départ.
 * @param end - Vertex de fin.
 * @returns Longueur en cm.
 */
export function getWallLength(start: Vertex, end: Vertex): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.sqrt(dx * dx + dy * dy); // Théorème de Pythagore
}
```

---

## 🔄 Relations entre Entités

### Projet → Niveau → Pièce
- **Cascading Deletes** :
  - Supprimer un `Project` **doit** supprimer ses `Level`.
  - Supprimer un `Level` **doit** supprimer ses `Room`.
- **Vérifications** :
  - Une `Room` ne peut pas exister sans `Level` parent.
  - Un `Level` ne peut pas exister sans `Project` parent.

### Exemple de Requête Supabase
```typescript
// web/src/services/projects.ts
import { supabase } from './supabase';

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('createdAt', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }

  return data;
}
```

---

## 🚫 Anti-Patterns (à Éviter Absolument)
- ❌ **Dupliquer les types** : Ne pas redéfinir `Project` ou `Room` dans `web/` ou `mobile/`.
- ❌ **Stocker des valeurs dérivées** : Ne pas sauvegarder `areaM2` ou `perimeter` en base. **Toujours** les calculer.
- ❌ **Ignorer les unités** : Toujours travailler en **centimètres** dans le code métier.
- ❌ **Mélanger les coordonnées** : Ne pas utiliser de système de coordonnées différent sans conversion.
- ❌ **Modifier les types partagés** sans mise à jour de la doc : Si tu modifies `shared/src/types.ts`, mets à jour `docs/data-model.md`.

---

## ✅ Checklist pour le Modèle de Données
Avant de valider un changement :
- [ ] Les types sont définis dans `shared/src/types.ts`.
- [ ] Les calculs sont dans `shared/src/geometry.ts`.
- [ ] Les requêtes Supabase respectent les relations (Projet → Niveau → Pièce).
- [ ] Aucune valeur dérivée n'est stockée en base.
- [ ] Les unités sont cohérentes (cm pour le métier, m² pour l'affichage).
- [ ] La documentation (`docs/data-model.md`, `docs/geometry.md`) est mise à jour.

---

## 🔗 Références Rapides
| **Besoin**               | **Où regarder**                          |
|--------------------------|-----------------------------------------|
| Types TypeScript         | `shared/src/types.ts`                    |
| Fonctions géométriques  | `shared/src/geometry.ts`                 |
| Requêtes Supabase        | `web/src/services/`                      |
| Documentation            | `docs/data-model.md` et `docs/geometry.md`|
