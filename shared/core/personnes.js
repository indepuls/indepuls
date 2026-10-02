// ── RÉGLAGES INDIVIDUELS D'UN COMPTE PARTAGÉ : capacité de travail et congés ──────────────────
// (2026-10-02, chantier multi-associés). Fonctions PURES, aucune dépendance, jamais appelées hors
// compte partagé (window._partage) : un compte solo ne passe par aucune d'elles.
//
// Principe : les réglages d'un compte partagé (DATA.params) sont communs à tout le monde. Trois
// d'entre eux, plus la liste de congés, sont en réalité PERSONNELS : heures par jour, jours par
// semaine, semaines par an, congés. Plutôt que de toucher aux ~100 endroits qui les lisent, chaque
// personne travaille sur "ses" valeurs dans DATA.params / DATA.conges (le moteur et l'interface ne
// voient aucune différence), et la version enregistrée dans le cloud les range par personne :
//     cloud.personnes[idPersonne] = { heuresParJour, joursParSemaine, semainesParAn, conges }
// pendant que cloud.params.* et cloud.conges restent à leur valeur commune d'origine (jamais
// modifiée par personne : aucun conflit possible entre deux associé·es).
//   versLocal(cloud, moi, estProprietaire) : cloud -> données de travail de la personne `moi`
//   versCloud(local, moi, communes)        : données de travail -> version à enregistrer
//   getDataVueCombinee(DATA, moi)          : "tout le compte" = capacités ADDITIONNÉES, congés = jours
//                                            où TOUT LE MONDE est absent
//   surchargePersonne(DATA, id, moi)       : réglages d'UNE personne, pour la vue par personne

export const CHAMPS_CAPACITE = ['heuresParJour', 'joursParSemaine', 'semainesParAn'];

const copie = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// Valeurs communes (celles de l'enregistrement cloud, avant toute projection).
export function valeursCommunes(cloud) {
  const p = (cloud && cloud.params) || {};
  const communes = { conges: copie((cloud && cloud.conges) || []) };
  CHAMPS_CAPACITE.forEach((k) => { if (p[k] !== undefined) communes[k] = p[k]; });
  return communes;
}

export function versLocal(cloud, moi, estProprietaire) {
  const local = copie(cloud);
  if (!local.params) local.params = {};
  const pe = local.personnes && local.personnes[moi];
  if (pe) {
    CHAMPS_CAPACITE.forEach((k) => { if (pe[k] !== undefined) local.params[k] = pe[k]; });
    local.conges = Array.isArray(pe.conges) ? copie(pe.conges) : (estProprietaire ? (local.conges || []) : []);
  } else {
    // Première fois : le propriétaire garde ce qu'il avait, une nouvelle personne part sans congés
    // (ceux déjà saisis dans le compte sont ceux du propriétaire) et avec les capacités communes.
    local.conges = estProprietaire ? (local.conges || []) : [];
  }
  return local;
}

export function versCloud(local, moi, communes) {
  const c = copie(local);
  c.personnes = Object.assign({}, c.personnes || {});
  const pe = {};
  CHAMPS_CAPACITE.forEach((k) => { if (local.params && local.params[k] !== undefined) pe[k] = local.params[k]; });
  pe.conges = copie(local.conges || []);
  c.personnes[moi] = pe;
  if (!c.params) c.params = {};
  CHAMPS_CAPACITE.forEach((k) => { if (communes && communes[k] !== undefined) c.params[k] = communes[k]; else delete c.params[k]; });
  c.conges = copie((communes && communes.conges) || []);
  return c;
}

// Réglages à jour de chaque personne : la mienne vient des valeurs vivantes (DATA.params/conges),
// celles des autres de DATA.personnes.
function reglagesParPersonne(DATA, moi) {
  const res = Object.assign({}, DATA.personnes || {});
  if (moi) {
    const pe = {};
    CHAMPS_CAPACITE.forEach((k) => { if (DATA.params && DATA.params[k] !== undefined) pe[k] = DATA.params[k]; });
    pe.conges = DATA.conges || [];
    res[moi] = pe;
  }
  return res;
}

const jourFin = (c) => c.fin || c.debut;

export function intersecterConges(a, b) {
  const res = [];
  (a || []).forEach((x) => (b || []).forEach((y) => {
    const debut = x.debut > y.debut ? x.debut : y.debut;
    const fx = jourFin(x), fy = jourFin(y);
    const fin = fx < fy ? fx : fy;
    if (debut <= fin) res.push({ id: 'commun-' + debut + '-' + fin, debut, fin });
  }));
  return res.sort((p, q) => (p.debut < q.debut ? -1 : 1));
}

export function getDataVueCombinee(DATA, moi) {
  const reglages = reglagesParPersonne(DATA, moi);
  const gens = Object.keys(reglages).map((k) => reglages[k])
    .filter((r) => r.heuresParJour > 0 && r.joursParSemaine > 0);
  if (gens.length < 2) return DATA;
  const spa = (DATA.params && DATA.params.semainesParAn) || 44;
  const hpj = gens.reduce((s, r) => s + r.heuresParJour, 0);
  const heuresAn = gens.reduce((s, r) => s + r.heuresParJour * r.joursParSemaine * (r.semainesParAn || spa), 0);
  const jps = heuresAn / (hpj * spa);
  let conges = gens[0].conges || [];
  for (let i = 1; i < gens.length; i++) conges = intersecterConges(conges, gens[i].conges || []);
  return {
    ...DATA,
    params: { ...DATA.params, heuresParJour: hpj, joursParSemaine: jps, semainesParAn: spa },
    conges,
  };
}

export function surchargePersonne(DATA, id, moi) {
  const r = reglagesParPersonne(DATA, moi)[id];
  if (!r) return {};
  const params = { ...DATA.params };
  CHAMPS_CAPACITE.forEach((k) => { if (r[k] !== undefined) params[k] = r[k]; });
  return { params, conges: Array.isArray(r.conges) ? r.conges : [] };
}
