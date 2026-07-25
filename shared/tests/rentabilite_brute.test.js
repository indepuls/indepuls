// ── TESTS : TH/TJM réel brut (shared/core/calculs.js) ────────────
// Extraction 2026-07-25 (signalement d'une revue de code externe) : le TJM n'avait aucune
// fonction dédiée dans shared/core — recalculé inline dans indepuls.html (wScoreSante()) à
// chaque point d'affichage, donc structurellement intestable. Ces tests couvrent la seule
// vraie logique métier de l'extraction : la déduction des dépenses liées aux affaires avant
// division — caBrut/hT/caMois/heuresMois restent des paramètres, déjà calculés et couverts par
// ailleurs (getCaFromMissions, getHeuresFact, getHeuresInterne...), pour ne jamais dupliquer
// une seconde fois leur propre logique ici (même convention que resultatHSemaine() dans
// planning.js, qui prend déjà cap/charge en paramètres plutôt que de les recalculer).

import { getTHBrutAnnuel, getTJMBrut, getTHBrutMois } from '../core/calculs.js';

let passed = 0, failed = 0;
function test(label, actual, expected) {
  const ok = Math.abs(actual - expected) <= 0.001;
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${expected}, obtenu ${actual}`); failed++; }
}
function section(title) { console.log(`\n── ${title}`); }

function mkMission(id, isManagement=false) { return { id, isManagement }; }

section('getTHBrutAnnuel — déduit les dépenses liées aux affaires (chantierId)');
{
  const D = {
    params: {},
    missions: [mkMission('m1'), mkMission('m2'), mkMission('mgmt', true)],
    depenses: [
      { chantierId: 'm1', montant: 200 },
      { chantierId: 'm2', montant: 300 },
      { montant: 999 }, // sans chantierId — dépense structurelle, jamais déduite ici
    ],
  };
  // caBrut=10000, hT=100 → (10000 - (200+300))/100 = 95
  test('déduit uniquement les dépenses avec chantierId', getTHBrutAnnuel(D, 10000, 100), 95);
}

section('getTHBrutAnnuel — ignore les dépenses rattachées à une mission de gestion interne');
{
  const D = {
    params: {},
    missions: [mkMission('mgmt', true)],
    depenses: [{ chantierId: 'mgmt', montant: 500 }], // orpheline : mission mgmt exclue du filtre
  };
  // aucune mission non-management → couts=0 → (1000-0)/50 = 20
  test('coûts liés à une mission de gestion ignorés', getTHBrutAnnuel(D, 1000, 50), 20);
}

section('getTHBrutAnnuel — hT=0 → 0 (jamais de division par zéro)');
{
  const D = { params: {}, missions: [], depenses: [] };
  test('hT=0 → 0', getTHBrutAnnuel(D, 5000, 0), 0);
}

section('getTJMBrut — TH × heures/jour, arrondi');
{
  const D = { params: { heuresParJour: 7 } };
  test('7h/jour', getTJMBrut(D, 94.5), 662); // 94.5*7=661.5 → arrondi 662
  const D2 = { params: {} }; // défaut 7h si non renseigné
  test('défaut 7h/jour si non renseigné', getTJMBrut(D2, 100), 700);
}

section('getTHBrutMois — même logique que l\'annuel, restreinte à un mois');
{
  const D = {
    params: {},
    missions: [mkMission('m1')],
    depenses: [
      { chantierId: 'm1', montant: 100, date: '2026-03-15' }, // dans le mois
      { chantierId: 'm1', montant: 500, date: '2026-04-01' }, // hors mois — jamais déduit
    ],
  };
  // caMois=1000, heuresMois=10 → (1000-100)/10 = 90
  test('ne déduit que les dépenses datées dans le mois demandé', getTHBrutMois(D, '2026-03', 1000, 10), 90);
  test('heuresMois=0 → 0', getTHBrutMois(D, '2026-03', 1000, 0), 0);
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
