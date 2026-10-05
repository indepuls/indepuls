// ── SAUVEGARDE D'UN COMPTE PARTAGÉ : enregistrer / rafraîchir sans jamais écraser l'autre ──────
// (étape 2 du chantier "écriture par les membres", 2026-10-02)
//
// Toute la logique de concurrence est ici, SANS aucun accès réseau : la lecture et l'écriture sont
// reçues en paramètres (`lire`, `ecrire`). L'application leur branche Supabase, les tests leur
// branchent une fausse base où des modifications concurrentes arrivent à n'importe quel moment.
//
// Principe : "compare-and-swap" sur l'horodatage de la version enregistrée.
//   1. On tente d'écrire ma version en exigeant que la version enregistrée soit encore celle que
//      je connais (`ecrire(donnees, updatedAtAttendu)` ne réussit que si rien n'a changé).
//   2. Si quelqu'un a enregistré entre-temps, on relit la version actuelle, on FUSIONNE (voir
//      fusion.js) ma version avec la sienne, puis on retente d'écrire la fusion, en exigeant à
//      nouveau que rien n'ait changé. On recommence tant que d'autres écrivent en même temps, dans
//      la limite de `maxEssais`. Jamais d'écriture "à l'aveugle".
//   3. En cas d'échec définitif, RIEN n'est écrit : la version fusionnée est rendue à l'appelant
//      pour qu'il retente plus tard, aucune modification n'est perdue.
//
// Contrat des paramètres :
//   lire()                          -> { data, updatedAt } | null   (null : accès perdu)
//   ecrire(donnees, updatedAtAttendu) -> { ok: true, updatedAt } | { ok: false }
//   normaliser(data)                -> donnees complétées (migrate + applyDefaults) : appliqué à
//                                      toute version lue, pour comparer des choses comparables.

import { fusionnerDonnees, egal } from './fusion.js';

const copie = (v) => JSON.parse(JSON.stringify(v));

// Horodatage strictement postérieur à celui connu : la détection de changement par les autres
// repose sur l'égalité de `updated_at`, deux écritures ne doivent jamais lui donner la même valeur.
export function horodatageSuivant(connu, maintenant = new Date()) {
  let t = maintenant.getTime();
  const c = connu ? Date.parse(connu) : NaN;
  if (!Number.isNaN(c) && t <= c) t = c + 1;
  return new Date(t).toISOString();
}

async function fusionnerEtEcrire({ mine, base, lire, ecrire, normaliser, maxEssais, premierDernier }) {
  let courantMine = mine;
  let courantBase = base;
  let conflits = [];
  for (let essai = 1; essai <= maxEssais; essai++) {
    const dernier = (essai === 1 && premierDernier) ? premierDernier : await lire();
    if (!dernier || dernier.data === null || dernier.data === undefined) {
      return { etat: 'acces-perdu', donnees: courantMine, base: courantBase, conflits };
    }
    const theirs = normaliser(dernier.data);
    const r = fusionnerDonnees(courantBase, courantMine, theirs);
    conflits = conflits.concat(r.conflits);
    const fusion = normaliser(r.fusion);
    const repris = !egal(fusion, mine);   // la fusion contient des choses que je n'avais pas
    if (egal(fusion, theirs)) {
      // La version enregistrée contient déjà tout ce que j'ai : rien à écrire.
      return { etat: 'a-jour', donnees: fusion, base: theirs, updatedAt: dernier.updatedAt, conflits, repris };
    }
    const res = await ecrire(fusion, dernier.updatedAt);
    if (res.ok) {
      return { etat: 'enregistre', donnees: fusion, base: copie(fusion), updatedAt: res.updatedAt, conflits, repris };
    }
    // Quelqu'un d'autre a écrit pendant ma fusion : on repart de ma fusion, avec la version
    // qu'elle venait d'absorber comme nouvelle base.
    courantMine = fusion;
    courantBase = theirs;
  }
  return { etat: 'echec-concurrence', donnees: courantMine, base: courantBase, conflits };
}

// Enregistre mes modifications. Chemin rapide : un seul aller-retour quand personne d'autre n'a écrit.
export async function enregistrerPartage({ mine, base, updatedAt, lire, ecrire, normaliser, maxEssais = 6 }) {
  if (egal(mine, base)) return { etat: 'inchange', donnees: mine, base, updatedAt, conflits: [] };
  const direct = await ecrire(mine, updatedAt);
  if (direct.ok) return { etat: 'enregistre', donnees: mine, base: copie(mine), updatedAt: direct.updatedAt, conflits: [], repris: false };
  return fusionnerEtEcrire({ mine, base, lire, ecrire, normaliser, maxEssais });
}

// Va chercher les modifications des autres. N'écrit que si j'ai moi-même des modifications pas
// encore enregistrées (qui sont alors fusionnées et enregistrées comme ci-dessus).
export async function rafraichirPartage({ mine, base, updatedAt, lire, ecrire, normaliser, maxEssais = 6 }) {
  const dernier = await lire();
  if (!dernier || dernier.data === null || dernier.data === undefined) {
    return { etat: 'acces-perdu', donnees: mine, base, updatedAt, conflits: [] };
  }
  if (dernier.updatedAt === updatedAt) return { etat: 'inchange', donnees: mine, base, updatedAt, conflits: [] };
  return fusionnerEtEcrire({ mine, base, lire, ecrire, normaliser, maxEssais, premierDernier: dernier });
}

// ── Message à la personne, UNIQUEMENT en cas de vrai conflit ("zéro boîte noire") ─────────────
const LIBELLES_CHAMPS = {
  montantDevis: 'le montant', statut: 'le statut', client: 'le client', description: 'la description',
  dateFact: 'la date de facturation', montant: 'le montant', libelle: 'le libellé', date: 'la date',
  nom: 'le nom', chargeEstimee: 'le temps estimé', heuresSaisies: 'les heures saisies',
};

function abreger(v) {
  if (v === undefined) return 'supprimé';
  if (v === null) return 'vide';
  if (typeof v === 'object') return '…';
  const s = String(v);
  return s.length > 40 ? s.slice(0, 37) + '…' : s;
}

function libelleElement(donnees, collection, id) {
  const liste = (donnees && donnees[collection]) || [];
  const x = liste.find((e) => String(e.id) === String(id));
  if (!x) return null;
  return x.client || x.nom || x.libelle || x.titre || null;
}

// Retourne une phrase par conflit. `donnees` : version fusionnée (pour retrouver les noms).
// pointDeVue 'moi' : la personne dont la sauvegarde a fusionné (sa version est gardée).
// pointDeVue 'autre' : l'autre personne, dont la version a été remplacée (elle voit la phrase à son
// prochain rafraîchissement : même conflit, vu de l'autre côté).
// Champs d'une mission qui se recalculent à partir du montant : une seule modification du montant les change
// tous ensemble. Ils ne sont pas annoncés à part (sinon un seul conflit s'affiche comme deux).
const CHAMPS_DERIVES_DU_MONTANT = ['montantPrestation', 'montantVente'];

function sansDoublonsDerives(conflits) {
  const liste = conflits || [];
  const avecMontant = new Set(liste.map((c) => (c.chemin || '').match(/^(\.missions\[[^\]]+\])\.montantDevis$/)).filter(Boolean).map((m) => m[1]));
  return liste.filter((c) => {
    const m = (c.chemin || '').match(/^(\.missions\[[^\]]+\])\.(\w+)$/);
    return !(m && CHAMPS_DERIVES_DU_MONTANT.includes(m[2]) && avecMontant.has(m[1]));
  });
}

export function decrireConflits(conflits, donnees, pointDeVue = 'moi') {
  const autreCote = pointDeVue === 'autre';
  const phrases = sansDoublonsDerives(conflits).map((c) => {
    const chemin = c.chemin || '';
    let quoi = chemin;
    let m = chemin.match(/^\.missions\[([^\]]+)\](?:\.(\w+))?/);
    if (m) {
      const nom = libelleElement(donnees, 'missions', m[1]);
      quoi = (nom ? '« ' + nom + ' »' : 'Une mission') + (m[2] ? ' : ' + (LIBELLES_CHAMPS[m[2]] || m[2]) : '');
    } else if ((m = chemin.match(/^\.depenses\[([^\]]+)\](?:\.(\w+))?/))) {
      const nom = libelleElement(donnees, 'depenses', m[1]);
      quoi = 'Dépense ' + (nom ? '« ' + nom + ' »' : '') + (m[2] ? ' : ' + (LIBELLES_CHAMPS[m[2]] || m[2]) : '');
    } else if ((m = chemin.match(/^\.params\.(\w+)/))) {
      quoi = 'Paramètre « ' + m[1] + ' »';
    } else if ((m = chemin.match(/^\.tempsInterne\.([\d-]+)/))) {
      quoi = 'Temps interne de ' + m[1];
    } else if ((m = chemin.match(/^\.revenus\.([\d-]+)/))) {
      quoi = 'Revenus de ' + m[1];
    }
    quoi = quoi.trim();
    if (c.type === 'supprime-puis-modifie') {
      return (autreCote ? c.cote !== 'moi' : c.cote === 'moi')
        ? quoi + ' : vous l\'aviez supprimé pendant qu\'une autre personne le modifiait. La version modifiée a été conservée.'
        : quoi + ' : une autre personne l\'a supprimé pendant que vous le modifiiez. Votre version modifiée a été conservée.';
    }
    if (autreCote) {
      return quoi + ' : vous et une autre personne avez modifié la même chose en même temps (' + abreger(c.autre) + ' contre ' + abreger(c.miennes) + '). La version de l\'autre personne a été conservée : vous pouvez la corriger si ce n\'est pas la bonne.';
    }
    return quoi + ' : vous et une autre personne avez modifié la même chose en même temps (' + abreger(c.miennes) + ' contre ' + abreger(c.autre) + '). Votre version a été conservée.';
  });
  return phrases.filter((p, i) => phrases.indexOf(p) === i); // jamais deux fois la même phrase
}
