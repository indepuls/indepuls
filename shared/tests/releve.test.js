/**
 * Tests : import de relevé bancaire, moteur pur (shared/core/releve.js et releve_classement.js).
 * S'appuie sur les faux relevés de shared/tests/fixtures/releves/ (données 100 % fictives).
 * Exécution : node shared/tests/releve.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..');
const DIR = path.join(__dirname, 'fixtures', 'releves');

let PASS = 0, FAIL = 0;
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach((k) => { o[k] = canon(v[k]); }); return o; }
  return v;
}
const eq = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
function test(label, attendu, obtenu) {
  if (eq(attendu, obtenu)) { PASS++; console.log(`  ✅ ${label}`); }
  else { FAIL++; console.log(`  ❌ ${label} : attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`); }
}
function section(t) { console.log(`\n── ${t} ──────────────────────────────`); }
const lire = (f) => fs.readFileSync(path.join(DIR, f));

async function main() {
  const R = await import(pathToFileURL(path.join(ROOT, 'core', 'releve.js')).href);
  const C = await import(pathToFileURL(path.join(ROOT, 'core', 'releve_classement.js')).href);
  const I = await import(pathToFileURL(path.join(ROOT, 'core', 'releve_import.js')).href);
  const exp = JSON.parse(fs.readFileSync(path.join(DIR, 'expected_normalized.json'), 'utf8'));
  const attendues = exp.transactions.map((t) => ({ date: t.date, libelle: t.libelle, montant: t.montant }));
  const simples = (r) => r.lignes.map((l) => ({ date: l.date, libelle: l.libelle, montant: l.montant }));

  section('0.1 Lecture : les 6 fichiers produisent exactement le relevé attendu');
  const fichiers = ['A_semicolon_signed_utf8bom.csv', 'B_debit_credit_latin1_header_noise.csv', 'C_comma_iso_quoted_balance.csv',
    'D_cp1252_euro_dots_footer.csv', 'E_ofx_sgml_v1.ofx', 'F_ofx_xml_v2.ofx'];
  fichiers.forEach((f) => {
    const r = R.parseReleve(lire(f));
    test(f + ' : lignes', attendues, simples(r));
    test(f + ' : aucun rejet', 0, r.rejets.length);
    test(f + ' : devise EUR', 'EUR', r.devise);
  });

  section('0.1 Encodage et formats');
  test('A : UTF-8 avec BOM', 'utf-8', R.parseReleve(lire(fichiers[0])).encodage);
  test('B : cp1252/latin-1 (accents)', 'cp1252', R.parseReleve(lire(fichiers[1])).encodage);
  test('D : cp1252 avec €', 'cp1252', R.parseReleve(lire(fichiers[3])).encodage);
  test('E : format OFX', 'ofx', R.parseReleve(lire(fichiers[4])).format);
  test('OFX : libellé complet (MEMO) quand NAME est tronqué', 'PRLV SEPA EDF CLIENTS PARTICULIERS', R.parseReleve(lire(fichiers[4])).lignes[2].libelle);
  test('OFX : l\'identifiant de la banque (FITID) est lu', true, !!R.parseReleve(lire(fichiers[4])).lignes[0].ficheId);

  section('0.1 Soldes');
  test('C : solde d\'ouverture dérivé de la colonne solde', 8000, R.parseReleve(lire(fichiers[2])).soldeOuverture);
  test('C : solde de clôture et date', [6875.09, '2026-09-30'], [R.parseReleve(lire(fichiers[2])).soldeCloture, R.parseReleve(lire(fichiers[2])).dateCloture]);
  test('D : solde de clôture lu dans le pied de page', [6875.09, '2026-09-30'], [R.parseReleve(lire(fichiers[3])).soldeCloture, R.parseReleve(lire(fichiers[3])).dateCloture]);
  test('E et F : solde de clôture (LEDGERBAL)', [6875.09, 6875.09], [R.parseReleve(lire(fichiers[4])).soldeCloture, R.parseReleve(lire(fichiers[5])).soldeCloture]);
  test('A : pas de solde (pas inventé)', [null, null], [R.parseReleve(lire(fichiers[0])).soldeCloture, R.parseReleve(lire(fichiers[0])).soldeOuverture]);

  section('0.1 Cas tordus (fichier G) : aucune exception, rejets motivés');
  {
    const g = R.parseReleve(lire('G_edge_cases.csv'));
    test('G : 3 lignes valides', [
      { date: '2026-09-02', libelle: 'VIR SEPA DUPONT SAS; FACT 2026-041', montant: 1800 },
      { date: '2026-09-05', libelle: 'PRLV SEPA FREE MOBILE', montant: -19.99 },
      { date: '2026-09-10', libelle: 'PRLV URSSAF AUTO ENTREPRENEUR', montant: -1316 },
    ], simples(g));
    test('G : 3 rejets avec motif', ['Date impossible', 'Montant illisible', 'Montant manquant'], g.rejets.map((x) => x.motif));
    test('G : le libellé avec un ; entre guillemets est conservé entier', true, g.lignes[0].libelle.includes('; FACT'));
  }

  section('0.1 Robustesse : un mauvais fichier ne plante jamais');
  test('fichier vide', 'vide', R.parseReleve(Buffer.from('')).erreur.code);
  test('PDF refusé avec un message clair', 'pdf_non_supporte', R.parseReleve(Buffer.from('%PDF-1.4 ...')).erreur.code);
  test('Excel refusé avec un message clair', 'excel_non_supporte', R.parseReleve(Buffer.from([0x50, 0x4B, 0x03, 0x04, 1, 2])).erreur.code);
  test('texte quelconque : colonnes à choisir', true, !!R.parseReleve(Buffer.from('foo;bar\n1;2\n')).mappingNecessaire);
  test('octets au hasard : pas d\'exception', true, (() => { try { R.parseReleve(Buffer.from([1, 2, 3, 250, 251, 252])); return true; } catch (e) { return false; } })());
  test('fichier trop volumineux refusé', 'trop_volumineux', R.parseReleve(Buffer.alloc(R.LIMITE_OCTETS + 10, 65)).erreur.code);

  section('0.1 Mapping manuel de repli');
  {
    const csv = 'quand;quoi;combien\n03/07/2026;ADOBE;-29,99\n04/07/2026;FREE;-19,99\n';
    const auto = R.parseReleve(Buffer.from(csv));
    test('en-têtes inconnus : demande de mapping', true, !!auto.mappingNecessaire);
    const manuel = R.parseReleve(Buffer.from(csv), { mapping: { date: 0, libelle: 1, montant: 2 }, ligneEntete: 0 });
    test('avec mapping manuel : lignes lues', [{ date: '2026-07-03', libelle: 'ADOBE', montant: -29.99 }, { date: '2026-07-04', libelle: 'FREE', montant: -19.99 }], simples(manuel));
  }

  section('0.1 En-tête réel Boursorama (colonne montant nommée "Solde", seconde colonne "Solde" = solde du compte)');
  {
    const csv = 'Date Opération;Date Valeur;Libellé;Libellé Suggéré;Catégorie;Catégorie Parente;Solde;Commentaire;Numéro Compte;Libellé Compte;Solde;Pointage\n'
      + '2026-09-18;2026-09-18;CARTE 17/09/26 AMAZON;Amazon;Livres, CD/DVD, bijoux;Vie quotidienne;-6,99;;40086502;BoursoBank;1,81;Non\n'
      + '2026-09-17;2026-09-17;VIR SEPA DUPONT SAS;;Revenus;Revenus;1800,00;;40086502;BoursoBank;8,80;Non\n';
    const r = R.parseReleve(Buffer.from(csv, 'utf8'));
    test('Boursorama : lignes (plus ancien d\'abord)', [
      { date: '2026-09-17', libelle: 'VIR SEPA DUPONT SAS', montant: 1800 },
      { date: '2026-09-18', libelle: 'CARTE 17/09/26 AMAZON', montant: -6.99 },
    ], simples(r));
    test('Boursorama : solde de clôture lu dans la seconde colonne Solde', [1.81, '2026-09-18'], [r.soldeCloture, r.dateCloture]);
    test('Boursorama : aucun rejet', 0, r.rejets.length);
  }


  section('0.1 En-tête réel Banque Populaire (Date comptable, Libelle simplifie, Debit, Credit, Date operation)');
  {
    const csv = 'Date comptable;Libelle simplifie;Reference;Informations complementaires;Type operation;Debit;Credit;Date operation;Date de valeur;Pointage\n'
      + '08/09/2026;PRLV CENTRE PAJEMPLOI;REF123;PRLV SEPA CENTRE PAJEMPLOI ECH 0809;Prelevement;-123,15;;07/09/2026;08/09/2026;\n'
      + '10/09/2026;VIR MARTIN CONSEIL;REF9;VIR SEPA MARTIN CONSEIL FACT 12;Virement;;960,00;10/09/2026;10/09/2026;\n';
    const attendu = [{ date: '2026-09-07', libelle: 'PRLV CENTRE PAJEMPLOI', montant: -123.15 }, { date: '2026-09-10', libelle: 'VIR MARTIN CONSEIL', montant: 960 }];
    test('Banque Populaire (UTF-8) : colonnes reconnues, date d\'opération, débit et crédit', attendu, simples(R.parseReleve(Buffer.from(csv, 'utf8'))));
    test('Banque Populaire (latin-1) : même résultat', attendu, simples(R.parseReleve(Buffer.from(csv, 'latin1'))));
    test('Banque Populaire : aucun rejet, pas de choix de colonnes demandé', [0, undefined], [R.parseReleve(Buffer.from(csv, 'utf8')).rejets.length, R.parseReleve(Buffer.from(csv, 'utf8')).mappingNecessaire]);
  }


  section('0.1 En-tête réel Crédit Mutuel (Date, Date de valeur, Débit, Crédit, Libellé, Solde), lignes fictives');
  {
    const csv = 'Date;Date de valeur;D\u00e9bit;Cr\u00e9dit;Libell\u00e9;Solde\n'
      + '04/09/2026;04/09/2026;;672,74;VIR CLIENT EXEMPLE 0852423;-358,77\n'
      + '04/09/2026;01/09/2026;-14,50;;F COTIS  ASSURANCE EXEMPLE;-373,27\n'
      + '15/09/2026;15/09/2026;-42,99;;PAIEMENT CB 1409 PARIS ORANGE VAD 73 CARTE 2080 HIP0100;-416,26\n';
    const r = R.parseReleve(Buffer.from(csv, 'latin1'));
    test('Crédit Mutuel (cp1252) : lignes, débit déjà négatif, crédit positif', [
      { date: '2026-09-04', libelle: 'VIR CLIENT EXEMPLE 0852423', montant: 672.74 },
      { date: '2026-09-04', libelle: 'F COTIS ASSURANCE EXEMPLE', montant: -14.5 },
      { date: '2026-09-15', libelle: 'PAIEMENT CB 1409 PARIS ORANGE VAD 73 CARTE 2080 HIP0100', montant: -42.99 },
    ], simples(r));
    test('Crédit Mutuel : encodage cp1252, date d\'opération, aucun rejet', ['cp1252', 0], [r.encodage, r.rejets.length]);
    test('Crédit Mutuel : soldes déduits de la colonne Solde (ouverture et clôture)', [-1031.51, -416.26, '2026-09-15'], [r.soldeOuverture, r.soldeCloture, r.dateCloture]);
  }

  section('0.2 Empreintes : stables, et deux lignes identiques ont deux empreintes différentes');
  {
    const a = R.parseReleve(lire(fichiers[0])), b = R.parseReleve(lire(fichiers[0]));
    const ea = R.empreintesLignes(a.lignes).map((e) => e.id), eb = R.empreintesLignes(b.lignes).map((e) => e.id);
    test('réimport du même fichier : mêmes empreintes', ea, eb);
    test('les 23 empreintes sont toutes différentes (doublon légitime inclus)', 23, new Set(ea).size);
    const partiel = { lignes: a.lignes.slice(8, 20) };
    const ep = R.empreintesLignes(partiel.lignes).map((e) => e.id);
    test('période qui se chevauche : mêmes empreintes pour les lignes communes', ea.slice(8, 20), ep);
    const csvA = R.parseReleve(lire(fichiers[0])), ofx = R.parseReleve(lire(fichiers[4]));
    const souplesCsv = R.empreintesLignes(csvA.lignes).map((e) => e.souple), souplesOfx = R.empreintesLignes(ofx.lignes).map((e) => e.souple);
    test('un même relevé en CSV et en OFX : empreintes souples identiques', souplesCsv, souplesOfx);
    test('OFX : l\'empreinte principale vient de l\'identifiant de la banque', true, R.empreintesLignes(ofx.lignes)[0].id.startsWith('f:'));
  }

  // ── Jeu de données Indépuls pour le classement ─────────────────────────────────────────────────
  const DATA = () => ({
    params: { tva: true, tauxTVA: 20 },
    missions: [{ id: 'm-dupont', client: 'Dupont SAS', encaissements: [{ id: 'e1', date: '2026-08-30', montant: 1500, montantTTC: 1800, type: 'paiement' }] }],
    depenses: [
      { id: 'd-lm', date: '2026-09-06', montant: 142.5, recurrence: 'ponctuelle', libelle: 'Leroy Merlin', categorie: 'Matériel & équipement' },
      { id: 'r-adobe', date: '2026-07-03', montant: 29.99, recurrence: 'mensuelle', dateDebut: '2026-07-03', libelle: 'Adobe Creative Cloud' },
      { id: 'r-free', date: '2026-07-05', montant: 19.99, recurrence: 'mensuelle', dateDebut: '2026-07-05', libelle: 'Free Mobile' },
      { id: 'r-edf', date: '2026-07-07', montant: 80, recurrence: 'mensuelle', dateDebut: '2026-07-07', libelle: 'EDF électricité' },
      { id: 'r-axa', date: '2026-07-17', montant: 64, recurrence: 'mensuelle', dateDebut: '2026-07-17', libelle: 'AXA assurance pro' },
    ],
    revenus: {},
  });
  const parsed = R.parseReleve(lire(fichiers[0]));
  const idx = (txt, date) => parsed.lignes.findIndex((l) => l.libelle.includes(txt) && (!date || l.date === date));

  section('0.3 Dédoublonnage en 3 niveaux');
  {
    const cl = C.classerLignes(DATA(), parsed.lignes, []);
    const dup = cl[idx('DUPONT')];
    test('Dupont (1 500 HT saisi, 1 800 en banque) : rapprochement proposé, pas une nouvelle recette',
      ['rapprochement_propose', 'encaissement', 'e1', 'montant_ttc'], [dup.statut, dup.candidat.type, dup.candidat.id, dup.candidat.motif]);
    const lm = cl[idx('LEROY')];
    test('Leroy Merlin (142,50, 2 jours d\'écart) : rapprochement proposé', ['rapprochement_propose', 'depense', 'd-lm', 2], [lm.statut, lm.candidat.type, lm.candidat.id, lm.candidat.ecartJours]);
    test('Martin Conseil (aucune saisie) : nouvelle ligne', 'nouvelle', cl[idx('MARTIN')].statut);
    const b1 = idx('BOULANGERIE'), b2 = parsed.lignes.findIndex((l, i) => i > b1 && l.libelle.includes('BOULANGERIE'));
    test('doublon légitime : les deux lignes restent nouvelles, avec deux empreintes différentes', ['nouvelle', 'nouvelle', true], [cl[b1].statut, cl[b2].statut, cl[b1].empreinte !== cl[b2].empreinte]);
    const deja = cl.map((c) => c.empreinte);
    const re = C.classerLignes(DATA(), parsed.lignes, deja);
    test('réimport : toutes les lignes sont "déjà importées", rien n\'est proposé', true, re.every((c) => c.statut === 'deja_importee'));
    const lignesOfx = R.parseReleve(lire(fichiers[4])).lignes;
    const apresCsv = C.classerLignes(DATA(), lignesOfx, deja.concat(cl.map((c) => c.souple)));
    test('même relevé réexporté en OFX : ligne dont seule l\'empreinte souple correspond = on demande', true, apresCsv.every((c) => c.statut === 'peut_etre_deja_importee' || c.statut === 'deja_importee'));
    // Une saisie ne se rapproche que d'UNE ligne bancaire.
    const d2 = DATA();
    const deuxLignes = [{ date: '2026-09-08', libelle: 'CB LEROY MERLIN 1', montant: -142.5 }, { date: '2026-09-09', libelle: 'CB LEROY MERLIN 2', montant: -142.5 }];
    const cl2 = C.classerLignes(d2, deuxLignes, []);
    test('une saisie ne sert qu\'une fois (l\'autre ligne reste nouvelle)', ['rapprochement_propose', 'nouvelle'], cl2.map((c) => c.statut));
    test('la saisie la plus proche en date est choisie', 'rapprochement_propose', cl2[0].statut);
    // Une saisie déjà rapprochée (importId) n'est plus candidate.
    const d3 = DATA(); d3.depenses.find((d) => d.id === 'd-lm').importId = 'h:xx';
    test('saisie déjà rapprochée : plus candidate', 'nouvelle', C.classerLignes(d3, [deuxLignes[0]], [])[0].statut);
    // Franchise de TVA : HT = TTC.
    const d4 = DATA(); d4.params.tva = false; d4.missions[0].encaissements[0] = { id: 'e2', date: '2026-08-30', montant: 1800, type: 'paiement' };
    test('compte en franchise de TVA : 1 800 saisi = 1 800 en banque', 'rapprochement_propose', C.classerLignes(d4, [parsed.lignes[idx('DUPONT')]], [])[0].statut);
    // Encaissement annulé : jamais candidat.
    const d5 = DATA(); d5.missions[0].encaissements[0].statutLivre = 'annulee';
    test('encaissement annulé : jamais proposé', 'nouvelle', C.classerLignes(d5, [parsed.lignes[idx('DUPONT')]], [])[0].statut);
    // DATA n'est jamais modifié.
    const avant = JSON.stringify(DATA()); const d6 = DATA(); C.classerLignes(d6, parsed.lignes, []); C.analyserReleve(d6, parsed, [], []);
    test('DATA n\'est jamais modifié par l\'analyse', avant, JSON.stringify(d6));
  }

  section('0.4 Abonnements (dépenses récurrentes)');
  {
    const rec = C.rapprocherRecurrentes(DATA(), parsed.lignes);
    const couv = (txt) => parsed.lignes.map((l, i) => ({ l, c: rec.couvertures[i] })).filter((x) => x.l.libelle.includes(txt)).map((x) => x.c && x.c.statut);
    test('Adobe, Free, AXA : couverts chaque mois', [['couverte', 'couverte', 'couverte'], ['couverte', 'couverte', 'couverte'], ['couverte', 'couverte', 'couverte']], [couv('ADOBE'), couv('FREE'), couv('AXA')]);
    test('EDF (montant qui varie de quelques euros) : toujours couvert', ['couverte', 'couverte', 'couverte'], couv('EDF'));
    test('URSSAF : jamais prise pour un abonnement', [null, null], couv('URSSAF'));
    const maj = rec.propositions.find((p) => p.type === 'maj_montant' && p.depenseId === 'r-edf');
    test('EDF : écart qui dure 3 mois => proposition de mettre à jour le montant', true, !!maj && Math.abs(maj.montantSuggere - 87.76) < 0.02);
    test('Adobe (montant identique) : pas de proposition de mise à jour', undefined, rec.propositions.find((p) => p.depenseId === 'r-adobe'));
    // Une récurrente ne couvre qu'UNE ligne par mois.
    const deux = [{ date: '2026-09-03', libelle: 'PRLV ADOBE', montant: -29.99 }, { date: '2026-09-04', libelle: 'PRLV ADOBE', montant: -29.99 }];
    test('une récurrente ne couvre qu\'une ligne par mois', [true, false], C.rapprocherRecurrentes(DATA(), deux).couvertures.map((c) => !!c));
    // Libellé différent mais même montant et même jour : on demande.
    const doute = C.rapprocherRecurrentes(DATA(), [{ date: '2026-09-17', libelle: 'PRLV XYZ SARL', montant: -64 }]).couvertures[0];
    test('libellé différent, même montant et jour : doute (on demande)', 'doute', doute && doute.statut);
    // Jour trop éloigné : pas couvert.
    test('jour trop éloigné (plus de 5 jours) : pas couvert', null, C.rapprocherRecurrentes(DATA(), [{ date: '2026-09-28', libelle: 'PRLV AXA FRANCE PRO', montant: -64 }]).couvertures[0]);
    // Libellé et montant qui reviennent 3 mois sans abonnement : proposition de création.
    const sansAbo = DATA(); sansAbo.depenses = sansAbo.depenses.filter((d) => d.recurrence === 'ponctuelle');
    const an = C.analyserReleve(sansAbo, parsed, [], []);
    const crees = an.propositions.filter((p) => p.type === 'creer_recurrente').map((p) => p.libelle);
    test('Adobe, Free, AXA (même montant 3 mois, sans abonnement) : proposition de créer une récurrente', 3, crees.length);
    test('EDF (montant variable) : pas proposé en abonnement fixe', false, crees.some((l) => l.includes('EDF')));
  }

  section('0.5 Catégorisation par mots-clés et nature');
  {
    const natureAttendue = (hint) => {
      if (hint.startsWith('recurrente')) return 'depense';
      if (hint === 'charges_sociales') return 'charges_sociales';
      if (hint.startsWith('encaissement')) return 'encaissement';
      if (hint.startsWith('depense')) return 'depense';
      if (hint.startsWith('mixte')) return 'a_ignorer';
      if (hint.startsWith('interne')) return 'interne';
      if (hint.startsWith('doublon')) return 'a_ignorer';
      if (hint === 'frais_bancaires') return 'depense';
      return '?';
    };
    exp.transactions.forEach((t, i) => {
      const p = C.proposerCategorie(t.libelle, [], t.montant);
      test('nature « ' + t.hint + ' » (' + t.libelle.slice(0, 34) + ')', natureAttendue(t.hint), p.nature);
    });
    test('Adobe : Logiciels & abonnements', 'Logiciels & abonnements', C.proposerCategorie('PRLV SEPA ADOBE SYSTEMS SOFTWARE', [], -29.99).categorie);
    test('Free Mobile : Téléphonie & internet', 'Téléphonie & internet', C.proposerCategorie('PRLV SEPA FREE MOBILE', [], -19.99).categorie);
    test('AXA : Assurances & prévoyance', 'Assurances & prévoyance', C.proposerCategorie('PRLV SEPA AXA FRANCE PRO', [], -64).categorie);
    test('frais de tenue de compte : Frais bancaires', 'Frais bancaires', C.proposerCategorie('COMMISSION FRAIS TENUE DE COMPTE', [], -9.9).categorie);
    test('un virement vers une société n\'est pas pris pour un virement interne', 'depense', C.proposerCategorie('VIR SEPA MARTIN CONSEIL REF 889', [], -960).nature);
    test('un remboursement reçu n\'est pas un encaissement', 'remboursement', C.proposerCategorie('REMBOURSEMENT AMAZON', [], 25).nature);
    test('impôts : nature à part, jamais une dépense', 'impots', C.proposerCategorie('PRLV DGFIP TVA', [], -300).nature);
    const apprise = C.proposerCategorie('CB AMAZON EU SARL', [{ motCle: 'amazon', categorie: 'Matériel & équipement', nature: 'depense' }], -59.9);
    test('règle apprise : prime sur la table par défaut', ['Matériel & équipement', 'apprise', 'haute'], [apprise.categorie, apprise.source, apprise.confiance]);
    test('règle apprise : peut ignorer un commerçant', 'a_ignorer', C.proposerCategorie('CB BOULANGERIE', [{ motCle: 'boulangerie', categorie: null, nature: 'a_ignorer' }], -4.5).nature);
    test('chaque proposition dit pourquoi', true, exp.transactions.every((t) => !!C.proposerCategorie(t.libelle, [], t.montant).motif));
  }

  section('Rapprochement "montant légèrement différent" (saisie arrondie à la main)');
  {
    const d = () => ({ params: { tva: false }, missions: [], revenus: {}, depenses: [{ id: 'd-pe', date: '2026-09-08', montant: 123, recurrence: 'ponctuelle', libelle: 'centre pajemploi', categorie: 'Autre' }] });
    const ligne = (over) => Object.assign({ date: '2026-09-08', libelle: 'PRLV SEPA CENTRE PAJEMPLOI', montant: -123.15 }, over || {});
    const un = (l, data) => C.classerLignes(data || d(), [l], [])[0];
    const c1 = un(ligne());
    test('123,00 saisi contre 123,15 en banque, même libellé : rapprochement proposé', ['rapprochement_propose', 'montant_proche', -0.15, 'd-pe'], [c1.statut, c1.candidat.motif, c1.candidat.ecartMontant, c1.candidat.id].map((x, i) => (i === 2 ? Math.round(x * 100) / 100 : x)));
    test('l\'explication le dit clairement', true, c1.explication.includes('légèrement différent'));
    test('libellé différent : PAS de rapprochement (reste une nouvelle dépense)', 'nouvelle', un(ligne({ libelle: 'CB AMAZON EU SARL' })).statut);
    test('écart trop grand (plus de 1 € et 2 %) : pas de rapprochement', 'nouvelle', un(ligne({ montant: -130 })).statut);
    test('date trop éloignée : pas de rapprochement', 'nouvelle', un(ligne({ date: '2026-09-20' })).statut);
    test('un montant exact reste prioritaire sur un montant proche', 'montant_ttc', (() => { const dd = d(); dd.depenses.push({ id: 'd-exact', date: '2026-09-08', montant: 123.15, recurrence: 'ponctuelle', libelle: 'centre pajemploi' }); return un(ligne(), dd).candidat.motif; })());
    // Encaissement : client reconnu, montant arrondi.
    const dEnc = { params: { tva: true, tauxTVA: 20 }, revenus: {}, depenses: [], missions: [{ id: 'm1', client: 'Martin Conseil', encaissements: [{ id: 'e1', date: '2026-09-10', montant: 800, montantTTC: 960 }] }] };
    const ce = un({ date: '2026-09-12', libelle: 'VIR SEPA MARTIN CONSEIL', montant: 960.4 }, dEnc);
    test('encaissement : client reconnu et montant proche : rapprochement proposé', ['rapprochement_propose', 'montant_proche'], [ce.statut, ce.candidat.motif]);
    test('encaissement : autre client, montant proche : pas de rapprochement', 'nouvelle', un({ date: '2026-09-12', libelle: 'VIR SEPA AUTRE CLIENT', montant: 960.4 }, dEnc).statut);
  }


  section('Organismes non professionnels, échéances de prêt, libellés lisibles (retour test Crédit Mutuel)');
  {
    const nat = (l, m) => C.proposerCategorie(l, [], m).nature;
    test('virements CAF, CPAM, France Travail : pas un revenu professionnel, ignorés par défaut', ['interne', 'interne', 'interne'], [nat('VIR CAF DE SAONE ET LOIRE 0852423', 672), nat('VIR CPAM SAONE ET LOIRE 262520005600', 19), nat('VIR FRANCE TRAVAIL', 800)]);
    test('un café n\'est pas pris pour la CAF', 'a_ignorer', nat('CB CAFE DU COIN', -3));
    test('échéance de prêt : à saisir à part, ignorée par défaut', ['a_ignorer', 'pret'], [nat('ECH PRET CAP+IN 07355 202922 05', -469), C.proposerCategorie('ECH PRET CAP+IN 07355', [], -469).type]);
    test('les clients qui paient restent de l\'argent reçu', 'encaissement', nat('VIR SEPA DUPONT SAS FACT 2026-041', 1800));
    const L = R.libelleNettoye;
    test('paiement par carte : mention, date collée, numéro de carte et référence retirés', 'PARIS ORANGE', L('PAIEMENT CB 1409 PARIS ORANGE VAD 73 CARTE 2080 HIP010081046137175'));
    test('prélèvement : mention bancaire retirée', 'ADOBE SYSTEMS SOFTWARE', L('PRLV SEPA ADOBE SYSTEMS SOFTWARE'));
    test('virement : référence et numéro de facture retirés', ['MARTIN CONSEIL', 'DUPONT SAS'], [L('VIR SEPA MARTIN CONSEIL REF 889'), L('VIR SEPA DUPONT SAS FACT 2026-041')]);
    test('référence collée au nom retirée', 'AMAZON PAYMENTS', L('PAIEMENT CB 1409 PARIS2441535/ AMAZON PAYMENTS CARTE 2080 HIR012625902354682'));
    test('un libellé déjà propre reste intact', 'COMMISSION FRAIS TENUE DE COMPTE', L('COMMISSION FRAIS TENUE DE COMPTE'));
    test('libellé vide ou réduit à rien : on garde l\'original', 'CB 1409', L('CB 1409'));
  }


  section('Colonne « informations complémentaires » : lue, mais seulement en repli');
  {
    const csv = 'Date comptable;Libelle simplifie;Reference;Informations complementaires;Type operation;Debit;Credit;Date operation;Date de valeur;Pointage\n'
      + '08/09/2026;PRLV DIVERS;REF1;PRLV SEPA CENTRE PAJEMPLOI ECH 0809;Prelevement;-123,15;;08/09/2026;08/09/2026;\n'
      + '10/09/2026;VIR EXEMPLE;REF2;VIR SEPA MARTIN CONSEIL FACT 12;Virement;;960,00;10/09/2026;10/09/2026;\n'
      + '11/09/2026;CB SIMPLE;REF3;CB SIMPLE;Carte;-5,00;;11/09/2026;11/09/2026;\n';
    const p = R.parseReleve(Buffer.from(csv, 'utf8'));
    test('la colonne est reconnue et lue dans « detail »', [true, 'PRLV SEPA CENTRE PAJEMPLOI ECH 0809', 'VIR SEPA MARTIN CONSEIL FACT 12'], [p.colonnes.detail === 3, p.lignes[0].detail, p.lignes[1].detail]);
    test('le libellé reste le libellé simplifié', 'PRLV DIVERS', p.lignes[0].libelle);
    test('un détail identique au libellé n\'est pas conservé', undefined, p.lignes[2].detail);
    test('les empreintes ne dépendent pas du détail', R.empreintesLignes([{ date: '2026-09-08', libelle: 'PRLV DIVERS', montant: -123.15 }])[0].id, R.empreintesLignes([p.lignes[0]])[0].id);
    const d = { params: { tva: false }, missions: [{ id: 'm1', client: 'Martin Conseil', statut: 'cours', encaissements: [] }], revenus: {}, depenses: [{ id: 'd-pe', date: '2026-09-08', montant: 123, recurrence: 'ponctuelle', libelle: 'centre pajemploi' }] };
    const cl = C.classerLignes(d, [p.lignes[0]], [])[0];
    test('rapprochement impossible avec le libellé seul, possible grâce au détail', ['rapprochement_propose', 'montant_proche', 'd-pe'], [cl.statut, cl.candidat && cl.candidat.motif, cl.candidat && cl.candidat.id]);
    const sansDetail = Object.assign({}, p.lignes[0]); delete sansDetail.detail;
    test('sans le détail : nouvelle ligne (le repli ne change rien quand il n\'y en a pas)', 'nouvelle', C.classerLignes(d, [sansDetail], [])[0].statut);
    test('suggestion de mission : le détail sert quand le libellé ne suffit pas', ['m1', 0], [C.suggererMissions(d, p.lignes[1].libelle, p.lignes[1].detail)[0].missionId, C.suggererMissions(d, p.lignes[1].libelle).length]);
    const apres = C.analyserReleve(d, { lignes: [{ date: '2026-09-14', libelle: 'PAIEMENT DIVERS', montant: -42.99, detail: 'PAIEMENT CB 1409 PARIS ORANGE VAD 73' }] }, [], []);
    test('catégorie : le détail aide quand le libellé est inconnu', 'Téléphonie & internet', apres.lignes[0].categorie);
  }


  section("Catégorie suggérée d'après les dépenses déjà saisies par la personne");
  {
    const K = await import(pathToFileURL(path.join(ROOT, 'core', 'categories.js')).href);
    const hist = [
      { libelle: 'Dupont Traiteur', categorie: 'Marketing & communication' },
      { libelle: 'Dupont Traiteur', categorie: 'Marketing & communication' },
      { libelle: 'Orange', categorie: 'Téléphonie & internet' },
      { libelle: 'Orange pro', categorie: 'Téléphonie & internet' },
      { libelle: 'Paris Monoprix', categorie: 'Coworking & bureau' },
      { libelle: 'Paris Atelier Bois', categorie: 'Matériel & équipement' },
      { libelle: 'Truc divers', categorie: 'Autre' },
    ];
    test('même libellé : catégorie reprise, confiance haute', ['Marketing & communication', 'haute'], (() => { const h = K.categorieDepuisHistorique(hist, 'PAIEMENT CB 1409 DUPONT TRAITEUR CARTE 2080 HIP01'); return [h.categorie, h.confiance]; })());
    test('un mot qui mène toujours à la même catégorie : reprise', 'Téléphonie & internet', K.categorieDepuisHistorique(hist, 'PRLV ORANGE VAD 73').categorie);
    test('un mot présent dans des catégories variées (une ville) n\'est jamais retenu', null, K.categorieDepuisHistorique(hist, 'PAIEMENT CB PARIS INCONNU'));
    test('les dépenses en « Autre » ne comptent pas', null, K.categorieDepuisHistorique(hist, 'TRUC DIVERS'));
    test('pas d\'historique : rien', null, K.categorieDepuisHistorique([], 'ORANGE'));
    // Priorités dans proposerCategorie
    test('l\'historique passe avant la table de mots-clés (accord fort)', ['Marketing & communication', 'historique'], (() => { const p = C.proposerCategorie('CB FREE MOBILE PRO', [], -20, [{ libelle: 'Free Mobile Pro', categorie: 'Marketing & communication' }]); return [p.categorie, p.source]; })());
    test('un accord faible ne remplace pas une catégorie déjà reconnue par mots-clés', 'Téléphonie & internet', C.proposerCategorie('CB FREE MOBILE', [], -20, [{ libelle: 'Free livraison', categorie: 'Marketing & communication' }]).categorie);
    test('un accord faible complète une catégorie inconnue', ['Formation', 'historique'], (() => { const p = C.proposerCategorie('CB ZORGLUB 12', [], -20, [{ libelle: 'Zorglub', categorie: 'Formation' }]); return [p.categorie, p.source]; })());
    test('une règle retenue par la personne prime sur l\'historique', ['Outils IA', 'apprise'], (() => { const p = C.proposerCategorie('CB DUPONT TRAITEUR', [{ motCle: 'dupont', categorie: 'Outils IA', nature: 'depense' }], -20, hist); return [p.categorie, p.source]; })());
    test('l\'historique ne change jamais une cotisation, un impôt ni un prêt', ['charges_sociales', 'impots', 'a_ignorer'], ['PRLV URSSAF AUTO', 'PRLV DGFIP TVA', 'ECH PRET CAP+IN'].map((l) => C.proposerCategorie(l, [], -100, [{ libelle: l, categorie: 'Formation' }]).nature));
    test('l\'historique ne s\'applique pas à de l\'argent reçu', 'encaissement', C.proposerCategorie('VIR DUPONT TRAITEUR', [], 500, hist).nature);
    // Dans l'import
    const dataH = { params: { tva: false }, missions: [], revenus: {}, depenses: hist.map((d, i) => Object.assign({ id: 'h' + i, date: '2026-08-01', montant: 10, recurrence: 'ponctuelle' }, d)) };
    const an = C.analyserReleve(dataH, { lignes: [{ date: '2026-09-02', libelle: 'PAIEMENT CB 0209 DUPONT TRAITEUR CARTE 2080 HIR01', montant: -230 }] }, [], []);
    test('import : la catégorie vient de l\'historique, avec son explication', ['Marketing & communication', 'historique', true], [an.lignes[0].categorie, an.lignes[0].source, /dépenses précédentes/.test(an.lignes[0].motifCategorie)]);
    // Formulaire de dépense
    const sug = (l) => I.suggererCategorie(dataH, l);
    test('formulaire : suggestion d\'après l\'historique', ['Marketing & communication', 'historique'], (() => { const x = sug('Dupont Traiteur'); return [x.categorie, x.source]; })());
    test('formulaire : suggestion par mots-clés quand l\'historique est muet', 'Assurances & prévoyance', sug('AXA assurance').categorie);
    test('formulaire : jamais « Autre » en suggestion, ni pour un libellé trop court', [null, null], [sug('Xyzzy Quux'), sug('ab')]);
  }

  section('Pipeline complet : groupes et résumé sur le relevé de référence');
  {
    const an = C.analyserReleve(DATA(), parsed, [], []);
    const groupe = (txt, date) => an.lignes.find((r) => r.ligne.libelle.includes(txt) && (!date || r.ligne.date === date)).groupe;
    test('abonnements : « déjà couvertes »', 'deja_couvertes', groupe('ADOBE'));
    test('URSSAF, virement perso, restaurant : « ignorées par défaut »', ['ignorees', 'ignorees', 'ignorees'], [groupe('URSSAF'), groupe('DURAND'), groupe('RESTAURANT')]);
    test('rapprochements et nouvelles lignes : « à vérifier »', ['a_verifier', 'a_verifier', 'a_verifier', 'a_verifier'], [groupe('DUPONT'), groupe('LEROY'), groupe('MARTIN'), groupe('AMAZON')]);
    test('total = somme des groupes', an.resume.total, an.resume.a_verifier + an.resume.deja_couvertes + an.resume.ignorees);
    const reimport = C.analyserReleve(DATA(), parsed, an.lignes.map((r) => r.empreinte), []);
    test('réimport : tout est « déjà couvert », rien à vérifier', [0, 23], [reimport.resume.a_verifier, reimport.resume.deja_couvertes]);
    test('chaque ligne a une explication', true, an.lignes.every((r) => r.explication && r.explication.length > 3));
  }

  section('L\'inverse : saisies sans ligne bancaire (paiement en espèces ou autre compte possibles)');
  {
    const d = DATA();
    d.depenses.push({ id: 'd-esp', date: '2026-09-20', montant: 35, recurrence: 'ponctuelle', libelle: 'Fournitures payées en espèces' });
    const an = C.analyserReleve(d, parsed, [], []);
    const inv = C.saisiesNonPointees(d, an);
    test('la dépense sans ligne bancaire est listée', ['d-esp'], inv.saisies.map((s) => s.id));
    test('Leroy Merlin et Dupont, rapprochés, ne sont pas listés', false, inv.saisies.some((s) => s.id === 'd-lm' || s.id === 'e1'));
    const sansAdobe = parsed.lignes.filter((l) => !(l.libelle.includes('ADOBE') && l.date === '2026-09-03'));
    const an2 = C.analyserReleve(DATA(), { lignes: sansAdobe }, [], []);
    const inv2 = C.saisiesNonPointees(DATA(), an2, { debut: '2026-07-01', fin: '2026-09-30' });
    test('abonnement sans prélèvement ce mois-là : signalé', [{ libelle: 'Adobe Creative Cloud', mois: '2026-09' }], inv2.abonnements.map((a) => ({ libelle: a.libelle, mois: a.mois })));
  }

  console.log(`\n${PASS} tests réussis, ${FAIL} échec(s)`);
  process.exit(FAIL ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
