# Prompt pour Claude Code : import de relevé bancaire (phase 0 puis phase 1)

Lis d'abord CLAUDE.md en entier (surtout : pièges démo vs réel, garde-fous cloud, miroir indepuls-demo.html, migrations en double, vocabulaire dynamique, pas de tirets cadratins). Lis aussi `shared/tests/fixtures/releves/README.md` et `expected_normalized.json`.

## Contexte
Des bêta-testeuses demandent d'importer leur relevé bancaire (CSV, OFX) pour ne plus ressaisir encaissements et dépenses et pour mettre à jour le solde. Import MANUEL, ponctuel (mensuel ou à la demande). Aucune connexion bancaire en direct. Indépuls reste complémentaire d'un outil de compta : on ne devient ni un logiciel de comptabilité ni un rapprochement bancaire complet.

Parcours cible : choisir le fichier, analyse ligne par ligne avec une proposition pré-remplie, validation en un clic ou correction, solde mis à jour à la fin.

## Règles non négociables
1. **Le fichier brut n'est jamais stocké.** Il est lu dans le navigateur. On ne conserve que les lignes validées et une empreinte pour le dédoublonnage.
2. **Jamais de libellé bancaire dans Sentry** ni dans aucun log envoyé hors de l'appareil (`reportError` : contexte seulement).
3. **Rien ne touche au cloud en dehors des chemins existants** : pas de modification de `loadFromCloud`, `syncToCloud`, `loadData`. Import interdit en démo (`DATA.isExample`) et en lecture seule d'un compte partagé (`window._lectureSeule`). Respecte `_ownerUid`.
4. **Tests d'abord** : tout le moteur est écrit dans `shared/core/` (fonctions pures, `DATA` en premier paramètre quand nécessaire), testé dans `shared/tests/` AVANT toute interface. Les tests s'appuient sur les fixtures du dossier `fixtures/releves/`.
5. **En cas de doute, on demande à l'utilisatrice.** Jamais de fusion ni d'import silencieux d'une ligne ambiguë.
6. Un nouveau champ de données (ex. `importId`) se migre dans `indepuls.html` ET `shared/core/storage.js` (mode ombre), SCHEMA_VERSION dans les 2 endroits (+ `unified.js`). Se demander ce que devient le champ pour un compte existant.
7. Textes visibles : vocabulaire via `tVocab`, jamais "mission" en dur, aucun tiret cadratin, registre déjà en place (conseils au vouvoiement).
8. Miroir `indepuls-demo.html` pour ce qui est visible (la fonction elle-même y est bloquée, voir 3). Mise à jour de CLAUDE.md, commit `docs: update CLAUDE.md`, push sur main. Aucun SQL à exécuter : si tu en as besoin, écris le script et demande à Faustine de l'exécuter.

## Phase 0 : moteur pur, sans interface (livrable testé)

### 0.1 Lecture du fichier
Fonction `parseReleve(octets)` (ou texte + encodage détecté) qui retourne `{format, devise, soldeOuverture?, soldeCloture?, dateCloture?, lignes:[{date:'AAAA-MM-JJ', libelle, montant (signé, nombre), ficheId?}], rejets:[{ligneBrute, motif}]}`.
- Encodage : détecter UTF-8 (avec ou sans BOM), cp1252, latin-1. Tester dans cet ordre, repli cp1252. Pas de dépendance externe.
- CSV : détecter le séparateur (`;`, `,`, tabulation) sur les premières lignes, gérer les guillemets (un `;` entre guillemets fait partie du libellé), ignorer les lignes vides, **repérer la ligne d'en-tête** même précédée de lignes parasites (titre, IBAN, période), ignorer un pied de page ("Solde au ..." : le lire comme `soldeCloture`).
- Colonnes : détection AUTOMATIQUE par mots-clés d'en-tête (date, date opération, libellé, label, nature, montant, débit, crédit, solde, devise...), avec **repli sur un mapping manuel** passé en paramètre (`mapping`). Le mapping choisi doit pouvoir être mémorisé (voir phase 1).
- Montants : virgule ou point décimal, séparateur de milliers (espace, espace insécable U+00A0, point), symbole `€`, signe `-`, parenthèses = négatif, colonnes Débit/Crédit séparées (débit = négatif).
- Dates : `JJ/MM/AAAA`, `AAAA-MM-JJ`, `JJ-MM-AAAA`, `JJ.MM.AAAA`. Date impossible (31/02) = rejet avec motif. Une date ambiguë (ex. 03/04/2026) suit le format détecté sur l'ensemble du fichier.
- Ordre : le plus récent en premier ou l'inverse, la sortie est toujours triée par date croissante (ordre d'origine conservé pour les lignes de même date).
- OFX 1.x SGML (balises non fermées) et 2.x XML : lire `STMTTRN` (`DTPOSTED`, `TRNAMT`, `NAME`/`MEMO`, `FITID`), `LEDGERBAL`, devise. Parser maison simple (regex), pas de dépendance.
- Une ligne illisible ne fait JAMAIS planter l'import : elle va dans `rejets` avec un motif clair, les autres lignes continuent.
- **Doublons légitimes** : deux lignes strictement identiques le même jour dans le MÊME fichier sont toutes les deux conservées.

Tests : les 6 fichiers A à F produisent chacun exactement `expected_normalized.json` (comparer date, libelle normalisé espaces, montant). Le fichier G produit les lignes valides attendues et les rejets listés dans le README, sans exception levée.

### 0.2 Empreinte de ligne
`empreinteLigne(ligne, indexDansGroupe)` : hash stable de date + montant (centimes) + libellé normalisé (minuscules, sans accents, espaces et chiffres de référence variables ignorés autant que possible) + rang parmi les lignes strictement identiques du même jour (pour que 2 lignes identiques aient 2 empreintes différentes mais reproductibles). Test : réimporter le même fichier, ou le même fichier réexporté avec une période qui se chevauche, produit les mêmes empreintes.

### 0.3 Dédoublonnage en 3 niveaux (`classerLignes(DATA, lignes, empreintesDejaImportees)`)
Pour chaque ligne, retourner un statut et ce qui l'explique :
1. **Déjà importée** (empreinte connue) : ignorée en silence.
2. **Correspondance probable avec une saisie manuelle existante non encore rapprochée** : même montant TTC (voir piège HT/TTC) et date proche. Fenêtre ±7 jours pour un encaissement, ±3 jours pour une dépense. On ne fusionne JAMAIS automatiquement : le statut est `rapprochement_propose` avec la saisie candidate, et l'utilisatrice répond "oui c'est celle-ci" ou "non, c'est une nouvelle". Une saisie ne peut être rapprochée qu'à UNE ligne bancaire.
3. **Nouvelle ligne** : proposition de création.

**Piège HT/TTC** : la banque voit du TTC, les encaissements d'Indépuls sont stockés HT. Un encaissement est candidat si `montant HT × (1 + taux TVA)` ≈ montant bancaire (tolérance 1 centime), avec le taux de TVA du compte (franchise : HT = TTC). Une dépense est candidate sur son montant TTC saisi.
Tests : Dupont (1 500 HT saisi / 1 800 en banque) est candidat, Leroy Merlin (142,50, 2 jours d'écart) est candidat, une réimportation ne crée rien, le doublon légitime reste double.

### 0.4 Rapprochement des dépenses récurrentes (abonnements)
`rapprocherRecurrentes(DATA, lignes)` : une ligne bancaire est "déjà couverte par [abonnement]" si une dépense récurrente active ce mois-là a un montant à ±2 %, un jour attendu à ±5 jours, et un libellé proche (mots communs après normalisation). Aucune création, ligne ignorée par défaut avec l'explication visible. Cas EDF : montant qui varie de quelques euros chaque mois, la ligne est quand même couverte, avec la proposition "mettre à jour le montant de l'abonnement" seulement si l'écart dure sur plusieurs mois. Libellé et montant qui reviennent sur 3 mois ou plus sans abonnement existant : proposer "créer comme dépense récurrente". Une récurrente ne couvre qu'UNE ligne par mois. Doute = on demande.

### 0.5 Catégorisation par mots-clés
`proposerCategorie(libelle, regles)` avec une table de mots-clés par défaut (logiciels et abonnements, assurances, carburant, télécom, fournitures, repas, frais bancaires, charges sociales/URSSAF, impôts, virement interne...). Retourne `{categorie, confiance, nature}` où nature ∈ `depense | encaissement | charges_sociales | interne | a_ignorer`.
- URSSAF, impôts, virement vers un particulier : **ne sont pas des dépenses professionnelles créées sans réfléchir** (charges sociales et impôt sont déjà provisionnés par le moteur, les compter en dépense les doublerait). Nature `charges_sociales`/`interne`, ignorées par défaut avec explication.
- Compte mixte (pro et perso) : les lignes ambiguës (restaurant, supermarché) sont `a_ignorer` par défaut, la validation se fait par groupes, pas ligne par ligne.
- **Règles apprises** : `DATA.reglesImport = [{motCle, categorie, nature}]` (champ optionnel, préservé par la fusion de partage). La correction d'une ligne propose "retenir cette règle ?" (jamais automatique). Les règles apprises priment sur la table par défaut.
Tests : chaque ligne du jeu de fixtures reçoit la nature attendue de son `hint`.

**Arrête-toi à la fin de la phase 0 et montre les résultats des tests à Faustine avant la phase 1.**

## Phase 1 : intégration et interface

1. **Données** : champ optionnel `importId` (empreinte) sur les dépenses et encaissements créés ou rapprochés par un import, + `DATA.empreintesImportees` (liste dédupliquée, plafonnée) + `DATA.reglesImport` + `DATA.mappingsImport` (mapping de colonnes mémorisé par `en-tête normalisé`). Migrations dans les DEUX copies, version suivante du schéma. Rapprocher une saisie existante = l'estampiller (`importId`) sans la modifier, jamais de doublon créé.
2. **Écran** (page ou grande modale, une seule à la fois, mobile d'abord, aucun scroll horizontal) : choix du fichier, si le mapping automatique est incertain une étape "Quelles colonnes ?" (aperçu de 3 lignes), puis la liste d'analyse regroupée : "À vérifier" (rapprochements proposés et nouvelles lignes), "Déjà couvertes" (abonnements, déjà importées, repliées), "Ignorées par défaut" (virements internes, charges sociales, lignes mixtes). Validation en un clic par groupe, correction ligne par ligne (catégorie, nature, ignorer). Un récapitulatif avant validation finale ("X dépenses, Y encaissements, Z ignorées") avec bouton d'annulation. Aucun mot "boîte noire" : chaque ligne dit pourquoi elle est classée ainsi.
3. **Création** : encaissement = rattaché à une mission existante choisie par l'utilisatrice (liste), ou revenu ponctuel si aucune. Montant converti TTC vers HT selon le régime de TVA. Dépense = catégorie, TVA déductible selon le régime comme dans le formulaire existant. Utilise les fonctions existantes de création (ne duplique pas leur logique). Livre des recettes : une recette créée par import est une écriture normale, intangible.
4. **Solde** : à la fin, proposition de mettre à jour `soldeReel`/`soldeReelDate` avec `soldeCloture`/`dateCloture` du fichier s'ils existent, via la modale `modal-treso-anchor` existante pré-remplie, jamais écrasé sans confirmation.
5. **Limites assumées à afficher** : un seul compte à la fois, pas de PDF, le fichier n'est pas conservé.
6. **Mesure** : sans rien envoyer d'identifiant, compter localement (et exposer dans le récap) le nombre de lignes proposées, validées telles quelles, corrigées. Objectif : mesurer le taux de correction pour la phase 2.
7. **Fenêtre récap après import** (s'ouvre une fois l'import validé et les données enregistrées, jamais avant). Titre factuel : "Vous venez d'importer X € de revenus et Y € de dépenses pour [mois]". Puis 3 ou 4 constats MAXIMUM, les plus parlants, formulés comme des estimations ("environ", "à ce rythme"), au vouvoiement, sans tiret cadratin, sans culpabilisation (élan, pas reproche). Exemples de constats possibles : taux de charges du mois avant/après (ex. 21 % vers 27 %), objectif de CA du mois qui monte de X € (via les dépenses ajoutées), seuil de rentabilité dans l'unité du profil (`modules.objectif` : €/h, €/jour ou marge %, jamais "TH" en dur), trésorerie prévisionnelle qui gagne ou perd N jours.
   - **Aucun nouveau calcul** : réutilise les fonctions existantes (`getRentabiliteRoulante`, `getTauxHoraireMinCible`, `getEcheancesAVenir`, `getDisponiblePourRemuneration`...) en les appelant deux fois, avant puis après l'import (instantané de DATA avant validation), et affiche la différence.
   - **Un constat n'apparaît que si l'écart est significatif** (ex. moins de 1 point de taux de charges ou moins de 20 € d'objectif = rien). Si rien n'est significatif, le récap se limite au titre et à "Rien de changé dans vos indicateurs".
   - Chaque constat dit d'où il vient (une phrase), jamais de chiffre sans explication.
   - Vocabulaire via `tVocab`/`tVocabMasculin`. Bouton unique "Compris" (ou "Voir mon tableau de bord"). Aucune saisie demandée dans cette fenêtre.
   - Le tout dans `indepuls.html` avec miroir visuel sur `indepuls-demo.html` ; la logique de calcul des écarts va dans `shared/core/` (fonction pure `calculerImpactImport(avant, apres)`), testée.
8. **Explication à l'utilisateur** (onboarding phase 2 et "Guide & glossaire", via `renderGuideActionsHTML()` : une carte facultative "Importez votre relevé bancaire"), vouvoiement, sans tiret cadratin. Contenu : vous pouvez saisir vos dépenses et recettes au fil du mois, ou importer votre relevé une fois par mois ; Indépuls repère les doublons avec ce que vous avez déjà saisi et vous demande en cas de doute ; l'import fait gagner du temps, mais la saisie au fil de l'eau reste plus précise au jour le jour (alertes, trésorerie). Carte "vue" au clic comme les autres cartes sans signal fiable, ou cochée si `DATA.empreintesImportees` est non vide.
9. Vérifier à la main, sur chaque fixture : import complet, réimport (aucun doublon), import d'un fichier qui chevauche le précédent, annulation, import en compte démo (refusé avec message), compte partagé en lecture seule (refusé), reload après import (aucune perte), mobile 375 px.

## Livraison
Étapes courtes, tests verts à chaque étape (suite complète `shared/tests/*`, dont `cloud_sync_guard.test.js`), commit par étape, CLAUDE.md mis à jour, push. Entrée "Nouveautés" à la fin seulement.
