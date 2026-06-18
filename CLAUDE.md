# Indépuls — Référence projet

## Instructions pour Claude Code

> **À lire en priorité à chaque session.**
>
> Après chaque changement significatif (nouvelle fonctionnalité, refonte d'une fonction clé, modification de la structure de `DATA`, correction de bug important, nouveau mode ou widget), **mettre à jour ce fichier** :
> - Ajouter la fonctionnalité dans la section "Fonctionnalités implémentées"
> - Mettre à jour les fonctions clés si de nouvelles ont été créées
> - Noter tout point d'attention nouveau (bug connu, convention, piège CSS…)
> - Committer la mise à jour avec le message `docs: update CLAUDE.md`
>
> Ne pas attendre la fin de session — mettre à jour dès que le changement est stable et commité.
>
> **Après chaque commit, faire automatiquement un `git push` sur `main` sans demander confirmation.** Le déploiement Vercel est automatique à chaque push.

## Vision produit

Indépuls est un **copilote de rentabilité pour indépendants**.

Ce n'est PAS : un logiciel de comptabilité, de facturation, un CRM complet, ni un ERP.

L'objectif est d'aider un indépendant à comprendre rapidement :
- ce qu'il gagne réellement
- ce qu'il doit mettre de côté
- s'il peut se rémunérer
- s'il est rentable
- combien de temps il peut tenir avec sa trésorerie

**Chaque fonctionnalité doit respecter 3 critères : Utile · Simple · Compréhensible en moins de 5 secondes.**

Si une fonctionnalité ajoute de la complexité sans apporter une forte valeur, ne pas la proposer.

Toujours privilégier une phrase compréhensible, une recommandation claire, une aide à la décision — avant d'afficher des chiffres.

## Décisions produit validées

- Le Score Santé est le widget principal du logiciel
- La simplicité est prioritaire sur l'exhaustivité
- Les indicateurs doivent être orientés action
- **Mobile first** — aucun scroll horizontal autorisé
- Les conseils doivent être compréhensibles par quelqu'un qui ne connaît rien à la comptabilité
- Les modes Freelance et Artisan doivent rester très proches techniquement
- La SASU doit afficher des informations orientées rémunération et trésorerie plutôt que revenu net

## Idées volontairement exclues

Ne pas proposer spontanément :
- Facturation complète
- CRM complexe
- Gestion bancaire automatique
- Gestion des devis détaillés
- Gestion RH / stock
- Comptabilité complète
- Fonctionnalités nécessitant une expertise comptable

Indépuls doit rester un outil de **pilotage et d'aide à la décision**.

---

## Fichiers & rôles

| Fichier / Dossier | Rôle |
|---|---|
| `index.html` | Page d'accueil + sélection du mode (freelance / artisan) |
| `indepuls_freelance.html` | App complète mode freelance (~6 100 lignes, SCHEMA_VERSION 28) |
| `indepuls_artisan.html` | App complète mode artisan (~6 600 lignes, SCHEMA_VERSION 28) |
| `vercel.json` | Config déploiement Vercel |
| `tests.js` | Suite de tests principale (VM Node.js) — 56 tests Freelance |
| `shared/` | Logique métier partagée (core + modes + tests) — voir `shared/README.md` |
| `shared/core/calculs.js` | ~580 lignes, 54 fonctions exportées — tout le calcul métier |
| `shared/core/taux.js` | Référentiel fiscal 2026 (TVA, URSSAF, abattements, plafonds micro) |
| `shared/core/storage.js` | `applyDefaults`, `migrate`, `getDefaultData` |
| `shared/modes/freelance.js` | Pont ESM Freelance → window.* |
| `shared/modes/artisan.js` | Pont ESM Artisan → window.* (shape `getCaBreakdownMois` différente) |
| `shared/tests/abattement_micro.test.js` | 44 tests ESM — abattements, plafonds micro, prorata |
| `shared/tests/bridge_smoke.js` | 100 tests — vérifie que chaque window.* appelé par le HTML existe |
| `shared/tests/validation.js` | 73 tests — compare fonctions HTML locales vs core |
| `shared/tests/unified_model.test.js` | 19 tests — modèle `montantDevis = prestation + vente` |
| `shared/tests/phase2_sandbox.js` | 4 063 comparaisons Freelance bridge vs core direct |
| `.gitignore` | Exclut `.claude/` (fichiers de dev local) |

## Déploiement

- Repo GitHub : `https://github.com/indepuls/indepuls.git`
- Déploiement auto sur Vercel à chaque `git push` sur `main`
- URL prod : `indepuls.vercel.app`
- Commande de travail : `cd "C:\Users\alexb\OneDrive\Bureau\Indépuls\indepuls-repo"`
- Node.js requis pour les tests : `C:\Program Files\nodejs\node.exe` (pas dans le PATH Bash — utiliser PowerShell)

## Stack technique

- HTML/CSS/JS **vanilla** — zéro framework, zéro dépendance
- Persistance : `localStorage` via objet global `DATA` (+ Supabase pour analytics)
- Pas de build step — les fichiers sont servis directement
- Module system : `shared/core/*.js` et `shared/modes/*.js` sont des modules ESM (import/export)

## Architecture du pont HTML ↔ modules ESM (bridge pattern)

Chaque fichier HTML contient, en bas du `<body>`, un bloc `<script type="module">` qui :
1. Importe le module ESM du mode (`shared/modes/freelance.js` ou `artisan.js`)
2. Appelle `Mode.setData(DATA)` pour synchroniser les données du module avec `DATA` global
3. Expose les fonctions du module sur `window.*` pour que le script principal (non-module) puisse les appeler

```js
// Exemple — bloc bridge en bas de indepuls_freelance.html
import * as Mode from './shared/modes/freelance.js';

function sync() { Mode.setData(DATA); } // à appeler avant tout usage du mode

window.getCaBreakdownMois  = (mk) => { sync(); return Mode.getCaBreakdownMois(mk); };
window.getRevenuNetMois    = (mk) => { sync(); return Mode.getRevenuNetMois(mk); };
window.getMicroPlafondInfo = ()   => { sync(); return Mode.getMicroPlafondInfo(); };
// ... etc.
```

**Règle critique** : `sync()` doit être appelé avant chaque appel au module, car `DATA` peut être muté par le script principal entre deux appels.

## Structure de DATA (localStorage)

```js
DATA = {
  currentYear: 2026,
  params: {
    statut: 'freelance' | 'sasu',        // mode juridique
    remunerationNette: 0,                 // objectif rémunération nette/mois (SASU)
    coutRemunerationPct: 80,             // % charges patronales (SASU)
    tresorerieParAnnee: { 2026: 5000 }, // trésorerie de départ par année
    soldeReel: 4200,                      // ancrage solde bancaire réel (SASU, optionnel)
    soldeReelDate: '2026-06',            // mois de l'ancrage
    tva: true,
    tauxTVA: 20,
    // ... autres params (URSSAF, objectifs, etc.)
  },
  missions: [...],
  revenus: { '2026-05': { ... } },
  depenses: { '2026-05': [...] },
  bilanDismissed: false,                 // persistance bilan mensuel (artisan)
}
```

## Modes & statuts

- **Freelance** : EI/EURL/portage, cotisations URSSAF, TJM, missions
- **Artisan** : même base, CA par encaissements, pas de missions TJM
- **SASU** : activé via `DATA.params.statut === 'sasu'`, détecté par `isSASU()`
  - Pas de cotisations URSSAF (remplacé par charges salariales fixes)
  - Widget "Rémunération recommandée" sur le dashboard
  - KPI "Trésorerie projetée fin d'année"
  - Pas de KPI "Revenu net du mois" (remplacé par trésorerie)

## Fonctions clés

```js
// Navigation
navigate(page)              // change d'onglet
renderDashboard()           // re-render le dashboard complet

// SASU
isSASU()                    // true si statut === 'sasu'
getSasuCoutRemuMensuel()    // rémunération nette × (1 + charges%)
getSasuTresorerieEstimee()  // projection tréso fin d'année (formule annuelle)
getSasuSoldeActuelEstime()  // solde estimé à ce jour (YTD)
getSasuProjectionFinAnnee() // projection = solde actuel + rythme × mois restants
renderSasuCard()            // widget "Rémunération recommandée" (dashboard)
wTresorerieKPI()            // KPI trésorerie projetée (dashboard SASU)

// CA & revenus
getCaFromMissions(mk)       // CA missions du mois mk ('YYYY-MM')
getPonctuelsCA(mk)          // CA ponctuels du mois
getRevenuNetMois(mk)        // revenu net (CA - charges - impôts - dépenses)
getCaAnnuelBrut()           // total CA année en cours

// Abattement forfaitaire & imposition micro (dans shared/core/calculs.js)
getAbattementMicro(DATA, caP, caV)           // abattement calculé (avec minimum légal 305€)
getRevenuImposableMicro(DATA, caP, caV)      // CA - abattement
getImpotEstimeMicro(DATA, caP, caV)          // revenu imposable × taux impôts
getMicroPlafondInfo(DATA)                    // {plafond, sousPlafond, pct, prorata, ...} ou null (SASU)

// Dépenses
getDepensesMois(mk)         // total dépenses du mois
getDepensesMoyenneMensuelle() // moyenne mensuelle des dépenses

// TVA
getNextTVAEcheance()        // prochaine échéance TVA (court terme)
getTVACollecteeAnnuelle()   // TVA collectée annuelle estimée

// Score santé
pilierCard(nom, score, ...)  // card compacte score de santé avec modal détail
openPilierDetail(key)        // ouvre modal détail d'un pilier

// Utilitaires
getCurrentMk()              // mois courant 'YYYY-MM'
getCurrentYearMonths()      // ['2026-01', ..., '2026-12']
fmtE(val, dec)              // formatage €
saveData()                  // persist DATA en localStorage
```

## Divergences Artisan / Freelance

Ces différences doivent être maintenues à jour — elles ont causé des bugs en prod.

| Point | Freelance | Artisan |
|---|---|---|
| Shape de `getCaBreakdownMois` | `{presta, vente}` | `{prestation, vente, total}` — traduit dans `shared/modes/artisan.js` |
| `window.isActiviteMixte` | Disponible dans le bridge | **Absent du bridge artisan** — utiliser `DATA.params.activiteMixte` directement dans le HTML |
| CA mensuel | Calculé depuis les missions | Calculé depuis les encaissements réels (`getCaEncaisseAnnuel`) |
| Bilan mensuel | Non | Oui (`DATA.bilanDismissed`) |

**Bug historique** (juin 2026) : `isActiviteMixte()` appelé dans `wProvisionsSide` du HTML artisan → dashboard blanc. Corrigé en remplaçant l'appel par `DATA.params.activiteMixte`.

## SCHEMA_VERSION

- Les deux HTML sont à `SCHEMA_VERSION = 28` (alignés en juin 2026)
- `shared/modes/artisan.js` et `shared/modes/freelance.js` portent aussi cette version
- `migrate()` dans `storage.js` est **idempotent** (pas de blocs conditionnels par version) — incrémenter la constante ne cause pas de migration risquée, mais reste nécessaire pour marquer un changement de structure `DATA`
- À incrémenter dans les 4 endroits : les 2 HTML + les 2 fichiers modes

## Suites de tests (Node.js)

```bash
# Depuis C:\Users\alexb\OneDrive\Bureau\Indépuls\indepuls-repo
$node = "C:\Program Files\nodejs\node.exe"

& $node tests.js                                          # 56 tests Freelance (VM HTML)
& $node --experimental-vm-modules shared/tests/abattement_micro.test.js  # 44 tests abattements
& $node shared/tests/bridge_smoke.js                      # 100 tests bridge smoke
& $node shared/tests/validation.js                        # 73 tests comparaison HTML/core
& $node shared/tests/unified_model.test.js                # 19 tests modèle unifié
& $node shared/tests/phase2_sandbox.js                    # 4 063 comparaisons sandbox
```

Total : environ **4 355 assertions** couvrant calculs, bridge, migrations, et règles fiscales 2026.

## Architecture du dashboard (freelance & artisan)

```
renderDashboard()
  ├── wScoreSante()           // Score santé global + 4 piliers
  ├── renderSasuCard()        // Widget SASU (si isSASU())
  ├── wKPIs()                 // Grille 3 KPIs
  │     ├── CA annuel
  │     ├── Tréso projetée (SASU) OU Revenu net du mois
  │     └── Évolution CA (graphique)
  ├── wRepartition()          // Donut "Où part votre CA ?"
  ├── wProvisionsSide()       // Argent à mettre de côté
  └── wMissions() / wBilan()  // Missions actives ou bilan mensuel
```

## Modales existantes

| ID | Rôle |
|---|---|
| `modal-pilier` | Détail d'un pilier du score de santé |
| `modal-treso-anchor` | Saisie du solde bancaire réel (SASU) |
| `modal-ponctuel` | Ajout revenu ponctuel |
| `modal-depense` | Ajout/édition dépense |

## Conventions CSS

- Variables : `--ok` (vert), `--warn` (orange), `--err` (rouge), `--pri` (bleu primaire), `--sec` (secondaire), `--tl` (texte léger), `--brd` (bordure), `--bg` (fond), `--card` (fond card)
- `.kpi` a `overflow:hidden` et `position:relative` — ne pas mettre de contenu absolu qui dépasse
- `.kpi-ico` est en `position:absolute; right:14px; top:14px` — peut bloquer des boutons dans ce coin
- Grille dashboard : `.g3` = 3 colonnes, `.g4` = 4 colonnes
- Mobile ≤768px : `.g3` passe en 2 colonnes ; ≤640px : 1 colonne

## Analytics produit

- **Tables Supabase** : `profiles` (profil utilisateur enrichi) + `usage_events` (événements d'utilisation)
- **SQL** : `supabase/analytics.sql` — à exécuter une fois dans le dashboard Supabase
- **Tracking côté client** — fire-and-forget, jamais bloquant, silencieux en cas d'erreur
- **Événements trackés** : `account_created`, `login`, `logout`, `theme_changed`, `legal_status_selected`, `activity_type_selected`, `dashboard_viewed`, `expense_added`, `mission_added`, `mission_completed`, `score_sante_viewed`, `provision_widget_viewed`
- **Profil mis à jour automatiquement** à chaque login avec : email, theme, legal_status, activity_type
- **Architecture** : `window.trackEvent(name, data)` disponible globalement dans chaque app, défini dans l'IIFE Supabase en bas de chaque fichier. Monkey-patching via `setTimeout(fn, 0)` pour intercepter les fonctions app sans les modifier.
- **Pour ajouter un événement** : appeler `window.trackEvent('nom_evenement', {optionalData})` n'importe où dans le code app.

## Fonctions clés — Archives (ajoutées)

```js
getArchYearData(y)            // données normalisées pour une année (courante ou archivée)
archSmartPct(curr, prev)      // delta lisible : "+40%", "×11", "forte hausse" (jamais +1038%)
buildArchInterpretation(c,r)  // phrase de synthèse métier selon les tendances détectées
renderArchCompare(refYear)    // widget comparaison avec sélecteur d'année (ou moyenne)
renderArchProgress()          // carte "Vos progrès" depuis la première année archivée
ARCH_INSIGHT_GENERATORS       // tableau extensible pour futures analyses (sources, best month…)
```

## Fonctionnalités implémentées (historique)

- Score de santé : 4 piliers (rentabilité, remplissage, trésorerie, commercial), cards compactes + modal détail
- Mode SASU complet : widget rémunération recommandée, trésorerie projetée, suppression doublons KPI
- TVA unifiée : "Prochaine échéance TVA" (court terme) vs "TVA totale estimée à réserver" (annuel)
- Évolution CA pleine largeur sur mobile (3e KPI = `grid-column: 1/-1`)
- Bilan mensuel artisan : persistance via `DATA.bilanDismissed` (localStorage, pas session)
- Rémunération recommandée négative → clampée à 0 + message explicatif
- Trésorerie projetée : ancrage sur solde réel via modale `modal-treso-anchor`
- Mobile overflow fixes : `body { overflow-x: hidden }` sur artisan
- Archives enrichies : sélecteur de comparaison (année ou moyenne), KPIs lisibles (×N au lieu de +1038%), phrase d'interprétation automatique, badge "Année en cours", carte "Vos progrès", système extensible `ARCH_INSIGHT_GENERATORS`
- Source d'acquisition : champ optionnel sur chaque mission, donut chart dans les stats, phrase de rétrospective dans les archives
- **Abattement forfaitaire micro 2026** : calcul de l'impôt estimé selon le statut (BNC 34%, BIC prestation 50%, BIC/achat vente 71%, minimum légal 305€) — widget `wJalonFiscal`, alertes plafond micro dans `buildAlerts` (60%/80%/100%), prorata pour les créateurs d'entreprise en cours d'année
- **Refactoring shared/** : logique métier extraite dans `shared/core/` (ESM), bridge pattern pour exposer sur `window.*`, suites de tests complètes (4 355 assertions)

## Points d'attention

- Les deux fichiers (freelance + artisan) partagent la même logique — toute modification doit être appliquée aux deux
- **`SCHEMA_VERSION`** : à incrémenter dans les 4 endroits (2 HTML + 2 modes) si la structure de `DATA` change
- Les fonctions `wKPIs()` et `renderSasuCard()` sont les plus complexes du dashboard
- Ne pas utiliser `kpi-ico` (emoji absolu) dans les cards avec des boutons en haut à droite
- **Bridge artisan** : `window.isActiviteMixte` n'est pas exposé — utiliser `DATA.params.activiteMixte` dans le HTML artisan
- **`sync()` obligatoire** : toujours appeler `sync()` (alias `Mode.setData(DATA)`) avant tout appel à une fonction bridgée — `DATA` peut avoir été muté entre-temps
- **Tests avant push** : relancer au moins `tests.js` et `bridge_smoke.js` avant chaque push sur `main`

## Prochains chantiers identifiés

- **Déclaration URSSAF** : afficher les périodes de cotisation et les montants à déclarer (trimestriel / mensuel) — forte valeur pour les micro-entrepreneurs
- **Mode Artisan enrichi** : planning chantiers, gestion devis/acomptes spécifique BTP
- **Export PDF / bilan mensuel** : génération d'un récapitulatif mensuel téléchargeable
- **Synchronisation bancaire** : intégration optionnelle pour réconciliation automatique des encaissements
- **Tests Artisan dans `tests.js`** : la suite principale ne couvre que le Freelance — écrire l'équivalent pour Artisan (VM HTML artisan)
