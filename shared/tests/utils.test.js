// ── TESTS : shared/core/utils.js — getWeekKey() ──────────────────────────────
// Chantier "brief hebdomadaire par email" (2026-07-27) : fondation du snapshot hebdo
// (DATA.snapshotsHebdo), qui doit tourner à la fois côté navigateur (wScoreSante()) et plus
// tard côté serveur (cron) — d'où l'extraction dans shared/core plutôt qu'une fonction locale
// à indepuls.html. Semaine ISO 8601 (lundi-dimanche), format "AAAA-Wnn".

import { getWeekKey } from '../core/utils.js';

let passed = 0, failed = 0;
function test(label, actual, expected) {
  if (actual === expected) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${expected}, obtenu ${actual}`); failed++; }
}
function section(title) { console.log(`\n── ${title}`); }

section('Semaines de référence connues (faits ISO 8601 documentés)');
{
  // 2020 a 53 semaines ISO (fait bien documenté) — 31/12/2020 est un jeudi.
  test('2020-12-31 (jeudi) → 2020-W53', getWeekKey(new Date(2020, 11, 31)), '2020-W53');
  // 01/01/2021 est un vendredi → appartient encore à la semaine ISO 2020-W53 (le jeudi de
  // cette semaine, 31/12/2020, tombe en 2020).
  test('2021-01-01 (vendredi, chevauche 2020) → 2020-W53', getWeekKey(new Date(2021, 0, 1)), '2020-W53');
  // 04/01/2016 est un lundi → toujours le lundi de la semaine ISO 01 (par définition, la
  // semaine contenant le 4 janvier est toujours S01).
  test('2016-01-04 (lundi, définition ISO de S01) → 2016-W01', getWeekKey(new Date(2016, 0, 4)), '2016-W01');
  // 01/01/2026 est un jeudi → semaine 01 par définition (le 1er jour de l'année est aussi le
  // jeudi de sa semaine).
  test('2026-01-01 (jeudi) → 2026-W01', getWeekKey(new Date(2026, 0, 1)), '2026-W01');
  // 2026 a aussi 53 semaines ISO (jan1 est jeudi) — 31/12/2026 est un jeudi.
  test('2026-12-31 (jeudi) → 2026-W53', getWeekKey(new Date(2026, 11, 31)), '2026-W53');
}

section('Continuité — les 7 jours d\'une même semaine ISO renvoient la même clé');
{
  // Semaine du lundi 2026-07-27 au dimanche 2026-08-02.
  const jours = [27, 28, 29, 30, 31].map(d => new Date(2026, 6, d))
    .concat([1, 2].map(d => new Date(2026, 7, d)));
  const cles = jours.map(getWeekKey);
  test('les 7 jours partagent la même clé', new Set(cles).size, 1);
  test('cette clé est bien 2026-W31', cles[0], '2026-W31');
}

section('Bascule de semaine — le lundi suivant change bien de clé');
{
  test('2026-08-03 (lundi suivant) → 2026-W32', getWeekKey(new Date(2026, 7, 3)), '2026-W32');
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
