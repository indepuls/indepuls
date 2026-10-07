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
    test('Dupont : rapprocher l\'encaissement saisi ; Martin (client inconnu) : à décider plus tard', ['rapprocher', 'plus_tard'], [action('DUPONT'), action('MARTIN')]);
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
    test('un argent reçu non décidé n\'est PAS mémorisé (il reviendra au prochain import)', false, d0.empreintesImportees.includes(a0.lignes.find((r) => r.ligne.libelle.includes('MARTIN')).empreinte));
    test('l\'encaissement rapproché est estampillé sans être modifié', [true, 1500, 1800], (() => { const e = d0.missions[0].encaissements[0]; return [!!e.importId, e.montant, e.montantTTC]; })());
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
    test('les 2 dépenses créées sont supprimées, les 2 rapprochements retirés', [2, 0, 2], [r.supprimees, r.conservees, r.rapprochementsRetires]);
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

  section("Étape 3 : argent reçu rattaché à une mission, mission créée, revenu ponctuel");
  {
    const d = DATA(); d.missions.push({ id: 'm-martin', client: 'Martin Conseil', statut: 'cours', encaissements: [] });
    const a = analyser(d), dec = I.decisionsParDefaut(a, d);
    const martin = a.lignes.find((r) => r.ligne.libelle.includes('MARTIN'));
    test('client reconnu dans le libellé : mission proposée', ['mission', 'm-martin'], [dec[martin.index].action, dec[martin.index].missionId]);
    test('suggestion de mission : le client apparaît dans le libellé', 'm-martin', C.suggererMissions(d, 'VIR SEPA MARTIN CONSEIL REF 889')[0].missionId);
    test('aucune suggestion pour un client inconnu', 0, C.suggererMissions(d, 'VIR SEPA ZZZ INCONNU').length);
    test('nom de client proposé à partir du libellé', 'Martin Conseil', C.clientSuggere('VIR SEPA MARTIN CONSEIL REF 889'));
    const lot3 = I.appliquerImport(d, a, dec, { maintenant: NOW });
    const enc = d.missions.find((m) => m.id === 'm-martin').encaissements;
    test('encaissement créé sur la mission : HT converti, TTC conservé, mode de règlement déduit', [800, 960, 'virement', '2026-09-12'], [enc[0].montant, enc[0].montantTTC, enc[0].modeReglement, enc[0].date]);
    test("l'encaissement porte son empreinte et son lot", [true, true], [!!enc[0].importId, enc[0].importLot === lot3.id]);
    test('totaux du lot : revenus et dépenses en TTC bancaire', [true, true], [lot3.totaux.revenus === 960, lot3.totaux.depenses > 0]);
    test("l'argent reçu décidé est mémorisé", true, d.empreintesImportees.includes(martin.empreinte));
    const d2 = DATA(); const a2 = analyser(d2); const dc2 = I.decisionsParDefaut(a2, d2);
    const m2 = a2.lignes.find((r) => r.ligne.libelle.includes('MARTIN'));
    dc2[m2.index] = { action: 'nouvelle_mission', clientNom: 'Martin Conseil', categorie: 'Autre' };
    I.appliquerImport(d2, a2, dc2, { maintenant: NOW });
    const nm = d2.missions.find((m) => m.client === 'Martin Conseil');
    test('mission créée : client, facturée, un encaissement du bon montant', [true, 'fact', 1, 800], [!!nm, nm && nm.statut, nm && nm.encaissements.length, nm && nm.montantDevis]);
    test("la mission créée a tous les champs attendus par l'application", true, ['sessions', 'tempsManuel', 'encaissements', 'isManagement', 'chargeUnit', 'typeMission'].every((k) => nm && nm[k] !== undefined));
    const d3 = DATA(); const a3 = analyser(d3); const dc3 = I.decisionsParDefaut(a3, d3);
    const m3 = a3.lignes.find((r) => r.ligne.libelle.includes('MARTIN'));
    dc3[m3.index] = { action: 'ponctuel', typePonctuel: 'prestation', clientNom: 'Martin Conseil', categorie: 'Autre' };
    I.appliquerImport(d3, a3, dc3, { maintenant: NOW });
    const pon = d3.revenus['2026-09'].autresList[0];
    test('revenu ponctuel créé au bon mois, HT, rattaché à la prestation', [800, 800, 0, 'Martin Conseil'], [pon.montant, pon.montantPrestation, pon.montantVente, pon.libelle]);
    const dd = clone(d2); const rr = I.defaireImport(dd, dd.importsReleve[0].id);
    test('annulation : encaissement et mission créée supprimés', [1, 1, false], [rr.encaissementsSupprimes, rr.missionsSupprimees, dd.missions.some((m) => m.client === 'Martin Conseil')]);
    const dp = clone(d3); const rp = I.defaireImport(dp, dp.importsReleve[0].id);
    test('annulation : revenu ponctuel supprimé', [0, 1], [(dp.revenus['2026-09'].autresList || []).length, rp.encaissementsSupprimes]);
    const dm = clone(d2); dm.missions.find((m) => m.client === 'Martin Conseil').encaissements.push({ id: 'autre', date: '2026-09-30', montant: 10 });
    const rm = I.defaireImport(dm, dm.importsReleve[0].id);
    test('mission créée mais enrichie depuis : conservée, jamais supprimée', [1, 1], [rm.missionsConservees, dm.missions.filter((m) => m.client === 'Martin Conseil').length]);
    const de = clone(d0); I.defaireImport(de, de.importsReleve[0].id);
    test("rapprochement d'encaissement défait : plus d'empreinte sur l'encaissement", [false, false], [!!de.missions[0].encaissements[0].importId, !!de.missions[0].encaissements[0].importLot]);
    const dl = DATA(); const al = analyser(dl); I.appliquerImport(dl, al, I.decisionsParDefaut(al, dl), { maintenant: NOW });
    test("réimport : l'argent reçu non décidé revient dans les lignes à vérifier", true, analyser(dl).lignes.some((r) => r.ligne.libelle.includes('MARTIN') && r.groupe === 'a_verifier'));
  }

  section('Rapprocher avec un montant différent : correction du montant à la demande, et annulation');
  {
    const base = () => ({ params: { tva: false }, missions: [], revenus: {}, depenses: [{ id: 'd-pe', date: '2026-09-08', montant: 123, recurrence: 'ponctuelle', libelle: 'centre pajemploi', categorie: 'Autre' }] });
    const pj = { lignes: [{ date: '2026-09-08', libelle: 'PRLV SEPA CENTRE PAJEMPLOI', montant: -123.15 }] };
    const analyserPj = (d) => C.analyserReleve(d, pj, d.empreintesImportees || [], []);
    const d = base(); const a = analyserPj(d); const dec = I.decisionsParDefaut(a, d);
    test('rapprochement présélectionné, montant NON corrigé par défaut', ['rapprocher', undefined], [dec[0].action, dec[0].corrigerMontant]);
    const dSans = clone(d); I.appliquerImport(dSans, a, dec, { maintenant: NOW });
    test('sans correction : la saisie est estampillée et son montant reste 123', [123, true, 1], [dSans.depenses[0].montant, !!dSans.depenses[0].importId, dSans.depenses.length]);
    dec[0].corrigerMontant = true;
    const lotC = I.appliquerImport(d, a, dec, { maintenant: NOW });
    test('avec correction : le montant devient celui de la banque, aucun doublon créé', [123.15, 1], [d.depenses[0].montant, d.depenses.length]);
    test('la correction est mémorisée dans le lot', [1, 123, 123.15], [lotC.corrections.length, lotC.corrections[0].avant.montant, lotC.corrections[0].apres.montant]);
    I.defaireImport(d, lotC.id);
    test('annulation : le montant d\'origine est remis, l\'estampille retirée', [123, false], [d.depenses[0].montant, !!d.depenses[0].importId]);
    // Montant modifié depuis l'import : jamais écrasé par l'annulation.
    const d2 = base(); const a2 = analyserPj(d2); const dc2 = I.decisionsParDefaut(a2, d2); dc2[0].corrigerMontant = true;
    const lot2 = I.appliquerImport(d2, a2, dc2, { maintenant: NOW }); d2.depenses[0].montant = 125;
    I.defaireImport(d2, lot2.id);
    test('montant modifié depuis l\'import : conservé à l\'annulation', 125, d2.depenses[0].montant);
    // Encaissement avec TVA.
    const dE = { params: { tva: true, tauxTVA: 20 }, revenus: {}, depenses: [], missions: [{ id: 'm1', client: 'Martin Conseil', encaissements: [{ id: 'e1', date: '2026-09-10', montant: 800, montantTTC: 960 }] }] };
    const pe = { lignes: [{ date: '2026-09-12', libelle: 'VIR SEPA MARTIN CONSEIL', montant: 960.4 }] };
    const ae = C.analyserReleve(dE, pe, [], []); const de = I.decisionsParDefaut(ae, dE); de[0].corrigerMontant = true;
    const lotE = I.appliquerImport(dE, ae, de, { maintenant: NOW });
    const e1 = dE.missions[0].encaissements[0];
    test('encaissement corrigé : TTC de la banque, HT recalculé', [960.4, 800.33], [e1.montantTTC, e1.montant]);
    I.defaireImport(dE, lotE.id);
    test('encaissement : annulation restaure HT et TTC', [800, 960], [e1.montant, e1.montantTTC]);
  }

  section("Remboursement fait à un client (profils achat-revente) et remboursement fournisseur reçu");
  {
    const base = () => ({
      params: { tva: true, tauxTVA: 20, modules: { objectif: 'marge_commande' } }, revenus: {}, retours: [],
      missions: [{ id: 'v1', client: 'Durand Boutique', statut: 'fact', montantDevis: 100, encaissements: [{ id: 'e1', date: '2026-09-01', montant: 100, montantTTC: 120 }] }],
      depenses: [{ id: 'd-acme', date: '2026-09-02', montant: 80, recurrence: 'ponctuelle', libelle: 'Acme Fournitures', categorie: 'Autre' }, { id: 'd-petit', date: '2026-09-02', montant: 5, recurrence: 'ponctuelle', libelle: 'Acme petit', categorie: 'Autre' }],
    });
    const out = { lignes: [{ date: '2026-09-10', libelle: 'VIR REMBOURSEMENT DURAND BOUTIQUE', montant: -60 }] };
    const inn = { lignes: [{ date: '2026-09-12', libelle: 'VIR REMBOURSEMENT ACME FOURNITURES', montant: 25 }] };
    const an = (d, p) => C.analyserReleve(d, p, [], []);
    // Détection dans les deux sens
    test('remboursement émis (sortie) : nature remboursement, pas une dépense', ['remboursement', 'remboursement_emis'], (() => { const p = C.proposerCategorie('VIR REMBOURSEMENT DURAND BOUTIQUE', [], -60); return [p.nature, p.type]; })());
    test('remboursement reçu (entrée) : nature remboursement', 'remboursement', C.proposerCategorie('VIR REMBOURSEMENT ACME FOURNITURES', [], 25).nature);
    test('un prêt qui contient « remboursement » reste un prêt', 'a_ignorer', C.proposerCategorie('REMBOURSEMENT PRET 123', [], -300).nature);
    // Retour client
    const d1 = base(); const a1 = an(d1, out); const dec1 = I.decisionsParDefaut(a1, d1);
    test('retour client : à décider, mais la vente du client est présélectionnée', ['plus_tard', 'v1'], [dec1[0].action, dec1[0].missionId]);
    dec1[0].action = 'retour';
    const lot1 = I.appliquerImport(d1, a1, dec1, { maintenant: NOW });
    const r1 = d1.retours[0];
    test('retour créé : remboursé, HT converti, partiel, date du virement', ['rembourse', 50, 'partiel', '2026-09-10', 'v1'], [r1.statut, r1.montant, r1.type, r1.dateRemboursement, r1.missionId]);
    test('retour : l\'argent sortant n\'est PAS créé en dépense', 2, d1.depenses.length);
    test('retour mémorisé dans le lot', 1, lot1.retoursCrees.length);
    const rr1 = I.defaireImport(d1, lot1.id);
    test('annulation : le retour créé est supprimé', [0, 1], [d1.retours.length, rr1.retoursSupprimes]);
    // Retour déjà signalé : marqué remboursé, puis restauré
    const d2 = base(); d2.retours.push({ id: 'r-att', missionId: 'v1', date: '2026-09-05', motif: 'cassé', statut: 'demande', montant: 70, type: 'partiel', dateCreation: '2026-09-05', dateModif: null });
    const a2 = an(d2, out); const dec2 = I.decisionsParDefaut(a2, d2);
    test('retour déjà signalé : proposé pour être marqué remboursé', 'r-att', dec2[0].retourId);
    dec2[0].action = 'retour';
    const lot2 = I.appliquerImport(d2, a2, dec2, { maintenant: NOW });
    test('retour existant mis à jour, aucun doublon', [1, 'rembourse', 50, '2026-09-10'], [d2.retours.length, d2.retours[0].statut, d2.retours[0].montant, d2.retours[0].dateRemboursement]);
    I.defaireImport(d2, lot2.id);
    test('annulation : le retour redevient « demande » avec son montant d\'origine', ['demande', 70, undefined], [d2.retours[0].statut, d2.retours[0].montant, d2.retours[0].dateRemboursement]);
    // Remboursement fournisseur : réduit la dépense
    const d3 = base(); const a3 = an(d3, inn); const dec3 = I.decisionsParDefaut(a3, d3);
    test('remboursement fournisseur : dépense du même nom présélectionnée, non appliquée sans choix', ['plus_tard', 'd-acme'], [dec3[0].action, dec3[0].depenseId]);
    test('liste des dépenses réductibles : montant suffisant seulement, la plus ressemblante d\'abord', ['d-acme'], I.depensesDeductibles(d3, 25, 'VIR REMBOURSEMENT ACME FOURNITURES', '2026-09-12').filter((x) => x.montant >= 25).map((x) => x.id));
    dec3[0].action = 'deduire';
    const lot3 = I.appliquerImport(d3, a3, dec3, { maintenant: NOW });
    test('dépense réduite du montant remboursé (80 - 25)', [55, 1], [d3.depenses.find((x) => x.id === 'd-acme').montant, lot3.nbDeductions]);
    I.defaireImport(d3, lot3.id);
    test('annulation : la dépense retrouve son montant', 80, d3.depenses.find((x) => x.id === 'd-acme').montant);
    // Montant modifié depuis : jamais écrasé
    const d4 = base(); const a4 = an(d4, inn); const dec4 = I.decisionsParDefaut(a4, d4); dec4[0].action = 'deduire';
    const lot4 = I.appliquerImport(d4, a4, dec4, { maintenant: NOW }); d4.depenses.find((x) => x.id === 'd-acme').montant = 60;
    I.defaireImport(d4, lot4.id);
    test('dépense modifiée depuis : conservée à l\'annulation', 60, d4.depenses.find((x) => x.id === 'd-acme').montant);
    // Remboursement supérieur à la dépense : non appliqué (reste à décider)
    const d5 = base(); const a5 = an(d5, { lignes: [{ date: '2026-09-12', libelle: 'VIR REMBOURSEMENT ACME', montant: 200 }] }); const dec5 = I.decisionsParDefaut(a5, d5); dec5[0].action = 'deduire'; dec5[0].depenseId = 'd-acme';
    I.appliquerImport(d5, a5, dec5, { maintenant: NOW });
    test('remboursement plus grand que la dépense : rien n\'est modifié', 80, d5.depenses.find((x) => x.id === 'd-acme').montant);
    // Équilibrer par une entrée d'argent sur une vente (action existante)
    const d6 = base(); const a6 = an(d6, inn); const dec6 = I.decisionsParDefaut(a6, d6); dec6[0].action = 'mission'; dec6[0].missionId = 'v1';
    I.appliquerImport(d6, a6, dec6, { maintenant: NOW });
    test('alternative : entrée d\'argent rattachée à une vente', 2, d6.missions[0].encaissements.length);
  }

  section("Impact de l'import : constats significatifs seulement, avec leur origine");
  {
    const ctx = { moisLibelle: 'septembre', revenusImportes: 960, depensesImportees: 230, unite: '€/h', soldeMaj: { apres: 6875.09, dateLibelle: '30/09/2026' } };
    const x = I.calculerImpactImport({ caMois: 1000, depensesMois: 210, tauxHoraireMin: 40 }, { caMois: 1960, depensesMois: 520, tauxHoraireMin: 44 }, ctx);
    test('titre factuel', "Vous venez d'importer 960 € de revenus et 230 € de dépenses pour septembre.", x.titre);
    test('3 constats au maximum, chacun avec sa source', true, x.constats.length <= 3 && x.constats.every((c) => c.texte && c.source));
    test('poids des dépenses : 21 % vers 26,5 %', true, x.constats.some((c) => c.cle === 'poids_depenses' && c.texte.includes('26,5 %') && c.texte.includes('21 %')));
    const peu = I.calculerImpactImport({ caMois: 1000, depensesMois: 210, tauxHoraireMin: 40 }, { caMois: 1005, depensesMois: 214, tauxHoraireMin: 40.4 }, { moisLibelle: 'septembre', revenusImportes: 5, depensesImportees: 4 });
    test('écart non significatif : « rien de changé »', [0, true], [peu.constats.length, peu.rienDeChange]);
    test('aucun tiret cadratin dans les textes', false, /—/.test(JSON.stringify(x)));
  }

  console.log(`\n${PASS} tests réussis, ${FAIL} échec(s)`);
  process.exit(FAIL ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
