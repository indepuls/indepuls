// ── TESTS : détection du temps réel sous-déclaré (pilier Rentabilité) ────────────
// Bug de confiance bêta (Charlène/Orianne, 2026-08-14) : une mission facturée comptée dans le CA
// mais sans temps réel saisi gonfle le TH/TJM réel → score de rentabilité faussement excellent.
// getMissionsRentabiliteTempsManquant() flague UNIQUEMENT l'implausible (seuil validé par
// Faustine) : temps loggé < 20 % du prévu, OU (aucun prévu ET < 0,5 h) sur une mission qui compte
// dans le CA de la fenêtre 12 mois glissants. Ces tests verrouillent le seuil et le scope.

import { getMissionsRentabiliteTempsManquant, rentabiliteDonneesInsuffisantes, RENT_SEUIL_RATIO, RENT_SEUIL_HEURES_MIN } from '../core/calculs.js';

let passed = 0, failed = 0;
function test(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`); failed++; }
}

// Dates calculées par rapport à "maintenant" pour que les tests restent valides quelle que soit la
// date d'exécution (la fenêtre glissante dépend de new Date()).
const now = new Date();
const mkOf = (offsetMois) => { const d = new Date(now.getFullYear(), now.getMonth() - offsetMois, 10); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-10`; };
const dToday = mkOf(0);      // mois en cours, dans la fenêtre
const dVieux = mkOf(18);     // 18 mois en arrière, hors fenêtre (dateOuverture absente → fenêtre 12 mois)

// Missions couvrant chaque branche
const missions = [
  // Correctement loggée : 8 h sur 10 prévues (80 %) → fiable
  { id: 'ok', statut: 'fact', dateFact: dToday, montantDevis: 1000, tempsPrevu: 10, heuresSaisies: 8 },
  // Facturée, CA compté, 0 h loggée sur 10 prévues → flaguée
  { id: 'gap', statut: 'fact', dateFact: dToday, montantDevis: 2000, tempsPrevu: 10, heuresSaisies: 0 },
  // Aucun prévu, 0,2 h loggée (< 0,5) → flaguée
  { id: 'gap0', statut: 'fact', dateFact: dToday, montantDevis: 500, heuresSaisies: 0.2 },
  // Aucun prévu, 3 h loggées (≥ 0,5, rien à comparer) → fiable
  { id: 'ok0', statut: 'fact', dateFact: dToday, montantDevis: 500, heuresSaisies: 3 },
  // En attente (non signée), 0 h, ne compte pas dans le CA → jamais flaguée
  { id: 'att', statut: 'att', montantDevis: 5000, tempsPrevu: 20, heuresSaisies: 0 },
  // Exactement 20 % du prévu (2 h / 10) → on fait confiance (seuil STRICT en dessous)
  { id: 'edge20', statut: 'fact', dateFact: dToday, montantDevis: 1000, tempsPrevu: 10, heuresSaisies: 2 },
  // Juste sous 20 % (1,9 h / 10) → flaguée
  { id: 'edge19', statut: 'fact', dateFact: dToday, montantDevis: 1000, tempsPrevu: 10, heuresSaisies: 1.9 },
  // CA via encaissement (pas dateFact), 1 h / 40 prévues → flaguée
  { id: 'enc', statut: 'cours', tempsPrevu: 40, heuresSaisies: 1, encaissements: [{ id: 'e1', date: dToday, montant: 1000 }] },
  // Encaissement ANNULÉ uniquement → ne compte pas dans le CA → jamais flaguée malgré 0 h
  { id: 'ann', statut: 'cours', tempsPrevu: 40, heuresSaisies: 0, encaissements: [{ id: 'e2', date: dToday, montant: 1000, statutLivre: 'annulee' }] },
  // Gestion interne → toujours exclue
  { id: 'mgmt', isManagement: true, statut: 'fact', dateFact: dToday, montantDevis: 1000, tempsPrevu: 10, heuresSaisies: 0 },
  // Facturée hors fenêtre (18 mois) → jamais flaguée
  { id: 'old', statut: 'fact', dateFact: dVieux, montantDevis: 1000, tempsPrevu: 10, heuresSaisies: 0 },
];

const DATA = { params: {}, missions };
const ids = getMissionsRentabiliteTempsManquant(DATA).map(f => f.id).sort();

console.log('── Seuils exposés');
test('RENT_SEUIL_RATIO = 0.20', RENT_SEUIL_RATIO, 0.20);
test('RENT_SEUIL_HEURES_MIN = 0.5', RENT_SEUIL_HEURES_MIN, 0.5);

console.log('\n── Détection par mission');
test('missions flaguées = gap, gap0, edge19, enc (et rien d\'autre)', ids, ['edge19', 'enc', 'gap', 'gap0']);
test('mission correctement loggée non flaguée', ids.includes('ok'), false);
test('aucun prévu + 3 h non flaguée', ids.includes('ok0'), false);
test('en attente (hors CA) non flaguée', ids.includes('att'), false);
test('exactement 20 % du prévu non flaguée (seuil strict)', ids.includes('edge20'), false);
test('encaissement annulé seul → hors CA → non flaguée', ids.includes('ann'), false);
test('gestion interne exclue', ids.includes('mgmt'), false);
test('hors fenêtre 12 mois exclue', ids.includes('old'), false);

console.log('\n── Payload utile pour l\'UI (lien vers les missions)');
const gap = getMissionsRentabiliteTempsManquant(DATA).find(f => f.id === 'gap');
test('payload expose id/client/ca/loggedH/prevuH', Object.keys(gap).sort(), ['ca', 'client', 'description', 'id', 'loggedH', 'prevuH']);

console.log('\n── Booléen d\'état du pilier');
test('rentabiliteDonneesInsuffisantes = true quand au moins 1 manque', rentabiliteDonneesInsuffisantes(DATA), true);
test('rentabiliteDonneesInsuffisantes = false si tout est fiable', rentabiliteDonneesInsuffisantes({ params: {}, missions: [missions[0], missions[3]] }), false);
test('rentabiliteDonneesInsuffisantes = false sans mission', rentabiliteDonneesInsuffisantes({ params: {}, missions: [] }), false);

console.log(`\n${failed === 0 ? '✅ TOUS VERTS' : '❌ ' + failed + ' ÉCHEC(S)'} — ${passed}/${passed + failed}`);
process.exit(failed === 0 ? 0 : 1);
