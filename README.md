# Indépuls

Copilote de rentabilité pour indépendants (freelances, artisans, revendeurs).

> Ce n'est pas un logiciel de comptabilité, de facturation, un CRM ou un ERP — c'est un tableau de bord qui répond à la question « Est-ce que ça va ? ».

## Démarrer

- **Point d'entrée unique** : [`indepuls.html`](indepuls.html) — application complète, tous profils.
- Vanilla HTML/CSS/JS, sans build step. Ouvrir le fichier ou servir le dossier statiquement.
- Persistance locale via `localStorage` (+ Supabase pour les analytics).

## Déploiement

- Repo GitHub : `https://github.com/indepuls/indepuls.git`
- Déploiement automatique sur Vercel à chaque `git push` sur `main` → `indepuls.vercel.app`

## Structure

| Fichier / Dossier | Rôle |
|---|---|
| `indepuls.html` | Point d'entrée unique — app complète tous profils |
| `index.html` | Redirection automatique vers `indepuls.html` |
| `indepuls_freelance.html`, `indepuls_artisan.html` | Archives (SCHEMA_VERSION 29) — ne plus maintenir, conservées pour les tests de non-régression |
| `shared/` | Logique métier partagée (core + modes + tests) — voir [`shared/README.md`](shared/README.md) |
| `supabase/` | Scripts SQL analytics |
| `tests.js` | Suite de tests principale (Node.js) |
| `vercel.json` | Config déploiement |

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — référence technique complète du projet (architecture, conventions, pièges connus). À lire en priorité avant toute modification.
- [`ARCHITECTURE_PRODUIT.md`](ARCHITECTURE_PRODUIT.md) — matrice fonctionnelle par profil (KPIs, widgets, comportements conditionnels).
- [`VISION_PRODUIT.md`](VISION_PRODUIT.md) — vision produit long terme et roadmap par phases.

## Tests

```bash
node tests.js                              # 56 tests unitaires (core Freelance)
node shared/tests/abattement_micro.test.js # 44 tests abattement + plafonds micro
node shared/tests/planning.test.js         # 61 tests moteur Planning
node shared/tests/validation.js            # 73 tests alignement core vs originaux
node shared/tests/unified_model.test.js    # 19 tests modèle unifié
node shared/tests/phase2_sandbox.js        # 4063 comparaisons branchement prod
node shared/tests/bridge_smoke.js          # 102 smoke tests bridge modes/*.js
```
