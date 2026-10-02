/**
 * Tests : fusion à trois voies de deux versions d'un compte (shared/core/fusion.js)
 *
 * Étape 1 du chantier "écriture par les membres" (2026-10-02). La fonction n'est branchée nulle
 * part dans l'application : ces tests sont sa seule garantie avant d'être utilisée sur un compte
 * partagé. Ils vérifient surtout qu'AUCUN TRAVAIL NE SE PERD :
 *   - cas précis (ajouts, modifications, suppressions, conflits, listes sans identifiant),
 *   - propriétés (identités, stabilité, non-mutation des entrées),
 *   - test aléatoire (graine fixe, donc reproductible) : des centaines de scénarios où deux
 *     personnes modifient des éléments DIFFÉRENTS doivent toujours donner exactement la somme de
 *     leurs modifications, sans aucun conflit, quel que soit l'ordre de fusion.
 *
 * Exécution : node shared/tests/fusion.test.js
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
function vrai(label, condition) {
  if (condition) { PASS++; console.log(`  ✅ ${label}`); }
  else { FAIL++; console.log(`  ❌ ${label}`); }
}
function section(titre) { console.log(`\n── ${titre} ──────────────────────────────`); }

const clone = (v) => JSON.parse(JSON.stringify(v));
const modifie = (d, fn) => { const c = clone(d); fn(c); return c; };
function gelerProfond(v) {
  if (v && typeof v === 'object') { Object.values(v).forEach(gelerProfond); Object.freeze(v); }
  return v;
}

function baseCompte() {
  return {
    params: { nom: 'Faustine', objectif: 4000, statut: 'sasu', pA: 1, pB: 1 },
    categories: ['Conseil', 'Formation'],
    missions: [
      { id: 'm1', client: 'Dupont', montantDevis: 1000, statut: 'cours', sessions: [{ date: '2026-10-01', h: 3 }, { date: '2026-10-02', h: 2 }], encaissements: [{ id: 'e1', montant: 500 }], tempsManuel: [] },
      { id: 'm2', client: 'Martin', montantDevis: 2000, statut: 'att', sessions: [], encaissements: [], tempsManuel: [] },
      { id: 'm3', client: 'Durand', montantDevis: 300, statut: 'fact', sessions: [], encaissements: [], tempsManuel: [] },
    ],
    depenses: [{ id: 'd1', libelle: 'Logiciel', montant: 20 }],
    revenus: { '2026-10': { impots: 0, autresList: [{ id: 'r1', montant: 100 }] } },
    tempsInterne: { '2026-10': 3600000 },
    _ownerUid: 'u-moi',
  };
}
const idsDe = (d) => d.missions.map((m) => m.id).sort();

// Générateur pseudo-aléatoire à graine fixe (résultats reproductibles).
function prng(graine) {
  let a = graine >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const F = await import(pathToFileURL(path.join(ROOT, 'core', 'fusion.js')).href);
  const fus = F.fusionnerDonnees;

  section('Identités : rien n\'a changé ou un seul côté a changé');
  {
    const b = baseCompte();
    const m = modifie(b, (d) => { d.missions[0].montantDevis = 1500; });
    test('rien ne change : fusion = base', b, fus(b, clone(b), clone(b)).fusion);
    test('seul moi : ma version', m, fus(b, m, clone(b)).fusion);
    test('seule l\'autre personne : sa version', m, fus(b, clone(b), m).fusion);
    test('modification identique des deux côtés : aucun conflit', 0, fus(b, m, clone(m)).conflits.length);
    test('indicateur : seul moi a changé, rien à reprendre de l\'autre', false, fus(b, m, clone(b)).differeDeLaMienne);
    test('indicateur : seul moi a changé, il y a quelque chose à enregistrer', true, fus(b, m, clone(b)).differeDeLAutre);
    test('indicateur : seule l\'autre a changé, rien à enregistrer', false, fus(b, clone(b), m).differeDeLAutre);
  }

  section('Ajouts simultanés dans des listes à identifiants');
  {
    const b = baseCompte();
    const moi = modifie(b, (d) => { d.missions.push({ id: 'mMoi', client: 'Client de moi', montantDevis: 100 }); });
    const elle = modifie(b, (d) => { d.missions.push({ id: 'mElle', client: 'Client de elle', montantDevis: 200 }); });
    const r = fus(b, moi, elle);
    test('les deux missions sont conservées', ['m1', 'm2', 'm3', 'mElle', 'mMoi'], idsDe(r.fusion));
    test('aucun conflit', 0, r.conflits.length);
    test('ordre : la version enregistrée d\'abord, mes ajouts ensuite', ['m1', 'm2', 'm3', 'mElle', 'mMoi'], r.fusion.missions.map((m) => m.id));
    const moi2 = modifie(b, (d) => { d.depenses.push({ id: 'dMoi', montant: 5 }); });
    const elle2 = modifie(b, (d) => { d.missions.push({ id: 'mElle', montantDevis: 1 }); });
    const r2 = fus(b, moi2, elle2);
    vrai('une dépense (moi) et une mission (elle) coexistent', r2.fusion.depenses.length === 2 && r2.fusion.missions.length === 4);
  }

  section('Modifications simultanées de champs différents d\'un même élément');
  {
    const b = baseCompte();
    const moi = modifie(b, (d) => { d.missions[0].montantDevis = 1111; });
    const elle = modifie(b, (d) => { d.missions[0].statut = 'fact'; });
    const r = fus(b, moi, elle);
    test('les deux modifications sont appliquées', { montantDevis: 1111, statut: 'fact' }, { montantDevis: r.fusion.missions[0].montantDevis, statut: r.fusion.missions[0].statut });
    test('aucun conflit', 0, r.conflits.length);
    const moi2 = modifie(b, (d) => { d.params.pA = 9; });
    const elle2 = modifie(b, (d) => { d.params.pB = 7; });
    const r2 = fus(b, moi2, elle2);
    test('paramètres différents : les deux conservés', { pA: 9, pB: 7 }, { pA: r2.fusion.params.pA, pB: r2.fusion.params.pB });
  }

  section('Vrai conflit : même champ modifié des deux côtés');
  {
    const b = baseCompte();
    const moi = modifie(b, (d) => { d.missions[0].montantDevis = 1111; });
    const elle = modifie(b, (d) => { d.missions[0].montantDevis = 2222; });
    const r = fus(b, moi, elle);
    test('ma version l\'emporte', 1111, r.fusion.missions[0].montantDevis);
    test('un conflit est rapporté', 1, r.conflits.length);
    test('avec le chemin exact', '.missions[m1].montantDevis', r.conflits[0].chemin);
    test('les deux valeurs sont dans le rapport', { miennes: 1111, autre: 2222, resolution: 'mienne', type: 'valeur' }, { miennes: r.conflits[0].miennes, autre: r.conflits[0].autre, resolution: r.conflits[0].resolution, type: r.conflits[0].type });
    const r2 = fus(b, elle, moi);
    test('inversé : c\'est alors l\'autre version qui est "la mienne"', 2222, r2.fusion.missions[0].montantDevis);
    const moi3 = modifie(b, (d) => { d.tempsInterne['2026-10'] += 7200000; });
    const elle3 = modifie(b, (d) => { d.tempsInterne['2026-10'] += 1800000; });
    const r3 = fus(b, moi3, elle3);
    test('temps interne du même mois ajouté des deux côtés : aucun conflit', 0, r3.conflits.length);
    test('les deux ajouts sadditionnent', 3600000 + 7200000 + 1800000, r3.fusion.tempsInterne['2026-10']);
    test('même résultat dans lautre sens', 3600000 + 7200000 + 1800000, fus(b, elle3, moi3).fusion.tempsInterne['2026-10']);
    const moi4 = modifie(b, (d) => { d.tempsInterne['2026-10'] -= 3000000; });
    const elle4 = modifie(b, (d) => { d.tempsInterne['2026-10'] -= 2000000; });
    test('deux retraits qui dépasseraient zéro : jamais négatif', 0, fus(b, moi4, elle4).fusion.tempsInterne['2026-10']);
    const moi5 = modifie(b, (d) => { d.tempsInterne['2026-11'] = 5000; });
    const elle5 = modifie(b, (d) => { d.tempsInterne['2026-11'] = 7000; });
    test('nouveau mois ajouté des deux côtés : additionné aussi', 12000, fus(b, moi5, elle5).fusion.tempsInterne['2026-11']);
  }

  section('Suppressions');
  {
    const b = baseCompte();
    const moi = modifie(b, (d) => { d.missions = d.missions.filter((m) => m.id !== 'm2'); });
    const r = fus(b, moi, clone(b));
    test('supprimée par moi, intacte chez l\'autre : supprimée', ['m1', 'm3'], idsDe(r.fusion));
    test('sans conflit', 0, r.conflits.length);
    const r2 = fus(b, clone(b), moi);
    test('supprimée par l\'autre, intacte chez moi : supprimée', ['m1', 'm3'], idsDe(r2.fusion));
    const elleModifie = modifie(b, (d) => { d.missions[1].montantDevis = 2500; });
    const r3 = fus(b, moi, elleModifie);
    test('supprimée par moi MAIS modifiée par l\'autre : conservée (jamais de perte silencieuse)', ['m1', 'm2', 'm3'], idsDe(r3.fusion));
    test('la version conservée est la modifiée', 2500, r3.fusion.missions.find((m) => m.id === 'm2').montantDevis);
    test('conflit rapporté, type supprime-puis-modifie', ['supprime-puis-modifie', 'm2'], [r3.conflits[0].type, r3.conflits[0].element]);
    const r4 = fus(b, elleModifie, moi);
    test('supprimée par l\'autre MAIS modifiée par moi : conservée', ['m1', 'm2', 'm3'], idsDe(r4.fusion));
    const moiSupprime = modifie(b, (d) => { d.missions = d.missions.filter((m) => m.id !== 'm2'); });
    const elleSupprime = modifie(b, (d) => { d.missions = d.missions.filter((m) => m.id !== 'm2'); });
    test('supprimée des deux côtés : supprimée, sans conflit', [['m1', 'm3'], 0], [idsDe(fus(b, moiSupprime, elleSupprime).fusion), fus(b, moiSupprime, elleSupprime).conflits.length]);
    const cleSupprimee = modifie(b, (d) => { delete d.params.pA; });
    const cleModifiee = modifie(b, (d) => { d.params.pA = 5; });
    const r5 = fus(b, cleSupprimee, cleModifiee);
    test('clé d\'objet supprimée par moi mais modifiée par l\'autre : conservée', 5, r5.fusion.params.pA);
  }

  section('Listes sans identifiant : textes (catégories) et créneaux de calendrier');
  {
    const b = baseCompte();
    const moi = modifie(b, (d) => { d.categories.push('Coaching'); });
    const elle = modifie(b, (d) => { d.categories.push('Audit'); });
    const r = fus(b, moi, elle);
    test('catégories ajoutées des deux côtés : les deux conservées', ['Conseil', 'Formation', 'Audit', 'Coaching'], r.fusion.categories);
    test('sans conflit', 0, r.conflits.length);
    const elle2 = modifie(b, (d) => { d.categories.push('Coaching'); });
    test('même catégorie ajoutée des deux côtés : un seul exemplaire', ['Conseil', 'Formation', 'Coaching'], fus(b, moi, elle2).fusion.categories);
    const moi3 = modifie(b, (d) => { d.categories = d.categories.filter((c) => c !== 'Formation'); });
    const elle3 = modifie(b, (d) => { d.categories.push('Audit'); });
    test('suppression (moi) et ajout (elle) : les deux appliqués', ['Conseil', 'Audit'], fus(b, moi3, elle3).fusion.categories);

    const sMoi = modifie(b, (d) => { d.missions[0].sessions.push({ date: '2026-10-05', h: 4 }); });
    const sElle = modifie(b, (d) => { d.missions[0].sessions.push({ date: '2026-10-06', h: 1 }); });
    const rs = fus(b, sMoi, sElle);
    test('créneaux ajoutés des deux côtés : les 4 sont conservés', 4, rs.fusion.missions[0].sessions.length);
    const sSupp = modifie(b, (d) => { d.missions[0].sessions = d.missions[0].sessions.slice(1); });
    const rs2 = fus(b, sSupp, sElle);
    test('créneau supprimé par moi, autre créneau ajouté par elle : les deux appliqués', [{ date: '2026-10-02', h: 2 }, { date: '2026-10-06', h: 1 }], rs2.fusion.missions[0].sessions);
    const sModif = modifie(b, (d) => { d.missions[0].sessions[0].h = 8; });
    const rs3 = fus(b, sModif, sElle);
    test('créneau modifié par moi (compte comme remplacé), autre ajouté par elle', 3, rs3.fusion.missions[0].sessions.length);
    vrai('le créneau modifié est bien la nouvelle version', rs3.fusion.missions[0].sessions.some((s) => s.date === '2026-10-01' && s.h === 8) && !rs3.fusion.missions[0].sessions.some((s) => s.date === '2026-10-01' && s.h === 3));
  }

  section('Structures imbriquées : revenus par mois, encaissements');
  {
    const b = baseCompte();
    const moi = modifie(b, (d) => { d.revenus['2026-10'].autresList.push({ id: 'rMoi', montant: 50 }); });
    const elle = modifie(b, (d) => { d.revenus['2026-11'] = { impots: 10, autresList: [] }; d.missions[0].encaissements.push({ id: 'eElle', montant: 250 }); });
    const r = fus(b, moi, elle);
    test('autre mois créé par elle : conservé', { impots: 10, autresList: [] }, r.fusion.revenus['2026-11']);
    test('revenu ajouté par moi dans un mois existant : conservé', ['r1', 'rMoi'], r.fusion.revenus['2026-10'].autresList.map((x) => x.id));
    test('encaissement ajouté par elle dans une mission : conservé', ['e1', 'eElle'], r.fusion.missions[0].encaissements.map((x) => x.id));
    test('aucun conflit', 0, r.conflits.length);
  }

  section('Champs internes à la session et non-mutation des entrées');
  {
    const b = baseCompte();
    const moi = modifie(b, (d) => { d.missions[0].montantDevis = 1; d._ownerUid = 'u-moi'; });
    const elle = modifie(b, (d) => { d.missions[1].montantDevis = 2; d._ownerUid = 'u-autre'; });
    const r = fus(b, moi, elle);
    test('_ownerUid : toujours celui de MA version', 'u-moi', r.fusion._ownerUid);
    const sansUid = modifie(b, (d) => { delete d._ownerUid; });
    test('_ownerUid absent de ma version : absent du résultat', false, Object.prototype.hasOwnProperty.call(fus(b, sansUid, elle).fusion, '_ownerUid'));

    const bG = gelerProfond(baseCompte()), mG = gelerProfond(modifie(baseCompte(), (d) => { d.missions[0].montantDevis = 9; d.categories.push('X'); })), eG = gelerProfond(modifie(baseCompte(), (d) => { d.missions[0].statut = 'fact'; d.missions.push({ id: 'z', client: 'Z' }); }));
    let leve = false;
    try { fus(bG, mG, eG); } catch (e) { leve = true; }
    test('entrées gelées : aucune tentative de modification', false, leve);
    const r2 = fus(bG, mG, eG);
    r2.fusion.missions[0].montantDevis = 123456;
    test('le résultat est indépendant des entrées (modifier la fusion ne touche pas les entrées)', 9, mG.missions[0].montantDevis);
  }

  section('Stabilité : refusionner le résultat avec la version enregistrée ne change plus rien');
  {
    const b = baseCompte();
    const moi = modifie(b, (d) => { d.missions[0].montantDevis = 1111; d.categories.push('Coaching'); d.missions.push({ id: 'mMoi', client: 'M' }); });
    const elle = modifie(b, (d) => { d.missions[1].statut = 'fact'; d.depenses.push({ id: 'dElle', montant: 3 }); });
    const r = fus(b, moi, elle);
    const r2 = fus(elle, r.fusion, elle);
    test('après enregistrement, (base = version enregistrée, moi = fusion) redonne la fusion', r.fusion, r2.fusion);
    test('et il ne reste plus rien à enregistrer sur cette base', true, r2.differeDeLAutre === true && r2.conflits.length === 0);
  }

  section('Test aléatoire : modifications simultanées d\'éléments DIFFÉRENTS = somme exacte, sans perte');
  {
    function genererBase(rng) {
      const nb = 6 + Math.floor(rng() * 10);
      const d = { params: { pA: 0, pB: 0, nom: 'X' }, categories: ['c0', 'c1', 'c2'], missions: [], depenses: [], revenus: {}, tempsInterne: { '2026-01': 100, '2026-02': 200 } };
      for (let i = 0; i < nb; i++) d.missions.push({ id: 'm' + i, client: 'C' + i, montantDevis: 100 * i, statut: 'cours', sessions: [{ date: '2026-10-0' + (1 + (i % 8)), h: 1 + (i % 3) }], encaissements: [], tempsManuel: [] });
      for (let i = 0; i < 4; i++) d.depenses.push({ id: 'd' + i, libelle: 'L' + i, montant: 10 * i });
      return d;
    }
    // Génère des opérations qui ne touchent QUE les éléments de la parité donnée (pour que A et B
    // soient disjoints), avec des identifiants et clés propres à chaque personne.
    function genererOps(rng, base, parite, pref, clePar, mois) {
      const ops = [];
      const miens = base.missions.filter((_, i) => i % 2 === parite);
      miens.forEach((m) => {
        const t = rng();
        if (t < 0.25) ops.push((d) => { const x = d.missions.find((y) => y.id === m.id); if (x) x.montantDevis = Math.floor(rng() * 1e6) + 7; });
        else if (t < 0.4) ops.push((d) => { d.missions = d.missions.filter((y) => y.id !== m.id); });
        else if (t < 0.55) ops.push((d) => { const x = d.missions.find((y) => y.id === m.id); if (x) x.sessions.push({ date: '2026-11-' + pref, h: 9 }); });
        else if (t < 0.65) ops.push((d) => { const x = d.missions.find((y) => y.id === m.id); if (x) x.encaissements.push({ id: pref + 'e' + m.id, montant: 1 }); });
      });
      const ajouts = Math.floor(rng() * 3);
      for (let i = 0; i < ajouts; i++) ops.push((d) => { d.missions.push({ id: pref + 'new' + i, client: pref, montantDevis: i, sessions: [], encaissements: [], tempsManuel: [] }); });
      if (rng() < 0.6) ops.push((d) => { d.params[clePar] = Math.floor(rng() * 1000) + 1; });
      if (rng() < 0.6) ops.push((d) => { d.categories.push('cat-' + pref); });
      if (rng() < 0.5) ops.push((d) => { d.depenses.push({ id: pref + 'dep', libelle: pref, montant: 5 }); });
      if (rng() < 0.4) ops.push((d) => { d.tempsInterne[mois] += 50; });
      const pairesDep = base.depenses.filter((_, i) => i % 2 === parite);
      pairesDep.forEach((dep) => { if (rng() < 0.4) ops.push((d) => { const x = d.depenses.find((y) => y.id === dep.id); if (x) x.montant += 3; }); });
      return ops;
    }
    const appliquer = (d, ops) => { ops.forEach((f) => f(d)); return d; };
    function normaliser(d) {
      const c = clone(d);
      c.missions = c.missions.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      c.missions.forEach((m) => { m.sessions = m.sessions.slice().sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))); m.encaissements.sort((a, b) => String(a.id).localeCompare(String(b.id))); });
      c.depenses = c.depenses.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      c.categories = c.categories.slice().sort();
      return c;
    }

    let scenarios = 0, echecsSomme = 0, echecsOrdre = 0, conflitsInattendus = 0;
    for (let graine = 1; graine <= 400; graine++) {
      const rng = prng(graine);
      const base = genererBase(rng);
      // Les opérations aléatoires lisent leur générateur au moment d'être appliquées : A, B et
      // l'attendu sont donc chacun fabriqués avec une graine identique à chaque fois, pour que les
      // valeurs tirées soient exactement les mêmes dans les trois calculs.
      const fabriquer = (parite, pref, clePar, mois, rr) => genererOps(rr, base, parite, pref, clePar, mois);
      const versionA = appliquer(clone(base), fabriquer(0, 'A', 'pA', '2026-01', prng(graine * 7 + 1)));
      const versionB = appliquer(clone(base), fabriquer(1, 'B', 'pB', '2026-02', prng(graine * 13 + 5)));
      // Attendu : appliquer A puis B (éléments disjoints, donc l'ordre n'a pas d'importance), en
      // rejouant exactement les mêmes opérations (mêmes graines).
      const attendu = appliquer(appliquer(clone(base), fabriquer(0, 'A', 'pA', '2026-01', prng(graine * 7 + 1))), fabriquer(1, 'B', 'pB', '2026-02', prng(graine * 13 + 5)));
      const ab = fus(base, versionA, versionB);
      const ba = fus(base, versionB, versionA);
      scenarios++;
      if (!eq(normaliser(ab.fusion), normaliser(attendu))) echecsSomme++;
      if (!eq(normaliser(ab.fusion), normaliser(ba.fusion))) echecsOrdre++;
      if (ab.conflits.length || ba.conflits.length) conflitsInattendus++;
    }
    test(scenarios + ' scénarios : la fusion donne exactement la somme des modifications de A et de B', 0, echecsSomme);
    test(scenarios + ' scénarios : même résultat quel que soit qui fusionne (A puis B ou B puis A)', 0, echecsOrdre);
    test(scenarios + ' scénarios : aucun conflit signalé quand les éléments modifiés sont différents', 0, conflitsInattendus);

    // Conflits volontaires : les deux modifient la MÊME mission, même champ.
    let ok = 0, total = 0, perdus = 0;
    for (let graine = 1; graine <= 200; graine++) {
      const rng = prng(graine + 5000);
      const base = genererBase(rng);
      const cible = base.missions[Math.floor(rng() * base.missions.length)].id;
      const vMoi = 1e7 + Math.floor(rng() * 1000), vElle = 2e7 + Math.floor(rng() * 1000);
      const moi = modifie(base, (d) => { d.missions.find((m) => m.id === cible).montantDevis = vMoi; d.categories.push('cat-moi'); });
      const elle = modifie(base, (d) => { d.missions.find((m) => m.id === cible).montantDevis = vElle; d.categories.push('cat-elle'); });
      const r = fus(base, moi, elle);
      total++;
      if (r.conflits.length === 1 && r.conflits[0].chemin === '.missions[' + cible + '].montantDevis' && r.fusion.missions.find((m) => m.id === cible).montantDevis === vMoi) ok++;
      if (!(r.fusion.categories.includes('cat-moi') && r.fusion.categories.includes('cat-elle'))) perdus++;
    }
    test(total + ' conflits volontaires : exactement 1 conflit rapporté, au bon endroit, ma version conservée', total, ok);
    test(total + ' conflits volontaires : les modifications non conflictuelles du même scénario ne sont jamais perdues', 0, perdus);
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Résultat : ${PASS} tests passés, ${FAIL} échoués`);
  if (FAIL > 0) process.exitCode = 1;
}

main();
