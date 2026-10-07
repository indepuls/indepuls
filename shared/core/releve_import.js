// ── IMPORT DE RELEVÉ BANCAIRE : APPLICATION, ANNULATION, CONTRÔLE URSSAF (2026-10-07, étape 2) ─────
// Fonctions PURES au sens où elles ne touchent ni au DOM ni au cloud : appliquerImport et defaireImport
// MODIFIENT le DATA qu'on leur passe (c'est leur rôle, l'appelant fait saveData ensuite). Rien n'est
// jamais créé sans décision explicite pour la ligne (voir decisionsParDefaut).
//
// Champs de données (tous OPTIONNELS, pas de changement de SCHEMA_VERSION) :
//   dépense : importId (empreinte de la ligne), importLot (identifiant du lot d'import)
//   DATA.empreintesImportees : liste de chaînes (empreinte principale et souple de chaque ligne traitée)
//   DATA.reglesImport        : [{ motCle, categorie, nature }] règles retenues par la personne
//   DATA.mappingsImport      : { 'entêtes normalisés': { date, libelle, montant, ... } }
//   DATA.importsReleve       : historique des lots, pour pouvoir les défaire

import { libelleCle } from './releve.js';

export const MAX_EMPREINTES = 3000;   // environ 1 500 lignes : les plus anciennes sont oubliées d'abord
export const MAX_LOTS = 12;

const arrondi2 = (n) => Math.round(n * 100) / 100;

// Actions possibles pour une ligne : creer | rapprocher | couvrir | ignorer | plus_tard | deja
//   plus_tard : argent reçu (traité à l'étape suivante), n'est PAS mémorisé : la ligne reviendra
//   deja      : déjà importée, rien à faire
export function decisionsParDefaut(analyse) {
  const d = {};
  analyse.lignes.forEach((r) => {
    let action;
    if (r.statut === 'deja_importee') action = 'deja';
    else if (r.statut === 'couverte_abonnement') action = 'couvrir';
    else if (r.statut === 'abonnement_possible') action = 'couvrir';
    else if (r.statut === 'peut_etre_deja_importee') action = 'ignorer';
    else if (r.statut === 'rapprochement_propose') action = r.candidat && r.candidat.type === 'depense' ? 'rapprocher' : 'plus_tard';
    else if (r.nature === 'encaissement' || r.nature === 'remboursement') action = 'plus_tard';
    else if (r.groupe === 'ignorees') action = 'ignorer';
    else action = 'creer';
    d[r.index] = { action, categorie: r.categorie || 'Autre', retenirRegle: false };
  });
  return d;
}

// Un mot-clé simple pour une règle apprise : le premier mot significatif du libellé.
const MOTS_VIDES = new Set(['prlv', 'sepa', 'cb', 'carte', 'vir', 'virement', 'paiement', 'pai', 'achat', 'prelevement', 'facture', 'fact', 'ref', 'mandat', 'sa', 'sas', 'sarl', 'eu', 'eurl', 'de', 'du', 'des', 'la', 'le', 'les', 'et']);
export function motCleSuggere(libelle) {
  const m = libelleCle(libelle).split(' ').find((w) => w.length >= 3 && !MOTS_VIDES.has(w));
  return m || '';
}

// Statistiques de mesure (locales, rien n'est envoyé) : lignes proposées, validées telles quelles, corrigées.
export function statistiques(analyse, decisions) {
  const defaut = decisionsParDefaut(analyse);
  let proposees = 0, tellesQuelles = 0, corrigees = 0;
  analyse.lignes.forEach((r) => {
    if (r.groupe === 'deja_couvertes' && r.statut === 'deja_importee') return;
    proposees++;
    const a = decisions[r.index] || defaut[r.index], b = defaut[r.index];
    if (a.action === b.action && a.categorie === b.categorie) tellesQuelles++; else corrigees++;
  });
  return { proposees, tellesQuelles, corrigees };
}

function nouveauLotId(date) { return 'imp-' + date.replace(/[^0-9]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6); }
const signature = (d) => [d.date, d.montant, d.categorie, d.libelle].join('|');

// Applique l'import : crée les dépenses décidées, estampille les saisies rapprochées (sans les modifier),
// mémorise les empreintes, retient les règles demandées. Retourne le lot (aussi rangé dans DATA.importsReleve).
// options : { maintenant:'AAAA-MM-JJTHH:MM:SS', auteurId?, solde?:{ valeur, date } , parsedMeta?:{debut,fin} }
export function appliquerImport(DATA, analyse, decisions, options) {
  const opt = options || {};
  const maintenant = opt.maintenant || new Date().toISOString();
  const lotId = nouveauLotId(maintenant);
  const lot = { id: lotId, date: maintenant, periode: opt.periode || null, creees: [], rapprochees: [], nbIgnorees: 0, nbCouvertes: 0, empreintes: [], stats: statistiques(analyse, decisions) };
  DATA.depenses = DATA.depenses || [];
  DATA.empreintesImportees = DATA.empreintesImportees || [];
  const dejaConnues = new Set(DATA.empreintesImportees);
  const memoriser = (r) => { [r.empreinte, r.souple].forEach((e) => { if (!dejaConnues.has(e)) { dejaConnues.add(e); DATA.empreintesImportees.push(e); lot.empreintes.push(e); } }); };

  analyse.lignes.forEach((r) => {
    const dec = decisions[r.index] || { action: 'ignorer' };
    if (dec.action === 'deja' || dec.action === 'plus_tard') return;
    if (dec.action === 'creer') {
      const dep = { id: 'dep-' + lotId + '-' + r.index, date: r.ligne.date, categorie: dec.categorie || 'Autre', libelle: r.ligne.libelle, montant: arrondi2(Math.abs(r.ligne.montant)),
        recurrence: 'ponctuelle', dateDebut: '', tvaDeductible: false, montantTVA: 0, importId: r.empreinte, importLot: lotId };
      if (opt.auteurId) dep.auteurId = opt.auteurId;
      DATA.depenses.push(dep);
      lot.creees.push({ id: dep.id, sig: signature(dep) });
      memoriser(r);
    } else if (dec.action === 'rapprocher' && r.candidat && r.candidat.type === 'depense') {
      const d = DATA.depenses.find((x) => x.id === r.candidat.id);
      if (d && !d.importId) { d.importId = r.empreinte; d.importLot = lotId; lot.rapprochees.push(d.id); memoriser(r); }
    } else if (dec.action === 'couvrir') { lot.nbCouvertes++; memoriser(r); }
    else if (dec.action === 'ignorer') { lot.nbIgnorees++; memoriser(r); }
    // Règle retenue : jamais automatique, seulement si la personne l'a demandé.
    if (dec.retenirRegle && dec.motCle && dec.action === 'creer') {
      DATA.reglesImport = DATA.reglesImport || [];
      const existante = DATA.reglesImport.find((x) => x.motCle === dec.motCle);
      if (existante) { existante.categorie = dec.categorie; existante.nature = 'depense'; }
      else DATA.reglesImport.push({ motCle: dec.motCle, categorie: dec.categorie, nature: 'depense' });
    }
  });

  // Solde : seulement si la personne l'a demandé, avec de quoi revenir en arrière.
  if (opt.solde && opt.solde.valeur != null) {
    DATA.params = DATA.params || {};
    lot.soldeMaj = { avant: DATA.params.soldeReel != null ? DATA.params.soldeReel : null, avantDate: DATA.params.soldeReelDate || null, apres: opt.solde.valeur };
    DATA.params.soldeReel = opt.solde.valeur;
    DATA.params.soldeReelDate = (opt.solde.date || maintenant).slice(0, 7);
  }

  // Mémoire plafonnée : les plus anciennes empreintes sont oubliées d'abord.
  if (DATA.empreintesImportees.length > MAX_EMPREINTES) DATA.empreintesImportees = DATA.empreintesImportees.slice(-MAX_EMPREINTES);
  DATA.importsReleve = DATA.importsReleve || [];
  DATA.importsReleve.push(lot);
  if (DATA.importsReleve.length > MAX_LOTS) DATA.importsReleve = DATA.importsReleve.slice(-MAX_LOTS);
  return lot;
}

// Défait un import. Ce qui a été modifié depuis (une dépense créée puis éditée) est CONSERVÉ et signalé.
// Retourne { supprimees, conservees, rapprochementsRetires, soldeRestaure } ou null si le lot est inconnu.
export function defaireImport(DATA, lotId) {
  const lot = (DATA.importsReleve || []).find((l) => l.id === lotId);
  if (!lot) return null;
  const res = { supprimees: 0, conservees: 0, rapprochementsRetires: 0, soldeRestaure: false };
  const aSupprimer = new Set();
  lot.creees.forEach((c) => {
    const d = (DATA.depenses || []).find((x) => x.id === c.id);
    if (!d) return;
    if (signature(d) === c.sig) { aSupprimer.add(c.id); res.supprimees++; }
    else { delete d.importLot; res.conservees++; }   // modifiée depuis : on la garde, elle devient une saisie normale
  });
  if (aSupprimer.size) DATA.depenses = DATA.depenses.filter((d) => !aSupprimer.has(d.id));
  lot.rapprochees.forEach((id) => {
    const d = (DATA.depenses || []).find((x) => x.id === id);
    if (d && d.importLot === lotId) { delete d.importId; delete d.importLot; res.rapprochementsRetires++; }
  });
  // Les empreintes du lot sont oubliées : ces lignes pourront de nouveau être proposées.
  const aOublier = new Set(lot.empreintes);
  DATA.empreintesImportees = (DATA.empreintesImportees || []).filter((e) => !aOublier.has(e));
  // Solde : restauré seulement s'il n'a pas changé depuis l'import.
  if (lot.soldeMaj && DATA.params && DATA.params.soldeReel === lot.soldeMaj.apres) {
    if (lot.soldeMaj.avant == null) { delete DATA.params.soldeReel; delete DATA.params.soldeReelDate; }
    else { DATA.params.soldeReel = lot.soldeMaj.avant; DATA.params.soldeReelDate = lot.soldeMaj.avantDate; }
    res.soldeRestaure = true;
  }
  DATA.importsReleve = DATA.importsReleve.filter((l) => l.id !== lotId);
  return res;
}

// ── Mémorisation du mapping de colonnes (par en-têtes normalisés) ───────────────────────────────
export function cleMapping(entetes) { return (entetes || []).map((e) => libelleCle(e)).join('|'); }

// ── CONTRÔLE URSSAF : prévisionnel Indépuls contre prélèvement réel ─────────────────────────────
// Échéance d'URSSAF la plus proche d'une date de prélèvement. mensuel : fin du mois, pour le CA du mois précédent.
// trimestriel : fin du mois suivant le trimestre (31/01, 30/04, 31/07, 31/10), pour le trimestre écoulé.
// Retourne { echeance:'AAAA-MM-JJ', mois:['AAAA-MM', ...] }.
export function echeanceUrssafProche(dateISO, regime) {
  const [y, m, j] = dateISO.split('-').map(Number);
  const t = Date.UTC(y, m - 1, j);
  const candidats = [];
  for (let dm = -3; dm <= 3; dm++) {
    const fin = new Date(Date.UTC(y, m - 1 + dm + 1, 0)); // dernier jour du mois (m-1+dm)
    const mm = fin.getUTCMonth() + 1, yy = fin.getUTCFullYear();
    if (regime === 'trimestriel') {
      if (![1, 4, 7, 10].includes(mm)) continue;
      const mois = [];
      for (let k = 3; k >= 1; k--) { const d2 = new Date(Date.UTC(yy, mm - 1 - k, 1)); mois.push(d2.getUTCFullYear() + '-' + String(d2.getUTCMonth() + 1).padStart(2, '0')); }
      candidats.push({ echeance: fin.toISOString().slice(0, 10), t: fin.getTime(), mois });
    } else {
      const prec = new Date(Date.UTC(yy, mm - 2, 1));
      candidats.push({ echeance: fin.toISOString().slice(0, 10), t: fin.getTime(), mois: [prec.getUTCFullYear() + '-' + String(prec.getUTCMonth() + 1).padStart(2, '0')] });
    }
  }
  candidats.sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t));
  return { echeance: candidats[0].echeance, mois: candidats[0].mois };
}

// Compare le montant prélevé au prévisionnel. `caCompte` : le chiffre d'affaires que Indépuls a retenu pour la période.
// Retourne { prevu, reel, ecart, ecartPct, significatif, caImplique, caCompte, phrase }.
// Jamais de correction automatique : c'est une aide à la lecture.
export function comparerUrssaf({ reel, prevu, caCompte }) {
  const ecart = arrondi2(reel - prevu);
  const ecartPct = prevu > 0 ? Math.round(Math.abs(ecart) / prevu * 1000) / 10 : null;
  const significatif = Math.abs(ecart) >= 10 && (ecartPct == null || ecartPct >= 3);
  const caImplique = prevu > 0 && caCompte > 0 ? Math.round(reel * caCompte / prevu) : null;
  const fmt = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  let phrase;
  if (!(prevu > 0)) phrase = 'Indépuls n\'avait pas de cotisation prévue pour cette période. Vérifiez que vos encaissements de la période sont bien saisis.';
  else if (!significatif) phrase = 'Le prélèvement correspond à la prévision d\'Indépuls (écart de ' + fmt(Math.abs(ecart)) + ' €).';
  else {
    phrase = 'Prélèvement de ' + fmt(reel) + ' €, Indépuls prévoyait environ ' + fmt(prevu) + ' € (écart de ' + fmt(Math.abs(ecart)) + ' €).';
    if (caImplique != null) phrase += ' Cela correspond à un chiffre d\'affaires déclaré d\'environ ' + fmt(caImplique) + ' €, contre ' + fmt(caCompte) + ' € comptés dans Indépuls.';
    phrase += ecart > 0 ? ' Un encaissement a peut-être été oublié, ou le taux est à vérifier.' : ' Un encaissement a peut-être été déclaré en décalage, ou le taux est à vérifier.';
  }
  return { prevu, reel, ecart, ecartPct, significatif, caImplique, caCompte, phrase };
}
