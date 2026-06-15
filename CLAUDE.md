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

| Fichier | Rôle |
|---|---|
| `index.html` | Page d'accueil + sélection du mode (freelance / artisan) |
| `indepuls_freelance.html` | App complète mode freelance (OBM) |
| `indepuls_artisan.html` | App complète mode artisan |
| `vercel.json` | Config déploiement Vercel |

## Déploiement

- Repo GitHub : `https://github.com/indepuls/indepuls.git`
- Déploiement auto sur Vercel à chaque `git push` sur `main`
- URL prod : `indepuls.vercel.app`
- Commande de travail : `cd "C:\Users\alexb\OneDrive\Bureau\Indépuls\indepuls-repo"`

## Stack technique

- HTML/CSS/JS **vanilla** — zéro framework, zéro dépendance
- Persistance : `localStorage` via objet global `DATA`
- Pas de build step — les fichiers sont servis directement

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

## Fonctionnalités implémentées (historique)

- Score de santé : 4 piliers (rentabilité, remplissage, trésorerie, commercial), cards compactes + modal détail
- Mode SASU complet : widget rémunération recommandée, trésorerie projetée, suppression doublons KPI
- TVA unifiée : "Prochaine échéance TVA" (court terme) vs "TVA totale estimée à réserver" (annuel)
- Évolution CA pleine largeur sur mobile (3e KPI = `grid-column: 1/-1`)
- Bilan mensuel artisan : persistance via `DATA.bilanDismissed` (localStorage, pas session)
- Rémunération recommandée négative → clampée à 0 + message explicatif
- Trésorerie projetée : ancrage sur solde réel via modale `modal-treso-anchor`
- Mobile overflow fixes : `body { overflow-x: hidden }` sur artisan

## Points d'attention

- Les deux fichiers (freelance + artisan) partagent la même logique — toute modification doit être appliquée aux deux
- `SCHEMA_VERSION` dans chaque fichier — à incrémenter si la structure de `DATA` change
- Les fonctions `wKPIs()` et `renderSasuCard()` sont les plus complexes du dashboard
- Ne pas utiliser `kpi-ico` (emoji absolu) dans les cards avec des boutons en haut à droite
