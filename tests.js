// tests.js — Tests unitaires Indépuls Freelance
// Usage : node tests.js
// Aucune dépendance externe. Tout le code métier est extrait du fichier HTML.

'use strict';
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const { pathToFileURL } = require('url');

// ── Extraction du bloc JS principal ──────────────────────────
const html = fs.readFileSync(path.join(__dirname, 'indepuls_freelance.html'), 'utf8');
const firstScript = html.match(/<script>([\s\S]*?)<\/script>/);
if (!firstScript) { console.error('Bloc <script> introuvable'); process.exit(1); }

// Rend DATA contrôlable depuis les tests (let → global)
let src = firstScript[1]
  .replace('let DATA = getDefaultData();', 'DATA = getDefaultData();');

// ── Stubs browser ─────────────────────────────────────────────
const ctx = vm.createContext({
  // Globaux Node.js indispensables
  console,
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  JSON,
  parseInt,
  parseFloat,
  isNaN,
  Infinity,
  setTimeout: () => {},
  clearTimeout: () => {},
  setInterval: () => {},
  clearInterval: () => {},

  // DATA est le seul global métier — injecté via ctx
  DATA: undefined,

  // Browser stubs
  localStorage: { _d: {}, setItem(k, v) { this._d[k] = v; }, getItem(k) { return this._d[k] ?? null; } },
  document: {
    addEventListener: () => {},
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ classList: { add: () => {}, remove: () => {} }, style: {} }),
    body: { setAttribute: () => {}, getAttribute: () => null, style: {} },
  },
  window: { addEventListener: () => {}, trackEvent: () => {} },
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  URL: { createObjectURL: () => '' },
  Blob: function () {},
  confirm: () => true,
});

vm.runInContext(src, ctx);

(async () => {
// ── Pont core : indepuls_freelance.html délègue désormais ces
// fonctions à core/calculs.js via modes/freelance.js (même mécanisme que
// le <script type="module"> ajouté en fin de fichier HTML). On reproduit
// ici ce branchement pour le contexte vm, puisque vm.runInContext ne sait
// pas exécuter de <script type="module">.
const Mode = await import(pathToFileURL(path.join(__dirname, 'shared', 'modes', 'freelance.js')).href);
function sync() { Mode.setData(ctx.DATA); }
ctx.getCaFromMissions      = (mk) => { sync(); return Mode.getCaFromMissions(mk); };
ctx.getDepensesMois        = (mk) => { sync(); return Mode.getDepensesMois(mk); };
ctx.getRevenuNetMois       = (mk) => { sync(); return Mode.getRevenuNetMois(mk); };
ctx.getTauxHoraireMinCible = ()   => { sync(); return Mode.getTauxHoraireMinCible(); };
ctx.getTVACollecteeMois    = (mk) => { sync(); return Mode.getTVACollecteeMois(mk); };
ctx.getCaBreakdownMois     = (mk) => { sync(); return Mode.getCaBreakdownMois(mk); };
ctx.isSASU                 = ()   => { sync(); return Mode.isSASU(); };
ctx.getImpotsTaux          = ()   => { sync(); return Mode.getImpotsTaux(); };
ctx.getTauxCharges         = ()   => { sync(); return Mode.getTauxCharges(); };
ctx.getCurrentYearMonths   = ()   => { sync(); return Mode.getCurrentYearMonths(); };
ctx.isMonthBeforeOpening   = (mk) => { sync(); return Mode.isMonthBeforeOpening(mk); };
ctx.getActiveMonthsInYear  = ()   => { sync(); return Mode.getActiveMonthsInYear(); };
ctx.getMoisDepuisOuverture = ()   => { sync(); return Mode.getMoisDepuisOuverture(); };
ctx.getCaAnnuelBrut        = ()   => { sync(); return Mode.getCaAnnuelBrut(); };
ctx.getPonctuelsCA         = (mk) => { sync(); return Mode.getPonctuelsCA(mk); };
ctx.getPonctuelsPresta     = (mk) => { sync(); return Mode.getPonctuelsPresta(mk); };
ctx.getPonctuelsVente      = (mk) => { sync(); return Mode.getPonctuelsVente(mk); };
ctx.getPonctuelsTresorerie = (mk) => { sync(); return Mode.getPonctuelsTresorerie(mk); };
ctx.getMissionVenteRatio   = (m)  => { sync(); return Mode.getMissionVenteRatio(m); };
ctx.getTauxChargesVente    = ()   => { sync(); return Mode.getTauxChargesVente(); };
ctx.getTauxChargesPresta   = ()   => { sync(); return Mode.getTauxChargesPresta(); };
ctx.isActiviteMixte        = ()   => { sync(); return Mode.isActiviteMixte(); };
ctx.getCaNetAnnuel         = ()   => { sync(); return Mode.getCaNetAnnuel(); };
ctx.getHeuresFact          = ()   => { sync(); return Mode.getHeuresFact(); };
ctx.getHeuresInterne       = ()   => { sync(); return Mode.getHeuresInterne(); };
ctx.getMissionTotalMs      = (m)  => { sync(); return Mode.getMissionTotalMs(m); };
ctx.getResteAEncaisser     = (m)  => { sync(); return Mode.getResteAEncaisser(m); };
ctx.getMoisActifsAnnee     = ()   => { sync(); return Mode.getMoisActifsAnnee(); };
ctx.getMissionHeures       = (m)  => { sync(); return Mode.getMissionHeures(m); };
ctx.getSasuCoutRemuMensuel = ()   => { sync(); return Mode.getSasuCoutRemuMensuel(); };
ctx.getSasuProjectionFinAnnee = () => { sync(); return Mode.getSasuProjectionFinAnnee(); };
ctx.getSasuSoldeActuelEstime  = () => { sync(); return Mode.getSasuSoldeActuelEstime(); };
ctx.getTVACollecteeAnnuelle   = () => { sync(); return Mode.getTVACollecteeAnnuelle(); };
ctx.getTVADeductibleAnnuelle  = () => { sync(); return Mode.getTVADeductibleAnnuelle(); };
ctx.getTVADeductibleMois      = (mk) => { sync(); return Mode.getTVADeductibleMois(mk); };
ctx.getTVAProvisionMensuelle  = () => { sync(); return Mode.getTVAProvisionMensuelle(); };
ctx.getTVASeuilsStatut        = () => { sync(); return Mode.getTVASeuilsStatut(); };
ctx.getTVAZone                = Mode.getTVAZone;
ctx.tvaZoneFill                = Mode.tvaZoneFill;
ctx.tvaZoneKpi                 = Mode.tvaZoneKpi;
ctx.getTotalEncaisse          = (m) => { sync(); return Mode.getTotalEncaisse(m); };
ctx.getTresorerieDepart       = () => { sync(); return Mode.getTresorerieDepart(); };
ctx.getTvaRegime              = () => { sync(); return Mode.getTvaRegime(); };
ctx.getUrssafAnnuelBrut       = () => { sync(); return Mode.getUrssafAnnuelBrut(); };
ctx.getUrssafProvisionMensuelle = () => { sync(); return Mode.getUrssafProvisionMensuelle(); };
ctx.getUrssafRegime           = () => { sync(); return Mode.getUrssafRegime(); };

// ── Pont : expose les fonctions métier dans le scope test ─────
const {
  getTauxStatut,
  getMissionTotalMs,
  getMissionHeures,
  getMissionVenteRatio,
  getTotalEncaisse,
  getResteAEncaisser,
  getCaFromMissions,
  getCaPrestaMois,
  getCaVenteMissions,
  getPonctuelsCA,
  getPonctuelsPresta,
  getPonctuelsVente,
  getPonctuelsTresorerie,
  getDepensesMois,
  getDepensesMoyenneMensuelle,
  getActiveMonthsInYear,
  getTauxCharges,
  getTauxChargesPresta,
  getTauxChargesVente,
  getImpotsTaux,
  isSASU,
  isActiviteMixte,
  getRevenuNetMois,
  getTVACollecteeMois,
  getTVADeductibleMois,
  getSasuCoutRemuMensuel,
} = ctx;

// Setter : réinitialise DATA dans le contexte vm ET le proxy local
function setData(d) { ctx.DATA = d; }

// ── Runner ────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(label, actual, expected) {
  const ok = Object.is(actual, expected) ||
    (typeof actual === 'number' && typeof expected === 'number' && Math.abs(actual - expected) < 0.0001);
  if (ok) {
    passed++;
    console.log(`  ✓  ${label}`);
  } else {
    failed++;
    console.error(`  ✗  ${label}\n     attendu : ${expected}\n     obtenu  : ${actual}`);
  }
}
function group(title) { console.log(`\n── ${title}`); }

// ── Données de base réutilisables ─────────────────────────────
function baseParams(overrides = {}) {
  return {
    statut: 'micro-bnc',
    tauxURSSAF: 25.6,
    tauxCFP: 0.2,
    tauxCotisationsPrestation: 25.6,
    tauxCFPPrestation: 0.2,
    tauxCotisationsVente: 12.3,
    tauxCFPVente: 0.1,
    impotsTaux: 0,
    chargesSalariales: 0,
    activiteMixte: false,
    tva: false,
    tauxTVA: 20,
    dateOuverture: '',
    heuresParJour: 7,
    joursParSemaine: 4,
    semainesParAn: 44,
    objectifNetMensuel: 4000,
    chargesAnnuellesCompl: 0,
    remunerationNette: 0,
    coutRemunerationPct: 80,
    tresorerieParAnnee: {},
    ...overrides,
  };
}
function baseMission(overrides = {}) {
  return {
    id: 'test-1',
    client: 'Test',
    categorie: 'Test',
    description: '',
    statut: 'fact',
    isManagement: false,
    isRecurring: false,
    montantDevis: 0,
    montantPrestation: 0,
    montantVente: 0,
    dateFact: null,
    heuresSaisies: 0,
    timerAccumulated: 0,
    timerRunning: false,
    timerStart: null,
    tempsManuel: [],
    encaissements: [],
    typeMission: 'individuelle',
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// 1. getTauxStatut — source unique des taux
// ══════════════════════════════════════════════════════════════
group('getTauxStatut');
assert('micro-bnc  urssafPresta', getTauxStatut('micro-bnc').urssafPresta, 25.6);
assert('micro-bnc  cfpPresta',    getTauxStatut('micro-bnc').cfpPresta,    0.2);
assert('micro-bic  urssafPresta', getTauxStatut('micro-bic').urssafPresta, 21.2);
assert('micro-achat urssafVente', getTauxStatut('micro-achat').urssafVente, 12.3);
assert('sasu fallback → micro-bnc', getTauxStatut('sasu').urssafPresta,   25.6);
assert('inconnu fallback → micro-bnc', getTauxStatut('unknown').cfpPresta, 0.2);

// ══════════════════════════════════════════════════════════════
// 2. getMissionHeures — chronos + saisie manuelle
// ══════════════════════════════════════════════════════════════
group('getMissionHeures');
const mH1 = baseMission({ heuresSaisies: 5 });
assert('heures saisies seulement',             getMissionHeures(mH1), 5);

const mH2 = baseMission({ heuresSaisies: 3, timerAccumulated: 2 * 3600000 });
assert('saisies + chrono accumulé',            getMissionHeures(mH2), 5);

const mH3 = baseMission({
  heuresSaisies: 2,
  tempsManuel: [{ id: 'a', ms: 3600000 }, { id: 'b', ms: 1800000 }],
});
assert('saisies + temps manuel (1h + 0.5h)',   getMissionHeures(mH3), 3.5);

const mH4 = baseMission({
  typeMission: 'collectif',
  tempsCreation: 4, tempsAnimation: 6, tempsSupport: 2,
});
assert('collectif : somme des temps déclarés', getMissionHeures(mH4), 12);

// ══════════════════════════════════════════════════════════════
// 3. Encaissements — total & reste
// ══════════════════════════════════════════════════════════════
group('getTotalEncaisse / getResteAEncaisser');
const mEnc1 = baseMission({ montantDevis: 1000, encaissements: [{ montant: 400 }, { montant: 300 }] });
assert('totalEncaissé partiel',   getTotalEncaisse(mEnc1),    700);
assert('reste à encaisser',       getResteAEncaisser(mEnc1),  300);

const mEnc2 = baseMission({ montantDevis: 500, encaissements: [{ montant: 500 }] });
assert('totalEncaissé complet',   getTotalEncaisse(mEnc2),    500);
assert('reste = 0 quand soldé',   getResteAEncaisser(mEnc2),  0);

const mEnc3 = baseMission({ montantDevis: 100, encaissements: [{ montant: 200 }] });
assert('reste jamais négatif',    getResteAEncaisser(mEnc3),  0);

// ══════════════════════════════════════════════════════════════
// 4. getCaFromMissions — mission ponctuelle (sans encaissement)
// ══════════════════════════════════════════════════════════════
group('getCaFromMissions — ponctuelle sans encaissement');
setData({ currentYear: 2026, params: baseParams(), missions: [
  baseMission({ statut: 'fact', dateFact: '2026-03-15', montantDevis: 1000 }),
], depenses: [], revenus: {} });

assert('CA mars (mois facturé)',  getCaFromMissions('2026-03'), 1000);
assert('CA avril (hors période)', getCaFromMissions('2026-04'), 0);
assert('CA autre statut (cours)', (() => {
  setData({ ...ctx.DATA, missions: [baseMission({ statut: 'cours', dateFact: null, montantDevis: 1000 })] });
  return getCaFromMissions('2026-03');
})(), 0);

// ══════════════════════════════════════════════════════════════
// 5. getCaFromMissions — avec encaissements partiels
// ══════════════════════════════════════════════════════════════
group('getCaFromMissions — encaissements partiels');
setData({ currentYear: 2026, params: baseParams(), missions: [
  baseMission({
    statut: 'fact', dateFact: '2026-01-01', montantDevis: 1000,
    encaissements: [
      { id: 'e1', montant: 400, date: '2026-01-15' },
      { id: 'e2', montant: 600, date: '2026-02-20' },
    ],
  }),
], depenses: [], revenus: {} });

assert('premier versement (janv)',  getCaFromMissions('2026-01'), 400);
assert('deuxième versement (fév)',  getCaFromMissions('2026-02'), 600);
assert('rien en mars',              getCaFromMissions('2026-03'), 0);

// ══════════════════════════════════════════════════════════════
// 6. getCaFromMissions — mission récurrente
// ══════════════════════════════════════════════════════════════
group('getCaFromMissions — récurrente');
setData({ currentYear: 2026, params: baseParams(), missions: [
  baseMission({
    isRecurring: true, statut: 'cours',
    dateDebutRec: '2026-02', montantMensuel: 500, nbMoisRec: 3,
  }),
], depenses: [], revenus: {} });

assert('avant démarrage (janv)',    getCaFromMissions('2026-01'), 0);
assert('1er mois (fév)',            getCaFromMissions('2026-02'), 500);
assert('2e mois (mars)',            getCaFromMissions('2026-03'), 500);
assert('3e mois = dernier (avril)', getCaFromMissions('2026-04'), 500);
assert('après fin (mai)',           getCaFromMissions('2026-05'), 0);

// ══════════════════════════════════════════════════════════════
// 7. getDepensesMois — par type de récurrence
// ══════════════════════════════════════════════════════════════
group('getDepensesMois — ponctuelle');
setData({ currentYear: 2026, params: baseParams(), missions: [], depenses: [
  { id: 'd1', date: '2026-03-10', recurrence: 'ponctuelle', montant: 200 },
], revenus: {} });

assert('ponctuelle dans son mois',     getDepensesMois('2026-03'), 200);
assert('ponctuelle hors de son mois',  getDepensesMois('2026-04'), 0);

group('getDepensesMois — mensuelle');
setData({ currentYear: 2026, params: baseParams(), missions: [], depenses: [
  { id: 'd2', date: '2026-02-01', recurrence: 'mensuelle', montant: 100 },
], revenus: {} });

assert('mensuelle dans le mois de début',   getDepensesMois('2026-02'), 100);
assert('mensuelle dans un mois suivant',    getDepensesMois('2026-06'), 100);
assert('mensuelle avant le mois de début',  getDepensesMois('2026-01'), 0);

group('getDepensesMois — annuelle');
setData({ currentYear: 2026, params: baseParams(), missions: [], depenses: [
  { id: 'd3', date: '2026-05-20', recurrence: 'annuelle', montant: 1200 },
], revenus: {} });

assert('annuelle dans son mois-anniversaire', getDepensesMois('2026-05'), 1200);
assert('annuelle hors mois-anniversaire',     getDepensesMois('2026-06'), 0);

// ══════════════════════════════════════════════════════════════
// 8. getDepensesMoyenneMensuelle
// ══════════════════════════════════════════════════════════════
group('getDepensesMoyenneMensuelle');
// 12 mois actifs (2025, passé complet)
setData({ currentYear: 2025, params: baseParams({ dateOuverture: '' }), missions: [], depenses: [
  { id: 'm1', date: '2025-01-01', recurrence: 'mensuelle',  montant: 100 },  // 100/mois
  { id: 'a1', date: '2025-06-01', recurrence: 'annuelle',   montant: 1200 }, // 1200/12 = 100/mois
  { id: 'p1', date: '2025-03-15', recurrence: 'ponctuelle', montant: 500 },  // exclue
], revenus: {} });
assert('moyenne = mensuelle + annuelle lissée (ponctuelle exclue)',
  getDepensesMoyenneMensuelle(), 200);

// ══════════════════════════════════════════════════════════════
// 9. Taux de cotisations
// ══════════════════════════════════════════════════════════════
group('getTauxCharges / getTauxChargesPresta / getTauxChargesVente');
setData({ currentYear: 2026, params: baseParams(), missions: [], depenses: [], revenus: {} });

assert('getTauxCharges micro-bnc (25.6+0.2)/100',        getTauxCharges(),       0.258);
assert('getTauxChargesPresta hors mixte = getTauxCharges', getTauxChargesPresta(), 0.258);
assert('getTauxChargesVente hors mixte = prestation',      getTauxChargesVente(),  0.258);

// En activité mixte
setData({ currentYear: 2026, params: baseParams({
  activiteMixte: true,
  tauxCotisationsPrestation: 25.6, tauxCFPPrestation: 0.2,
  tauxCotisationsVente: 12.3,      tauxCFPVente: 0.1,
}), missions: [], depenses: [], revenus: {} });

assert('mixte : getTauxChargesPresta = 25.8%',  getTauxChargesPresta(), 0.258);
assert('mixte : getTauxChargesVente  = 12.4%',  getTauxChargesVente(),  0.124);

// SASU : cotisations = 0
setData({ currentYear: 2026, params: baseParams({ statut: 'sasu' }), missions: [], depenses: [], revenus: {} });
assert('SASU : getTauxCharges = 0',      getTauxCharges(),       0);
assert('SASU : getTauxChargesPresta = 0', getTauxChargesPresta(), 0);

// ══════════════════════════════════════════════════════════════
// 10. getRevenuNetMois — scénario principal micro-bnc
// ══════════════════════════════════════════════════════════════
group('getRevenuNetMois — micro-bnc sans TVA');
// CA = 1000 €, charges = 258 €, dépenses = 100 €, impôts = 0
// net = 1000 − 258 − 100 = 642
setData({ currentYear: 2026, params: baseParams(), missions: [
  baseMission({ statut: 'fact', dateFact: '2026-03-01', montantDevis: 1000 }),
], depenses: [
  { id: 'd1', date: '2026-01-01', recurrence: 'mensuelle', montant: 100 },
], revenus: {} });

assert('micro-bnc : 1000 CA − 258 charges − 100 dépenses = 642',
  getRevenuNetMois('2026-03'), 642);

group('getRevenuNetMois — avec impôts');
// same + impotsTaux = 11 % → −110 €  → net = 532
setData({ currentYear: 2026, params: baseParams({ impotsTaux: 11 }), missions: [
  baseMission({ statut: 'fact', dateFact: '2026-03-01', montantDevis: 1000 }),
], depenses: [
  { id: 'd1', date: '2026-01-01', recurrence: 'mensuelle', montant: 100 },
], revenus: {} });

assert('avec impôts 11 % : 1000 − 258 − 110 − 100 = 532',
  getRevenuNetMois('2026-03'), 532);

group('getRevenuNetMois — activité mixte');
// 700 presta + 300 vente = 1000 CA
// charges = 700*25.8% + 300*12.4% = 180.6 + 37.2 = 217.8
// net = 1000 − 217.8 = 782.2
setData({ currentYear: 2026, params: baseParams({
  activiteMixte: true,
  tauxCotisationsPrestation: 25.6, tauxCFPPrestation: 0.2,
  tauxCotisationsVente: 12.3,      tauxCFPVente: 0.1,
}), missions: [
  baseMission({
    statut: 'fact', dateFact: '2026-03-01',
    montantDevis: 1000, montantPrestation: 700, montantVente: 300,
  }),
], depenses: [], revenus: {} });

assert('mixte : 700 presta + 300 vente − cotisations = 782.2',
  Math.round(getRevenuNetMois('2026-03') * 10) / 10, 782.2);

group('getRevenuNetMois — ponctuel hors-CA (flux neutre)');
// Mission : 0 €, ponctuel hors_ca : 500 € → pas de cotisations sur hors_ca
setData({ currentYear: 2026, params: baseParams(), missions: [], depenses: [], revenus: {
  '2026-04': { autresList: [{ id: 'p1', type: 'hors_ca', montant: 500, montantPrestation: 0, montantVente: 0 }] },
} });
assert('hors_ca : aucune cotisation appliquée, net = 500',
  getRevenuNetMois('2026-04'), 500);

// ══════════════════════════════════════════════════════════════
// 11. TVA collectée
// ══════════════════════════════════════════════════════════════
group('getTVACollecteeMois');
setData({ currentYear: 2026, params: baseParams({ tva: true, tauxTVA: 20 }), missions: [
  baseMission({ statut: 'fact', dateFact: '2026-05-01', montantDevis: 1000 }),
], depenses: [], revenus: {} });

assert('TVA 20% sur 1000 = 200',        getTVACollecteeMois('2026-05'), 200);
assert('TVA = 0 si franchise',          (() => {
  setData({ ...ctx.DATA, params: { ...ctx.DATA.params, tva: false } });
  return getTVACollecteeMois('2026-05');
})(), 0);

// ══════════════════════════════════════════════════════════════
// 12. getPonctuelsCA / getPonctuelsTresorerie
// ══════════════════════════════════════════════════════════════
group('Revenus ponctuels');
setData({ currentYear: 2026, params: baseParams(), missions: [], depenses: [], revenus: {
  '2026-06': { autresList: [
    { id: 'a', type: 'prestation', montant: 300, montantPrestation: 300, montantVente: 0 },
    { id: 'b', type: 'vente',      montant: 200, montantPrestation: 0,   montantVente: 200 },
    { id: 'c', type: 'hors_ca',   montant: 100, montantPrestation: 0,   montantVente: 0 },
  ]},
} });

assert('getPonctuelsCA = presta + vente (sans hors_ca)', getPonctuelsCA('2026-06'),         500);
assert('getPonctuelsPresta',                              getPonctuelsPresta('2026-06'),     300);
assert('getPonctuelsVente',                               getPonctuelsVente('2026-06'),      200);
assert('getPonctuelsTresorerie = hors_ca uniquement',     getPonctuelsTresorerie('2026-06'), 100);
assert('mois sans revenus ponctuels',                     getPonctuelsCA('2026-07'),         0);

// ══════════════════════════════════════════════════════════════
// 13. SASU — coût de rémunération
// ══════════════════════════════════════════════════════════════
group('getSasuCoutRemuMensuel');
setData({ currentYear: 2026, params: baseParams({
  statut: 'sasu', remunerationNette: 2000, coutRemunerationPct: 80,
}), missions: [], depenses: [], revenus: {} });

// coût = 2000 × (1 + 80/100) = 2000 × 1.8 = 3600
assert('SASU : net 2000 € + 80 % charges = 3600 €', getSasuCoutRemuMensuel(), 3600);

// ══════════════════════════════════════════════════════════════
// 14. Edge cases
// ══════════════════════════════════════════════════════════════
group('Edge cases');

// Mission avec statut att ou ref ne contribue pas au CA
setData({ currentYear: 2026, params: baseParams(), missions: [
  baseMission({ statut: 'att', dateFact: '2026-03-01', montantDevis: 500 }),
  baseMission({ id: 'test-2', statut: 'ref', dateFact: '2026-03-01', montantDevis: 800 }),
], depenses: [], revenus: {} });
assert('missions att/ref : CA = 0', getCaFromMissions('2026-03'), 0);

// Récurrente sans dateDebutRec ne contribue pas
setData({ currentYear: 2026, params: baseParams(), missions: [
  baseMission({ isRecurring: true, statut: 'cours', dateDebutRec: '', montantMensuel: 500 }),
], depenses: [], revenus: {} });
assert('récurrente sans dateDebutRec : CA = 0', getCaFromMissions('2026-03'), 0);

// getRevenuNetMois retourne 0 avant ouverture
setData({ currentYear: 2026, params: baseParams({ dateOuverture: '2026-06' }), missions: [
  baseMission({ statut: 'fact', dateFact: '2026-03-01', montantDevis: 1000 }),
], depenses: [], revenus: {} });
assert('mois avant ouverture : revenu net = 0', getRevenuNetMois('2026-03'), 0);

// ══════════════════════════════════════════════════════════════
// Résultat
// ══════════════════════════════════════════════════════════════
const total = passed + failed;
console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${passed}/${total} tests passés${failed > 0 ? ` — ${failed} ÉCHEC(S)` : ' ✓'}`);
console.log(`${'═'.repeat(50)}\n`);
process.exit(failed > 0 ? 1 : 0);
})().catch(err => { console.error('ERREUR TESTS :', err); process.exit(1); });
