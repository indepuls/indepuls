# Indépuls — Architecture produit & Matrice fonctionnelle

> **Document de référence.** Toute nouvelle fonctionnalité doit être vérifiée contre cette matrice avant implémentation.
> Dernière mise à jour : 2026-07

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
- **`modules.planning`** pilote les champs temps et widgets remplissage
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
- `session.heures` alimente le taux de remplissage et peut pré-remplir la suggestion de clôture
- `modal-fact-confirm` est la seule porte d'entrée du temps réel final

### Modèle session (depuis 2026-07)

```js
{ debut: 'YYYY-MM-DD', fin: 'YYYY-MM-DD', heures?: number, heuresAuto?: boolean }
```

- `heures` absent → rétrocompat totale (taux de remplissage en jours)
- `heures > 0` → taux en heures si **toutes** les sessions du mois en ont
- `heuresAuto` → distingue valeur auto (joursOuvrés × heuresParJour) vs personnalisée

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

### SCORE DE SANTÉ — Pilier Remplissage (25 pts)

| | service | événementiel | chantier | fabrication | achat_revente |
|---|---|---|---|---|---|
| Mode | estime | calendrier | calendrier | estime | estime |
| Widget | wCapacite | wRemplissage | wRemplissage | wCapacite | wCapacite |

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

### MODALE MISSION / COMMANDE / VENTE

| Champ | service | chantier | fabrication | achat_revente |
|---|---|---|---|---|
| Montant (prix de vente) | ✅ | ✅ | ✅ | ✅ |
| **Prix d'achat unitaire** | ❌ | ❌ | ❌ | ✅ NOUVEAU |
| **Quantité produite** | ❌ | ❌ | ✅ NOUVEAU | ✅ |
| **Marge affichée en temps réel** | ❌ | ❌ | ✅ | ✅ |
| Coûts directs | ❌ | ✅ | ✅ | ✅ |
| Charge estimée (h/sem) | ✅ | ❌ | ✅ | ✅ |
| Sessions (calendrier) | ❌ | ✅ | ❌ | ❌ |
| Devis associé | ❌ | ✅ | ✅ artisan_commande | ❌ |
| Collectif (participants) | ✅ famille service | ❌ | ❌ | ❌ |
| Activité mixte | ✅ si activé | ❌ | ❌ | ✅ si activé |

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

### Phase 3 — `modules.planning` contrôle complet
1. Supprimer `planning = 'aucun'` partout + migration existants → `'estime'`
2. Widget Remplissage / Pilier masqué si `'aucun'` → retirer ce cas, toujours afficher
3. Modale mission : `#m-charge-zone` visible si `'estime'`, sessions si `'calendrier'`

### Phase 4 — Modale Missions enrichie
1. achat_revente : champ "Prix d'achat unitaire" + marge temps réel
2. fabrication : champ "Quantité produite"

### Phase 5 — Archives
1. Métrique principale conditionnelle selon `modules.objectif`
2. Phrase interprétation adaptée

---

## Règles de cohérence (pour les futures fonctionnalités)

1. Un fabricant ou revendeur ne voit **jamais "TH" comme KPI principal**. Il voit "Gain moyen". Le TH est secondaire.
2. Un artisan bâtiment ne voit **jamais "/h" dans les KPIs principaux**. Toujours "/j".
3. Le temps est **toujours suivi**, jamais supprimé. Il change de statut selon le profil.
4. Le simulateur est **toujours présent**. Son preset s'adapte automatiquement au profil.
5. Les alertes **utilisent le vocabulaire du profil**. Pas d'"alerte TH bas" pour un revendeur.
6. Les archives **reprennent le KPI principal du profil**. Cohérence du début à la fin.
