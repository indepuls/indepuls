# Architecture Produit — Indépuls

> Document de référence pour le développement futur.  
> Destiné aux développeurs, pas aux utilisateurs.  
> Mise à jour : juin 2026 — SCHEMA_VERSION 29

---

## Table des matières

1. [Philosophie générale](#1-philosophie-générale)
2. [Les 4 familles de vocabulaire](#2-les-4-familles-de-vocabulaire)
3. [Les 7 profils d'activité](#3-les-7-profils-dactivité)
4. [Les 4 modules fonctionnels](#4-les-4-modules-fonctionnels)
5. [Les fonctionnalités socles](#5-les-fonctionnalités-socles)
6. [Architecture technique](#6-architecture-technique)
7. [Règles d'évolution](#7-règles-dévolution)

---

## 1. Philosophie générale

### Le changement de paradigme

**Avant (v1–v2)** : deux interfaces rigides, deux moteurs séparés.

```
Freelance  ←→  Artisan
```

Chaque interface avait ses propres calculs, son propre vocabulaire, ses propres comportements. Ajouter un nouveau type d'indépendant demandait souvent de dupliquer une interface entière.

**Aujourd'hui (v3+)** : un seul moteur, une seule logique, des couches d'adaptation.

```
Famille → Profil → Modules → Moteur partagé
```

| Couche | Rôle | Exemples |
|---|---|---|
| **Famille** | Vocabulaire uniquement | "Mission" vs "Chantier" vs "Commande" |
| **Profil** | Valeurs par défaut des modules | `artisan_batiment` → planning calendrier, unité jours |
| **Modules** | Comportement de l'interface | `devis: false` masque la section Devis |
| **Moteur** | Calculs purs, sans contexte | `calculs.js`, `planning.js`, `affaires.js` |

### Pourquoi cette séparation existe

**Vocabulaire ≠ Comportement.** Un artisan-bijoutier et un artisan-maçon utilisent des mots différents ("Commande" vs "Chantier") mais le même moteur de suivi de rentabilité. Avant, cette confusion obligeait à créer deux interfaces presque identiques.

**Profil ≠ Contrainte.** Un profil ne verrouille rien. Il configure des valeurs par défaut que l'utilisateur peut modifier dans les paramètres. Un prestataire de services peut activer le planning calendrier s'il en a besoin.

**Moteur partagé = une seule source de vérité.** Tous les calculs (CA, charges, URSSAF, Score Santé, rentabilité) vivent dans `shared/core/`. Une correction dans `calculs.js` bénéficie immédiatement aux deux interfaces.

---

## 2. Les 4 familles de vocabulaire

Les familles définissent **uniquement les labels de l'interface**. Elles n'ont aucun impact sur les calculs ou les comportements.

La constante `VOCABULARY_FAMILIES` contient les 4 familles. La résolution se fait via `tVocab(key)` → `VOCABULARY_FAMILIES[famille][key]`.

---

### Famille `service`

**Rôle** : activités de prestation intellectuelle, de service ou de conseil.

**Vocabulaire principal** :

| Clé | Valeur |
|---|---|
| `item` | Mission |
| `items` | Missions |
| `navLabel` | 🎯 Missions |
| `firstItem` | Créez votre première mission |
| `createButton` | Créer une mission |
| `coutDirectLabel` | Coûts directs |
| `client` | Client |
| `temps` | Temps facturable |

**Catégories par défaut** : Gestion de projet, Coordination, Stratégie, Contenu & communication, Formation, Administratif, Prospection, Autre.

**Exemples de métiers** : coach, consultant, développeur, community manager, graphiste, photographe, thérapeute, formateur, assistante virtuelle, traducteur, traiteur, fleuriste.

---

### Famille `chantier`

**Rôle** : activités organisées autour d'interventions physiques sur site, planifiées à la journée.

**Vocabulaire principal** :

| Clé | Valeur |
|---|---|
| `item` | Chantier |
| `items` | Chantiers |
| `navLabel` | 🛠️ Chantiers |
| `firstItem` | Créez votre premier chantier |
| `createButton` | Créer un chantier |
| `coutDirectLabel` | Fournitures / matériaux |
| `client` | Client |
| `temps` | Temps chantier |

**Catégories par défaut** : Création / Fabrication, Réparation / Restauration, Installation / Pose, Entretien / Maintenance, Sur mesure, Conseil / Devis, Formation / Atelier, Autre.

**Exemples de métiers** : maçon, peintre, couvreur, plombier, menuisier, carreleur, électricien, paysagiste, chauffagiste.

---

### Famille `fabrication`

**Rôle** : activités de production d'objets, à la commande ou en série.

**Vocabulaire principal** :

| Clé | Valeur |
|---|---|
| `item` | Commande |
| `items` | Commandes |
| `navLabel` | 📦 Commandes |
| `firstItem` | Créez votre première commande |
| `createButton` | Créer une commande |
| `coutDirectLabel` | Matières premières |
| `client` | Client / Acheteur |
| `temps` | Temps de production |

**Catégories par défaut** : Produit standard, Produit personnalisé, Série / lot, Fabrication sur mesure, Matières premières, Conditionnement, Livraison, Autre.

**Exemples de métiers** : ébéniste, bijoutier, chocolatier, pâtissier, fabricant de cosmétiques, fabricant de bougies, tapissier, maroquinier, ferronnier.

---

### Famille `achat_revente`

**Rôle** : activités d'achat de produits pour revente, sans transformation.

**Vocabulaire principal** :

| Clé | Valeur |
|---|---|
| `item` | Vente |
| `items` | Ventes |
| `navLabel` | 🛍️ Ventes |
| `firstItem` | Ajoutez votre première vente |
| `createButton` | Ajouter une vente |
| `coutDirectLabel` | Coût d'achat |
| `client` | Acheteur |
| `temps` | Temps passé |

**Catégories par défaut** : Vêtements, Accessoires, Décoration, Électronique, Livres & média, Loisirs & sport, Autre.

**Exemples de métiers** : revendeur vintage, dropshipping, brocante, commerce de détail.

---

## 3. Les 7 profils d'activité

Un profil = une combinaison de (famille de vocabulaire + modules par défaut + cas d'usage).

**Règle fondamentale** : un profil configure uniquement les **valeurs par défaut** de `DATA.params.modules`. L'utilisateur peut modifier ces valeurs à tout moment dans les paramètres. Un profil ne verrouille jamais un comportement.

La constante `BUSINESS_PROFILE_MAP` associe chaque clé de profil à sa famille de vocabulaire. La fonction `getDefaultModules(metier)` retourne les modules par défaut.

---

### `prestataire_services`

| | |
|---|---|
| **Famille** | `service` |
| **Cas d'usage** | Prestations intellectuelles ou de conseil, facturées au temps passé ou au forfait |
| **Exemples** | Consultant, coach, formateur, développeur, assistante virtuelle |

**Modules par défaut** :

| Module | Valeur | Raison |
|---|---|---|
| `planning` | `estime` | Charge estimée en heures/semaine, pas de calendrier imposé |
| `uniteTemps` | `heures` | Facturation à l'heure ou au forfait |
| `objectif` | `th` | Optimise un taux horaire cible |
| `devis` | `true` | Génération de devis standard |

---

### `creatif_com`

| | |
|---|---|
| **Famille** | `service` |
| **Cas d'usage** | Prestations créatives ou de communication, vendues généralement au projet |
| **Exemples** | Graphiste, photographe, community manager, UGC creator, rédacteur, webdesigner |

**Modules par défaut** : identiques à `prestataire_services` — la distinction est sémantique et permettra de différencier les futures fonctionnalités (ex : devis à la création plutôt qu'au temps).

---

### `evenementiel`

| | |
|---|---|
| **Famille** | `service` |
| **Cas d'usage** | Activité organisée autour de dates réservées |
| **Exemples** | DJ, photographe événementiel, animateur mariage, prestataire mariage |

**Modules par défaut** :

| Module | Valeur | Raison |
|---|---|---|
| `planning` | `calendrier` | Dates fixes à bloquer (mariages, événements) |
| `uniteTemps` | `heures` | |
| `objectif` | `th` | |
| `devis` | `true` | |

---

### `artisan_batiment`

| | |
|---|---|
| **Famille** | `chantier` |
| **Cas d'usage** | Interventions physiques planifiées à la journée, avec suivi des matériaux |
| **Exemples** | Maçon, plombier, électricien, couvreur, peintre, paysagiste |

**Modules par défaut** :

| Module | Valeur | Raison |
|---|---|---|
| `planning` | `calendrier` | Chantiers à placer dans un calendrier |
| `uniteTemps` | `jours` | Travail à la journée, TJM comme indicateur clé |
| `objectif` | `tjm` | Taux journalier minimum comme cible |
| `devis` | `true` | Devis chantier avec coûts directs |

---

### `fabricant_serie`

| | |
|---|---|
| **Famille** | `fabrication` |
| **Cas d'usage** | Fabrication de produits similaires en série, suivi de la rentabilité par lot |
| **Exemples** | Fabricant de bougies, chocolatier, maroquinier |

**Modules par défaut** :

| Module | Valeur | Raison |
|---|---|---|
| `planning` | `estime` | Pas de calendrier, planification par capacité |
| `uniteTemps` | `heures` | |
| `objectif` | `marge_commande` | Optimise la marge par commande/lot |
| `devis` | `false` | Pas de devis : tarif catalogue fixe |

---

### `artisan_commande`

| | |
|---|---|
| **Famille** | `fabrication` |
| **Cas d'usage** | Créations sur mesure à la commande, suivi de la rentabilité par affaire |
| **Exemples** | Ébéniste, bijoutier, tapissier, ferronnier |

**Modules par défaut** :

| Module | Valeur | Raison |
|---|---|---|
| `planning` | `estime` | |
| `uniteTemps` | `heures` | |
| `objectif` | `marge_commande` | Rentabilité par commande individuelle |
| `devis` | `true` | Devis personnalisé pour chaque commande |

---

### `achat_revente`

| | |
|---|---|
| **Famille** | `achat_revente` |
| **Cas d'usage** | Achat puis revente de produits, suivi de la marge par vente ou lot |
| **Exemples** | Revendeur vintage, dropshipping, brocante |

**Modules par défaut** :

| Module | Valeur | Raison |
|---|---|---|
| `planning` | `estime` | |
| `uniteTemps` | `heures` | |
| `objectif` | `marge_commande` | Marge à l'achat/revente |
| `devis` | `false` | Prix fixe, pas de devis personnalisé |

---

### Tableau récapitulatif

| Profil | Famille | planning | uniteTemps | objectif | devis |
|---|---|---|---|---|---|
| `prestataire_services` | service | estime | heures | th | ✓ |
| `creatif_com` | service | estime | heures | th | ✓ |
| `evenementiel` | service | **calendrier** | heures | th | ✓ |
| `artisan_batiment` | chantier | **calendrier** | **jours** | **tjm** | ✓ |
| `fabricant_serie` | fabrication | estime | heures | **marge_commande** | ✗ |
| `artisan_commande` | fabrication | estime | heures | **marge_commande** | ✓ |
| `achat_revente` | achat_revente | estime | heures | **marge_commande** | ✗ |

---

## 4. Les 4 modules fonctionnels

Les modules sont stockés dans `DATA.params.modules` et persistent avec les données utilisateur. Ils configurent le **comportement** de l'interface, indépendamment du vocabulaire.

---

### `planning`

**Rôle** : détermine comment le planning est géré et affiché.

**Valeurs possibles** :

| Valeur | Comportement |
|---|---|
| `estime` | Charge estimée en heures/semaine par affaire. Widget "Remplissage" basé sur la capacité hebdomadaire. Pas de calendrier. |
| `calendrier` | Dates de début/fin sur chaque affaire. Vue calendrier mensuelle. Taux de remplissage calculé sur les jours ouvrables du mois. |

**Impact interface** : `updateNavPlanning()` affiche ou masque le lien "Planning" dans la navigation selon si le mode calendrier est actif.

**Impact calculs** : `getTauxRemplissageMois()` et `getTauxRemplissageAnnee()` dans `planning.js` utilisent les deux moteurs (estimé vs calendrier). La fonction `scorerRemplissage()` reste identique dans les deux cas.

---

### `uniteTemps`

**Rôle** : détermine l'unité de temps de référence et l'indicateur de performance principal.

**Valeurs possibles** :

| Valeur | Comportement |
|---|---|
| `heures` | Saisie du temps en heures. Indicateur affiché : taux horaire (TH). |
| `jours` | Saisie du temps en jours. Indicateur affiché : taux journalier (TJM). |

**Impact interface** : la fonction `isJours()` retourne `true` si `uniteTemps === 'jours'`. Utilisée partout pour switcher entre TH et TJM dans les libellés et les KPIs.

**Impact calculs** : `getTauxHoraireMinCible()` reste en heures en interne. L'affichage TJM = TH × `heuresParJour`.

---

### `objectif`

**Rôle** : détermine quel indicateur de performance est utilisé comme cible et mis en avant dans le Score Santé et les KPIs.

**Valeurs possibles** :

| Valeur | Indicateur cible | Typique pour |
|---|---|---|
| `th` | Taux horaire minimum | Prestataires de services |
| `tjm` | Taux journalier minimum | Artisans bâtiment |
| `marge_commande` | Marge brute par commande/vente | Fabricants, revendeurs |

**Impact interface** : change les libellés dans le tableau de bord, le simulateur et les paramètres.

**Impact calculs** : oriente le calcul du Score Santé (`wScoreSante`) vers l'indicateur approprié.

---

### `devis`

**Rôle** : active ou désactive le module de génération de devis.

**Valeurs possibles** : `true` / `false`.

**Impact interface** :
- `true` : section "Tester un devis" visible dans la navigation. Onglet "Devis chantier" (artisan) ou simulateur (freelance) accessible.
- `false` : section masquée. `updateNavDevis()` gère la visibilité.

**Impact calculs** : aucun — les calculs de marge fonctionnent indépendamment du devis.

---

## 5. Les fonctionnalités socles

Ces fonctionnalités sont **toujours disponibles**, quel que soit le profil ou les modules. Elles ne doivent jamais redevenir des options.

### Suivi des affaires (missions / chantiers / commandes)

- Création, modification, archivage
- Statuts : en cours, terminé, facturé, annulé
- Encaissements multiples par affaire (acomptes, soldes, versements partiels)
- Dépenses liées à une affaire (`affaires.js`)
- Saisie du temps (heures ou jours selon `uniteTemps`)
- Sessions de travail horodatées

### Dépenses professionnelles

- Dépenses générales (non liées à une affaire)
- Dépenses liées à une affaire spécifique (coûts directs)
- Catégorisation libre
- Exclusion automatique des dépenses liées des dépenses générales dans les agrégats

### Encaissements multiples

Chaque affaire peut recevoir plusieurs encaissements distincts, avec date, montant et mode de règlement. La somme des encaissements ≠ nécessairement le montant du devis.

### Score Santé

Indicateur composite (0–100) qui agrège : taux de remplissage, régularité du CA, marge moyenne, respect de l'objectif financier. Toujours affiché sur le tableau de bord.

### Trésorerie

- Suivi du solde de trésorerie réel (encaissements - décaissements)
- Provisions automatiques (TVA, URSSAF, impôts)
- Prévisions à 3 mois

### Chiffre d'affaires

Toujours calculé et affiché. **Note importante** :

> ⚠️ **Divergence entre les deux interfaces (non résolue à v29)** :  
> - `indepuls_freelance.html` : CA = `montantDevis` à la date de facturation (CA de facturation)  
> - `indepuls_artisan.html` : CA = encaissements réels à la date d'encaissement  
>
> Cette divergence est intentionnelle — elle reflète des pratiques comptables différentes. Elle est documentée dans un commentaire dans `shared/core/calculs.js` (ligne ~164). Ne pas "corriger" sans avoir compris l'impact.

### Temps interne

Timer intégré pour les tâches non facturables (admin, prospection, formation). Ne compte pas dans le CA.

### Historique annuel

Archivage par année. Les données des années précédentes restent consultables.

### Paramètres

Toujours accessibles : nom, statut juridique, régime fiscal, TVA, objectif net mensuel, rythme de travail, mois d'ouverture, profil d'activité et modules.

### Livre des recettes

Liste chronologique des encaissements. Obligatoire pour les micro-entreprises. Activable/désactivable mais les données sont toujours conservées.

---

## 6. Architecture technique

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────┐
│                    INTERFACES HTML                       │
│  indepuls_freelance.html    indepuls_artisan.html        │
│  (CA = facturation)         (CA = encaissements réels)  │
│                                                          │
│  Contiennent : UI, rendu, événements, navigation        │
│  Exposent via window.* les fonctions du bridge          │
└──────────────────────┬──────────────────────────────────┘
                       │ import + window.*
┌──────────────────────▼──────────────────────────────────┐
│                    BRIDGES (modes/)                      │
│  shared/modes/freelance.js    shared/modes/artisan.js   │
│  (Phase 1 : existants mais non encore chargés par HTML) │
│                                                          │
│  Rôle : wrapper de DATA implicite → les HTML appellent  │
│  isSASU() au lieu de C.isSASU(DATA)                    │
└──────────────────────┬──────────────────────────────────┘
                       │ import * as C/P/A/S
┌──────────────────────▼──────────────────────────────────┐
│                   SHARED/CORE (moteur)                   │
│                                                          │
│  calculs.js   Tous les calculs métier purs               │
│               CA, charges, URSSAF, TVA, impôts,         │
│               taux horaire, marge, Score Santé           │
│                                                          │
│  planning.js  Moteur planning (estimé + calendrier)      │
│               Capacité, remplissage, scoring             │
│                                                          │
│  affaires.js  Rentabilité par affaire                    │
│               Dépenses liées, marge, TH réel             │
│                                                          │
│  taux.js      Taux de charges par statut juridique       │
│               (micro-BIC, micro-BNC, SASU, EI...)        │
│                                                          │
│  storage.js   Persistence locale (localStorage)          │
│               Migration de schéma                        │
│                                                          │
│  utils.js     Fonctions utilitaires pures                │
└─────────────────────────────────────────────────────────┘
```

### Stratégie de migration progressive

Le code actuellement dans les fichiers HTML sera migré en trois phases :

- **Phase 1 (actuelle)** : les bridges `shared/modes/` existent mais ne sont pas encore chargés par les HTML. Les calculs sont dupliqués dans les HTML.
- **Phase 2** : remplacement progressif des fonctions dupliquées dans les HTML par des imports des bridges. Une fonction à la fois, avec test après chaque remplacement.
- **Phase 3** : les HTML ne contiennent plus que l'UI. Toute la logique vient des bridges et du core.

### Stockage des données

```
DATA = {
  schemaVersion: 29,         // Version du schéma — migré automatiquement au chargement
  isExample: boolean,        // true = mode démo, false = données réelles
  params: {
    metier: string,          // Clé de profil (ex: 'artisan_batiment')
    modules: {               // Comportement courant (modifiable par l'utilisateur)
      planning: 'estime' | 'calendrier',
      uniteTemps: 'heures' | 'jours',
      objectif: 'th' | 'tjm' | 'marge_commande',
      devis: boolean
    },
    // ... fiscal, rythme de travail, objectifs financiers
  },
  missions: [...],           // Toutes les affaires (terme interne universel)
  depenses: [...],           // Dépenses professionnelles
  revenus: {...},            // Revenus ponctuels par mois-clé
  // ...
}
```

**Clés localStorage** :
- Interface freelance : `indepuls_freelance`
- Interface artisan : `indepuls_artisan`

### Migration de schéma

La fonction `migrate(data)` dans chaque HTML gère les montées de version :

- **v28 → v29** : `DATA.params.modePlanning` supprimé, remplacé par `DATA.params.modules.planning`. Migration automatique au chargement.

La fonction `applyDefaults(data)` injecte les valeurs manquantes sans écraser les valeurs existantes — utilisée après `migrate()` pour les nouvelles propriétés.

### Synchronisation cloud

- Backend : Supabase
- Clé d'API exposée côté client (row-level security)
- `loadFromCloud(user)` : charge les données au login, écrit dans localStorage
- `syncToCloud()` : upload après chaque `saveData()`, gardée par `if (!_cloudLoaded) return`
- La suppression de compte efface les données Supabase + localStorage

---

## 7. Règles d'évolution

Ces règles doivent être respectées avant d'ajouter un nouveau métier, un nouveau profil ou une nouvelle fonctionnalité. Leur objectif : éviter que la base de code redevienne une collection de cas spéciaux.

---

### Ajouter un nouveau profil

1. **Choisir la famille existante la plus proche.** Si aucune ne convient, voir "Ajouter une famille" ci-dessous. Ne jamais créer de nouvelle famille pour un seul profil.

2. **Ajouter la clé dans `BUSINESS_PROFILE_MAP`** avec sa famille.

3. **Ajouter les modules par défaut dans `getDefaultModules()`**. Si les modules correspondent exactement à un profil existant, réutiliser les mêmes valeurs.

4. **Ajouter une description dans `PROFIL_DESCRIPTIONS`** (phrase courte, ~15 mots).

5. **Ajouter un label dans `PROFIL_LABELS`** (2–4 mots).

6. **Ajouter une entrée dans `METIER_MIGRATION_AR` et `METIER_MIGRATION_FL`** si des utilisateurs ont pu enregistrer l'ancien nom de métier.

7. **Ne jamais créer de branche `if (metier === 'nouveau_profil')` dans le moteur.** Si le comportement ne peut pas être configuré par les 4 modules existants, c'est qu'il faut un nouveau module — voir ci-dessous.

---

### Ajouter un nouveau module

Un nouveau module est justifié si et seulement si :

- Le comportement est binaire ou à valeurs discrètes (pas infini)
- Il affecte plusieurs profils différents
- Il ne peut pas être exprimé par la combinaison des modules existants

**Procédure** :
1. Ajouter la clé dans `getDefaultModules()` pour tous les profils existants avec la valeur "comportement actuel" comme défaut de migration.
2. Ajouter la clé dans `applyDefaults()` pour garantir la rétrocompatibilité.
3. Incrementer `SCHEMA_VERSION`.
4. Documenter le module dans cette section.

---

### Ajouter une famille de vocabulaire

Seulement si aucune des 4 familles ne correspond et si au moins 2 profils distincts utilisent ce vocabulaire.

**Procédure** :
1. Ajouter une entrée complète dans `VOCABULARY_FAMILIES` avec toutes les clés existantes.
2. Mapper les profils concernés dans `BUSINESS_PROFILE_MAP`.
3. Définir les `defaultCategories` adaptées.

---

### Modifier un calcul existant

1. **La modification se fait dans `shared/core/`**, jamais directement dans les HTML.
2. Vérifier l'impact sur les deux interfaces : les HTML peuvent avoir leur propre implémentation de certaines fonctions (voir divergence `getCaBreakdownMois` documentée en section 5).
3. Mettre à jour les tests dans `audit_v2.js`.

---

### Règles absolues

| Règle | Raison |
|---|---|
| Un nouveau métier **ne crée jamais** un nouveau moteur | Le moteur est universel |
| Une famille définit **uniquement** le vocabulaire | Comportement = modules |
| Un profil définit **uniquement** des valeurs par défaut | L'utilisateur garde le contrôle |
| Les modules définissent **tout** le comportement variable | Pas de `if (metier === X)` dans le moteur |
| Les calculs restent dans `shared/core/` | Une seule source de vérité |
| Les HTML ne contiennent que l'affichage (objectif phase 3) | Séparation logique / UI |
| `applyDefaults()` ne **remplace jamais** une valeur existante | Rétrocompatibilité utilisateurs |
| Toute montée de schéma **incrémente** `SCHEMA_VERSION` | Migration traçable |
| Le cloud ne restaure **jamais** après un reset explicite | Confiance utilisateur |

---

*Document généré en juin 2026 — à mettre à jour à chaque évolution majeure de l'architecture.*
