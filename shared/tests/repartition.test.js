/**
 * Tests : missions communes réparties en pourcentage (shared/core/repartition.js) et revenu
 * souhaité personnel (shared/core/personnes.js).
 * Exécution : node shared/tests/repartition.test.js
 */
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..');

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
  const R = await import(pathToFileURL(path.join(ROOT, 'core', 'repartition.js')).href);
  const P = await import(pathToFileURL(path.join(ROOT, 'core', 'personnes.js')).href);
  const C = await import(pathToFileURL(path.join(ROOT, 'core', 'calculs.js')).href);

  const mission = () => ({
    id: 'mc', client: 'Client commun', auteurId: 'flo', statut: 'cours',
    montantDevis: 1000, montantPrestation: 1000, montantVente: 0, chargeEstimee: 10, heuresSaisies: 4,
    timerAccumulated: 3600000,
    tempsManuel: [{ id: 't1', ms: 7200000, auteurId: 'flo' }, { id: 't2', ms: 3600000, auteurId: 'asso' }],
    encaissements: [{ id: 'e1', montant: 400, montantTTC: 480 }, { id: 'e2', montant: 100 }],
    repartition: { flo: 80, asso: 20 },
  });

  section('partMission : argent et temps prévu à hauteur de la part, temps RÉEL selon qui l\'a travaillé, source intacte');
  {
    const m = mission();
    const p = R.partMission(m, 80, 'flo', 'flo');
    test('montants', [800, 800], [p.montantDevis, p.montantPrestation]);
    test('temps PRÉVU réparti (80 % de 10 h)', 8, p.chargeEstimee);
    test('heures saisies et chrono : à la personne qui porte la mission (flo), NON réparties', [4, 3600000], [p.heuresSaisies, p.timerAccumulated]);
    test('temps manuel : seulement ce que flo a saisi (pas la saisie d\'asso), NON réparti', [7200000], p.tempsManuel.map((e) => e.ms));
    test('encaissements HT et TTC', [[320, 384], [80, undefined]], p.encaissements.map((e) => [e.montant, e.montantTTC]));
    test('part marquée pour l\'affichage', 80, p._partPct);
    test('mission source non modifiée', [1000, 1000], [m.montantDevis, m.encaissements[0].montant === 400 ? 1000 : 0]);
  }

  section('Les parts se somment exactement au total (aucun centime perdu pour des cas ronds)');
  {
    const m = mission();
    const a = R.partMission(m, 80, 'flo', 'flo'), b = R.partMission(m, 20, 'asso', 'flo');
    test('montantDevis 80 % + 20 % = 100 %', 1000, a.montantDevis + b.montantDevis);
    test('encaissé total identique', 500, a.encaissements.reduce((s, e) => s + e.montant, 0) + b.encaissements.reduce((s, e) => s + e.montant, 0));
    test('temps total identique (chacun garde ce qu\'il a travaillé)', 10800000, a.tempsManuel.reduce((s, e) => s + e.ms, 0) + b.tempsManuel.reduce((s, e) => s + e.ms, 0));
    test('asso : sa saisie (1 h), pas d\'heures ni de chrono du porteur', [[3600000], 0, 0], [b.tempsManuel.map((e) => e.ms), b.heuresSaisies, b.timerAccumulated]);
    test('asso : son temps prévu 20 %', 2, b.chargeEstimee);
    const enCours = R.partMission({ ...m, timerRunning: true, timerStart: 123 }, 20, 'asso', 'flo');
    test('un chrono en cours n\'appartient pas à asso', [false, null], [enCours.timerRunning, enCours.timerStart]);
    const sansAuteur = R.partMission({ id: 'x', montantDevis: 100, tempsManuel: [{ id: 'a', ms: 1000 }, { id: 'b', ms: 500, auteurId: 'asso' }] }, 50, 'asso', 'flo');
    test('temps sans auteur sur une mission sans auteur : revient au propriétaire (flo), pas à asso', [500], sansAuteur.tempsManuel.map((e) => e.ms));
    const proprio = R.partMission({ id: 'x', montantDevis: 100, tempsManuel: [{ id: 'a', ms: 1000 }, { id: 'b', ms: 500, auteurId: 'asso' }] }, 50, 'flo', 'flo');
    test('le propriétaire reçoit le temps sans auteur', [1000], proprio.tempsManuel.map((e) => e.ms));
  }

  section('verifierRepartition / repartitionEgale');
  {
    test('80/20 valide', true, R.verifierRepartition({ a: 80, b: 20 }).ok);
    test('50/40 refusé (total 90)', false, R.verifierRepartition({ a: 50, b: 40 }).ok);
    test('une seule personne refusée', false, R.verifierRepartition({ a: 100 }).ok);
    test('négatif refusé', false, R.verifierRepartition({ a: 120, b: -20 }).ok);
    test('texte refusé', false, R.verifierRepartition({ a: 'x', b: 100 }).ok);
    test('égale à deux', { a: 50, b: 50 }, R.repartitionEgale(['a', 'b']));
    const t = R.repartitionEgale(['a', 'b', 'c']);
    test('égale à trois : somme exactement 100', 100, Math.round((t.a + t.b + t.c) * 100) / 100);
  }

  section('getDataPourMembre : mission commune');
  {
    const D = { params: {}, missions: [mission(), { id: 'p', client: 'Perso de asso', auteurId: 'asso' }, { id: 'v', client: 'Vide', auteurId: 'flo' }] };
    const vf = C.getDataPourMembre(D, 'flo', 'flo', 'flo');
    test('flo voit sa part (80 %) de la commune + sa mission perso', ['mc', 'v'], vf.missions.map((m) => m.id));
    test('montant de flo = 800', 800, vf.missions[0].montantDevis);
    const va = C.getDataPourMembre(D, 'asso', 'flo', 'flo');
    test('asso voit sa part (20 %) + sa mission', ['mc', 'p'], va.missions.map((m) => m.id));
    test('montant d\'asso = 200', 200, va.missions[0].montantDevis);
    const vt = C.getDataPourMembre(D, 'troisieme', 'flo', 'flo');
    test('une personne hors répartition ne voit pas la mission commune', [], vt.missions.map((m) => m.id).filter((i) => i === 'mc'));
    test('DATA source non modifié', 1000, D.missions[0].montantDevis);
    const vf0 = C.getDataPourMembre({ missions: [{ id: 'z', auteurId: 'flo', repartition: { flo: 0, asso: 100 } }] }, 'flo', 'flo', 'flo');
    test('0 % : la mission n\'apparaît pas', [], vf0.missions);
  }

  section('Dépense commune : parts, et dépense sans répartition = entière pour chacun·e');
  {
    const D = { params: {}, missions: [], depenses: [
      { id: 'd1', libelle: 'Loyer', montant: 1000, montantTVA: 200, repartition: { flo: 60, asso: 40 } },
      { id: 'd2', libelle: 'Logiciel de flo', montant: 50, repartition: { flo: 100, asso: 0 } },
      { id: 'd3', libelle: 'Assurance société', montant: 300 },
    ] };
    const vf = C.getDataPourMembre(D, 'flo', 'flo', 'flo');
    const va = C.getDataPourMembre(D, 'asso', 'flo', 'flo');
    test('flo : sa part du loyer (60 %), son logiciel entier, l\'assurance entière', [600, 50, 300], vf.depenses.map((d) => d.montant));
    test('flo : la TVA déductible suit la part', 120, vf.depenses[0].montantTVA);
    test('asso : sa part du loyer (40 %), PAS le logiciel de flo, l\'assurance entière', [400, 300], va.depenses.map((d) => d.montant));
    test('les parts du loyer se somment au total', 1000, vf.depenses[0].montant + va.depenses[0].montant);
    test('DATA source non modifié', [1000, 50, 300], D.depenses.map((d) => d.montant));
    const p = R.partDepense(D.depenses[0], 25);
    test('partDepense pure : 25 % de 1000 = 250', [250, 50], [p.montant, p.montantTVA]);
  }

  section('Revenu souhaité personnel');
  {
    const cloud = { params: { objectifNetMensuel: 4000, remunerationNette: 3000, heuresParJour: 7, joursParSemaine: 4, semainesParAn: 44 }, conges: [], missions: [] };
    const nouveau = P.versLocal(cloud, 'asso', false);
    test('une nouvelle personne démarre à 0', [0, 0], [nouveau.params.objectifNetMensuel, nouveau.params.remunerationNette]);
    const proprio = P.versLocal(cloud, 'flo', true);
    test('le propriétaire garde son objectif', [4000, 3000], [proprio.params.objectifNetMensuel, proprio.params.remunerationNette]);
    const communes = P.valeursCommunes(cloud);
    const nc = P.versCloud(nouveau, 'asso', communes);
    test('cloud : valeurs communes intactes', [4000, 3000], [nc.params.objectifNetMensuel, nc.params.remunerationNette]);
    test('cloud : valeurs de la personne rangées à part', [0, 0], [nc.personnes.asso.objectifNetMensuel, nc.personnes.asso.remunerationNette]);
    nouveau.params.objectifNetMensuel = 2500; nouveau.params.remunerationNette = 2000;
    const nc2 = P.versCloud(nouveau, 'asso', communes);
    const retour = P.versLocal(nc2, 'asso', false);
    test('aller-retour : ses valeurs reviennent', [2500, 2000], [retour.params.objectifNetMensuel, retour.params.remunerationNette]);
    // vue combinée : somme
    const D = clone(cloud);
    D.personnes = { asso: { heuresParJour: 7, joursParSemaine: 4, semainesParAn: 44, objectifNetMensuel: 2500, remunerationNette: 2000, conges: [] } };
    const comb = P.getDataVueCombinee(D, 'flo');
    test('combiné : objectifs additionnés (4000 + 2500)', 6500, comb.params.objectifNetMensuel);
    test('combiné : rémunérations additionnées (3000 + 2000)', 5000, comb.params.remunerationNette);
    const D2 = clone(D); D2.personnes.asso.objectifNetMensuel = 0; D2.personnes.asso.remunerationNette = 0;
    test('une personne à 0 : le cumul ne double pas', [4000, 3000], [P.getDataVueCombinee(D2, 'flo').params.objectifNetMensuel, P.getDataVueCombinee(D2, 'flo').params.remunerationNette]);
    const sp = C.getDataPourMembre(D, 'asso', 'flo', 'flo');
    test('vue d\'une personne : son revenu à elle', [2500, 2000], [sp.params.objectifNetMensuel, sp.params.remunerationNette]);
  }

  section('Temps interne par personne');
  {
    const H = 3600000;
    const cloud = { params: { heuresParJour: 7, joursParSemaine: 4, semainesParAn: 44 }, conges: [], tempsInterne: { '2026-10': 5 * H }, missions: [] };
    const communes = P.valeursCommunes(cloud);
    const proprio = P.versLocal(cloud, 'flo', true);
    test('le propriétaire garde l\'historique du compte', 5 * H, proprio.tempsInterne['2026-10']);
    const membre = P.versLocal(cloud, 'asso', false);
    test('une nouvelle personne démarre sans temps interne', {}, membre.tempsInterne);
    membre.tempsInterne['2026-10'] = 2 * H;
    const c = P.versCloud(membre, 'asso', communes);
    test('cloud : son temps rangé à son nom', 2 * H, c.personnes.asso.tempsInterne['2026-10']);
    test('cloud : l\'ancien total commun est inchangé', 5 * H, c.tempsInterne['2026-10']);
    const retour = P.versLocal(c, 'asso', false);
    test('aller-retour : elle retrouve son temps', 2 * H, retour.tempsInterne['2026-10']);
    const D = JSON.parse(JSON.stringify(cloud));
    D.personnes = { asso: { heuresParJour: 7, joursParSemaine: 4, semainesParAn: 44, conges: [], tempsInterne: { '2026-10': 2 * H, '2026-11': H } } };
    D.tempsInterne = { '2026-10': 5 * H };
    const comb = P.getDataVueCombinee(D, 'flo');
    test('combiné : somme par mois (5 h + 2 h, et novembre)', [7 * H, H], [comb.tempsInterne['2026-10'], comb.tempsInterne['2026-11']]);
    const vue = C.getDataPourMembre(D, 'asso', 'flo', 'flo');
    test('vue d\'une personne : son temps seulement', [2 * H, H], [vue.tempsInterne['2026-10'], vue.tempsInterne['2026-11']]);
    const vueMoi = C.getDataPourMembre(D, 'flo', 'flo', 'flo');
    test('ma vue : mon temps vivant', 5 * H, vueMoi.tempsInterne['2026-10']);
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Résultat : ${PASS} tests passés, ${FAIL} échoués`);
  if (FAIL > 0) process.exitCode = 1;
}
main();
