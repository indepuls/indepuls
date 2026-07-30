// ── MODE UNIFIÉ — PONT VERS LE CORE ───────────────────────────
// Bridge unique pour indepuls.html.
// Identique à freelance.js structurellement.
// STORAGE_KEY = 'indepuls' (clé unifiée v30).
// freelance.js et artisan.js sont conservés intacts pour les
// anciens fichiers pendant la période de stabilisation bêta.

import * as C from '../core/calculs.js';
import * as P from '../core/planning.js';
import * as A from '../core/affaires.js';
import * as S from '../core/storage.js';
import * as D from '../core/diff.js';
import * as BH from '../core/briefHebdo.js';
import { getWeekKey as _getWeekKey } from '../core/utils.js';
import { getTauxStatut, TVA_SEUILS as _TVA_SEUILS } from '../core/taux.js';

export const STORAGE_KEY    = 'indepuls';
export const SCHEMA_VERSION = 31;
// Source unique de vérité (shared/core/taux.js) — remplace la constante dupliquée en dur dans
// indepuls.html (audit externe 2026-07-26, "duplication C" ; TODO laissé sur place le 2026-07
// lors d'un chantier précédent, résolu ici).
export const TVA_SEUILS = _TVA_SEUILS;
// Chantier "brief hebdomadaire par email" (2026-07-27) : semaine ISO, réutilisée telle quelle
// côté navigateur (snapshot hebdo dans wScoreSante()) et plus tard côté serveur (cron) — une
// seule implémentation, jamais dupliquée.
export const getWeekKey = _getWeekKey;
// Fonction de décision du brief hebdomadaire (phase 2/4) — portable, testable indépendamment de
// DATA côté serveur plus tard. Injectée ici pour permettre une vérification en conditions
// réelles côté navigateur avant le branchement serveur.
export const getDecisionBriefHebdo = (maintenant) => BH.getDecisionBriefHebdo(DATA, maintenant);
export const doitEnvoyerBriefHebdo = BH.doitEnvoyerBriefHebdo; // pure, aucune dépendance à DATA

let DATA = null;

// ── WRAPPERS — injectent DATA implicitement ───────────────────

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
export const getDepensesLignesMois    = (mk) => C.getDepensesLignesMois(DATA, mk);
export const getDepensesMoyenneMensuelle = () => C.getDepensesMoyenneMensuelle(DATA);

export const getPonctuelsCA           = (mk) => C.getPonctuelsCA(DATA, mk);
export const getPonctuelsPresta       = (mk) => C.getPonctuelsPresta(DATA, mk);
export const getPonctuelsVente        = (mk) => C.getPonctuelsVente(DATA, mk);
export const getPonctuelsTresorerie   = (mk) => C.getPonctuelsTresorerie(DATA, mk);

export const getCaBreakdownMois       = (mk) => C.getCaBreakdownMois(DATA, mk);
export const getCaFromMissions        = (mk) => C.getCaFromMissions(DATA, mk);
export const getMontantRembourseMois  = (mk) => C.getMontantRembourseMois(DATA, mk);
export const getMontantRembourseAnnuel = (year) => C.getMontantRembourseAnnuel(DATA, year);
export const getMontantRembourseTotal  = () => C.getMontantRembourseTotal(DATA);
export const getCaRecurrenteADate     = (m, refDate) => C.getCaRecurrenteADate(DATA, m, refDate);
export const getCaAnnuelBrut          = () => C.getCaAnnuelBrut(DATA);
export const getCaNetAnnuel           = () => C.getCaNetAnnuel(DATA);
export const getRevenuNetMois         = (mk) => C.getRevenuNetMois(DATA, mk);

export const getTVAZone               = C.getTVAZone;
export const tvaZoneFill              = C.tvaZoneFill;
export const tvaZoneKpi               = C.tvaZoneKpi;
export const getTVASeuilsStatut       = () => C.getTVASeuilsStatut(DATA);
export const getTVACollecteeMois               = (mk) => C.getTVACollecteeMois(DATA, mk);
export const getTVACollecteeEncaissementsMois  = (mk) => C.getTVACollecteeEncaissementsMois(DATA, mk);
export const getTVACollecteeDebitsMois         = (mk) => C.getTVACollecteeDebitsMois(DATA, mk);
export const getTVADeductibleMois              = (mk) => C.getTVADeductibleMois(DATA, mk);
export const getTVACollecteeAnnuelle  = () => C.getTVACollecteeAnnuelle(DATA);
export const getTVADeductibleAnnuelle = () => C.getTVADeductibleAnnuelle(DATA);
export const getTvaRegime             = () => C.getTvaRegime(DATA);
export const getTVAProvisionMensuelle = () => C.getTVAProvisionMensuelle(DATA);

export const getUrssafRegime          = () => C.getUrssafRegime(DATA);
export const getUrssafAnnuelBrut      = () => C.getUrssafAnnuelBrut(DATA);
export const getUrssafProvisionMensuelle = () => C.getUrssafProvisionMensuelle(DATA);

export const getTauxHoraireMinCible   = () => C.getTauxHoraireMinCible(DATA);
export const getTHBrutAnnuel          = (caBrut, hT) => C.getTHBrutAnnuel(DATA, caBrut, hT);
export const getTJMBrut               = (thBrut) => C.getTJMBrut(DATA, thBrut);
export const getTHBrutMois            = (mk, caMois, heuresMois) => C.getTHBrutMois(DATA, mk, caMois, heuresMois);
export const getTHBrutRoulant         = (mks, caBrut, hT) => C.getTHBrutRoulant(DATA, mks, caBrut, hT);

export const getSasuCoutRemuMensuel   = () => C.getSasuCoutRemuMensuel(DATA);
export const getSasuCoutMensuelDepuisNet = (net) => C.getSasuCoutMensuelDepuisNet(DATA, net);
export const getTresorerieDepart      = () => C.getTresorerieDepart(DATA);
export const getSasuSoldeActuelEstime = () => C.getSasuSoldeActuelEstime(DATA);
export const getSasuProjectionFinAnnee = () => C.getSasuProjectionFinAnnee(DATA);
export const getTvaAVenirFinAnnee     = () => C.getTvaAVenirFinAnnee(DATA);

export const getTotalEncaisse         = C.getTotalEncaisse;
export const getResteAEncaisser       = C.getResteAEncaisser;
export const estMissionPayee          = C.estMissionPayee;
export const getMissionsImpayees      = () => C.getMissionsImpayees(DATA);
export const getProchaineEcheanceUrssafDaysLeft = (maintenant) => C.getProchaineEcheanceUrssafDaysLeft(DATA, maintenant);
export const getProchaineEcheanceTvaDaysLeft    = (maintenant) => C.getProchaineEcheanceTvaDaysLeft(DATA, maintenant);

export const getMissionTotalMs        = (m) => C.getMissionTotalMs(DATA, m);
export const getMissionHeures         = (m) => C.getMissionHeures(DATA, m);
export const getMissionHeuresMois     = (m, mk) => C.getMissionHeuresMois(DATA, m, mk);
export const getTempsPrevuPourMois    = (m, mk) => C.getTempsPrevuPourMois(DATA, m, mk);
export const getTempsPrevuCumule      = (m) => C.getTempsPrevuCumule(DATA, m);
export const getHeuresFact            = () => C.getHeuresFact(DATA);
export const getHeuresInterne         = () => C.getHeuresInterne(DATA);
export const getTempsJour             = (ds) => C.getTempsJour(DATA, ds);

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
export const getVentesDuLot              = (lotId)     => A.getVentesDuLot(DATA, lotId);
export const getLotStats                 = (lotId)     => A.getLotStats(DATA, lotId);
export const getResultatVente            = (vente)     => A.getResultatVente(DATA, vente);
export const excludeDepensesLiees        = (depenses)  => A.excludeDepensesLiees(depenses);

// ── PLANNING ─────────────────────────────────────────────────

export const joursOuvrésSemaine     = (debut, fin) => P.joursOuvrésSemaine(debut, fin);
export const getChargeJour          = (dateStr)    => P.getChargeJour(DATA, dateStr);
export const getMissionsSessionDay  = (dateStr)    => P.getMissionsSessionDay(DATA, dateStr);
export const sessionCouvreJour      = P.sessionCouvreJour;
export const isRecurringStillActive = P.isRecurringStillActive;
export const getChargeSessionJour   = P.getChargeSessionJour;
export const getSessionsSansTempsRecent = (maintenant, joursMax) => P.getSessionsSansTempsRecent(DATA, maintenant, joursMax);
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

// ── MODE OMBRE — duplication B (audit externe 2026-07-26), instrumentation TEMPORAIRE ──
// Ces 3 exports ne sont PAS un rebranchement réel de storage.js : ils servent uniquement au
// contrôle "ombre" dans indepuls.html (comparaison silencieuse sur une copie clonée, jamais
// utilisée pour l'affichage réel — voir CLAUDE.md, section "Duplication B"). Nom préfixé
// `shadow*` volontairement pour ne jamais les confondre avec un futur vrai bridge, et pour être
// facilement grep-able le jour où l'instrumentation est retirée.
export const shadowMigrate       = (data, schemaVersion, deps) => S.migrate(data, schemaVersion, deps);
export const shadowApplyDefaults = (data, defaultData, deps)   => S.applyDefaults(data, defaultData, deps);
export const shadowDiffPaths     = D.diffPaths;
