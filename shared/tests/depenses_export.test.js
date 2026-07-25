// ── TESTS : getDepensesLignesMois (shared/core/calculs.js) ──────
// Nouvelle fonction (2026-07-25, chantier "export comptable") : comme getDepensesMois, mais
// retourne les lignes détaillées plutôt qu'un total — nécessaire pour un export ligne par ligne
// (CSV/PDF) alors que getDepensesMois ne servait jusqu'ici qu'à des totaux agrégés.

import { getDepensesLignesMois } from '../core/calculs.js';

let passed = 0, failed = 0;
function testEq(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`); failed++; }
}
function section(title) { console.log(`\n── ${title}`); }

function mkData(depenses, dateOuverture) {
  return { params: { dateOuverture: dateOuverture || '2026-01-01' }, depenses };
}

section('Dépense ponctuelle — visible uniquement sur son mois exact');
{
  const d = { id: 'd1', libelle: 'Achat matériel', montant: 100, recurrence: 'ponctuelle', date: '2026-03-15' };
  testEq('mars : 1 ligne, date inchangée', getDepensesLignesMois(mkData([d]), '2026-03'), [d]);
  testEq('février : aucune ligne', getDepensesLignesMois(mkData([d]), '2026-02'), []);
}

section('Dépense mensuelle — une ligne par mois actif, datée du 1er');
{
  const d = { id: 'd2', libelle: 'Abonnement logiciel', montant: 20, recurrence: 'mensuelle', date: '2026-01-05', dateDebut: '2026-02-01' };
  testEq('janvier (avant dateDebut) : aucune ligne', getDepensesLignesMois(mkData([d]), '2026-01'), []);
  testEq('février (dateDebut) : 1 ligne datée du 1er', getDepensesLignesMois(mkData([d]), '2026-02'), [{ ...d, date: '2026-02-01' }]);
  testEq('juin : toujours 1 ligne (mensuelle sans fin)', getDepensesLignesMois(mkData([d]), '2026-06'), [{ ...d, date: '2026-06-01' }]);
}

section('Dépense annuelle — une seule occurrence par an, sur son mois d\'ancrage');
{
  const d = { id: 'd3', libelle: 'Assurance pro', montant: 600, recurrence: 'annuelle', date: '2026-09-10' };
  testEq('septembre : 1 ligne datée du jour d\'ancrage', getDepensesLignesMois(mkData([d]), '2026-09'), [{ ...d, date: '2026-09-10' }]);
  testEq('octobre : aucune ligne', getDepensesLignesMois(mkData([d]), '2026-10'), []);
}

section('Avant la date d\'ouverture — aucune ligne (garde-fou isMonthBeforeOpening)');
{
  const d = { id: 'd4', libelle: 'Dépense', montant: 50, recurrence: 'ponctuelle', date: '2025-06-01' };
  testEq('mois antérieur à l\'ouverture : liste vide', getDepensesLignesMois(mkData([d], '2026-01-01'), '2025-06'), []);
}

section('Plusieurs dépenses le même mois — toutes remontées');
{
  const a = { id: 'a', libelle: 'A', montant: 10, recurrence: 'ponctuelle', date: '2026-05-02' };
  const b = { id: 'b', libelle: 'B', montant: 15, recurrence: 'ponctuelle', date: '2026-05-20' };
  testEq('mai : 2 lignes', getDepensesLignesMois(mkData([a, b]), '2026-05').length, 2);
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
