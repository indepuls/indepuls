// ── TESTS : diffPaths (shared/core/diff.js) — mode ombre duplication B ──────────
// Revue externe (Claude Cowork, 2026-07-27) sur le plan du mode ombre : deux conditions non
// négociables à couvrir par des tests explicites, pas par confiance dans le code —
//   1. Ne jamais faire fuiter de VALEUR utilisateur dans le résultat, seulement des chemins.
//   2. Ne jamais muter ses arguments (la fonction tourne sur des données réelles en prod).
// + l'exclusion des clés volatiles (uuid()) doit être un principe (par nom de clé, à toute
// profondeur), pas une exception ponctuelle sur un seul chemin.

import { diffPaths, DEFAULT_VOLATILE_KEYS } from '../core/diff.js';

let passed = 0, failed = 0;
function test(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`); failed++; }
}
function ok(label, cond) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}
function section(title) { console.log(`\n── ${title}`); }

section('Objets identiques → aucun écart');
{
  test('rien à signaler', diffPaths({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } }), []);
}

section('Valeur primitive différente → chemin signalé');
{
  test('chemin racine.champ', diffPaths({ x: 1 }, { x: 2 }), ['x']);
}

section('Type différent (string vs number) au même chemin → signalé');
{
  test('type mismatch reporté', diffPaths({ x: '5' }, { x: 5 }), ['x']);
}

section('Tableau : longueur différente → signalée, plus les index en trop');
{
  const d = diffPaths({ arr: [1, 2] }, { arr: [1, 2, 3] });
  ok('contient arr.length', d.includes('arr.length'));
  ok('contient arr[2]', d.includes('arr[2]'));
}

section('Exclusion des clés volatiles (id) — principe, à toute profondeur');
{
  const a = { id: 'aaa', missions: [{ id: 'm1', tempsManuel: [{ id: 't1', ms: 100 }] }] };
  const b = { id: 'bbb', missions: [{ id: 'm2', tempsManuel: [{ id: 't2', ms: 100 }] }] };
  test('aucun écart : seuls les id (racine + 2 niveaux imbriqués) diffèrent', diffPaths(a, b), []);
}
{
  const a = { id: 'aaa', missions: [{ id: 'm1', tempsManuel: [{ id: 't1', ms: 100 }] }] };
  const b = { id: 'bbb', missions: [{ id: 'm2', tempsManuel: [{ id: 't2', ms: 999 }] }] };
  test('un vrai écart métier (ms) reste détecté malgré les id différents', diffPaths(a, b), ['missions[0].tempsManuel[0].ms']);
}

section('Aucune fuite de valeur — le résultat ne contient jamais les données comparées');
{
  const secretClientName = 'Jean Dupont SARL — 4582€';
  const a = { client: secretClientName, montant: 1234.56 };
  const b = { client: 'Autre client', montant: 9999.99 };
  const d = diffPaths(a, b);
  ok('le nom de client n\'apparaît jamais dans le diff', !JSON.stringify(d).includes(secretClientName));
  ok('les montants n\'apparaissent jamais dans le diff', !JSON.stringify(d).includes('1234.56') && !JSON.stringify(d).includes('9999.99'));
  test('seuls des noms de chemins sont renvoyés', d.sort(), ['client', 'montant']);
}

section('Pureté — ne mute jamais ses arguments');
{
  const a = { x: 1, arr: [{ id: 'i1', v: 1 }] };
  const b = { x: 2, arr: [{ id: 'i2', v: 3 }] };
  const aBefore = JSON.stringify(a), bBefore = JSON.stringify(b);
  diffPaths(a, b);
  ok('a non modifié après appel', JSON.stringify(a) === aBefore);
  ok('b non modifié après appel', JSON.stringify(b) === bBefore);
}

section('DEFAULT_VOLATILE_KEYS exporté et contient bien "id"');
{
  ok('id présent dans la liste par défaut', DEFAULT_VOLATILE_KEYS.includes('id'));
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
