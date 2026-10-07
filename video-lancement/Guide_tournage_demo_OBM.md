# Guide de tournage : démonstration Indépuls pour une OBM

Données 100 % fictives. À utiliser avec un **compte de test vierge** (pas ton compte), connecté, sans données, pour montrer l'onboarding en direct.
Ce dossier n'est pas publié sur le site (voir `.vercelignore`).

## Fichier fourni

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

## Ce que l'import va montrer (dans l'ordre à l'écran)

1. **Abonnements repérés (7)** : Notion, Canva, Zoom, assurance pro, Google Workspace, Free, frais bancaires. Case cochée : une dépense récurrente à la place de dizaines de dépenses ponctuelles.
2. **Argent reçu : « Créer une mission par client »** : 5 clients regroupés en un clic.
   - Studio Lumière : mission récurrente, en cours (1 200 € par mois depuis janvier).
   - Atelier Nova : mission récurrente, en cours (900 € par mois depuis mars).
   - Sophie Martin Coaching : mission récurrente, en cours (650 € par mois depuis juin).
   - Maison Elia : plusieurs paiements (acompte 1 500 € en février, solde 1 500 € en mai), terminée.
   - Bijoux Léa : mission simple, 450 € en août, terminée.
3. **Ignorées par défaut** : virement permanent personnel, restaurant, boulangerie, retrait, allocation CAF, charges sociales.
4. **Récapitulatif** : mise à jour du solde (7 217,31 € au 20/10/2026) et **contrôle URSSAF** : tous les prélèvements correspondent à la prévision sauf celui du 10 août, avec un écart volontaire de 52 € (bon moment pour expliquer l'écart et le chiffre d'affaires déclaré implicite).
5. **Écran final** : fenêtre d'impact et liste des missions « à compléter ».

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
