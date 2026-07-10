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
- **Interface unifiée** : `indepuls.html` est le seul point d'entrée. `indepuls_freelance.html` et `indepuls_artisan.html` (archives) ont été supprimés (2026-07) — voir "Nettoyage archives Freelance/Artisan" plus bas
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
| `shared/modes/unified.js` | Pont ESM pour `indepuls.html` — STORAGE_KEY='indepuls', SCHEMA_VERSION=30 |
| `vercel.json` | Config déploiement Vercel |
| `shared/` | Logique métier partagée (core + modes + tests) — voir `shared/README.md` |
| `shared/core/calculs.js` | ~580 lignes, 54 fonctions exportées — calculs financiers uniquement |
| `shared/core/affaires.js` | Rentabilité unitaire par affaire : dépenses liées, marge, TH réel, agrégations portefeuille |
| `shared/core/planning.js` | Moteur Planning : capacité, remplissage, score — voir section dédiée ci-dessous |
| `shared/core/taux.js` | Référentiel fiscal 2026 (TVA, URSSAF, abattements, plafonds micro) |
| `shared/core/storage.js` | `applyDefaults`, `migrate`, `getDefaultData` |
| `shared/tests/abattement_micro.test.js` | 44 tests ESM — abattements, plafonds micro, prorata |
| `shared/tests/planning.test.js` | 73 tests ESM — moteur Planning, tous modes, valeurs limites |
| `shared/tests/validation.js` | 73 tests — compare fonctions HTML locales vs core |
| `shared/tests/unified_model.test.js` | 26 tests — modèle `montantDevis = prestation + vente` |
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

`indepuls.html` contient, en bas du `<body>`, un bloc `<script type="module">` qui :
1. Importe le module ESM du mode (`shared/modes/unified.js`)
2. Appelle `Mode.setData(DATA)` pour synchroniser les données du module avec `DATA` global
3. Expose les fonctions du module sur `window.*` pour que le script principal (non-module) puisse les appeler

```js
// Exemple — bloc bridge en bas de indepuls.html
import * as Mode from './shared/modes/unified.js';

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

## SCHEMA_VERSION

- `indepuls.html` est à `SCHEMA_VERSION = 30` (juin 2026 — fusion interfaces, clé localStorage unifiée `indepuls`)
- `shared/modes/unified.js` porte aussi la version 30
- `migrate()` dans `storage.js` est **idempotent** (pas de blocs conditionnels par version) — incrémenter la constante ne cause pas de migration risquée, mais reste nécessaire pour marquer un changement de structure `DATA`
- À incrémenter dans **2 endroits** : `indepuls.html` + `shared/modes/unified.js`

## Suites de tests (Node.js)

```bash
# Depuis C:\Users\alexb\OneDrive\Bureau\Indépuls\indepuls-repo
$node = "C:\Program Files\nodejs\node.exe"

& $node --experimental-vm-modules shared/tests/abattement_micro.test.js  # 44 tests abattements
& $node shared/tests/validation.js                        # 73 tests comparaison HTML/core
& $node shared/tests/unified_model.test.js                # 26 tests modèle unifié
& $node shared/tests/planning.test.js                     # 73 tests moteur Planning
```

Total : environ **216 assertions** couvrant calculs, migrations, planning et règles fiscales 2026.

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
- **Modal mission "Options avancées" (2026-07)** : simplification modale nouvelle mission. Charge/semaine (`#m-charge-zone`) toujours visible (pilier Score Santé). Sessions planning (`#m-planning-zone`) masquées si `modules.calendrier` est off. Source d'acquisition et Notes déplacées dans un bloc dépliant `#m-advanced-zone` (bouton toggle `toggleMissionAdvanced()`). Résultat : 6 champs visibles au lieu de 15+ pour un nouvel utilisateur.
  - **Révision (2026-07)** : `#m-planning-zone` (Sessions) sorti de `#m-advanced-zone` — placé juste après `#m-charge-zone`, toujours visible dès que `modules.calendrier` est actif (même logique que `#m-charge-zone` avec `modules.estimation`, indépendamment l'un de l'autre). `#m-advanced-zone` ne contient plus que Source d'acquisition + Notes, et ne s'auto-ouvre plus qu'en présence de `m.sourceAcquisition` ou `m.notes` (le calendrier n'est plus une raison de l'ouvrir, puisque Sessions n'y est plus). Évite le mur de contenu déplié par défaut pour les profils avec `calendrier` ET `estimation` actifs (ex. événementiel).
- **Fix vocabulaire sous-titre Planning (2026-07)** : le sous-titre de la page Planning affichait en dur "Carnet de commandes" quel que soit le profil, alors que `modules.calendrier` est utilisable par n'importe quelle famille (par défaut : service pour événementiel, chantier pour artisan bâtiment ; activable manuellement pour les autres via Paramètres). Remplacé par `Carnet de ${tVocab('items').toLowerCase()} — vue calendrier mensuelle`, cohérent avec le reste de l'app (ex. tooltip Sessions de la modale mission qui dit déjà "votre carnet" sans figer le mot).
- **Contraste calendrier Planning (2026-07)** : retour bêta-testeuse — le grisé week-end (`opacity:.35`) était trop marqué, adouci à `opacity:.7`. Note : le grisage week-end est purement visuel (samedi/dimanche codés en dur dans `renderPlanning()`), il ne bloque jamais l'ajout d'une mission ; `DATA.params.joursParSemaine` n'est qu'un nombre de jours, pas une liste de jours précis, donc l'app ne sait pas quels jours un utilisateur travaille réellement — au-delà du visuel, `joursOuvrésSemaine()`/`_joursOuvrésSemaine()` (calcul auto des heures de session, répartition de charge journalière) excluent aussi systématiquement samedi/dimanche, ce qui sous-compte pour un profil travaillant le week-end. Non traité ici (nécessiterait un vrai réglage "quels jours travaillés" dans Paramètres, à voir avec le chantier Pilier Remplissage additif en cours en parallèle).
  Fix contraste texte des barres de mission : `color:${c}` (couleur cyclique de `COLORS`, ex. jaune/vert clair) remplacé par `color:var(--text)` — la couleur de la mission ne sert plus qu'au fond teinté (`${c}22`) et au liseré gauche (`border-left:2px solid ${c}`), jamais au texte. Certaines couleurs du cycle avaient un contraste insuffisant selon le thème actif (10 thèmes disponibles, dont `nuit`/`dark` à fond sombre) ; `var(--text)` est garanti lisible car déjà calibré par thème pour le reste de l'UI.
- **Création de mission depuis le calendrier (2026-07)** : retour bêta-testeuse — on ne pouvait créer une mission que depuis la page Missions, jamais directement depuis une case du calendrier. `openMissionModal(id, prefillDate)` prend un 2e paramètre optionnel ; `initEditingSessions(m, prefillDate)` pré-remplit uniquement le champ `#m-sess-debut` avec `prefillDate` (pas de session créée automatiquement) — la date de fin reste à saisir par l'utilisateur, pour ne pas présumer qu'une mission créée depuis le calendrier dure 1 seul jour. **UI (v2, suite retour bêta)** : plutôt qu'un clic sur toute la case (ambigu — quelle mission modifier si plusieurs présentes le même jour ?), un bouton `+` discret est affiché en haut à droite de chaque case (`position:absolute;top:2px;right:2px`, opacité .55) → `openMissionModal(null, ds)`. Les barres de mission existantes gardent leur `onclick="openMissionModal(m.id)"` inchangé (édition directe). La case elle-même n'a plus de handler global. Aucun nouveau champ, aucune nouvelle donnée en base, réutilise entièrement le mécanisme de sessions existant.
- **Debounce `recalcObjectifs` (2026-07)** : ajout de `recalcObjectifsDebounced()` (350ms) pour les handlers `oninput` qui déclenchaient 3 rendus complets à chaque frappe. Les appels programmatiques (onStatutChange, saveChargeParam, changement de module) utilisent toujours `recalcObjectifs()` directement.
- **Missions récurrentes sans date de fin connue (2026-07)** : `nbMoisRec` était déjà optionnel côté moteur (`getCaFromMissions`, `getCaPrestaMois` dans `shared/core/calculs.js`, `isRecurringStillActive` dans `indepuls.html`, fallback `m.nbMoisRec || 9999`), mais l'UI donnait l'impression que la durée était obligatoire, et un vrai bug d'affichage existait pour ces missions. Deux correctifs :
  - **UI** : case à cocher `#m-sans-fin` ("Pas de date de fin connue") dans `#m-rec-zone`, au-dessus du champ Durée. Cochée → masque entièrement `#m-nb-mois-zone` (pas juste désactivé — évite un champ grisé inutile) et vide `#m-nb-mois-rec` ; `#m-rec-amounts-row` passe en une seule colonne (`gridTemplateColumns:'1fr'`) pour que "Montant mensuel" occupe toute la largeur ; le texte `#m-rec-alert` change ("tant que le statut reste En cours" au lieu de "pendant la durée indiquée", qui n'a plus de sens sans durée) — tout géré par `toggleMissionSansFin()`. `openMissionModal()` précoche la case si `m.isRecurring && !m.nbMoisRec`, et la réinitialise (décochée, champ visible) pour toute mission non récurrente ou nouvelle — sinon l'état restait collé d'une ouverture de modale à l'autre. `saveMission()` force `nbMoisRec = null` si la case est cochée, quelle que soit la valeur du champ (défense en profondeur, en plus du champ déjà vidé par `toggleMissionSansFin`).
  - **Bug CA à 0€ dans "Top clients"** : `wRentabClients()` et son quasi-duplicata `rentabClientsBody()` sommaient `m.montantDevis` pour les récurrentes — or `montantDevis = montantMensuel × (nbMoisRec||0)`, donc **0€** dès que `nbMoisRec` est `null`. Nouvelle fonction `getCaRecurrenteADate(DATA, m, refDate = new Date())` dans `shared/core/calculs.js` : cumule le CA réel mois par mois depuis `dateDebutRec` jusqu'à `refDate` (plafonné à `dateDebutRec + nbMoisRec` si connu), même logique diff/mois que `getCaFromMissions`. Pontée dans `unified.js` (`getCaRecurrenteADate = (m, refDate) => C.getCaRecurrenteADate(DATA, m, refDate)`) puis exposée via `window.getCaRecurrenteADate` dans le bridge `indepuls.html`. Les deux widgets clients appellent désormais cette fonction au lieu de `m.montantDevis`.
  - **Tests** : `shared/tests/unified_model.test.js` — mission récurrente `dateDebutRec` ancienne + `nbMoisRec: null`, vérifie que `getCaFromMissions`/`getCaPrestaMois` continuent de la compter des années après le début, que `getCaRecurrenteADate` cumule correctement (pas 0), le plafonnement par `nbMoisRec` quand connu, et les cas d'exclusion (0€) avant démarrage / mission non récurrente.
  - **Commentaire ajouté** (pas de changement de comportement) au-dessus du calcul du client dominant du Score Santé (`ca=(m.montantMensuel||0)*Math.min(m.nbMoisRec||12,12)`) : le plafond à 12 mois est une estimation glissante sur 1 an du poids du client (risque de concentration), pas un oubli — ne pas le remplacer par `nbMoisRec` brut.
  - **Vérifié à l'époque, bug trouvé depuis** : `isRecurringStillActive()` (`indepuls.html`) a une copie privée `_isRecurringStillActive()` dans `shared/core/planning.js` (commentée "Copie locale — les HTML gardent leur propre copie"). Les deux étaient identiques mais partageaient un bug — voir fix "un statut 'ref' exclut toujours une récurrente" plus bas. Risque de drift toujours présent si l'une est modifiée sans l'autre.
- **Fix graphiques à "1,1,1,0,0" pour un compte neuf (2026-07)** : retour bêta-testeuse — sur un compte sans aucune donnée, l'axe vertical de `drawBarChart()` (fonction générique : `chart-ca`, `chart-archives`, `chart-th-reel`) affichait des graduations absurdes (`1, 1, 1, 0, 0`). Cause : `maxV=Math.max(...allV,1)` force un plafond artificiel à 1 pour éviter une division par zéro quand toutes les données sont à 0 ; diviser ce faux "1" en 5 graduations puis arrondir chacune à l'entier donne `1, 0.75→1, 0.5→1, 0.25→0, 0→0`. Fix : nouvelle variable `hasData=Math.max(...allV,0)>0` — si aucune donnée réelle, les 5 graduations affichent `0` au lieu des valeurs dérivées du plafond artificiel. N'affecte que l'affichage des labels de l'axe, pas le tracé des barres (déjà correct, hauteur 0 si aucune donnée).
  - **Bonus (même investigation)** : le titre de la carte "Évolution taux horaire réel" (page Archives) était figé en dur, alors que le graphique affiche déjà la bonne métrique par profil (`_archKpiLbl` : TH réel / TJM moyen / Gain par commande ou vente). Titre rendu dynamique via `#chart-th-reel-title`, mis à jour dans `renderArchives()` — `Évolution ${_archKpiLbl}`. Corrige une violation de la règle ARCHITECTURE_PRODUIT.md "un fabricant ou revendeur ne voit jamais TH comme KPI principal" pour ce titre spécifiquement (le reste de la page — table, graphique — utilisait déjà `_archKpiLbl` correctement).
- **Saisie multiple de missions (2026-07)** : assistant de saisie pour rattraper rapidement un historique (ex : démarrer en juillet et rattraper janvier→juin d'un coup), accessible en permanence depuis la page Missions — pas seulement à l'onboarding. Bouton `#btn-add-mission-bulk` ("+ Ajouter plusieurs missions", `btn-out`, à côté du bouton d'accent existant) ouvre `#modal-bulk-missions` : tableau éditable en mémoire (`bulkMissionRows[]`, pattern inspiré de `editingSessions[]`/`renderEditSessions()`). Colonnes volontairement limitées : Client, Description (optionnel), Montant (€ HT — libellé statique, cohérent avec le reste de l'app qui n'a pas de toggle HT/TTC dynamique existant), Temps passé en h (optionnel), Date, Statut (mêmes options que `#m-statut`, "Facturé" présélectionné puisqu'on rattrape du passé). Pas de récurrence, sessions calendrier, activité mixte détaillée ni programme collectif — pour ces cas, `openMissionModal()` reste le chemin normal.
  - **Édition inline sans perte de focus** : chaque saisie (`oninput`/`onchange`) met à jour `bulkMissionRows[i]` directement via `updateBulkMissionField()`, sans redessiner le tableau — `renderBulkMissionRows()` n'est appelé qu'à l'ajout/suppression d'une ligne (changement structurel), jamais à chaque frappe.
  - **Validation** : `.field-invalid` (classe existante, via `markInvalid()`) appliqué aux champs Client/Montant des lignes incomplètes au moment d'enregistrer — les lignes incomplètes sont ignorées, pas bloquantes pour les autres. Toast récapitulatif si des lignes ont été ignorées ; si aucune ligne n'est valide, message d'erreur et la modale reste ouverte.
  - **Point d'attention — tempsManuel vs chargeEstimee** : `addMission()` fixe `tempsManuel:[]` en dur après le spread de l'objet passé en argument — impossible de le renseigner via l'objet initial sans modifier la signature d'`addMission()` (fonction partagée, ne pas toucher). `saveBulkMissions()` appelle donc `addMission(obj)` puis récupère `DATA.missions[DATA.missions.length-1]` (le dernier élément — sûr car JS synchrone, un seul push entre-temps) pour lui assigner `tempsManuel:[{id, date, ms: heures×3600000}]` si un temps a été saisi sur la ligne. C'est `tempsManuel` (temps réel) qui alimente `getMissionHeures()`/le TH — **jamais** `chargeEstimee` (planning prévisionnel). Toute future fonctionnalité de saisie doit respecter cette même séparation (cf. "Source de vérité du temps" dans `ARCHITECTURE_PRODUIT.md`) : ne jamais faire alimenter `chargeEstimee` par un temps réellement passé, ni l'inverse.
  - **Pas de nouveaux tests `shared/tests/`** : fonctionnalité d'assistant de saisie côté HTML, aucune nouvelle logique de calcul dans `shared/core/` — vérifié manuellement (mission avec temps → TH réel non vide ; sans temps → comportement normal ; lignes incomplètes ignorées sans bloquer les valides ; libellé montant statique).
  - **Révision (2026-07, retour bêta-testeuse)** : vocabulaire de la modale rendu dynamique par profil — bouton, titre, texte d'intro et en-tête colonne Client utilisent `tVocab('items')`/`tVocab('client')`/`tVocab('addItem')` (mis à jour dans `applyVocabUI()` pour le bouton, dans `openBulkMissionModal()` pour le reste — la modale n'étant pas toujours dans le DOM visible au moment d'`applyVocabUI()`). Placeholders "Ex : ..." des colonnes Client/Description rendus dynamiques par famille métier (`BULK_MISSION_PLACEHOLDERS`, clé = `BUSINESS_PROFILE_MAP[metier]`). Temps saisi en heures + minutes séparées (`bulk-tempsh-i`/`bulk-tempsmin-i`, mêmes ids/formule que la modale "Ajouter du temps" existante : `(h×3600+min×60)×1000`) plutôt qu'un seul champ décimal. Statut et Date conservés tels quels (pas simplifiés en "toujours Facturé" / "Date de facturation") : Statut sert aussi à la saisie rapide de missions courantes non closes, et Date sert à la fois de date de facturation et de date de référence du temps saisi — un renommage aurait été trompeur pour les statuts autres que "Facturé".
  - **Révision 2 (2026-07, toujours retour bêta)** : le tableau HTML (`<table>`/`<colgroup>`) était illisible sur mobile — colonnes trop étroites, titres qui se chevauchent, texte des exemples invisible, scroll horizontal forcé même après élargissement de la modale (les `<select>`/`<input type=date>` ont un minimum de rendu incompressible que `table-layout:fixed` ne peut pas contourner). Remplacé par une grille CSS (`.bulk-mission-head` + `.bulk-mission-row`, `display:grid` avec fractions `fr`) : ressemble à un tableau compact sur desktop (un seul en-tête, pas de libellé répété par ligne), se transforme en cartes empilées en dessous de 640px (media query dédiée, même breakpoint que les autres tableaux → cartes de l'app) — chaque champ affiche alors son propre label (`.bulk-row-label`, présent dans le DOM en permanence, juste masqué en `display:none` sur desktop) puisque le pattern `data-label::before` existant ailleurs ne fonctionne pas avec des `<input>`/`<select>` interactifs. Plus aucun scroll horizontal à aucune taille d'écran.
- **Rename "Réglages" → "Paramètres" (2026-07)** : section nav et item nav renommés. Toutes les occurrences internes cohérentes.
- **Détection d'absence sur un chrono actif (2026-07)** : retour bêta-testeuse — un chrono (mission ou "Temps interne") laissé actif pendant une mise en veille ou une fermeture complète d'onglet continuait de défiler et comptait ce temps comme travaillé, sans aucune vérification. **Principe non négociable : ne jamais modifier silencieusement le temps enregistré — toujours demander confirmation.**
  - **`getRunningTimer()`** (`DATA.missions.find(m=>m.timerRunning)`) : nouveau helper. Un seul chrono peut tourner à la fois dans tout le système (`startTimer()` arrête automatiquement tout autre chrono avant d'en démarrer un nouveau), donc ce helper suffit partout — pas besoin de gérer plusieurs chronos simultanés.
  - **Rappel généralisé** : `checkTimerReminder()`/`showTimerReminder()`/`pauseFromReminder()` ne surveillaient et n'agissaient auparavant que sur `getMgmtMission()` (Temps interne) — un chrono mission/chantier n'avait aucun rappel, et "Mettre en pause" depuis le rappel n'aurait de toute façon pas agi sur le bon chrono. Généralisés via `getRunningTimer()`. Seuil `REMINDER_THRESHOLD` abaissé de 90 min à **1h**.
  - **Suivi d'activité réelle** : écouteurs `mousemove`/`keydown`/`click`/`scroll` sur `document`, throttlés à 5s max (`_recordActivity()`), timestamp stocké dans `localStorage['indepuls_last_activity']` (pas `DATA`/`saveData()` — pour ne pas déclencher la mécanique de sauvegarde à chaque mouvement de souris ; doit aussi survivre à une fermeture complète d'onglet). Activés/désactivés via `syncActivityTracking()`, appelé chaque seconde par `startTimerInterval()` (idempotent, ne duplique jamais les écouteurs) — actifs uniquement quand `getRunningTimer()` retourne une mission.
  - **`checkTimerGapOnResume()`** : comparé `Date.now()` à `localStorage['indepuls_last_activity']` (ou à défaut `timerStart`). Si l'écart dépasse **15 min**, affiche une bannière à 3 choix (jamais d'auto-fermeture — l'utilisatrice doit trancher) : "Retirer la période d'inactivité" (`timerAccumulated += lastActivity−timerStart`, ou équivalent `addTempsInterne` pour le Temps interne), "Compter tout le temps" (`commitTimer()` normal), "Saisir manuellement" (arrête le chrono sans rien committer, puis ouvre `openCorrectTimeModal()` existante — jamais de double-comptage). Appelée depuis `visibilitychange` (`document.visibilityState==='visible'`), `window.onfocus`, et dans `DOMContentLoaded` juste après `loadData()` (couvre la fermeture complète + réouverture plus tard).
  - **Bug critique trouvé et corrigé au passage** : `window.addEventListener('beforeunload', ...)` committait *silencieusement* la totalité du temps écoulé (`commitTimer()`) à chaque fermeture d'onglet ou rechargement — ça contournait complètement le mécanisme ci-dessus pour le cas "fermeture complète" (le chrono était déjà committé avant même que `checkTimerGapOnResume()` ne s'exécute au retour), et c'était en soi une violation directe du principe "jamais de modification silencieuse". Fix : `beforeunload` ne fait plus que `saveData()` — le chrono reste marqué actif avec son `timerStart` d'origine, et `checkTimerGapOnResume()` au prochain chargement détecte l'écart normalement, que la fermeture ait duré 2 minutes ou 2 jours. Unifie proprement "mise en veille" et "fermeture complète" via le même code.
  - **Pas de nouveaux tests `shared/tests/`** : correctif de gestion de session, aucune logique de calcul financier touchée.
  - **Suivi (2026-07)** : un seul chrono pouvant tourner à la fois (`startTimer()` arrête et committe automatiquement tout autre chrono actif), mais ce changement de chrono était silencieux — aucune confirmation que l'ancien avait bien été crédité. Ajout d'un toast (`showToastIfReal`, via `formatDureeHM()` — nouveau helper `"1h30"`/`"45 min"` factorisé depuis `showTimerReminder()`/`showTimerGapBanner()`) : `"⏸ Chrono « Client » arrêté — 1h30 créditées."` (ou `"Chrono Temps interne arrêté..."`). Pas un vrai risque de double-comptage (structurellement impossible), mais rend visible un changement d'état qui passait inaperçu.
  - **Suivi 2 (2026-07, retour bêta)** : le widget chrono de la sidebar (`#sb-timer-widget`) affichait déjà dynamiquement le nom de la mission en cours (`#sb-timer-label`, déjà existant), mais les deux tooltips à côté (icône ⏱ et "?") restaient figés sur la description du "Temps interne" même quand un chrono mission/chantier/commande tournait. `updateSbTimer()` met désormais aussi à jour `#sb-timer-ico`/`#sb-timer-tip` (nouveaux ids) avec un texte contextuel citant le nom de la mission et le vocabulaire du profil (`tVocab('item')`), restaurés aux textes par défaut (`SB_TIMER_ICO_DEFAULT`/`SB_TIMER_TIP_DEFAULT`) dès qu'aucun chrono mission ne tourne. Accord grammatical géré via `BUSINESS_PROFILE_MAP` : "ce chantier" (masculin) vs "cette mission/commande/vente" (féminin) — ne pas généraliser en "cette X" partout, `chantier` est la seule exception masculine du vocabulaire.
  - **Fix .info-tip : le survol natif pouvait encore apparaître (2026-07)** : la convention de l'app est "clic pour afficher, jamais le survol" (`document.addEventListener('click', ...)` sur `.info-tip`, section "INFO-TIP" en fin de fichier). Le mécanisme existant ne retirait l'attribut `title` (→ `data-tip`) qu'**au premier clic** — donc n'importe quel `?` de toute l'app pouvait encore déclencher le tooltip natif du navigateur au survol *avant* ce premier clic. Bug préexistant, pas propre au widget chrono. Fix générique : `_stripInfoTipTitle()` retire `title` de tout `.info-tip` dès son insertion dans le DOM (passage initial + `MutationObserver` sur `document.body`), donc le survol natif ne peut plus jamais apparaître nulle part, même avant tout clic.
    **Piège associé** : `updateSbTimer()` réécrivait `ico.title`/`tip.title` à chaque appel (donc chaque seconde pendant qu'un chrono tourne) pour garder les tooltips contextuels à jour — mais réintroduire `title` à chaque tick recréait le survol natif en boucle. Pire : une fois qu'un `.info-tip` a été cliqué une première fois, le gestionnaire de clic lit `data-tip` **en priorité sur `title`** (`tip.getAttribute('data-tip') || tip.getAttribute('title')`), donc mettre à jour seulement `title` après ce premier clic rendait les tooltips dynamiques invisibles (contenu figé sur la toute première valeur). Fix : nouveau helper `_setInfoTip(el, text)` qui ne touche **jamais** `title`, seulement `data-tip` — à utiliser pour tout tooltip dont le contenu doit être mis à jour dynamiquement après le chargement initial (ne pas revenir à `el.title=...` pour ce genre de cas).
  - **Suivi 3 — bannière d'absence recentrée + durées explicites (2026-07, retour bêta)** : `showTimerGapBanner()` (la bannière "absence détectée" à 15 min, distincte du rappel léger à 1h) était en `position:fixed;bottom:24px` via la classe `.timer-reminder` — **partagée avec le petit rappel "toujours en activité ?"** à 1h (léger, auto-disparaît en 20s). Recentrer `.timer-reminder` directement aurait aussi centré ce rappel léger, ce qui n'a pas de sens pour un nudge à faible enjeu. Fix : la bannière d'absence utilise désormais les classes `.modal-ov`/`.modal` déjà employées par les vraies modales de l'app (`modal-ref-motif`, `modal-fact-confirm`…) — construite dynamiquement en JS comme avant (pas de `<div>` statique + `openModal()`), juste avec ces classNames à la place de `.timer-reminder`. Centrage + fond assombri + comportement mobile (bottom sheet) obtenus gratuitement, zéro nouveau CSS. Le rappel léger à 1h reste inchangé, toujours en bas via `.timer-reminder`.
    **Copy clarifiée** : le texte n'indiquait que la durée d'absence ("52 min"), sans le temps actif précédent ni le total en jeu — ambigu sur ce que chaque bouton représentait concrètement. Désormais : *"Vous étiez actif **1h16**, puis absent **52 min**."*, avec les durées explicites directement dans les boutons — "Retirer les 52 min d'absence" / "Compter tout le temps (2h08)" / "Saisir manuellement". `activeMs = lastActivity − timerStart` (déjà calculé par ailleurs pour le choix "remove") et `totalMs = Date.now() − timerStart` (= ce que `commitTimer()` verse pour "count") — aucun nouveau calcul, seulement de l'affichage, cohérent avec "Zéro boîte noire" (`VISION_PRODUIT.md`).
- **Refonte UX Paramètres — "Je décris mon activité" (2026-06)** : page Params refondée de 5 onglets techniques en 6 onglets narratifs. (1) **Mon activité** : prénom, date de lancement, profil "Quel est votre cœur de métier ?", radio 3 choix "Que vendez-vous ?" (prestations/produits/les deux → remplace le switch `activiteMixte`), switch salariés. (2) **Comment je travaille** (nouveau) : expose `modules.*` jusque là invisibles — `planning` radio 3 choix, `uniteTemps` chips heures/journées, `devis` switch, `simulateurOffre` switch, `objectif` radio 3 choix. (3) **Fiscalité & charges** : statut, SASU, URSSAF (label "Je déclare mon CA à l'URSSAF" mensuel/trimestriel), TVA, impôt, livre des recettes. (4) **Mes objectifs** inchangé. (5) **Mes offres** (ex-Offres & missions). (6) **Personnalisation** (themes + données fusionnés). Nouvelles fonctions : `saveModuleParam(key,val)`, `renderModulesUI()`, `saveActiviteType(type)`, `renderActiviteTypeUI()`, `onProfilChange(metier)`, `confirmProfilChange(withModules)`, `cancelProfilChange()`. Modale `modal-profil-change` : à chaque changement de profil, propose "Appliquer les réglages recommandés" (reset modules) ou "Conserver mes réglages actuels" (garde modules). `applyProfile(metier, applyModules=true)` — `applyModules=false` ne touche pas `DATA.params.modules`. Aucune modification de DATA ni des calculs.
- **Fix vocabulaire "devis" (2026-07)** : retour bêta-testeuse directe (Maryne) — le mot "devis" apparaissait dans le Pilier Commercial du Score Santé et dans les alertes "Activité en cours", alors qu'Indépuls ne permet ni de créer ni de gérer de devis (seulement missions/chantiers/commandes/ventes avec un statut). Ça laissait croire à un écran de saisie de devis inexistant. Remplacé par `tVocab('item')`/`tVocab('items')` partout dans ces deux zones (Pilier Commercial : `subComm`/`advComm`/`diagComm`, `rowsComm`, `methComm`, "Priorité du moment" ; alertes `buildAlerts()` : relance individuelle, compteur en attente, "aucune activité"). Nouveau helper `tVocabMasculin()` (juste après `tVocab()`) — `chantier` est la seule famille masculine, toutes les autres (`service`/`fabrication`/`achat_revente`) sont féminines ; utilisé pour accorder articles/adjectifs/participes (un/une, aucun/aucune, actif/active, nouveau/nouvelle, refusé/refusée, le/la, il/elle). Titre de la modale `#modal-ref-motif` rendu dynamique (`#ref-motif-title`, mis à jour dans `setMissionStatut()`) : "Chantier refusé" vs "Mission refusée". Accord singulier/pluriel également corrigé au passage (`nbDevis===1` → mot au singulier + pronom/verbe accordés, ex. "1 vente en attente — relancez-la avant qu'elle refroidisse" vs "2 ventes … relancez-les avant qu'ils refroidissent") — invisible tant que le mot était "devis" (invariable), redevenu nécessaire avec des mots variables. **Principe pour toute nouvelle fonctionnalité** : ne jamais coder en dur un mot métier ("devis", "mission", "chantier"…) dans un texte visible — toujours passer par `tVocab(key)` (+ `tVocabMasculin()` si accord grammatical requis), même pour un texte qui semble anodin ou temporaire.
  - **Hors périmètre, repéré mais non traité** : mêmes occurrences de "devis" dans `renderMissionsSummary()` (~ligne 6935-6950, cards "En attente"/"Taux de transformation"/"Pertes sèches") — même bug de mot en dur, mais widget distinct du Pilier Commercial et des alertes "Activité en cours", donc hors du périmètre de ce correctif. Egalement laissés en l'état (non liés à "devis") : le glossaire, l'onboarding, les descriptions de profil, les données de démo, le simulateur ("Tester un devis"), le champ technique `modules.devis`, et le widget "pertes sèches sur devis refusés" (~lignes 5017/8466/8538).
  - **Fait depuis** (2026-07) : occurrences de "devis" dans `renderMissionsSummary()` corrigées avec le même pattern `tVocab()`/`tVocabMasculin()` (labels "En attente", "Taux de transformation", "Pertes sèches" du panneau Statistiques). Bonus dans la même passe : `worst.art` (`pilliers` de `wScoreSante()`, "la "/"l'" selon le pilier) était toujours suivi d'un espace en dur dans les templates (`${worst.art} ${worst.n}`), donnant "l' agenda"/"l' horizon" au lieu de "l'agenda"/"l'horizon" — corrigé en mettant l'espace dans la valeur `art:'la '` elle-même et en supprimant l'espace du template (`${worst.art}${worst.n}`) ; le texte "Priorité du moment" (`Concentrer vos efforts sur <strong>la ${worst.n}</strong>`) ignorait carrément `worst.art` et écrivait "la" en dur, remplacé par `${worst.art}${worst.n}` comme les autres occurrences.
- **Fix `isRecurringStillActive()` ne filtrait pas le statut 'ref' (2026-07)** : une mission récurrente marquée "Refusée" continuait d'être comptée comme active dans la charge estimée (`getChargeEstimeeTotal`), les listes de missions actives (`wMissionsActives`, Pilier Commercial `_actives`), l'alerte "en cours" et le filtre "En cours" de la page Missions — car ni `isRecurringStillActive()` (`indepuls.html`) ni sa copie `_isRecurringStillActive()` (`shared/core/planning.js`) ne vérifiaient `m.statut`, seulement la fenêtre de dates `dateDebutRec`/`nbMoisRec`. Fix : `if (m.statut === 'ref') return false;` ajouté en tête des deux fonctions (avant toute autre vérification). **Règle** : un statut `'ref'` exclut toujours une récurrente de tout calcul d'activité, quelle que soit la fenêtre de dates — y compris quand `nbMoisRec` est `null` (fenêtre indéfinie, qui aurait sinon fait `return true` inconditionnellement).
  - **Ne pas généraliser à `'att'`** : le filtre `'att'` (En attente) reste géré au cas par cas par certains appelants (`m.statut==='cours'||m.statut==='att'||isRecurringStillActive(m)`, ex. `wMissionsActives`, alertes) — l'ajouter dans la fonction elle-même changerait leur comportement (une récurrente en attente ne doit pas forcément être traitée comme "active" partout).
  - **9 appels revérifiés dans `indepuls.html`** (`getChargeEstimeeTotal`-équivalent, `wMissionsActives` ×2, Pilier Remplissage, Pilier Commercial `_actives`, `renderMissionsSummary` En cours/Facturé, filtre Missions "En cours") **+ 2 dans `planning.js`** (`getChargeEstimeeTotal`, moteur additif) : aucun ne dépendait du bug — tous sont des vérifications "cette activité est-elle en cours" où une récurrente refusée n'a jamais eu de raison de compter.
  - **Tests** : aucun test n'encodait le comportement buggé. Ajout d'un cas explicite dans `shared/tests/planning.test.js` (bloc `getChargeEstimeeTotal`) : récurrente `statut:'ref'`, `dateDebutRec` ancienne, `nbMoisRec: null` → charge exclue (0), pour couvrir spécifiquement le cas "fenêtre indéfinie + refusée" qui était l'angle mort du bug.
- **Fix vocabulaire "devis" — vague 2 (2026-07)** : 8 occurrences supplémentaires repérées par retour bêta-testeuse, laissant croire à une fonctionnalité de gestion de devis inexistante. (1) En-tête colonne du tableau Missions `<th>Devis</th>` → `<th>Montant</th>` (colonne affiche `montantDevis`/`montantMensuel`, jamais un devis à proprement parler). (2) Texte d'onboarding étape 3 (`#onboarding-step3-desc`) — "dès l'émission du devis" → "dès la création de votre {item}", rendu dynamique dans `applyVocabUI()` comme son titre voisin (`#onboarding-step3-title`). (3) Glossaire "Taux de transformation" reformulé en langage mission générique (le glossaire entier est statique, non adapté par profil — cohérence gardée avec les autres entrées comme "Pertes sèches" qui disent déjà "missions"). (4) Modal bienvenue démo : "Tester le simulateur, des devis, des missions…" → "Tester le simulateur, ajouter des missions…" (ne liste plus "devis" comme fonctionnalité séparée). (5) Modal changement de profil : mention "devis" retirée de la liste des réglages appliqués — `modules.devis` n'est plus lu nulle part dans `indepuls.html` (vérifié par recherche), ne gate plus rien. (6) Description du profil `creatif_com` (présente 2 fois, `PROFIL_DESCRIPTIONS` et un second objet de descriptions ~ligne 3211) : "Indépuls suit vos devis" → "Indépuls suit vos missions" — texte en dur volontairement (chaque entrée de ces objets est une prose fixe par profil, pas vocab-ifiée ailleurs dans ce même objet, ex. `artisan_batiment` dit déjà "chantiers" en dur). (7) `wProjection3Mois()` : "des missions en cours ou des devis en attente" → `${tVocab('items').toLowerCase()} en cours ou en attente`. (8) "X h perdues sur devis refusés (pertes sèches)" — les deux occurrences (`wRentabClients()` en HTML + `ctx.fillText` du graphique canvas répartition temps) rendues dynamiques : `${tVocab('items').toLowerCase()} refusé${tVocabMasculin()?'s':'es'}`.
  - **Non touché, volontairement** : mêmes principes qu'en vague 1 — `montantDevis` (nom de champ technique), libellés "Montant du devis (€ HT)" (formulaire mission + Simulateur), textes TVA/versements expliquant le fonctionnement des encaissements, placeholders de champ de référence libre ("Devis signé…"), catégorie libre "Conseil / Devis" (catégorie choisie par l'utilisateur, pas une fonctionnalité), données de démo, Simulateur ("Tester un devis", `calcDevis()`, `devis-result`), `modules.devis` (champ conservé en donnée mais plus lu), widget "motif de refus" (`wMotifsRefus`, "1 devis refusé renseigné — motif") non listé dans cette vague.
  - **Règle de vocabulaire consolidée** : "devis" et "facture" restent des mots parfaitement valides dans Indépuls pour désigner un **montant**, une **référence** (ex. "Devis signé" dans un champ de référence libre), ou le **Simulateur** ("Tester un devis" = simulateur de rentabilité, une fonctionnalité réelle). Ce qui est proscrit, c'est de laisser entendre qu'Indépuls **gère des devis comme entité** (création, liste, statut de devis séparé d'une mission) — l'app ne gère que missions/chantiers/commandes/ventes avec un statut. Ne pas partir en croisade pour retirer tout "devis"/"facture" du fichier : vérifier au cas par cas si le mot décrit une fonctionnalité inexistante avant de le remplacer.
- **Nettoyage archives Freelance/Artisan (2026-07)** : `indepuls_freelance.html`, `indepuls_artisan.html`, `shared/modes/freelance.js`, `shared/modes/artisan.js` supprimés — morts depuis la fusion (2026-06), non liés depuis `index.html`, aucune dépendance depuis `indepuls.html` (qui n'importe que `shared/modes/unified.js`) ni depuis `shared/core/*.js`. Supprimés avec eux : `tests.js` (racine, chargeait `indepuls_freelance.html` en VM), `shared/tests/bridge_smoke.js` (smoke test de `modes/freelance.js`+`modes/artisan.js` contre les 2 HTML archivés), `shared/tests/phase2_sandbox.js` (comparaisons vs les 2 HTML archivés en VM). Suites de tests restantes, autonomes vis-à-vis des archives : `validation.js` (73 tests), `unified_model.test.js` (26 tests), `abattement_micro.test.js` (44 tests), `planning.test.js` (73 tests) — toutes vertes après suppression.
  - **~46 commentaires obsolètes corrigés** dans `indepuls.html` : le pattern `// {fn} → branchée sur core/calculs.js via modes/freelance.js (voir le bloc module en fin de fichier)` datait de l'architecture pré-fusion — remplacé par `via modes/unified.js` (recherche globale, tous identiques mot pour mot, vérifiés avant remplacement en masse). Le commentaire d'en-tête du bloc bridge (`<script type="module">`, fin de fichier) a été réécrit entièrement (comptages de tests obsolètes, framing "Freelance/Artisan" au lieu d'unifié).
  - **`shared/README.md`** mis à jour : section Structure (`modes/unified.js` au lieu de `freelance.js`/`artisan.js`, tests retirés de la liste), section "Lancer les tests" (3 commandes au lieu de 6).
  - **Non touché, volontairement** : `shared/core/calculs.js` contient encore quelques commentaires mentionnant `modes/freelance.js`/`modes/artisan.js` (lignes ~6, ~165-171) — expliquent une divergence de forme historique (`{presta, vente}` vs `{prestation, vente, total}`) toujours pertinente pour comprendre le choix de shape actuel de `getCaBreakdownMois`, hors du périmètre de ce nettoyage (non demandé, pas un fichier supprimé).
  - **LocalStorage `'indepuls_freelance'`/`'indepuls_artisan'`** (`indepuls.html`, logique de migration ~ligne 3480-3570 + script inline ~ligne 584) : **ne pas confondre avec les fichiers supprimés** — ce sont des noms de clés localStorage historiques, utilisés pour détecter et migrer les données d'utilisateurs qui avaient encore l'ancienne app séparée dans leur navigateur. Ne jamais supprimer cette logique, elle n'a aucun rapport avec les archives HTML/JS retirées.
  - **Vérification** : `grep -rn "modes/freelance\|modes/artisan\|indepuls_freelance\|indepuls_artisan"` ne renvoie plus, dans le code exécutable, que ces clés localStorage légitimes + un commentaire historique dans `calculs.js` — confirmé sans faux négatif avant de considérer la tâche terminée. `index.html` et `vercel.json` ne référençaient déjà aucun des fichiers supprimés.
- **Refonte dashboard — widget narratif "Votre trajectoire annuelle" + piliers enrichis (2026-07)** : objectif — remplacer les chiffres bruts façon logiciel de facturation générique par des phrases d'interprétation, supprimer les doublons entre `wKPIs` et le pilier Rentabilité, corriger l'incohérence SASU où le pilier Trésorerie pouvait afficher "aucun risque" à côté d'une trésorerie projetée déficitaire.
  - **Corrections préalables** : `bilanCard` (`indepuls.html`, "Bilan du mois précédent") sommait `t.heures||0` sur des entrées `tempsManuel` qui n'ont jamais que `{id,date,ms}` — `prevH` était donc toujours 0, `prevTH` toujours `null`, la ligne TH/TJM/gain du bilan affichait systématiquement `—`. Fix : nouveau helper partagé `getHeuresMoisMissions(mk)` (juste avant `renderDashboard()`), basé sur `.ms` et non `.heures`, réutilisé aussi par le pilier Rentabilité (voir plus bas) pour ne pas dupliquer ce calcul. — `renderSasuCard()` : `capaciteMensuelle`/`écart` divisaient un total **annuel** (CA/dépenses depuis le 1er janvier) par 12 fixe, sous-estimant la capacité mensuelle tant que l'année n'est pas terminée (ex. en février, `/12` suppose 12 mois de données alors qu'il n'y en a que 2) — pendant que `wTresorerieKPI()` calculait sa propre "trésorerie fin d'année" correctement via `getSasuProjectionFinAnnee()` (moyenne des **mois déjà écoulés**). Les deux widgets affichaient donc deux chiffres différents pour un concept en apparence identique. Fix : `renderSasuCard()` recalcule `caAvg`/`depAvg` sur les mois écoulés (même méthode que `getSasuProjectionFinAnnee()`) et réutilise directement cette fonction pour `tresoEstimee` au lieu d'une formule parallèle — accordéon détail réécrit en conséquence (solde + flux mensuel net × mois restants). Les deux widgets affichent désormais exactement le même chiffre.
  - **`wTrajectoireAnnuelle()`** (remplace `wKPIs()`, seul point d'appel dans `renderDashboard()`) : fusionne CA annuel + revenu net du mois + graphique 12 mois en un seul widget vertical (plus un `.g3` de 3 cartes). Le contenu de l'ancienne carte TH réel/TJM/marge/SASU n'a pas disparu : TH/TJM/marge étaient déjà dupliqués dans le pilier Rentabilité (rows `vRent`/`rowsRent`) et n'avaient donc rien à "déplacer" ; la partie SASU (`wTresorerieKPI()`) est fusionnée dans le pilier Trésorerie (voir plus bas). Nouveauté : phrase de diagnostic combinée en tête (croise `pctAnnuel`/`annualAtPace`/`pctObj`/`caNetMois` déjà calculés, sans les recalculer, juste une nouvelle sélection de phrase par-dessus) ; trajectoire duale annuelle ("à ce rythme" existant + nouveau "en reproduisant votre meilleur mois", cherché dans `chart12` filtré sur les mois réalisés — `chart12` porte désormais un champ `mk` par entrée pour permettre cette recherche) ; trajectoire duale mensuelle (comparaison "au jour J" vs meilleur mois au même jour, **basée sur le CA encaissé et non le revenu net** — les revenus ponctuels (`autresList`) et les charges n'ont pas de date au jour près dans le modèle de données, comparer un "net" partiel aurait été trompeur). Nouvelle fonction `getCaMissionsADate(mk, jour)` : part de `getCaFromMissions(mk)` (moteur existant, gère déjà les récurrentes en entier dès actives) puis soustrait les encaissements ponctuels datés après le jour de comparaison — pas de duplication de la logique de détection des récurrentes.
  - **`DATA.archives` n'a pas de détail mensuel** (vérifié dans `storage.js` et tous les points d'écriture dans `indepuls.html`) : c'est un instantané annuel plat (`{caBrut,caNet,heures,missions,manual}`), impossible d'y chercher "le meilleur mois de l'année dernière". Le repli "Pas encore assez de recul pour comparer — revenez dans quelques semaines" s'applique donc systématiquement tant que l'année en cours a moins de 3 mois réalisés (`moisR.length>=3`), jamais de fausse projection depuis les archives. Évolution de schéma (ventilation mensuelle des archives) explicitement mise hors périmètre pour l'instant.
  - **Pilier Rentabilité enrichi** : ajout d'une comparaison "ce mois-ci" (même métrique — TH, TJM ou marge — que l'annuel, jamais mélangée, seuils réutilisés à l'identique), affichée dans `diagRent` (carte) et dans une nouvelle ligne de `rowsRent` (modal détail). Heures du mois via `getHeuresMoisMissions()` + `DATA.tempsInterne[curMk]` (parallèle à `hT=hF+hI` de l'annuel). Marge du mois : nouveau calcul local `_rentCoutsMois` qui filtre `DATA.depenses`/`m.encaissements` par date du mois — `getDepensesAffairesMap()` n'étant pas filtrable par mois (somme sur toute la durée de vie de l'affaire), l'adapter aurait été plus lourd qu'un filtre direct ; simplification assumée : les dépenses **récurrentes** rattachées à une affaire (cas marginal) ne sont pas comptées dans la version mensuelle, seulement dans l'annuelle.
  - **Pilier Trésorerie enrichi** :
    - **SASU/EURL** : le score intègre désormais la trésorerie réelle projetée (`getSasuProjectionFinAnnee()`), pas seulement les impayés. Plafonné à 8/25 si projection négative, à 16/25 si positive mais inférieure aux dépenses + rémunération moyennes mensuelles (`getDepensesMoyenneMensuelle()+getSasuCoutRemuMensuel()`, même appels que dans l'ex-`wTresorerieKPI()`) — sinon le score impayés s'applique sans plafond. Contenu de `wTresorerieKPI()` (badge Solide/Fragile/Déficit, solde réel/estimé + sa source, bouton ✏️ `openTresoAnchorForm()`) entièrement fusionné : diagnostic (`diagTreso`) reçoit une ligne trésorerie en tête si problème (déficit/fragile) ou en fin si sain, nouveau paramètre optionnel `extraHTML` sur `pilierCard(...)` (7 autres call sites inchangés, défaut `''`) pour afficher le bloc solde+bouton directement sur la carte (pas seulement dans la modal, le bouton doit rester cliquable sans ouvrir "Pourquoi ce score ?"). `wTresorerieKPI()` n'a plus aucun appelant → supprimée. `renderSasuCard()` ("Rémunération recommandée") volontairement **non touchée** — widget distinct (soutenabilité de la rémunération, pas la trésorerie), toujours sa propre carte dans `renderDashboard()`.
    - **Micro/BNC/BIC** : score inchangé (toujours basé sur les impayés). Diagnostic enrichi de 3 montants **jamais mélangés** : argent dû (`mtTotalNonEnc`, existant), argent probable non garanti (reste à encaisser sur missions `statut:'cours'` non récurrentes via `getResteAEncaisser`, explicitement étiqueté "non garanti"), prochaines échéances. Missions `statut:'att'` jamais comptées comme de l'argent qui va rentrer.
    - **`getEcheancesAVenir(d)`** : logique des prochaines échéances URSSAF/TVA + provision impôts, précédemment écrite en dur dans `wProvisionsSide()`, extraite en fonction partagée (retourne `{echURSSAF,echTVA,provImpots,impotSubW,total,urssafAmt,tvaAmt,isMicro,impotsTaux}`) — réutilisée par `wProvisionsSide()` (inchangé fonctionnellement, juste refactor) et par le pilier Trésorerie. Ne pas dupliquer cette logique un 3e endroit, étendre cette fonction à la place.
  - **Layout dashboard 2 colonnes** : nouvelle classe CSS `.g2-traj` (`grid-template-columns:1.3fr 1fr`, + override `1fr` dans le même `@media(max-width:768px)` que `.g2`) — **pas touché `.g2`** (classe partagée ailleurs). Piège évité : un override `grid-template-columns` en style inline aurait gagné sur la media query `.g2{grid-template-columns:1fr}` en mobile (les styles inline priment sur les règles de feuille de style, media query ou non, sauf `!important`) — d'où la classe dédiée plutôt qu'un style inline sur le bloc. Colonne 1 : `wTrajectoireAnnuelle(d)`. Colonne 2 : `wRepartitionCA(d)` + `wProvisionsSide(d)` empilés dans un wrapper `display:flex;flex-direction:column;gap:16px`. `renderSasuCard(d)` reste dans le bloc `fixed`, avant la grille 2 colonnes, inchangée.
  - **Régression trouvée et corrigée pendant la fusion** : le clic sur le mini-graphique "Évolution CA" (`onclick="navigate('revenus')"`) existait sur l'ancienne carte de `wKPIs` et avait disparu pendant la réécriture en widget narratif — restauré (wrapper cliquable autour du graphique + légende + phrase dans le nouveau widget).
  - **Vérifié** : `validation.js`/`unified_model.test.js`/`abattement_micro.test.js` toujours au vert (aucune fonction de `calculs.js` touchée). Testé manuellement en navigateur : micro-BNC avec facture en retard (3 montants distincts corrects), SASU avec solde réel saisi (bouton ✏️ → modale → sauvegarde → re-render immédiat avec le nouveau solde, projection et score recalculés), activité mixte/marge (pilier Rentabilité mensuel cohérent avec l'annuel). Layout 2 colonnes vérifié desktop (ratio 1.3:1 réel mesuré) et mobile (collapse 1 colonne sans chevauchement).
- **Fix taux de charges SASU/EURL non réinitialisé (2026-07)** : `onStatutChange(val)` forçait déjà `coutRemunerationPct` à 45 % en passant en EURL (`if(!DATA.params.coutRemunerationPct||DATA.params.coutRemunerationPct===80) ...=45`), mais n'avait **aucune logique symétrique** au passage en SASU — un aller-retour EURL→SASU gardait le taux EURL (45 %) au lieu de revenir à 80 %, le champ "Charges sociales sur ma rémunération" affichait alors une valeur incohérente avec le statut sélectionné. Fix : même garde ajoutée dans la branche `val==='sasu'` (`if(!DATA.params.coutRemunerationPct||DATA.params.coutRemunerationPct===45) ...=80`). Une valeur personnalisée par l'utilisateur (ex. 65 %) n'est jamais écrasée dans un sens ni dans l'autre — seul un taux resté exactement au défaut de l'*autre* statut est corrigé. Vérifié : EURL(45)→SASU→80, SASU(80)→EURL→45, valeur custom (65) préservée dans les deux sens.
- **Charges de rémunération et TVA absentes de plusieurs widgets SASU/EURL (2026-07)** : trois trous liés, tous du même type — un coût réel non soustrait, rendant plusieurs chiffres faussement optimistes. Signalés par retour bêta-testeuses (SASU + EURL actives).
  - **`wRepartitionCA()`** (`rep(isAn)`) : `urssaf` était codé en dur à `0` pour `isSASU()` — le donut "Où part votre CA ?" ignorait totalement la rémunération, qui pouvait représenter la majorité du CA. Fix : `getSasuCoutRemuMensuel()`, ×1 en vue mensuelle, ×`mc` (mois réellement écoulés, jamais ×12 fixe — même piège que `getSasuProjectionFinAnnee()`) en vue annuelle puisque `ca` y est le CA encaissé depuis le 1er janvier, pas une projection. **Renommage de label pour SASU/EURL uniquement** : "Disponible pour vous" → "Disponible pour l'entreprise" (légende, centre du donut "pour la société", phrase "Pour 100€ encaissés...") — une fois la rémunération déduite (déjà "pour vous"), le reste est de la trésorerie d'entreprise, pas un revenu personnel. Micro/BNC/BIC inchangé.
  - **`renderSasuCard()` — carte "Rémunération recommandée" non comparable à la cible** : `capaciteMensuelle` (brut, avant charges) s'affichait dans le même format `/mois` que "Rémunération cible" (nette) — pouvait sembler *meilleur* que la cible alors que le badge affichait "Non soutenable" juste au-dessus (contradiction visuelle directe vue par Faustine : 1 885€ "recommandé" à côté de 1 800€ cible, badge rouge). Le calcul de `ecart`/`statut`/`badgeLbl`/messages n'a pas changé (déjà correct — compare capacité brute au coût chargé). Fix d'affichage seulement : label renommé "Capacité brute mensuelle", `kpi-sub` ajouté avec l'équivalent net (`capaciteMensuelle/(1+coutRemunerationPct/100)`, ex. "≈ 1 442 € net après charges") pour une vraie base de comparaison.
  - **Accordéon détail — ligne "Flux mensuel net" sans valeur, et la somme des lignes ne reconstituait pas le total** : bug structurel au-delà du `<span>` manquant — les 3 lignes "CA moyen mensuel / Dépenses moyennes / Rémunération" étaient des **moyennes mensuelles non multipliées**, tandis que la ligne finale "Flux mensuel net × N mois" était censée porter, seule, la multiplication par `moisRestants` — un utilisateur additionnant les lignes de haut en bas comptait donc le flux **deux fois** (une fois via les 3 lignes mensuelles, une fois via la ligne flux×N). Fix : les 3 lignes affichent désormais directement leur **projection sur les mois restants** (`caAvg×moisRestants`, `depAvg×moisRestants`, `coutRemuMensuel×moisRestants`, avec le taux mensuel rappelé dans le label) — une somme naïve de haut en bas reconstitue maintenant le total à quelques euros près (écart résiduel = arrondi d'affichage par ligne, normal). Piège rencontré en cours de route : signe en double (`'−'+fmtE(valeur négative)` → `−-2 597 €`) — toujours passer une valeur positive à `fmtE()` et laisser le signe `+`/`−` du helper `row()` porter le sens, jamais les deux.
  - **`getSasuProjectionFinAnnee()` (`shared/core/calculs.js`) ignorait totalement la TVA** : aucun terme TVA dans la projection de trésorerie fin d'année, alors qu'une TVA à venir peut dépasser le solde projeté lui-même. Nouvelle fonction exportée **`getTvaAVenirFinAnnee(DATA)`** (bridgée dans `unified.js` + `window.*`, même pattern que `getSasuProjectionFinAnnee`) — **piège évité, validé après relecture croisée** : la TVA **annuelle totale** n'est PAS la bonne valeur à soustraire (si elle est payée à échéance comme le régime l'impose, les mois déjà réglés ne sont plus dus) — c'est un **encours qui tourne**, pas une dette qui s'accumule sur les mois restants. Un seul terme par régime (`getTvaRegime(DATA)`), jamais multiplié par `moisRestants` sauf le trimestriel :
    - **mensuel** (régime forcé pour `statut==='sasu'`, possible aussi en EURL) : TVA collectée − déductible du **dernier mois écoulé** seulement (encours à taille constante : collecté en M, dû le 25 de M+1).
    - **trimestriel** : **pas** le cumul du trimestre en cours à la date d'appel (`getNextTVAEcheance()` ne renvoie qu'une fraction de trimestre) — au 31/12 le trimestre en cours (T4) sera complet, donc moyenne mensuelle de TVA nette sur les mois déjà écoulés × 3.
    - **simplifié** : acomptes de juillet (55 %) et décembre (40 %) de `getTVACollecteeAnnuelle−getTVADeductibleAnnuelle` — **les deux** si on est avant juillet (tous deux tombent avant le 31/12), seul celui de décembre si on est après (piège initial : ne prendre que "le prochain acompte" sous-comptait celui de juillet quand on regarde avant juillet).
    - **franchise** : 0.
    - Logique reconstruite dans `calculs.js` (DATA-first, testable) plutôt que de migrer `getNextTVAEcheance()` (vit dans `indepuls.html`, utilise `new Date()` directement, pas le pattern `DATA` en premier paramètre) — séparation volontaire, pas une duplication.
    - **Limite assumée** : aucun historique des paiements de TVA réellement effectués dans le modèle de données — si l'utilisatrice a du retard accumulé sur plusieurs mois/trimestres, ce chiffre sous-estime l'encours réel. Pas de solution possible sans tracer les paiements.
    - **Conséquence attendue, pas une régression** : le score du pilier Trésorerie (plafonds `proj<0`/`proj<depMoy` de l'Étape 3 dashboard) baisse pour plusieurs profils SASU/EURL qui semblaient corrects avant — la TVA était un angle mort. `wTresorerieKPI()` ayant été fusionnée dans le pilier Trésorerie au même moment (voir chantier dashboard ci-dessus), un seul point de correction (`getSasuProjectionFinAnnee()`) profite automatiquement aux deux appelants (`renderSasuCard()` et le pilier) — vérifié : le pilier Trésorerie affiche exactement le même chiffre que `renderSasuCard()` sans aucune modification du code du pilier lui-même.
  - **Vérifié** : `validation.js`/`unified_model.test.js`/`abattement_micro.test.js` au vert. Testé en navigateur : SASU régime mensuel, EURL régime trimestriel (formule vérifiée à la main : moyenne × 3 = valeur exacte retournée) et régime simplifié avant/après juillet (`Date` mocké temporairement pour tester la branche "avant juillet" — les deux acomptes bien sommés), franchise (TVA désactivée → 0), avec et sans `soldeReel` saisi, Micro/BNC confirmé inchangé (donut, pas de `renderSasuCard`). Somme de l'accordéon détail reconstituée à la main sur un jeu de données réel : écart de 1€ (arrondi d'affichage), cohérent avec le total affiché.
- **Ajustement Fix 2 — "Rémunération recommandée" recalibrée en net (2026-07)** : retour direct sur le fix précédent — le chiffre net (`capaciteNetteEquiv`, la vraie réponse à "à ce rythme, combien puis-je réellement me payer ?") était relégué en petit `kpi-sub` sous "Capacité brute mensuelle" (le chiffre brut, non actionnable pour une décision de salaire). Hiérarchie inversée : `capaciteNetteEquiv` devient le `kpi-val` principal sous le label **"Rémunération idéale possible"**, le brut passe en `kpi-sub` ("X € brut / mois").
  - **"Écart" recalibré en net−net** : `ecartNet = capaciteNetteEquiv − remuNet` (au lieu de `capaciteMensuelle − coutRemuMensuel`, un brut contre un coût chargé — pas directement lisible comme "de combien ajuster mon salaire").
  - **Seuils du badge (`statut`) volontairement non touchés** : identité algébrique exacte `ecartNet = ecart / (1 + coutRemunerationPct/100)` (démontrée et vérifiée en navigateur : -638 = -1149/1.8 au signe et à l'arrondi près) — le seuil `-500` reste comparé à `ecart` **brut**, inchangé. Conséquence : la sensibilité du badge est *prouvée* identique à avant, pour n'importe quel taux de charges (45 %, 80 %, ou une valeur personnalisée) — pas une simple approximation recalée sur l'exemple à 80 % de la capture. Convertir le seuil séparément en base nette (ex. figer `-500/1.8` en dur) aurait été faux pour tout autre taux de charges — piège explicitement évité.
  - **Cohérence des messages texte avec les KPI** : `msgPrincipal` (branches `'ok'` et `'warn'`) reformulé en net (`ecartNet`, `margeAnNet`) pour ne pas afficher un chiffre différent de la carte "Écart" juste au-dessus (`+112 €` de marge à l'écran doit correspondre au `+112 €` du texte, pas à un `+X€` brut différent). **`moisTenue`/`moisAvantNeg` restent en brut** : ils comparent à `soldeBase`, une trésorerie d'**entreprise**, mélanger avec un montant personnel net aurait été une erreur d'unités. Branche `'err'` (`caManquant`, "CA annuel manquant") laissée en brut délibérément — c'est une question distincte ("combien de CA en plus" vs "de combien ajuster mon salaire net"), le libellé le signale déjà, pas de contradiction avec le chiffre net affiché ailleurs.
  - **Vérifié** : les 3 branches (`ok`/`warn`/`err`) testées en navigateur avec des cibles de rémunération différentes — le chiffre du texte `msgPrincipal` correspond exactement à celui de la carte "Écart" dans chaque cas (+662 €, +112 €, -638 €). Fix 1 (donut) et Fix 4 (EURL trimestriel + simplifié) revérifiés avec le rendu complet de `renderSasuCard()` (pas seulement les fonctions brutes) — sommes de l'accordéon toujours cohérentes à l'euro d'arrondi près.
  - **Note "mois déjà complets" ajoutée (2026-07)** : `getSasuProjectionFinAnnee()` exclut volontairement le mois en cours de la moyenne (`pastMonths = mois < mois en cours`, pour ne pas fausser le calcul avec un mois partiel) — comportement voulu, mais la seule mention existante ("CA moyen mensuel encaissé (N mois écoulés)") était dans l'accordéon replié de `renderSasuCard()`, invisible sans clic. Une bêta-testeuse ajoutant une mission datée d'aujourd'hui et ne voyant aucun chiffre bouger pouvait légitimement croire à un bug. Phrase courte ajoutée, visible **sans clic**, à deux endroits (mêmes données, même comportement) : `renderSasuCard()` (juste après "Trésorerie prévisionnelle fin YYYY", avant l'accordéon) et le pilier Trésorerie SASU/EURL (`extraTresoHTML` dans `wScoreSante()`, juste après le solde/bouton ✏️, sur la carte elle-même — pas seulement dans la modal "Pourquoi ce score ?"). Style volontairement discret (`al-info`, même registre que "Estimations simplifiées…" déjà présent) : une précision de méthode, pas une alerte. Scopé `isSASU()` des deux côtés — Micro/BNC/BIC non concerné (pas cette mécanique de moyenne glissante).
- **Chaîne de calcul solde départ → solde actuel → projection fin d'année rendue visible (2026-07)** : les deux mêmes emplacements SASU/EURL (`renderSasuCard()` et le pilier Trésorerie) affichaient "Solde actuel estimé" et "Trésorerie prévisionnelle fin d'année" comme deux chiffres indépendants, sans montrer qu'ils dérivent l'un de l'autre — Faustine a dû demander explicitement le lien plutôt que de le lire dans l'UI. Ligne compacte ajoutée aux deux endroits, réutilisant les 3 valeurs déjà calculées ailleurs sur la même carte (aucun nouveau calcul) : `getTresorerieDepart()` → `getSasuSoldeActuelEstime()` → `getSasuProjectionFinAnnee()`.
  - **Distinction ancré/non ancré** : si `DATA.params.soldeReel` est renseigné (solde bancaire saisi via `openTresoAnchorForm()`), la chaîne passe à 2 maillons — "Solde réel du MM/AAAA : X € → Y € fin d'année" — **sans jamais mentionner "au départ"**, pour ne pas laisser croire que le solde réel se déduit du solde de départ (il l'écrase). Sans ancrage, chaîne à 3 maillons : "X € au départ → Y € aujourd'hui (estimé) → Z € fin d'année". Même logique dans les deux emplacements (`renderSasuCard()`'s `chaineTreso`, et `extraTresoHTML`/`_tresoExtraRows` du pilier Trésorerie dans `wScoreSante()`) — l'accordéon/modal détail de chacun affiche aussi la ligne "Solde au 1er janvier (départ)" seulement en l'absence d'ancrage (`!anchor`).
  - **Vérifié** : testé avec et sans `soldeReel` saisi (SASU et EURL, différents taux de charges) — la chaîne affichée correspond exactement aux 3 valeurs obtenues en appelant directement `getTresorerieDepart()`/`getSasuSoldeActuelEstime()`/`getSasuProjectionFinAnnee()`, et au contenu du modal "Pourquoi ce score ?" du pilier Trésorerie (`rowsHTML`) — aucune 4e valeur recalculée différemment. Cas ancré confirmé sans mention "au départ" dans les deux emplacements, et la ligne accordéon "Solde au 1er janvier (départ)" absente uniquement dans ce cas. `validation.js`/`unified_model.test.js` au vert (aucune fonction de `calculs.js` touchée, `indepuls.html` seul modifié).
- **Refonte carte "Rémunération recommandée" — compactée, reliée au pilier Trésorerie (2026-07)** : `renderSasuCard()` (SASU/EURL) affichait un vrai/faux en apparence contradictoire avec le pilier Trésorerie juste à côté — badge "🔴 Non soutenable" (basé sur l'écart mensuel structurel `capaciteMensuelle − coutRemuMensuel`) pendant que le pilier affichait "🟢 Aucun risque identifié" (basé sur `getSasuProjectionFinAnnee()`, qui tient compte du solde déjà en caisse). Les deux chiffres sont exacts mais répondent à des questions différentes ("ce rythme est-il tenable structurellement ?" vs "la trésorerie sera-t-elle positive fin d'année ?") — Faustine (pas de formation financière) l'a lu comme une incohérence.
  - **Titre & structure** : surtitre "🏦 Santé financière de la société" retiré, remplacé par un `card-header`/`card-title` "🏦 Rémunération recommandée" classique (même pattern que `wRepartitionCA()`/`wProvisionsSide()`), badge conservé à droite dans la même ligne. Même correctif appliqué à l'état vide (`remuNet===0`, message "aucune rémunération cible renseignée").
  - **Emplacement** : sortie du bloc `fixed` de `renderDashboard()` (n'était plus entre `wScoreSante()` et les KPIs) ; intégrée en tête de la colonne droite du `bottomRow` (`.g2-traj`), avant `wRepartitionCA()`/`wProvisionsSide()` — toujours conditionnée à `isSASU()`, les deux widgets suivants inchangés pour un profil Micro/BNC/BIC. `renderSasuCard(d)` ignore de toute façon son paramètre `d` (recalcule tout en interne), déplacer son point d'appel n'a aucun effet sur son contenu.
  - **"Rémunération cible" allégée** : passée d'une case `kpi` pleine taille à une simple ligne compacte (`1 800 €/mois nets · Paramètres`), le mot "Paramètres" cliquable (`onclick="navigate('params')"`, même pattern que la ligne 5762 existante) — une valeur saisie par l'utilisateur ne doit pas rivaliser visuellement avec un résultat calculé.
  - **"Rémunération idéale possible" + "Écart" fusionnés** : les 2 anciennes cases `kpi` côte à côte remplacées par un seul bloc phrase — `capaciteNetteEquiv` (net, comparable à la cible) en grand, puis en dessous `"${capaciteMensuelle} bruts/mois — soit ${ecartNet} d'écart avec votre cible"`. `msgPrincipal` (`ok`/`warn`/`err`) réduit pour ne plus répéter ce qui est déjà dans ce bloc : `ok` ne garde que la réserve annuelle ("Soit X € de réserve annuelle à ce rythme"), `warn` est entièrement retiré (n'apportait plus que le montant déjà affiché), `err` garde le seul CA manquant annuel (info non dupliquée ailleurs). Aucun changement de `ecart`/`ecartNet`/`statut`/`capaciteMensuelle` eux-mêmes.
  - **`msgProjection` reformulé pour nommer le contraste avec le pilier** (branches `warn`/`err` uniquement — pas de contradiction à expliquer côté `ok`, les deux widgets sont déjà d'accord) : nouvelle variable `moisCoussin = Math.floor(soldeBase / Math.abs(ecart))` (mensuel, brut — même base que le badge, pas recalibrée). Si `tresoEstimee>=0 && moisCoussin>0` : *"Le pilier Trésorerie reste serein cette année — votre solde actuel absorbe l'écart. Mais à ce rythme, ce coussin s'épuisera dans environ X mois si rien ne change."* Sinon (coussin déjà épuisé ou projection déjà négative — cas où le pilier lui-même serait déjà en alerte, donc pas de contraste à expliquer) : *"Votre trésorerie ne suffit plus à absorber cet écart à ce rythme."* Dans les deux cas, le chiffre "Trésorerie prévisionnelle fin YYYY : Z €" reste affiché à la suite, jamais supprimé.
  - **Badge, accordéon détail, calculs sous-jacents** : strictement inchangés (mêmes seuils, même contenu de l'accordéon `Voir le détail du calcul →`).
  - **Vérifié** : SASU et EURL, 3 statuts (`ok`/`warn`/`err`, y compris la sous-branche `capaciteBrute<=0`) testés en appelant `renderSasuCard()` directement avec des `DATA.params` contrôlés — texte cohérent dans chaque cas, notamment un cas réel EURL où le pilier affichait effectivement "🟢 Aucun risque identifié" (25/25) en même temps que le badge "🔴 Non soutenable" de cette carte, confirmant que la nouvelle phrase de contraste s'applique exactement au scénario signalé par Faustine. Profil Micro/BNC vérifié : colonne droite revient à 2 widgets, aucune référence résiduelle à `renderSasuCard()`. Mobile (375px) : `.g2-traj` bascule en 1 colonne, carte sans dépassement horizontal (`scrollWidth === clientWidth`). `validation.js`/`unified_model.test.js` au vert (aucune fonction de `calculs.js` touchée, `indepuls.html` seul modifié).

## Points d'attention

### Interface unifiée — `indepuls.html` est le seul fichier à maintenir
`indepuls_freelance.html` et `indepuls_artisan.html` (archives) ont été supprimés (2026-07, voir "Nettoyage archives Freelance/Artisan" plus bas). Tout bug ou feature va dans `indepuls.html` + `shared/core/` uniquement.

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

**Note (2026-07)** : `modules.planning` (string) a depuis été remplacé par deux booléens indépendants `modules.calendrier` + `modules.estimation` (voir plus bas "`DATA.params.modules` — objet de comportement par profil"). `getPilierRemplissage()` a désormais **4 branches** : `'estime'`, `'calendrier'`, `'additif'` (les deux actifs — voir ci-dessous), `'aucun'`. `wCapacite` et `wRemplissage` dans `indepuls.html` sont en réalité du **code mort** (jamais appelés par `renderDashboard()`, découvert lors du chantier additif 2026-07) — le vrai consommateur vivant de `getPilierRemplissage()` est `wScoreSante()` (pilier "Votre agenda" + sa modale détail).

**Agrégation additive (2026-07)** — `modules.calendrier` ET `modules.estimation` actifs simultanément (ex. événementiel) : plus de choix de mode global (le calendrier gagnait toujours avant ce fix), remplacé par une **somme mission par mission**, mois courant :
- Récurrente (`isRecurring=true`) : principale = `chargeEstimee` (si `statut==='cours'` ou `isRecurringStillActive`) ; repli = ses sessions sur le mois si `chargeEstimee` absent
- Ponctuelle (`isRecurring=false`) : principale = ses sessions sur le mois ; repli = `chargeEstimee` si aucune session
- Si les deux champs sont renseignés sur une mission, seul le champ principal compte — l'autre reste purement visuel, jamais additionné
- Conversion sessions (h/mois) → h/semaine : division par `joursOuvrables(mois)/joursParSemaine`, qui s'annule mathématiquement en `joursDuMois/7` (indépendant du défaut `joursParSemaine` utilisé)
- Session sans `heures` renseigné (rétrocompat) → repli `joursOccupés × heuresParJour`, jamais 0 pour une session avec une date réelle
- `resultatHSemaine(methode, cap, charge)` factorise le calcul commun aux modes `'estime'` et `'additif'` (mêmes textes/barème, seule la `charge` en amont diffère) — comportement de `'estime'` et `'calendrier'` seuls strictement inchangé
- Copy contextuelle dans la modale mission (`updateModaleMissionCopy()`, appelée depuis `toggleRecurrenceFields()`) : uniquement si les deux modules sont actifs, texte différent selon `isRecurring` — restauré aux valeurs par défaut sinon
- Détail Score Santé (`rowsRemp`/`methRemp`) adapté aux 3 méthodes réelles (`estime`/`calendrier`/`additif`) au lieu d'un texte figé "h/sem" — bug préexistant pour le mode calendrier pur (`unite` pouvait être `'j'`) corrigé au passage
- Voir `ARCHITECTURE_PRODUIT.md` § "Agrégation additive par mission" et § "Copy contextuelle" pour la spec produit complète
- **Point d'attention déploiement** : recalcule différemment des données existantes — des utilisateurs hybrides (calendrier+estimation) verront leur taux de remplissage changer sans avoir touché à rien (avant : calendrier gagnait toujours ; après : somme des deux). Comportement voulu, mais à accompagner d'une communication si nécessaire.

### `SCHEMA_VERSION` — 2 endroits à synchroniser
Si la structure de `DATA` change (nouveau champ dans `params`, nouveau tableau, etc.) :
1. `indepuls.html` — constante en haut du script principal
2. `shared/modes/unified.js` — constante `SCHEMA_VERSION`

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
& $node shared/tests/validation.js         # régression calculs vs originaux HTML
& $node shared/tests/unified_model.test.js # modèle unifié montantDevis
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
Objet centralisé dans `indepuls.html` (clés normalisées : `obm`, `coach`, `macon`, `fabricant`, etc.).

### Fonction helper
```js
function tVocab(key) {
  const metier = DATA.params?.metier || '';
  const family = BUSINESS_PROFILE_MAP[metier] || DEFAULT_FAMILY;
  return VOCABULARY_FAMILIES[family]?.[key] || VOCABULARY_FAMILIES[DEFAULT_FAMILY][key] || key;
}
```
`DEFAULT_FAMILY = 'service'` dans `indepuls.html`.

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

### 3. Besoins spécifiques BTP (profil `chantier`) *(moyen terme)*
Le profil `chantier` (famille artisan bâtiment) est une adaptation du modèle générique. Besoins spécifiques BTP non couverts :
- Planning chantiers avec jalons (devis → acompte → solde)
- Gestion des sous-traitants (impact sur la marge)
- Suivi des retenues de garantie
Ces fonctionnalités iraient dans `shared/core/` (nouvelle logique métier) + widgets dédiés dans `indepuls.html`, conditionnés par famille/`modules.*` comme le reste de l'app.

### 4. Export / bilan mensuel PDF *(moyen terme)*
Générer un récapitulatif mensuel téléchargeable : CA, dépenses, provisions, revenu net. Utile pour les rendez-vous comptables. Faisable en JS pur via `window.print()` avec une CSS `@media print` dédiée, sans dépendance externe. Commun à tous les profils.

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
