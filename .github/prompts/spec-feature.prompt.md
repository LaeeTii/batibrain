---
name: spec-feature
description: Appliquer une feature dans la documentation (spec, IHM, architecture, data-model) sans toucher au code, avec clarification obligatoire.
---
Tu appliques une feature dans la documentation du projet, sans modifier le code.

Objectif:
- Répercuter la feature dans tous les fichiers documentaires nécessaires.
- Maintenir la cohérence entre spec globale, IHM, architecture et modèle de données.

Périmètre autorisé:
- docs/spec.md
- docs/ihm/
- docs/architecture.md
- docs/data-model.md
- Tout autre fichier documentaire strictement nécessaire dans docs/

Interdictions:
- Ne pas modifier de fichiers de code (ex: web/).
- Ne pas inventer de règles métier, d’écrans, de données ou de comportements.

Règle d’incertitude (obligatoire):
- Si une information est ambiguë, absente ou contradictoire, poser des questions ciblées avant toute écriture sur les points concernés.
- Limiter les questions à celles strictement nécessaires pour avancer.

Procédure obligatoire:
1. Identifier la feature demandée et reformuler son objectif en 3-5 lignes.
2. Lister les fichiers documentaires potentiellement impactés:
- docs/spec.md
- Les fichiers ciblés dans docs/ihm/ (vues, composants, logique)
- docs/architecture.md
- docs/data-model.md
 - Si la feature le justifie, créer un nouveau fichier IHM dédié plutôt que d'étendre un fichier trop générique.
 - Si la feature le justifie, créer un nouveau bloc dans un composant IHM existant plutôt que de surcharger un autre fichier.
 - Si les data-models sont impactés mettre à jour le script d'initialisation de la base de données dans `supabase/migrations/20260703_000001_init.sql` et documenter les changements dans `docs/data-model.md`.
9. Déclarer explicitement la fonctionnalité dans `docs/spec.md`.
3. Vérifier les manques et conflits d’information.
4. Poser les questions de clarification minimales.
5. Après réponses utilisateur, proposer un plan de mise à jour fichier par fichier.
6. Mettre à jour uniquement les fichiers validés.
7. Mettre à jour docs/spec.md pour déclarer explicitement la feature ajoutée/modifiée.
8. Vérifier la cohérence finale entre les documents modifiés.
9. Marquer la feature comme terminée dans `docs/spec.md`.
10. Fournir un récapitulatif final:
- Fichiers modifiés
- Décisions prises
- Questions résolues
- Hypothèses restantes (si autorisées explicitement par l’utilisateur)

Critères de qualité:
- Texte clair, testable, non ambigu.
- Cohérence terminologique avec le projet.
- Aucune dérive hors feature demandée.
- Aucune édition de code dans /web.

Format de réponse attendu dans le chat:
- Synthèse de la feature
- Fichiers impactés
- Questions (si nécessaire)
- Plan de mise à jour
- Résultat des modifications
