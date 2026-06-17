# refactor-test — Architecture commune Artisan/Freelance

Prototype technique. **Ne pas merger dans main sans validation explicite.**

## Contexte

`indepuls_freelance.html` et `indepuls_artisan.html` partagent ~95% de code.
Ce dossier explore une architecture commune sans toucher aux fichiers de production.

## Structure

```
refactor-test/
├── core/
│   ├── taux.js       — Référentiel fiscal (TAUX_URSSAF, TVA_SEUILS, constantes)
│   ├── utils.js      — Utilitaires purs sans DATA (fmt, uuid, monthLabel…)
│   ├── calculs.js    — Calculs métier purs (TVA, URSSAF, revenu net, dépenses…)
│   └── storage.js    — loadData, saveData, migrate, exportData, handleImport
└── modes/
    ├── freelance.js  — Wrappers DATA + STORAGE_KEY pour le mode Freelance/OBM
    └── artisan.js    — Wrappers DATA + STORAGE_KEY + fonctions propres à l'Artisan
```

## Convention

Toutes les fonctions de `core/calculs.js` reçoivent `DATA` en premier paramètre.
Les fichiers `modes/` créent des wrappers qui injectent leur `DATA` local,
pour conserver l'API attendue par les HTML (ex : `getRevenuNetMois(mk)` au lieu
de `C.getRevenuNetMois(DATA, mk)`).

## Ce qui est extrait (Phase 1)

| Domaine           | Fonctions extraites                                                          |
|-------------------|------------------------------------------------------------------------------|
| Taux fiscaux      | TAUX_URSSAF, TVA_SEUILS, getTauxStatut, DEP_CATEGORIES, SRC_LABELS          |
| Utilitaires       | fmt, fmtE, uuid, today, getCurrentMk, getMonthKey, monthLabel, heuresMs…    |
| TVA               | getTVAZone, getTVACollecteeMois, getTVAProvisionMensuelle, getNextTVAEcheance… |
| URSSAF            | getTauxCharges*, getUrssafRegime, getUrssafAnnuelBrut, getUrssafProvision…   |
| Dépenses          | getDepensesMois, getDepensesMoyenneMensuelle                                 |
| Revenu net        | getRevenuNetMois, getCaBreakdownMois, getCaAnnuelBrut, getCaNetAnnuel        |
| Taux horaire      | getTauxHoraireMinCible                                                       |
| SASU              | getSasuCoutRemuMensuel, getSasuSoldeActuelEstime, getSasuProjectionFinAnnee  |
| Temps / Heures    | getMissionTotalMs, getMissionHeures, getHeuresFact, getHeuresInterne         |
| Stockage          | loadData, saveData, migrate, applyDefaults, exportData, handleImport         |

## Ce qui reste dupliqué (hors scope Phase 1)

- Toutes les fonctions de rendu HTML (`w*()`, `render*()`)
- Gestion des modales et events DOM
- `getDefaultData()` / `getExampleData()` (données différentes par mode)
- Fonctions spécifiques Artisan : devis, chantiers, planning, encaissements
- CSS et thèmes (700+ styles inline dans les template strings)

## Risques identifiés

1. **getCaFromMissions** : dans le HTML actuel, le filtrage sur le mois-clé passe par
   `dateFact` pour les missions facturées mais par `dateDebutRec` pour les récurrentes.
   La version extraite simplifie — à vérifier sur données réelles.

2. **getMoisActifsAnnee** : dépend de `getCurrentMk()` qui lit `new Date()`.
   En test, penser à mocker la date si on veut tester des années passées.

3. **import dynamique** : les modules ES utilisent `import/export`. Les HTML
   actuels sont des scripts inline sans bundler. La migration Phase 2 nécessite
   soit un `<script type="module">`, soit Vite/esbuild pour bundler.

4. **DATA global** : les HTML mutent `DATA` directement à de nombreux endroits.
   La transition vers `setData()` / `getData()` devra être progressive.

## Plan Phase 2 (si Phase 1 validée)

1. Ajouter `<script type="module">` dans les HTML (testé sur Chrome/Firefox/Safari modernes)
2. Remplacer 5 fonctions simples dans freelance.html par des imports (ex: fmt, uuid, isSASU…)
3. Tester les 2 modes après chaque remplacement
4. Itérer jusqu'à ce que les HTML ne contiennent plus que UI + appels aux modules

## Décision finale

À valider ensemble avant tout merge vers main.
Si la Phase 2 s'avère trop risquée, on abandonne la branche et on conserve
les deux fichiers actuels tels quels.
