/**
 * Tests de non-régression — Phase 1
 * Objectif : prouver que core/calculs.js donne les mêmes résultats
 * que les fonctions originales extraites des deux HTML.
 *
 * Stratégie :
 *   _orig_*  = copie exacte du code HTML (source de vérité)
 *   _core_*  = version extraite dans core/calculs.js
 * On compare les deux sur plusieurs jeux de données.
 *
 * Exécution : node refactor-test/tests/validation.js
 * Aucune dépendance externe.
 */

'use strict';

// ─────────────────────────────────────────────────────────────
// 0. INFRASTRUCTURE DE TEST
// ─────────────────────────────────────────────────────────────

let PASS = 0, FAIL = 0, WARN = 0;
const results = [];

function eq(a, b) {
  if (typeof a === 'number' && typeof b === 'number')
    return Math.abs(a - b) < 0.0001;
  return JSON.stringify(a) === JSON.stringify(b);
}

function test(label, orig, core, note = '') {
  const ok = eq(orig, core);
  if (ok) {
    PASS++;
    results.push({ status: 'PASS', label, orig, core, note });
  } else {
    FAIL++;
    results.push({ status: 'FAIL', label, orig, core, note });
  }
}

function section(title) {
  results.push({ status: 'SECTION', label: title });
}

// ─────────────────────────────────────────────────────────────
// 1. FONCTIONS ORIGINALES (copie exacte depuis les HTML)
//    Prefixe : _orig_freelance_ / _orig_artisan_
//    DATA injectée via paramètre D pour rester testable
// ─────────────────────────────────────────────────────────────

// ── Helpers partagés ────────────────────────────────────────
function _orig_getMonthKey(s) { return s ? s.slice(0, 7) : null; }

// ── Freelance — copie exacte ──────────────────────────────
function _orig_fl_isSASU(D)            { return D.params.statut === 'sasu'; }
function _orig_fl_isActiviteMixte(D)   { return !!D.params.activiteMixte; }
function _orig_fl_getImpotsTaux(D)     { return (D.params.impotsTaux || 0) / 100; }

const _TAUX_URSSAF = {
  'micro-bnc':   { urssafPresta: 25.6, cfpPresta: 0.2, urssafVente: 12.3, cfpVente: 0.1 },
  'micro-bic':   { urssafPresta: 21.2, cfpPresta: 0.3, urssafVente: 12.3, cfpVente: 0.1 },
  'micro-achat': { urssafPresta: 12.3, cfpPresta: 0.1, urssafVente: 12.3, cfpVente: 0.1 },
};
function _orig_fl_getTauxStatut(statut) { return _TAUX_URSSAF[statut] || _TAUX_URSSAF['micro-bnc']; }

function _orig_fl_getTauxCharges(D) {
  if (_orig_fl_isSASU(D)) return 0;
  return (D.params.tauxURSSAF + D.params.tauxCFP) / 100;
}
function _orig_fl_getTauxChargesPresta(D) {
  if (_orig_fl_isSASU(D)) return 0;
  if (!_orig_fl_isActiviteMixte(D)) return (D.params.tauxURSSAF + D.params.tauxCFP) / 100;
  return ((D.params.tauxCotisationsPrestation || D.params.tauxURSSAF) +
          (D.params.tauxCFPPrestation || D.params.tauxCFP)) / 100;
}
function _orig_fl_getTauxChargesVente(D) {
  if (_orig_fl_isSASU(D)) return 0;
  if (!_orig_fl_isActiviteMixte(D)) return _orig_fl_getTauxChargesPresta(D);
  const _tv = _orig_fl_getTauxStatut(D.params.statut);
  return ((D.params.tauxCotisationsVente || _tv.urssafVente) +
          (D.params.tauxCFPVente || _tv.cfpVente)) / 100;
}

function _orig_fl_getMissionVenteRatio(D, m) {
  if (!_orig_fl_isActiviteMixte(D)) return 0;
  const tot = (m.montantPrestation || 0) + (m.montantVente || 0);
  if (!tot) return 0;
  return (m.montantVente || 0) / tot;
}
function _orig_fl_getMissionCaPresta(D, m) {
  return _orig_fl_isActiviteMixte(D) ? (m.montantPrestation || 0) : (m.montantDevis || 0);
}
function _orig_fl_getMissionCaVente(D, m) {
  return _orig_fl_isActiviteMixte(D) ? (m.montantVente || 0) : 0;
}

function _orig_fl_getCaFromMissions(D, mk) {
  let total = 0;
  D.missions.filter(m => !m.isManagement).forEach(m => {
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
        encs.forEach(e => { if (e.date && _orig_getMonthKey(e.date) === mk) total += e.montant || 0; });
      } else {
        if (m.statut === 'fact' && m.dateFact && _orig_getMonthKey(m.dateFact) === mk) total += m.montantDevis || 0;
      }
    }
  });
  return total;
}

function _orig_fl_getCaPrestaMois(D, mk) {
  let t = 0;
  D.missions.filter(m => !m.isManagement).forEach(m => {
    if (m.isRecurring) {
      if (!m.dateDebutRec || m.statut === 'ref' || m.statut === 'att') return;
      const [sy, sm] = m.dateDebutRec.split('-').map(Number);
      const [ty, tm] = mk.split('-').map(Number);
      const diff = (ty - sy) * 12 + (tm - sm);
      const nb = m.nbMoisRec || 9999;
      if (diff >= 0 && diff < nb) t += m.montantMensuel || 0;
    } else {
      const encs = m.encaissements || [];
      if (encs.length > 0) {
        const vr = _orig_fl_getMissionVenteRatio(D, m);
        encs.forEach(e => { if (e.date && _orig_getMonthKey(e.date) === mk) t += (e.montant || 0) * (1 - vr); });
      } else {
        if (m.statut === 'fact' && m.dateFact && _orig_getMonthKey(m.dateFact) === mk) t += _orig_fl_getMissionCaPresta(D, m);
      }
    }
  });
  return t;
}

function _orig_fl_getCaVenteMissions(D, mk) {
  if (!_orig_fl_isActiviteMixte(D)) return 0;
  let t = 0;
  D.missions.filter(m => !m.isManagement && !m.isRecurring).forEach(m => {
    const encs = m.encaissements || [];
    if (encs.length > 0) {
      const vr = _orig_fl_getMissionVenteRatio(D, m);
      encs.forEach(e => { if (e.date && _orig_getMonthKey(e.date) === mk) t += (e.montant || 0) * vr; });
    } else {
      if (m.statut === 'fact' && m.dateFact && _orig_getMonthKey(m.dateFact) === mk) t += _orig_fl_getMissionCaVente(D, m);
    }
  });
  return t;
}

function _orig_fl_getCaBreakdownMois(D, mk) {
  if (!_orig_fl_isActiviteMixte(D))
    return { presta: _orig_fl_getCaFromMissions(D, mk) + _orig_fl_getPonctuelsCA(D, mk), vente: 0 };
  return {
    presta: _orig_fl_getCaPrestaMois(D, mk) + _orig_fl_getPonctuelsPresta(D, mk),
    vente:  _orig_fl_getCaVenteMissions(D, mk) + _orig_fl_getPonctuelsVente(D, mk)
  };
}

function _orig_fl_getPonctuelsCA(D, mk)         { return ((D.revenus[mk] || {}).autresList || []).reduce((s, e) => s + (e.montantPrestation || 0) + (e.montantVente || 0), 0); }
function _orig_fl_getPonctuelsPresta(D, mk)     { return ((D.revenus[mk] || {}).autresList || []).reduce((s, e) => s + (e.montantPrestation || 0), 0); }
function _orig_fl_getPonctuelsVente(D, mk)      { return ((D.revenus[mk] || {}).autresList || []).reduce((s, e) => s + (e.montantVente || 0), 0); }
function _orig_fl_getPonctuelsTresorerie(D, mk) { return ((D.revenus[mk] || {}).autresList || []).filter(e => e.type === 'hors_ca').reduce((s, e) => s + (e.montant || 0), 0); }

function _orig_fl_isMonthBeforeOpening(D, mk) {
  const dO = D.params.dateOuverture; if (!dO) return false;
  const ouvYear = parseInt(dO.slice(0, 4));
  if (ouvYear > D.currentYear) return true;
  if (ouvYear < D.currentYear) return false;
  return mk < dO.slice(0, 7);
}
function _orig_fl_getActiveMonthsInYear(D) {
  const dO = D.params.dateOuverture; if (!dO) return 12;
  const ouvYear = parseInt(dO.slice(0, 4));
  if (ouvYear < D.currentYear) return 12;
  if (ouvYear > D.currentYear) return 0;
  return Math.max(1, 13 - parseInt(dO.slice(5, 7)));
}

function _orig_fl_getDepensesMois(D, mk) {
  if (_orig_fl_isMonthBeforeOpening(D, mk)) return 0;
  const [y, mo] = mk.split('-').map(Number); let t = 0;
  D.depenses.forEach(d => {
    if (!d.date) return;
    const dm = new Date(d.date + 'T00:00:00'), dy = dm.getFullYear(), dmo = dm.getMonth() + 1;
    if (d.recurrence === 'mensuelle')     { if (dy < y || (dy === y && dmo <= mo)) t += d.montant; }
    else if (d.recurrence === 'annuelle') { if (dmo === mo) t += d.montant; }
    else                                  { if (dy === y && dmo === mo) t += d.montant; }
  });
  return t;
}
function _orig_fl_getDepensesMoyenneMensuelle(D) {
  const actMois = _orig_fl_getActiveMonthsInYear(D);
  if (actMois === 0) return 0;
  return D.depenses.filter(d => d.recurrence !== 'ponctuelle')
    .reduce((s, d) => s + (d.recurrence === 'annuelle' ? (d.montant || 0) / actMois : (d.montant || 0)), 0);
}

function _orig_fl_getCurrentYearMonths(D) {
  const y = D.currentYear;
  return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
}

function _orig_fl_getRevenuNetMois(D, mk) {
  if (_orig_fl_isMonthBeforeOpening(D, mk)) return 0;
  const { presta, vente } = _orig_fl_getCaBreakdownMois(D, mk);
  const brut = presta + vente;
  const charges = presta * _orig_fl_getTauxChargesPresta(D) + vente * _orig_fl_getTauxChargesVente(D);
  const impots = brut * _orig_fl_getImpotsTaux(D);
  const tresorerie = _orig_fl_getPonctuelsTresorerie(D, mk);
  return brut + tresorerie - charges - impots - _orig_fl_getDepensesMois(D, mk) - (D.params.chargesSalariales || 0);
}

function _orig_fl_getTauxHoraireMinCible(D) {
  const p = D.params;
  const hAn = (p.heuresParJour || 7) * (p.joursParSemaine || 4) * (p.semainesParAn || 44);
  if (hAn <= 0) return 0;
  const dep = _orig_fl_getDepensesMoyenneMensuelle(D) + (p.chargesAnnuellesCompl || 0) / 12 + (p.chargesSalariales || 0);
  if (_orig_fl_isSASU(D)) {
    const net = p.remunerationNette || 0, pct = p.coutRemunerationPct || 80;
    return (net * (1 + pct / 100) + dep) * 12 / hAn;
  }
  const r = 1 - _orig_fl_getTauxChargesPresta(D) - _orig_fl_getImpotsTaux(D);
  return r > 0 ? ((p.objectifNetMensuel || 0) + dep) / r * 12 / hAn : 0;
}

// ── Artisan — copie exacte de getCaFromMissions ────────────
function _orig_ar_getCaFromMissions(D, mk) {
  let total = 0;
  D.missions.filter(m => !m.isManagement).forEach(m => {
    const enc = m.encaissements || [];
    if (enc.length > 0) {
      total += enc.filter(e => e.date && _orig_getMonthKey(e.date) === mk).reduce((s, e) => s + (e.montant || 0), 0);
    } else {
      if (m.statut === 'fact' && m.dateFact && _orig_getMonthKey(m.dateFact) === mk) total += m.montantDevis || 0;
    }
  });
  return total;
}

// ─────────────────────────────────────────────────────────────
// 2. FONCTIONS CORE EXTRAITES (même logique, DATA en paramètre)
//    Copie de refactor-test/core/calculs.js — sans dépendance module
// ─────────────────────────────────────────────────────────────

function _core_isSASU(D)          { return D.params.statut === 'sasu'; }
function _core_isActiviteMixte(D) { return !!D.params.activiteMixte; }
function _core_getImpotsTaux(D)   { return (D.params.impotsTaux || 0) / 100; }

function _core_getTauxStatut(statut) { return _TAUX_URSSAF[statut] || _TAUX_URSSAF['micro-bnc']; }

function _core_getTauxChargesPresta(D) {
  if (_core_isSASU(D)) return 0;
  if (!_core_isActiviteMixte(D)) return (D.params.tauxURSSAF + D.params.tauxCFP) / 100;
  return ((D.params.tauxCotisationsPrestation || D.params.tauxURSSAF) +
          (D.params.tauxCFPPrestation || D.params.tauxCFP)) / 100;
}
function _core_getTauxChargesVente(D) {
  if (_core_isSASU(D)) return 0;
  if (!_core_isActiviteMixte(D)) return _core_getTauxChargesPresta(D);
  const _tv = _core_getTauxStatut(D.params.statut);
  return ((D.params.tauxCotisationsVente || _tv.urssafVente) +
          (D.params.tauxCFPVente || _tv.cfpVente)) / 100;
}

function _core_getMissionVenteRatio(D, m) {
  if (!_core_isActiviteMixte(D)) return 0;
  const tot = (m.montantPrestation || 0) + (m.montantVente || 0);
  if (!tot) return 0;
  return (m.montantVente || 0) / tot;
}

// Version CORRIGÉE (bug détecté lors de l'analyse — voir rapport)
function _core_getCaFromMissions(D, mk) {
  let total = 0;
  D.missions.filter(m => !m.isManagement).forEach(m => {
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
        encs.forEach(e => { if (e.date && _orig_getMonthKey(e.date) === mk) total += e.montant || 0; });
      } else {
        if (m.statut === 'fact' && m.dateFact && _orig_getMonthKey(m.dateFact) === mk) total += m.montantDevis || 0;
      }
    }
  });
  return total;
}

function _core_getCaPrestaMois(D, mk) {
  let t = 0;
  D.missions.filter(m => !m.isManagement).forEach(m => {
    if (m.isRecurring) {
      if (!m.dateDebutRec || m.statut === 'ref' || m.statut === 'att') return;
      const [sy, sm] = m.dateDebutRec.split('-').map(Number);
      const [ty, tm] = mk.split('-').map(Number);
      const diff = (ty - sy) * 12 + (tm - sm);
      if (diff >= 0 && diff < (m.nbMoisRec || 9999)) t += m.montantMensuel || 0;
    } else {
      const encs = m.encaissements || [];
      if (encs.length > 0) {
        const vr = _core_getMissionVenteRatio(D, m);
        encs.forEach(e => { if (e.date && _orig_getMonthKey(e.date) === mk) t += (e.montant || 0) * (1 - vr); });
      } else {
        if (m.statut === 'fact' && m.dateFact && _orig_getMonthKey(m.dateFact) === mk)
          t += _core_isActiviteMixte(D) ? (m.montantPrestation || 0) : (m.montantDevis || 0);
      }
    }
  });
  return t;
}

function _core_getCaVenteMissions(D, mk) {
  if (!_core_isActiviteMixte(D)) return 0;
  let t = 0;
  D.missions.filter(m => !m.isManagement && !m.isRecurring).forEach(m => {
    const encs = m.encaissements || [];
    if (encs.length > 0) {
      const vr = _core_getMissionVenteRatio(D, m);
      encs.forEach(e => { if (e.date && _orig_getMonthKey(e.date) === mk) t += (e.montant || 0) * vr; });
    } else {
      if (m.statut === 'fact' && m.dateFact && _orig_getMonthKey(m.dateFact) === mk)
        t += _core_isActiviteMixte(D) ? (m.montantVente || 0) : 0;
    }
  });
  return t;
}

function _core_getPonctuelsCA(D, mk)         { return ((D.revenus[mk] || {}).autresList || []).reduce((s, e) => s + (e.montantPrestation || 0) + (e.montantVente || 0), 0); }
function _core_getPonctuelsPresta(D, mk)     { return ((D.revenus[mk] || {}).autresList || []).reduce((s, e) => s + (e.montantPrestation || 0), 0); }
function _core_getPonctuelsVente(D, mk)      { return ((D.revenus[mk] || {}).autresList || []).reduce((s, e) => s + (e.montantVente || 0), 0); }
function _core_getPonctuelsTresorerie(D, mk) { return ((D.revenus[mk] || {}).autresList || []).filter(e => e.type === 'hors_ca').reduce((s, e) => s + (e.montant || 0), 0); }

function _core_getCaBreakdownMois(D, mk) {
  if (!_core_isActiviteMixte(D))
    return { presta: _core_getCaFromMissions(D, mk) + _core_getPonctuelsCA(D, mk), vente: 0 };
  return {
    presta: _core_getCaPrestaMois(D, mk) + _core_getPonctuelsPresta(D, mk),
    vente:  _core_getCaVenteMissions(D, mk) + _core_getPonctuelsVente(D, mk)
  };
}

function _core_isMonthBeforeOpening(D, mk) {
  const dO = D.params.dateOuverture; if (!dO) return false;
  const ouvYear = parseInt(dO.slice(0, 4));
  if (ouvYear > D.currentYear) return true;
  if (ouvYear < D.currentYear) return false;
  return mk < dO.slice(0, 7);
}
function _core_getActiveMonthsInYear(D) {
  const dO = D.params.dateOuverture; if (!dO) return 12;
  const ouvYear = parseInt(dO.slice(0, 4));
  if (ouvYear < D.currentYear) return 12;
  if (ouvYear > D.currentYear) return 0;
  return Math.max(1, 13 - parseInt(dO.slice(5, 7)));
}

function _core_getDepensesMois(D, mk) {
  if (_core_isMonthBeforeOpening(D, mk)) return 0;
  const [y, mo] = mk.split('-').map(Number); let t = 0;
  D.depenses.forEach(d => {
    if (!d.date) return;
    const dm = new Date(d.date + 'T00:00:00'), dy = dm.getFullYear(), dmo = dm.getMonth() + 1;
    if (d.recurrence === 'mensuelle')     { if (dy < y || (dy === y && dmo <= mo)) t += d.montant; }
    else if (d.recurrence === 'annuelle') { if (dmo === mo) t += d.montant; }
    else                                  { if (dy === y && dmo === mo) t += d.montant; }
  });
  return t;
}
function _core_getDepensesMoyenneMensuelle(D) {
  const actMois = _core_getActiveMonthsInYear(D);
  if (actMois === 0) return 0;
  return D.depenses.filter(d => d.recurrence !== 'ponctuelle')
    .reduce((s, d) => s + (d.recurrence === 'annuelle' ? (d.montant || 0) / actMois : (d.montant || 0)), 0);
}
function _core_getCurrentYearMonths(D) {
  const y = D.currentYear;
  return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
}
function _core_getRevenuNetMois(D, mk) {
  if (_core_isMonthBeforeOpening(D, mk)) return 0;
  const { presta, vente } = _core_getCaBreakdownMois(D, mk);
  const brut = presta + vente;
  const charges = presta * _core_getTauxChargesPresta(D) + vente * _core_getTauxChargesVente(D);
  const impots = brut * _core_getImpotsTaux(D);
  const tresorerie = _core_getPonctuelsTresorerie(D, mk);
  return brut + tresorerie - charges - impots - _core_getDepensesMois(D, mk) - (D.params.chargesSalariales || 0);
}
function _core_getTauxHoraireMinCible(D) {
  const p = D.params;
  const hAn = (p.heuresParJour || 7) * (p.joursParSemaine || 4) * (p.semainesParAn || 44);
  if (hAn <= 0) return 0;
  const dep = _core_getDepensesMoyenneMensuelle(D) + (p.chargesAnnuellesCompl || 0) / 12 + (p.chargesSalariales || 0);
  if (_core_isSASU(D)) {
    const net = p.remunerationNette || 0, pct = p.coutRemunerationPct || 80;
    return (net * (1 + pct / 100) + dep) * 12 / hAn;
  }
  const r = 1 - _core_getTauxChargesPresta(D) - _core_getImpotsTaux(D);
  return r > 0 ? ((p.objectifNetMensuel || 0) + dep) / r * 12 / hAn : 0;
}

// ─────────────────────────────────────────────────────────────
// 3. JEUX DE DONNÉES
// ─────────────────────────────────────────────────────────────

// Jeu 1 — Freelance OBM standard, micro-bnc, sans TVA
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

// Jeu 2 — Mission récurrente (retainer mensuel)
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

// Jeu 3 — Récurrente terminée (nbMoisRec épuisé)
const D_RECURRENTE_TERMINEE = {
  ...D_FREELANCE_BASE,
  missions: [
    { id: 'rec', client: 'Retainer Fini', isManagement: false, isRecurring: true,
      dateDebutRec: '2026-01', nbMoisRec: 2, montantMensuel: 1000, montantDevis: 2000,
      statut: 'cours', dateFact: null, encaissements: [] },
  ],
};

// Jeu 4 — Activité mixte prestation + vente avec encaissements
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

// Jeu 5 — Dépenses : mensuelle, annuelle, ponctuelle sur plusieurs mois
const D_DEPENSES = {
  ...D_FREELANCE_BASE,
  missions: [],
  depenses: [
    { id: 'd1', date: '2026-02-01', libelle: 'Adobe', montant: 60, recurrence: 'mensuelle' },
    { id: 'd2', date: '2026-01-01', libelle: 'Comptable', montant: 1200, recurrence: 'annuelle' },
    { id: 'd3', date: '2026-06-20', libelle: 'Conf', montant: 300, recurrence: 'ponctuelle' },
    // mensuelle démarrée en mars — ne doit PAS apparaître en janvier/février
    { id: 'd4', date: '2026-03-01', libelle: 'Slack', montant: 8, recurrence: 'mensuelle' },
  ],
};

// Jeu 6 — Démarrage en mars (dateOuverture)
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

// Jeu 7 — SASU
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

// Jeu 8 — Encaissements fractionnés (acompte + solde)
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

// Jeu 9 — Récurrente + ponctuel ponctuels dans revenus
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

// Jeu 10 — Historique annuel (tous les mois)
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

// ─────────────────────────────────────────────────────────────
// 4. EXÉCUTION DES TESTS
// ─────────────────────────────────────────────────────────────

section('TVA & URSSAF — taux de charges');
test('getTauxChargesPresta micro-bnc',
  _orig_fl_getTauxChargesPresta(D_FREELANCE_BASE),
  _core_getTauxChargesPresta(D_FREELANCE_BASE));
test('getTauxChargesPresta micro-bic',
  _orig_fl_getTauxChargesPresta({ ...D_FREELANCE_BASE, params: { ...D_FREELANCE_BASE.params, statut: 'micro-bic', tauxURSSAF: 21.2, tauxCFP: 0.3 } }),
  _core_getTauxChargesPresta({ ...D_FREELANCE_BASE, params: { ...D_FREELANCE_BASE.params, statut: 'micro-bic', tauxURSSAF: 21.2, tauxCFP: 0.3 } }));
test('getTauxChargesPresta SASU → 0',
  _orig_fl_getTauxChargesPresta(D_SASU),
  _core_getTauxChargesPresta(D_SASU));
test('getTauxChargesVente activiteMixte micro-achat',
  _orig_fl_getTauxChargesVente(D_MIXTE),
  _core_getTauxChargesVente(D_MIXTE));
test('getTauxChargesVente hors mixte = getTauxChargesPresta',
  _orig_fl_getTauxChargesVente(D_FREELANCE_BASE),
  _core_getTauxChargesVente(D_FREELANCE_BASE));

section('getCaFromMissions — missions simples (Freelance)');
test('mission fact sans encaissement → dateFact mars',
  _orig_fl_getCaFromMissions(D_FREELANCE_BASE, '2026-03'),
  _core_getCaFromMissions(D_FREELANCE_BASE, '2026-03'));
test('mission fact sans encaissement → autre mois = 0',
  _orig_fl_getCaFromMissions(D_FREELANCE_BASE, '2026-04'),
  _core_getCaFromMissions(D_FREELANCE_BASE, '2026-04'));
test('mission avec encaissement → mois de l\'encaissement',
  _orig_fl_getCaFromMissions(D_FREELANCE_BASE, '2026-03'),
  _core_getCaFromMissions(D_FREELANCE_BASE, '2026-03'));

section('getCaFromMissions — missions récurrentes (Freelance)');
test('récurrente mois 0 (début)',
  _orig_fl_getCaFromMissions(D_RECURRENTE, '2026-01'),
  _core_getCaFromMissions(D_RECURRENTE, '2026-01'));
test('récurrente mois 2 (milieu)',
  _orig_fl_getCaFromMissions(D_RECURRENTE, '2026-03'),
  _core_getCaFromMissions(D_RECURRENTE, '2026-03'));
test('récurrente mois 5 (dernier, nbMoisRec=6)',
  _orig_fl_getCaFromMissions(D_RECURRENTE, '2026-06'),
  _core_getCaFromMissions(D_RECURRENTE, '2026-06'));
test('récurrente mois 6 (hors période) → 0',
  _orig_fl_getCaFromMissions(D_RECURRENTE, '2026-07'),
  _core_getCaFromMissions(D_RECURRENTE, '2026-07'));
test('récurrente terminée (nbMoisRec=2) — mois 1 ok',
  _orig_fl_getCaFromMissions(D_RECURRENTE_TERMINEE, '2026-01'),
  _core_getCaFromMissions(D_RECURRENTE_TERMINEE, '2026-01'));
test('récurrente terminée (nbMoisRec=2) — mois 2 ok',
  _orig_fl_getCaFromMissions(D_RECURRENTE_TERMINEE, '2026-02'),
  _core_getCaFromMissions(D_RECURRENTE_TERMINEE, '2026-02'));
test('récurrente terminée (nbMoisRec=2) — mois 3 = 0',
  _orig_fl_getCaFromMissions(D_RECURRENTE_TERMINEE, '2026-03'),
  _core_getCaFromMissions(D_RECURRENTE_TERMINEE, '2026-03'));
test('récurrente + ponctuel même mois',
  _orig_fl_getCaFromMissions(D_RECURRENTE, '2026-03'),
  _core_getCaFromMissions(D_RECURRENTE, '2026-03'));

section('getCaFromMissions — encaissements fractionnés');
test('acompte 50% en mars',
  _orig_fl_getCaFromMissions(D_ENCAISSEMENTS_FRACTIONNES, '2026-03'),
  _core_getCaFromMissions(D_ENCAISSEMENTS_FRACTIONNES, '2026-03'));
test('solde 50% en avril',
  _orig_fl_getCaFromMissions(D_ENCAISSEMENTS_FRACTIONNES, '2026-04'),
  _core_getCaFromMissions(D_ENCAISSEMENTS_FRACTIONNES, '2026-04'));

section('getCaFromMissions — Artisan (pas de récurrentes dans getCaFromMissions)');
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
test('artisan — acompte mai',
  _orig_ar_getCaFromMissions(D_ARTISAN, '2026-05'),
  _core_getCaFromMissions(D_ARTISAN, '2026-05'));
test('artisan — solde juin',
  _orig_ar_getCaFromMissions(D_ARTISAN, '2026-06'),
  _core_getCaFromMissions(D_ARTISAN, '2026-06'));

// Copie exacte de la getCaBreakdownMois ARTISAN (clés {prestation, vente, total} —
// différentes de la version Freelance {presta, vente}). On compare les VALEURS
// numériques uniquement, pas les clés, pour documenter la divergence de shape.
function _orig_ar_getCaBreakdownMois(D, mk) {
  if (!D.params.activiteMixte) {
    const total = _orig_ar_getCaFromMissions(D, mk) + _orig_fl_getPonctuelsCA(D, mk);
    return { prestation: total, vente: 0, total };
  }
  let mP = 0, mV = 0;
  D.missions.filter(m => !m.isManagement && !m.isRecurring && (m.encaissements || []).length > 0)
    .forEach(m => {
      const montant = (m.encaissements || []).filter(e => e.date && _orig_getMonthKey(e.date) === mk)
        .reduce((s, e) => s + (e.montant || 0), 0);
      if (!montant) return;
      const vr = _orig_fl_getMissionVenteRatio(D, m);
      mV += montant * vr; mP += montant * (1 - vr);
    });
  D.missions.filter(m => !m.isManagement && !m.isRecurring && (m.encaissements || []).length === 0 && m.statut === 'fact' && m.dateFact && _orig_getMonthKey(m.dateFact) === mk)
    .forEach(m => {
      const tot = m.montantDevis || 0, v = m.montantVente != null ? m.montantVente : 0;
      mV += v; mP += (tot - v);
    });
  const prestation = mP + _orig_fl_getPonctuelsPresta(D, mk);
  const vente = mV + _orig_fl_getPonctuelsVente(D, mk);
  return { prestation, vente, total: prestation + vente };
}
test('artisan breakdown — presta (clé "prestation") = core "presta" mixte avril',
  _orig_ar_getCaBreakdownMois(D_MIXTE, '2026-04').prestation,
  _core_getCaBreakdownMois(D_MIXTE, '2026-04').presta);
test('artisan breakdown — vente = core vente mixte avril',
  _orig_ar_getCaBreakdownMois(D_MIXTE, '2026-04').vente,
  _core_getCaBreakdownMois(D_MIXTE, '2026-04').vente);
test('artisan breakdown — presta mai (encaissement fractionné)',
  _orig_ar_getCaBreakdownMois(D_MIXTE, '2026-05').prestation,
  _core_getCaBreakdownMois(D_MIXTE, '2026-05').presta);

section('Activité mixte — getCaBreakdownMois');
test('mixte avril — presta (sans encaissement)',
  _orig_fl_getCaBreakdownMois(D_MIXTE, '2026-04').presta,
  _core_getCaBreakdownMois(D_MIXTE, '2026-04').presta);
test('mixte avril — vente (sans encaissement)',
  _orig_fl_getCaBreakdownMois(D_MIXTE, '2026-04').vente,
  _core_getCaBreakdownMois(D_MIXTE, '2026-04').vente);
test('mixte avril — presta avec encaissement partiel',
  _orig_fl_getCaBreakdownMois(D_MIXTE, '2026-04').presta,
  _core_getCaBreakdownMois(D_MIXTE, '2026-04').presta);
test('mixte mai — vente issue de l\'encaissement restant',
  _orig_fl_getCaBreakdownMois(D_MIXTE, '2026-05').vente,
  _core_getCaBreakdownMois(D_MIXTE, '2026-05').vente);

section('Dépenses');
test('dépense mensuelle — janvier (départ jan)',
  _orig_fl_getDepensesMois(D_DEPENSES, '2026-01'),
  _core_getDepensesMois(D_DEPENSES, '2026-01'));
test('dépense mensuelle — mars (inclut Adobe démarré fév)',
  _orig_fl_getDepensesMois(D_DEPENSES, '2026-03'),
  _core_getDepensesMois(D_DEPENSES, '2026-03'));
test('dépense annuelle — janvier (mois du début)',
  _orig_fl_getDepensesMois(D_DEPENSES, '2026-01'),
  _core_getDepensesMois(D_DEPENSES, '2026-01'));
test('dépense annuelle — mars (pas de compta en mars)',
  _orig_fl_getDepensesMois(D_DEPENSES, '2026-03'),
  _core_getDepensesMois(D_DEPENSES, '2026-03'));
test('dépense ponctuelle — juin',
  _orig_fl_getDepensesMois(D_DEPENSES, '2026-06'),
  _core_getDepensesMois(D_DEPENSES, '2026-06'));
test('dépense ponctuelle — juillet = 0',
  _orig_fl_getDepensesMois(D_DEPENSES, '2026-07'),
  _core_getDepensesMois(D_DEPENSES, '2026-07'));
test('dépense mensuelle démarrée en mars — absente en janvier',
  _orig_fl_getDepensesMois(D_DEPENSES, '2026-01'),
  _core_getDepensesMois(D_DEPENSES, '2026-01'));
test('dépense mensuelle démarrée en mars — présente en mars',
  _orig_fl_getDepensesMois(D_DEPENSES, '2026-03'),
  _core_getDepensesMois(D_DEPENSES, '2026-03'));
test('getDepensesMoyenneMensuelle exclut ponctuelles',
  _orig_fl_getDepensesMoyenneMensuelle(D_DEPENSES),
  _core_getDepensesMoyenneMensuelle(D_DEPENSES));

section('Ouverture en cours d\'année (dateOuverture mars)');
test('mois avant ouverture → CA = 0',
  _orig_fl_getCaFromMissions(D_OUVERTURE_MARS, '2026-02'),
  _core_getCaFromMissions(D_OUVERTURE_MARS, '2026-02'));
test('mois avant ouverture → dépenses = 0',
  _orig_fl_getDepensesMois(D_OUVERTURE_MARS, '2026-02'),
  _core_getDepensesMois(D_OUVERTURE_MARS, '2026-02'));
test('mois après ouverture → CA ok',
  _orig_fl_getCaFromMissions(D_OUVERTURE_MARS, '2026-04'),
  _core_getCaFromMissions(D_OUVERTURE_MARS, '2026-04'));
test('getActiveMonthsInYear ouverture mars → 10',
  _orig_fl_getActiveMonthsInYear(D_OUVERTURE_MARS),
  _core_getActiveMonthsInYear(D_OUVERTURE_MARS));

section('Taux horaire minimum');
test('TH min micro-bnc standard',
  Math.round(_orig_fl_getTauxHoraireMinCible(D_FREELANCE_BASE) * 100) / 100,
  Math.round(_core_getTauxHoraireMinCible(D_FREELANCE_BASE) * 100) / 100);
test('TH min ouverture en mars (lissage dépenses sur 10 mois)',
  Math.round(_orig_fl_getTauxHoraireMinCible(D_OUVERTURE_MARS) * 100) / 100,
  Math.round(_core_getTauxHoraireMinCible(D_OUVERTURE_MARS) * 100) / 100);
test('TH min SASU',
  Math.round(_orig_fl_getTauxHoraireMinCible(D_SASU) * 100) / 100,
  Math.round(_core_getTauxHoraireMinCible(D_SASU) * 100) / 100);

section('Revenu net mensuel');
test('revenu net mars — récurrente + ponctuel',
  Math.round(_orig_fl_getRevenuNetMois(D_RECURRENTE, '2026-03') * 100) / 100,
  Math.round(_core_getRevenuNetMois(D_RECURRENTE, '2026-03') * 100) / 100);
test('revenu net avril — mixte',
  Math.round(_orig_fl_getRevenuNetMois(D_MIXTE, '2026-04') * 100) / 100,
  Math.round(_core_getRevenuNetMois(D_MIXTE, '2026-04') * 100) / 100);
test('revenu net mois avant ouverture → 0',
  _orig_fl_getRevenuNetMois(D_OUVERTURE_MARS, '2026-02'),
  _core_getRevenuNetMois(D_OUVERTURE_MARS, '2026-02'));
test('revenu net avec ponctuels hors-CA (trésorerie)',
  Math.round(_orig_fl_getRevenuNetMois(D_AVEC_PONCTUELS, '2026-03') * 100) / 100,
  Math.round(_core_getRevenuNetMois(D_AVEC_PONCTUELS, '2026-03') * 100) / 100);

section('Historique annuel — 12 mois');
const mois2026 = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
let caAnnuelOrig = 0, caAnnuelCore = 0, rnAnnuelOrig = 0, rnAnnuelCore = 0;
mois2026.forEach(mk => {
  const o = _orig_fl_getCaFromMissions(D_HISTORIQUE, mk);
  const c = _core_getCaFromMissions(D_HISTORIQUE, mk);
  caAnnuelOrig += o; caAnnuelCore += c;
  test(`CA ${mk}`, o, c);
  const rno = Math.round(_orig_fl_getRevenuNetMois(D_HISTORIQUE, mk) * 100) / 100;
  const rnc = Math.round(_core_getRevenuNetMois(D_HISTORIQUE, mk) * 100) / 100;
  rnAnnuelOrig += rno; rnAnnuelCore += rnc;
  test(`Revenu net ${mk}`, rno, rnc);
});
test('CA annuel total cohérent',
  Math.round(caAnnuelOrig), Math.round(caAnnuelCore));
test('Revenu net annuel total cohérent',
  Math.round(rnAnnuelOrig * 100) / 100, Math.round(rnAnnuelCore * 100) / 100);

// ─────────────────────────────────────────────────────────────
// 5. RAPPORT
// ─────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(72));
console.log('RAPPORT DE VALIDATION — core/calculs.js vs fonctions originales');
console.log('═'.repeat(72) + '\n');

let currentSection = '';
results.forEach(r => {
  if (r.status === 'SECTION') {
    console.log(`\n── ${r.label} ${'─'.repeat(Math.max(0, 60 - r.label.length))}`);
    return;
  }
  const icon = r.status === 'PASS' ? '✅' : '❌';
  const line = `${icon} ${r.label}`;
  if (r.status === 'PASS') {
    console.log(`  ${line}`);
  } else {
    console.log(`\n  ${line}`);
    console.log(`      orig : ${JSON.stringify(r.orig)}`);
    console.log(`      core : ${JSON.stringify(r.core)}`);
    if (r.note) console.log(`      note : ${r.note}`);
    console.log('');
  }
});

console.log('\n' + '═'.repeat(72));
console.log(`RÉSULTAT : ${PASS} PASS  |  ${FAIL} FAIL  |  ${WARN} WARN`);
console.log(`Total : ${PASS + FAIL} tests`);
if (FAIL === 0) {
  console.log('\n✅ VALIDATION RÉUSSIE — core/calculs.js est aligné sur les originaux.');
  console.log('   La branche peut passer en Phase 2 sous réserve de validation manuelle.');
} else {
  console.log(`\n❌ VALIDATION ÉCHOUÉE — ${FAIL} écart(s) détecté(s).`);
  console.log('   Corriger calculs.js avant toute substitution dans les HTML.');
}
console.log('═'.repeat(72) + '\n');
