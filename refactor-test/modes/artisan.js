// ── MODE ARTISAN — PONT VERS LE CORE ─────────────────────────
// Identique à modes/freelance.js dans la phase 1.
// Les différences Artisan (devis, chantiers, planning) seront ajoutées
// dans les phases suivantes comme fonctions SUPPLÉMENTAIRES ici,
// sans toucher au core partagé.

import * as C from '../core/calculs.js';
import * as S from '../core/storage.js';
import { getTauxStatut } from '../core/taux.js';

export const STORAGE_KEY    = 'indepuls_artisan';
export const SCHEMA_VERSION = 28; // à synchroniser avec le fichier artisan

let DATA = null;

// ── WRAPPERS CORE (identiques à freelance.js) ────────────────

export const isSASU                   = () => C.isSASU(DATA);
export const isActiviteMixte          = () => C.isActiviteMixte(DATA);
export const getImpotsTaux            = () => C.getImpotsTaux(DATA);
export const getTauxCharges           = () => C.getTauxCharges(DATA);
export const getTauxChargesPresta     = () => C.getTauxChargesPresta(DATA);
export const getTauxChargesVente      = () => C.getTauxChargesVente(DATA);

export const getCurrentYearMonths     = () => C.getCurrentYearMonths(DATA);
export const isMonthBeforeOpening     = (mk) => C.isMonthBeforeOpening(DATA, mk);
export const getActiveMonthsInYear    = () => C.getActiveMonthsInYear(DATA);
export const getMoisDepuisOuverture   = () => C.getMoisDepuisOuverture(DATA);

export const getDepensesMois          = (mk) => C.getDepensesMois(DATA, mk);
export const getDepensesMoyenneMensuelle = () => C.getDepensesMoyenneMensuelle(DATA);

export const getPonctuelsCA           = (mk) => C.getPonctuelsCA(DATA, mk);
export const getPonctuelsPresta       = (mk) => C.getPonctuelsPresta(DATA, mk);
export const getPonctuelsVente        = (mk) => C.getPonctuelsVente(DATA, mk);
export const getPonctuelsTresorerie   = (mk) => C.getPonctuelsTresorerie(DATA, mk);

// Le core retourne {presta, vente} (forme Freelance). L'Artisan attend
// {prestation, vente, total} — voir la note dans core/calculs.js sur la
// divergence de shape confirmée par refactor-test/tests/validation.js
// (mêmes valeurs numériques, clés différentes). Ce wrapper traduit la forme
// sans dupliquer la logique de calcul.
export function getCaBreakdownMois(mk) {
  const { presta, vente } = C.getCaBreakdownMois(DATA, mk);
  return { prestation: presta, vente, total: presta + vente };
}
export const getCaFromMissions        = (mk) => C.getCaFromMissions(DATA, mk);
export const getCaAnnuelBrut          = () => C.getCaAnnuelBrut(DATA);
export const getCaNetAnnuel           = () => C.getCaNetAnnuel(DATA);
export const getRevenuNetMois         = (mk) => C.getRevenuNetMois(DATA, mk);

export const getTVAZone               = C.getTVAZone;
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

export const getTotalEncaisse         = C.getTotalEncaisse;
export const getResteAEncaisser       = C.getResteAEncaisser;

export const getMissionTotalMs        = (m) => C.getMissionTotalMs(DATA, m);
export const getMissionHeures         = (m) => C.getMissionHeures(DATA, m);
export const getHeuresFact            = () => C.getHeuresFact(DATA);
export const getHeuresInterne         = () => C.getHeuresInterne(DATA);

// ── FONCTIONS SPÉCIFIQUES ARTISAN ────────────────────────────
// Ces fonctions n'ont pas d'équivalent Freelance.
// Elles restent ici — elles n'iront jamais dans le core partagé.

export function getCaEncaisseAnnuel(DATA_local) {
  // En Artisan, le CA encaissé = somme des encaissements réels
  const d = DATA_local || DATA;
  return (d.missions || []).reduce((s, m) => {
    return s + (m.encaissements || [])
      .filter(e => e.date && e.date.startsWith(String(d.currentYear)))
      .reduce((ss, e) => ss + (e.montant || 0), 0);
  }, 0);
}

// ── STORAGE ──────────────────────────────────────────────────

export function setData(newData) { DATA = newData; }
export function getData() { return DATA; }
