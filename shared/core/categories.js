// ── CATÉGORIE DE DÉPENSE SUGGÉRÉE D'APRÈS L'HISTORIQUE DE LA PERSONNE (2026-10-08) ─────────────────
// Fonction PURE. Si la personne a déjà rangé « Orange » en « Téléphonie & internet », la prochaine dépense au
// libellé proche reprend cette catégorie : ça s'adapte à chaque métier, sans liste de marques à maintenir.
// Ce n'est qu'une proposition : la personne valide toujours avant que la dépense soit créée.
// Les dépenses en « Autre » sont ignorées (c'est la valeur par défaut, pas un choix).

import { libelleCle, libelleNettoye } from './releve.js';

const MOTS_VIDES = new Set(['prlv', 'sepa', 'cb', 'carte', 'paiement', 'pai', 'vir', 'virement', 'achat', 'prelevement', 'facture', 'fact', 'ref', 'mandat',
  'sas', 'sarl', 'eurl', 'sasu', 'eu', 'sa', 'les', 'des', 'pour', 'avec', 'dans', 'com', 'www', 'france', 'client', 'clients', 'compte', 'commerce']);
function motsSignificatifs(s) {
  return libelleCle(libelleNettoye(s)).split(' ').filter((w) => w.length >= 3 && !MOTS_VIDES.has(w));
}

// Retourne null ou { categorie, confiance:'haute'|'moyenne', nb, motif }.
//  - libellé identique (une fois nettoyé) à une dépense passée : « haute » ;
//  - sinon un mot du libellé qui, dans l'historique, mène presque toujours à la même catégorie (au moins 75 %) :
//    « haute » si au moins deux dépenses vont dans ce sens, « moyenne » avec une seule.
// Un mot qui apparaît dans des catégories variées (une ville, par exemple) n'est jamais retenu.
export function categorieDepuisHistorique(depenses, libelle) {
  const items = (depenses || []).filter((d) => d && d.libelle && d.categorie && d.categorie !== 'Autre')
    .map((d) => ({ cat: d.categorie, cle: libelleCle(libelleNettoye(d.libelle)), mots: new Set(motsSignificatifs(d.libelle)) }));
  if (!items.length) return null;
  const cle = libelleCle(libelleNettoye(libelle));
  if (!cle) return null;
  const compter = (liste) => { const c = {}; liste.forEach((i) => { c[i.cat] = (c[i.cat] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a]).map((k) => [k, c[k]]); };
  const exact = items.filter((i) => i.cle === cle);
  if (exact.length) {
    const [cat, n] = compter(exact)[0];
    return { categorie: cat, confiance: 'haute', nb: exact.length, motif: 'D\'après vos dépenses précédentes (même libellé, ' + n + ' fois)' };
  }
  let meilleur = null;
  Array.from(new Set(motsSignificatifs(libelle))).forEach((w) => {
    const m = items.filter((i) => i.mots.has(w));
    if (!m.length) return;
    const [cat, n] = compter(m)[0];
    const purete = n / m.length;
    if (purete < 0.75) return;
    if (!meilleur || purete > meilleur.purete || (purete === meilleur.purete && m.length > meilleur.total)) meilleur = { mot: w, cat, purete, total: m.length, n };
  });
  if (!meilleur) return null;
  return { categorie: meilleur.cat, confiance: meilleur.total >= 2 ? 'haute' : 'moyenne', nb: meilleur.total, motif: 'D\'après vos dépenses précédentes (« ' + meilleur.mot + ' »)' };
}
