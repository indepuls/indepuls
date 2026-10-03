// ── FUSION À TROIS VOIES DE DEUX VERSIONS D'UN MÊME COMPTE (palier A, écriture partagée) ───────
// Fonction pure, sans aucun effet de bord, jamais appelée par l'application pour l'instant
// (étape 1 du chantier "écriture par les membres", 2026-10-02) : elle ne change donc le
// comportement d'aucun compte tant qu'elle n'est pas branchée.
//
// Problème résolu : un compte est stocké comme UN SEUL bloc JSON, réécrit en entier à chaque
// sauvegarde ("le dernier qui écrit gagne"). Quand deux personnes modifient le même compte, la
// seconde sauvegarde effacerait le travail de la première. La fusion à trois voies compare :
//   base   : la version que nous avions TOUS LES DEUX au départ (dernière version synchronisée)
//   mine   : ma version, avec mes modifications
//   theirs : la version actuellement enregistrée, avec les modifications de l'autre personne
// et en tire une version qui conserve les modifications des deux, élément par élément.
//
// Règles (résumé) :
//  - Une valeur modifiée d'un seul côté : la modification est conservée.
//  - Les objets se fusionnent clé par clé, les listes d'objets AYANT un `id` élément par élément
//    (missions, dépenses, encaissements, temps manuels, notes...).
//  - Les autres listes (textes, créneaux de calendrier sans id) se fusionnent par CONTENU
//    (ajouts et suppressions des deux côtés conservés, doublons évités).
//  - Vrai conflit (même valeur modifiée des deux côtés, différemment) : ma version l'emporte et le
//    conflit est RAPPORTÉ dans `conflits`, pour pouvoir en informer la personne (zéro boîte noire).
//  - Supprimé d'un côté mais modifié de l'autre : la version MODIFIÉE est conservée (jamais de
//    perte silencieuse de travail) et le conflit est rapporté.
//  - Aucune des trois entrées n'est jamais modifiée.
//
// Cas particulier, additif : le temps interne d'un mois (`tempsInterne[mois]`, un total en ms) est un
// COMPTEUR. Si deux personnes y ajoutent du temps en même temps, ce n'est pas un conflit : les deux
// ajouts s'additionnent (base + ajout de moi + ajout de l'autre, jamais sous zéro). Sans changer la
// structure du champ, que le moteur de calcul lit partout tel quel.

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function copie(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

// Même contenu, quel que soit l'ordre des clés d'un objet.
function canonique(v) {
  if (Array.isArray(v)) return v.map(canonique);
  if (estObjet(v)) {
    const o = {};
    Object.keys(v).sort().forEach((k) => { o[k] = canonique(v[k]); });
    return o;
  }
  return v;
}

export function egal(a, b) {
  return JSON.stringify(canonique(a)) === JSON.stringify(canonique(b));
}

const cle = (x) => JSON.stringify(canonique(x));

// Champs internes à la session, jamais fusionnés : toujours ceux de ma version.
export const CHAMPS_VOLATILS = ['_ownerUid', '_needsProfilePick', '_lectureSeule', '_pendingMigration'];

function fusionner3(base, mine, theirs, chemin, ctx) {
  if (egal(mine, theirs)) return copie(mine);   // même résultat des deux côtés
  if (egal(mine, base)) return copie(theirs);   // je n'ai rien changé ici : je prends la leur
  if (egal(theirs, base)) return copie(mine);   // l'autre n'a rien changé ici : je garde la mienne

  // Les deux côtés ont changé, différemment.
  // Supprimé d'un côté, modifié de l'autre : on garde la version modifiée.
  if (mine === undefined) {
    ctx.conflits.push({ chemin, type: 'supprime-puis-modifie', cote: 'moi', miennes: undefined, autre: copie(theirs), resolution: 'autre' });
    return copie(theirs);
  }
  if (theirs === undefined) {
    ctx.conflits.push({ chemin, type: 'supprime-puis-modifie', cote: 'autre', miennes: copie(mine), autre: undefined, resolution: 'mienne' });
    return copie(mine);
  }
  if (estObjet(mine) && estObjet(theirs)) {
    return fusionnerObjets(estObjet(base) ? base : {}, mine, theirs, chemin, ctx);
  }
  if (Array.isArray(mine) && Array.isArray(theirs)) {
    return fusionnerTableaux(Array.isArray(base) ? base : [], mine, theirs, chemin, ctx);
  }
  // Compteur de temps interne d'un mois : on additionne les deux variations, pas de conflit.
  if (/^(\.personnes\.[^.]+)?\.tempsInterne\.[\d-]+$/.test(chemin) && typeof mine === 'number' && typeof theirs === 'number') {
    const b = typeof base === 'number' ? base : 0;
    return Math.max(0, b + (mine - b) + (theirs - b));
  }
  // Valeur simple (ou types différents) modifiée des deux côtés : vrai conflit, ma version l'emporte.
  ctx.conflits.push({ chemin, type: 'valeur', miennes: copie(mine), autre: copie(theirs), resolution: 'mienne' });
  return copie(mine);
}

function fusionnerObjets(base, mine, theirs, chemin, ctx) {
  const resultat = {};
  const cles = [];
  const vu = new Set();
  [theirs, mine, base].forEach((o) => Object.keys(o).forEach((k) => { if (!vu.has(k)) { vu.add(k); cles.push(k); } }));
  cles.forEach((k) => {
    const v = fusionner3(base[k], mine[k], theirs[k], chemin + '.' + k, ctx);
    if (v !== undefined) resultat[k] = v;
  });
  return resultat;
}

function toutesAvecId(...tableaux) {
  return tableaux.every((t) => t.every((x) => estObjet(x) && x.id !== undefined && x.id !== null));
}

function fusionnerTableaux(base, mine, theirs, chemin, ctx) {
  return toutesAvecId(base, mine, theirs)
    ? fusionnerParId(base, mine, theirs, chemin, ctx)
    : fusionnerParContenu(base, mine, theirs);
}

// Éléments identifiés : chacun est fusionné séparément. Ordre : celui de la version enregistrée
// (la plus récente), puis mes ajouts.
function fusionnerParId(base, mine, theirs, chemin, ctx) {
  const index = (t) => new Map(t.map((x) => [String(x.id), x]));
  const iB = index(base), iM = index(mine), iT = index(theirs);
  const ordre = [];
  const vu = new Set();
  [theirs, mine].forEach((t) => t.forEach((x) => { const id = String(x.id); if (!vu.has(id)) { vu.add(id); ordre.push(id); } }));
  const resultat = [];
  ordre.forEach((id) => {
    const b = iB.get(id), m = iM.get(id), t = iT.get(id);
    const chem = chemin + '[' + id + ']';
    if (m !== undefined && t !== undefined) {
      const v = fusionner3(b, m, t, chem, ctx);
      if (v !== undefined) resultat.push(v);
    } else if (m !== undefined) {            // absent de la version enregistrée
      if (b === undefined) resultat.push(copie(m));                       // ajouté par moi
      else if (egal(m, b)) { /* supprimé par l'autre, non modifié par moi : suppression conservée */ }
      else {
        ctx.conflits.push({ chemin: chem, element: id, type: 'supprime-puis-modifie', cote: 'autre', miennes: copie(m), autre: undefined, resolution: 'mienne' });
        resultat.push(copie(m));
      }
    } else {                                 // absent de ma version
      if (b === undefined) resultat.push(copie(t));                       // ajouté par l'autre
      else if (egal(t, b)) { /* supprimé par moi, non modifié par l'autre : suppression conservée */ }
      else {
        ctx.conflits.push({ chemin: chem, element: id, type: 'supprime-puis-modifie', cote: 'moi', miennes: undefined, autre: copie(t), resolution: 'autre' });
        resultat.push(copie(t));
      }
    }
  });
  return resultat;
}

// Éléments sans identifiant (textes, créneaux de calendrier) : fusion par contenu. Un élément
// modifié compte comme "supprimé puis ajouté". Le nombre d'exemplaires est borné pour ne pas
// dupliquer un élément ajouté à l'identique des deux côtés.
function fusionnerParContenu(base, mine, theirs) {
  const compter = (t) => { const m = new Map(); t.forEach((x) => { const k = cle(x); m.set(k, (m.get(k) || 0) + 1); }); return m; };
  const cB = compter(base), cM = compter(mine), cT = compter(theirs);
  const restant = new Map();
  new Set([...cB.keys(), ...cM.keys(), ...cT.keys()]).forEach((k) => {
    const b = cB.get(k) || 0, m = cM.get(k) || 0, t = cT.get(k) || 0;
    restant.set(k, Math.max(0, Math.min(m + t - b, Math.max(m, t))));
  });
  const resultat = [];
  const emettre = (x) => {
    const k = cle(x);
    const r = restant.get(k);
    if (r > 0) { resultat.push(copie(x)); restant.set(k, r - 1); }
  };
  theirs.forEach(emettre);
  mine.forEach(emettre);
  return resultat;
}

// base, mine, theirs : trois versions complètes d'un compte (objets DATA).
// Retourne { fusion, conflits, differeDeLaMienne, differeDeLAutre }
//  - fusion            : la version fusionnée, à enregistrer
//  - conflits          : liste des vrais conflits résolus (vide dans le cas courant)
//  - differeDeLaMienne : vrai si la fusion contient des choses que je n'avais pas (modifs de l'autre)
//  - differeDeLAutre   : vrai si la fusion contient des choses que la version enregistrée n'a pas
//                        (mes modifs : il y a bien quelque chose à enregistrer)
export function fusionnerDonnees(base, mine, theirs) {
  const ctx = { conflits: [] };
  const fusion = fusionner3(base, mine, theirs, '', ctx);
  CHAMPS_VOLATILS.forEach((k) => {
    if (mine && Object.prototype.hasOwnProperty.call(mine, k)) fusion[k] = copie(mine[k]);
    else if (fusion) delete fusion[k];
  });
  return {
    fusion,
    conflits: ctx.conflits,
    differeDeLaMienne: !egal(fusion, mine),
    differeDeLAutre: !egal(fusion, theirs),
  };
}
