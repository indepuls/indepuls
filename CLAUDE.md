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

## Architecture produit & Matrice fonctionnelle

> **Lire `ARCHITECTURE_PRODUIT.md` avant toute modification des KPIs, widgets, alertes ou comportements conditionnels par profil.**
> Ce fichier est la référence fonctionnelle.
>
> **Principe clé :** `modules.objectif` (pas la famille) détermine quel KPI principal afficher.
> La famille détermine le vocabulaire et les valeurs par défaut des modules — jamais le comportement final.
> - `modules.objectif === 'th'` → KPI "Taux horaire réel (€/h)"
> - `modules.objectif === 'tjm'` → KPI "TJM réel (€/j)"
> - `modules.objectif === 'marge_commande'` → KPI "Gain moyen par commande/vente"
>
> Ne jamais utiliser `family === 'chantier'` ou `_isChantier` pour décider du KPI à afficher — utiliser `DATA.params.modules.objectif`.

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
- **Interface unifiée** : `indepuls.html` est le seul point d'entrée. `indepuls_freelance.html` et `indepuls_artisan.html` sont conservés en archive mais ne sont plus maintenus
- La SASU doit afficher des informations orientées rémunération et trésorerie plutôt que revenu net
- **CA = encaissements réels pour tous les profils**, sans exception. Ne jamais proposer un "CA au devis signé" comme option — les alertes tableau de bord couvrent le cas des factures non encaissées

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
| `indepuls.html` | **Point d'entrée unique** — app complète tous profils (SCHEMA_VERSION 30) |
| `index.html` | Redirection automatique vers `indepuls.html` (portail dual-session supprimé) |
| `indepuls_freelance.html` | Archive mode freelance (SCHEMA_VERSION 29) — ne plus maintenir |
| `indepuls_artisan.html` | Archive mode artisan (SCHEMA_VERSION 29) — ne plus maintenir |
| `shared/modes/unified.js` | Pont ESM pour `indepuls.html` — STORAGE_KEY='indepuls', SCHEMA_VERSION=30 |
| `shared/modes/freelance.js` | Pont ESM Freelance (conservé pour `indepuls_freelance.html`) |
| `shared/modes/artisan.js` | Pont ESM Artisan (conservé pour `indepuls_artisan.html`) |
| `vercel.json` | Config déploiement Vercel |
| `tests.js` | Suite de tests principale (VM Node.js) — 56 tests Freelance |
| `shared/` | Logique métier partagée (core + modes + tests) — voir `shared/README.md` |
| `shared/core/calculs.js` | ~580 lignes, 54 fonctions exportées — calculs financiers uniquement |
| `shared/core/affaires.js` | Rentabilité unitaire par affaire : dépenses liées, marge, TH réel, agrégations portefeuille |
| `shared/core/planning.js` | Moteur Planning : capacité, remplissage, score — voir section dédiée ci-dessous |
| `shared/core/taux.js` | Référentiel fiscal 2026 (TVA, URSSAF, abattements, plafonds micro) |
| `shared/core/storage.js` | `applyDefaults`, `migrate`, `getDefaultData` |
| `shared/tests/abattement_micro.test.js` | 44 tests ESM — abattements, plafonds micro, prorata |
| `shared/tests/planning.test.js` | 61 tests ESM — moteur Planning, tous modes, valeurs limites |
| `shared/tests/bridge_smoke.js` | 102 tests — vérifie que chaque window.* appelé par le HTML existe |
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
    livreRecettesActif: false,           // livre des recettes (opt-in, false par défaut)
    // ... autres params (URSSAF, objectifs, etc.)
  },
  missions: [...],
  revenus: { '2026-05': { ... } },
  depenses: { '2026-05': [...] },
  bilanDismissed: false,                 // persistance bilan mensuel (artisan)
  recettesManuel: [...],                 // recettes manuelles (livre des recettes)
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

## Divergences archives Artisan / Freelance

Ces divergences existent dans les fichiers archivés (`indepuls_freelance.html` / `indepuls_artisan.html`). Dans `indepuls.html`, elles sont résolues.

| Point | Freelance (archive) | Artisan (archive) | indepuls.html (unifié) |
|---|---|---|---|
| Shape de `getCaBreakdownMois` | `{presta, vente}` | `{prestation, vente, total}` | Logique freelance (`{presta, vente}`) via `unified.js` |
| `window.isActiviteMixte` | Disponible dans le bridge | **Absent** — utiliser `DATA.params.activiteMixte` | Disponible via `unified.js` |
| CA mensuel | Encaissements réels | Encaissements réels | Encaissements réels (identique) |
| Bilan mensuel | Non | Oui (`DATA.bilanDismissed`) | Non (logique freelance) |

**Bug historique** (juin 2026) : `isActiviteMixte()` appelé dans `wProvisionsSide` du HTML artisan → dashboard blanc. Corrigé en remplaçant l'appel par `DATA.params.activiteMixte`.

## SCHEMA_VERSION

- `indepuls.html` est à `SCHEMA_VERSION = 30` (juin 2026 — fusion interfaces, clé localStorage unifiée `indepuls`)
- `shared/modes/unified.js` porte aussi la version 30
- Les archives (`indepuls_freelance.html`, `indepuls_artisan.html`, `shared/modes/freelance.js`, `shared/modes/artisan.js`) restent à 29 — ne pas les modifier
- `migrate()` dans `storage.js` est **idempotent** (pas de blocs conditionnels par version) — incrémenter la constante ne cause pas de migration risquée, mais reste nécessaire pour marquer un changement de structure `DATA`
- À incrémenter dans **2 endroits** : `indepuls.html` + `shared/modes/unified.js`

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
| `modal-lr-completer` | Popup complétion encaissement (livre des recettes) — mode règlement + référence justificative |
| `modal-lr-manuelle` | Ajout/édition d'une recette manuelle (livre des recettes) |
| `modal-lr-historique` | Historique des modifications d'une recette (lecture seule, ouvert via badge "Modifiée") |
| `modal-lr-edition` | Formulaire de modification d'une recette — montant, mode règlement, référence (ouvert via bouton "Modifier") |
| `modal-migration` | Choix entre deux jeux de données détectés au lancement (migration depuis anciens localStorage) |
| `modal-ref-motif` | Popup saisie du motif de refus quand un devis passe au statut "Refusé" (facultatif) |
| `modal-ponctuel` | Artisan : ajout d'un revenu ponctuel (avec champs LR si type ≠ hors_ca) |
| `modal-ponctuels` | Freelance : liste des revenus ponctuels du mois (add form + édition) |
| `modal-ponc-lr-edit` | Freelance : mini-modal pour éditer mode règlement + référence d'un ponctuel existant |
| `modal-fact-confirm` | Confirmation facturation (saisie date) |
| `modal-add-time` | Ajout de temps passé manuellement |
| `modal-correct-time` | Correction du chrono |
| `modal-archive` | Ajout/édition d'une année archivée manuellement |

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

## Fonctions clés — Livre des recettes

```js
getRecettesData()                          // merge auto (missions.encaissements) + manuel (recettesManuel), triées par date
recetteComplete(r)                         // true si date+client+montant+modeReglement+refJustificative présents
filtrerRecettes(recettes, periode, statut) // filtre par année/trimestre et valides/complètes/annulées/tout
renderRecettes()                           // rendu page avec groupement trimestriel + indicateur complétude + export
ouvrirPopupCompletion(missionId, encId)    // ouvre modal-lr-completer pré-rempli après un encaissement
enregistrerCompletion()                    // sauvegarde modeReglement + refJustificative sur l'encaissement
ouvrirRecetteManuelle(id)                  // ouvre modal-lr-manuelle (create si id null, edit sinon)
saveRecetteManuelle()                      // sauvegarde dans DATA.recettesManuel[]
toggleAnnulationRecette(origine, id, mId)  // bascule statut valide/annulee (jamais suppression)
exportRecettesCSV()                        // CSV avec BOM '﻿', séparateur ;, filtre courant
updateNavRecettes()                        // affiche/masque #nav-recettes selon livreRecettesActif
```

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
  - **Pilier Commercial (refonte 2026-06)** : mesure la *visibilité future*, pas les ventes passées. Missions actives = ponctuelles `att`/`cours` + récurrentes dont `dateDebutRec + nbMoisRec > aujourd'hui` (quel que soit le statut). Score : ≥3 actives OU ≥2+1devis→25 / 2 OU 1+1devis→18 / 1 seule→10 / 0→3. Taux de transformation supprimé du score. Visibilité affichée en mois (fin de la récurrente la plus longue).
  - **Pilier Rentabilité** : compare TH brut réel (CA brut/heures) vs TH minimum cible brut (calculé depuis l'objectif net). TH net affiché en indicateur complémentaire seulement.
  - **Pilier Trésorerie** : score basé sur retards ≥14j (inchangé), mais affiche systématiquement le total facturé non encaissé (sans délai minimum) pour éviter le faux sentiment de sécurité.
  - **Pilier Remplissage** : barème en courbe cloche — 75–90 % optimal (25/25), <40 % ou >100 % critique (5/25).
- **UX missions récurrentes (2026-06)** : dans la liste des missions, les récurrentes affichent : montant mensuel + période (`getRecurringPeriodLabel` : "juin → août 2026") + total ; statut "Facturé" → "Terminée" et "Refusé" → "Refusée" (libellés uniquement, valeur `'fact'`/`'ref'` inchangée) ; colonne "Facturée le" remplacée par suivi `N/total mois encaissés` basé sur `encaissements.length` ; badge `↻ mensuelle` visible (Freelance et Artisan) ; bouton 💰 restauré pour toutes les missions y compris récurrentes. Aucun calcul métier impacté.
- **Règle métier missions récurrentes (2026-06)** : pour une mission récurrente, `statut === 'fact'` est un état *administratif* (dernière facture envoyée), pas une fin d'activité. Partout où l'application doit déterminer si une activité est en cours, on utilise `isRecurringStillActive(m)` = `dateDebutRec + nbMoisRec > aujourd'hui` (durée indéfinie `nbMoisRec <= 0` = toujours active). Cette règle s'applique à : `getChargeEstimeeTotal`, filtre "En cours" de la liste missions, `wMissionsActives`, `wRemplissage`, `_actives` dans le Score Santé, `wProjection3Mois`, `renderMissionsSummary`. **Ne pas modifier** : CA, encaissements, trésorerie, historique (déjà corrects ou exclusion délibérée).
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
- **Livre des recettes** : page optionnelle (activée via `DATA.params.livreRecettesActif`, false par défaut), alimentée automatiquement depuis `missions[].encaissements`, popup de complétion après chaque encaissement (mode règlement + référence justificative, skippable), recettes manuelles dans `DATA.recettesManuel[]`, tableau trimestriel avec indicateur de complétude, annulation sans suppression, export CSV avec BOM pour Excel — artisan (hook `saveEncaissement`) et freelance (hook `addEncaissementModal`)
- **Livre des recettes — round 2** : séparation modal badge (historique diffs avant/après) vs bouton modifier (formulaire montant + mode + référence) ; revenus ponctuels intégrés avec champs LR ; légende camembert mobile sous le graphique ; motif de refus sur devis refusés + camembert stats côte à côte
- **UX clavier** : touche Entrée sur les modaux éligibles (sans textarea ni choix multiples, via `data-enter-action`) ; touche Échap ferme le modal ouvert
- **Validation visuelle champs obligatoires** : classe `.field-invalid` (bordure rouge + shake) sur les champs vides à la soumission, focus automatique, effacée dès la première saisie — `markInvalid(...ids)` helper disponible
- **Toasts de confirmation** : `showToast()` appelé après enregistrement mission/chantier, dépense, recette manuelle ; toast de confirmation après export CSV avec nombre de recettes et période
- **Module Affaires (2026-06)** : création de `shared/core/affaires.js` — domaine "rentabilité unitaire par affaire", séparé de `calculs.js` (flux financiers). Fonctions exportées : `getDepensesAffaire(DATA, affaireId)`, `getDepensesAffairesMap(DATA)`, `excludeDepensesLiees(depenses)`, `getMargeAffaire(DATA, m)`, `getTHReelAffaire(DATA, m)`, `getPctCoutAffaire(DATA, m)`, `getAffairesAvecCouts(DATA, missions)`, `getMargeMoyennePortefeuille(DATA, missions)`. Champ de liaison : `DATA.depenses[].chantierId` (nom technique stable, ne pas renommer). Fix `calculs.js` : `getDepensesMoyenneMensuelle` exclut désormais les dépenses liées (`!d.chantierId`) — règle commune artisan et freelance. `artisan.js` et `freelance.js` : import `affaires.js` + 8 exports wrappers. Bridge artisan HTML : 8 `window.*` exposés. `getDepensesChantier()` dans l'HTML reste une copie locale (lecture directe DATA, pas de sync() en boucle) — `getDepensesAffaire` via bridge est la voie externe.
- **Moteur Planning mutualisé (2026-06)** : création de `shared/core/planning.js` comme domaine métier séparé de `calculs.js`. Fonctions exportées : `toHeuresSem`, `getCapaciteHSem`, `getMissionChargeHSem`, `getChargeEstimeeTotal` (moteur Temps estimé) ; `getTauxRemplissageMois`, `getTauxRemplissageAnnee` (moteur Calendrier) ; `scorerRemplissage` (barème commun 40/60/75/90/100) ; `getPilierRemplissage(DATA)` (point d'entrée unifié). Paramètre `DATA.params.modePlanning` ('estime' | 'calendrier' | 'aucun') ajouté dans `getDefaultData` des deux HTML ('estime' pour freelance, 'calendrier' pour artisan) et garde dans `migrate()`. Structure `details` normalisée : `{capacite, utilise, libre, taux, unite}`. Score Santé pilier Remplissage, `wCapacite` (FL) et `wRemplissage` (AR) migrent vers `Mode.getPilierRemplissage()`. `calculs.js` non modifié. 226/226 tests passent.
- **Refonte positionnement modules (2026-06)** : icône artisan 🔨 → 🧰 dans `index.html` et `SESSIONS`. Descriptions cartes d'accueil reformulées en "Je vends…" (1re personne). Chips mises à jour. Ajout de 10 nouveaux métiers dans le select freelance (expert_comptable, consultant_rh, juriste, traducteur, redacteur, coach_sportif, nutritionniste, sophrologue, hypnotherapeute, psychologue → tous famille `service`). Ajout de 13 nouveaux métiers dans le select artisan (traiteur, fleuriste → `chantier` ; chocolatier, patissier, ebeniste, createur_bijoux, fabricant_cosmetiques, fabricant_bougies, tapissier, maroquinier, ferronnier → `fabrication`). Info-bulle `?` ajoutée sur le label "Métier exercé" dans les deux fichiers. Aucun calcul ni migration impacté.
- **Rebranding** : toutes les références "OBM Pilot" / "Artisan Pilot" remplacées par "Indépuls" ; fichiers export renommés `indepuls-sauvegarde-*.json` ; rétrocompatibilité import maintenue (anciens fichiers `tool:'obm'`/`'artisan'` toujours acceptés)
- **Modules comportementaux v29 (2026-06)** : `DATA.params.modePlanning` → `DATA.params.modules` (objet avec `planning`, `uniteTemps`, `objectif`, `devis`). `getDefaultModules(metier)` retourne les valeurs par défaut selon le profil. `applyDefaults()` injecte l'objet si absent. `migrate()` assure la rétrocompatibilité v28→v29. Architecture `family` (vocabulaire) reste découplée de `modules` (comportement).
- **Phase 5 — TH/TJM artisan** : `isJours()` helper ; `calcDevis()` convertit jours→heures ; labels TJM/€j dans devis, recalcObjectifs, KPI, alertes objectif pour les profils `uniteTemps='jours'` (ex: artisan_batiment)
- **Phase 5 bis — modules.objectif partout (2026-07)** : tous les écrans qui affichaient encore le KPI selon la famille métier (`BUSINESS_PROFILE_MAP`) ont été corrigés pour utiliser `modules.objectif` à la place. Écrans corrigés : page Objectifs (`renderObjectifsResult`), bande de synthèse dashboard (`wSynopsis`), Archives (`renderArchives`, `getArchYearData`). La famille reste utilisée uniquement pour le vocabulaire (vente/commande, emojis 🛍️/📦) et les seuils domaine-métier (marge 20% vs 30%). **Règle consolidée** : si c'est un KPI principal ou un label de taux → `modules.objectif`. Si c'est un mot métier ou un threshold spécifique au domaine → `BUSINESS_PROFILE_MAP`.
- **Phase 6 — planning conditionnel** : nav Planning visible seulement si `modules.planning==='calendrier'` ; guard `navigate('planning')` ; `#m-planning-zone` dans la modale mission masqué si aucun ou management ; widget Remplissage retourne '' si planning=aucun (valeur supprimée depuis)
- **Phase 7 — calendrier planning freelance** : page Planning complète dans freelance (navigation mois, rendu calendrier HTML, sessions par mission, taux de remplissage) ; nav Planning visible uniquement si `modules.planning==='calendrier'` (profil evenementiel) ; `initEditingSessions()`, `addSessionToEdit()`, `removeSessionFromEdit()` pour la gestion des sessions dans la modale ; `getTauxRemplissageMois` et `getTauxRemplissageAnnee` exportés dans `shared/modes/freelance.js`
- **Fusion interfaces v30 (2026-06)** : `indepuls.html` remplace les deux HTML séparés. `shared/modes/unified.js` (copie de freelance.js, STORAGE_KEY='indepuls', SCHEMA_VERSION=30). 7 profils dans les selects (`getDefaultModules` étendu avec `simulateurOffre`). `applyProfile(metier)` réinitialise `modules` aux défauts du profil — remplace `saveParam('metier',...)` partout. Migration localStorage 4 cas : clé unifiée / freelance seul / artisan seul / conflit → modale `modal-migration`. `index.html` redirige vers `indepuls.html`. Modal-mission : collectif conditionnel (famille service), charge estimée conditionnelle (planning estime).
- **Bug planning.js `modePlanning` (2026-06)** : `getPilierRemplissage()` lisait l'ancien champ `DATA.params.modePlanning` au lieu de `DATA.params.modules.planning`. Fix ligne 112 : `modules?.planning || modePlanning || 'aucun'` (fallback rétrocompat). Affectait tous les profils v30 — pilier Remplissage et widget Calendrier retournaient toujours `methode:'aucun'`.
- **Demo mode cloud sync guard (2026-06)** : `loadFromCloud()` écrasait `DATA` même en mode démo. Fix : guard `&& !DATA.isExample` dans le callback Supabase. Sans ce fix, les données cloud remplaçaient les données démo au chargement.
- **Données démo + sessions chantier (2026-06)** : `getExampleData()` peuple `demoSessions` (map id mission → sessions) pour les familles `chantier` et `fabrication`. Les missions ex-rec à ex-cours reçoivent des sessions réparties sur 5 mois. Widget Calendrier et pilier Remplissage affichent des données réalistes en mode démo artisan.
- **Bandeau contextuel démo toutes pages (2026-06)** : `renderDemoContextBar(page)` remplace `#example-banner` (visible seulement sur le dashboard). `<div id="demo-context-bar">` persistant après la topbar. Message adapté : données fictives + bouton "Commencer" sur les pages data, "paramètres conservés" en vert sur la page params. `navigate()` appelle `updateDemoUI()` à chaque changement de page.
- **Simulateur de rentabilité unifié (2026-06)** : fusion "Tester une offre" + "Tester un devis" en une seule page `page-simulateur` toujours visible (plus de gate `modules.simulateurOffre`). Architecture pipeline : `prepareSimInputs() → calcRentabilite() → renderSimOutputs()`. 4 presets auto-détectés via `getSimulateurPreset()` → BUSINESS_PROFILE_MAP : `service` (checkbox collectif, pas de coûts par défaut), `chantier` (trajet + fournitures + sous-traitance + autres frais), `fabrication` (matières + emballages + sous-traitance), `achat_revente` (coût achat + emballages + frais plateforme %). Champs unifiés (`sim-ca-val`, `sim-temps-val`, `sim-trajet-val`, `sim-matieres-val`, `sim-achat-val`, `sim-emballages-val`, `sim-soustraitance-val`, `sim-plateforme-val`, `sim-autresfrais-val`). Accordéon "Personnaliser ce simulateur" avec checkboxes "Je souhaite prendre en compte…" overrident les defaults du preset (state session `_simUserFields`, reset à chaque navigate). `updateNavSimulateur()` → toujours visible. `createMissionFromSim()` lit les nouveaux IDs. `calcDevis()` dans la modale mission reste inchangé.
- **Onboarding refonte (2026-06)** : suppression de l'étape 2 (formulaire statut/objectif/TVA). Le parcours est désormais : choix du profil → "Découvrir Indépuls →" → démo chargée directement → `#modal-welcome` s'affiche. Le modal explique le mode démo et propose deux boutons : "Explorer la démonstration →" (`closeWelcomeModal('dashboard')`) ou "⚙️ Personnaliser mes paramètres d'abord" (`closeWelcomeModal('params')`). `pickerStep1Next()` appelle directement `applyProfile()` + `loadDemoWithCurrentParams()`. `pickerStep2Confirm()` et `pickerBackToStep1()` supprimés. `loadDemoWithCurrentParams()` ouvre `modal-welcome` au lieu d'un toast.
- **Auth — formulaire email + mot de passe (2026-06)** : après `signOut()` ou sans session au chargement, l'overlay affiche un formulaire email + mot de passe (`sb.auth.signInWithPassword`). `onAuthStateChange(SIGNED_OUT)` réaffiche l'overlay en place (plus de redirect vers `/`). `onAuthStateChange(SIGNED_IN)` masque l'overlay et charge les données. Le bouton "Déconnexion" ne redirige plus — la transition est gérée entièrement par `onAuthStateChange`. `showLoginForm()` est la fonction centrale : réinitialise l'overlay et expose `window.authLogin()`.
- **Sessions heures + modules calendrier/estimation (2026-07)** : `modules.planning` (string) remplacé par deux booléens indépendants `modules.calendrier` et `modules.estimation` — les deux peuvent être actifs simultanément. UI Paramètres : 2 checkboxes "Je planifie certaines affaires dans un calendrier" / "J'estime le temps nécessaire sur mes affaires". Sessions : champ `heures` optionnel auto-calculé (`joursOuvrésSemaine × heuresParJour`), affichage `~Xh` (auto) vs `Xh` (perso). Taux de remplissage passe en mode heures si toutes les sessions ont `heures > 0`. Barres de charge journalières dans le calendrier (vert/orange/rouge). KPI planning adapté : "Heures planifiées" vs "Jours planifiés". Helpers `joursOuvrésSemaine`, `getChargeJour` dans planning.js et unified.js. Migration automatique depuis l'ancienne clé `modules.planning`. **Règle architecturale préservée** : session.heures = temps prévu uniquement — jamais additionnée au temps réel (`getMissionHeures` inchangé, `confirmFacturation` seule écriture du réel).
- **TVA mode déclaration (2026-07)** : ajout d'un choix "Mode de déclaration de TVA" dans les Paramètres (onglet Fiscalité). Deux options : "Encaissements" (TVA due quand le client paie — services) et "Débits" (TVA due à l'émission de la facture — livraisons). Nouvelle fonction `getTVACollecteeMois(mk)` dans `calculs.js` qui dispatche vers `getTVACollecteeEncaissementsMois` ou `getTVACollecteeDebitsMois` selon `DATA.params.tvaMode`. Bridge `unified.js` mis à jour. Nouvelle clé `DATA.params.tvaMode : 'encaissements' | 'debits'` (défaut : `'encaissements'`).
- **Mémoire dernière page (2026-07)** : à chaque `navigate(page)`, la page courante est sauvée dans `localStorage('indepuls_last_page')`. Au chargement (`DOMContentLoaded`), si cette clé existe et correspond à un `#page-*` existant, l'app navigue directement vers cette page au lieu du dashboard. Résout le problème F5 → retour dashboard.
- **Live update nav changement de statut (2026-07)** : `onStatutChange()` appelle désormais `updateNavRecettes()` après `recalcObjectifs()` et `renderParams()`. Le livre des recettes et les options IS/IR disparaissent immédiatement sans rechargement de page.
- **Toast cloud sync failure (2026-07)** : `syncToCloud()` affiche un toast `showToast('⚠️ Données non synchronisées…', 'var(--err)')` en cas d'exception. Critique pour informer l'utilisateur d'une perte de sauvegarde.
- **Fix navigation privée / nouveau navigateur (2026-07)** : en navigation privée, `DATA._needsProfilePick = true` faisait persister le sélecteur de profil même après connexion cloud. Fix dans `loadFromCloud()` : après chargement réussi, force `DATA._needsProfilePick = false` et masque `#screen-profile-picker`. Fix overlay : `_enterApp()` appelle `loadFromCloud(user).then(hideOverlay)` au lieu de `hideOverlay()` suivi de `loadFromCloud()` (l'overlay était masqué avant le chargement des données).
- **Modal mission "Options avancées" (2026-07)** : simplification modale nouvelle mission. Charge/semaine (`#m-charge-zone`) toujours visible (pilier Score Santé). Sessions planning (`#m-planning-zone`) masquées si `modules.calendrier` est off. Source d'acquisition et Notes déplacées dans un bloc dépliant `#m-advanced-zone` (bouton toggle `toggleMissionAdvanced()`). Le bloc s'ouvre automatiquement si la mission a déjà des données avancées OU si `modules.calendrier` est actif. Résultat : 6 champs visibles au lieu de 15+ pour un nouvel utilisateur.
- **Création de mission depuis le calendrier (2026-07)** : retour bêta-testeuse — on ne pouvait créer une mission que depuis la page Missions, jamais directement depuis une case du calendrier. Clic sur une case vide de `renderPlanning()` → `openMissionModal(null, ds)` (nouveau 2e paramètre `prefillDate`, optionnel). `initEditingSessions(m, prefillDate)` pré-remplit `editingSessions` avec `{debut: prefillDate, fin: prefillDate}` quand il n'y a pas de mission existante. `event.stopPropagation()` ajouté sur l'onclick des barres de mission existantes pour éviter le double-déclenchement (ouverture simultanée en édition + création) au clic sur une case déjà occupée. Aucun nouveau champ, aucune nouvelle donnée en base, réutilise entièrement le mécanisme de sessions existant.
- **Debounce `recalcObjectifs` (2026-07)** : ajout de `recalcObjectifsDebounced()` (350ms) pour les handlers `oninput` qui déclenchaient 3 rendus complets à chaque frappe. Les appels programmatiques (onStatutChange, saveChargeParam, changement de module) utilisent toujours `recalcObjectifs()` directement.
- **Rename "Réglages" → "Paramètres" (2026-07)** : section nav et item nav renommés. Toutes les occurrences internes cohérentes.
- **Refonte UX Paramètres — "Je décris mon activité" (2026-06)** : page Params refondée de 5 onglets techniques en 6 onglets narratifs. (1) **Mon activité** : prénom, date de lancement, profil "Quel est votre cœur de métier ?", radio 3 choix "Que vendez-vous ?" (prestations/produits/les deux → remplace le switch `activiteMixte`), switch salariés. (2) **Comment je travaille** (nouveau) : expose `modules.*` jusque là invisibles — `planning` radio 3 choix, `uniteTemps` chips heures/journées, `devis` switch, `simulateurOffre` switch, `objectif` radio 3 choix. (3) **Fiscalité & charges** : statut, SASU, URSSAF (label "Je déclare mon CA à l'URSSAF" mensuel/trimestriel), TVA, impôt, livre des recettes. (4) **Mes objectifs** inchangé. (5) **Mes offres** (ex-Offres & missions). (6) **Personnalisation** (themes + données fusionnés). Nouvelles fonctions : `saveModuleParam(key,val)`, `renderModulesUI()`, `saveActiviteType(type)`, `renderActiviteTypeUI()`, `onProfilChange(metier)`, `confirmProfilChange(withModules)`, `cancelProfilChange()`. Modale `modal-profil-change` : à chaque changement de profil, propose "Appliquer les réglages recommandés" (reset modules) ou "Conserver mes réglages actuels" (garde modules). `applyProfile(metier, applyModules=true)` — `applyModules=false` ne touche pas `DATA.params.modules`. Aucune modification de DATA ni des calculs.

## Points d'attention

### Interface unifiée — `indepuls.html` est le seul fichier à maintenir
`indepuls_freelance.html` et `indepuls_artisan.html` sont des archives. Ne plus les modifier. Tout bug ou feature va dans `indepuls.html` + `shared/core/` uniquement.

### Module Affaires — `shared/core/affaires.js`

Ce module répond à : **"Cette affaire est-elle rentable ?"** Il ne contient aucun calcul de flux mensuel (→ `calculs.js`), aucune logique de planning (→ `planning.js`), aucun rendu HTML.

**Clé de liaison :** `DATA.depenses[].chantierId` rattache une dépense à une affaire (chantier / mission / commande / prestation). Ce nom de champ technique ne doit pas être renommé — il est encapsulé derrière `getDepensesAffaire`.

**Fonctions clés :**
```js
getDepensesAffaire(DATA, affaireId)        // total dépenses liées à une affaire
getDepensesAffairesMap(DATA)               // map affaireId → total (un seul passage)
excludeDepensesLiees(depenses)             // filtre !chantierId (charge structurelle)
getMargeAffaire(DATA, mission)             // montantDevis − dépenses liées
getTHReelAffaire(DATA, mission)            // marge / heures (null si 0 h)
getPctCoutAffaire(DATA, mission)           // ratio coût/CA (0–1)
getAffairesAvecCouts(DATA, missions)       // liste enrichie {m, dep, marge, h, thReel, pctCout}
getMargeMoyennePortefeuille(DATA, missions)// marge% pondérée par CA (null si aucun coût)
```

**Dépendances :** `getMissionHeures` de `calculs.js` (même pattern que `planning.js` → `calculs.js`). Pas de dépendance vers `planning.js`.

### Moteur Planning — `shared/core/planning.js`

Le domaine Planning est **séparé de `calculs.js`** (qui reste centré sur les finances). Ne pas ajouter de logique Planning dans `calculs.js`.

`getPilierRemplissage(DATA)` est le **seul point d'entrée** pour le Score Santé (pilier Remplissage), `wCapacite` (FL) et `wRemplissage` (AR). Il lit `DATA.params.modePlanning` et retourne un objet uniforme :

```js
{ score, valeur, sousTitre, diagnostic, conseil, methode,
  details: { capacite, utilise, libre, taux, unite } | null }
```

`DATA.params.modules.planning` valeurs valides : `'estime'` | `'calendrier'` | `'aucun'`. Anciennement `DATA.params.modePlanning` (migré en v29 → `modules.planning`). Toute valeur inconnue est remplacée par la valeur de `getDefaultModules(metier)`.

### `SCHEMA_VERSION` — 2 endroits à synchroniser
Si la structure de `DATA` change (nouveau champ dans `params`, nouveau tableau, etc.) :
1. `indepuls.html` — constante en haut du script principal
2. `shared/modes/unified.js` — constante `SCHEMA_VERSION`

Ne pas modifier les archives (`indepuls_freelance.html`, `indepuls_artisan.html`, `freelance.js`, `artisan.js`).

### `DATA.params.modules` — objet de comportement par profil
Depuis v29, les flags comportementaux sont regroupés dans `DATA.params.modules` :
```js
DATA.params.modules = {
  // Deux booléens indépendants depuis 2026-07 (remplacent l'ancienne string 'planning')
  calendrier:  true | false,   // page Planning visible + sessions activées dans modal-mission
  estimation:  true | false,   // champ charge estimée visible dans modal-mission
  // Les deux peuvent être true simultanément (ex: evenementiel)
  // Migration automatique : modules.planning (string) → calendrier + estimation (booléens)

  uniteTemps:  'heures' | 'jours',            // couplé à objectif : TH→heures, TJM→jours
  objectif:    'th' | 'tjm' | 'marge_commande', // pilote le KPI principal
  devis:       true | false,
}
```
Defaults par profil via `getDefaultModules(metier)`. `applyDefaults()` l'injecte si absent.
Migrations gérées automatiquement : `modePlanning` → booléens ; `modules.planning` → booléens.

**Règles d'affichage liées aux modules :**
- `modules.calendrier === true` → page Planning active, nav-planning visible, zone sessions dans modal-mission visible
- `modules.estimation === true` → `#m-charge-zone` (charge h/sem) visible dans modal-mission
- `modules.objectif === 'tjm'` → couplé automatiquement à `uniteTemps='jours'` par `saveModuleParam`
- `modules.objectif === 'th'` → couplé automatiquement à `uniteTemps='heures'`
- `modules.uniteTemps` toggle visible dans Paramètres uniquement si `objectif === 'marge_commande'`

**Ne jamais utiliser `modules.planning` (supprimé) — utiliser `modules.calendrier` et `modules.estimation`.**

### Modèle session calendrier

```js
// Structure session dans mission.sessions[]
{ debut: 'YYYY-MM-DD', fin: 'YYYY-MM-DD', heures?: number, heuresAuto?: boolean }
// heures    = durée totale estimée de la session (optionnel, rétrocompat totale)
// heuresAuto = true si calculée automatiquement (joursOuvrés × heuresParJour), false si personnalisée
// Anciennes sessions sans heures → comportement identique (taux de remplissage en jours)
```

**Source de vérité du temps — hiérarchie stricte :**

| Source | Usage | Ne jamais mélanger avec |
|---|---|---|
| `session.heures` | Temps prévu / planning / taux de remplissage | Jamais additionnée au temps réel |
| `chargeEstimee` + `chargeUnit` | Charge prévue hebdomadaire | Idem |
| `timerAccumulated` + `tempsManuel[]` | Temps réel (chrono) | Séparé du planning |
| `confirmFacturation()` | Seule écriture du temps réel final | Source autoritaire |

`getMissionHeures()` utilise uniquement : timerAccumulated + tempsManuel + heuresSaisies. **Jamais session.heures.**

**Taux de remplissage :**
- Mode `'heures'` : si **toutes** les sessions du mois ont `session.heures > 0` → taux = occupiedH / capaciteH
- Mode `'jours'` : comportement historique — jours avec ≥1 session / jours ouvrables
- Retour de `getTauxRemplissageMois` : `{mode:'heures'|'jours', taux, ouvrables, ...}`

**Helpers planning :**
```js
_joursOuvrésSemaine(debut, fin)   // inline HTML — compte lun–ven entre deux dates
joursOuvrésSemaine(debut, fin)    // export planning.js + unified.js
getChargeJour(DATA, dateStr)      // charge prévisionnelle (h) pour un jour donné
updateSessHeuresAuto()            // recalcule le champ heures dans la modale session
```

**Barres de charge journalières :** visibles dans la page Planning si sessions ont heures. Barre 3px sous chaque case : vert ≤80%, orange ≤100%, rouge >100%.

**`applyProfile(metier)`** — à appeler à chaque changement de profil. Réinitialise `DATA.params.modules` via `getDefaultModules(metier)`. Ne pas appeler `saveParam('metier', ...)` directement.
- `modules.planning === 'aucun'` → **SUPPRIMÉ**. Toutes les valeurs existantes migrées vers `'estime'`. Le temps est toujours suivi.
- `modules.objectif` → pilote le KPI principal du dashboard (`'th'` · `'tjm'` · `'marge_commande'`). Phase 1 implémentée.
- `modules.uniteTemps === 'jours'` → labels TJM au lieu de TH, simulateur en journées. Phase 2 à venir.
- `modules.devis` / `modules.simulateurOffre` → conservés dans DATA pour rétrocompat, mais **plus utilisés pour gater la nav**. Le simulateur est toujours visible (`updateNavSimulateur()` affiche toujours l'item). `page-devis` et `nav-devis` supprimés (fusionnés dans le simulateur).
- `isJours()` helper : `DATA.params?.modules?.uniteTemps === 'jours'`
- `updateNavPlanning()`, `updateNavSimulateur()` : appelés dans `applyVocabUI()`. `updateNavDevis()` supprimé.
- Modal-mission : "Type de mission" (collectif) visible seulement si `BUSINESS_PROFILE_MAP[metier] === 'service'`

La fonction `migrate()` dans `storage.js` est idempotente — elle n'a pas de blocs conditionnels par numéro de version. Incrémenter la constante est donc sans risque, mais reste nécessaire pour que les données importées (backup JSON) soient reconnues comme compatibles.

### Bridge artisan : `isActiviteMixte` manquant (archives uniquement)
Dans les fichiers archivés, `window.isActiviteMixte` est absent du bridge artisan. Sans objet pour `indepuls.html` où `unified.js` l'expose correctement.

### `sync()` avant chaque appel bridgé
Le module ESM maintient sa propre variable `DATA` en mémoire. Si le script principal mute `DATA` (ex : l'utilisateur change un paramètre, on appelle `saveData()`), le module ne le sait pas. Le `sync()` en tête de chaque wrapper du bridge corrige ça en appelant `Mode.setData(DATA)`. **Ne jamais appeler une fonction bridgée sans sync préalable**, sinon les calculs portent sur des données obsolètes.

### Règle URSSAF / impôts — base de calcul obligatoire

**URSSAF et impôts sont TOUJOURS calculés sur le CA brut encaissé, jamais sur la marge.**

Les dépenses liées (fournitures, frais de chantier, coûts directs) ne réduisent pas l'assiette sociale ou fiscale des micro-entrepreneurs.

Fonctions correctes à utiliser :
- URSSAF : `getUrssafAnnuelBrut()` / `getUrssafProvisionMensuelle()` (via bridge)
- Impôts micro : `getImpotEstimeMicro(caP, caV)` ou `getRevenuImposableMicro(caP, caV)` (avec abattement forfaitaire)
- Impôts SASU : `Math.round(caBrut * getImpotsTaux())`

Ne jamais passer `marge`, `margeAffaire` ou `montant - dépenses` comme base à ces fonctions.

Dans les simulateurs (`calcSimulateur`, `calcDevis`) : base = montant HT total du devis ou du CA de l'offre, avant déduction de tout coût direct.

### Fonctions les plus complexes du dashboard
- `wKPIs()` : gère 3 cas (micro, impôts, SASU) avec des branches TVA — facile d'introduire des régressions
- `renderSasuCard()` : dépend de `getSasuProjectionFinAnnee()` qui elle-même dépend de l'ancrage bancaire optionnel
- `buildAlerts()` : try/catch autour de `getMicroPlafondInfo()` — les erreurs sont silencieuses en prod, vérifier les logs console

### Bugs récurrents — à ne pas re-investiguer

**1. Auth Supabase instable (overlay bloqué, déconnexion auto, logout cassé)**
- **Cause racine** : Supabase fire `SIGNED_IN` AVANT `INITIAL_SESSION` (ordre contre-intuitif). Avec des `if` séparés, les deux handlers s'exécutaient, `loadFromCloud` était appelé deux fois, ce qui provoquait un `SIGNED_OUT` automatique.
- **Fix en place** : machine d'état explicite (`_authState: 'init'|'app'|'login'`) avec `_enterApp()` / `_enterLogin()`. Le fallback CDN (8s) ne s'active que si `_authState === 'init'`.
- **Ne jamais revenir** aux `if` séparés sur les événements Supabase — utiliser `if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')` avec garde sur `_authState`.
- **En cas de re-régression** : chercher `_authState` dans le bloc auth et vérifier que `_enterApp` / `_enterLogin` sont les seuls points d'entrée des transitions.

**2. Dashboard blanc + `getCurrentYearMonths is not defined` (modules ES sur file://)**
- **Cause** : Chrome bloque les imports `<script type="module">` depuis `file://` → toutes les fonctions `window.*` (Mode bridge) restent `undefined`.
- **Fix** : toujours tester via `http://localhost:5391/indepuls.html` (serveur HTTP dans `.claude/static-server.js`, port 5391).
- **En cas de re-régression** : vérifier que le serveur tourne (`node .claude/static-server.js`) et utiliser l'URL HTTP, pas `file://`.

### CSS — pièges fréquents
- `.kpi-ico` est en `position:absolute; right:14px; top:14px` — il chevauche les boutons dans ce coin. Ne pas mettre de bouton en haut à droite d'une `.kpi` card
- `.g3` sur mobile ≤640px passe à 1 colonne — tester les ajouts de widgets en responsive
- Pas de scroll horizontal autorisé — `overflow-x: hidden` sur `body` dans artisan

### Tests avant push
Relancer au minimum :
```powershell
$node = "C:\Program Files\nodejs\node.exe"
& $node tests.js                      # régression calculs Freelance
& $node shared/tests/bridge_smoke.js  # vérifie que chaque window.* existe encore
```

## Système de vocabulaire métier

### Principe
Le vocabulaire affiché s'adapte automatiquement au métier sélectionné dans Paramètres. C'est une **couche d'affichage uniquement** — aucun calcul ni structure DATA ne doit être modifié pour ajouter un métier.

### Familles de vocabulaire (`VOCABULARY_FAMILIES`)

| Famille | Exemples de métiers | Terme affiché |
|---|---|---|
| `service` (défaut freelance) | OBM, coach, consultant, expert-comptable, consultant RH, juriste, traducteur, rédacteur, coach sportif, nutritionniste, sophrologue, hypnothérapeute, psychologue, développeur, CM, AV, webdesigner, architecte, conciergerie, formateur | Mission |
| `creative` | Graphiste, photographe, UGC | Prestation |
| `chantier` (défaut artisan) | Maçon, peintre, couvreur, plombier, menuisier, carreleur, serrurier, plaquiste, électricien, paysagiste, chauffagiste, multi-corps, traiteur, fleuriste | Chantier |
| `fabrication` | Fabricant / Créateur, chocolatier, pâtissier, ébéniste, créateur de bijoux, fabricant cosmétiques, fabricant bougies, tapissier, maroquinier, ferronnier | Commande |

**Règle de positionnement des modules (2026-06)** : module violet = "Je vends mon temps / expertise / prestation" → freelance ; module orange = "Je réalise des chantiers / commandes / fabrications avec achats de matières" → artisan. Traiteur et fleuriste → artisan (famille `chantier`, vocabulaire "Chantier"). Rédacteur → freelance (famille `service`, même logique qu'un consultant). Ferronnier → artisan (famille `fabrication`, logique fabrication sur mesure).

### Mapping métier → famille (`BUSINESS_PROFILE_MAP`)
Objet centralisé dans chaque HTML (clés normalisées : `obm`, `coach`, `macon`, `fabricant`, etc.). Les deux fichiers HTML doivent toujours avoir le même `BUSINESS_PROFILE_MAP` — synchroniser manuellement à chaque ajout de métier.

### Fonction helper
```js
function tVocab(key) {
  const metier = DATA.params?.metier || '';
  const family = BUSINESS_PROFILE_MAP[metier] || DEFAULT_FAMILY;
  return VOCABULARY_FAMILIES[family]?.[key] || VOCABULARY_FAMILIES[DEFAULT_FAMILY][key] || key;
}
```
`DEFAULT_FAMILY = 'service'` dans `indepuls.html` et `indepuls_freelance.html`, `'chantier'` dans `indepuls_artisan.html`.

### Migration automatique
`migrateMetierParam()` convertit les anciennes valeurs affichées (ex : `"Coach"`, `"Maçon"`) en clés normalisées (`"coach"`, `"macon"`) au premier chargement, sans perte de données.

### Règle fondamentale
**Ajouter un métier ne doit jamais conduire à créer une nouvelle application.** Il faut d'abord rattacher ce métier à une famille de vocabulaire existante via `BUSINESS_PROFILE_MAP`. Si aucune famille ne convient, créer une nouvelle famille dans `VOCABULARY_FAMILIES` — jamais un nouveau fichier HTML.

### Clés de vocabulaire disponibles
`item`, `items`, `addItem`, `newItem`, `editItem`, `itemsEnCours`, `emptyItems`, `emptyFilter`, `temps`, `client`, `rentabilite`, `navLabel`

---

## Prochains chantiers identifiés

### 0. Branchement des modules comportementaux *(en cours — priorité critique)*

Principe : **profil = défauts, modules = comportement réel, dashboard = lit les modules**.
Ne jamais utiliser la famille pour décider du comportement — utiliser `modules.*`.

**Phase 1 — `modules.objectif` pilote le KPI principal** ✅ *implémentée (2026-07)*
- Tous les écrans utilisent `modules.objectif` pour le KPI affiché : `wKPIs()`, `buildAlerts()`, bilan mensuel, `wSynopsis()`, `renderObjectifsResult()`, `renderArchives()`, `getArchYearData()`.
- `'th'` → KPI TH réel (€/h) · `'tjm'` → KPI TJM réel (€/j) · `'marge_commande'` → Gain moyen par commande

**Phase 2 — `modules.uniteTemps` pilote h vs j partout** *(à faire après Phase 1)*
- `isJours()` déjà utilisé dans missions + simulateur — étendre au dashboard
- Lier automatiquement `objectif==='tjm'` ↔ `uniteTemps==='jours'` (sans bloquer la personnalisation)

**Phase 3 — `modules.planning` contrôle complet** *(après Phase 2)*
- Supprimer toutes les références à `planning==='aucun'` (valeur supprimée)
- Migration existants `'aucun'` → `'estime'` dans `migrate()`
- Widget Remplissage / Pilier masqué si `planning==='aucun'` → remplacer par logique `'estime'`
- Modale mission : `#m-charge-zone` visible si `'estime'`, sessions si `'calendrier'`

**Évolution future : suivi du temps par affaire** *(post-bêta)*
- Chaque affaire pourrait choisir son mode : estimation heures/jours, sessions calendrier, aucun suivi détaillé
- Particulièrement utile pour les profils hybrides (photographe, traiteur, événementiel)
- À ne pas confondre avec le mode global `modules.planning`

### 1. Suivi des déclarations URSSAF *(priorité haute)*
Les micro-entrepreneurs déclarent leur CA et paient leurs cotisations chaque trimestre (ou mois s'ils ont opté pour le mensuel). Aujourd'hui Indépuls calcule les provisions mais n'indique pas *quand* déclarer ni combien exactement. Une page ou un widget "Prochaine déclaration URSSAF" avec le CA cumulé de la période et le montant à payer aurait une forte valeur pratique. À implémenter dans `calculs.js` (les données sont déjà disponibles).

### 2. Tests Artisan dans `tests.js` *(priorité haute)*
La suite principale (`tests.js`, 56 tests) ne couvre que le Freelance via un contexte VM qui charge `indepuls_freelance.html`. L'Artisan n'a pas d'équivalent — seul `bridge_smoke.js` vérifie que les fonctions existent. Un bug de calcul artisan peut passer inaperçu. Écrire `tests_artisan.js` sur le même modèle (VM + `indepuls_artisan.html`) en priorité.

### 3. Mode Artisan enrichi *(moyen terme)*
L'Artisan actuel est une adaptation du Freelance. Les besoins spécifiques BTP non couverts :
- Planning chantiers avec jalons (devis → acompte → solde)
- Gestion des sous-traitants (impact sur la marge)
- Suivi des retenues de garantie
Ces fonctionnalités iraient dans `shared/modes/artisan.js` et des widgets dédiés dans le HTML artisan.

### 4. Export / bilan mensuel PDF *(moyen terme)*
Générer un récapitulatif mensuel téléchargeable : CA, dépenses, provisions, revenu net. Utile pour les rendez-vous comptables. Faisable en JS pur via `window.print()` avec une CSS `@media print` dédiée, sans dépendance externe. Serait commun aux deux modes.

### 5. Synchronisation bancaire *(long terme)*
Connexion à un agrégateur bancaire (Bridge API, Powens…) pour réconcilier automatiquement les encaissements avec les missions. Impact fort sur la qualité des données artisan (aujourd'hui saisie manuelle des encaissements). Nécessite un backend — hors portée du vanilla actuel.

### 7. Fréquence des missions récurrentes *(post-bêta)*
Actuellement les missions récurrentes sont **mensuelles uniquement**. Ajouter : hebdomadaire, trimestriel, annuel.

**Cas d'usage identifiés :**
- Artisan entretien : passage toutes les semaines chez un client
- Prestataire : audit trimestriel ou abonnement annuel

**Complexité : modérée-haute.** Champs à ajouter : `frequence: 'hebdo'|'mensuel'|'trimestriel'|'annuel'` + `montantPeriode` (remplace `montantMensuel`).

**Points d'attention avant de démarrer :**
- Normaliser en équivalent mensuel pour tous les KPIs : hebdo × 4.33, trimestriel ÷ 3, annuel ÷ 12
- `getCaBreakdownMois` et `getCaFromMissions` dans `core/calculs.js` utilisent `montantMensuel` directement → adapter
- Encaissements : rester indexés par mois (on encaisse quand on veut), mais le label "0/12 mois encaissés" doit s'adapter (ex. "0/52 semaines")
- Modale mission : afficher le bon label (€/semaine, €/trimestre…) et recalculer le total
- Faire un test complet sur tous les profils avant de merger — risque de régression CA élevé

### 6. Accessibilité de base *(avant lancement commercial payant)*
Le RGAA n'est pas légalement obligatoire pour une app privée, mais recommandé avant la mise en vente d'abonnements. Deux niveaux :
- **Minimum (1-2h)** : associer chaque `<label>` à son `<input>` via `for="id"` ; ajouter une déclaration d'accessibilité sur le site ("accessibilité partielle, améliorations en cours")
- **Complet (plusieurs jours)** : `role="button" tabindex="0"` sur les `<div onclick>` cliquables, gestionnaire Space/Entrée sur ces éléments, `aria-label` sur les boutons icônes sans texte, `aria-expanded` sur les accordéons
À ne pas faire avant la béta — prioriser si un client le demande explicitement ou pour des appels d'offres entreprise/collectivité.
