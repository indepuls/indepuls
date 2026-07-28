// ── TESTS : shared/core/briefHebdo.js — getDecisionBriefHebdo() ──────────────
// Chantier "brief hebdomadaire par email", phase 2/4 (2026-07-27). Fonction de DÉCISION pure :
// ne produit aucun texte final (ça vit dans le gabarit de l'email, phase 3), seulement les
// ingrédients déterministes — score, delta vs la semaine ISO précédente EXACTE (jamais "la
// dernière semaine active trouvée", pour ne jamais fabriquer une tendance trompeuse sur un
// intervalle plus long qu'une semaine), pilier le plus faible, et le signal d'inactivité.

import { getDecisionBriefHebdo } from '../core/briefHebdo.js';

let passed = 0, failed = 0;
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function test(label, actual, expected) {
  if (eq(actual, expected)) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`); failed++; }
}
function section(title) { console.log(`\n── ${title}`); }

section('Aucun snapshot pour la semaine en cours → inactif');
{
  const D = { snapshotsHebdo: {} };
  const d = getDecisionBriefHebdo(D, new Date(2026, 6, 27)); // lundi 2026-W31
  test('inactif=true', d.inactif, true);
  test('score=null', d.score, null);
  test('delta=null', d.delta, null);
  test('pilierFaible=null', d.pilierFaible, null);
}

section('Snapshot présent cette semaine, absent la semaine précédente → pas de delta fabriqué');
{
  const D = { snapshotsHebdo: { '2026-W31': { score: 70, pilierFaible: 'remplissage' } } };
  const d = getDecisionBriefHebdo(D, new Date(2026, 6, 27));
  test('inactif=false', d.inactif, false);
  test('score=70', d.score, 70);
  test('delta=null (rien à comparer)', d.delta, null);
  test('pilierFaible=remplissage', d.pilierFaible, 'remplissage');
}

section('Snapshots sur 2 semaines consécutives → delta calculé (positif)');
{
  const D = { snapshotsHebdo: {
    '2026-W30': { score: 55, pilierFaible: 'trésorerie' },
    '2026-W31': { score: 70, pilierFaible: 'remplissage' },
  } };
  const d = getDecisionBriefHebdo(D, new Date(2026, 6, 27));
  test('delta=+15', d.delta, 15);
  test('pilierFaible reflète la semaine en cours', d.pilierFaible, 'remplissage');
}

section('Delta négatif (le score a baissé)');
{
  const D = { snapshotsHebdo: {
    '2026-W30': { score: 80, pilierFaible: 'rentabilité' },
    '2026-W31': { score: 62, pilierFaible: 'horizon' },
  } };
  const d = getDecisionBriefHebdo(D, new Date(2026, 6, 27));
  test('delta=-18', d.delta, -18);
}

section('Snapshot existant mais 2 semaines avant (pas la précédente EXACTE) → pas de delta');
{
  // Comparer à une semaine trouvée "au hasard" plus loin dans le passé fabriquerait une
  // tendance trompeuse sur un intervalle de 2 semaines présenté comme "vs la semaine dernière".
  const D = { snapshotsHebdo: {
    '2026-W29': { score: 40, pilierFaible: 'trésorerie' },
    '2026-W31': { score: 70, pilierFaible: 'remplissage' },
  } };
  const d = getDecisionBriefHebdo(D, new Date(2026, 6, 27));
  test('delta=null malgré un ancien snapshot disponible', d.delta, null);
}

section('Bascule d\'année ISO — semaine précédente = dernière semaine de l\'année d\'avant');
{
  // 2026-01-01 est en semaine ISO 2026-W01 ; 2025 n'a que 52 semaines ISO (Jan 1 2025 n'est ni
  // un jeudi, ni 2025 bissextile+mercredi) donc la semaine précédente est 2025-W52, pas W53.
  const D = { snapshotsHebdo: {
    '2025-W52': { score: 50, pilierFaible: 'commercial' },
    '2026-W01': { score: 60, pilierFaible: 'remplissage' },
  } };
  const d = getDecisionBriefHebdo(D, new Date(2026, 0, 1));
  test('delta calculé malgré le changement d\'année', d.delta, 10);
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
