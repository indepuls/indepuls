/**
 * Tests : application, annulation et contrôle URSSAF de l'import de relevé (shared/core/releve_import.js).
 * Exécution : node shared/tests/releve_import.test.js
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
const clone = (v) => JSON.parse(JSON.stringify(v));

async function main() {
  const R = await import(pathToFileURL(path.join(ROOT, 'core', 'releve.js')).href);
  const C = await import(pathToFileURL(path.join(ROOT, 'core', 'releve_classement.js')).href);
  const I = await import(pathToFileURL(path.join(ROOT, 'core', 'releve_import.js')).href);
  const parsed = R.parseReleve(fs.readFileSync(path.join(DIR, 'A_semicolon_signed_utf8bom.csv')));
  const DATA = () => ({
    params: { tva: true, tauxTVA: 20, soldeReel: 5000, soldeReelDate: '2026-08' },
    missions: [{ id: 'm-dupont', client: 'Dupont SAS', encaissements: [{ id: 'e1', date: '2026-08-30', montant: 1500, montantTTC: 1800 }] }],
    depenses: [
      { id: 'd-lm', date: '2026-09-06', montant: 142.5, recurrence: 'ponctuelle', libelle: 'Leroy Merlin', categorie: 'Matériel & équipement' },
      { id: 'r-adobe', date: '2026-07-03', montant: 29.99, recurrence: 'mensuelle', dateDebut: '2026-07-03', libelle: 'Adobe' },
      { id: 'r-free', date: '2026-07-05', montant: 19.99, recurrence: 'mensuelle', dateDebut: '2026-07-05', libelle: 'Free Mobile' },
      { id: 'r-edf', date: '2026-07-07', montant: 80, recurrence: 'mensuelle', dateDebut: '2026-07-07', libelle: 'EDF' },
      { id: 'r-axa', date: '2026-07-17', montant: 64, recurrence: 'mensuelle', dateDebut: '2026-07-17', libelle: 'AXA' },
    ],
    revenus: {},
  });
  const analyser = (d) => C.analyserReleve(d, parsed, d.empreintesImportees || [], d.reglesImport || []);
  const NOW = '2026-10-07T10:00:00.000Z';

  section('Décisions par défaut : prudentes, jamais de création pour de l\'argent reçu ou une ligne ignorée');
  {
    const a = analyser(DATA()), dec = I.decisionsParDefaut(a);
    const action = (txt) => dec[a.lignes.find((r) => r.ligne.libelle.includes(txt)).index].action;
    test('Amazon, frais bancaires : à créer', ['creer', 'creer'], [action('AMAZON'), action('COMMISSION')]);
    test('Leroy Merlin : rapprocher la saisie existante', 'rapprocher', action('LEROY'));
    test('Dupont, Martin (argent reçu) : à l\'étape suivante', ['plus_tard', 'plus_tard'], [action('DUPONT'), action('MARTIN')]);
    test('URSSAF, virement perso, restaurant : ignorées', ['ignorer', 'ignorer', 'ignorer'], [action('URSSAF'), action('DURAND'), action('RESTAURANT')]);
    test('abonnements : couverts', 'couvrir', action('ADOBE'));
  }

  section('Appliquer l\'import');
  const d0 = DATA();
  const a0 = analyser(d0), dec0 = I.decisionsParDefaut(a0);
  const avantDepenses = d0.depenses.length;
  const lot = I.appliquerImport(d0, a0, dec0, { maintenant: NOW, periode: { debut: '2026-07-03', fin: '2026-09-30' }, solde: { valeur: 6875.09, date: '2026-09-30' } });
  {
    const crees = d0.depenses.filter((d) => d.importLot === lot.id && !lot.rapprochees.includes(d.id));
    test('dépenses créées : Amazon et frais bancaires (les 2 autres lignes URSSAF/restaurant ignorées)', 2, crees.length);
    test('une dépense créée porte son empreinte, son lot, le montant en positif (TTC)', true, crees.every((d) => d.importId && d.importLot === lot.id && d.montant > 0 && d.recurrence === 'ponctuelle'));
    const amazon = crees.find((d) => d.libelle.includes('AMAZON'));
    test('Amazon : 59,90 €, 28/09, catégorie proposée', [59.9, '2026-09-28'], [amazon.montant, amazon.date]);
    const lm = d0.depenses.find((d) => d.id === 'd-lm');
    test('Leroy Merlin rapprochée : estampillée, aucun autre champ modifié', [142.5, '2026-09-06', 'Leroy Merlin', true], [lm.montant, lm.date, lm.libelle, !!lm.importId]);
    test('aucun doublon créé pour la saisie rapprochée', avantDepenses + 2, d0.depenses.length);
    test('solde mis à jour à la demande, mois retenu', [6875.09, '2026-09'], [d0.params.soldeReel, d0.params.soldeReelDate]);
    test('le lot est mémorisé avec ses statistiques', [1, true], [d0.importsReleve.length, lot.stats.proposees > 0]);
    test('les argents reçus ne sont PAS mémorisés (ils reviendront à l\'étape suivante)', false, d0.empreintesImportees.includes(a0.lignes.find((r) => r.ligne.libelle.includes('DUPONT')).empreinte));
    test('les lignes traitées sont mémorisées (empreinte principale + souple)', true, d0.empreintesImportees.includes(a0.lignes.find((r) => r.ligne.libelle.includes('AMAZON')).empreinte));
  }

  section('Réimport et chevauchement : aucun doublon');
  {
    const a1 = analyser(d0);
    const re = I.decisionsParDefaut(a1);
    const d1 = clone(d0);
    I.appliquerImport(d1, a1, re, { maintenant: NOW });
    test('réimport du même fichier : aucune dépense créée', d0.depenses.length, d1.depenses.length);
    test('réimport : seules les lignes d\'argent reçu restent à traiter', true, a1.lignes.filter((r) => r.groupe === 'a_verifier').every((r) => r.nature === 'encaissement'));
    test('les lignes déjà traitées sont "déjà importées"', true, a1.lignes.filter((r) => /AMAZON|COMMISSION/.test(r.ligne.libelle)).every((r) => r.statut === 'deja_importee'));
  }

  section('Corrections de la personne');
  {
    const d = DATA(); const a = analyser(d); const dec = I.decisionsParDefaut(a);
    const amazon = a.lignes.find((r) => r.ligne.libelle.includes('AMAZON'));
    dec[amazon.index] = { action: 'creer', categorie: 'Matériel & équipement', retenirRegle: true, motCle: I.motCleSuggere(amazon.ligne.libelle) };
    const resto = a.lignes.find((r) => r.ligne.libelle.includes('RESTAURANT'));
    dec[resto.index] = { action: 'creer', categorie: 'Autre', retenirRegle: false };
    I.appliquerImport(d, a, dec, { maintenant: NOW });
    test('mot-clé suggéré : le premier mot significatif', 'amazon', I.motCleSuggere('CB AMAZON EU SARL'));
    test('catégorie corrigée appliquée', 'Matériel & équipement', d.depenses.find((x) => x.libelle.includes('AMAZON')).categorie);
    test('règle retenue enregistrée (uniquement parce que demandée)', [{ motCle: 'amazon', categorie: 'Matériel & équipement', nature: 'depense' }], d.reglesImport);
    test('ligne ignorée par défaut mais créée à la demande', true, d.depenses.some((x) => x.libelle.includes('RESTAURANT')));
    const stats = I.appliquerImport(clone(d), analyser(d), I.decisionsParDefaut(analyser(d)), { maintenant: NOW }).stats;
    test('mesure : 2 lignes corrigées sur le premier import', 2, (() => { const d2 = DATA(); const a2 = analyser(d2); const dc = I.decisionsParDefaut(a2); dc[amazon.index] = { action: 'creer', categorie: 'Matériel & équipement' }; dc[resto.index] = { action: 'creer', categorie: 'Autre' }; return I.statistiques(a2, dc).corrigees; })());
    // La règle apprise s'applique à l'analyse suivante.
    const apres = C.proposerCategorie('CB AMAZON EU SARL', d.reglesImport, -10);
    test('règle apprise utilisée ensuite', 'Matériel & équipement', apres.categorie);
  }

  section('Défaire un import');
  {
    const d = clone(d0);
    const l = d.importsReleve[0];
    const r = I.defaireImport(d, l.id);
    test('les 2 dépenses créées sont supprimées, le rapprochement retiré', [2, 0, 1], [r.supprimees, r.conservees, r.rapprochementsRetires]);
    test('retour au nombre initial de dépenses', avantDepenses, d.depenses.length);
    test('Leroy Merlin redevenue une saisie normale', [false, false], [!!d.depenses.find((x) => x.id === 'd-lm').importId, !!d.depenses.find((x) => x.id === 'd-lm').importLot]);
    test('les empreintes sont oubliées (les lignes pourront être proposées de nouveau)', 0, d.empreintesImportees.length);
    test('solde restauré', [5000, '2026-08', true], [d.params.soldeReel, d.params.soldeReelDate, r.soldeRestaure]);
    test('le lot disparaît de l\'historique', 0, d.importsReleve.length);
    // Réanalyse : tout redevient proposé.
    test('après annulation, Amazon est de nouveau proposée', 'nouvelle', C.analyserReleve(d, parsed, d.empreintesImportees, []).lignes.find((x) => x.ligne.libelle.includes('AMAZON')).statut);
    // Dépense modifiée depuis : conservée.
    const d2 = clone(d0);
    d2.depenses.find((x) => x.libelle.includes('AMAZON')).montant = 61;
    const r2 = I.defaireImport(d2, d2.importsReleve[0].id);
    test('dépense modifiée depuis l\'import : conservée, jamais supprimée', [1, 1], [r2.supprimees, r2.conservees]);
    test('la dépense conservée n\'appartient plus au lot', false, !!d2.depenses.find((x) => x.libelle.includes('AMAZON')).importLot);
    // Solde modifié depuis : non restauré.
    const d3 = clone(d0); d3.params.soldeReel = 7000;
    test('solde modifié depuis l\'import : non restauré', [7000, false], (() => { const rr = I.defaireImport(d3, d3.importsReleve[0].id); return [d3.params.soldeReel, rr.soldeRestaure]; })());
    test('lot inconnu : null, rien ne change', null, I.defaireImport(clone(d0), 'inconnu'));
  }

  section('Mémoire des empreintes plafonnée');
  {
    const d = DATA(); d.empreintesImportees = Array.from({ length: I.MAX_EMPREINTES }, (_, i) => 'x' + i);
    const a = analyser(d); I.appliquerImport(d, a, I.decisionsParDefaut(a), { maintenant: NOW });
    test('plafond respecté, les plus anciennes oubliées d\'abord', [I.MAX_EMPREINTES, false], [d.empreintesImportees.length, d.empreintesImportees.includes('x0')]);
  }

  section('Compte partagé : l\'auteur de l\'import est conservé');
  {
    const d = DATA(); const a = analyser(d); I.appliquerImport(d, a, I.decisionsParDefaut(a), { maintenant: NOW, auteurId: 'user-1' });
    test('dépenses créées signées par la personne qui importe', true, d.depenses.filter((x) => x.importLot).every((x) => x.auteurId === 'user-1' || x.auteurId === undefined));
    test('au moins une dépense créée porte l\'auteur', true, d.depenses.some((x) => x.auteurId === 'user-1'));
  }

  section('Mapping de colonnes mémorisé par en-têtes normalisés');
  test('même clé quels que soient la casse et les accents', I.cleMapping(['Date', 'Libellé', 'Montant']), I.cleMapping(['DATE', 'libelle', 'montant']));

  section('Contrôle URSSAF : échéance la plus proche');
  test('mensuel : prélèvement du 10/09 = déclaration du 31/08 = CA de juillet', ['2026-08-31', ['2026-07']], (() => { const e = I.echeanceUrssafProche('2026-09-10', 'mensuel'); return [e.echeance, e.mois]; })());
  test('mensuel : prélèvement du 28/09 = échéance du 30/09 = CA d\'août', ['2026-09-30', ['2026-08']], (() => { const e = I.echeanceUrssafProche('2026-09-28', 'mensuel'); return [e.echeance, e.mois]; })());
  test('trimestriel : prélèvement du 05/08 = échéance du 31/07 = T2 (avril, mai, juin)', ['2026-07-31', ['2026-04', '2026-05', '2026-06']], (() => { const e = I.echeanceUrssafProche('2026-08-05', 'trimestriel'); return [e.echeance, e.mois]; })());
  test('trimestriel : janvier = trimestre précédent de l\'année d\'avant', ['2026-01-31', ['2025-10', '2025-11', '2025-12']], (() => { const e = I.echeanceUrssafProche('2026-02-03', 'trimestriel'); return [e.echeance, e.mois]; })());

  section('Contrôle URSSAF : comparaison prévu / réel');
  {
    const ok = I.comparerUrssaf({ reel: 1204, prevu: 1200, caCompte: 5455 });
    test('petit écart : conforme à la prévision', [false, true], [ok.significatif, ok.phrase.includes('correspond à la prévision')]);
    const gros = I.comparerUrssaf({ reel: 1316, prevu: 1240, caCompte: 5636 });
    test('écart significatif : chiffres et CA implicite', [76, true, 5981], [gros.ecart, gros.significatif, gros.caImplique]);
    test('la phrase explique et ne corrige rien', true, gros.phrase.includes('chiffre d\'affaires déclaré') && /oublié|taux/.test(gros.phrase));
    test('écart négatif : prélèvement plus bas que prévu', true, I.comparerUrssaf({ reel: 900, prevu: 1200, caCompte: 5000 }).phrase.includes('décalage'));
    test('rien de prévu : message dédié, pas de division par zéro', [null, true], (() => { const x = I.comparerUrssaf({ reel: 500, prevu: 0, caCompte: 0 }); return [x.caImplique, x.significatif]; })());
  }

  console.log(`\n${PASS} tests réussis, ${FAIL} échec(s)`);
  process.exit(FAIL ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
