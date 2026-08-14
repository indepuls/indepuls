// ── TESTS : exclusion du temps réel sous-déclaré (pilier Rentabilité) ────────────
// Bug de confiance bêta (Charlène/Orianne, 2026-08-14) : une mission facturée comptée dans le CA
// mais sans temps réel saisi gonfle le TH/TJM réel. Retour Faustine (2026-08-14) : plutôt que de
// neutraliser tout le pilier, on EXCLUT ces missions du taux horaire (numérateur ET dénominateur)
// et on garde le pilier calculé sur les missions réellement suivies. getMissionsRentabiliteTempsManquant()
// retourne, par mission exclue, son CA et ses heures DANS la fenêtre 12 mois (pour retrait exact).
// getCaMissionFenetre() doit rendre EXACTEMENT le même montant que getCaFromMissions par mission.

import { getMissionsRentabiliteTempsManquant, rentabiliteADesMissionsExclues, getCaMissionFenetre, getCaFromMissions, RENT_SEUIL_RATIO, RENT_SEUIL_HEURES_MIN } from '../core/calculs.js';

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
const mkKey = (offsetMois) => mkOf(offsetMois).slice(0, 7);
const dToday = mkOf(0);      // mois en cours, dans la fenêtre
const dVieux = mkOf(18);     // 18 mois en arrière, hors fenêtre (dateOuverture absente → fenêtre 12 mois)

// Missions couvrant chaque branche
const missions = [
  // Correctement loggée : 8 h sur 10 prévues (80 %) → fiable
  { id: 'ok', statut: 'fact', dateFact: dToday, montantDevis: 1000, tempsPrevu: 10, heuresSaisies: 8 },
  // Facturée, CA compté, 0 h loggée sur 10 prévues → exclue
  { id: 'gap', statut: 'fact', dateFact: dToday, montantDevis: 2000, tempsPrevu: 10, heuresSaisies: 0 },
  // Aucun prévu, 0,2 h loggée (< 0,5) → exclue
  { id: 'gap0', statut: 'fact', dateFact: dToday, montantDevis: 500, heuresSaisies: 0.2 },
  // Aucun prévu, 3 h loggées (≥ 0,5, rien à comparer) → fiable
  { id: 'ok0', statut: 'fact', dateFact: dToday, montantDevis: 500, heuresSaisies: 3 },
  // En attente (non signée), 0 h, ne compte pas dans le CA → jamais exclue
  { id: 'att', statut: 'att', montantDevis: 5000, tempsPrevu: 20, heuresSaisies: 0 },
  // Exactement 20 % du prévu (2 h / 10) → on fait confiance (seuil STRICT en dessous)
  { id: 'edge20', statut: 'fact', dateFact: dToday, montantDevis: 1000, tempsPrevu: 10, heuresSaisies: 2 },
  // Juste sous 20 % (1,9 h / 10) → exclue
  { id: 'edge19', statut: 'fact', dateFact: dToday, montantDevis: 1000, tempsPrevu: 10, heuresSaisies: 1.9 },
  // CA via encaissement (pas dateFact), 1 h / 40 prévues → exclue
  { id: 'enc', statut: 'cours', tempsPrevu: 40, heuresSaisies: 1, encaissements: [{ id: 'e1', date: dToday, montant: 1000 }] },
  // Encaissement ANNULÉ uniquement → ne compte pas dans le CA → jamais exclue malgré 0 h
  { id: 'ann', statut: 'cours', tempsPrevu: 40, heuresSaisies: 0, encaissements: [{ id: 'e2', date: dToday, montant: 1000, statutLivre: 'annulee' }] },
  // Gestion interne → toujours exclue du scope (jamais dans la liste)
  { id: 'mgmt', isManagement: true, statut: 'fact', dateFact: dToday, montantDevis: 1000, tempsPrevu: 10, heuresSaisies: 0 },
  // Facturée hors fenêtre (18 mois) → jamais exclue
  { id: 'old', statut: 'fact', dateFact: dVieux, montantDevis: 1000, tempsPrevu: 10, heuresSaisies: 0 },
];

const DATA = { params: {}, missions };
const flagged = getMissionsRentabiliteTempsManquant(DATA);
const ids = flagged.map(f => f.id).sort();

console.log('── Seuils exposés');
test('RENT_SEUIL_RATIO = 0.20', RENT_SEUIL_RATIO, 0.20);
test('RENT_SEUIL_HEURES_MIN = 0.5', RENT_SEUIL_HEURES_MIN, 0.5);

console.log('\n── Missions exclues');
test('exclues = gap, gap0, edge19, enc (et rien d\'autre)', ids, ['edge19', 'enc', 'gap', 'gap0']);
test('mission correctement loggée non exclue', ids.includes('ok'), false);
test('aucun prévu + 3 h non exclue', ids.includes('ok0'), false);
test('en attente (hors CA) non exclue', ids.includes('att'), false);
test('exactement 20 % du prévu non exclue (seuil strict)', ids.includes('edge20'), false);
test('encaissement annulé seul → hors CA → non exclue', ids.includes('ann'), false);
test('gestion interne exclue du scope', ids.includes('mgmt'), false);
test('hors fenêtre 12 mois non exclue', ids.includes('old'), false);

console.log('\n── Payload utile pour l\'UI + retrait exact');
const gap = flagged.find(f => f.id === 'gap');
test('payload expose ca/client/description/heuresFenetre/id/loggedH/prevuH', Object.keys(gap).sort(), ['ca', 'client', 'description', 'heuresFenetre', 'id', 'loggedH', 'prevuH']);
test('gap.ca = 2000 (montantDevis, facturé dans la fenêtre)', gap.ca, 2000);
test('gap.heuresFenetre = 0 (aucune heure)', flagged.find(f => f.id === 'gap').heuresFenetre, 0);
test('gap0.heuresFenetre = 0,2 (ponctuelle → heures totales)', flagged.find(f => f.id === 'gap0').heuresFenetre, 0.2);
test('enc.ca = 1000 (encaissement dans la fenêtre)', flagged.find(f => f.id === 'enc').ca, 1000);

console.log('\n── getCaMissionFenetre = même montant que getCaFromMissions (par mission)');
// Pour une ponctuelle facturée dans la fenêtre, sa contribution isolée doit égaler getCaFromMissions
// du mois où son CA est reconnu (aucune autre mission ce mois-là dans un DATA à mission unique).
const mk0 = mkKey(0);
{
  const only = { params: {}, missions: [missions[1]] }; // 'gap' seule, facturée dToday
  test('getCaMissionFenetre(gap) == getCaFromMissions(mois de gap)', getCaMissionFenetre(only, missions[1], new Set([mk0])), getCaFromMissions(only, mk0));
}
// Récurrente : montantMensuel × mois actifs présents dans la fenêtre.
{
  const rec = { id: 'rec', isRecurring: true, dateDebutRec: mkKey(2), montantMensuel: 300, nbMoisRec: 12, statut: 'cours' };
  const set = new Set([mkKey(2), mkKey(1), mkKey(0)]); // 3 mois actifs
  test('récurrente : 300 × 3 mois actifs = 900', getCaMissionFenetre({ params: {}, missions: [rec] }, rec, set), 900);
  const recAtt = { ...rec, statut: 'att' };
  test('récurrente en attente → 0 (comme getCaFromMissions)', getCaMissionFenetre({ params: {}, missions: [recAtt] }, recAtt, set), 0);
}

console.log('\n── Booléen "a des missions exclues"');
test('rentabiliteADesMissionsExclues = true quand ≥ 1 exclue', rentabiliteADesMissionsExclues(DATA), true);
test('rentabiliteADesMissionsExclues = false si tout est fiable', rentabiliteADesMissionsExclues({ params: {}, missions: [missions[0], missions[3]] }), false);
test('rentabiliteADesMissionsExclues = false sans mission', rentabiliteADesMissionsExclues({ params: {}, missions: [] }), false);

console.log(`\n${failed === 0 ? '✅ TOUS VERTS' : '❌ ' + failed + ' ÉCHEC(S)'} — ${passed}/${passed + failed}`);
process.exit(failed === 0 ? 0 : 1);
