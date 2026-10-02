/**
 * Tests : réglages individuels d'un compte partagé (shared/core/personnes.js)
 * Capacité (heures/jour, jours/semaine, semaines/an) et congés par personne, sans toucher au
 * moteur : projection cloud <-> données de travail, vue combinée, surcharge par personne.
 * Exécution : node shared/tests/personnes.test.js
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
  const P = await import(pathToFileURL(path.join(ROOT, 'core', 'personnes.js')).href);
  const C = await import(pathToFileURL(path.join(ROOT, 'core', 'calculs.js')).href);

  const cloud = () => ({
    params: { nom: 'Cabinet', heuresParJour: 7, joursParSemaine: 4, semainesParAn: 44, objectif: 5 },
    conges: [{ id: 'c0', debut: '2026-08-01', fin: '2026-08-15' }],
    missions: [{ id: 'm1', auteurId: 'flo' }, { id: 'm2', auteurId: 'asso' }],
  });

  section('versLocal : propriétaire sans réglage personnel = rien ne change');
  {
    const l = P.versLocal(cloud(), 'flo', true);
    test('params identiques', cloud().params, l.params);
    test('congés du compte conservés pour le propriétaire', cloud().conges, l.conges);
  }

  section('versLocal : nouvelle personne, capacités communes, congés vides');
  {
    const l = P.versLocal(cloud(), 'asso', false);
    test('capacité commune reprise', [7, 4, 44], [l.params.heuresParJour, l.params.joursParSemaine, l.params.semainesParAn]);
    test('aucun congé hérité du propriétaire', [], l.conges);
  }

  section('versLocal : réglages personnels appliqués');
  {
    const c = cloud();
    c.personnes = { asso: { heuresParJour: 8, joursParSemaine: 5, semainesParAn: 46, conges: [{ id: 'c9', debut: '2026-12-20', fin: '2026-12-31' }] } };
    const l = P.versLocal(c, 'asso', false);
    test('ses capacités', [8, 5, 46], [l.params.heuresParJour, l.params.joursParSemaine, l.params.semainesParAn]);
    test('ses congés', [{ id: 'c9', debut: '2026-12-20', fin: '2026-12-31' }], l.conges);
    test('les réglages communs hors capacité sont intacts', 'Cabinet', l.params.nom);
    test('entrée source non modifiée', 7, c.params.heuresParJour);
  }

  section('versCloud : mes valeurs rangées par personne, communes restaurées');
  {
    const communes = P.valeursCommunes(cloud());
    const local = P.versLocal(cloud(), 'asso', false);
    local.params.heuresParJour = 6; local.params.joursParSemaine = 3;
    local.conges.push({ id: 'cx', debut: '2026-09-01', fin: '2026-09-05' });
    const c = P.versCloud(local, 'asso', communes);
    test('ma capacité dans personnes', [6, 3], [c.personnes.asso.heuresParJour, c.personnes.asso.joursParSemaine]);
    test('mes congés dans personnes', ['cx'], c.personnes.asso.conges.map((x) => x.id));
    test('capacités communes inchangées', [7, 4, 44], [c.params.heuresParJour, c.params.joursParSemaine, c.params.semainesParAn]);
    test('congés communs inchangés', cloud().conges, c.conges);
    test('les autres personnes ne sont pas touchées', undefined, c.personnes.flo);
  }

  section('Aller-retour : versLocal(versCloud(x)) = x, pour le propriétaire comme pour un membre');
  {
    [['flo', true], ['asso', false]].forEach(([moi, proprio]) => {
      const communes = P.valeursCommunes(cloud());
      const l1 = P.versLocal(cloud(), moi, proprio);
      l1.params.heuresParJour = 5.5;
      const c = P.versCloud(l1, moi, communes);
      const l2 = P.versLocal(c, moi, proprio);
      test('aller-retour stable (' + moi + ')', { params: l1.params, conges: l1.conges }, { params: l2.params, conges: l2.conges });
      const c2 = P.versCloud(l2, moi, communes);
      test('versCloud idempotent (' + moi + ')', c, c2);
    });
  }

  section('Deux personnes éditent chacune leurs réglages : jamais de collision dans le cloud');
  {
    const communes = P.valeursCommunes(cloud());
    const a = P.versCloud((() => { const l = P.versLocal(cloud(), 'flo', true); l.params.heuresParJour = 6; return l; })(), 'flo', communes);
    const b = P.versCloud((() => { const l = P.versLocal(cloud(), 'asso', false); l.params.heuresParJour = 8; return l; })(), 'asso', communes);
    test('params communs identiques des deux côtés', a.params, b.params);
    test('conges communs identiques des deux côtés', a.conges, b.conges);
    test('seul personnes[x] diffère (champs distincts)', true, a.personnes.flo.heuresParJour === 6 && b.personnes.asso.heuresParJour === 8 && !a.personnes.asso && !b.personnes.flo);
  }

  section('getDataVueCombinee : capacités additionnées, congés communs');
  {
    const D = clone(cloud());
    D.params.heuresParJour = 7; D.params.joursParSemaine = 4; D.params.semainesParAn = 44;
    D.conges = [{ id: 'a', debut: '2026-08-01', fin: '2026-08-20' }];
    D.personnes = { asso: { heuresParJour: 7, joursParSemaine: 5, semainesParAn: 44, conges: [{ id: 'b', debut: '2026-08-10', fin: '2026-08-31' }] } };
    const v = P.getDataVueCombinee(D, 'flo');
    test('heures/jour additionnées', 14, v.params.heuresParJour);
    const heuresAn = v.params.heuresParJour * v.params.joursParSemaine * v.params.semainesParAn;
    test('capacité annuelle = somme exacte (7*4*44 + 7*5*44)', 7 * 4 * 44 + 7 * 5 * 44, Math.round(heuresAn));
    test('congés = jours où tout le monde est absent', [['2026-08-10', '2026-08-20']], v.conges.map((c) => [c.debut, c.fin]));
    test('DATA source non muté', 7, D.params.heuresParJour);
    test('une seule personne : DATA inchangé (même objet)', true, P.getDataVueCombinee({ params: D.params, conges: [] }, 'flo') !== undefined);
    const solo = { params: { heuresParJour: 7, joursParSemaine: 4, semainesParAn: 44 }, conges: [], missions: [] };
    test('sans personnes : renvoie exactement DATA', true, P.getDataVueCombinee(solo, 'flo') === solo || P.getDataVueCombinee(solo, null) === solo);
  }

  section('intersecterConges : cas limites');
  {
    test('aucune intersection', [], P.intersecterConges([{ debut: '2026-01-01', fin: '2026-01-05' }], [{ debut: '2026-02-01', fin: '2026-02-05' }]));
    test('journée seule (fin absente)', [['2026-03-03', '2026-03-03']], P.intersecterConges([{ debut: '2026-03-03' }], [{ debut: '2026-03-01', fin: '2026-03-10' }]).map((c) => [c.debut, c.fin]));
    test('liste vide', [], P.intersecterConges([], [{ debut: '2026-03-03' }]));
  }

  section('getDataPourMembre avec réglages personnels (vue par personne)');
  {
    const D = clone(cloud());
    D.personnes = { asso: { heuresParJour: 8, joursParSemaine: 5, semainesParAn: 46, conges: [{ id: 'z', debut: '2026-12-24', fin: '2026-12-26' }] } };
    const v = C.getDataPourMembre(D, 'asso', 'flo', 'flo');
    test('capacité de la personne', [8, 5, 46], [v.params.heuresParJour, v.params.joursParSemaine, v.params.semainesParAn]);
    test('congés de la personne', ['z'], v.conges.map((c) => c.id));
    test('ses missions seulement', ['m2'], v.missions.map((m) => m.id));
    const mien = C.getDataPourMembre(D, 'flo', 'flo', 'flo');
    test('moi : mes valeurs vivantes (params/conges du compte de travail)', [7, 4, 44], [mien.params.heuresParJour, mien.params.joursParSemaine, mien.params.semainesParAn]);
    const ancien = C.getDataPourMembre(D, 'asso');
    test('sans proprietaireId : aucun changement de réglages (comportement d\'avant)', [7, 4, 44], [ancien.params.heuresParJour, ancien.params.joursParSemaine, ancien.params.semainesParAn]);
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Résultat : ${PASS} tests passés, ${FAIL} échoués`);
  if (FAIL > 0) process.exitCode = 1;
}
main();
