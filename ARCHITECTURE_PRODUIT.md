# Indépuls — Architecture produit & Matrice fonctionnelle

> **Document de référence.** Toute nouvelle fonctionnalité doit être vérifiée contre cette matrice avant implémentation.
> Dernière mise à jour : 2026-07

---

## Principe directeur

Le **temps** est le dénominateur commun de tous les profils.
Ce qui change entre les profils : **ce qu'on met en avant**, pas le moteur de calcul.

Le moteur reste unique. Ce sont les indicateurs, le vocabulaire et les conseils qui s'adaptent.

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

| Profil | planning | uniteTemps | objectif | devis |
|---|---|---|---|---|
| prestataire_services | estime | heures | th | false |
| creatif_com | estime | heures | th | false |
| evenementiel | calendrier | heures | th | false |
| artisan_batiment | calendrier | jours | tjm | true |
| fabricant_serie | estime | heures | marge_commande | false |
| artisan_commande | estime | heures | marge_commande | true |
| achat_revente | estime | heures | marge_commande | false |

> `planning = 'aucun'` supprimé : seules les valeurs `'estime'` et `'calendrier'` sont valides.
> `modules.simulateurOffre` supprimé : le simulateur est toujours visible, adapté au preset du profil.

---

## Matrice fonctionnelle — écran par écran

### DASHBOARD — wKPIs

| Élément | service | chantier | fabrication | achat_revente |
|---|---|---|---|---|
| KPI 1 | CA annuel HT | CA annuel HT | CA annuel HT | CA annuel HT |
| **KPI 2 (principal)** | **TH réel X/h** | **TJM réel X/j** | **Gain moyen par commande X€** | **Gain moyen par vente X€** |
| KPI 3 | Revenu net vs objectif | Revenu net vs objectif | Nb commandes + Revenu net | Nb ventes + Revenu net |
| Phrase KPI 2 | "TH réel : X/h — objectif min. X/h" | "TJM réel : X/j — objectif min. X/j" | "Gain moyen par commande : X€" | "Gain moyen par vente : X€" |

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

### Phase 1 — Dashboard + Alertes
1. Bilan mensuel : colonne "TH réel" → conditionnel (TH/h · TJM/j · Gain moyen)
2. wKPIs KPI 2 : conditionnel par famille
3. wKPIs KPI 3 : ajouter Nb commandes/ventes pour fabrication/achat_revente
4. Alerte masse salariale dans `buildAlerts`
5. Alerte "TH bas" → adaptée par famille (TJM · gain horaire secondaire)
6. Alerte marge faible pour fabrication/achat_revente

### Phase 2 — Objectifs (Paramètres)
1. `renderObjectifsResult` : TJM pour chantier, "gain horaire minimum" pour marge_commande
2. Supprimer le switch `simulateurOffre` dans l'UI Paramètres
3. Supprimer l'option `planning = 'aucun'` dans l'UI + migration existants vers `'estime'`

### Phase 3 — Score Santé
1. Pilier Rentabilité : bifurquer selon famille (TJM · Marge%)
2. Retirer le cas `planning = 'aucun'` du pilier Remplissage

### Phase 4 — Modale Missions
1. achat_revente : champ "Prix d'achat unitaire" + marge temps réel
2. fabrication : champ "Quantité produite"

### Phase 5 — Archives
1. Métrique principale conditionnelle selon famille
2. Phrase interprétation adaptée

---

## Règles de cohérence (pour les futures fonctionnalités)

1. Un fabricant ou revendeur ne voit **jamais "TH" comme KPI principal**. Il voit "Gain moyen". Le TH est secondaire.
2. Un artisan bâtiment ne voit **jamais "/h" dans les KPIs principaux**. Toujours "/j".
3. Le temps est **toujours suivi**, jamais supprimé. Il change de statut selon le profil.
4. Le simulateur est **toujours présent**. Son preset s'adapte automatiquement au profil.
5. Les alertes **utilisent le vocabulaire du profil**. Pas d'"alerte TH bas" pour un revendeur.
6. Les archives **reprennent le KPI principal du profil**. Cohérence du début à la fin.
