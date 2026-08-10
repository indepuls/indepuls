// ── TESTS : encaissements annulés exclus du CA / reste à encaisser ────────────
// Conformité livre des recettes (retour Faustine 2026-08-09) : un encaissement supprimé n'est
// jamais effacé, il passe en statutLivre==='annulee' (il reste dans le livre, barré). Il ne doit
// PLUS compter dans getTotalEncaisse, getResteAEncaisser ni getCaFromMissions. Réactiver le remet
// dans les totaux. Ces tests verrouillent l'exclusion (le point sensible : le moteur de CA).

import { encaissementsComptes, getTotalEncaisse, getResteAEncaisser, getCaFromMissions, getPonctuelsCA, getPonctuelsPresta, getPonctuelsVente } from '../core/calculs.js';

let passed = 0, failed = 0;
function test(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`); failed++; }
}

const enc = (id, date, montant, statutLivre) => ({ id, date, montant, ...(statutLivre ? { statutLivre } : {}) });

// Mission ponctuelle : 3 encaissements, dont 1 annulé
const m = { id: 'm1', montantDevis: 3000, statut: 'fact', dateFact: '2026-03-10', encaissements: [
  enc('e1', '2026-03-10', 1000),
  enc('e2', '2026-03-20', 800, 'annulee'),
  enc('e3', '2026-04-05', 1200),
] };

test('encaissementsComptes exclut les annulés (2 sur 3)', encaissementsComptes(m).map(e => e.id), ['e1', 'e3']);
test('getTotalEncaisse exclut l\'annulé (1000+1200)', getTotalEncaisse(m), 2200);
test('getResteAEncaisser remonte (3000-2200)', getResteAEncaisser(m), 800);

// getCaFromMissions par mois : mars = e1 seul (e2 annulé), avril = e3
const DATA = { missions: [m] };
test('CA mars = 1000 (annulé e2 exclu)', getCaFromMissions(DATA, '2026-03'), 1000);
test('CA avril = 1200', getCaFromMissions(DATA, '2026-04'), 1200);

// Réactivation : l'annulé recompte
const m2 = { ...m, encaissements: m.encaissements.map(e => e.id === 'e2' ? { ...e, statutLivre: 'valide' } : e) };
test('réactivé : total = 3000', getTotalEncaisse(m2), 3000);
test('réactivé : reste = 0', getResteAEncaisser(m2), 0);
test('réactivé : CA mars = 1800 (1000+800)', getCaFromMissions({ missions: [m2] }, '2026-03'), 1800);

// Tous les encaissements annulés -> repli sur le montant du devis (mission facturée), comme "aucun encaissement valide"
const mAll = { id: 'm3', montantDevis: 500, statut: 'fact', dateFact: '2026-05-15', encaissements: [ enc('x', '2026-05-15', 500, 'annulee') ] };
test('tous annulés -> total 0', getTotalEncaisse(mAll), 0);
test('tous annulés + facturé -> CA mai = montant devis (500)', getCaFromMissions({ missions: [mAll] }, '2026-05'), 500);

// ── Revenus ponctuels annulés : exclus du CA / seuil TVA, hors_ca non concerné ──
const D2 = { revenus: { '2026-06': { autresList: [
  { id: 'p1', montantPrestation: 500, montantVente: 0 },
  { id: 'p2', montantPrestation: 0, montantVente: 300, statut: 'annulee' },   // annulé -> exclu
  { id: 'p3', montantPrestation: 200, montantVente: 100 },
  { id: 'p4', type: 'hors_ca', montant: 90, montantPrestation: 0, montantVente: 0 }, // hors CA, non concerné
] } } };
test('ponctuels CA exclut l\'annulé (500 + 300)', getPonctuelsCA(D2, '2026-06'), 800);
test('ponctuels presta exclut l\'annulé (500 + 200)', getPonctuelsPresta(D2, '2026-06'), 700);
test('ponctuels vente exclut l\'annulé (0 + 100, pas le 300 annulé)', getPonctuelsVente(D2, '2026-06'), 100);

console.log(`\n${failed === 0 ? '✅ TOUS VERTS' : '❌ ' + failed + ' ÉCHEC(S)'} — ${passed}/${passed + failed}`);
process.exit(failed === 0 ? 0 : 1);
