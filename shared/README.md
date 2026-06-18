# Shared core — Indépuls

Moteur de calcul partagé entre les modes Artisan et Freelance.
Mergé dans `main` — code de production.

## Structure

```
shared/
├── core/
│   ├── taux.js       — Référentiel fiscal 2026 (TAUX_URSSAF, TVA_SEUILS, ABATTEMENTS_MICRO, MICRO_LIMITS)
│   ├── utils.js      — Utilitaires purs sans DATA (fmt, uuid, monthLabel…)
│   ├── calculs.js    — Calculs métier purs (TVA, URSSAF, revenu net, abattement micro, plafonds…)
│   └── storage.js    — loadData, saveData, migrate, exportData, handleImport
├── modes/
│   ├── freelance.js  — Wrappers DATA + STORAGE_KEY pour le mode Freelance/OBM
│   └── artisan.js    — Wrappers DATA + STORAGE_KEY + fonctions propres à l'Artisan
└── tests/
    ├── abattement_micro.test.js — 44 tests : abattement forfaitaire + plafonds régime micro
    ├── bridge_smoke.js          — 100 tests : smoke test de chaque export Mode.* appelé par le bridge HTML
    ├── phase2_sandbox.js        — 4063 comparaisons : branchement réel Freelance + substitution Artisan
    ├── unified_model.test.js    — 19 tests : modèle unifié montantDevis = prestation + vente
    └── validation.js            — 73 tests : alignement core/calculs.js sur les originaux HTML
```

## Convention

Toutes les fonctions de `core/calculs.js` reçoivent `DATA` en premier paramètre.
Les fichiers `modes/` créent des wrappers qui injectent leur `DATA` local,
pour conserver l'API attendue par les HTML (`getRevenuNetMois(mk)` au lieu
de `C.getRevenuNetMois(DATA, mk)`).

Le bridge HTML (`<script type="module">` en fin de fichier) importe le module de mode
et expose chaque fonction sur `window.*` pour les appels du script principal.

## Lancer les tests

```bash
node tests.js                              # 56 tests unitaires (core Freelance)
node shared/tests/abattement_micro.test.js # 44 tests abattement + plafonds micro
node shared/tests/validation.js            # 73 tests alignement core vs originaux
node shared/tests/unified_model.test.js    # 19 tests modèle unifié
node shared/tests/phase2_sandbox.js        # 4063 comparaisons branchement prod
node shared/tests/bridge_smoke.js          # 100 smoke tests bridge modes/*.js
```

## Domaines couverts

| Domaine            | Fonctions clés                                                               |
|--------------------|------------------------------------------------------------------------------|
| Taux fiscaux       | TAUX_URSSAF, TVA_SEUILS, ABATTEMENTS_MICRO, MICRO_LIMITS, getTauxStatut    |
| Abattement micro   | getAbattementMicro, getRevenuImposableMicro, getImpotEstimeMicro            |
| Plafonds micro     | getMicroPlafondInfo (prorata année d'ouverture, mixte, sous-plafond presta) |
| TVA                | getTVAZone, getTVACollecteeMois, getTVAProvisionMensuelle…                  |
| URSSAF             | getTauxCharges*, getUrssafRegime, getUrssafAnnuelBrut…                      |
| Dépenses           | getDepensesMois, getDepensesMoyenneMensuelle                                |
| Revenu net         | getRevenuNetMois, getCaBreakdownMois, getCaAnnuelBrut, getCaNetAnnuel       |
| SASU               | getSasuCoutRemuMensuel, getSasuSoldeActuelEstime, getSasuProjectionFinAnnee |
| Temps / Heures     | getMissionTotalMs, getMissionHeures, getHeuresFact, getHeuresInterne        |
