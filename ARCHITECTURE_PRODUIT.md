# Indépuls — Architecture produit & Matrice fonctionnelle

> **Document de référence.** Toute nouvelle fonctionnalité doit être vérifiée contre cette matrice avant implémentation.
> Dernière mise à jour : 2026-07-24

---

## Principe directeur

Le **temps** est le dénominateur commun de tous les profils.
Ce qui change entre les profils : **ce qu'on met en avant**, pas le moteur de calcul.

Le moteur reste unique. Ce sont les indicateurs, le vocabulaire et les conseils qui s'adaptent.

### Règle de priorité : profil → modules → comportement

```
profil = vocabulaire + valeurs par défaut des modules
modules = comportement réel (choisi ou personnalisé par l'utilisateur)
dashboard/widgets = lit modules.*, jamais la famille directement
```

- **`modules.objectif`** pilote le KPI principal affiché (`'th'` · `'tjm'` · `'marge_commande'`)
- **`modules.uniteTemps`** pilote l'affichage heures vs journées partout
- ~~`modules.planning` pilote les champs temps et widgets remplissage~~ — champ mort depuis 2026-07-24 : ces champs et le pilier Remplissage sont désormais universels, voir "Modules comportementaux par défaut" et "SCORE DE SANTÉ — Pilier Remplissage"
- La **famille** détermine le vocabulaire (Mission/Chantier/Commande) et les défauts des modules — jamais le comportement final
- Un prestataire peut choisir `objectif='tjm'` s'il facture à la journée
- Un artisan peut choisir `objectif='th'` s'il préfère piloter son taux horaire

---

## Les 7 profils — 4 familles

| Profil | Famille | KPI principal | KPI secondaire | Question centrale |
|---|---|---|---|---|
| Prestataire de services | service | TH réel (€/h) | Rentabilité missions | "Est-ce que je facture assez cher mon temps ?" |
| Créatif / Communication | service | TH réel (€/h) | Rentabilité missions | idem |
| Prestataire événementiel | service | TH réel (€/h) | Remplissage calendrier | "Mon planning est-il bien rempli ?" |
| Artisan bâtiment | chantier | TJM réel (€/j) | Jours disponibles | "Mes journées sont-elles rentables ?" |
| Fabricant série | fabrication | Gain moyen par commande (€) | TH réel (€/h) | "Est-ce que je gagne assez sur chaque fabrication ?" |
| Artisan sur commande | fabrication | Gain moyen par commande (€) | TH réel (€/h) | idem |
| Achat / Revente | achat_revente | Gain moyen par vente (€) | Gain horaire réel (€/h) | "Combien je gagne réellement par vente ?" |

### Règle du temps

Le suivi du temps est **toujours actif** pour tous les profils (`planning = 'aucun'` supprimé).
Pour fabrication et achat_revente, le temps est un **indicateur secondaire** : "Cette commande valait-elle les heures passées ?"

---

## Modules comportementaux par défaut

| Profil | calendrier | estimation | uniteTemps | objectif | devis |
|---|---|---|---|---|---|
| prestataire_services | false | true | heures | th | false |
| creatif_com | false | true | heures | th | false |
| evenementiel | **true** | **true** | heures | th | false |
| artisan_batiment | **true** | false | jours | tjm | true |
| fabricant_serie | false | true | heures | marge_commande | false |
| artisan_commande | false | true | heures | marge_commande | true |
| achat_revente | false | true | heures | marge_commande | false |

> `modules.planning` (string) **supprimé** → remplacé par deux booléens indépendants `calendrier` + `estimation`.
> Les deux peuvent être actifs simultanément (ex: evenementiel).
> `modules.simulateurOffre` supprimé : le simulateur est toujours visible.
> Migration automatique depuis `planning='estime'/'calendrier'` et `modePlanning`.
> ⚠️ **`calendrier` et `estimation` sont désormais des champs morts** (2026-07-24, chantier "vue calendrier") — conservés en base uniquement pour la migration des anciennes données, mais **ne gatent plus rien à l'affichage** : "Temps planifié estimatif" et "Quand cette mission a-t-elle lieu ?" (sessions) sont tous les deux **toujours visibles**, pour toute mission, quel que soit le profil. Voir "SCORE DE SANTÉ — Pilier Remplissage" et "MODALE MISSION" plus bas pour le modèle final.

---

## Source de vérité du temps

```
Temps prévu (planning)          Temps réel (finances)
──────────────────────          ─────────────────────
session.heures                  timerAccumulated
chargeEstimee + chargeUnit      tempsManuel[]
                                confirmFacturation()  ← seule écriture finale
```

**Règle absolue :** ces deux domaines ne sont jamais additionnés automatiquement.
- `getMissionHeures()` lit uniquement le temps réel — jamais `session.heures`
- `modal-fact-confirm` est la seule porte d'entrée du temps réel final

### ⚠️ Deux "taux de remplissage" distincts, volontairement non unifiés (depuis 2026-07-24)

Ne pas confondre — l'un ne lit jamais les données de l'autre :

| | Pilier Remplissage (Score de Santé) | Taux de remplissage (vue Calendrier) |
|---|---|---|
| Fonction | `getPilierRemplissage()` | `getTauxRemplissageMois()`/`getTauxRemplissageAnnee()` |
| Source | **`chargeEstimee`/`chargeUnit` uniquement** | Sessions (`mission.sessions[]`), agrégées par jour |
| Période | h/**semaine**, snapshot temps réel | Mensuel (KPI local à la vue Calendrier) |
| Sessions/dates | Aucun effet, jamais | Déterminant — pro-ratisées si partiellement dans le mois |

Le pilier Score de Santé ne regarde donc **jamais** les sessions, quelle que soit leur présence — voir le détail dans "SCORE DE SANTÉ — Pilier Remplissage" plus bas.

### Modèle session (depuis 2026-07, étendu 2026-07-25)

```js
{ debut: 'YYYY-MM-DD', fin?: 'YYYY-MM-DD', sansFin?: boolean, jours?: number[1-7], heures?: number, heuresAuto?: boolean }
```

- Purement cosmétique pour le pilier Score de Santé (ignoré) — sert à positionner la mission sur le calendrier et à préremplir "Temps total estimé" (`computeTempsTotalEstimeFromSessions()`, indepuls.html), jamais réinjecté dans le score.
- `jours` (1=lundi..7=dimanche, défaut lun-ven) : filtre purement visuel sur les jours affichés dans le calendrier — disponible aussi bien pour une session datée que "sans fin" (`sansFin:true`, motif hebdomadaire indéfini).
- `heures` : champ legacy, affiché en lecture seule sur les sessions existantes qui en ont une (le champ n'est plus proposé à la saisie depuis le redesign 2026-07-25) — alimente encore `getTauxRemplissageMois()` (le taux de remplissage du Calendrier, pas le pilier).

---

## Matrice fonctionnelle — écran par écran

### DASHBOARD — wKPIs

> Le **KPI 2** est déterminé par `modules.objectif`, pas par la famille.
> La matrice ci-dessous montre les défauts par profil — l'utilisateur peut les changer dans Paramètres.

| Élément | `objectif='th'` | `objectif='tjm'` | `objectif='marge_commande'` |
|---|---|---|---|
| **KPI 2 (principal)** | **TH réel X/h** | **TJM réel X/j** | **Gain moyen par commande/vente X€** |
| Phrase KPI 2 | "TH réel : X/h — objectif min. X/h" | "TJM réel : X/j — objectif min. X/j" | "Gain moyen : X€ par commande" |

**Défauts par profil :**
| Profil | `modules.objectif` par défaut | Peut changer ? |
|---|---|---|
| Prestataire de services | `th` | ✅ Oui |
| Créatif / Communication | `th` | ✅ Oui |
| Prestataire événementiel | `th` | ✅ Oui |
| Artisan bâtiment | `tjm` | ✅ Oui |
| Fabricant série | `marge_commande` | ✅ Oui |
| Artisan sur commande | `marge_commande` | ✅ Oui |
| Achat / Revente | `marge_commande` | ✅ Oui |

### DASHBOARD — Bilan mensuel

| Colonne "indicateur temps/rentabilité" | service | chantier | fabrication | achat_revente |
|---|---|---|---|---|
| Aujourd'hui | TH réel X/h | **TJM réel X/j** | **Gain moyen X€** | **Gain moyen X€** |

---

### SCORE DE SANTÉ — Pilier Rentabilité (25 pts)

| | service | chantier | fabrication | achat_revente |
|---|---|---|---|---|
| Métrique | TH brut réel vs TH cible | TJM brut réel vs TJM cible | Marge brute % vs seuil | Marge brute % vs seuil |
| Valeur affichée | "X/h" | "X/j" | "X% de marge" | "X% de marge" |
| Sous-titre | "obj. min. X/h" | "obj. min. X/j" | "seuil cible X%" | "seuil cible X%" |
| Barème | ≥100%→25, ≥85%→19, ≥65%→11, <65%→4 | idem en TJM | ≥40%→25, ≥25%→19, ≥15%→11, <15%→4 | idem |
| TH en secondaire | — | — | Dans le détail du pilier | "gain horaire réel" |

> **CA net après remboursements** ✅ *implémenté (2026-07)* — fabrication + achat_revente uniquement (`modules.objectif==='marge_commande'`). `DATA.retours[]` (statut `rembourse`) est déduit du CA avant calcul de la marge — détail du pilier affiche "Ventes confirmées" / "Remboursements" (si >0) / "CA net après remboursements", jamais une marge silencieusement gonflée par une vente remboursée. Un "Taux de retour" (X% des ventes · Y% du CA remboursé) apparaît en indicateur secondaire dans le même détail, uniquement si au moins un retour existe — jamais en KPI principal. Voir `CLAUDE.md` pour le détail d'implémentation.

### SCORE DE SANTÉ — Pilier Remplissage (25 pts)

**Modèle final, définitif (2026-07-24)** — identique pour les 7 profils, aucune variation par famille ni par modules :

```
getChargeEstimeeTotal(DATA) = Σ toHeuresSem(m.chargeEstimee, m.chargeUnit)
                               pour chaque mission "en cours" (ou récurrente encore active)
                               avec chargeEstimee > 0
taux = charge (h/semaine) / capacité (h/semaine)
```

**Une seule source de vérité : `chargeEstimee`/`chargeUnit` (temps planifié estimatif, converti en h/semaine quelle que soit l'unité choisie — h/semaine, jours/mois, h/mois). Les sessions n'entrent JAMAIS dans ce calcul**, qu'elles existent ou non, quel que soit le profil. Voir `getPilierRemplissage()` dans `shared/core/planning.js`.

> Le widget est unique pour tous les profils : le pilier "Votre remplissage" de `wScoreSante()`. `wCapacite()` et `wRemplissage()` ont été supprimés comme code mort (2026-07) — ils n'étaient plus appelés par `renderDashboard()`.

> **Historique — deux tentatives antérieures, toutes deux abandonnées.** (1) Un mode `'estime'` vs `'calendrier'` par profil, remplacé par (2) une "agrégation additive" (charge estimée pour les récurrentes, sessions pour les ponctuelles, repli symétrique) — jugée après coup "trop trop complexe" par Faustine lors du chantier "vue calendrier" (2026-07-24) et entièrement remplacée par le modèle à source unique ci-dessus. `_getChargeAdditiveMois()` a été supprimée. **Ne pas réintroduire une priorité ou une fusion sessions/estimation pour ce pilier** — le sujet a été tranché deux fois. Détail complet et raisonnement dans `CLAUDE.md`.

> Ne pas confondre avec le **taux de remplissage propre à la vue Calendrier** (mensuel, basé sur les sessions) — voir "Deux 'taux de remplissage' distincts" plus haut.

---

### SIMULATEUR (toujours visible, adapté au preset)

| Champ | service | chantier | fabrication | achat_revente |
|---|---|---|---|---|
| Prix / CA | ✅ | ✅ | ✅ | ✅ |
| Temps | ✅ | ✅ | ✅ | ✅ optionnel |
| Déplacement | ❌ | ✅ | ❌ | ❌ |
| Matières premières | ❌ | ✅ | ✅ | ❌ |
| Coût d'achat | ❌ | ❌ | ❌ | ✅ |
| Frais plateforme | ❌ | ❌ | ❌ | ✅ |
| Emballages | ❌ | ❌ | ✅ | ✅ |
| Sous-traitance | ❌ | ✅ | ✅ | ❌ |
| Collectif | ✅ | ❌ | ❌ | ❌ |
| Série / lot | ❌ | ❌ | ✅ série | ✅ lot |

---

### RETOURS ✅ *implémenté (2026-07)* — fabrication + achat_revente uniquement

> Retour bêta-testeuse (Pauline, achat_revente) : le statut d'une vente/commande et le traitement d'un retour sont deux choses différentes. Une vente confirmée (`statut='fact'`) ne doit **jamais** être réécrite par un retour — elle reste confirmée, le retour est un fait séparé et tracé.

| | service | chantier | fabrication | achat_revente |
|---|---|---|---|---|
| `DATA.retours[]` (lié par `missionId`, même pattern que les recettes) | ❌ | ❌ | ✅ | ✅ |
| Statuts | — | — | `demande` / `accepte` / `rembourse` / `refuse` (4 seulement — pas d'étapes logistiques) | idem |
| Montant | — | — | Champ unique, éditable à tout moment (même après `rembourse` — permet une ristourne partielle sans reprise totale) | idem |
| Badge sur la liste | — | — | Calculé à l'affichage (retour le plus récent), jamais stocké sur la mission | idem |
| Page "Retours" | ❌ masquée | ❌ masquée | ✅ | ✅ |
| Gating | — | — | `modules.objectif==='marge_commande'` (jamais `family===`) | idem |

Détail d'implémentation, migration (`SCHEMA_VERSION` 32) et vérifications dans `CLAUDE.md`.

---

### LOTS D'INVESTISSEMENT ✅ *implémenté (2026-07)* — achat_revente uniquement

> Retour bêta-testeuse (Pauline, achat_revente) : elle achète des lots de produits groupés (coût global), puis revend chaque produit séparément. Veut suivre par lot : coût, CA, marge, retours — sans gestion de stock article par article (hors périmètre, Indépuls n'est pas un ERP d'inventaire).

| | service | chantier | fabrication | achat_revente |
|---|---|---|---|---|
| `DATA.lots[]` (`nom`, `dateAchat`, `description`, `statutManuel`, `tempsPasse`) | ❌ | ❌ | ❌ | ✅ |
| Rattachement | — | — | — | `mission.lotId` (vente→lot), `depense.lotId` (dépense→lot entier), `depense.chantierId` existant réutilisé (dépense→vente précise) |
| Statut | — | — | — | Dérivé (`Rentabilisé` si revenus nets ≥ coût total) — seule `statutManuel='cloture'` est écrite à la main |
| `getLotStats()` | — | — | — | Point d'entrée unique (coût total, CA brut, remboursements, revenus nets, résultat, % récupéré, statut), `shared/core/affaires.js` |
| `getResultatVente()` | — | — | — | Rentabilité d'une vente isolée, jamais de quote-part du lot répartie automatiquement (une perte volontaire sur une vente doit rester visible) |
| Gating | — | — | ❌ masqué | `family==='achat_revente'` explicite (vérification directe de la famille autorisée ici — la fonctionnalité n'a de sens que pour ce profil précis, contrairement à `modules.objectif` qui est partagé avec fabrication) |
| Emplacement UI | — | — | — | **Dans Dépenses** (onglet "Dépenses professionnelles"/"Achats en lots"), pas une page dédiée — v2 (2026-07-21), voir ci-dessous |

**Révision v2 (2026-07-21)** : pas de nav/page "Lots" séparée — tout vit dans un onglet à l'intérieur de Dépenses (dépenses avec `lotId` exclues de la liste générale, visibles seulement via la fiche lot). Un lot ne peut plus être créé sans sa dépense d'achat initiale (montant requis dès la création, `modal-achat-lot`) — élimine le lot à coût 0€ affiché "Rentabilisé" par erreur. Détail complet dans `CLAUDE.md`.

**Question ouverte, volontairement non tranchée (2026-07-21)** : le même besoin (achat de matières premières en gros pour une série de production, revendue unité par unité à des clients différents dans le temps) existe potentiellement pour `fabricant_serie` — structurellement proche du cas de Pauline. Fabrication a déjà "quantité produite + prix d'achat unitaire" **par commande** dans la modale mission, qui couvre le cas d'un achat dédié à une seule commande — mais pas le cas d'un même lot de matières partagé entre plusieurs commandes séparées. **Décision (Faustine, 2026-07-21) : ne pas étendre sans signal terrain d'un utilisateur fabricant_serie** — extension technique triviale le jour où ce signal arrive (élargir le gating), mais pas de valeur à anticiper sur une simple analogie sans preuve d'usage réel.

Détail d'implémentation, migration (`SCHEMA_VERSION` 33) et vérifications dans `CLAUDE.md`.

---

### MODALE MISSION / COMMANDE / VENTE

| Champ | service | chantier | fabrication | achat_revente |
|---|---|---|---|---|
| Montant (prix de vente) | ✅ | ✅ | ✅ | ✅ |
| **Prix d'achat unitaire** | ❌ | ❌ | ❌ | ✅ NOUVEAU |
| **Quantité produite** | ❌ | ❌ | ✅ NOUVEAU | ✅ |
| **Marge affichée en temps réel** | ❌ | ❌ | ✅ | ✅ |
| Coûts directs | ❌ | ✅ | ✅ | ✅ |
| Charge estimée / "Temps planifié estimatif" | ✅ toujours | ✅ toujours | ✅ toujours | ✅ toujours |
| Sessions / "Quand cette mission a-t-elle lieu ?" | ✅ toujours | ✅ toujours | ✅ toujours | ✅ toujours |
| Devis associé | ❌ | ✅ | ✅ artisan_commande | ❌ |
| Collectif (participants) | ✅ famille service | ❌ | ❌ | ❌ |
| Activité mixte | ✅ si activé | ❌ | ❌ | ✅ si activé |
| **"↩️ Signaler un retour"** (vente `statut==='fact'`) | ❌ | ❌ | ✅ NOUVEAU | ✅ NOUVEAU |

#### "Gestion du temps" — un seul modèle universel (2026-07-24, remplace la copy contextuelle par profil)

Après une version intermédiaire (copy conditionnelle selon `modules.calendrier`/`estimation`) jugée confuse, le formulaire est unifié pour toute mission, tout profil : **Temps planifié estimatif + unité** (seule donnée qui compte pour le pilier Remplissage) → **Quand cette mission a-t-elle lieu ?** (une ou plusieurs sessions, dates + jours cochés — purement cosmétique pour le calendrier, une seule infobulle explique la distinction avec le taux de remplissage du calendrier) → **Temps total estimé** (toujours visible, préempli automatiquement à partir du temps planifié × durée des sessions — ou × mois pour une récurrente — mais toujours modifiable, jamais de donnée inventée si les deux champs sources sont vides). Sessions modifiables via un bouton ✏️ (pas seulement supprimables). Détail complet dans `CLAUDE.md`.

---

### OBJECTIFS (Paramètres > Mes objectifs)

| Élément | service | chantier | fabrication | achat_revente |
|---|---|---|---|---|
| KPI résultat principal | TH minimum X/h | **TJM minimum X/j** | Gain horaire minimum X/h *(secondaire)* | Gain horaire minimum X/h *(secondaire)* |
| CA mensuel à atteindre | ✅ | ✅ | ✅ | ✅ |
| Phrase | "→ TH min. X/h" | "→ TJM min. X/j" | "→ gain horaire min. X/h" | idem |

---

### ALERTES

| Alerte | service | chantier | fabrication | achat_revente |
|---|---|---|---|---|
| Indicateur principal bas | "TH réel bas < X/h" | "TJM réel bas < X/j" | "Gain horaire insuffisant" secondaire | "Gain horaire insuffisant" secondaire |
| **Marge faible** | ❌ | ❌ | ✅ NOUVEAU | ✅ NOUVEAU |
| Objectif mensuel non atteint | ✅ | ✅ | ✅ | ✅ |
| **Masse salariale élevée** | ✅ NOUVEAU | ✅ | ✅ | ✅ |
| Retard d'encaissement | ✅ | ✅ | ✅ | ✅ |

> **Seuil masse salariale** : alerte si `chargesSalariales × 12 > 35 % du CA annuel`.

---

### ARCHIVES / HISTORIQUE

| | service | chantier | fabrication | achat_revente |
|---|---|---|---|---|
| **Indicateur principal** | TH moyen | **TJM moyen** | **Gain moyen par commande** | **Gain moyen par vente** |
| CA annuel | ✅ | ✅ | ✅ | ✅ |
| Heures / Jours | heures | jours | heures secondaire | heures secondaire |
| Phrase interprétation | "Votre TH moyen a évolué de X%" | "Votre TJM moyen…" | "Votre gain moyen par commande…" | "Votre gain moyen par vente…" |

---

## Plan d'implémentation

> **Principe** : toutes les bifurcations utilisent `modules.*`, jamais la famille directement.

### Phase 1 — `modules.objectif` pilote le KPI principal *(en cours)*
1. `wKPIs()` KPI 2 : conditionnel sur `modules.objectif` (`th` · `tjm` · `marge_commande`)
2. `buildAlerts()` : alertes "TH bas" / "TJM bas" / "marge faible" selon `modules.objectif`
3. Bilan mensuel : colonne rentabilité conditionnelle selon `modules.objectif`

### Phase 2 — `modules.uniteTemps` pilote h vs j partout
1. Dashboard KPIs : affichage `/h` vs `/j` selon `uniteTemps` (déjà dans simulateur/missions)
2. Lier `objectif==='tjm'` ↔ `uniteTemps==='jours'` automatiquement (sans bloquer la personnalisation)
3. Labels modale mission adaptés

### Phase 3 — `modules.planning` contrôle complet ❌ *superseded par le chantier "vue calendrier" (2026-07-24)*
Cette phase envisageait un affichage conditionnel (`#m-charge-zone` si `'estime'`, sessions si `'calendrier'`). Direction finale retenue, plus simple : les deux zones sont **toujours visibles** pour toute mission, plus de condition sur `modules.calendrier`/`estimation` (devenus des champs morts). Voir "SCORE DE SANTÉ — Pilier Remplissage" et "Gestion du temps" plus haut.

### Phase 4 — Modale Missions enrichie
1. achat_revente : champ "Prix d'achat unitaire" + marge temps réel
2. fabrication : champ "Quantité produite"

### Phase 5 — Archives ✅ *implémentée (2026-07)*
1. ~~Métrique principale conditionnelle selon `modules.objectif`~~ → `renderArchives` et `getArchYearData` utilisent `modules.objectif` (plus `BUSINESS_PROFILE_MAP`)
2. ~~Phrase interprétation adaptée~~ → `buildArchInterpretation` utilisait déjà `modules.objectif` correctement

### Phase 6 — Pilier Remplissage additif par mission ❌ *abandonnée, remplacée par la Phase 9*
L'agrégation additive (charge estimée pour les récurrentes, sessions pour les ponctuelles) a été implémentée puis jugée "trop trop complexe" par Faustine — entièrement remplacée par le modèle à source unique de la Phase 9. `wCapacite()` (le widget concerné par le bug d'étiquette signalé ici) reste supprimé comme code mort ; `wScoreSante()` est aujourd'hui le seul consommateur de `getPilierRemplissage()`.

### Phase 7 — Retours & vocabulaire des statuts (fabrication + achat_revente) ✅ *implémentée (2026-07)*
`DATA.retours[]`, page "Retours" + action "Signaler un retour", libellés de statut par famille (`tVocabStatut()`, valeurs internes `att`/`cours`/`ref`/`fact` inchangées), CA net après remboursements rebranché sur le pilier Rentabilité / bilan mensuel / Archives, taux de retour en indicateur secondaire. Voir "RETOURS" et "SCORE DE SANTÉ — Pilier Rentabilité" plus haut, détail complet dans `CLAUDE.md`.

### Phase 8 — Lots d'investissement (achat_revente) ✅ *implémentée (2026-07)*
`DATA.lots[]`, rattachement `mission.lotId`/`depense.lotId` (+ réutilisation de `depense.chantierId` existant), `getLotStats()`/`getResultatVente()` (`shared/core/affaires.js`), page "Lots" + fiche lot. Extension à `fabricant_serie` volontairement différée — voir "LOTS D'INVESTISSEMENT" plus haut (question ouverte). Détail complet dans `CLAUDE.md`.

### Phase 9 — Chantier "vue calendrier" ✅ *implémentée (2026-07-21 → 2026-07-24)*
Fusion complète du Planning dans la page Missions (toggle Tableau/Calendrier, responsive desktop/mobile, dernier choix persisté), missions collectives, et — après une "Phase 6" additive essayée puis explicitement défaite — **simplification radicale du pilier Remplissage à une seule source de vérité (`chargeEstimee`)** et refonte complète du formulaire "Gestion du temps" (un seul modèle universel, plus de conditionnement par `modules.calendrier`/`estimation`). Inclut aussi : données démo calendrier étendues aux 7 profils, fenêtres modales déplaçables (glisser par le titre). Détail complet, historique des versions essayées/abandonnées et vérifications dans `CLAUDE.md`.

---

## Règles de cohérence (pour les futures fonctionnalités)

1. Un fabricant ou revendeur ne voit **jamais "TH" comme KPI principal**. Il voit "Gain moyen". Le TH est secondaire.
2. Un artisan bâtiment ne voit **jamais "/h" dans les KPIs principaux**. Toujours "/j".
3. Le temps est **toujours suivi**, jamais supprimé. Il change de statut selon le profil.
4. Le simulateur est **toujours présent**. Son preset s'adapte automatiquement au profil.
5. Les alertes **utilisent le vocabulaire du profil**. Pas d'"alerte TH bas" pour un revendeur.
6. Les archives **reprennent le KPI principal du profil**. Cohérence du début à la fin.
7. Le Pilier Remplissage a **une seule source de vérité, pour tous les profils : `chargeEstimee`** (temps planifié estimatif). Les sessions/dates n'y contribuent jamais, quelle que soit leur présence — ne pas réintroduire une priorité ou une fusion sessions/estimation (déjà tranché deux fois, voir "SCORE DE SANTÉ — Pilier Remplissage").
8. Un retour/remboursement **ne réécrit jamais le statut d'une vente confirmée**. La vente reste `statut='fact'`, le retour est un fait séparé et tracé (`DATA.retours`, badge calculé à l'affichage). Le taux de retour est **toujours un indicateur secondaire**, jamais un KPI principal.
9. Un lot **ne répartit jamais automatiquement ses coûts sur les ventes qui le composent** — `getResultatVente()` n'inclut que les charges rattachées directement à cette vente. Une vente peut légitimement afficher une perte si l'utilisateur sait qu'une autre vente du même lot la compense ; le masquer par une quote-part automatique effacerait ce choix délibéré.
