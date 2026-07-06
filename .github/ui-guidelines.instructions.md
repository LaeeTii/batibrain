# UI Guidelines (app-maison)

**Scope** : Règles pour les vues, composants et styles dans le dossier `web/`.
**Priorité** : Complète les règles générales définies dans `.github/copilot-instructions.md`.

**Fichiers de référence** :
- `web/src/index.css` (variables CSS globales)
- `web/src/components/DashboardLayout.tsx` (layout de base pour toutes les pages)
- `web/src/components/RoomPreview.tsx` (exemple de composant réutilisable)
- `web/src/views/RoomsDashboard.tsx` (exemple complet de vue avec gestion d'état)
- `web/src/views/LevelOverviewSummary.tsx` (exemple de vue de résumé avec métriques)

---

---

## 🎨 Système de Couleurs et Styles

### Variables CSS Obligatoires
Les couleurs **doivent** toujours être définies via les variables CSS dans `web/src/index.css`.
Ne **jamais** utiliser de valeurs hardcodées (ex: `#4CAF50`).

| **Usage**               | **Variable CSS**               | **Classe associée**          | **Exemple d'utilisation**                     |
|-------------------------|--------------------------------|-----------------------------|-----------------------------------------------|
| Bouton "Créer/Ajouter"  | `--create-button-color`       | `dashboard-createButton`    | `<button className="dashboard-createButton">Ajouter une pièce</button>` |
| Bouton "Vue/Voir"       | `--view-button-color`         | `dashboard-viewButton`      | `<button className="dashboard-viewButton">Vue d'ensemble</button>` |
| Bouton "Export"         | `--export-button-color`       | `dashboard-exportButton`    | `<button className="dashboard-exportButton">Exporter</button>` |
| Bouton secondaire       | N/A                            | `dashboard-outlineButton`   | `<button className="dashboard-outlineButton">Annuler</button>` |
| Fond principal         | `--background-primary`        | -                           | `background-color: var(--background-primary)` |
| Texte principal        | `--text-primary`              | -                           | `color: var(--text-primary)` |
| Fond secondaire        | `--background-secondary`     | -                           | `background-color: var(--background-secondary)` |
| Texte secondaire       | `--text-secondary`            | -                           | `color: var(--text-secondary)` |
| Accent (couleur vive)   | `--accent-color`              | -                           | `border-left: 4px solid var(--accent-color)` |

### Couleurs des cartes (Room Cards)
Pour les cartes de pièces (ex: dans `RoomsDashboard.tsx`), utiliser les **couleurs d'accentuation** définies dans le tableau :
```typescript
const CARD_ACCENT_COLORS = ['#d47a52', '#8fa35d', '#5b88c7', '#d4a94b', '#8c7bc8', '#c27b98'];
```
- **Ne pas** ajouter de nouvelles couleurs à ce tableau sans validation.
- **Appliquer** ces couleurs via la prop `accentColor` du composant `RoomPreview`.

---

## 🏗️ Structure des Vues

### Règles Générales
1. **Toute nouvelle vue dans `web/src/views/` doit** :
   - Être enveloppée dans `<DashboardLayout>`.
   - Utiliser les composants existants (ex: `RoomPreview`, `Sidebar`) **avant** de créer de nouveaux composants.
   - Respecter les **états de chargement** (skeleton, messages d'erreur, états vides) comme dans `RoomsDashboard.tsx`.

2. **Template de base** :
   ```tsx
   export function MaNouvelleVue() {
     return (
       <DashboardLayout>
         <header className="dashboard-topbar">
           <h2 className="dashboard-pageTitle">Titre de la page</h2>
         </header>
         <section className="dashboard-contentPanel">
           {/* Contenu principal */}
         </section>
       </DashboardLayout>
     );
   }
   ```

### Composants à Réutiliser
| **Besoin**               | **Composant**                     | **Fichier**                          | **Exemple d'utilisation**                     |
|--------------------------|------------------------------------|--------------------------------------|-----------------------------------------------|
| Layout de page           | `DashboardLayout`                 | `web/src/components/DashboardLayout.tsx` | `<DashboardLayout>{children}</DashboardLayout>` |
| Aperçu de pièce          | `RoomPreview`                      | `web/src/components/RoomPreview.tsx` | `<RoomPreview vertices={...} walls={...} accentColor="...">` |
| Sélecteur de projet      | `select` avec classe `dashboard-field--project` | Voir `RoomsDashboard.tsx` | Utiliser la même structure que dans le dashboard. |
| Badge de métrique         | `room-card__badge`                | -                                    | `<span className="room-card__badge">5 ouvertures</span>` |
| Statistique de résumé    | `summary-stat`                    | Voir `LevelOverviewSummary.tsx`     | `<article className="summary-stat">...</article>` |

---
### Gestion des États
Pour les vues avec chargement de données (ex: depuis Supabase) :
1. **État de chargement** :
   - Utiliser `isBusy` (booléen) pour désactiver les boutons et afficher des skeletons.
   - Exemple de skeleton :
     ```tsx
     <div className="dashboard-roomGrid">
       {Array.from({ length: 6 }).map((_, index) => (
         <article key={`skeleton-${index}`} className="room-card room-card--skeleton">
           <div className="dashboard-skeletonPreview" />
           <div className="room-card__body">
             <div className="dashboard-skeletonBar dashboard-skeletonBar--title" />
             <div className="dashboard-skeletonBar" />
           </div>
         </article>
       ))}
     </div>
     ```

2. **État vide** :
   - Utiliser `dashboard-emptyState` pour les messages comme "Aucune pièce trouvée".
   - Exemple :
     ```tsx
     <div className="dashboard-emptyState">
       <h3>Aucun niveau actif</h3>
       <p>Ajoute un niveau au projet actif pour commencer.</p>
       <button className="dashboard-createButton">Ajouter un niveau</button>
     </div>
     ```

3. **Erreurs** :
   - Utiliser `dashboard-banner dashboard-banner--error` pour afficher les erreurs.
   - Exemple :
     ```tsx
     {errorMessage && (
       <div className="dashboard-banner dashboard-banner--error">{errorMessage}</div>
     )}
     ```

---
## 📏 Typographie et Espacements

### Classes Typographiques
| **Élément**               | **Classe CSS**               | **Usage**                          | **Exemple**                                  |
|---------------------------|------------------------------|------------------------------------|---------------------------------------------|
| Titre de page             | `dashboard-pageTitle`        | Titre principal de la vue         | `<h2 className="dashboard-pageTitle">Tableau de bord</h2>` |
| Titre de panel            | `dashboard-panelTitle`       | Titre d'une section ou modale     | `<h3 className="dashboard-panelTitle">Nouveau projet</h3>` |
| Sous-titre                | `dashboard-subtitle`         | Texte descriptif sous un titre    | `<p className="dashboard-subtitle">Projet cible : {name}</p>` |
| Label de champ            | `dashboard-field`            | Libellé de formulaire             | `<label className="dashboard-field"><span>Nom</span><input /></label>` |
| Texte d'info (eyebrow)    | `dashboard-eyebrow`         | Texte court en haut d'une section | `<p className="dashboard-eyebrow">Création</p>` |
| Titre de carte            | `room-card__title`           | Titre d'une pièce ou élément      | `<h4 className="room-card__title">{room.name}</h4>` |
| Métadonnée (label)        | `room-card__metaLabel`       | Libellé pour une métadonnée      | `<p className="room-card__metaLabel">Revêtement</p>` |
| Métadonnée (valeur)       | `room-card__finish`          | Valeur d'une métadonnée          | `<p className="room-card__finish">Carrelage</p>` |

### Espacements
- **Margins/Padding** : Toujours utiliser les valeurs définies dans `web/src/index.css` :
  - `--spacing-xs`: `0.25rem`
  - `--spacing-sm`: `0.5rem`
  - `--spacing-md`: `1rem`
  - `--spacing-lg`: `1.5rem`
  - `--spacing-xl`: `2rem`
- **Exemple** :
  ```css
  .ma-classe {
    margin: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-lg);
  }
  ```

---
## 🔄 Modales et Dialogues
Toutes les modales doivent suivre le **même pattern** que dans `RoomsDashboard.tsx` :
1. **Structure de base** :
   ```tsx
   {isModalOpen && (
     <div className="dashboard-modalBackdrop" role="presentation" onClick={() => setIsModalOpen(false)}>
       <section className="dashboard-modalCard" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
         <p className="dashboard-eyebrow">Création</p>
         <h3 className="dashboard-panelTitle">Titre de la modale</h3>
         {/* Contenu */}
         <div className="dashboard-modalActions">
           <button className="dashboard-outlineButton">Annuler</button>
           <button className="dashboard-createButton">Créer</button>
         </div>
       </section>
     </div>
   )}
   ```

2. **Actions dans les modales** :
   - Toujours inclure un bouton **Annuler** (classe `dashboard-outlineButton`).
   - Bouton principal : utiliser la classe adaptée (`dashboard-createButton` pour une création, etc.).

---
## 📊 Métriques et Résumés
Pour les vues de type "résumé" (ex: `LevelOverviewSummary.tsx`) :
1. **Structure des stats** :
   ```tsx
   <article className="summary-stat">
     <span className="summary-stat__label">Pièces</span>
     <strong>{formatCount(roomCount)}</strong>
   </article>
   ```
2. **Formatage des nombres** :
   - Utiliser les formateurs définis dans `RoomsDashboard.tsx` :
     ```typescript
     const AREA_FORMATTER = new Intl.NumberFormat('fr-FR', {
       minimumFractionDigits: 0,
       maximumFractionDigits: 2,
     });
     const COUNT_FORMATTER = new Intl.NumberFormat('fr-FR');
     ```
   - **Fonctions utilitaires** :
     ```typescript
     function formatArea(areaM2: number): string {
       return `${AREA_FORMATTER.format(areaM2)} m²`;
     }
     function formatCount(value: number): string {
       return COUNT_FORMATTER.format(value);
     }
     ```

---
## 🚫 Anti-Patterns (à Éviter Absolument)
- ❌ **Couleurs hardcodées** : Pas de `#ff0000`, `rgb(255, 0, 0)`, etc. **Toujours** utiliser les variables CSS.
- ❌ **Styles inline** : Éviter `<div style={{ margin: '10px' }}>`. Utiliser les classes CSS.
- ❌ **Noms de classes non préfixés** : Pas de `.button` ou `.card`. Toujours utiliser `dashboard-` ou `room-`.
- ❌ **Nouveaux composants sans réutilisation** : Avant de créer un nouveau composant, vérifier s’il existe déjà dans `web/src/components/`.
- ❌ **Logique métier dans les vues** : La logique métier (ex: calculs géométriques) doit être dans `shared/` ou `web/src/lib/`.
- ❌ **État local non typé** : Toujours typer les states (ex: `useState<Project[]>([])`).

---
## ✅ Checklist pour une Nouvelle Vue
Avant de valider une nouvelle vue, vérifier :
- [ ] La vue est enveloppée dans `<DashboardLayout>`.
- [ ] Les couleurs utilisent les **variables CSS** (`--create-button-color`, etc.).
- [ ] Les boutons utilisent les **classes dédiées** (`dashboard-createButton`, etc.).
- [ ] Les typographies utilisent les **classes existantes** (`dashboard-pageTitle`, etc.).
- [ ] Les espacements utilisent les **variables** (`--spacing-md`, etc.).
- [ ] Les composants existants (`RoomPreview`, modales, etc.) sont **réutilisés**. 
- [ ] Les états (chargement, erreur, vide) sont **gérés** comme dans `RoomsDashboard.tsx`.
- [ ] Le code ne contient **pas** de styles inline ou de couleurs hardcodées.
- [ ] Le fichier est **typé** (TypeScript) et sans erreurs de compilation.

---
## 🔗 Références Rapides
| **Besoin**               | **Où regarder**                          |
|--------------------------|-----------------------------------------|
| Exemple de vue complète  | `web/src/views/RoomsDashboard.tsx`      |
| Exemple de vue de résumé | `web/src/views/LevelOverviewSummary.tsx`|
| Variables CSS            | `web/src/index.css`                     |
| Composants réutilisables| `web/src/components/`                   |
| Layout de base           | `web/src/components/DashboardLayout.tsx`|
