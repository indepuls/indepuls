# Indépuls — Spécification Produit Complète
> Vision long terme · Rédigé le 2 juillet 2026
> À ne pas implémenter d'un coup — roadmap en 4 phases ci-dessous

---

## Suivi d'avancement — Phase 1

### ✅ Réalisé (2 juillet 2026)
- Langage "il reste X à trouver" remplace "il manque X" (3 occurrences)
- Phrase narrative globale (diagGlobal) en 5 niveaux, orientée élan — se termine toujours sur une ouverture
- "Votre brief" + date de fraîcheur ("Basé sur vos données du X")
- Label "Action recommandée" au-dessus de la priorité
- Layout missions : widget compact, même largeur que le score santé, positionné juste au-dessus
- Titres des 4 piliers humanisés : Votre rentabilité / Votre agenda / Votre trésorerie / Votre horizon
- Alerte objectif mensuel : ajoute "encore X jours ce mois-ci"
- Priorité remplissage reformulée en élan (garde le nombre d'heures précis)
- Fix bug TDZ `sComm` utilisé avant déclaration (pré-existant)
- Fix accord grammatical "le remplissage / la trésorerie" dans diagGlobal

### 🔲 Reste à faire — Phase 1
- ✅ Renommer le bouton "Voir l'analyse détaillée →" → "Pourquoi ce score ?" (entrée modale piliers)
- ✅ Reformuler l'alerte concentration client : constat factuel + action concrète (relancer un prospect / garder un autre client actif)
- ✅ Label score confirmé : affiche bien "Santé de votre activité"
- ✅ Onboarding empty state déjà solide (4 étapes numérotées, progression visible, textes clairs) — aucune action requise
- Reformuler le contenu interne des modals piliers (langage résiduel)
- Descendre graphiques et donut en couche secondaire (scroll)
- Fusionner TVA + URSSAF + provisions en un seul widget
- Trajectoire duale sous chaque indicateur (Phase 1 semaine 3–4)
- Indicateur de fraîcheur global (% des données disponibles)

---

## La philosophie produit — une seule phrase

> **Indépuls ne gère pas votre activité. Il vous libère de la peur de mal la gérer.**

**Filtre absolu de toute décision produit :** une fonctionnalité qui n'aide pas à répondre à la question "Est-ce que ça va ?" n'existe pas dans Indépuls.

---

## Les grands principes UX

1. **La réponse avant la donnée.** L'utilisateur arrive avec une question. Indépuls répond d'abord. Les chiffres viennent ensuite.
2. **Le conseil et sa preuve sont inséparables.** Chaque recommandation affiche immédiatement les 3 lignes qui la justifient.
3. **La profondeur progressive, jamais l'information cachée.** Tout existe. Tout est accessible. Rien n'est imposé.
4. **Deux trajectoires toujours visibles.** Situation actuelle ET situation si conseil suivi.
5. **L'incertitude est honnête et visible.** "Projection à 82%" vaut mieux que "2 847€" calculé sur des données périmées.
6. **Jamais de problème sans solution.** Quand quelque chose ne va pas, Indépuls dit quoi faire. Toujours.
7. **L'émotion juste : l'élan, pas la culpabilité.** "Il vous reste 3 semaines pour trouver 1 148€" plutôt que "il manque 1 148€".
8. **Zéro boîte noire.** Tout calcul est visible. Toute logique est explicable.

---

## Erreurs du dashboard actuel

- **Équipondération** : tout a la même importance visuelle. L'utilisateur trie lui-même ce que le logiciel devrait trier.
- **Donnée avant réponse** : "Taux de remplissage : 5/25" est une donnée. Une réponse serait : "Votre agenda est trop vide — voici quoi faire."
- **Absence de trajectoire** : le dashboard montre l'instantané, jamais "si vous continuez comme ça" ni "si vous suivez ce conseil."
- **Labels techniques** : "Pilier Remplissage", "TH réel", "wKPIs" — vocabulaire développeur, pas utilisateur.
- **Rouge qui accuse** : "🔴 Remplissage 5/25" crée de l'anxiété. L'émotion utile est l'élan.
- **Scroll infini sans priorité** : l'utilisateur ne sait pas où regarder en premier.

---

## Points à conserver

- Le Score Santé (concept unique, différenciant) — à repositionner, pas à supprimer
- Les 4 piliers (taxonomie rentabilité/remplissage/trésorerie/commercial) — juste et complète
- La "Priorité du moment" — intention correcte, exécution à améliorer
- "Argent à mettre de côté" — excellent widget pédagogique
- Les alertes — pertinentes, à hiérarchiser
- Le Simulateur — fonctionnalité différenciante à valoriser davantage
- La décomposition CA "Pour 100€ encaissés..." — meilleur langage produit actuel
- Les missions en cours — bonne information de contexte

---

## Éléments à descendre du first viewport

- Grille 4 piliers côte à côte en premier plan → couche Analyser
- Graphique évolution CA → couche Analyser
- Donut "Où part votre CA ?" → couche Analyser
- Label "MISSIONS EN COURS · 3" (bruit sans valeur)
- "CA HT annuel : 25 860€" seul, sans contexte

---

## Éléments à fusionner

| Actuellement séparés | Fusionné en |
|---|---|
| "Priorité du moment" + alertes | Le Brief (synthèse narrative) |
| Score circulaire + 4 piliers cards | Le Cockpit Santé (diagnostic intégré) |
| TVA prochaine + URSSAF + provisions | L'Agenda de trésorerie |
| Objectif mensuel % + gap € | La jauge de mois avec projection |
| Missions actives + devis en attente | Le Pipeline (une seule vue commerciale) |

---

## Éléments à renommer

| Ancien | Nouveau | Pourquoi |
|---|---|---|
| Tableau de bord | Le Cockpit | On pilote, on ne regarde pas |
| Pilier Remplissage | Votre agenda | Langage humain |
| Pilier Rentabilité | Votre rentabilité | Idem |
| Pilier Trésorerie | Votre trésorerie | Idem |
| Pilier Commercial | Votre horizon | Capture l'idée de visibilité future |
| Score Santé 80/100 | Diagnostic de l'activité | Moins gamification, plus médical |
| Priorité du moment | Votre brief | Posture de copilote |
| Taux de remplissage | Capacité utilisée | Moins technique |
| TH réel | Ce que vous gagnez vraiment à l'heure | Ancré dans la réalité |

---

## Architecture complète cible

```
LE COCKPIT INDÉPULS
══════════════════════════════════════════════════════════

COUCHE 1 — DÉCIDER                          [20 secondes]
──────────────────────────────────────────────────────────
  LE BRIEF
  → Synthèse narrative contextuelle
  → Situation en 3 points
  → Une action principale

  LE DIAGNOSTIC
  → Statut global (un mot + couleur)
  → 4 signaux vitaux (dot + une ligne)

  LES HORIZONS
  → [Aujourd'hui] [Cette semaine] [Ce mois] [90 jours]

COUCHE 2 — COMPRENDRE                       [2 minutes]
──────────────────────────────────────────────────────────
  LES 4 SIGNAUX VITAUX DÉVELOPPÉS
  → Chacun : diagnostic + chiffres + conseil + trajectoire

  L'AGENDA DU MOIS
  → Objectif / progression / projection
  → Prochaines obligations (TVA, URSSAF)

  LE PIPELINE
  → Missions actives
  → Devis en attente avec action

COUCHE 3 — ANALYSER                         [10 minutes]
──────────────────────────────────────────────────────────
  → Tous les KPIs existants avec contexte
  → Graphiques
  → Chaque métrique avec son "Et si..."

COUCHE 4 — EXPLORER                         [ouvert]
──────────────────────────────────────────────────────────
  → Patterns comportementaux long terme
  → Saisonnalité
  → Rentabilité par client/mission type
  → Évolution annuelle
══════════════════════════════════════════════════════════
```

---

## Le Brief — fonctionnement

Généré automatiquement à partir de 4 inputs :
- L'état du Diagnostic (combinaison des 4 signaux)
- Le signal le plus dégradé (priorité d'action)
- Le meilleur levier disponible (devis / mission / TH)
- L'horizon temporel actif

**Règles de génération :**
- Tous signaux verts → Brief de réassurance + opportunité
- 1 signal orange → Brief focalisé + 1 levier concret
- 1 signal rouge → Brief d'alerte + 1 action immédiate
- 2+ signaux dégradés → Brief de prioritisation (le plus urgent d'abord)

**Règles de tonalité :**
- Jamais "Il manque X€" → Toujours "Il reste X€ à trouver"
- Jamais "Vos données sont incomplètes" → Toujours "Basé sur 82% des données"
- Jamais "Vous n'avez pas atteint votre objectif" → Toujours "Vous êtes à 67% — 3 semaines restantes"

---

## Le Diagnostic (ex-Score Santé)

**Niveau 1 (first viewport) :**
→ Un mot : EXCELLENT / BON / ATTENTION / CRITIQUE
→ Une phrase : "Votre activité est sur la bonne trajectoire."

**Niveau 2 (visible sans clic) :**
→ 4 signaux : dot + une phrase humaine par signal
→ Pas de chiffres abstraits à ce niveau

**Niveau 3 (expand au clic) :**
→ Calcul exact
→ Trajectoire actuelle vs trajectoire si conseil suivi
→ Pourquoi complet

**Règle absolue :** le Diagnostic ne cache jamais une dégradation. Si un signal est rouge, il est visible immédiatement.

---

## Pattern universel des widgets

```
Conseil → Preuve → Conséquence → Alternative

┌─ [TITRE DU SIGNAL] ──────────── [STATUT] ──────┐
│  PHRASE DE DIAGNOSTIC (langage humain)          │
│  ┌── DONNÉES CLÉS ─────────────────────────┐   │
│  │  Indicateur A    valeur    barre         │   │
│  └─────────────────────────────────────────┘   │
│  TRAJECTOIRE DUALE                              │
│  → Si rien ne change : [projection]            │
│  → Si conseil suivi  : [projection améliorée]  │
│  [ Action principale ]  [ Pourquoi ? ▸ ]       │
└─────────────────────────────────────────────────┘

▼ EN EXPAND
  Les preuves (3 lignes max)
  Calcul exact (formule lisible)
  Alternatives (Si X → / Si Y → / Si rien → )
```

---

## Système de notifications

**Règle absolue : chaque notification vend une récompense, jamais une corvée.**

| Type | Déclencheur | Format |
|---|---|---|
| Brief du lundi | Lundi 8h15 | "Cette semaine : une chose. Relancer le devis X. Tout le reste est bon." |
| Opportunité | Objectif en bonne voie à J+15 | "Bonne nouvelle possible. Il manque juste les données de cette semaine." |
| Décision | TVA dans 7 jours | "TVA dans 7j · 1 005€ · Vos provisions couvrent." |
| Insight mensuel | Fin de mois | "Juillet terminé. Votre meilleur mois depuis mars. Voici ce qui a changé." |
| Fraîcheur douce | 10j sans données | "Vos projections datent de 10 jours. Affiner ? 2 minutes suffisent." |

**Ce que les notifications ne disent JAMAIS :**
- "Connectez-vous" / "Vos données sont incomplètes" / "Action requise"

---

## Projections — deux niveaux

**Niveau 1 — Trajectoire duale (toujours visible)**
Sous chaque indicateur : situation actuelle + situation si conseil suivi.

**Niveau 2 — Projection à 90 jours**
Basée sur rythme actuel + saisonnalité N-1.
Avec plage de fiabilité affichée : "~2 800€ → ~3 400€" (jamais "3 047€" si données insuffisantes).
La plage se réduit visuellement à chaque saisie — comme une mise au point photographique.

---

## Système "Et si..."

Curseur inline sur chaque métrique clé (soulignement pointillé).
Pas de modal. Pas de nouvelle page.
Trajectoire mise à jour en temps réel dans le widget.

**Variables disponibles :**
- Taux horaire / TJM
- Objectif mensuel
- Nombre de missions actives
- Durée d'une période de congés
- Montant d'un devis spécifique

---

## Raconter les conséquences

Format standard pour chaque décision :
```
DÉCISION : [action envisagée]
Données : montant / durée / TH implicite
Conséquences immédiates : [3 points]
Conséquences à 3 mois : [si / alors]
Point à vérifier avant d'agir : [honnêteté]
[ Calculer ] [ Confirmer ] [ Simuler autrement ]
```

---

## Expliquer les calculs

4 niveaux d'explication, tous accessibles sans quitter la page :
1. Le résultat seul (47€/h)
2. L'interprétation ("Au-dessus de votre seuil de viabilité")
3. La preuve courte en expand ("CA encaissé ÷ heures facturées · 3 448€ ÷ 73h = 47,2€/h")
4. La preuve complète avec sources et hypothèses

**Règle :** jamais de formule sans unités. Jamais de résultat sans contexte. Jamais d'interprétation sans données sources.

---

## Créer la confiance

6 mécanismes non-négociables :
1. **Fraîcheur affichée** — "Basé sur les données du 29 juin"
2. **Limites assumées** — "Nous ne prenons pas en compte X — renseignez Y pour affiner"
3. **Traçabilité complète** — chaque chiffre a une source
4. **Cohérence dans le temps** — si le Brief change, il explique pourquoi
5. **Honnêteté sur les mauvaises nouvelles** — jamais de faux "tout va bien"
6. **Respect du jugement humain** — le logiciel propose, ne décide jamais

---

## Créer de l'émotion utile

| Émotion | Comment | Exemple |
|---|---|---|
| Sérénité | Dire "rien à faire" quand c'est vrai | "Tout est en ordre. Bonne soirée." |
| Contrôle | Rendre visible le lien choix → conséquences | Le "Et si..." en temps réel |
| Élan | Cadrage prospectif systématique | "Il reste 3 semaines" vs "il manque" |
| Fierté | Révéler les patterns positifs | "Votre Q2 est votre meilleur trimestre depuis 2 ans" |
| Projection | L'horizon à 90 jours | Voir sa destination avant d'y arriver |

---

## Réduire la charge mentale

5 règles :
1. **Une seule décision par session** — le Brief identifie une action principale, pas cinq
2. **Zéro calcul à faire soi-même** — si l'utilisateur doit multiplier pour comprendre, l'interface a échoué
3. **Le contexte toujours présent** — "47€/h" s'affiche toujours avec "seuil : 38€/h"
4. **Rien à mémoriser** — le contexte est reconstruit à chaque ouverture
5. **Le silence quand tout va bien** — le calme visuel est lui-même une information

---

## Behavioral Design — créer l'habitude

### La règle fondamentale
> **Montre la récompense avant de demander l'effort.**

Pas : "Saisis tes données → tu obtiendras une projection"
Mais : "Tu pourrais savoir si tu peux partir en vacances. Il manque juste une information."

### Les moments naturels d'ouverture
- Avant d'envoyer un devis ("Mon prix est-il correct ?")
- Avant de prendre des vacances ("Puis-je me le permettre ?")
- Après un encaissement (réflexe "combien il me reste ?")
- Le lundi matin ("Qu'est-ce que j'ai à faire cette semaine ?")
- Fin de mois ("J'ai fait combien ?")
- Sous anxiété financière (le plus fort déclencheur)

### La saisie comme conversation
- Jamais un formulaire à 10 champs
- Une question : "Qu'est-ce qui s'est passé cette semaine ?"
- Maximum 3 questions, 3 taps
- Fin de saisie : projection qui se précise visuellement (mise au point photographique)

### Le rituel du vendredi
Notification optionnelle : "Votre semaine en 30 secondes. Voir le récap ?"
→ Fonctionne même sans saisie cette semaine (basé sur données existantes)
→ Signale les données manquantes comme opportunité d'affiner, jamais comme obligation

### Le vrai hook
> **Indépuls connaît la question que vous êtes sur le point de vous poser, et a déjà préparé la réponse.**

La révélation qui crée la fidélité : un pattern sur l'activité que l'utilisateur ne savait pas sur lui-même.
"Vos missions > 3 000€ génèrent 87% plus de revenu horaire que vos petites missions."
Cette information change ses décisions pour les années suivantes. Il n'oubliera jamais qu'Indépuls le lui a dit.

---

## Roadmap — 4 phases

### Phase 1 — Aucune nouvelle fonctionnalité (4–6 semaines)
Réorganisation pure. Maximum d'impact, zéro nouveau code métier.

- **Semaine 1–2** : Créer le Brief à partir de wSynopsis existant · Repositionner le Score Santé en Diagnostic · Passer les 4 piliers en signaux simples (dot + ligne) · Grille développée en scroll
- **Semaine 2–3** : Renommer tous les labels · Créer la structure Couche 1/2/3 · Descendre graphiques et donut · Fusionner TVA + URSSAF + provisions
- **Semaine 3–4** : Ajouter accordion "Pourquoi ?" sur chaque recommandation · Indicateur de fraîcheur · Trajectoire duale sous chaque indicateur
- **Semaine 4–5** : Adapter le first viewport mobile · Auditer et corriger tout le langage culpabilisant · Reformuler toutes les alertes en mode "élan"

**Résultat attendu :** même logiciel, expérience radicalement différente.
**Test de validation :** un nouveau utilisateur comprend sa situation en moins de 20 secondes sans formation.

### Phase 2 — Petites fonctionnalités (2–3 mois)
- Switcher d'horizon temporel [Aujourd'hui / Semaine / Mois / 90 jours]
- "Et si..." inline sur les métriques clés (curseur, pas de modal)
- Micro-saisie conversationnelle (3 questions max, 3 taps max)
- Système de notifications intelligent (Brief lundi, fraîcheur douce, opportunité)
- Projection à 90 jours avec plage de fiabilité
- Couche 4 — Patterns (rentabilité par type de mission, saisonnalité)

### Phase 3 — Fonctionnalités ambitieuses (6–18 mois)
- Connexion bancaire (lecture seule, encaissements automatiques)
- Connexion Google Calendar (remplissage en temps réel)
- Import Indy / logiciel comptable (Indépuls = couche décision au-dessus)
- Brief hebdomadaire email + push enrichi (lisible sans ouvrir l'app)
- "Questions rapides" en langage naturel (règles métier explicites, pas d'IA générative)

### Phase 4 — Vision 2030
L'interface principale n'est plus un dashboard. C'est un message le lundi matin :

> "Bonjour Faustine. Cette semaine : une chose. Relance le devis Sophie. Tout le reste est bon. Bonne semaine."

Une conversation, pas une interface. Les données entrent automatiquement (banque, agenda). Les calculs sont invisibles mais toujours disponibles. L'utilisateur ne saisit rien. Il reçoit et décide.

Ce n'est pas un logiciel de gestion.
C'est un directeur financier dans la poche.
Accessible 24h/24. Qui connaît exactement votre activité. Et qui ne vous juge jamais.

---

## Test de la philosophie (filtre décisionnel)

Pour chaque fonctionnalité envisagée, poser la question :
**"Est-ce que ça libère l'utilisateur de la peur de mal gérer son activité ?"**

- Graphique d'évolution annuel → Oui. Existe.
- Module de facturation → Non (tâche administrative). N'existe pas.
- Patterns long terme → Oui. Existe (Phase 2).
- Brief hebdomadaire → Oui. Existe (Phase 2).
- Chatbot général → Non (curiosité, pas peur précise). N'existe pas.
- CA au devis signé → NON. Règle absolue préservée.
