# Faux relevés bancaires (données 100 % fictives)

Un même relevé de 23 lignes (juillet à septembre 2026, solde d'ouverture 8 000,00 €, solde de clôture 6 875,09 €) exporté dans 7 formats différents. Après parsing, TOUS doivent produire exactement `expected_normalized.json` (7 fichiers sauf G, voir plus bas).

| Fichier | Variante couverte |
|---|---|
| A_semicolon_signed_utf8bom.csv | séparateur `;`, UTF-8 avec BOM, dates JJ/MM/AAAA, virgule décimale, montant signé, colonne Devise |
| B_debit_credit_latin1_header_noise.csv | latin-1 (accents), 5 lignes parasites avant l'en-tête, colonnes Débit/Crédit séparées, espace comme séparateur de milliers, plus récent en premier, 2 colonnes de date |
| C_comma_iso_quoted_balance.csv | séparateur `,`, UTF-8, dates ISO AAAA-MM-JJ, point décimal, champs entre guillemets, colonne solde cumulé |
| D_cp1252_euro_dots_footer.csv | cp1252, `€` dans l'en-tête, point comme séparateur de milliers, pied de page "Solde au 30/09/2026" |
| E_ofx_sgml_v1.ofx | OFX 1.02 SGML (balises non fermées), cp1252 |
| F_ofx_xml_v2.ofx | OFX 2.x XML, UTF-8 |
| G_edge_cases.csv | cas tordus (voir ci-dessous), à tester séparément |

## Attendus du fichier G (aucun plantage, lignes rejetées signalées une par une)
- `1 800,00` avec espace insécable (U+00A0) = 1800.00, libellé contenant un `;` entre guillemets conservé en entier
- ligne vide ignorée
- `31/02/2026` : date impossible, ligne rejetée avec motif
- `abc` : montant illisible, ligne rejetée avec motif
- `(19,99)` : montant entre parenthèses = négatif -19.99
- ligne sans montant : rejetée avec motif
- `-1 316,00` avec espace insécable = -1316.00

## Cas métier portés par le champ `hint` de `expected_normalized.json`
- `recurrente:*` : abonnements Adobe, Free, AXA (montant fixe) et EDF (montant qui varie de quelques euros chaque mois, doit rester rapproché)
- `encaissement:rapproche_manuel_dupont_ttc` : 1 800,00 € TTC reçu. L'encaissement saisi à la main dans Indépuls est de 1 500,00 € HT (TVA 20 %). Doit être proposé comme rapprochement, pas comme doublon ni comme nouvelle recette
- `depense:rapproche_manuel_leroymerlin` : 142,50 € déjà saisie à la main avec 2 jours d'écart de date
- `encaissement:nouveau` : doit être proposé en nouvel encaissement
- `charges_sociales` : URSSAF, catégorie suggérée par mot-clé. NB : une charge sociale n'est pas une dépense professionnelle à créer sans réfléchir (voir le prompt)
- `mixte:ignorer_par_defaut` : restaurant, compte mixte
- `interne:ignorer` : virement permanent vers un particulier
- `doublon_legitime:ligne1/ligne2` : deux lignes réellement identiques le même jour (deux achats à la boulangerie). Les deux doivent être importées. Le dédoublonnage compare à des imports PRÉCÉDENTS, jamais les lignes d'un même fichier entre elles
- `frais_bancaires` : commission de tenue de compte

## Limite à connaître
Ces fichiers couvrent les variantes de FORMAT les plus courantes, pas la réalité exacte de chaque banque (noms d'en-têtes, encodage, lignes parasites varient). Ils servent à tester la logique, pas à prouver la compatibilité avec une banque donnée. Pour cela, demander aux bêtas uniquement la ligne d'en-tête de leur export.
