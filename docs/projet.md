# Projet BatiBrain — Point d'entrée

Date de mise à jour: 2026-07-10

## Objectif du document
Ce document est le point d'entrée pour développer l'application avec une approche humaine + Copilot.
Il indique quoi lire, dans quel ordre, et comment exécuter une feature de manière cohérente.

## Périmètre du document
In-scope:
- Orientation de lecture et de travail.
- Rappel des sources fiables.
- Roadmap versionnée (SemVer).
- Workflow standard de développement.
- Definition of Done légère.
- État de fraîcheur des artefacts.

Out-of-scope:
- Détail fonctionnel écran par écran (porté par le dossier IHM).
- Détail technique d'implémentation bas niveau (porté par le code et les docs dédiées).

## Sources fiables de vérité
Sources fiables actuelles:
- [docs/product.md](product.md)
- [docs/architecture.md](architecture.md)
- [docs/spec.md](spec.md)
- Tout le dossier [docs/ihm/](ihm/)

Règle pratique:
- La source fonctionnelle principale par défaut est le dossier IHM.
- [docs/spec.md](spec.md) reste une source active temporaire (phase de transition).

## Règle d'arbitrage en cas de conflit
Il n'y a pas d'ordre d'arbitrage automatique entre les sources fiables.

Règle obligatoire:
- En cas de conflit entre documents, demander un arbitrage explicite au cas par cas avant de coder.
- Ne pas prendre d'hypothèse silencieuse sur un conflit documentaire.

## Roadmap versions (SemVer)
Correspondance retenue:
- V1 = 1.0
- V2 = 2.0
- V2.1 = 2.1
- V3 = 3.0
- V4 = 4.0
- V5 = 5.0

Synthèse du plan:
- 1.0: socle applicatif métier.
- 2.0: documents et photos.
- 2.1: PWA (mobile web).
- 3.0: tâches, travaux, planning.
- 4.0: IA avec validation humaine.
- 5.0: moteur 3D complet.

## Workflow standard de développement d'une feature
1. Lire ce document [docs/projet.md](projet.md).
2. Lire les specs IHM concernées (vue et composants) dans [docs/ihm/](ihm/).
3. Vérifier la cohérence avec:
   - [docs/product.md](product.md)
   - [docs/spec.md](spec.md)
   - [docs/architecture.md](architecture.md)
4. Poser les questions nécessaires pour lever les doutes ou manques d'information.
5. Coder.
6. Exécuter les tests pertinents.
7. Mettre à jour la documentation impactée dans le même changement.

## Definition of Done (checklist légère)
Une feature est considérée terminée si:
- Le comportement livré est conforme à la spec IHM ciblée.
- Les conflits documentaires éventuels ont été arbitrés explicitement.
- Le code compile et les tests pertinents passent.
- Les impacts documentaires sont mis à jour (au minimum IHM + doc de cadrage concernée).
- La version cible (1.0, 2.0, 2.1, 3.0, 4.0, 5.0) est explicite.

## Alerte fraîcheur documentaire et technique
⚠️ Certains artefacts ne sont pas à jour et ne doivent pas être utilisés comme source de vérité pour décider le comportement cible.

Liste des artefacts non à jour:
- Le code et la documentation sous [web/](../web/)

Règle de persistance:
- Toute évolution du schéma cible l'unique script d'initialisation [supabase/migrations/20260703_000002_init_v2.sql](../supabase/migrations/20260703_000002_init_v2.sql).

Conséquence pratique:
- Les éléments ci-dessus peuvent servir de contexte technique, mais pas de référence fonctionnelle finale.
- En cas de divergence avec les sources fiables, demander un arbitrage.

## Règles de maintenance de ce document
- Mettre à jour ce document lors de toute évolution de méthode (workflow, sources fiables, versioning, DoD).
- Conserver ce document court, lisible, et orienté exécution.
- Si [docs/spec.md](spec.md) devient redondant à terme, formaliser la décision de fusion ici avant suppression.

## Répartition avec copilot-instructions
- [docs/projet.md](projet.md) porte la gouvernance projet:
   - sources fiables,
   - arbitrage documentaire,
   - roadmap SemVer,
   - workflow feature,
   - Definition of Done,
   - état de fraîcheur.
- [.github/copilot-instructions.md](../.github/copilot-instructions.md) porte les règles d'exécution agent:
   - discipline de changement,
   - garde-fous architecture,
   - conventions de commit,
   - renvoi vers les fichiers d'instructions spécialisés.
