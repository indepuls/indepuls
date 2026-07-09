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
│   └── unified.js    — Wrappers DATA pour le mode unifié (branché sur indepuls.html)
└── tests/
    ├── abattement_micro.test.js — 44 tests : abattement forfaitaire + plafonds régime micro
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
node shared/tests/abattement_micro.test.js # 44 tests abattement + plafonds micro
node shared/tests/validation.js            # 73 tests alignement core vs originaux
node shared/tests/unified_model.test.js    # 19 tests modèle unifié
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
