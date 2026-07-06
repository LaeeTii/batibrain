# Git Workflow Guidelines (app-maison)

**Scope** : Règles pour les commits, branches et workflow Git dans le projet.
**Priorité** : Complète les règles définies dans `.github/copilot-instructions.md`.

---

## 📝 Conventional Commit

### Types de Commits
| **Type**         | **Description**                          | **Requiert un ticket** | **Exemple**                                  |
|------------------|------------------------------------------|------------------------|---------------------------------------------|
| `feat`           | Nouvelle fonctionnalité                 | ✅ Oui                 | `feat(rooms): ajouter le calcul de la surface #PROJ-123` |
| `fix`            | Correction de bug                        | ✅ Oui                 | `fix(api): gérer les valeurs nulles dans listRooms #PROJ-124.1` |
| `style`          | Changements de style (indentation, etc.) | ✅ Oui                 | `style(component): uniformiser les styles des boutons #UI-456` |
| `perf`           | Amélioration de performance               | ✅ Oui                 | `perf(query): optimiser la requête des niveaux #DB-789` |
| `refactor`       | Refactorisation (pas de changement fonctionnel) | ❌ Non          | `refactor(geometry): extraire les fonctions de calcul` |
| `tech`           | Changements techniques                  | ❌ Non                 | `tech: mettre à jour Node.js à la version 20` |
| `ci`             | Configuration CI/CD                     | ❌ Non                 | `ci: ajouter un job de lint dans le workflow` |
| `docs`           | Documentation                           | ❌ Non                 | `docs: esclave le README avec les nouvelles instructions` |
| `chore`          | Tâches diverses (nettoyage, etc.)      | ❌ Non                 | `chore: supprimer les fichiers temporaires` |
| `build`          | Changements liés au build                | ❌ Non                 | `build: mettre à jour Vite` |
| `test`           | Ajout/modification de tests              | ❌ Non                 | `test: ajouter des tests pour getWallLength` |
| `revert`         | Annulation d'un commit                   | ❌ Non                 | `revert: annuler le commit abc1234` |

---

### Format des Messages de Commit
```
<type>(<scope>): <description en français> <ticket>
```
- **type** : Un des types listés ci-dessus.
- **scope** (optionnel) : Contexte du changement (ex: `rooms`, `api`, `ui`).
- **description** : Résumé clair **en français** (4 à 100 caractères).
- **ticket** : **Obligatoire** pour `feat`, `fix`, `style`, `perf`. Format : `#TICKET-NUMBER` ou `#TICKET-NUMBER.SUBNUMBER` (ex: `#PROJ-123` ou `#PROJ-123.1`).

---

### Exemples Valides
| **Type**       | **Message**                                      | **Ticket**       |
|----------------|-------------------------------------------------|------------------|
| `feat`         | `feat(rooms): ajouter le support des ouvertures` | `#PROJ-100`     |
| `fix`          | `fix(api): corriger le tri des projets`          | `#API-200.1`     |
| `style`        | `style(ui): uniformiser les boutons secondaires`| `#UI-300`       |
| `perf`         | `perf(query): optimiser listRoomsByLevel`       | `#DB-400`        |
| `refactor`     | `refactor(geometry): extraire les fonctions de calcul` | -          |
| `docs`         | `docs: mettre à jour le README`                  | -                |
| `chore`        | `chore: nettoyer les logs`                      | -                |

---

### Exemples Invalides
| **Message**                                      | **Problème**                              |
|--------------------------------------------------|------------------------------------------|
| `fix: bug`                                       | Description trop vague, pas de ticket.    |
| `feat: Add new feature for rooms`                 | Description **non en français**.         |
| `feat(rooms): ajouter une pièce`                 | **Manque le ticket** (`feat` nécessite un ticket). |
| `Added a new button`                             | Format incorrect, pas de type.            |
| `feat: cette fonctionnalité est super importante`| Description > 100 caractères.              |

---

## 🌿 Branches

### Nommage des Branches
- **Format** : `<type>/<description-kebab-case>-<ticket>`
  - `type` : `feat`, `fix`, `refactor`, `docs`, etc.
  - `description` : Brève description en **français**, en kebab-case (minuscules et tirets).
  - `ticket` : Numéro du ticket (ex: `PROJ-123`).

- **Exemples** :
  - `feat/ajouter-suppression-pièces-PROJ-123`
  - `fix/corriger-affichage-niveaux-PROJ-124`
  - `refactor/extraire-logique-ui`
  - `docs/mettre-à-jour-le-readme`

---

### Workflow des Branches
1. **Créer une branche** depuis `main` (ou une branche de release si applicable).
2. **Faire des commits** en suivant les règles de Conventional Commit.
3. **Ouvrir une PR** vers `main` (ou la branche cible) lorsque la fonctionnalité est prête.
4. **Fusionner** via une **Merge Commit** (pas de Squash ou Rebase) pour conserver l'historique.

---

## 🔄 Pull Requests (PR)

### Règles pour les PR
- **Titre** : Doit suivre le même format que les commits (ex: `feat(rooms): ajouter le support des ouvertures #PROJ-123`).
- **Description** :
  - **Obligatoire** pour les PR de type `feat`, `fix`, ou `perf`.
  - Doit inclure :
    - Une **brève description** des changements.
    - Un **lien vers le ticket** (ex: Jira, GitHub Issue).
    - Les **captures d'écran** si applicable (pour les changements UI).
- **Review** :
  - Au moins **1 approbation** requise pour fusionner.
  - Les **CI checks** (lint, build, tests) doivent passer.

---

## 🚫 Anti-Patterns (à Éviter Absolument)
- ❌ **Commits sans type** : Toujours utiliser un type (`feat`, `fix`, etc.).
- ❌ **Messages de commit en anglais** : **Toujours en français**. 
- ❌ **Commits sans ticket** pour `feat`, `fix`, `style`, `perf`.
- ❌ **Branches sans préfixe de type** : Toujours commencer par `feat/`, `fix/`, etc.
- ❌ **Fusionner une PR sans description** (si applicable).
- ❌ **Faire un `git push --force`** sur `main` ou une branche partagée.

---

## ✅ Checklist pour un Commit
Avant de commit :
- [ ] Le message suit le format `<type>(<scope>): <description> <ticket>`.
- [ ] Le **type** est correct (`feat`, `fix`, etc.).
- [ ] La **description** est en français et fait entre 4 et 100 caractères.
- [ ] Le **ticket** est inclus si nécessaire (`feat`, `fix`, `style`, `perf`).
- [ ] Les **tests** passen (si applicable).
- [ ] Le code est **linté** (`npm run lint` ou équivalent).

---

## 🔗 Références Rapides
| **Besoin**               | **Où regarder**                          |
|--------------------------|-----------------------------------------|
| Exemples de commits      | Historique Git du projet                 |
| Workflow CI/CD          | `.github/workflows/`                     |
| Tickets                  | Jira, GitHub Issues, etc.                |
