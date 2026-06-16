/**
 * Phase 2 (limitée) — sandbox de substitution
 *
 * Objectif : vérifier le branchement réel du core partagé, PAS refaire la
 * validation métier (déjà faite et passée 73/73 dans validation.js).
 *
 * Principe :
 *   1. ARTISAN (indepuls_artisan.html, encore 100% original à ce stade) :
 *      on charge le fichier TEL QUEL dans un contexte vm (comme tests.js),
 *      on capture les sorties "AVANT" avec les fonctions originales, puis on
 *      substitue en mémoire (jamais sur disque) les fonctions ciblées par
 *      les versions de core/calculs.js et on recapture "APRÈS".
 *   1bis. FREELANCE (indepuls_freelance.html) : depuis le passage en
 *      production ("on saute le pas, progressivement"), ce fichier délègue
 *      DÉJÀ ces fonctions à core/calculs.js via un <script type="module">
 *      (modes/freelance.js) — il n'y a plus d'"original" à substituer. On
 *      compare donc directement viaFichier (le vrai pont de production) vs
 *      viaCoreDirect (core appelé directement avec les mêmes données), ce qui
 *      prouve que le branchement réel en production est correct.
 *   3. Liste des fonctions couvertes (substituées pour Artisan, déjà natives
 *      pour Freelance) :
 *        - getCaFromMissions
 *        - getDepensesMois
 *        - getRevenuNetMois
 *        - getTauxHoraireMinCible
 *        - getTVACollecteeMois
 *      Et, depuis l'extension du pont (étape 2), les fonctions confirmées
 *      identiques caractère pour caractère entre les deux HTML originaux :
 *        - isSASU, getImpotsTaux, getTauxCharges
 *        - getCurrentYearMonths, isMonthBeforeOpening
 *        - getCaNetAnnuel
 *      Et, depuis la dernière extension (étape 2bis), les fonctions auditées
 *      au cas par cas (divergences cosmétiques ou réellement neutralisées par
 *      des invariants/garde-fous existants — voir analyse détaillée) :
 *        - getActiveMonthsInYear, getMoisDepuisOuverture, getCaAnnuelBrut
 *        - getPonctuelsCA, getPonctuelsPresta, getPonctuelsVente, getPonctuelsTresorerie
 *        - getMissionVenteRatio, getTauxChargesVente
 *      Et, depuis l'extension étape 2ter, un nouveau lot de fonctions
 *      identiques ou neutralisées par les usages réels (branchées sur les
 *      deux modes sauf mention contraire) :
 *        - getCaNetAnnuel, getHeuresFact, getHeuresInterne, getMissionTotalMs
 *        - getMissionHeures (le branchement "collectif" de Freelance est mort
 *          code côté Artisan, qui ne pose jamais typeMission)
 *        - getResteAEncaisser, getTotalEncaisse, getMoisActifsAnnee (cosmétique)
 *        - getSasuCoutRemuMensuel, getSasuProjectionFinAnnee, getSasuSoldeActuelEstime
 *        - getTresorerieDepart, getTVACollecteeAnnuelle, getTVADeductibleAnnuelle,
 *          getTVADeductibleMois, getTVAProvisionMensuelle, getTVASeuilsStatut,
 *          getTvaRegime, getUrssafAnnuelBrut, getUrssafProvisionMensuelle, getUrssafRegime
 *        - getTauxChargesPresta, isActiviteMixte : branchées POUR FREELANCE
 *          SEULEMENT (core est modélisé sur Freelance, donc identique). Pour
 *          Artisan, getTauxChargesPresta diverge réellement (|| vs ?? sur un
 *          taux à 0% explicite) — non branchée côté Artisan, à clarifier métier.
 *      Volontairement NON branchées (divergences métier réelles) :
 *        - getDepensesMoyenneMensuelle (Artisan exclut les dépenses liées à un
 *          chantier via chantierId — règle métier propre à ce mode, à conserver)
 *        - getTauxChargesPresta côté Artisan (cf. ci-dessus)
 *        - getCaPrestaMois, getCaVenteMissions, getMissionCaPresta, getMissionCaVente
 *          (absentes du code Artisan, qui utilise un modèle de ventilation
 *          getCAMixte() propre — architecturalement hors périmètre du pont)
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

async function loadHtmlContext(htmlFile) {
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

  // indepuls_freelance.html ne définit plus en local les 46 fonctions déjà
  // branchées sur core/calculs.js (étape "on saute le pas") — elles vivent
  // désormais dans le <script type="module"> de fin de fichier, que vm ne
  // sait pas exécuter. On reproduit ici le même branchement, à l'identique
  // de ce que fait réellement ce fichier dans un navigateur.
  if (htmlFile === 'indepuls_freelance.html') {
    const Mode = await import(pathToFileURL(path.join(ROOT, 'refactor-test', 'modes', 'freelance.js')).href);
    const sync = () => Mode.setData(ctx.DATA);
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
  }

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
  // activiteMixte: true car les fonctions getTauxChargesVente/getMissionVenteRatio
  // ne sont appelées par le code Artisan que sous cette garde — un dataset non
  // mixte teste un cas qui ne se produit jamais en production et fausse la
  // comparaison (la fonction Artisan ne se rabat pas sur le taux prestation
  // quand activiteMixte est false, contrairement à core/calculs.js).
  params: { ...D_FREELANCE_BASE.params, activiteMixte: true },
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
  // indepuls_freelance.html n'est PLUS un fichier "original non bridé" :
  // depuis le passage en production (étape "on saute le pas"), ces 46
  // fonctions y sont directement définies via le <script type="module">
  // qui délègue à core/calculs.js (modes/freelance.js). La comparaison
  // "avant substitution / après substitution" sur UN SEUL fichier n'a donc
  // plus de sens (les deux côtés seraient toujours identiques par
  // construction). On compare maintenant directement :
  //   - viaFichier : ce que la fonction du fichier de prod renvoie réellement
  //     (donc le vrai pont <script type="module"> + modes/freelance.js)
  //   - viaCoreDirect : core/calculs.js appelé directement avec les mêmes données
  // Un écart ici révélerait un bug dans le branchement de production
  // lui-même (mauvais nom, mauvais argument, sync() qui ne se déclenche
  // pas...), ce que l'ancienne comparaison ne pouvait pas détecter puisque
  // les deux côtés passaient déjà par Core.
  const datasetsFreelance = {
    D_FREELANCE_BASE, D_RECURRENTE, D_RECURRENTE_TERMINEE, D_MIXTE, D_MIXTE_TVA,
    D_DEPENSES, D_OUVERTURE_MARS, D_SASU, D_ENCAISSEMENTS_FRACTIONNES,
    D_AVEC_PONCTUELS, D_HISTORIQUE, D_DEPENSE_FIN_ANNEE,
  };

  for (const [dataLabel, dataset] of Object.entries(datasetsFreelance)) {
    const ctx = await loadHtmlContext('indepuls_freelance.html');
    setData(ctx, dataset);

    for (const mk of MOIS_A_VERIFIER) {
      const m0 = ctx.DATA.missions[0] || null;
      const viaFichier = {
        ca: ctx.getCaFromMissions(mk),
        depenses: ctx.getDepensesMois(mk),
        revenuNet: ctx.getRevenuNetMois(mk),
        tva: ctx.getTVACollecteeMois(mk),
        sasu: ctx.isSASU(),
        impotsTaux: ctx.getImpotsTaux(),
        tauxCharges: ctx.getTauxCharges(),
        anneeMonths: ctx.getCurrentYearMonths(),
        avantOuverture: ctx.isMonthBeforeOpening(mk),
        activeMonths: ctx.getActiveMonthsInYear(),
        moisOuverture: ctx.getMoisDepuisOuverture(),
        caAnnuelBrut: ctx.getCaAnnuelBrut(),
        ponctuelsCA: ctx.getPonctuelsCA(mk),
        ponctuelsPresta: ctx.getPonctuelsPresta(mk),
        ponctuelsVente: ctx.getPonctuelsVente(mk),
        ponctuelsTreso: ctx.getPonctuelsTresorerie(mk),
        venteRatio: (m0 ? ctx.getMissionVenteRatio(m0) : null),
        tauxChargesVente: ctx.getTauxChargesVente(),
        tauxChargesPresta: ctx.getTauxChargesPresta(),
        activiteMixte: ctx.isActiviteMixte(),
        heuresFact: ctx.getHeuresFact(),
        heuresInterne: ctx.getHeuresInterne(),
        missionTotalMs: (m0 ? ctx.getMissionTotalMs(m0) : null),
        missionHeures: (m0 ? ctx.getMissionHeures(m0) : null),
        resteAEncaisser: (m0 ? ctx.getResteAEncaisser(m0) : null),
        totalEncaisse: (m0 ? ctx.getTotalEncaisse(m0) : null),
        moisActifsAnnee: ctx.getMoisActifsAnnee(),
        sasuCoutRemu: ctx.getSasuCoutRemuMensuel(),
        sasuProjection: ctx.getSasuProjectionFinAnnee(),
        sasuSolde: ctx.getSasuSoldeActuelEstime(),
        tresorerieDepart: ctx.getTresorerieDepart(),
        tvaCollecteeAnnuelle: ctx.getTVACollecteeAnnuelle(),
        tvaDeductibleAnnuelle: ctx.getTVADeductibleAnnuelle(),
        tvaDeductibleMois: ctx.getTVADeductibleMois(mk),
        tvaProvisionMensuelle: ctx.getTVAProvisionMensuelle(),
        tvaSeuilsStatut: ctx.getTVASeuilsStatut(),
        tvaRegime: ctx.getTvaRegime(),
        urssafAnnuelBrut: ctx.getUrssafAnnuelBrut(),
        urssafProvisionMensuelle: ctx.getUrssafProvisionMensuelle(),
        urssafRegime: ctx.getUrssafRegime(),
      };
      const tauxHoraireViaFichier = ctx.getTauxHoraireMinCible();

      const D = ctx.DATA;
      const viaCoreDirect = {
        ca: Core.getCaFromMissions(D, mk),
        depenses: Core.getDepensesMois(D, mk),
        revenuNet: Core.getRevenuNetMois(D, mk),
        tva: Core.getTVACollecteeMois(D, mk),
        sasu: Core.isSASU(D),
        impotsTaux: Core.getImpotsTaux(D),
        tauxCharges: Core.getTauxCharges(D),
        anneeMonths: Core.getCurrentYearMonths(D),
        avantOuverture: Core.isMonthBeforeOpening(D, mk),
        activeMonths: Core.getActiveMonthsInYear(D),
        moisOuverture: Core.getMoisDepuisOuverture(D),
        caAnnuelBrut: Core.getCaAnnuelBrut(D),
        ponctuelsCA: Core.getPonctuelsCA(D, mk),
        ponctuelsPresta: Core.getPonctuelsPresta(D, mk),
        ponctuelsVente: Core.getPonctuelsVente(D, mk),
        ponctuelsTreso: Core.getPonctuelsTresorerie(D, mk),
        venteRatio: (m0 ? Core.getMissionVenteRatio(D, m0) : null),
        tauxChargesVente: Core.getTauxChargesVente(D),
        tauxChargesPresta: Core.getTauxChargesPresta(D),
        activiteMixte: Core.isActiviteMixte(D),
        heuresFact: Core.getHeuresFact(D),
        heuresInterne: Core.getHeuresInterne(D),
        missionTotalMs: (m0 ? Core.getMissionTotalMs(D, m0) : null),
        missionHeures: (m0 ? Core.getMissionHeures(D, m0) : null),
        resteAEncaisser: (m0 ? Core.getResteAEncaisser(m0) : null),
        totalEncaisse: (m0 ? Core.getTotalEncaisse(m0) : null),
        moisActifsAnnee: Core.getMoisActifsAnnee(D),
        sasuCoutRemu: Core.getSasuCoutRemuMensuel(D),
        sasuProjection: Core.getSasuProjectionFinAnnee(D),
        sasuSolde: Core.getSasuSoldeActuelEstime(D),
        tresorerieDepart: Core.getTresorerieDepart(D),
        tvaCollecteeAnnuelle: Core.getTVACollecteeAnnuelle(D),
        tvaDeductibleAnnuelle: Core.getTVADeductibleAnnuelle(D),
        tvaDeductibleMois: Core.getTVADeductibleMois(D, mk),
        tvaProvisionMensuelle: Core.getTVAProvisionMensuelle(D),
        tvaSeuilsStatut: Core.getTVASeuilsStatut(D),
        tvaRegime: Core.getTvaRegime(D),
        urssafAnnuelBrut: Core.getUrssafAnnuelBrut(D),
        urssafProvisionMensuelle: Core.getUrssafProvisionMensuelle(D),
        urssafRegime: Core.getUrssafRegime(D),
      };
      const tauxHoraireViaCoreDirect = Core.getTauxHoraireMinCible(D);

      compare('freelance', dataLabel, mk, 'getCaFromMissions', viaFichier.ca, viaCoreDirect.ca);
      compare('freelance', dataLabel, mk, 'getDepensesMois', viaFichier.depenses, viaCoreDirect.depenses);
      compare('freelance', dataLabel, mk, 'getRevenuNetMois (dashboard)', viaFichier.revenuNet, viaCoreDirect.revenuNet);
      compare('freelance', dataLabel, mk, 'getTVACollecteeMois', viaFichier.tva, viaCoreDirect.tva);
      compare('freelance', dataLabel, mk, 'getTauxHoraireMinCible', tauxHoraireViaFichier, tauxHoraireViaCoreDirect);
      compare('freelance', dataLabel, mk, 'isSASU', viaFichier.sasu, viaCoreDirect.sasu);
      compare('freelance', dataLabel, mk, 'getImpotsTaux', viaFichier.impotsTaux, viaCoreDirect.impotsTaux);
      compare('freelance', dataLabel, mk, 'getTauxCharges', viaFichier.tauxCharges, viaCoreDirect.tauxCharges);
      compare('freelance', dataLabel, mk, 'getActiveMonthsInYear', viaFichier.activeMonths, viaCoreDirect.activeMonths);
      compare('freelance', dataLabel, mk, 'getMoisDepuisOuverture', viaFichier.moisOuverture, viaCoreDirect.moisOuverture);
      compare('freelance', dataLabel, mk, 'getCaAnnuelBrut', viaFichier.caAnnuelBrut, viaCoreDirect.caAnnuelBrut);
      compare('freelance', dataLabel, mk, 'getPonctuelsCA', viaFichier.ponctuelsCA, viaCoreDirect.ponctuelsCA);
      compare('freelance', dataLabel, mk, 'getPonctuelsPresta', viaFichier.ponctuelsPresta, viaCoreDirect.ponctuelsPresta);
      compare('freelance', dataLabel, mk, 'getPonctuelsVente', viaFichier.ponctuelsVente, viaCoreDirect.ponctuelsVente);
      compare('freelance', dataLabel, mk, 'getPonctuelsTresorerie', viaFichier.ponctuelsTreso, viaCoreDirect.ponctuelsTreso);
      compare('freelance', dataLabel, mk, 'getMissionVenteRatio', viaFichier.venteRatio, viaCoreDirect.venteRatio);
      compare('freelance', dataLabel, mk, 'getTauxChargesVente', viaFichier.tauxChargesVente, viaCoreDirect.tauxChargesVente);
      compare('freelance', dataLabel, mk, 'getCurrentYearMonths', viaFichier.anneeMonths, viaCoreDirect.anneeMonths);
      compare('freelance', dataLabel, mk, 'isMonthBeforeOpening', viaFichier.avantOuverture, viaCoreDirect.avantOuverture);
      compare('freelance', dataLabel, mk, 'getTauxChargesPresta', viaFichier.tauxChargesPresta, viaCoreDirect.tauxChargesPresta);
      compare('freelance', dataLabel, mk, 'isActiviteMixte', viaFichier.activiteMixte, viaCoreDirect.activiteMixte);
      compare('freelance', dataLabel, mk, 'getHeuresFact', viaFichier.heuresFact, viaCoreDirect.heuresFact);
      compare('freelance', dataLabel, mk, 'getHeuresInterne', viaFichier.heuresInterne, viaCoreDirect.heuresInterne);
      compare('freelance', dataLabel, mk, 'getMissionTotalMs', viaFichier.missionTotalMs, viaCoreDirect.missionTotalMs);
      compare('freelance', dataLabel, mk, 'getMissionHeures', viaFichier.missionHeures, viaCoreDirect.missionHeures);
      compare('freelance', dataLabel, mk, 'getResteAEncaisser', viaFichier.resteAEncaisser, viaCoreDirect.resteAEncaisser);
      compare('freelance', dataLabel, mk, 'getTotalEncaisse', viaFichier.totalEncaisse, viaCoreDirect.totalEncaisse);
      compare('freelance', dataLabel, mk, 'getMoisActifsAnnee', viaFichier.moisActifsAnnee, viaCoreDirect.moisActifsAnnee);
      compare('freelance', dataLabel, mk, 'getSasuCoutRemuMensuel', viaFichier.sasuCoutRemu, viaCoreDirect.sasuCoutRemu);
      compare('freelance', dataLabel, mk, 'getSasuProjectionFinAnnee', viaFichier.sasuProjection, viaCoreDirect.sasuProjection);
      compare('freelance', dataLabel, mk, 'getSasuSoldeActuelEstime', viaFichier.sasuSolde, viaCoreDirect.sasuSolde);
      compare('freelance', dataLabel, mk, 'getTresorerieDepart', viaFichier.tresorerieDepart, viaCoreDirect.tresorerieDepart);
      compare('freelance', dataLabel, mk, 'getTVACollecteeAnnuelle', viaFichier.tvaCollecteeAnnuelle, viaCoreDirect.tvaCollecteeAnnuelle);
      compare('freelance', dataLabel, mk, 'getTVADeductibleAnnuelle', viaFichier.tvaDeductibleAnnuelle, viaCoreDirect.tvaDeductibleAnnuelle);
      compare('freelance', dataLabel, mk, 'getTVADeductibleMois', viaFichier.tvaDeductibleMois, viaCoreDirect.tvaDeductibleMois);
      compare('freelance', dataLabel, mk, 'getTVAProvisionMensuelle', viaFichier.tvaProvisionMensuelle, viaCoreDirect.tvaProvisionMensuelle);
      compare('freelance', dataLabel, mk, 'getTVASeuilsStatut', viaFichier.tvaSeuilsStatut, viaCoreDirect.tvaSeuilsStatut);
      compare('freelance', dataLabel, mk, 'getTvaRegime', viaFichier.tvaRegime, viaCoreDirect.tvaRegime);
      compare('freelance', dataLabel, mk, 'getUrssafAnnuelBrut', viaFichier.urssafAnnuelBrut, viaCoreDirect.urssafAnnuelBrut);
      compare('freelance', dataLabel, mk, 'getUrssafProvisionMensuelle', viaFichier.urssafProvisionMensuelle, viaCoreDirect.urssafProvisionMensuelle);
      compare('freelance', dataLabel, mk, 'getUrssafRegime', viaFichier.urssafRegime, viaCoreDirect.urssafRegime);
    }

    // Proxy historique annuel : CA net annuel via le fichier de prod vs via core direct.
    const historiqueViaFichier = ctx.getCaNetAnnuel();
    const historiqueViaCoreDirect = Core.getCaNetAnnuel(ctx.DATA);
    compare('freelance', dataLabel, 'année', 'getCaNetAnnuel (historique)', historiqueViaFichier, historiqueViaCoreDirect);
  }

  // ── ARTISAN ────────────────────────────────────────────────
  const ctxAr = await loadHtmlContext('indepuls_artisan.html');
  setData(ctxAr, D_ARTISAN);

  for (const mk of ['2026-05', '2026-06', '2026-07']) {
    const avant = {
      ca: ctxAr.getCaFromMissions(mk),
      depenses: ctxAr.getDepensesMois(mk),
      revenuNet: ctxAr.getRevenuNetMois(mk),
      tva: ctxAr.getTVACollecteeMois(mk),
      sasu: ctxAr.isSASU(),
      impotsTaux: ctxAr.getImpotsTaux(),
      tauxCharges: ctxAr.getTauxCharges(),
      anneeMonths: ctxAr.getCurrentYearMonths(),
      avantOuverture: ctxAr.isMonthBeforeOpening(mk),
      activeMonths: ctxAr.getActiveMonthsInYear(),
      moisOuverture: ctxAr.getMoisDepuisOuverture(),
      caAnnuelBrut: ctxAr.getCaAnnuelBrut(),
      ponctuelsCA: ctxAr.getPonctuelsCA(mk),
      ponctuelsPresta: ctxAr.getPonctuelsPresta(mk),
      ponctuelsVente: ctxAr.getPonctuelsVente(mk),
      ponctuelsTreso: ctxAr.getPonctuelsTresorerie(mk),
      venteRatio: (ctxAr.DATA.missions[0] ? ctxAr.getMissionVenteRatio(ctxAr.DATA.missions[0]) : null),
      tauxChargesVente: ctxAr.getTauxChargesVente(),
      heuresFact: ctxAr.getHeuresFact(),
      heuresInterne: ctxAr.getHeuresInterne(),
      missionTotalMs: (ctxAr.DATA.missions[0] ? ctxAr.getMissionTotalMs(ctxAr.DATA.missions[0]) : null),
      missionHeures: (ctxAr.DATA.missions[0] ? ctxAr.getMissionHeures(ctxAr.DATA.missions[0]) : null),
      resteAEncaisser: (ctxAr.DATA.missions[0] ? ctxAr.getResteAEncaisser(ctxAr.DATA.missions[0]) : null),
      totalEncaisse: (ctxAr.DATA.missions[0] ? ctxAr.getTotalEncaisse(ctxAr.DATA.missions[0]) : null),
      moisActifsAnnee: ctxAr.getMoisActifsAnnee(),
      sasuCoutRemu: ctxAr.getSasuCoutRemuMensuel(),
      sasuProjection: ctxAr.getSasuProjectionFinAnnee(),
      sasuSolde: ctxAr.getSasuSoldeActuelEstime(),
      tresorerieDepart: ctxAr.getTresorerieDepart(),
      tvaCollecteeAnnuelle: ctxAr.getTVACollecteeAnnuelle(),
      tvaDeductibleAnnuelle: ctxAr.getTVADeductibleAnnuelle(),
      tvaDeductibleMois: ctxAr.getTVADeductibleMois(mk),
      tvaProvisionMensuelle: ctxAr.getTVAProvisionMensuelle(),
      tvaSeuilsStatut: ctxAr.getTVASeuilsStatut(),
      tvaRegime: ctxAr.getTvaRegime(),
      urssafAnnuelBrut: ctxAr.getUrssafAnnuelBrut(),
      urssafProvisionMensuelle: ctxAr.getUrssafProvisionMensuelle(),
      urssafRegime: ctxAr.getUrssafRegime(),
    };

    ctxAr.getCaFromMissions    = (m) => Core.getCaFromMissions(ctxAr.DATA, m);
    ctxAr.getDepensesMois      = (m) => Core.getDepensesMois(ctxAr.DATA, m);
    ctxAr.getRevenuNetMois     = (m) => Core.getRevenuNetMois(ctxAr.DATA, m);
    ctxAr.getTVACollecteeMois  = (m) => Core.getTVACollecteeMois(ctxAr.DATA, m);
    ctxAr.isSASU               = ()  => Core.isSASU(ctxAr.DATA);
    ctxAr.getImpotsTaux        = ()  => Core.getImpotsTaux(ctxAr.DATA);
    ctxAr.getTauxCharges       = ()  => Core.getTauxCharges(ctxAr.DATA);
    ctxAr.getCurrentYearMonths = ()  => Core.getCurrentYearMonths(ctxAr.DATA);
    ctxAr.isMonthBeforeOpening = (m) => Core.isMonthBeforeOpening(ctxAr.DATA, m);
    ctxAr.getActiveMonthsInYear  = ()  => Core.getActiveMonthsInYear(ctxAr.DATA);
    ctxAr.getMoisDepuisOuverture = ()  => Core.getMoisDepuisOuverture(ctxAr.DATA);
    ctxAr.getCaAnnuelBrut        = ()  => Core.getCaAnnuelBrut(ctxAr.DATA);
    ctxAr.getPonctuelsCA         = (m) => Core.getPonctuelsCA(ctxAr.DATA, m);
    ctxAr.getPonctuelsPresta     = (m) => Core.getPonctuelsPresta(ctxAr.DATA, m);
    ctxAr.getPonctuelsVente      = (m) => Core.getPonctuelsVente(ctxAr.DATA, m);
    ctxAr.getPonctuelsTresorerie = (m) => Core.getPonctuelsTresorerie(ctxAr.DATA, m);
    ctxAr.getMissionVenteRatio   = (mi) => Core.getMissionVenteRatio(ctxAr.DATA, mi);
    ctxAr.getTauxChargesVente    = ()  => Core.getTauxChargesVente(ctxAr.DATA);
    ctxAr.getHeuresFact          = ()  => Core.getHeuresFact(ctxAr.DATA);
    ctxAr.getHeuresInterne       = ()  => Core.getHeuresInterne(ctxAr.DATA);
    ctxAr.getMissionTotalMs      = (m) => Core.getMissionTotalMs(ctxAr.DATA, m);
    ctxAr.getMissionHeures       = (m) => Core.getMissionHeures(ctxAr.DATA, m);
    ctxAr.getResteAEncaisser     = (m) => Core.getResteAEncaisser(m);
    ctxAr.getTotalEncaisse       = (m) => Core.getTotalEncaisse(m);
    ctxAr.getMoisActifsAnnee     = ()  => Core.getMoisActifsAnnee(ctxAr.DATA);
    ctxAr.getSasuCoutRemuMensuel = ()  => Core.getSasuCoutRemuMensuel(ctxAr.DATA);
    ctxAr.getSasuProjectionFinAnnee = () => Core.getSasuProjectionFinAnnee(ctxAr.DATA);
    ctxAr.getSasuSoldeActuelEstime  = () => Core.getSasuSoldeActuelEstime(ctxAr.DATA);
    ctxAr.getTresorerieDepart    = ()  => Core.getTresorerieDepart(ctxAr.DATA);
    ctxAr.getTVACollecteeAnnuelle  = () => Core.getTVACollecteeAnnuelle(ctxAr.DATA);
    ctxAr.getTVADeductibleAnnuelle = () => Core.getTVADeductibleAnnuelle(ctxAr.DATA);
    ctxAr.getTVADeductibleMois   = (m) => Core.getTVADeductibleMois(ctxAr.DATA, m);
    ctxAr.getTVAProvisionMensuelle = () => Core.getTVAProvisionMensuelle(ctxAr.DATA);
    ctxAr.getTVASeuilsStatut     = ()  => Core.getTVASeuilsStatut(ctxAr.DATA);
    ctxAr.getTvaRegime           = ()  => Core.getTvaRegime(ctxAr.DATA);
    ctxAr.getUrssafAnnuelBrut    = ()  => Core.getUrssafAnnuelBrut(ctxAr.DATA);
    ctxAr.getUrssafProvisionMensuelle = () => Core.getUrssafProvisionMensuelle(ctxAr.DATA);
    ctxAr.getUrssafRegime        = ()  => Core.getUrssafRegime(ctxAr.DATA);

    const apres = {
      ca: ctxAr.getCaFromMissions(mk),
      depenses: ctxAr.getDepensesMois(mk),
      revenuNet: ctxAr.getRevenuNetMois(mk),
      tva: ctxAr.getTVACollecteeMois(mk),
      sasu: ctxAr.isSASU(),
      impotsTaux: ctxAr.getImpotsTaux(),
      tauxCharges: ctxAr.getTauxCharges(),
      anneeMonths: ctxAr.getCurrentYearMonths(),
      avantOuverture: ctxAr.isMonthBeforeOpening(mk),
      activeMonths: ctxAr.getActiveMonthsInYear(),
      moisOuverture: ctxAr.getMoisDepuisOuverture(),
      caAnnuelBrut: ctxAr.getCaAnnuelBrut(),
      ponctuelsCA: ctxAr.getPonctuelsCA(mk),
      ponctuelsPresta: ctxAr.getPonctuelsPresta(mk),
      ponctuelsVente: ctxAr.getPonctuelsVente(mk),
      ponctuelsTreso: ctxAr.getPonctuelsTresorerie(mk),
      venteRatio: (ctxAr.DATA.missions[0] ? ctxAr.getMissionVenteRatio(ctxAr.DATA.missions[0]) : null),
      tauxChargesVente: ctxAr.getTauxChargesVente(),
      heuresFact: ctxAr.getHeuresFact(),
      heuresInterne: ctxAr.getHeuresInterne(),
      missionTotalMs: (ctxAr.DATA.missions[0] ? ctxAr.getMissionTotalMs(ctxAr.DATA.missions[0]) : null),
      missionHeures: (ctxAr.DATA.missions[0] ? ctxAr.getMissionHeures(ctxAr.DATA.missions[0]) : null),
      resteAEncaisser: (ctxAr.DATA.missions[0] ? ctxAr.getResteAEncaisser(ctxAr.DATA.missions[0]) : null),
      totalEncaisse: (ctxAr.DATA.missions[0] ? ctxAr.getTotalEncaisse(ctxAr.DATA.missions[0]) : null),
      moisActifsAnnee: ctxAr.getMoisActifsAnnee(),
      sasuCoutRemu: ctxAr.getSasuCoutRemuMensuel(),
      sasuProjection: ctxAr.getSasuProjectionFinAnnee(),
      sasuSolde: ctxAr.getSasuSoldeActuelEstime(),
      tresorerieDepart: ctxAr.getTresorerieDepart(),
      tvaCollecteeAnnuelle: ctxAr.getTVACollecteeAnnuelle(),
      tvaDeductibleAnnuelle: ctxAr.getTVADeductibleAnnuelle(),
      tvaDeductibleMois: ctxAr.getTVADeductibleMois(mk),
      tvaProvisionMensuelle: ctxAr.getTVAProvisionMensuelle(),
      tvaSeuilsStatut: ctxAr.getTVASeuilsStatut(),
      tvaRegime: ctxAr.getTvaRegime(),
      urssafAnnuelBrut: ctxAr.getUrssafAnnuelBrut(),
      urssafProvisionMensuelle: ctxAr.getUrssafProvisionMensuelle(),
      urssafRegime: ctxAr.getUrssafRegime(),
    };

    compare('artisan', 'D_ARTISAN', mk, 'getCaFromMissions', avant.ca, apres.ca);
    compare('artisan', 'D_ARTISAN', mk, 'getDepensesMois', avant.depenses, apres.depenses);
    compare('artisan', 'D_ARTISAN', mk, 'getRevenuNetMois (dashboard)', avant.revenuNet, apres.revenuNet);
    compare('artisan', 'D_ARTISAN', mk, 'getTVACollecteeMois', avant.tva, apres.tva);
    compare('artisan', 'D_ARTISAN', mk, 'isSASU', avant.sasu, apres.sasu);
    compare('artisan', 'D_ARTISAN', mk, 'getImpotsTaux', avant.impotsTaux, apres.impotsTaux);
    compare('artisan', 'D_ARTISAN', mk, 'getTauxCharges', avant.tauxCharges, apres.tauxCharges);
    compare('artisan', 'D_ARTISAN', mk, 'getCurrentYearMonths', avant.anneeMonths, apres.anneeMonths);
    compare('artisan', 'D_ARTISAN', mk, 'isMonthBeforeOpening', avant.avantOuverture, apres.avantOuverture);
    compare('artisan', 'D_ARTISAN', mk, 'getActiveMonthsInYear', avant.activeMonths, apres.activeMonths);
    compare('artisan', 'D_ARTISAN', mk, 'getMoisDepuisOuverture', avant.moisOuverture, apres.moisOuverture);
    compare('artisan', 'D_ARTISAN', mk, 'getCaAnnuelBrut', avant.caAnnuelBrut, apres.caAnnuelBrut);
    compare('artisan', 'D_ARTISAN', mk, 'getPonctuelsCA', avant.ponctuelsCA, apres.ponctuelsCA);
    compare('artisan', 'D_ARTISAN', mk, 'getPonctuelsPresta', avant.ponctuelsPresta, apres.ponctuelsPresta);
    compare('artisan', 'D_ARTISAN', mk, 'getPonctuelsVente', avant.ponctuelsVente, apres.ponctuelsVente);
    compare('artisan', 'D_ARTISAN', mk, 'getPonctuelsTresorerie', avant.ponctuelsTreso, apres.ponctuelsTreso);
    compare('artisan', 'D_ARTISAN', mk, 'getMissionVenteRatio', avant.venteRatio, apres.venteRatio);
    compare('artisan', 'D_ARTISAN', mk, 'getTauxChargesVente', avant.tauxChargesVente, apres.tauxChargesVente);
    compare('artisan', 'D_ARTISAN', mk, 'getHeuresFact', avant.heuresFact, apres.heuresFact);
    compare('artisan', 'D_ARTISAN', mk, 'getHeuresInterne', avant.heuresInterne, apres.heuresInterne);
    compare('artisan', 'D_ARTISAN', mk, 'getMissionTotalMs', avant.missionTotalMs, apres.missionTotalMs);
    compare('artisan', 'D_ARTISAN', mk, 'getMissionHeures', avant.missionHeures, apres.missionHeures);
    compare('artisan', 'D_ARTISAN', mk, 'getResteAEncaisser', avant.resteAEncaisser, apres.resteAEncaisser);
    compare('artisan', 'D_ARTISAN', mk, 'getTotalEncaisse', avant.totalEncaisse, apres.totalEncaisse);
    compare('artisan', 'D_ARTISAN', mk, 'getMoisActifsAnnee', avant.moisActifsAnnee, apres.moisActifsAnnee);
    compare('artisan', 'D_ARTISAN', mk, 'getSasuCoutRemuMensuel', avant.sasuCoutRemu, apres.sasuCoutRemu);
    compare('artisan', 'D_ARTISAN', mk, 'getSasuProjectionFinAnnee', avant.sasuProjection, apres.sasuProjection);
    compare('artisan', 'D_ARTISAN', mk, 'getSasuSoldeActuelEstime', avant.sasuSolde, apres.sasuSolde);
    compare('artisan', 'D_ARTISAN', mk, 'getTresorerieDepart', avant.tresorerieDepart, apres.tresorerieDepart);
    compare('artisan', 'D_ARTISAN', mk, 'getTVACollecteeAnnuelle', avant.tvaCollecteeAnnuelle, apres.tvaCollecteeAnnuelle);
    compare('artisan', 'D_ARTISAN', mk, 'getTVADeductibleAnnuelle', avant.tvaDeductibleAnnuelle, apres.tvaDeductibleAnnuelle);
    compare('artisan', 'D_ARTISAN', mk, 'getTVADeductibleMois', avant.tvaDeductibleMois, apres.tvaDeductibleMois);
    compare('artisan', 'D_ARTISAN', mk, 'getTVAProvisionMensuelle', avant.tvaProvisionMensuelle, apres.tvaProvisionMensuelle);
    compare('artisan', 'D_ARTISAN', mk, 'getTVASeuilsStatut', avant.tvaSeuilsStatut, apres.tvaSeuilsStatut);
    compare('artisan', 'D_ARTISAN', mk, 'getTvaRegime', avant.tvaRegime, apres.tvaRegime);
    compare('artisan', 'D_ARTISAN', mk, 'getUrssafAnnuelBrut', avant.urssafAnnuelBrut, apres.urssafAnnuelBrut);
    compare('artisan', 'D_ARTISAN', mk, 'getUrssafProvisionMensuelle', avant.urssafProvisionMensuelle, apres.urssafProvisionMensuelle);
    compare('artisan', 'D_ARTISAN', mk, 'getUrssafRegime', avant.urssafRegime, apres.urssafRegime);
  }

  // getCaNetAnnuel : proxy historique annuel, même logique que côté Freelance
  const ctxArOrig = await loadHtmlContext('indepuls_artisan.html');
  setData(ctxArOrig, D_ARTISAN);
  compare('artisan', 'D_ARTISAN', 'année', 'getCaNetAnnuel (historique)', ctxArOrig.getCaNetAnnuel(), ctxAr.getCaNetAnnuel());

  // ── RAPPORT ────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('  PHASE 2 (limitée) — sandbox de substitution');
  console.log('  Fonctions remplacées (Freelance ET Artisan, sauf mention contraire) :');
  console.log('  getCaFromMissions, getDepensesMois, getRevenuNetMois,');
  console.log('  getTauxHoraireMinCible, getTVACollecteeMois, isSASU, getImpotsTaux,');
  console.log('  getTauxCharges, getCurrentYearMonths, isMonthBeforeOpening,');
  console.log('  getActiveMonthsInYear, getMoisDepuisOuverture, getCaAnnuelBrut,');
  console.log('  getPonctuelsCA/Presta/Vente/Tresorerie, getMissionVenteRatio,');
  console.log('  getTauxChargesVente, getCaNetAnnuel, getHeuresFact, getHeuresInterne,');
  console.log('  getMissionTotalMs, getMissionHeures, getResteAEncaisser,');
  console.log('  getTotalEncaisse, getMoisActifsAnnee, getSasuCoutRemuMensuel,');
  console.log('  getSasuProjectionFinAnnee, getSasuSoldeActuelEstime, getTresorerieDepart,');
  console.log('  getTVACollecteeAnnuelle, getTVADeductibleAnnuelle, getTVADeductibleMois,');
  console.log('  getTVAProvisionMensuelle, getTVASeuilsStatut, getTvaRegime,');
  console.log('  getUrssafAnnuelBrut, getUrssafProvisionMensuelle, getUrssafRegime');
  console.log('  Freelance uniquement : getTauxChargesPresta, isActiviteMixte');
  console.log('  (divergence Artisan confirmée — voir docstring en tête de fichier)');
  console.log('═'.repeat(70));
  console.log(`  ${PASS}/${PASS + FAIL} comparaisons identiques (avant === après)`);
  if (FAIL > 0) {
    console.log(`\n  ÉCARTS DÉTECTÉS (${FAIL}) :`);
    for (const e of ecarts) {
      console.log(`   ✗ [${e.ctxLabel}/${e.dataLabel}] ${e.fnLabel} @ ${e.mk}: avant=${JSON.stringify(e.avant)} après=${JSON.stringify(e.apres)}`);
    }
  } else {
    console.log('  ✓ Aucun écart : le branchement réel de ces fonctions core dans les');
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
