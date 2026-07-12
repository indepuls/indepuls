// ── TESTS : TVA (ZONES, SEUILS, COLLECTE, DÉDUCTIBLE, PROVISION) ─
// Aucune de ces fonctions n'était couverte avant ce fichier — voir
// audit du 2026-07 (question de Faustine sur la couverture des suites).

import {
  getTVAZone,
  tvaZoneFill,
  tvaZoneKpi,
  getTVASeuilsStatut,
  getTVACollecteeMois,
  getTVADeductibleMois,
  getTVACollecteeAnnuelle,
  getTVADeductibleAnnuelle,
  getTvaRegime,
  getTVAProvisionMensuelle,
  getTvaAVenirFinAnnee,
} from '../core/calculs.js';

// ── Helpers ───────────────────────────────────────────────────

let passed = 0, failed = 0;

function test(label, actual, expected) {
  const ok = Math.abs(actual - expected) <= 1; // tolérance arrondi ±1 €
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${expected}, obtenu ${actual}`); failed++; }
}

function testEq(label, actual, expected) {
  const ok = actual === expected;
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`); failed++; }
}

function section(title) { console.log(`\n── ${title}`); }

function mkData(o = {}) {
  return {
    currentYear: o.currentYear || new Date().getFullYear(),
    params: {
      statut: 'micro-bnc', tva: false, tauxTVA: 20, tvaRegime: 'mensuel', tvaModeDeclaration: 'encaissements',
      seuilTVAPrestationBase: 37500, seuilTVAPrestationMajore: 41250,
      seuilTVAVenteBase: 85000, seuilTVAVenteMajore: 93500,
      activiteMixte: false, impotsTaux: 0, dateOuverture: '',
      ...(o.params || {}),
    },
    missions: o.missions || [],
    depenses: o.depenses || [],
    revenus: o.revenus || {},
  };
}

// ── 1. Zones de vigilance ──────────────────────────────────────

section('getTVAZone — 3 zones');
testEq('CA sous franchise → normal', getTVAZone(30000, 37500, 41250), 'normal');
testEq('CA entre franchise et tolérance → tolerance', getTVAZone(38000, 37500, 41250), 'tolerance');
testEq('CA au-delà de la tolérance → depasse', getTVAZone(42000, 37500, 41250), 'depasse');

section('tvaZoneFill / tvaZoneKpi — mapping visuel');
testEq('fill depasse = bd', tvaZoneFill('depasse'), 'bd');
testEq('fill tolerance = wn', tvaZoneFill('tolerance'), 'wn');
testEq('fill normal = ok', tvaZoneFill('normal'), 'ok');
testEq('kpi depasse = bad', tvaZoneKpi('depasse'), 'bad');
testEq('kpi tolerance = warn', tvaZoneKpi('tolerance'), 'warn');
testEq('kpi normal = neu', tvaZoneKpi('normal'), 'neu');

// ── 2. Seuils par statut ────────────────────────────────────────

section('getTVASeuilsStatut — prestation par défaut vs micro-achat');
const seuilsPresta = getTVASeuilsStatut(mkData());
testEq('prestation franchise = 37 500', seuilsPresta.franchise, 37500);
testEq('prestation tolérance = 41 250', seuilsPresta.tolerance, 41250);
const seuilsAchat = getTVASeuilsStatut(mkData({ params: { statut: 'micro-achat' } }));
testEq('micro-achat franchise = 85 000', seuilsAchat.franchise, 85000);
testEq('micro-achat tolérance = 93 500', seuilsAchat.tolerance, 93500);

// ── 3. Collecte mensuelle — encaissements vs débits ────────────

section('getTVACollecteeMois — encaissements vs débits divergent sur la même mission');
// Facturée en janvier (dateFact), mais réellement encaissée en mars seulement.
const missionDivergente = {
  isManagement: false, isRecurring: false, statut: 'fact',
  dateFact: '2026-01-10', montantDevis: 1000,
  encaissements: [{ date: '2026-03-05', montant: 1000 }],
};
const D_ENC = mkData({ params: { tva: true, tauxTVA: 20, tvaModeDeclaration: 'encaissements' }, missions: [missionDivergente] });
test('encaissements — mois de la facture (janv.) sans encaissement réel = 0', getTVACollecteeMois(D_ENC, '2026-01'), 0);
test('encaissements — mois de l\'encaissement réel (mars) = 200', getTVACollecteeMois(D_ENC, '2026-03'), 200);
const D_DEB = mkData({ params: { tva: true, tauxTVA: 20, tvaModeDeclaration: 'debits' }, missions: [missionDivergente] });
test('débits — mois de la facture (janv.) = 200 quel que soit l\'encaissement', getTVACollecteeMois(D_DEB, '2026-01'), 200);
test('débits — mois de l\'encaissement (mars), déjà comptée en janv. = 0', getTVACollecteeMois(D_DEB, '2026-03'), 0);
test('tva désactivée → 0 quel que soit le mode', getTVACollecteeMois(mkData({ params: { tva: false }, missions: [missionDivergente] }), '2026-03'), 0);

// ── 4. Déductible mensuel ───────────────────────────────────────

section('getTVADeductibleMois — dépenses mensuelles vs ponctuelles');
const depMensuelle = { date: '2026-01-05', dateDebut: 'always', recurrence: 'mensuelle', tvaDeductible: true, montantTVA: 20 };
const depPonctuelle = { date: '2026-03-10', recurrence: 'ponctuelle', tvaDeductible: true, montantTVA: 15 };
const depNonDeductible = { date: '2026-01-01', recurrence: 'mensuelle', tvaDeductible: false, montantTVA: 99 };
const D_DED = mkData({ params: { tva: true }, depenses: [depMensuelle, depPonctuelle, depNonDeductible] });
test('janvier — seule la dépense mensuelle déductible compte', getTVADeductibleMois(D_DED, '2026-01'), 20);
test('mars — mensuelle + ponctuelle', getTVADeductibleMois(D_DED, '2026-03'), 35);
test('tva désactivée → 0', getTVADeductibleMois(mkData({ params: { tva: false }, depenses: [depMensuelle] }), '2026-01'), 0);

// ── 5. Cumuls annuels ────────────────────────────────────────────

section('getTVACollecteeAnnuelle / getTVADeductibleAnnuelle — somme sur les 12 mois');
const missionRecurrenteAnnuelle = { isManagement: false, isRecurring: true, statut: 'cours', dateDebutRec: '2026-01', montantMensuel: 1000, nbMoisRec: null };
const D_ANNUEL = mkData({
  currentYear: 2026,
  params: { tva: true, tauxTVA: 20 },
  missions: [missionRecurrenteAnnuelle],
  depenses: [{ date: '2026-01-01', dateDebut: 'always', recurrence: 'mensuelle', tvaDeductible: true, montantTVA: 10 }],
});
test('collectée annuelle = 200€/mois × 12', getTVACollecteeAnnuelle(D_ANNUEL), 2400);
test('déductible annuelle = 10€/mois × 12', getTVADeductibleAnnuelle(D_ANNUEL), 120);

// ── 6. Régime TVA ─────────────────────────────────────────────────

section('getTvaRegime');
testEq('tva désactivée → franchise', getTvaRegime(mkData({ params: { tva: false } })), 'franchise');
testEq('tva activée sans régime précisé → mensuel (défaut)', getTvaRegime(mkData({ params: { tva: true, tvaRegime: undefined } })), 'mensuel');
testEq('tva activée, régime trimestriel', getTvaRegime(mkData({ params: { tva: true, tvaRegime: 'trimestriel' } })), 'trimestriel');

// ── 7. Provision mensuelle ────────────────────────────────────────

section('getTVAProvisionMensuelle');
testEq('franchise (tva désactivée) → 0 sans dépendre du CA', getTVAProvisionMensuelle(mkData({ params: { tva: false } })), 0);
{
  const mkNow = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const D_PROV_MENSUEL = mkData({
    params: { tva: true, tauxTVA: 20, tvaRegime: 'mensuel' },
    missions: [{ isManagement: false, isRecurring: false, statut: 'fact', dateFact: `${mkNow}-15`, montantDevis: 1000, encaissements: [] }],
  });
  test('régime mensuel — collecté du mois courant (sans déductible)', getTVAProvisionMensuelle(D_PROV_MENSUEL), 200);
}

// ── 8. TVA encore due d'ici la fin de l'année ─────────────────────

section('getTvaAVenirFinAnnee — 4 régimes');
testEq('franchise → 0', getTvaAVenirFinAnnee(mkData({ params: { tva: false } })), 0);

{
  // Régime mensuel : ne regarde que le mois calendaire précédent (indépendant de DATA.currentYear).
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1;
  const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
  const prevMk = `${py}-${String(pm).padStart(2, '0')}`;
  const D_MENSUEL = mkData({
    params: { tva: true, tauxTVA: 20, tvaRegime: 'mensuel' },
    missions: [{ isManagement: false, isRecurring: true, statut: 'cours', dateDebutRec: prevMk, montantMensuel: 1000, nbMoisRec: null }],
  });
  test('régime mensuel — TVA due = collecté du mois précédent', getTvaAVenirFinAnnee(D_MENSUEL), 200);
}

{
  // Régime trimestriel/simplifié : DATA.currentYear décalé d'un an dans le passé pour que
  // "tous les mois de l'année de DATA" soient garantis < mois courant réel, quel que soit
  // le jour d'exécution du test (évite un test qui dépend de la date du run).
  const anneePassee = new Date().getFullYear() - 1;
  const missionAnneeEntiere = { isManagement: false, isRecurring: true, statut: 'cours', dateDebutRec: `${anneePassee}-01`, montantMensuel: 1000, nbMoisRec: null };
  const D_TRIM = mkData({ currentYear: anneePassee, params: { tva: true, tauxTVA: 20, tvaRegime: 'trimestriel' }, missions: [missionAnneeEntiere] });
  test('régime trimestriel — moyenne mensuelle écoulée × 3', getTvaAVenirFinAnnee(D_TRIM), 600);

  const D_SIMPL = mkData({ currentYear: anneePassee, params: { tva: true, tauxTVA: 20, tvaRegime: 'simplifie' }, missions: [missionAnneeEntiere] });
  const mNow = new Date().getMonth() + 1;
  const attenduSimplifie = mNow < 7 ? Math.round(2400 * 0.95) : Math.round(2400 * 0.40);
  test('régime simplifié — acompte juillet (95%) ou décembre (40%) selon le mois réel', getTvaAVenirFinAnnee(D_SIMPL), attenduSimplifie);
}

// ── Résumé ────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
