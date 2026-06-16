// ── CALCULS MÉTIER PURS ──────────────────────────────────────
// Toutes ces fonctions lisent DATA (passé en paramètre) mais ne le mutent jamais.
// Elles sont identiques dans freelance et artisan — source unique.
//
// Convention : chaque fonction reçoit DATA en premier paramètre.
// Les fichiers modes/freelance.js et modes/artisan.js créent des wrappers
// qui injectent leur DATA local, pour conserver la compatibilité d'appel
// avec le reste du code existant (ex: getRevenuNetMois(mk) au lieu de
// calculs.getRevenuNetMois(DATA, mk)).

import { getTauxStatut, TVA_SEUILS } from './taux.js';

// ── HELPERS STATUT ───────────────────────────────────────────

export function isSASU(DATA) {
  return DATA.params.statut === 'sasu';
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

export function getDepensesMois(DATA, mk) {
  if (isMonthBeforeOpening(DATA, mk)) return 0;
  const [y, mo] = mk.split('-').map(Number);
  let t = 0;
  DATA.depenses.forEach(d => {
    if (!d.date) return;
    const dm = new Date(d.date + 'T00:00:00'), dy = dm.getFullYear(), dmo = dm.getMonth() + 1;
    if (d.recurrence === 'mensuelle')      { if (dy < y || (dy === y && dmo <= mo)) t += d.montant; }
    else if (d.recurrence === 'annuelle')  { if (dmo === mo) t += d.montant; }
    else                                   { if (dy === y && dmo === mo) t += d.montant; }
  });
  return t;
}

export function getDepensesMoyenneMensuelle(DATA) {
  const actMois = getActiveMonthsInYear(DATA);
  if (actMois === 0) return 0;
  return DATA.depenses
    .filter(d => d.recurrence !== 'ponctuelle')
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
// voir refactor-test/tests/validation.js pour la preuve de non-régression :
//   - isRecurring=true  : contribue mois par mois entre dateDebutRec et dateDebutRec+nbMoisRec,
//     pour le montant montantMensuel. Statuts 'ref'/'att' ou absence de dateDebutRec → exclue.
//   - isRecurring=false : si la mission a des encaissements, le CA du mois = somme des
//     encaissements datés dans ce mois (logique acompte/solde). Sinon, fallback sur dateFact
//     (CA reconnu en une fois au moment de la facturation), uniquement si statut='fact'.
// Le mode Artisan n'a pas de missions récurrentes : isRecurring y est toujours falsy,
// donc cette même fonction reste valide pour les deux modes.
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

export function getTVACollecteeMois(DATA, mk) {
  if (!DATA.params.tva) return 0;
  const base = getCaFromMissions(DATA, mk) + getPonctuelsCA(DATA, mk);
  return base * (DATA.params.tauxTVA / 100);
}

export function getTVADeductibleMois(DATA, mk) {
  if (!DATA.params.tva) return 0;
  const y = mk.substring(0, 4), mo = mk.substring(5, 7);
  return DATA.depenses
    .filter(d => d.tvaDeductible && d.date.startsWith(y + '-' + mo))
    .reduce((s, d) => s + (d.montantTVA || 0), 0);
}

export function getTVACollecteeAnnuelle(DATA) {
  return getCurrentYearMonths(DATA).reduce((s, mk) => s + getTVACollecteeMois(DATA, mk), 0);
}

export function getTVADeductibleAnnuelle(DATA) {
  return DATA.depenses
    .filter(d => d.tvaDeductible && d.date.startsWith(String(DATA.currentYear)))
    .reduce((s, d) => s + (d.montantTVA || 0), 0);
}

export function getTvaRegime(DATA) {
  if (isSASU(DATA)) return 'mensuel';
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

export function getSasuCoutRemuMensuel(DATA) {
  const net = DATA.params.remunerationNette || 0;
  const pct = DATA.params.coutRemunerationPct || 80;
  return net * (1 + pct / 100);
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

export function getSasuProjectionFinAnnee(DATA) {
  const curMk = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const cm = parseInt(curMk.split('-')[1], 10);
  const moisRestants = 12 - cm;
  const base = DATA.params.soldeReel != null ? DATA.params.soldeReel : getSasuSoldeActuelEstime(DATA);
  const pastMonths = getCurrentYearMonths(DATA).filter(mk => mk < curMk);
  const n = Math.max(pastMonths.length, 1);
  const caAvg  = pastMonths.reduce((s, mk) => s + getCaFromMissions(DATA, mk) + getPonctuelsCA(DATA, mk), 0) / n;
  const depAvg = pastMonths.reduce((s, mk) => s + getDepensesMois(DATA, mk), 0) / n;
  return Math.round(base + (caAvg - depAvg - getSasuCoutRemuMensuel(DATA)) * moisRestants);
}

// ── ENCAISSEMENTS ────────────────────────────────────────────

export function getTotalEncaisse(m) {
  return (m.encaissements || []).reduce((s, e) => s + (e.montant || 0), 0);
}

export function getResteAEncaisser(m) {
  return Math.max(0, (m.montantDevis || 0) - getTotalEncaisse(m));
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

export function getHeuresFact(DATA) {
  return DATA.missions
    .filter(m => !m.isManagement && (m.statut === 'cours' || m.statut === 'fact'))
    .reduce((s, m) => s + getMissionHeures(DATA, m), 0);
}

export function getHeuresInterne(DATA) {
  const m = DATA.missions.find(m => m.isManagement);
  return m ? getMissionHeures(DATA, m) : 0;
}
