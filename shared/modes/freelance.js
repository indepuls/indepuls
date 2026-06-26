// ── MODE FREELANCE — PONT VERS LE CORE ───────────────────────
// Ce fichier est le point d'entrée du mode Freelance/OBM.
// Il injecte DATA dans toutes les fonctions core et expose
// l'API globale attendue par indepuls_freelance.html.
//
// Stratégie de migration progressive :
//   Phase 1 (actuelle) — ce fichier existe mais n'est pas encore chargé
//     par indepuls_freelance.html. Les fonctions sont copiées dans le HTML.
//   Phase 2 — on remplace les fonctions dupliquées du HTML par des
//     imports de ce module (une par une, avec test après chaque).
//   Phase 3 — le HTML ne contient plus que le UI, toute la logique vient d'ici.

import * as C from '../core/calculs.js';
import * as P from '../core/planning.js';
import * as A from '../core/affaires.js';
import * as S from '../core/storage.js';
import { getTauxStatut } from '../core/taux.js';

// Clé de stockage propre au mode freelance
export const STORAGE_KEY     = 'indepuls_freelance';
export const SCHEMA_VERSION  = 28;

// DATA est la référence globale partagée avec le HTML.
// En phase 2, on l'expose ici et le HTML la lit via window.DATA.
let DATA = null;

// ── WRAPPERS — injectent DATA implicitement ───────────────────
// Permettent d'appeler isSASU() au lieu de C.isSASU(DATA) dans le HTML.

export const isSASU                   = () => C.isSASU(DATA);
export const isActiviteMixte          = () => C.isActiviteMixte(DATA);
export const getImpotsTaux            = () => C.getImpotsTaux(DATA);
export const getTauxCharges           = () => C.getTauxCharges(DATA);
export const getTauxChargesPresta     = () => C.getTauxChargesPresta(DATA);
export const getTauxChargesVente      = () => C.getTauxChargesVente(DATA);
export const getMissionVenteRatio     = (m) => C.getMissionVenteRatio(DATA, m);

export const getCurrentYearMonths     = () => C.getCurrentYearMonths(DATA);
export const isMonthBeforeOpening     = (mk) => C.isMonthBeforeOpening(DATA, mk);
export const getActiveMonthsInYear    = () => C.getActiveMonthsInYear(DATA);
export const getMoisDepuisOuverture   = () => C.getMoisDepuisOuverture(DATA);
export const getMoisActifsAnnee       = () => C.getMoisActifsAnnee(DATA);

export const getDepensesMois          = (mk) => C.getDepensesMois(DATA, mk);
export const getDepensesMoyenneMensuelle = () => C.getDepensesMoyenneMensuelle(DATA);

export const getPonctuelsCA           = (mk) => C.getPonctuelsCA(DATA, mk);
export const getPonctuelsPresta       = (mk) => C.getPonctuelsPresta(DATA, mk);
export const getPonctuelsVente        = (mk) => C.getPonctuelsVente(DATA, mk);
export const getPonctuelsTresorerie   = (mk) => C.getPonctuelsTresorerie(DATA, mk);

export const getCaBreakdownMois       = (mk) => C.getCaBreakdownMois(DATA, mk);
export const getCaFromMissions        = (mk) => C.getCaFromMissions(DATA, mk);
export const getCaAnnuelBrut          = () => C.getCaAnnuelBrut(DATA);
export const getCaNetAnnuel           = () => C.getCaNetAnnuel(DATA);
export const getRevenuNetMois         = (mk) => C.getRevenuNetMois(DATA, mk);

export const getTVAZone               = C.getTVAZone;   // pure, pas de DATA
export const tvaZoneFill              = C.tvaZoneFill;
export const tvaZoneKpi               = C.tvaZoneKpi;
export const getTVASeuilsStatut       = () => C.getTVASeuilsStatut(DATA);
export const getTVACollecteeMois      = (mk) => C.getTVACollecteeMois(DATA, mk);
export const getTVADeductibleMois     = (mk) => C.getTVADeductibleMois(DATA, mk);
export const getTVACollecteeAnnuelle  = () => C.getTVACollecteeAnnuelle(DATA);
export const getTVADeductibleAnnuelle = () => C.getTVADeductibleAnnuelle(DATA);
export const getTvaRegime             = () => C.getTvaRegime(DATA);
export const getTVAProvisionMensuelle = () => C.getTVAProvisionMensuelle(DATA);

export const getUrssafRegime          = () => C.getUrssafRegime(DATA);
export const getUrssafAnnuelBrut      = () => C.getUrssafAnnuelBrut(DATA);
export const getUrssafProvisionMensuelle = () => C.getUrssafProvisionMensuelle(DATA);

export const getTauxHoraireMinCible   = () => C.getTauxHoraireMinCible(DATA);

export const getSasuCoutRemuMensuel   = () => C.getSasuCoutRemuMensuel(DATA);
export const getTresorerieDepart      = () => C.getTresorerieDepart(DATA);
export const getSasuSoldeActuelEstime = () => C.getSasuSoldeActuelEstime(DATA);
export const getSasuProjectionFinAnnee = () => C.getSasuProjectionFinAnnee(DATA);

export const getTotalEncaisse         = C.getTotalEncaisse;   // pure
export const getResteAEncaisser       = C.getResteAEncaisser; // pure

export const getMissionTotalMs        = (m) => C.getMissionTotalMs(DATA, m);
export const getMissionHeures         = (m) => C.getMissionHeures(DATA, m);
export const getHeuresFact            = () => C.getHeuresFact(DATA);
export const getHeuresInterne         = () => C.getHeuresInterne(DATA);

export const getAbattementMicro       = (caP, caV) => C.getAbattementMicro(DATA, caP, caV);
export const getRevenuImposableMicro  = (caP, caV) => C.getRevenuImposableMicro(DATA, caP, caV);
export const getImpotEstimeMicro      = (caP, caV) => C.getImpotEstimeMicro(DATA, caP, caV);
export const getMicroPlafondInfo      = ()         => C.getMicroPlafondInfo(DATA);

// ── AFFAIRES ─────────────────────────────────────────────────

export const getDepensesAffaire          = (affaireId) => A.getDepensesAffaire(DATA, affaireId);
export const getDepensesAffairesMap      = ()          => A.getDepensesAffairesMap(DATA);
export const getMargeAffaire             = (m)         => A.getMargeAffaire(DATA, m);
export const getTHReelAffaire            = (m)         => A.getTHReelAffaire(DATA, m);
export const getPctCoutAffaire           = (m)         => A.getPctCoutAffaire(DATA, m);
export const getAffairesAvecCouts        = (missions)  => A.getAffairesAvecCouts(DATA, missions);
export const getMargeMoyennePortefeuille = (missions)  => A.getMargeMoyennePortefeuille(DATA, missions);
export const excludeDepensesLiees        = (depenses)  => A.excludeDepensesLiees(depenses);

// ── PLANNING ─────────────────────────────────────────────────

export const toHeuresSem            = (v, u) => P.toHeuresSem(DATA.params, v, u);
export const getCapaciteHSem        = ()     => P.getCapaciteHSem(DATA);
export const getMissionChargeHSem   = (m)    => P.getMissionChargeHSem(DATA, m);
export const getChargeEstimeeTotal  = ()     => P.getChargeEstimeeTotal(DATA);
export const getTauxRemplissageMois  = (mk)  => P.getTauxRemplissageMois(DATA, mk);
export const getTauxRemplissageAnnee = ()    => P.getTauxRemplissageAnnee(DATA);
export const scorerRemplissage      = P.scorerRemplissage;
export const getPilierRemplissage   = ()     => P.getPilierRemplissage(DATA);

// ── STORAGE ──────────────────────────────────────────────────

export function setData(newData) { DATA = newData; }
export function getData() { return DATA; }
