// ── CALCULS MÉTIER PURS ──────────────────────────────────────
// Toutes ces fonctions lisent DATA (passé en paramètre) mais ne le mutent jamais.
// Elles sont identiques dans freelance et artisan — source unique.
//
// Convention : chaque fonction reçoit DATA en premier paramètre.
// Les fichiers modes/freelance.js et modes/artisan.js créent des wrappers
// qui injectent leur DATA local, pour conserver la compatibilité d'appel
// avec le reste du code existant (ex: getRevenuNetMois(mk) au lieu de
// calculs.getRevenuNetMois(DATA, mk)).

import { getTauxStatut, TVA_SEUILS, ABATTEMENTS_MICRO, ABATTEMENT_MINIMUM, MICRO_LIMITS } from './taux.js';

// ── HELPERS STATUT ───────────────────────────────────────────

export function isSASU(DATA) {
  return DATA.params.statut === 'sasu' || DATA.params.statut === 'eurl';
}

export function isActiviteMixte(DATA) {
  return !!DATA.params.activiteMixte;
}

export function getImpotsTaux(DATA) {
  return (DATA.params.impotsTaux || 0) / 100;
}

// ── TAUX DE CHARGES ──────────────────────────────────────────

export function getTauxCharges(DATA) {
  if (isSASU(DATA)) return 0;
  return (DATA.params.tauxURSSAF + DATA.params.tauxCFP) / 100;
}

export function getTauxChargesPresta(DATA) {
  if (isSASU(DATA)) return 0;
  if (!isActiviteMixte(DATA)) return (DATA.params.tauxURSSAF + DATA.params.tauxCFP) / 100;
  return ((DATA.params.tauxCotisationsPrestation || DATA.params.tauxURSSAF) +
          (DATA.params.tauxCFPPrestation || DATA.params.tauxCFP)) / 100;
}

export function getTauxChargesVente(DATA) {
  if (isSASU(DATA)) return 0;
  if (!isActiviteMixte(DATA)) return getTauxChargesPresta(DATA);
  const _tv = getTauxStatut(DATA.params.statut);
  return ((DATA.params.tauxCotisationsVente || _tv.urssafVente) +
          (DATA.params.tauxCFPVente || _tv.cfpVente)) / 100;
}

// ── DATES & MOIS ─────────────────────────────────────────────

export function getCurrentYearMonths(DATA) {
  const y = DATA.currentYear;
  return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
}

export function isMonthBeforeOpening(DATA, mk) {
  const dO = DATA.params.dateOuverture;
  if (!dO) return false;
  const ouvYear = parseInt(dO.slice(0, 4));
  if (ouvYear > DATA.currentYear) return true;
  if (ouvYear < DATA.currentYear) return false;
  return mk < dO.slice(0, 7);
}

export function getMoisActifsAnnee(DATA) {
  const mks = getCurrentYearMonths(DATA);
  const now = new Date();
  const isCurrentYear = DATA.currentYear === now.getFullYear();
  const curMk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dO = DATA.params.dateOuverture;
  let fromMk = `${DATA.currentYear}-01`;
  if (dO) {
    const ouvYear = parseInt(dO.slice(0, 4));
    if (ouvYear > DATA.currentYear) return [];
    if (ouvYear === DATA.currentYear) fromMk = dO.slice(0, 7);
  }
  const toMk = isCurrentYear ? curMk : `${DATA.currentYear}-12`;
  return mks.filter(mk => mk >= fromMk && mk <= toMk);
}

export function getActiveMonthsInYear(DATA) {
  const dO = DATA.params.dateOuverture;
  if (!dO) return 12;
  const ouvYear = parseInt(dO.slice(0, 4));
  if (ouvYear < DATA.currentYear) return 12;
  if (ouvYear > DATA.currentYear) return 0;
  return Math.max(1, 13 - parseInt(dO.slice(5, 7)));
}

export function getMoisDepuisOuverture(DATA) {
  const dO = DATA.params.dateOuverture;
  if (!dO) return null;
  const [yr, mo] = dO.split('-').map(Number);
  const now = new Date();
  return (now.getFullYear() - yr) * 12 + (now.getMonth() + 1 - mo);
}

// ── DÉPENSES ─────────────────────────────────────────────────

// Une dépense "mensuelle" est-elle active pour le mois {y,mo} ?
// Ancre de départ : dateDebut si renseigné ('always' = aucune borne basse —
// au-delà du garde-fou isMonthBeforeOpening déjà appliqué par l'appelant —
// ou une date YYYY-MM-DD précise, valeur du champ <input type="date">) ;
// sinon repli sur la date de saisie (comportement historique, conservé pour
// les dépenses créées avant l'ajout du champ "Date de début").
function depenseMensuelleActive(d, y, mo) {
  if (d.dateDebut === 'always') return true;
  const dm = new Date((d.dateDebut || d.date) + 'T00:00:00');
  return dm.getFullYear() < y || (dm.getFullYear() === y && dm.getMonth() + 1 <= mo);
}

export function getDepensesMois(DATA, mk) {
  if (isMonthBeforeOpening(DATA, mk)) return 0;
  const [y, mo] = mk.split('-').map(Number);
  let t = 0;
  DATA.depenses.forEach(d => {
    if (!d.date) return;
    if (d.recurrence === 'mensuelle') { if (depenseMensuelleActive(d, y, mo)) t += d.montant; }
    else {
      const dm = new Date(d.date + 'T00:00:00'), dy = dm.getFullYear(), dmo = dm.getMonth() + 1;
      if (d.recurrence === 'annuelle') { if (dmo === mo) t += d.montant; }
      else { if (dy === y && dmo === mo) t += d.montant; }
    }
  });
  return t;
}

export function getDepensesMoyenneMensuelle(DATA) {
  const actMois = getActiveMonthsInYear(DATA);
  if (actMois === 0) return 0;
  // Exclut les dépenses rattachées à une affaire (chantierId) : elles sont
  // absorbées par la marge de chaque affaire et ne font pas partie de la
  // charge structurelle mensuelle. Règle commune artisan et freelance.
  return DATA.depenses
    .filter(d => d.recurrence !== 'ponctuelle' && !d.chantierId)
    .reduce((s, d) => s + (d.recurrence === 'annuelle' ? (d.montant || 0) / actMois : (d.montant || 0)), 0);
}

// ── REVENUS PONCTUELS ────────────────────────────────────────

export function getPonctuelsCA(DATA, mk) {
  return ((DATA.revenus[mk] || {}).autresList || [])
    .reduce((s, e) => s + (e.montantPrestation || 0) + (e.montantVente || 0), 0);
}

export function getPonctuelsPresta(DATA, mk) {
  return ((DATA.revenus[mk] || {}).autresList || [])
    .reduce((s, e) => s + (e.montantPrestation || 0), 0);
}

export function getPonctuelsVente(DATA, mk) {
  return ((DATA.revenus[mk] || {}).autresList || [])
    .reduce((s, e) => s + (e.montantVente || 0), 0);
}

export function getPonctuelsTresorerie(DATA, mk) {
  return ((DATA.revenus[mk] || {}).autresList || [])
    .filter(e => e.type === 'hors_ca')
    .reduce((s, e) => s + (e.montant || 0), 0);
}

// ── CA PAR MOIS ──────────────────────────────────────────────

// ATTENTION DIVERGENCE NON RÉSOLUE (voir rapport de validation) :
// cette fonction retourne {presta, vente} — la forme utilisée par indepuls_freelance.html.
// indepuls_artisan.html a sa propre getCaBreakdownMois qui retourne {prestation, vente, total}
// (clé "prestation" et pas "presta", + une clé "total" en plus) et qui ventile aussi les
// missions sans encaissement avec m.montantVente / (montantDevis - montantVente) au lieu de
// passer par getMissionCaVente/getMissionCaPresta. Les DEUX implémentations donnent le même
// résultat numérique pour les cas testés, mais les clés diffèrent : NE PAS utiliser cette
// fonction telle quelle pour le mode Artisan sans adapter modes/artisan.js (wrapper de
// renommage des clés), sous peine de undefined silencieux côté artisan.
export function getCaBreakdownMois(DATA, mk) {
  if (!isActiviteMixte(DATA)) {
    return { presta: getCaFromMissions(DATA, mk) + getPonctuelsCA(DATA, mk), vente: 0 };
  }
  return {
    presta: getCaPrestaMois(DATA, mk) + getPonctuelsPresta(DATA, mk),
    vente:  getCaVenteMissions(DATA, mk) + getPonctuelsVente(DATA, mk)
  };
}

// IMPORTANT : cette fonction gère deux familles de missions très différentes —
// voir shared/tests/validation.js pour la preuve de non-régression :
//   - isRecurring=true  : contribue mois par mois entre dateDebutRec et dateDebutRec+nbMoisRec,
//     pour le montant montantMensuel. Statuts 'ref'/'att' ou absence de dateDebutRec → exclue.
//   - isRecurring=false : si la mission a des encaissements, le CA du mois = somme des
//     encaissements datés dans ce mois (logique acompte/solde). Sinon, fallback sur dateFact
//     (CA reconnu en une fois au moment de la facturation), uniquement si statut='fact'.
// isRecurring est désormais supporté par les deux modes (Freelance et Artisan),
// donc cette même fonction reste valide pour les deux.
export function getCaFromMissions(DATA, mk) {
  let total = 0;
  DATA.missions.filter(m => !m.isManagement).forEach(m => {
    if (m.isRecurring) {
      if (!m.dateDebutRec || m.statut === 'ref' || m.statut === 'att') return;
      const [sy, sm] = m.dateDebutRec.split('-').map(Number);
      const [ty, tm] = mk.split('-').map(Number);
      const diff = (ty - sy) * 12 + (tm - sm);
      const nb = m.nbMoisRec || 9999;
      if (diff >= 0 && diff < nb) total += m.montantMensuel || 0;
    } else {
      const encs = m.encaissements || [];
      if (encs.length > 0) {
        encs.forEach(e => { if (e.date && monthKeyOf(e.date) === mk) total += e.montant || 0; });
      } else {
        if (m.statut === 'fact' && m.dateFact && monthKeyOf(m.dateFact) === mk) total += m.montantDevis || 0;
      }
    }
  });
  return total;
}

function monthKeyOf(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : null;
}

// Retours/remboursements (fabrication + achat_revente, objectif='marge_commande') — le statut
// de la vente/commande ne change jamais à cause d'un retour (voir DATA.retours, indepuls.html) ;
// cette fonction est le seul point d'entrée pour déduire un remboursement du CA sur un mois
// donné, plutôt que de dupliquer la somme dans chaque consommateur de KPI.
// dateRemboursement = date d'encaissement effectif du remboursement (peut être postérieure à
// `date`, qui reste la date de signalement du retour) — c'est elle qui compte en comptabilité
// de caisse, pas la date de la demande. Repli sur `date` pour les retours créés avant l'ajout
// de ce champ (rétrocompatibilité, pas de migration nécessaire — le champ est optionnel).
function dateEncaissementRetour(r) {
  return r.dateRemboursement || r.date;
}
export function getMontantRembourseMois(DATA, mk) {
  return (DATA.retours || [])
    .filter(r => r.statut === 'rembourse' && monthKeyOf(dateEncaissementRetour(r)) === mk)
    .reduce((t, r) => t + (r.montant || 0), 0);
}
export function getMontantRembourseAnnuel(DATA, year = DATA.currentYear) {
  const y = String(year);
  return (DATA.retours || [])
    .filter(r => r.statut === 'rembourse' && (dateEncaissementRetour(r) || '').startsWith(y))
    .reduce((t, r) => t + (r.montant || 0), 0);
}
// Tous les remboursements confondus, sans filtre de période — pour les calculs "depuis toujours"
// (ex. marge brute cumulée du pilier Rentabilité, qui n'est elle-même pas filtrée par année).
export function getMontantRembourseTotal(DATA) {
  return (DATA.retours || [])
    .filter(r => r.statut === 'rembourse')
    .reduce((t, r) => t + (r.montant || 0), 0);
}

// CA cumulé réel d'une mission récurrente depuis dateDebutRec jusqu'à refDate (aujourd'hui par
// défaut), ou jusqu'à dateDebutRec+nbMoisRec si la durée est connue et déjà passée. Même logique
// diff/mois que getCaFromMissions, mais cumulée sur plusieurs mois au lieu d'un seul mk.
// Utile pour les récurrentes sans date de fin connue (nbMoisRec null), où montantDevis (figé à
// la création) ne reflète pas le CA réellement encaissé à date.
export function getCaRecurrenteADate(DATA, m, refDate = new Date()) {
  if (!m.isRecurring || !m.dateDebutRec || m.statut === 'ref' || m.statut === 'att') return 0;
  const [sy, sm] = m.dateDebutRec.split('-').map(Number);
  const diff = (refDate.getFullYear() - sy) * 12 + (refDate.getMonth() + 1 - sm);
  if (diff < 0) return 0;
  const moisComptes = Math.min(diff + 1, m.nbMoisRec || 9999);
  return moisComptes * (m.montantMensuel || 0);
}

// Ventile le CA prestation d'un mois, missions récurrentes incluses (toujours 100% presta)
// et missions ponctuelles ventilées via getMissionVenteRatio en cas d'activité mixte.
export function getCaPrestaMois(DATA, mk) {
  let t = 0;
  DATA.missions.filter(m => !m.isManagement).forEach(m => {
    if (m.isRecurring) {
      if (!m.dateDebutRec || m.statut === 'ref' || m.statut === 'att') return;
      const [sy, sm] = m.dateDebutRec.split('-').map(Number);
      const [ty, tm] = mk.split('-').map(Number);
      const diff = (ty - sy) * 12 + (tm - sm);
      if (diff >= 0 && diff < (m.nbMoisRec || 9999)) t += m.montantMensuel || 0;
    } else {
      const encs = m.encaissements || [];
      if (encs.length > 0) {
        const vr = getMissionVenteRatio(DATA, m);
        encs.forEach(e => { if (e.date && monthKeyOf(e.date) === mk) t += (e.montant || 0) * (1 - vr); });
      } else {
        if (m.statut === 'fact' && m.dateFact && monthKeyOf(m.dateFact) === mk) t += getMissionCaPresta(DATA, m);
      }
    }
  });
  return t;
}

// CA missions vente pour un mois (uniquement si activité mixte ; les récurrentes
// sont toujours 100% prestation et ne contribuent jamais ici)
export function getCaVenteMissions(DATA, mk) {
  if (!isActiviteMixte(DATA)) return 0;
  let t = 0;
  DATA.missions.filter(m => !m.isManagement && !m.isRecurring).forEach(m => {
    const encs = m.encaissements || [];
    if (encs.length > 0) {
      const vr = getMissionVenteRatio(DATA, m);
      encs.forEach(e => { if (e.date && monthKeyOf(e.date) === mk) t += (e.montant || 0) * vr; });
    } else {
      if (m.statut === 'fact' && m.dateFact && monthKeyOf(m.dateFact) === mk) t += getMissionCaVente(DATA, m);
    }
  });
  return t;
}

// Suppose l'invariant montantDevis = montantPrestation + montantVente, garanti par
// la migration de cohérence dans core/storage.js (applyDefaults).
export function getMissionVenteRatio(DATA, m) {
  if (!isActiviteMixte(DATA)) return 0;
  const tot = (m.montantPrestation || 0) + (m.montantVente || 0);
  if (!tot) return 0;
  return (m.montantVente || 0) / tot;
}

export function getMissionCaPresta(DATA, m) {
  return isActiviteMixte(DATA) ? (m.montantPrestation || 0) : (m.montantDevis || 0);
}

export function getMissionCaVente(DATA, m) {
  return isActiviteMixte(DATA) ? (m.montantVente || 0) : 0;
}

export function getCaAnnuelBrut(DATA) {
  return getCurrentYearMonths(DATA)
    .reduce((t, mk) => t + getCaFromMissions(DATA, mk) + getPonctuelsCA(DATA, mk), 0);
}

export function getCaNetAnnuel(DATA) {
  return getCurrentYearMonths(DATA).reduce((t, mk) => t + getRevenuNetMois(DATA, mk), 0);
}

// ── REVENU NET ───────────────────────────────────────────────

export function getRevenuNetMois(DATA, mk) {
  if (isMonthBeforeOpening(DATA, mk)) return 0;
  const { presta, vente } = getCaBreakdownMois(DATA, mk);
  const brut = presta + vente;
  const charges = presta * getTauxChargesPresta(DATA) + vente * getTauxChargesVente(DATA);
  const impots = brut * getImpotsTaux(DATA);
  const tresorerie = getPonctuelsTresorerie(DATA, mk);
  return brut + tresorerie - charges - impots - getDepensesMois(DATA, mk) - (DATA.params.chargesSalariales || 0);
}

// ── TVA ──────────────────────────────────────────────────────

export function getTVAZone(ca, franchise, tolerance) {
  if (ca >= tolerance) return 'depasse';
  if (ca >= franchise) return 'tolerance';
  return 'normal';
}

export function tvaZoneFill(zone) {
  return zone === 'depasse' ? 'bd' : zone === 'tolerance' ? 'wn' : 'ok';
}

export function tvaZoneKpi(zone) {
  return zone === 'depasse' ? 'bad' : zone === 'tolerance' ? 'warn' : 'neu';
}

export function getTVASeuilsStatut(DATA) {
  const p = DATA.params;
  if (p.statut === 'micro-achat')
    return { franchise: p.seuilTVAVenteBase || TVA_SEUILS.achat.franchise, tolerance: p.seuilTVAVenteMajore || TVA_SEUILS.achat.tolerance };
  return { franchise: p.seuilTVAPrestationBase || TVA_SEUILS.prestation.franchise, tolerance: p.seuilTVAPrestationMajore || TVA_SEUILS.prestation.tolerance };
}

// TVA mode encaissements : base = encaissements réellement reçus
export function getTVACollecteeEncaissementsMois(DATA, mk) {
  const base = getCaFromMissions(DATA, mk) + getPonctuelsCA(DATA, mk);
  return base * (DATA.params.tauxTVA / 100);
}

// TVA mode débits : base = montant facturé dès emission de la facture (dateFact)
export function getTVACollecteeDebitsMois(DATA, mk) {
  let base = 0;
  DATA.missions.filter(m => !m.isManagement).forEach(m => {
    if (m.isRecurring) {
      if (!m.dateDebutRec || m.statut === 'ref' || m.statut === 'att') return;
      const [sy, sm] = m.dateDebutRec.split('-').map(Number);
      const [ty, tm] = mk.split('-').map(Number);
      const diff = (ty - sy) * 12 + (tm - sm);
      if (diff >= 0 && diff < (m.nbMoisRec || 9999)) base += m.montantMensuel || 0;
    } else {
      if (m.statut === 'fact' && m.dateFact && monthKeyOf(m.dateFact) === mk) base += m.montantDevis || 0;
    }
  });
  base += getPonctuelsCA(DATA, mk);
  return base * (DATA.params.tauxTVA / 100);
}

export function getTVACollecteeMois(DATA, mk) {
  if (!DATA.params.tva) return 0;
  return (DATA.params.tvaModeDeclaration || 'encaissements') === 'debits'
    ? getTVACollecteeDebitsMois(DATA, mk)
    : getTVACollecteeEncaissementsMois(DATA, mk);
}

export function getTVADeductibleMois(DATA, mk) {
  if (!DATA.params.tva) return 0;
  const [y, mo] = mk.split('-').map(Number);
  let t = 0;
  DATA.depenses.forEach(d => {
    if (!d.tvaDeductible || !d.date) return;
    if (d.recurrence === 'mensuelle') { if (depenseMensuelleActive(d, y, mo)) t += (d.montantTVA || 0); }
    else {
      const dm = new Date(d.date + 'T00:00:00'), dy = dm.getFullYear(), dmo = dm.getMonth() + 1;
      if (d.recurrence === 'annuelle') { if (dmo === mo) t += (d.montantTVA || 0); }
      else { if (dy === y && dmo === mo) t += (d.montantTVA || 0); }
    }
  });
  return t;
}

export function getTVACollecteeAnnuelle(DATA) {
  return getCurrentYearMonths(DATA).reduce((s, mk) => s + getTVACollecteeMois(DATA, mk), 0);
}

export function getTVADeductibleAnnuelle(DATA) {
  return getCurrentYearMonths(DATA).reduce((s, mk) => s + getTVADeductibleMois(DATA, mk), 0);
}

export function getTvaRegime(DATA) {
  const p = DATA.params;
  if (!p.tva) return 'franchise';
  return p.tvaRegime || 'mensuel';
}

export function getTVAProvisionMensuelle(DATA) {
  const regime = getTvaRegime(DATA);
  if (regime === 'franchise') return 0;
  const mk = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  if (regime === 'mensuel') return Math.max(0, Math.round(getTVACollecteeMois(DATA, mk) - getTVADeductibleMois(DATA, mk)));
  const ann = Math.max(0, getTVACollecteeAnnuelle(DATA) - getTVADeductibleAnnuelle(DATA));
  const moisActifs = getMoisActifsAnnee(DATA);
  return Math.round(ann / Math.max(moisActifs.length, 1));
}

// ── URSSAF ───────────────────────────────────────────────────

export function getUrssafRegime(DATA) {
  if (isSASU(DATA)) return 'mensuel';
  return DATA.params.urssafRegime || 'mensuel';
}

export function getUrssafAnnuelBrut(DATA) {
  return getCurrentYearMonths(DATA).reduce((s, mk) => {
    const { presta, vente } = getCaBreakdownMois(DATA, mk);
    const u  = presta * (DATA.params.tauxURSSAF || 0) / 100 + presta * (DATA.params.tauxCFP || 0) / 100;
    const uV = isActiviteMixte(DATA) ? vente * getTauxChargesVente(DATA) : 0;
    return s + u + uV;
  }, 0);
}

export function getUrssafProvisionMensuelle(DATA) {
  const regime = getUrssafRegime(DATA);
  const mk = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const { presta, vente } = getCaBreakdownMois(DATA, mk);
  if (regime === 'mensuel') {
    const u  = Math.round(presta * (DATA.params.tauxURSSAF || 0) / 100 + presta * (DATA.params.tauxCFP || 0) / 100);
    const uV = isActiviteMixte(DATA) ? Math.round(vente * getTauxChargesVente(DATA)) : 0;
    return u + uV;
  }
  const moisActifs = getMoisActifsAnnee(DATA);
  return Math.round(getUrssafAnnuelBrut(DATA) / Math.max(moisActifs.length, 1));
}

// ── TAUX HORAIRE MINIMUM ─────────────────────────────────────

export function getTauxHoraireMinCible(DATA) {
  const p = DATA.params;
  const hAn = (p.heuresParJour || 7) * (p.joursParSemaine || 4) * (p.semainesParAn || 44);
  if (hAn <= 0) return 0;
  const dep = getDepensesMoyenneMensuelle(DATA) + (p.chargesAnnuellesCompl || 0) / 12 + (p.chargesSalariales || 0);
  if (isSASU(DATA)) return (getSasuCoutRemuMensuel(DATA) + dep) * 12 / hAn;
  const r = 1 - getTauxChargesPresta(DATA) - getImpotsTaux(DATA);
  return r > 0 ? ((p.objectifNetMensuel || 0) + dep) / r * 12 / hAn : 0;
}

// ── SASU ─────────────────────────────────────────────────────

// Net → coût total pour la société (charges patronales/salariales comprises via
// coutRemunerationPct). Pure fonction du net passé en paramètre — pas de lecture directe
// de DATA.params.remunerationNette ici, pour pouvoir l'appliquer aussi à un net simulé
// (calculateur d'objectifs) sans dupliquer la formule.
export function getSasuCoutMensuelDepuisNet(DATA, net) {
  const pct = DATA.params.coutRemunerationPct || 82;
  return (net || 0) * (1 + pct / 100);
}
export function getSasuCoutRemuMensuel(DATA) {
  return getSasuCoutMensuelDepuisNet(DATA, DATA.params.remunerationNette || 0);
}

export function getTresorerieDepart(DATA) {
  return ((DATA.params.tresorerieParAnnee) || {})[DATA.currentYear] || 0;
}

export function getSasuSoldeActuelEstime(DATA) {
  const curMk = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const allMonths = getCurrentYearMonths(DATA).filter(mk => mk <= curMk);
  const ca       = allMonths.reduce((s, mk) => s + getCaFromMissions(DATA, mk) + getPonctuelsCA(DATA, mk), 0);
  const inflows  = allMonths.reduce((s, mk) => s + getPonctuelsTresorerie(DATA, mk), 0);
  const dep      = allMonths.reduce((s, mk) => s + getDepensesMois(DATA, mk), 0);
  const remu     = getSasuCoutRemuMensuel(DATA) * allMonths.length;
  return Math.round(getTresorerieDepart(DATA) + ca + inflows - dep - remu);
}

// TVA encore due entre maintenant et la fin de l'année — PAS la TVA annuelle totale
// (si elle est payée à l'échéance comme le régime l'impose, les mois déjà réglés ne
// sont plus dus). Un seul terme par régime, jamais multiplié par les mois restants
// sauf le trimestriel où le prochain trimestre n'est pas encore entamé :
//  - mensuel   : encours à taille constante (collecté en M, dû le 25 de M+1) — le
//                dernier mois écoulé seulement.
//  - trimestriel : au 31/12, le trimestre en cours (T4) sera complet — extrapolé à
//                partir de la moyenne mensuelle des mois déjà écoulés × 3, pas du
//                cumul partiel du trimestre en cours à la date d'appel.
//  - simplifié : acomptes de juillet (55 %) et décembre (40 %) de la TVA annuelle
//                estimée — les deux restent dus si on est avant juillet, seul celui
//                de décembre si on est après.
//  - franchise : 0.
export function getTvaAVenirFinAnnee(DATA) {
  const regime = getTvaRegime(DATA);
  if (regime === 'franchise') return 0;
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1;
  if (regime === 'mensuel') {
    const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
    const prevMk = `${py}-${String(pm).padStart(2, '0')}`;
    return Math.max(0, Math.round(getTVACollecteeMois(DATA, prevMk) - getTVADeductibleMois(DATA, prevMk)));
  }
  if (regime === 'trimestriel') {
    const curMk = `${y}-${String(m).padStart(2, '0')}`;
    const pastMonths = getCurrentYearMonths(DATA).filter(mk => mk < curMk);
    const n = Math.max(pastMonths.length, 1);
    const tvaAvg = pastMonths.reduce((s, mk) => s + getTVACollecteeMois(DATA, mk) - getTVADeductibleMois(DATA, mk), 0) / n;
    return Math.max(0, Math.round(tvaAvg * 3));
  }
  if (regime === 'simplifie') {
    const ann = Math.max(0, getTVACollecteeAnnuelle(DATA) - getTVADeductibleAnnuelle(DATA));
    return m < 7 ? Math.round(ann * 0.95) : Math.round(ann * 0.40);
  }
  return 0;
}

export function getSasuProjectionFinAnnee(DATA) {
  const curMk = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const cm = parseInt(curMk.split('-')[1], 10);
  const moisRestants = 12 - cm;
  const base = DATA.params.soldeReel != null ? DATA.params.soldeReel : getSasuSoldeActuelEstime(DATA);
  const pastMonths = getCurrentYearMonths(DATA).filter(mk => mk < curMk);
  const n = Math.max(pastMonths.length, 1);
  const caAvg  = pastMonths.reduce((s, mk) => s + getCaFromMissions(DATA, mk) + getPonctuelsCA(DATA, mk), 0) / n;
  const depAvg = pastMonths.reduce((s, mk) => s + getDepensesMois(DATA, mk), 0) / n;
  const tvaAVenir = getTvaAVenirFinAnnee(DATA);
  return Math.round(base + (caAvg - depAvg - getSasuCoutRemuMensuel(DATA)) * moisRestants - tvaAVenir);
}

// ── ENCAISSEMENTS ────────────────────────────────────────────

export function getTotalEncaisse(m) {
  return (m.encaissements || []).reduce((s, e) => s + (e.montant || 0), 0);
}

export function getResteAEncaisser(m) {
  return Math.max(0, (m.montantDevis || 0) - getTotalEncaisse(m));
}

// Statut "Payé" dérivé — jamais stocké, jamais un champ séparé de m.statut ('fact' reste la
// seule valeur interne). Réutilise getResteAEncaisser (donc getTotalEncaisse) plutôt que de
// dupliquer la comparaison montant facturé/encaissé déjà utilisée par l'alerte "facture non
// encaissée depuis X jours". Exclut explicitement les récurrentes (logique "Terminé" + suivi
// N/total mois séparée, inchangée) et le paiement partiel (reste affiché "Facturé").
export function estMissionPayee(m) {
  if (m.isManagement || m.isRecurring) return false;
  return m.statut === 'fact' && getResteAEncaisser(m) === 0 && (m.montantDevis || 0) > 0;
}

// ── TEMPS / HEURES ───────────────────────────────────────────

export function getMissionTotalMs(DATA, m) {
  if (m.isManagement) {
    const base = (DATA.tempsInterne && DATA.tempsInterne[`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`]) || 0;
    const live = m.timerRunning && m.timerStart ? Date.now() - m.timerStart : 0;
    return base + live;
  }
  let t = m.timerAccumulated || 0;
  if (m.timerRunning && m.timerStart) t += Date.now() - m.timerStart;
  t += (m.tempsManuel || []).reduce((s, e) => s + e.ms, 0);
  return t;
}

export function getMissionHeures(DATA, m) {
  const chrono = getMissionTotalMs(DATA, m) / 3600000 + (m.heuresSaisies || 0);
  if (m.typeMission === 'collectif')
    return (m.tempsCreation || 0) + (m.tempsAnimation || 0) + (m.tempsSupport || 0) + chrono;
  return chrono;
}

// Heures réelles d'UNE mission pour UN mois donné (filtre sur tempsManuel daté).
// Distincte de getHeuresMoisMissions(mk), qui agrège TOUTES les missions pour un mois —
// celle-ci fait l'inverse : une mission, un mois. Chantier "Temps prévu" (Phase 1).
export function getMissionHeuresMois(DATA, m, mk) {
  return (m.tempsManuel || [])
    .filter(e => (e.date || '').startsWith(mk))
    .reduce((s, e) => s + e.ms, 0) / 3600000;
}

// Valeur de tempsPrevu applicable à un mois donné, en tenant compte de l'historique
// (tempsPrevuHistorique). Chantier "Temps prévu" (Phase 1).
export function getTempsPrevuPourMois(DATA, m, mk) {
  const entry = (m.tempsPrevuHistorique || [])
    .find(h => mk >= h.dateDebut.slice(0, 7) && mk <= h.dateFin.slice(0, 7));
  return entry ? entry.valeur : (m.tempsPrevu ?? null);
}

// Temps prévu cumulé sur toute la durée déjà écoulée d'une récurrente (tient compte de
// l'historique, mois par mois) — Chantier "Temps prévu" (Phase 2bis, clôture récurrente).
export function getTempsPrevuCumule(DATA, m) {
  if (!m.isRecurring || !m.dateDebutRec) return m.tempsPrevu || 0;
  const [sy, sm] = m.dateDebutRec.split('-').map(Number);
  const now = new Date();
  const moisEcoules = (now.getFullYear() - sy) * 12 + (now.getMonth() + 1 - sm) + 1;
  let total = 0;
  for (let i = 0; i < moisEcoules; i++) {
    const d = new Date(sy, sm - 1 + i, 1);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    total += getTempsPrevuPourMois(DATA, m, mk) || 0;
  }
  return total;
}

export function getHeuresFact(DATA) {
  const hMissions = DATA.missions
    .filter(m => !m.isManagement && (m.statut === 'cours' || m.statut === 'fact'))
    .reduce((s, m) => s + getMissionHeures(DATA, m), 0);
  // Lots d'investissement (achat_revente) : lot.tempsPasse est du temps agrégé non rattachable
  // à une vente précise (tri du lot, séance photo groupée, sourcing) — doit s'additionner au
  // temps des ventes elles-mêmes pour que "Gain horaire réel"/"TH réel" ne sous-compte pas le
  // temps réellement travaillé dès qu'un utilisateur bascule du temps au niveau du lot plutôt
  // que par vente. No-op pour tous les profils sans DATA.lots.
  const hLots = (DATA.lots || []).reduce((s, l) => s + (l.tempsPasse || 0), 0);
  return hMissions + hLots;
}

export function getHeuresInterne(DATA) {
  const m = DATA.missions.find(m => m.isManagement);
  return m ? getMissionHeures(DATA, m) : 0;
}

// ── ABATTEMENT FORFAITAIRE MICRO ─────────────────────────────
// Ces fonctions calculent l'estimation fiscale du régime micro.
// Elles ne touchent pas aux cotisations URSSAF ni à la TVA.
// Ne s'appliquent pas à la SASU.

// Calcule l'abattement forfaitaire en euros sur une base CA presta/vente.
// caPrestaBreakdown et caVenteBreakdown sont la ventilation du CA (même logique
// que getCaBreakdownMois). Pour micro-achat non mixte, tout le CA est passé en
// caPrestaBreakdown mais l'abattement appliqué est 71 % (commerce), pas 50 %.
export function getAbattementMicro(DATA, caPrestaBreakdown, caVenteBreakdown) {
  if (isSASU(DATA)) return 0;
  const statut = DATA.params.statut;
  const mixte  = isActiviteMixte(DATA);
  const caTotal = caPrestaBreakdown + caVenteBreakdown;
  if (caTotal <= 0) return 0;
  const t = ABATTEMENTS_MICRO[statut];
  if (!t) return 0;

  let abatt;
  if (statut === 'micro-bnc') {
    abatt = caTotal * 0.34;
  } else if (statut === 'micro-bic') {
    abatt = mixte
      ? caPrestaBreakdown * 0.50 + caVenteBreakdown * 0.71
      : caTotal * 0.50;
  } else if (statut === 'micro-achat') {
    abatt = mixte
      ? caPrestaBreakdown * 0.50 + caVenteBreakdown * 0.71
      : caTotal * 0.71; // Non mixte : tout le CA est commerce → 71 %
  } else {
    return 0;
  }

  // Abattement minimum légal de 305 € (plafonné au CA total pour éviter un revenu négatif)
  return Math.min(caTotal, Math.max(abatt, ABATTEMENT_MINIMUM));
}

// Revenu imposable estimé après abattement forfaitaire (plancher 0 €).
export function getRevenuImposableMicro(DATA, caPrestaBreakdown, caVenteBreakdown) {
  if (isSASU(DATA)) return 0;
  const caTotal = caPrestaBreakdown + caVenteBreakdown;
  if (caTotal <= 0) return 0;
  return Math.max(0, caTotal - getAbattementMicro(DATA, caPrestaBreakdown, caVenteBreakdown));
}

// Impôt estimé = revenu imposable × taux saisi par l'utilisateur.
// Retourne 0 si SASU, si statut non micro, ou si impotsTaux = 0.
export function getImpotEstimeMicro(DATA, caPrestaBreakdown, caVenteBreakdown) {
  if (isSASU(DATA)) return 0;
  const tauxPct = DATA.params.impotsTaux || 0;
  if (!tauxPct) return 0;
  if (!ABATTEMENTS_MICRO[DATA.params.statut]) return 0; // Statut non micro
  return Math.round(getRevenuImposableMicro(DATA, caPrestaBreakdown, caVenteBreakdown) * tauxPct / 100);
}

// ── PLAFOND DU RÉGIME MICRO ───────────────────────────────────
// Retourne les informations de suivi du plafond micro pour l'année en cours.
// Distinct du seuil de franchise TVA (voir TVA_SEUILS dans taux.js).
// Retourne null si SASU ou statut non micro.
export function getMicroPlafondInfo(DATA) {
  if (isSASU(DATA)) return null;
  const statut = DATA.params.statut;
  const limits = MICRO_LIMITS[statut];
  if (!limits) return null;

  const mixte         = isActiviteMixte(DATA);
  const activeMonths  = getActiveMonthsInYear(DATA);
  const hasProrata    = activeMonths < 12;

  // Plafond annuel effectif (proraté à l'ouverture si création en cours d'année)
  const plafond         = hasProrata ? Math.round(limits.global * activeMonths / 12) : limits.global;
  const spBase          = mixte ? limits.sousPlafondPresta : null;
  const sousPlafond     = (spBase && hasProrata) ? Math.round(spBase * activeMonths / 12) : spBase;

  // CA annuel (encaissé à ce jour dans l'année)
  const caAnnuel = getCaAnnuelBrut(DATA);
  const caPrestaAnnuel = mixte
    ? getCurrentYearMonths(DATA).reduce((s, mk) =>
        s + getCaPrestaMois(DATA, mk) + getPonctuelsPresta(DATA, mk), 0)
    : null;

  const pct       = plafond > 0 ? Math.round(caAnnuel / plafond * 100) : 0;
  const pctPresta = (sousPlafond && sousPlafond > 0 && caPrestaAnnuel !== null)
    ? Math.round(caPrestaAnnuel / sousPlafond * 100) : null;

  return {
    plafond,          // plafond effectif (proraté ou annuel)
    plafondBase: limits.global, // plafond annuel de référence
    sousPlafond,      // sous-plafond prestation effectif (mixte uniquement, sinon null)
    sousPlafondBase: spBase,
    caAnnuel,
    caPrestaAnnuel,   // CA presta annuel (mixte uniquement, sinon null)
    pct,              // % du plafond global atteint
    pctPresta,        // % du sous-plafond prestation atteint (mixte uniquement)
    hasProrata,
    activeMonths,
    mixte,
    statut,
  };
}
