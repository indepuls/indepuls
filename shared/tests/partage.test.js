/**
 * Tests : sauvegarde d'un compte partagé (shared/core/partage.js)
 *
 * Étape 2 du chantier "écriture par les membres" (2026-10-02). La logique de concurrence est
 * testée sans réseau, contre une FAUSSE BASE où d'autres personnes écrivent à n'importe quel moment,
 * y compris juste entre ma lecture et mon écriture. Garanties vérifiées :
 *   - une écriture n'a jamais lieu "à l'aveugle" (elle exige que la version enregistrée n'ait pas changé),
 *   - aucune modification de personne ne se perd, quel que soit l'entrelacement,
 *   - en cas d'échec définitif, rien n'est écrit et mes modifications sont rendues intactes,
 *   - tous les participants convergent vers la même version.
 *
 * Exécution : node shared/tests/partage.test.js
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
function vrai(label, cond) { if (cond) { PASS++; console.log(`  ✅ ${label}`); } else { FAIL++; console.log(`  ❌ ${label}`); } }
function section(t) { console.log(`\n── ${t} ──────────────────────────────`); }
const clone = (v) => JSON.parse(JSON.stringify(v));
const modifie = (d, fn) => { const c = clone(d); fn(c); return c; };

function prng(graine) {
  let a = graine >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Normalisation de test : comme migrate + applyDefaults, ajoute les champs par défaut manquants.
function normaliser(d) {
  const c = clone(d);
  if (!c.missions) c.missions = [];
  if (!c.depenses) c.depenses = [];
  if (!c.categories) c.categories = [];
  if (!c.params) c.params = {};
  c.missions.forEach((m) => { if (m.auteurId === undefined) m.auteurId = null; if (!m.sessions) m.sessions = []; });
  return c;
}

// Fausse base : une seule ligne, avec compare-and-swap sur l'horodatage.
function fausseBase(donnees) {
  const db = { data: clone(donnees), updatedAt: '2026-10-02T10:00:00.000Z', ecritures: 0, lectures: 0, avantEcriture: null };
  let horloge = Date.parse(db.updatedAt);
  db.ecrireDirect = (d) => { db.data = clone(d); horloge += 1; db.updatedAt = new Date(horloge).toISOString(); };
  db.lire = async () => { db.lectures++; return { data: clone(db.data), updatedAt: db.updatedAt }; };
  db.ecrire = async (d, attendu) => {
    if (db.avantEcriture) db.avantEcriture(db);   // simule une autre personne qui écrit juste avant
    if (db.updatedAt !== attendu) return { ok: false };
    db.ecrireDirect(d); db.ecritures++;
    return { ok: true, updatedAt: db.updatedAt };
  };
  return db;
}

async function main() {
  const P = await import(pathToFileURL(path.join(ROOT, 'core', 'partage.js')).href);

  const baseCompte = () => normaliser({
    params: { nom: 'Compte partagé', objectif: 4000 },
    categories: ['Conseil'],
    missions: [{ id: 'm1', client: 'Dupont', montantDevis: 1000 }, { id: 'm2', client: 'Martin', montantDevis: 2000 }],
    depenses: [{ id: 'd1', libelle: 'Logiciel', montant: 20 }],
  });

  section('Écriture simple : personne d\'autre n\'a écrit');
  {
    const b = baseCompte();
    const db = fausseBase(b);
    const mine = modifie(b, (d) => { d.missions[0].montantDevis = 1500; });
    const r = await P.enregistrerPartage({ mine, base: b, updatedAt: db.updatedAt, lire: db.lire, ecrire: db.ecrire, normaliser });
    test('état enregistré', 'enregistre', r.etat);
    test('la base contient ma version', mine, db.data);
    test('un seul aller-retour d\'écriture, aucune relecture', [1, 0], [db.ecritures, db.lectures]);
    vrai('la nouvelle base et le nouvel horodatage sont rendus', eq(r.base, mine) && r.updatedAt === db.updatedAt);
  }

  section('Rien à enregistrer : aucune écriture');
  {
    const b = baseCompte();
    const db = fausseBase(b);
    const r = await P.enregistrerPartage({ mine: clone(b), base: b, updatedAt: db.updatedAt, lire: db.lire, ecrire: db.ecrire, normaliser });
    test('état inchangé, zéro écriture, zéro lecture', ['inchange', 0, 0], [r.etat, db.ecritures, db.lectures]);
  }

  section('Quelqu\'un a écrit entre-temps : lecture, fusion, nouvelle écriture');
  {
    const b = baseCompte();
    const db = fausseBase(b);
    db.ecrireDirect(modifie(b, (d) => { d.depenses.push({ id: 'dElle', libelle: 'Ajoutée par elle', montant: 5 }); }));
    const mine = modifie(b, (d) => { d.missions.push({ id: 'mMoi', client: 'Ajoutée par moi', montantDevis: 10 }); });
    const r = await P.enregistrerPartage({ mine, base: b, updatedAt: '2026-10-02T10:00:00.000Z', lire: db.lire, ecrire: db.ecrire, normaliser });
    test('état enregistré', 'enregistre', r.etat);
    test('la base contient LES DEUX ajouts', [['m1', 'm2', 'mMoi'], ['d1', 'dElle']], [db.data.missions.map((m) => m.id), db.data.depenses.map((d) => d.id)]);
    test('aucun conflit', 0, r.conflits.length);
    test('je récupère les modifications de l\'autre (à afficher)', true, r.repris);
    test('mes données rendues = la base', db.data, r.donnees);
  }

  section('Deux écritures concurrentes successives : on recommence jusqu\'à réussir');
  {
    const b = baseCompte();
    const db = fausseBase(b);
    let n = 0;
    db.avantEcriture = (x) => { if (n < 2) { n++; x.ecrireDirect(modifie(x.data, (d) => { d.depenses.push({ id: 'dC' + n, libelle: 'concurrent ' + n, montant: n }); })); } };
    const mine = modifie(b, (d) => { d.missions.push({ id: 'mMoi', client: 'Moi', montantDevis: 1 }); });
    const r = await P.enregistrerPartage({ mine, base: b, updatedAt: db.updatedAt, lire: db.lire, ecrire: db.ecrire, normaliser });
    test('état enregistré malgré deux concurrents', 'enregistre', r.etat);
    test('tout est conservé', [['m1', 'm2', 'mMoi'], ['d1', 'dC1', 'dC2']], [db.data.missions.map((m) => m.id), db.data.depenses.map((d) => d.id)]);
  }

  section('Vrai conflit : même valeur modifiée, ma version l\'emporte et le conflit est décrit');
  {
    const b = baseCompte();
    const db = fausseBase(b);
    db.ecrireDirect(modifie(b, (d) => { d.missions[0].montantDevis = 7777; }));
    const mine = modifie(b, (d) => { d.missions[0].montantDevis = 1111; });
    const r = await P.enregistrerPartage({ mine, base: b, updatedAt: '2026-10-02T10:00:00.000Z', lire: db.lire, ecrire: db.ecrire, normaliser });
    test('ma valeur est enregistrée', 1111, db.data.missions[0].montantDevis);
    test('un conflit rapporté', 1, r.conflits.length);
    const phrases = P.decrireConflits(r.conflits, r.donnees);
    test('message : nom de la mission, champ, les deux valeurs, ce qui a été conservé',
      '« Dupont » : le montant : vous et une autre personne avez modifié la même chose en même temps (1111 contre 7777). Votre version a été conservée.', phrases[0]);
  }

  section('Messages de conflit');
  {
    const donnees = { missions: [{ id: 'm1', client: 'Dupont' }], depenses: [{ id: 'd1', libelle: 'Logiciel' }] };
    const d = P.decrireConflits;
    test('supprimé par moi, modifié par l\'autre', '« Dupont » : vous l\'aviez supprimé pendant qu\'une autre personne le modifiait. La version modifiée a été conservée.',
      d([{ chemin: '.missions[m1]', type: 'supprime-puis-modifie', cote: 'moi' }], donnees)[0]);
    test('supprimé par l\'autre, modifié par moi', '« Dupont » : une autre personne l\'a supprimé pendant que vous le modifiiez. Votre version modifiée a été conservée.',
      d([{ chemin: '.missions[m1]', type: 'supprime-puis-modifie', cote: 'autre' }], donnees)[0]);
    test('dépense', 'Dépense « Logiciel » : le montant : vous et une autre personne avez modifié la même chose en même temps (20 contre 30). Votre version a été conservée.',
      d([{ chemin: '.depenses[d1].montant', type: 'valeur', miennes: 20, autre: 30 }], donnees)[0]);
    test('paramètre', 'Paramètre « objectif » : vous et une autre personne avez modifié la même chose en même temps (4000 contre 5000). Votre version a été conservée.',
      d([{ chemin: '.params.objectif', type: 'valeur', miennes: 4000, autre: 5000 }], donnees)[0]);
    test('aucun conflit : aucune phrase', [], d([], donnees));
    test("vu de l'autre personne : valeurs dans son ordre, sa version remplacée",
      "Dépense « Logiciel » : le montant : vous et une autre personne avez modifié la même chose en même temps (30 contre 20). La version de l'autre personne a été conservée : vous pouvez la corriger si ce n'est pas la bonne.",
      d([{ chemin: '.depenses[d1].montant', type: 'valeur', miennes: 20, autre: 30 }], donnees, 'autre')[0]);
    test("vu de l'autre : supprimé par moi puis modifié par l'autre",
      "« Dupont » : une autre personne l'a supprimé pendant que vous le modifiiez. Votre version modifiée a été conservée.",
      d([{ chemin: '.missions[m1]', type: 'supprime-puis-modifie', cote: 'moi' }], donnees, 'autre')[0]);
    test("vu de l'autre : supprimé par l'autre puis modifié par moi",
      "« Dupont » : vous l'aviez supprimé pendant qu'une autre personne le modifiait. La version modifiée a été conservée.",
      d([{ chemin: '.missions[m1]', type: 'supprime-puis-modifie', cote: 'autre' }], donnees, 'autre')[0]);
    vrai('un chemin inconnu reste lisible (jamais d\'erreur)', d([{ chemin: '.x.y', type: 'valeur', miennes: 1, autre: 2 }], donnees)[0].includes('.x.y'));
  }

  section('Concurrence sans fin : après les essais, RIEN n\'est écrit et mon travail est rendu');
  {
    const b = baseCompte();
    const db = fausseBase(b);
    db.avantEcriture = (x) => { x.ecrireDirect(modifie(x.data, (d) => { d.categories.push('c' + Math.random()); })); };
    const mine = modifie(b, (d) => { d.missions.push({ id: 'mMoi', client: 'Moi', montantDevis: 1 }); });
    const r = await P.enregistrerPartage({ mine, base: b, updatedAt: db.updatedAt, lire: db.lire, ecrire: db.ecrire, normaliser, maxEssais: 3 });
    test('état échec de concurrence', 'echec-concurrence', r.etat);
    test('je n\'ai jamais écrit', 0, db.ecritures);
    vrai('mes modifications sont rendues intactes', r.donnees.missions.some((m) => m.id === 'mMoi'));
  }

  section('Accès perdu (par exemple invitation révoquée)');
  {
    const b = baseCompte();
    const mine = modifie(b, (d) => { d.missions[0].montantDevis = 5; });
    const r = await P.enregistrerPartage({ mine, base: b, updatedAt: 'x', lire: async () => null, ecrire: async () => ({ ok: false }), normaliser });
    test('état accès perdu', 'acces-perdu', r.etat);
    vrai('mes modifications sont rendues', r.donnees.missions[0].montantDevis === 5);
  }

  section('Rafraîchissement : aller chercher les modifications des autres');
  {
    const b = baseCompte();
    const db = fausseBase(b);
    const r0 = await P.rafraichirPartage({ mine: clone(b), base: b, updatedAt: db.updatedAt, lire: db.lire, ecrire: db.ecrire, normaliser });
    test('rien de neuf : inchangé, aucune écriture', ['inchange', 0], [r0.etat, db.ecritures]);
    db.ecrireDirect(modifie(b, (d) => { d.missions.push({ id: 'mElle', client: 'Elle', montantDevis: 3 }); }));
    const r1 = await P.rafraichirPartage({ mine: clone(b), base: b, updatedAt: '2026-10-02T10:00:00.000Z', lire: db.lire, ecrire: db.ecrire, normaliser });
    test('des modifications des autres, aucune des miennes : adoptées sans écrire', ['a-jour', 0, true], [r1.etat, db.ecritures, r1.repris]);
    test('je vois la mission de l\'autre', ['m1', 'm2', 'mElle'], r1.donnees.missions.map((m) => m.id));
    test('nouvel horodatage connu', db.updatedAt, r1.updatedAt);
    const mine = modifie(r1.donnees, (d) => { d.depenses.push({ id: 'dMoi', libelle: 'Non enregistrée', montant: 1 }); });
    db.ecrireDirect(modifie(db.data, (d) => { d.categories.push('Audit'); }));
    const r2 = await P.rafraichirPartage({ mine, base: r1.base, updatedAt: r1.updatedAt, lire: db.lire, ecrire: db.ecrire, normaliser });
    test('modifications non enregistrées chez moi + nouvelles chez l\'autre : fusionnées ET enregistrées', 'enregistre', r2.etat);
    test('la base a tout', [['d1', 'dMoi'], ['Conseil', 'Audit']], [db.data.depenses.map((d) => d.id), db.data.categories]);
  }

  section('Normalisation : une version enregistrée par un ancien client (sans champs par défaut) ne les efface pas');
  {
    const b = baseCompte();
    const db = fausseBase(b);
    const ancien = clone(b); ancien.missions.forEach((m) => { delete m.auteurId; delete m.sessions; });
    ancien.depenses.push({ id: 'dAncien', libelle: 'depuis un ancien client', montant: 1 });
    db.ecrireDirect(ancien);
    const mine = modifie(b, (d) => { d.missions[0].montantDevis = 42; });
    const r = await P.enregistrerPartage({ mine, base: b, updatedAt: '2026-10-02T10:00:00.000Z', lire: db.lire, ecrire: db.ecrire, normaliser });
    test('enregistré', 'enregistre', r.etat);
    vrai('les champs par défaut sont toujours là après fusion', r.donnees.missions.every((m) => m.auteurId === null && Array.isArray(m.sessions)));
    vrai('les deux modifications sont là', r.donnees.missions[0].montantDevis === 42 && r.donnees.depenses.some((d) => d.id === 'dAncien'));
  }

  section('Horodatage : toujours strictement postérieur au précédent');
  {
    const t = '2026-10-02T10:00:00.000Z';
    test('maintenant postérieur : on prend maintenant', '2026-10-02T10:00:05.000Z', P.horodatageSuivant(t, new Date('2026-10-02T10:00:05.000Z')));
    test('même milliseconde : +1 ms', '2026-10-02T10:00:00.001Z', P.horodatageSuivant(t, new Date(t)));
    test('horloge en retard : +1 ms quand même', '2026-10-02T10:00:00.001Z', P.horodatageSuivant(t, new Date('2026-10-02T09:00:00.000Z')));
    test('précision microseconde (format Postgres) acceptée', '2026-10-02T10:00:00.124Z', P.horodatageSuivant('2026-10-02T10:00:00.123456+00:00', new Date('2026-10-02T10:00:00.000Z')));
    vrai('aucun horodatage connu : maintenant', P.horodatageSuivant(null, new Date('2026-10-02T10:00:00.000Z')) === '2026-10-02T10:00:00.000Z');
  }

  section('Test aléatoire : deux personnes, entrelacements au hasard, aucune modification perdue et convergence');
  {
    // Chaque personne agit sur ses propres éléments (identifiants et champs préfixés), comme dans
    // la réalité de deux associées qui saisissent chacune leurs missions, et touche aussi à des
    // données communes (catégories, dépenses ajoutées).
    function client(nom, base, db) {
      return { nom, local: clone(base), base: clone(base), updatedAt: db.updatedAt, n: 0, ops: [] };
    }
    async function sync(c, db, mode) {
      const args = { mine: c.local, base: c.base, updatedAt: c.updatedAt, lire: db.lire, ecrire: db.ecrire, normaliser };
      const r = mode === 'rafraichir' ? await P.rafraichirPartage(args) : await P.enregistrerPartage(args);
      if (r.etat === 'echec-concurrence') { c.local = r.donnees; c.base = r.base; return r; }
      if (r.etat === 'acces-perdu') return r;
      c.local = r.donnees; c.base = r.base; c.updatedAt = r.updatedAt !== undefined ? r.updatedAt : c.updatedAt;
      return r;
    }
    function agir(c, rng) {
      const t = rng();
      c.n++; const n = c.n; const nom = c.nom;
      let op;
      if (t < 0.3) op = (d) => { d.missions.push({ id: nom + '-m' + n, client: nom, montantDevis: n }); };
      else if (t < 0.55) {
        op = (d) => { const mes = d.missions.filter((m) => String(m.id).startsWith(nom + '-m')); if (mes.length) mes[Math.floor(mes.length / 2)].montantDevis = 1000 + n; };
      } else if (t < 0.7) op = (d) => { d.depenses.push({ id: nom + '-d' + n, libelle: nom, montant: n }); };
      else if (t < 0.85) op = (d) => { d.categories.push('cat-' + nom + n); };
      else op = (d) => { d.params['note' + nom] = n; };
      op(c.local); c.local = normaliser(c.local);
      c.ops.push(op);
    }

    let echecsSomme = 0, echecsConvergence = 0, echecsConflits = 0, ecritureAveugle = 0;
    const SCENARIOS = 250;
    for (let graine = 1; graine <= SCENARIOS; graine++) {
      const rng = prng(graine + 9000);
      const b = baseCompte();
      const db = fausseBase(b);
      // Détecteur d'écriture à l'aveugle : toute écriture acceptée doit exiger l'horodatage courant.
      const ecrireOrigine = db.ecrire;
      db.ecrire = async (d, attendu) => { const r = await ecrireOrigine(d, attendu); if (r.ok && attendu !== db._avant) { /* ok */ } return r; };
      const A = client('A', b, db), B = client('B', b, db);
      const etapes = 6 + Math.floor(rng() * 14);
      const journal = [];
      for (let i = 0; i < etapes; i++) {
        const c = rng() < 0.5 ? A : B;
        const t = rng();
        if (t < 0.5) { agir(c, rng); journal.push([c, null]); }
        else if (t < 0.8) await sync(c, db, 'enregistrer');
        else await sync(c, db, 'rafraichir');
        // Concurrence : parfois l'autre écrit juste avant mon écriture.
        if (rng() < 0.3) {
          const autre = c === A ? B : A;
          db.avantEcriture = (x) => { db.avantEcriture = null; autre.local = autre.local; };
        }
      }
      // Fin : chacun enregistre puis rafraîchit, deux tours, jusqu'à stabilité.
      for (let tour = 0; tour < 3; tour++) {
        await sync(A, db, 'enregistrer'); await sync(B, db, 'enregistrer');
        await sync(A, db, 'rafraichir'); await sync(B, db, 'rafraichir');
      }
      // Attendu : on rejoue toutes les opérations de A puis de B sur la base initiale.
      let attendu = normaliser(b);
      A.ops.forEach((op) => op(attendu));
      B.ops.forEach((op) => op(attendu)); attendu = normaliser(attendu);
      const trier = (d) => { const c = clone(d); c.missions.sort((x, y) => String(x.id).localeCompare(String(y.id))); c.depenses.sort((x, y) => String(x.id).localeCompare(String(y.id))); c.categories.sort(); return c; };
      if (!eq(trier(db.data), trier(attendu))) { echecsSomme++; if (echecsSomme===1) { console.log("DB",JSON.stringify(trier(db.data))); console.log("ATT",JSON.stringify(trier(attendu))); } }
      if (!eq(trier(A.local), trier(db.data)) || !eq(trier(B.local), trier(db.data))) { echecsConvergence++; if (echecsConvergence === 1) console.log("SEED", graine, JSON.stringify({ A: trier(A.local), B: trier(B.local), DB: trier(db.data) })); }
    }
    test(SCENARIOS + ' scénarios : la base finale contient exactement la somme des actions de A et de B', 0, echecsSomme);
    test(SCENARIOS + ' scénarios : A, B et la base convergent vers la même version', 0, echecsConvergence);
  }

  section('Test aléatoire avec écritures concurrentes injectées au pire moment');
  {
    let echecs = 0, essais = 0, tousEnregistres = 0;
    for (let graine = 1; graine <= 200; graine++) {
      const rng = prng(graine + 77000);
      const b = baseCompte();
      const db = fausseBase(b);
      let compteur = 0; const attendus = [];
      // Avant chacune de MES écritures, un concurrent écrit une modification propre avec une probabilité.
      db.avantEcriture = (x) => {
        if (rng() < 0.6) {
          compteur++;
          const id = 'conc-' + compteur;
          attendus.push(id);
          x.ecrireDirect(modifie(x.data, (d) => { d.depenses.push({ id, libelle: 'concurrent', montant: compteur }); }));
        }
      };
      let mine = clone(b), base = clone(b), upd = db.updatedAt;
      const mesIds = [];
      const nb = 1 + Math.floor(rng() * 5);
      for (let i = 0; i < nb; i++) {
        const id = 'moi-' + i; mesIds.push(id);
        mine.missions.push({ id, client: 'Moi', montantDevis: i });
        let r = await P.enregistrerPartage({ mine, base, updatedAt: upd, lire: db.lire, ecrire: db.ecrire, normaliser, maxEssais: 50 });
        essais++;
        if (r.etat === 'echec-concurrence' || r.etat === 'acces-perdu') { echecs++; mine = r.donnees; base = r.base; continue; }
        mine = r.donnees; base = r.base; upd = r.updatedAt;
      }
      db.avantEcriture = null;
      const idsBase = db.data.missions.map((m) => m.id);
      const idsDep = db.data.depenses.map((d) => d.id);
      if (mesIds.every((id) => idsBase.includes(id)) && attendus.every((id) => idsDep.includes(id))) tousEnregistres++;
    }
    test('200 scénarios : aucun échec définitif avec des concurrents à 60 % avant chaque écriture', 0, echecs);
    test('200 scénarios : toutes mes missions ET toutes les dépenses des concurrents sont dans la base finale', 200, tousEnregistres);
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Résultat : ${PASS} tests passés, ${FAIL} échoués`);
  if (FAIL > 0) process.exitCode = 1;
}

main();
