# Guide de tournage : démonstration Indépuls pour une OBM

Données 100 % fictives. À utiliser avec un **compte de test vierge** (pas ton compte), connecté, sans données, pour montrer l'onboarding en direct.
Ce dossier n'est pas publié sur le site (voir `.vercelignore`).

## Fichiers fournis

**Pour la vidéo : `releve_demo_OBM_court.csv`** (juillet au 20 octobre 2026, 37 lignes, solde 2 800 € à 3 847,73 €). Il donne un écran d'import léger : 5 abonnements, 3 clients (7 encaissements), 1 seul écart URSSAF (52 € sur le prélèvement du 10 octobre). Les chiffres de la section « Ce que l'import va montrer » ci-dessous correspondent à ce fichier.

`releve_demo_OBM.csv` (janvier au 20 octobre, 118 lignes, 5 clients) reste disponible pour tester un gros import, mais il est trop lourd à l'écran pour la vidéo.

Détail du fichier long :

`releve_demo_OBM.csv` : relevé de janvier au 20 octobre 2026, au format d'un export Crédit Mutuel (Date; Date de valeur; Débit; Crédit; Libellé; Solde).
118 lignes, solde d'ouverture 3 200,00 €, solde de clôture 7 217,31 €.

## Réglages à saisir avant d'importer (onboarding)

| Réglage | Valeur proposée |
|---|---|
| Profil | Prestataire de services |
| Statut | Micro-entreprise BNC (libérale), choisi dans Paramètres : les taux (25,6 % + 0,2 %) s'appliquent alors tout seuls, nécessaires pour que le contrôle URSSAF donne le résultat attendu |
| Début d'activité | Janvier 2026 |
| Objectif de revenu net mensuel | 2 500 € |
| Rythme de travail | 7 h par jour, 4 jours par semaine, 44 semaines par an |
| TVA | Non (franchise en base) |
| Régime URSSAF | Mensuel |

À montrer : où on règle l'objectif, et ce que ça change dans « Combien facturer ? » (le minimum à facturer).

## Ce que l'import va montrer (dans l'ordre à l'écran, fichier court)

1. **Abonnements repérés (5)** : Notion, Free Mobile, Canva, Zoom, Google Workspace. Cochés : une dépense récurrente chacun, qui disparaît de la liste des dépenses. Il reste 2 dépenses à vérifier (SNCF, OVH).
2. **Argent reçu** : sur un compte sans mission (cas de la vidéo), les 3 clients sont **déjà regroupés** à l'ouverture de l'écran, avec la forme et le statut proposés. Rien n'est créé avant « Importer ». (Sur un import suivant, il faut cliquer sur « Créer une mission par client pour ces entrées ».)
   - Studio Lumière : mission récurrente, en cours (1 200 € par mois depuis juillet).
   - Maison Elia : plusieurs paiements (acompte 1 500 € en juillet, solde 1 500 € en août), terminée.
   - Bijoux Léa : mission simple, 450 € en août, terminée.
3. **Ignorées par défaut (8)** : virement permanent personnel, restaurant, retrait, allocation CAF, charges sociales.
4. **Récapitulatif** : mise à jour du solde (3 847,73 € au 20/10/2026) et **contrôle URSSAF** : le prélèvement du 10 septembre est conforme, celui du **10 octobre** a un écart volontaire de 52 € (le récapitulatif annonce une alerte dans le tableau de bord). Après l'import, montre l'**alerte du tableau de bord** : elle explique l'écart (il manquerait environ 200 € de chiffre d'affaires) et propose les pistes à vérifier. Si tu ajoutes un encaissement de 200 € en août, l'alerte disparaît toute seule : bon moment pour le montrer, puis le retirer.
5. **Écran final** : fenêtre d'impact et liste des missions « à compléter ».

(Le fichier long donne 5 clients, 7 abonnements et un écart en août.)

## Les 3 missions à compléter ensuite (« Compléter la fiche »)

| Mission | Ce qu'on ajoute | Pour montrer |
|---|---|---|
| Studio Lumière (récurrente) | Description « Gestion mensuelle de la communication », temps prévu 15 h par mois | Temps prévu contre temps réel |
| Maison Elia (projet) | Description « Lancement d'une formation en ligne », temps prévu 38 h | Taux horaire réel d'un projet |
| Bijoux Léa (ponctuelle) | Description « Audit et plan d'action », temps prévu 6 h | Mission courte, bon taux horaire |

Ensuite : démarrer le **chrono** sur Studio Lumière quelques minutes, ajouter du temps interne, poser des **congés**, regarder le **taux de remplissage**.

## Outils à présenter pour un nouveau client

- **Combien facturer ?** : vérifier un prix, puis calculer le tarif minimum.
- **Et si ?** : perdre un client, changer de rythme, « Et si je déléguais ? ».
- **Créer un devis**.

## Ordre conseillé (vidéo de 6 à 7 minutes)

1. Toi à l'écran : qui tu es, la question « Est-ce que ça va ? » (20 s).
2. Le résultat d'abord : le tableau de bord rempli, 10 secondes pour donner envie.
3. « Comment on y arrive » : réglages et objectifs (1 min), import du relevé (1 min 30), missions (45 s).
4. Suivi du temps, chrono, remplissage, congés (1 min).
5. Les outils pour un nouveau client (1 min).
6. Une citation courte d'une bêta OBM (5 à 10 s), puis toi à l'écran pour conclure et renvoyer vers la description (offre, code, lien).

## Avant de filmer

- Fermer les notifications, mettre l'écran en 1920 × 1080, zoom navigateur à 110 ou 125 %.
- Vérifier chaque écran la veille : ne rien montrer qui ne soit pas en ligne au lancement.
- Faire une prise par séquence et couper les silences au montage.
