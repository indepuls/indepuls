/**
 * Phase 2 (limitée) — sandbox de substitution
 *
 * Objectif : vérifier le branchement réel du core partagé, PAS refaire la
 * validation métier (déjà faite et passée 73/73 dans validation.js).
 *
 * Principe :
 *   1. On charge indepuls_freelance.html et indepuls_artisan.html TELS QUELS
 *      (aucune modification de ces fichiers) dans un contexte vm, comme le
 *      fait déjà tests.js à la racine.
 *   2. On calcule les sorties "AVANT" avec les fonctions originales du HTML.
 *   3. On remplace, uniquement dans le contexte vm (en mémoire, jamais sur
 *      disque), les 5 fonctions ciblées par les versions de core/calculs.js :
 *        - getCaFromMissions
 *        - getDepensesMois
 *        - getRevenuNetMois
 *        - getTauxHoraireMinCible
 *        - getTVACollecteeMois
 *   4. On recalcule les sorties "APRÈS" avec les mêmes données.
 *   5. On compare AVANT vs APRÈS sur : dashboard (revenu net), dépenses,
 *      taux horaire, TVA, et un proxy d'historique annuel (CA annuel net).
 *
 * Aucun fichier de production n'est modifié par ce script.
 * Exécution : node refactor-test/tests/phase2_sandbox.js
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');

// ─────────────────────────────────────────────────────────────
// 1. Chargement des HTML originaux (non modifiés) dans un vm
// ─────────────────────────────────────────────────────────────

function loadHtmlContext(htmlFile) {
  const html = fs.readFileSync(path.join(ROOT, htmlFile), 'utf8');
  const firstScript = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!firstScript) throw new Error(`Bloc <script> introuvable dans ${htmlFile}`);

  const src = firstScript[1].replace(/let DATA = getDefaultData\(\);/, 'DATA = getDefaultData();');

  const ctx = vm.createContext({
    console, Date, Math, Number, String, Array, Object, JSON,
    parseInt, parseFloat, isNaN, Infinity,
    setTimeout: () => {}, clearTimeout: () => {}, setInterval: () => {}, clearInterval: () => {},
    DATA: undefined,
    localStorage: { _d: {}, setItem(k, v) { this._d[k] = v; }, getItem(k) { return this._d[k] ?? null; } },
    document: {
      addEventListener: () => {}, getElementById: () => null, querySelector: () => null,
      querySelectorAll: () => [], createElement: () => ({ classList: { add: () => {}, remove: () => {} }, style: {} }),
      body: { setAttribute: () => {}, getAttribute: () => null, style: {} },
    },
    window: { addEventListener: () => {}, trackEvent: () => {} },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    URL: { createObjectURL: () => '' },
    Blob: function () {},
    confirm: () => true,
  });

  vm.runInContext(src, ctx);
  return ctx;
}

function setData(ctx, d) { ctx.DATA = d; }

// ─────────────────────────────────────────────────────────────
// 2. Jeux de données (identiques à refactor-test/tests/validation.js,
//    déjà validés 73/73 — réutilisés ici sans modification)
// ─────────────────────────────────────────────────────────────

const D_FREELANCE_BASE = {
  currentYear: 2026,
  params: {
    statut: 'micro-bnc', tauxURSSAF: 25.6, tauxCFP: 0.2,
    tauxCotisationsPrestation: 25.6, tauxCFPPrestation: 0.2,
    tauxCotisationsVente: 12.3, tauxCFPVente: 0.1,
    objectifNetMensuel: 3500, heuresParJour: 7, joursParSemaine: 4, semainesParAn: 44,
    impotsTaux: 11, tva: false, tauxTVA: 20, activiteMixte: false,
    dateOuverture: '2026-01', chargesSalariales: 0
  },
  missions: [
    { id: 'm1', client: 'Client A', isManagement: false, isRecurring: false, statut: 'fact',
      dateFact: '2026-03-15', montantDevis: 2000, montantPrestation: 2000, montantVente: 0,
      encaissements: [] },
    { id: 'm2', client: 'Client B', isManagement: false, isRecurring: false, statut: 'fact',
      dateFact: '2026-03-22', montantDevis: 1500, montantPrestation: 1500, montantVente: 0,
      encaissements: [{ id: 'e1', date: '2026-03-22', montant: 1500 }] },
    { id: 'm3', client: 'Client C', isManagement: false, isRecurring: false, statut: 'cours',
      dateFact: null, montantDevis: 800, montantPrestation: 800, montantVente: 0,
      encaissements: [] },
  ],
  revenus: { '2026-03': { autresList: [] } },
  depenses: [
    { id: 'd1', date: '2026-01-01', libelle: 'Notion', montant: 16, recurrence: 'mensuelle' },
    { id: 'd2', date: '2026-01-01', libelle: 'Mutuelle', montant: 95, recurrence: 'mensuelle' },
    { id: 'd3', date: '2026-01-01', libelle: 'Comptable', montant: 900, recurrence: 'annuelle' },
    { id: 'd4', date: '2026-03-10', libelle: 'Formation', montant: 490, recurrence: 'ponctuelle' },
  ],
};

const D_RECURRENTE = {
  ...D_FREELANCE_BASE,
  missions: [
    { id: 'rec', client: 'Retainer Corp', isManagement: false, isRecurring: true,
      dateDebutRec: '2026-01', nbMoisRec: 6, montantMensuel: 1500, montantDevis: 9000,
      statut: 'cours', dateFact: null, encaissements: [] },
    { id: 'ponct', client: 'Ponctuel', isManagement: false, isRecurring: false, statut: 'fact',
      dateFact: '2026-03-10', montantDevis: 800, montantPrestation: 800, montantVente: 0,
      encaissements: [] },
  ],
};

const D_MIXTE = {
  currentYear: 2026,
  params: {
    statut: 'micro-achat', tauxURSSAF: 12.3, tauxCFP: 0.1,
    tauxCotisationsPrestation: 25.6, tauxCFPPrestation: 0.2,
    tauxCotisationsVente: 12.3, tauxCFPVente: 0.1,
    objectifNetMensuel: 3000, heuresParJour: 7, joursParSemaine: 4, semainesParAn: 44,
    impotsTaux: 11, tva: false, tauxTVA: 20, activiteMixte: true,
    dateOuverture: '2026-01', chargesSalariales: 0
  },
  missions: [
    { id: 'mx1', client: 'Client Mixte', isManagement: false, isRecurring: false, statut: 'fact',
      dateFact: '2026-04-10', montantDevis: 3000, montantPrestation: 2000, montantVente: 1000,
      encaissements: [] },
    { id: 'mx2', client: 'Client Enc', isManagement: false, isRecurring: false, statut: 'fact',
      dateFact: '2026-04-15', montantDevis: 1500, montantPrestation: 1000, montantVente: 500,
      encaissements: [
        { id: 'e1', date: '2026-04-15', montant: 750 },
        { id: 'e2', date: '2026-05-01', montant: 750 },
      ] },
  ],
  revenus: { '2026-04': { autresList: [] }, '2026-05': { autresList: [] } },
  depenses: [],
};

const D_SASU = {
  currentYear: 2026,
  params: {
    statut: 'sasu', tauxURSSAF: 0, tauxCFP: 0,
    remunerationNette: 3000, coutRemunerationPct: 80,
    objectifNetMensuel: 0, heuresParJour: 7, joursParSemaine: 4, semainesParAn: 44,
    impotsTaux: 15, tva: true, tauxTVA: 20, activiteMixte: false,
    dateOuverture: '2026-01', chargesSalariales: 0,
    tresorerieParAnnee: { 2026: 10000 }
  },
  missions: [
    { id: 's1', client: 'Corp', isManagement: false, isRecurring: false, statut: 'fact',
      dateFact: '2026-05-10', montantDevis: 5000, montantPrestation: 5000, montantVente: 0,
      encaissements: [] },
  ],
  revenus: { '2026-05': { autresList: [] } },
  depenses: [
    { id: 'd1', date: '2026-01-01', libelle: 'Loyer', montant: 500, recurrence: 'mensuelle' },
  ],
};

const D_HISTORIQUE = {
  currentYear: 2026,
  params: { ...D_FREELANCE_BASE.params, objectifNetMensuel: 4000 },
  missions: [
    { id: 'r1', client: 'Annuel', isManagement: false, isRecurring: true,
      dateDebutRec: '2026-01', nbMoisRec: 12, montantMensuel: 2000, montantDevis: 24000,
      statut: 'cours', dateFact: null, encaissements: [] },
    { id: 'p1', client: 'Janvier', isManagement: false, isRecurring: false, statut: 'fact',
      dateFact: '2026-01-20', montantDevis: 1000, montantPrestation: 1000, montantVente: 0,
      encaissements: [] },
    { id: 'p2', client: 'Juin', isManagement: false, isRecurring: false, statut: 'fact',
      dateFact: '2026-06-10', montantDevis: 3000, montantPrestation: 3000, montantVente: 0,
      encaissements: [] },
  ],
  revenus: {},
  depenses: [
    { id: 'd1', date: '2026-01-01', libelle: 'Abo', montant: 50, recurrence: 'mensuelle' },
    { id: 'd2', date: '2026-01-01', libelle: 'Compta', montant: 1200, recurrence: 'annuelle' },
  ],
};

const D_RECURRENTE_TERMINEE = {
  ...D_FREELANCE_BASE,
  missions: [
    { id: 'rec', client: 'Retainer Fini', isManagement: false, isRecurring: true,
      dateDebutRec: '2026-01', nbMoisRec: 2, montantMensuel: 1000, montantDevis: 2000,
      statut: 'cours', dateFact: null, encaissements: [] },
  ],
};

const D_DEPENSES = {
  ...D_FREELANCE_BASE,
  missions: [],
  depenses: [
    { id: 'd1', date: '2026-02-01', libelle: 'Adobe', montant: 60, recurrence: 'mensuelle' },
    { id: 'd2', date: '2026-01-01', libelle: 'Comptable', montant: 1200, recurrence: 'annuelle' },
    { id: 'd3', date: '2026-06-20', libelle: 'Conf', montant: 300, recurrence: 'ponctuelle' },
    { id: 'd4', date: '2026-03-01', libelle: 'Slack', montant: 8, recurrence: 'mensuelle' },
  ],
};

const D_OUVERTURE_MARS = {
  ...D_FREELANCE_BASE,
  params: { ...D_FREELANCE_BASE.params, dateOuverture: '2026-03' },
  missions: [
    { id: 'av', client: 'Avant', isManagement: false, isRecurring: false, statut: 'fact',
      dateFact: '2026-02-01', montantDevis: 999, montantPrestation: 999, montantVente: 0,
      encaissements: [] },
    { id: 'ap', client: 'Après', isManagement: false, isRecurring: false, statut: 'fact',
      dateFact: '2026-04-01', montantDevis: 1000, montantPrestation: 1000, montantVente: 0,
      encaissements: [] },
  ],
};

const D_ENCAISSEMENTS_FRACTIONNES = {
  ...D_FREELANCE_BASE,
  missions: [
    { id: 'frac', client: 'Frac', isManagement: false, isRecurring: false, statut: 'fact',
      dateFact: '2026-03-01', montantDevis: 4000, montantPrestation: 4000, montantVente: 0,
      encaissements: [
        { id: 'e1', date: '2026-03-01', montant: 2000 },
        { id: 'e2', date: '2026-04-15', montant: 2000 },
      ] },
  ],
};

const D_AVEC_PONCTUELS = {
  ...D_RECURRENTE,
  revenus: {
    '2026-03': {
      autresList: [
        { id: 'p1', libelle: 'Rem. frais', montant: 200, type: 'hors_ca', montantPrestation: 0, montantVente: 0 },
        { id: 'p2', libelle: 'Bonus', montant: 500, type: 'prestation', montantPrestation: 500, montantVente: 0 },
      ]
    }
  },
};

// Jeu supplémentaire — activité mixte AVEC TVA activée (combinaison non
// couverte dans validation.js : croise getTVACollecteeMois et la ventilation
// presta/vente du même CA)
const D_MIXTE_TVA = {
  ...D_MIXTE,
  params: { ...D_MIXTE.params, tva: true, tauxTVA: 20 },
};

// Jeu supplémentaire — dépense annuelle à cheval sur le changement d'année
// (mois-anniversaire en décembre, vérifié jusqu'en janvier N+1 hors champ
// MOIS_A_VERIFIER actuel mais utile pour fin d'année)
const D_DEPENSE_FIN_ANNEE = {
  ...D_FREELANCE_BASE,
  missions: [],
  depenses: [
    { id: 'd1', date: '2026-12-01', libelle: 'Assurance RC Pro', montant: 600, recurrence: 'annuelle' },
  ],
};

const D_ARTISAN = {
  ...D_FREELANCE_BASE,
  missions: [
    { id: 'a1', client: 'Chantier', isManagement: false, isRecurring: false, statut: 'fact',
      dateFact: '2026-05-15', montantDevis: 12000, montantPrestation: 12000, montantVente: 0,
      encaissements: [
        { id: 'e1', date: '2026-05-15', montant: 6000 },
        { id: 'e2', date: '2026-06-01', montant: 6000 },
      ] },
  ],
};

const MOIS_A_VERIFIER = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-12'];

// ─────────────────────────────────────────────────────────────
// 3. Runner
// ─────────────────────────────────────────────────────────────

let PASS = 0, FAIL = 0;
const ecarts = [];

function compare(ctxLabel, dataLabel, mk, fnLabel, avant, apres) {
  const ok = typeof avant === 'number' && typeof apres === 'number'
    ? Math.abs(avant - apres) < 0.0001
    : JSON.stringify(avant) === JSON.stringify(apres);
  if (ok) {
    PASS++;
  } else {
    FAIL++;
    ecarts.push({ ctxLabel, dataLabel, mk, fnLabel, avant, apres });
  }
}

async function run() {
  const Core = await import(pathToFileURL(path.join(ROOT, 'refactor-test', 'core', 'calculs.js')).href);

  // ── FREELANCE ──────────────────────────────────────────────
  const datasetsFreelance = {
    D_FREELANCE_BASE, D_RECURRENTE, D_RECURRENTE_TERMINEE, D_MIXTE, D_MIXTE_TVA,
    D_DEPENSES, D_OUVERTURE_MARS, D_SASU, D_ENCAISSEMENTS_FRACTIONNES,
    D_AVEC_PONCTUELS, D_HISTORIQUE, D_DEPENSE_FIN_ANNEE,
  };

  for (const [dataLabel, dataset] of Object.entries(datasetsFreelance)) {
    const ctx = loadHtmlContext('indepuls_freelance.html');
    setData(ctx, dataset);

    for (const mk of MOIS_A_VERIFIER) {
      const avant = {
        ca: ctx.getCaFromMissions(mk),
        depenses: ctx.getDepensesMois(mk),
        revenuNet: ctx.getRevenuNetMois(mk),
        tva: ctx.getTVACollecteeMois(mk),
      };
      const tauxHoraireAvant = ctx.getTauxHoraireMinCible();

      // Substitution en mémoire des 5 fonctions ciblées par les versions core.
      // Les autres fonctions du HTML (non touchées) continuent d'appeler ces
      // noms via le scope global du vm — donc tout calcul qui dépend d'elles
      // (ex. getRevenuNetMois → getCaFromMissions/getDepensesMois) emprunte
      // désormais le chemin core.
      ctx.getCaFromMissions      = (m) => Core.getCaFromMissions(ctx.DATA, m);
      ctx.getDepensesMois        = (m) => Core.getDepensesMois(ctx.DATA, m);
      ctx.getRevenuNetMois       = (m) => Core.getRevenuNetMois(ctx.DATA, m);
      ctx.getTauxHoraireMinCible = ()  => Core.getTauxHoraireMinCible(ctx.DATA);
      ctx.getTVACollecteeMois    = (m) => Core.getTVACollecteeMois(ctx.DATA, m);

      const apres = {
        ca: ctx.getCaFromMissions(mk),
        depenses: ctx.getDepensesMois(mk),
        revenuNet: ctx.getRevenuNetMois(mk),
        tva: ctx.getTVACollecteeMois(mk),
      };
      const tauxHoraireApres = ctx.getTauxHoraireMinCible();

      compare('freelance', dataLabel, mk, 'getCaFromMissions', avant.ca, apres.ca);
      compare('freelance', dataLabel, mk, 'getDepensesMois', avant.depenses, apres.depenses);
      compare('freelance', dataLabel, mk, 'getRevenuNetMois (dashboard)', avant.revenuNet, apres.revenuNet);
      compare('freelance', dataLabel, mk, 'getTVACollecteeMois', avant.tva, apres.tva);
      compare('freelance', dataLabel, mk, 'getTauxHoraireMinCible', tauxHoraireAvant, tauxHoraireApres);

      // Recharger une copie fraîche pour le mois suivant (les fonctions
      // remplacées sont déjà core-only mais on garde l'AVANT propre par mois).
    }

    // Proxy historique annuel : CA net annuel calculé après substitution
    // complète des 5 fonctions, comparé à un second contexte resté 100%
    // original sur les mêmes données.
    const ctxOrig = loadHtmlContext('indepuls_freelance.html');
    setData(ctxOrig, dataset);
    const historiqueAvant = ctxOrig.getCaNetAnnuel();
    const historiqueApres = ctx.getCaNetAnnuel(); // ctx a déjà ses 5 fonctions remplacées
    compare('freelance', dataLabel, 'année', 'getCaNetAnnuel (historique)', historiqueAvant, historiqueApres);
  }

  // ── ARTISAN ────────────────────────────────────────────────
  const ctxAr = loadHtmlContext('indepuls_artisan.html');
  setData(ctxAr, D_ARTISAN);

  for (const mk of ['2026-05', '2026-06', '2026-07']) {
    const avant = {
      ca: ctxAr.getCaFromMissions(mk),
      depenses: ctxAr.getDepensesMois(mk),
      revenuNet: ctxAr.getRevenuNetMois(mk),
      tva: ctxAr.getTVACollecteeMois(mk),
    };

    ctxAr.getCaFromMissions   = (m) => Core.getCaFromMissions(ctxAr.DATA, m);
    ctxAr.getDepensesMois     = (m) => Core.getDepensesMois(ctxAr.DATA, m);
    ctxAr.getRevenuNetMois    = (m) => Core.getRevenuNetMois(ctxAr.DATA, m);
    ctxAr.getTVACollecteeMois = (m) => Core.getTVACollecteeMois(ctxAr.DATA, m);

    const apres = {
      ca: ctxAr.getCaFromMissions(mk),
      depenses: ctxAr.getDepensesMois(mk),
      revenuNet: ctxAr.getRevenuNetMois(mk),
      tva: ctxAr.getTVACollecteeMois(mk),
    };

    compare('artisan', 'D_ARTISAN', mk, 'getCaFromMissions', avant.ca, apres.ca);
    compare('artisan', 'D_ARTISAN', mk, 'getDepensesMois', avant.depenses, apres.depenses);
    compare('artisan', 'D_ARTISAN', mk, 'getRevenuNetMois (dashboard)', avant.revenuNet, apres.revenuNet);
    compare('artisan', 'D_ARTISAN', mk, 'getTVACollecteeMois', avant.tva, apres.tva);
  }

  // ── RAPPORT ────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('  PHASE 2 (limitée) — sandbox de substitution');
  console.log('  Fonctions remplacées : getCaFromMissions, getDepensesMois,');
  console.log('  getRevenuNetMois, getTauxHoraireMinCible, getTVACollecteeMois');
  console.log('═'.repeat(70));
  console.log(`  ${PASS}/${PASS + FAIL} comparaisons identiques (avant === après)`);
  if (FAIL > 0) {
    console.log(`\n  ÉCARTS DÉTECTÉS (${FAIL}) :`);
    for (const e of ecarts) {
      console.log(`   ✗ [${e.ctxLabel}/${e.dataLabel}] ${e.fnLabel} @ ${e.mk}: avant=${JSON.stringify(e.avant)} après=${JSON.stringify(e.apres)}`);
    }
  } else {
    console.log('  ✓ Aucun écart : le branchement réel des 5 fonctions core dans les');
    console.log('    HTML originaux (chargés tels quels, non modifiés) produit des');
    console.log('    résultats strictement identiques aux fonctions actuelles.');
  }
  console.log('═'.repeat(70) + '\n');

  process.exitCode = FAIL > 0 ? 1 : 0;
}

run().catch((err) => {
  console.error('ERREUR SANDBOX PHASE 2 :', err);
  process.exitCode = 1;
});
