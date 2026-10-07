// ── IMPORT DE RELEVÉ BANCAIRE : CLASSEMENT DES LIGNES (2026-10-06) ─────────────────────────────────
// Fonctions PURES : elles lisent DATA mais ne le modifient JAMAIS. Rien n'est créé ni fusionné ici : chaque
// fonction PROPOSE, la personne décide (jamais de fusion ni d'import silencieux d'une ligne ambiguë).
//
// Pipeline : analyserReleve(DATA, parsed, empreintesDejaImportees, reglesImport) enchaîne
//   1. déjà importée (empreinte connue) ou peut-être déjà importée (seule l'empreinte souple correspond) ;
//   2. couverte par un abonnement existant (dépense récurrente) ;
//   3. rapprochement PROPOSÉ avec une saisie manuelle non encore rapprochée (une saisie = une seule ligne) ;
//   4. catégorie et nature proposées (mots-clés, règles apprises) ;
// puis range chaque ligne dans un groupe : 'a_verifier', 'deja_couvertes' ou 'ignorees'.

import { empreintesLignes, libelleCle, normaliserLibelle } from './releve.js';
import { categorieDepuisHistorique } from './categories.js';

const arrondi2 = (n) => Math.round(n * 100) / 100;

// ── Dates ──────────────────────────────────────────────────────────────────────────────────────
const jourUTC = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export function ecartJours(a, b) { return Math.round(Math.abs(jourUTC(a) - jourUTC(b)) / 86400000); }
const mois = (iso) => iso.slice(0, 7);
const tauxTva = (DATA) => (DATA.params && DATA.params.tva ? ((DATA.params.tauxTVA || 20) / 100) : 0);

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 0.5 CATÉGORISATION PAR MOTS-CLÉS
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Natures : depense | encaissement | charges_sociales | impots | interne | a_ignorer | remboursement.
// (impots et remboursement s'ajoutent aux cinq natures du cahier des charges : un impôt ou un remboursement
// ne se traitent ni comme une dépense ni comme une cotisation.)
// Les catégories sont EXACTEMENT celles du formulaire de dépense d'Indépuls.
const REGLES_DEFAUT = [
  // Cotisations et impôts : déjà provisionnés par le moteur, les compter en dépense les doublerait.
  { mots: ['urssaf', 'ssi', 'cipav', 'carpimko', 'carmf', 'cnavpl', 'cotisations sociales', 'securite sociale', 'msa', 'retraite complementaire', 'agirc', 'arrco', 'cfp'], nature: 'charges_sociales', categorie: null, type: 'urssaf', motif: 'Cotisations sociales : déjà provisionnées par Indépuls' },
  { mots: ['dgfip', 'impots gouv', 'impot', 'tresor public', 'tva', 'cfe', 'cvae', 'taxe fonciere', 'prelevement a la source', 'sie '], nature: 'impots', categorie: null, type: 'impots', motif: 'Impôt ou taxe : déjà provisionné par Indépuls' },
  // Virements entre comptes ou vers un particulier.
  { mots: ['virement interne', 'vir interne', 'vir permanent', 'virement permanent', 'epargne', 'livret', 'compte joint', 'retrait dab', 'retrait especes', 'retrait', 'depot especes'], nature: 'interne', categorie: null, motif: 'Virement interne ou vers une personne : pas une dépense professionnelle' },
  // Échéance de prêt : capital et intérêts, à saisir à part (pas une dépense simple).
  { mots: ['ech pret', 'echeance pret', 'echeance de pret', 'remboursement pret', 'remboursement de pret', 'prelevement pret'], nature: 'a_ignorer', categorie: null, type: 'pret', motif: 'Échéance de prêt : capital et intérêts à saisir à part' },
  // Frais bancaires.
  { mots: ['commission', 'frais tenue de compte', 'tenue de compte', 'cotisation carte', 'agios', 'frais bancaires', 'frais de tenue', 'cotisation cb', 'frais carte'], nature: 'depense', categorie: 'Frais bancaires', motif: 'Frais bancaires' },
  // Outils et abonnements.
  { mots: ['openai', 'chatgpt', 'anthropic', 'claude', 'midjourney', 'perplexity', 'copilot'], nature: 'depense', categorie: 'Outils IA', motif: 'Outil d\'intelligence artificielle' },
  { mots: ['ovh', 'ionos', 'gandi', 'hostinger', 'o2switch', 'godaddy', 'namecheap', 'infomaniak', 'scaleway', 'vercel', 'netlify', 'nom de domaine'], nature: 'depense', categorie: 'Hébergement & nom de domaine', motif: 'Hébergement ou nom de domaine' },
  { mots: ['adobe', 'microsoft', 'google workspace', 'google gsuite', 'notion', 'canva', 'zoom', 'slack', 'dropbox', 'github', 'figma', 'atlassian', 'mailchimp', 'qonto', 'shine', 'pennylane', 'airtable', 'zapier', 'apple com bill', 'icloud', 'saas', 'abonnement'], nature: 'depense', categorie: 'Logiciels & abonnements', motif: 'Logiciel ou abonnement' },
  { mots: ['free mobile', 'free', 'orange', 'sfr', 'bouygues', 'sosh', 'red by sfr', 'b and you', 'forfait mobile', 'telephone'], nature: 'depense', categorie: 'Téléphonie & internet', motif: 'Téléphone ou internet' },
  { mots: ['axa', 'maif', 'macif', 'allianz', 'groupama', 'hiscox', 'april', 'generali', 'swisslife', 'malakoff', 'harmonie', 'mutuelle', 'assurance', 'prevoyance', 'rc pro'], nature: 'depense', categorie: 'Assurances & prévoyance', motif: 'Assurance ou prévoyance' },
  { mots: ['sncf', 'uber', 'bolt', 'total', 'totalenergies', 'esso', 'shell', 'bp', 'carburant', 'station', 'peage', 'vinci autoroutes', 'sanef', 'ratp', 'navigo', 'blablacar', 'air france', 'easyjet', 'ryanair', 'parking', 'ouigo', 'trainline', 'hotel', 'ibis', 'airbnb', 'booking'], nature: 'depense', categorie: 'Déplacements', motif: 'Déplacement' },
  { mots: ['legalstart', 'legalplace', 'expert comptable', 'expert-comptable', 'avocat', 'notaire', 'greffe', 'infogreffe', 'comptable', 'compta'], nature: 'depense', categorie: 'Expert-comptable & juridique', motif: 'Comptabilité ou juridique' },
  { mots: ['facebook ads', 'meta ads', 'google ads', 'linkedin', 'vistaprint', 'moo', 'flyer', 'publicite', 'sponsoris'], nature: 'depense', categorie: 'Marketing & communication', motif: 'Marketing ou communication' },
  { mots: ['wework', 'coworking', 'regus', 'bureau vallee', 'loyer bureau', 'la poste', 'fournitures'], nature: 'depense', categorie: 'Coworking & bureau', motif: 'Bureau ou fournitures' },
  { mots: ['udemy', 'openclassrooms', 'coursera', 'skillshare', 'formation', 'masterclass', 'domestika'], nature: 'depense', categorie: 'Formation', motif: 'Formation' },
  { mots: ['leroy merlin', 'castorama', 'darty', 'boulanger', 'ldlc', 'materiel net', 'apple store', 'cdiscount', 'brico depot', 'bricorama', 'ikea'], nature: 'depense', categorie: 'Matériel & équipement', motif: 'Matériel ou équipement' },
  { mots: ['librairie', 'furet du nord', 'fnac', 'decitre'], nature: 'depense', categorie: 'Livres & ressources professionnelles', motif: 'Livres ou ressources' },
  // Dépenses souvent mixtes (compte pro et perso) : ignorées par défaut, validées par groupe.
  { mots: ['restaurant', 'resto', 'brasserie', 'boulangerie', 'pizzeria', 'cafe', 'bistrot', 'mcdo', 'mcdonald', 'burger', 'uber eats', 'deliveroo', 'carrefour', 'leclerc', 'auchan', 'intermarche', 'lidl', 'monoprix', 'casino', 'franprix', 'picard', 'pharmacie', 'cinema', 'netflix', 'spotify', 'disney', 'coiffeur', 'boucherie', 'primeur'], nature: 'a_ignorer', categorie: null, type: 'mixte', motif: 'Dépense souvent personnelle (compte mixte) : ignorée par défaut' },
  // Énergie : fréquent en abonnement, catégorie générique.
  { mots: ['edf', 'engie', 'enedis', 'totalenergies electricite', 'eau', 'veolia'], nature: 'depense', categorie: 'Autre', motif: 'Énergie ou eau' },
];

// Organismes dont les virements ne sont pas un revenu professionnel (allocations, remboursements de santé...).
const MOTS_PERSONNEL = ['caf', 'cpam', 'ameli', 'assurance maladie', 'france travail', 'pole emploi', 'allocations familiales', 'msa prestations'];
const MOTS_REMBOURSEMENT = ['remboursement', 'rembt', 'rmbt', 'avoir', 'retour achat', 'extourne'];
const MOTS_ENCAISSEMENT_INTERNE = ['virement interne', 'vir interne', 'epargne', 'livret', 'compte joint', 'depot especes'];

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function contientMot(libelleN, mot) {
  const m = normaliserLibelle(mot);
  if (!m) return false;
  return new RegExp('(^|[^a-z0-9])' + echapper(m).replace(/\s+/g, '\\s+') + '([^a-z0-9]|$)').test(libelleN);
}

// Une ligne ressemble-t-elle à un texte donné ? Le libellé d'abord ; le texte bancaire complet seulement en repli.
function ligneProche(l, texte) { return libellesProches(l.libelle, texte) || !!(l.detail && libellesProches(l.detail, texte)); }

// Retourne { categorie, confiance:'haute'|'moyenne'|'basse', nature, source:'apprise'|'defaut'|'signe', motif, type? }
// `regles` = règles apprises [{motCle, categorie, nature}] : elles priment sur la table par défaut.
// `montant` (signé, facultatif) : sans lui, la ligne est considérée comme une sortie.
function proposerCategorieTable(libelle, regles, montant) {
  const entree = montant == null || montant < 0 ? 'sortie' : 'entree';
  const libN = normaliserLibelle(libelle);
  // 1. Règles apprises.
  const apprise = (regles || []).find((r) => r && r.motCle && contientMot(libN, r.motCle));
  if (apprise) {
    return { categorie: apprise.categorie || null, confiance: 'haute', nature: apprise.nature || 'depense', source: 'apprise',
      motif: 'Règle retenue par vous : « ' + apprise.motCle + ' »' };
  }
  // 2. Entrées d'argent.
  if (entree === 'entree') {
    if (MOTS_PERSONNEL.some((m) => contientMot(libN, m))) {
      return { categorie: null, confiance: 'moyenne', nature: 'interne', source: 'defaut', type: 'personnel', motif: 'Allocation ou remboursement de santé : pas un revenu professionnel' };
    }
    if (MOTS_REMBOURSEMENT.some((m) => contientMot(libN, m))) {
      return { categorie: null, confiance: 'moyenne', nature: 'remboursement', source: 'defaut', motif: 'Remboursement : à rattacher à la dépense concernée ou à ignorer' };
    }
    if (MOTS_ENCAISSEMENT_INTERNE.some((m) => contientMot(libN, m))) {
      return { categorie: null, confiance: 'moyenne', nature: 'interne', source: 'defaut', motif: 'Virement interne : pas un encaissement' };
    }
    return { categorie: null, confiance: 'moyenne', nature: 'encaissement', source: 'signe', motif: 'Argent reçu' };
  }
  // 3. Table par défaut (ordre = priorité). Un virement "vers un particulier" est interne.
  if (/(^|\s)vir(ement)?(\s+sepa)?(\s+permanent)?\s+(m|mme|mr|monsieur|madame|mlle)(\s|$)/.test(libN) || /(^|\s)vir(ement)?\s+permanent(\s|$)/.test(libN)) {
    return { categorie: null, confiance: 'moyenne', nature: 'interne', source: 'defaut', type: 'interne', motif: 'Virement vers une personne : pas une dépense professionnelle' };
  }
  for (const r of REGLES_DEFAUT) {
    if (r.mots.some((m) => contientMot(libN, m))) {
      const res = { categorie: r.categorie, confiance: r.nature === 'depense' && r.categorie !== 'Autre' ? 'moyenne' : 'moyenne', nature: r.nature, source: 'defaut', motif: r.motif };
      if (r.type) res.type = r.type;
      return res;
    }
  }
  if (MOTS_REMBOURSEMENT.some((m) => contientMot(libN, m))) {
    return { categorie: null, confiance: 'moyenne', nature: 'remboursement', source: 'defaut', type: 'remboursement_emis', motif: 'Remboursement ou avoir : à enregistrer comme retour client ou à ignorer' };
  }
  return { categorie: 'Autre', confiance: 'basse', nature: 'depense', source: 'defaut', motif: 'Dépense non reconnue : catégorie à confirmer' };
}

// `historique` (facultatif) : les dépenses déjà saisies par la personne. Ordre de priorité : règle retenue par la personne,
// puis son historique (même libellé, ou un mot qui mène toujours à la même catégorie), puis la table de mots-clés.
// L'historique ne remplace jamais le classement d'une cotisation, d'un impôt, d'un prêt ou d'un virement interne.
export function proposerCategorie(libelle, regles, montant, historique) {
  const r = proposerCategorieTable(libelle, regles, montant);
  if (r.source === 'apprise' || !historique || !historique.length || (montant != null && montant >= 0)) return r;
  if (r.nature !== 'depense' && r.nature !== 'a_ignorer') return r;
  if (r.type === 'pret') return r; // une échéance de prêt reste à saisir à part, quoi qu'on ait rangé avant
  const h = categorieDepuisHistorique(historique, libelle);
  if (!h) return r;
  // Un accord fort (même libellé, ou plusieurs dépenses concordantes) l'emporte ; un accord faible ne remplace qu'une catégorie inconnue.
  if (h.confiance === 'haute' || r.confiance === 'basse') return { categorie: h.categorie, confiance: h.confiance, nature: 'depense', source: 'historique', motif: h.motif };
  return r;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 0.4 DÉPENSES RÉCURRENTES (ABONNEMENTS)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
const MOTS_VIDES = new Set(['prlv', 'sepa', 'cb', 'carte', 'vir', 'virement', 'paiement', 'pai', 'achat', 'prelevement', 'facture', 'fact', 'ref', 'mandat', 'sa', 'sas', 'sarl', 'eu', 'eurl', 'de', 'du', 'des', 'la', 'le', 'les', 'et', 'pro', 'france', 'clients', 'client', 'auto', 'compte', 'commerce']);
function mots(s) { return libelleCle(s).split(' ').filter((w) => w.length >= 3 && !MOTS_VIDES.has(w)); }
export function libellesProches(a, b) {
  const ma = mots(a), mb = mots(b);
  if (ma.some((w) => mb.includes(w))) return true;
  const ca = libelleCle(a).replace(/\s/g, ''), cb = libelleCle(b).replace(/\s/g, '');
  return !!(ca && cb && ca.length >= 4 && cb.length >= 4 && (ca.includes(cb) || cb.includes(ca)));
}

// Abonnement actif au mois donné ? (même règle que depenseMensuelleActive du moteur de calcul)
function recurrenteActive(d, mk) {
  if (d.recurrence === 'mensuelle') {
    if (d.dateDebut === 'always') return true;
    const debut = d.dateDebut || d.date;
    return !!debut && mois(debut) <= mk;
  }
  if (d.recurrence === 'annuelle') return !!d.date && d.date.slice(5, 7) === mk.slice(5, 7);
  return false;
}
// Jour attendu du prélèvement : écart (en jours) entre la ligne et le jour de l'abonnement, à cheval sur les mois.
function ecartJourAttendu(d, dateLigne) {
  const jour = Number((d.dateDebut && d.dateDebut !== 'always' ? d.dateDebut : d.date).slice(8, 10));
  const [y, m] = dateLigne.split('-').map(Number);
  let min = Infinity;
  [-1, 0, 1].forEach((dm) => {
    const base = new Date(Date.UTC(y, m - 1 + dm, 1));
    const nbJours = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    const t = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), Math.min(jour, nbJours));
    min = Math.min(min, Math.round(Math.abs(jourUTC(dateLigne) - t) / 86400000));
  });
  return min;
}

// couvertures[i] = null | { depenseId, libelle, ecartMontantPct, ecartJours, statut:'couverte'|'doute', explication }
// propositions = [{ type:'maj_montant', depenseId, montantActuel, montantSuggere, mois:[...] }]
// Une récurrente ne couvre qu'UNE ligne par mois. Montant : ±2 % ; jusqu'à ±15 % quand le libellé correspond
// clairement (facture variable type EDF). Jour : ±5 jours. Libellé qui ne correspond pas : on DEMANDE (statut 'doute').
export function rapprocherRecurrentes(DATA, lignes) {
  const recs = (DATA.depenses || []).filter((d) => (d.recurrence === 'mensuelle' || d.recurrence === 'annuelle') && d.date && d.montant);
  const couvertures = lignes.map(() => null);
  const paires = [];
  lignes.forEach((l, i) => {
    if (l.montant >= 0) return;
    const absM = Math.abs(l.montant), mk = mois(l.date);
    recs.forEach((d) => {
      if (!recurrenteActive(d, mk)) return;
      const ref = Math.abs(d.montant);
      const pct = ref ? Math.abs(absM - ref) / ref * 100 : 100;
      const jours = ecartJourAttendu(d, l.date);
      if (jours > 5) return;
      const libOk = ligneProche(l, d.libelle || '');
      if (libOk && pct <= 15) paires.push({ i, d, pct, jours, statut: 'couverte', score: pct + jours });
      else if (!libOk && pct <= 2) paires.push({ i, d, pct, jours, statut: 'doute', score: pct + jours + 100 });
    });
  });
  paires.sort((a, b) => a.score - b.score);
  const ligneUtilisee = new Set(), recMoisUtilisee = new Set();
  paires.forEach((p) => {
    const cle = p.d.id + '|' + mois(lignes[p.i].date);
    if (ligneUtilisee.has(p.i) || recMoisUtilisee.has(cle)) return;
    ligneUtilisee.add(p.i); recMoisUtilisee.add(cle);
    couvertures[p.i] = {
      depenseId: p.d.id, libelle: p.d.libelle || '', ecartMontantPct: Math.round(p.pct * 10) / 10, ecartJours: p.jours, statut: p.statut,
      explication: p.statut === 'couverte'
        ? 'Déjà comptée dans votre abonnement « ' + (p.d.libelle || 'sans nom') + ' »'
        : 'Ressemble à votre abonnement « ' + (p.d.libelle || 'sans nom') + ' » (même montant, libellé différent) : à confirmer',
    };
  });
  // Écart qui dure : au moins 3 mois couverts avec plus de 2 % d'écart => proposer de mettre à jour le montant.
  const parRec = {};
  couvertures.forEach((c, i) => { if (c && c.statut === 'couverte' && c.ecartMontantPct > 2) (parRec[c.depenseId] = parRec[c.depenseId] || []).push(i); });
  const propositions = [];
  Object.keys(parRec).forEach((id) => {
    const idx = parRec[id];
    const moisDistincts = Array.from(new Set(idx.map((i) => mois(lignes[i].date)))).sort();
    if (moisDistincts.length < 3) return;
    const d = recs.find((x) => x.id === id);
    const moy = arrondi2(idx.reduce((t, i) => t + Math.abs(lignes[i].montant), 0) / idx.length);
    propositions.push({ type: 'maj_montant', depenseId: id, libelle: d ? d.libelle : '', montantActuel: d ? Math.abs(d.montant) : null, montantSuggere: moy, mois: moisDistincts,
      explication: 'Le montant prélevé diffère de votre abonnement depuis ' + moisDistincts.length + ' mois : voulez-vous le mettre à jour à environ ' + moy.toFixed(2).replace('.', ',') + ' € ?' });
  });
  return { couvertures, propositions };
}

// Libellé et montant qui reviennent sur 3 mois ou plus sans abonnement existant : proposer d'en créer un.
// `indices` : lignes à considérer (déjà filtrées : nature dépense, non couvertes, non importées).
export function detecterNouvellesRecurrentes(lignes, indices) {
  const groupes = {};
  indices.forEach((i) => {
    const l = lignes[i];
    if (l.montant >= 0) return;
    const cle = libelleCle(l.libelle);
    if (!cle) return;
    const groupe = (groupes[cle] = groupes[cle] || []);
    const proche = groupe.find((g) => Math.abs(Math.abs(l.montant) - g.ref) / g.ref <= 0.02);
    if (proche) proche.idx.push(i); else groupe.push({ ref: Math.abs(l.montant), idx: [i] });
  });
  const propositions = [];
  Object.keys(groupes).forEach((cle) => groupes[cle].forEach((g) => {
    const moisDistincts = Array.from(new Set(g.idx.map((i) => mois(lignes[i].date)))).sort();
    if (moisDistincts.length < 3) return;
    const jours = g.idx.map((i) => Number(lignes[i].date.slice(8, 10)));
    propositions.push({ type: 'creer_recurrente', libelle: lignes[g.idx[0]].libelle, montant: arrondi2(g.idx.reduce((t, i) => t + Math.abs(lignes[i].montant), 0) / g.idx.length),
      jourMoyen: Math.round(jours.reduce((a, b) => a + b, 0) / jours.length), mois: moisDistincts, indices: g.idx.slice(),
      explication: 'Même libellé et même montant depuis ' + moisDistincts.length + ' mois : voulez-vous l\'enregistrer comme dépense récurrente ?' });
  }));
  return propositions;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 0.3 DÉDOUBLONNAGE ET RAPPROCHEMENT AVEC LES SAISIES MANUELLES
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Saisies que l'on peut rapprocher d'une ligne bancaire : non encore rapprochées (pas d'importId).
export function saisiesRapprochables(DATA) {
  const tva = tauxTva(DATA);
  const depenses = (DATA.depenses || [])
    .filter((d) => d && d.date && !d.importId && d.recurrence !== 'mensuelle' && d.recurrence !== 'annuelle')
    .map((d) => ({ type: 'depense', id: d.id, date: d.date, montantTTC: Math.abs(d.montant || 0), libelle: d.libelle || '' }));
  const encaissements = [];
  (DATA.missions || []).forEach((m) => {
    (m.encaissements || []).forEach((e) => {
      if (!e || !e.date || e.importId || e.statutLivre === 'annulee') return;
      const ttc = e.montantTTC != null ? e.montantTTC : arrondi2((e.montant || 0) * (1 + tva));
      encaissements.push({ type: 'encaissement', id: e.id, missionId: m.id, date: e.date, montantTTC: ttc, montantHT: e.montant || 0, libelle: m.client || m.nom || '' });
    });
  });
  const ponctuels = [];
  Object.keys(DATA.revenus || {}).forEach((mk) => {
    ((DATA.revenus[mk] && DATA.revenus[mk].autresList) || []).forEach((e) => {
      if (!e || e.importId || e.type === 'hors_ca') return;
      ponctuels.push({ type: 'revenu_ponctuel', id: e.id, mk, date: null, montantTTC: Math.abs(e.montant || 0), libelle: e.libelle || '' });
    });
  });
  return { depenses, encaissements, ponctuels };
}

// Candidats pour chaque ligne. Fenêtre : ±7 jours pour un encaissement, ±3 jours pour une dépense.
// Piège HT/TTC : la banque voit du TTC, les encaissements sont stockés HT (montant HT × (1 + TVA) ≈ montant bancaire).
// Écart de montant toléré pour un rapprochement "montant différent" : 1 € ou 2 %, le plus large des deux.
function ecartAcceptable(saisi, banque) { return Math.abs(saisi - banque) <= Math.max(1, banque * 0.02); }
function candidatsPourLigne(l, saisies) {
  const absM = Math.abs(l.montant);
  const res = [];
  if (l.montant < 0) {
    saisies.depenses.forEach((s) => {
      const j = ecartJours(s.date, l.date);
      if (j > 3) return;
      if (Math.abs(s.montantTTC - absM) <= 0.01) res.push({ s, jours: j, motif: 'montant_ttc' });
      // Montant légèrement différent (arrondi à la saisie) : seulement si le libellé se ressemble.
      else if (ecartAcceptable(s.montantTTC, absM) && ligneProche(l, s.libelle)) res.push({ s, jours: j, motif: 'montant_proche', ecartMontant: arrondi2(s.montantTTC - absM) });
    });
  } else {
    saisies.encaissements.forEach((s) => {
      const j = ecartJours(s.date, l.date);
      if (j > 7) return;
      if (Math.abs(s.montantTTC - absM) <= 0.011) res.push({ s, jours: j, motif: 'montant_ttc' });
      else if (Math.abs(s.montantHT - absM) <= 0.011) res.push({ s, jours: j, motif: 'montant_ht' });
      else if ((ecartAcceptable(s.montantTTC, absM) || ecartAcceptable(s.montantHT, absM)) && ligneProche(l, s.libelle)) res.push({ s, jours: j, motif: 'montant_proche', ecartMontant: arrondi2(s.montantTTC - absM) });
    });
    saisies.ponctuels.forEach((s) => {
      if (s.mk !== mois(l.date)) return;
      if (Math.abs(s.montantTTC - absM) <= 0.011) res.push({ s, jours: null, motif: 'montant_ttc' });
      else if (ecartAcceptable(s.montantTTC, absM) && ligneProche(l, s.libelle)) res.push({ s, jours: null, motif: 'montant_proche', ecartMontant: arrondi2(s.montantTTC - absM) });
    });
  }
  return res;
}

// Attribution : une saisie ne peut être rapprochée qu'à UNE ligne bancaire. Les meilleures paires d'abord
// (montant TTC avant HT, jours d'écart croissants).
function attribuer(lignes, indicesAUtiliser, saisies) {
  const paires = [];
  indicesAUtiliser.forEach((i) => {
    candidatsPourLigne(lignes[i], saisies).forEach((c) => paires.push({ i, c, score: (c.motif === 'montant_ttc' ? 0 : c.motif === 'montant_ht' ? 50 : 100 + Math.abs(c.ecartMontant || 0)) + (c.jours == null ? 8 : c.jours) }));
  });
  paires.sort((a, b) => a.score - b.score || a.i - b.i);
  const ligneUtilisee = new Set(), saisieUtilisee = new Set();
  const resultat = {};
  paires.forEach((p) => {
    const cleS = p.c.s.type + ':' + p.c.s.id;
    if (ligneUtilisee.has(p.i) || saisieUtilisee.has(cleS)) return;
    ligneUtilisee.add(p.i); saisieUtilisee.add(cleS);
    // Autres saisies possibles pour cette ligne : si plusieurs, la personne doit trancher.
    const autres = paires.filter((q) => q.i === p.i && q.c.s !== p.c.s && q.score - p.score <= 2).length;
    resultat[p.i] = { s: p.c.s, jours: p.c.jours, motif: p.c.motif, ecartMontant: p.c.ecartMontant, ambigu: autres > 0 };
  });
  return resultat;
}

function decrireCandidat(c) {
  const s = c.s;
  const o = { type: s.type, id: s.id, libelle: s.libelle, date: s.date, montant: s.montantTTC, ecartJours: c.jours, motif: c.motif, ecartMontant: c.ecartMontant, ambigu: c.ambigu };
  if (s.missionId) o.missionId = s.missionId;
  if (s.mk) o.mk = s.mk;
  return o;
}

// Statut d'une ligne par rapport aux imports précédents.
function statutImport(emp, deja) {
  if (deja.has(emp.id)) return 'deja_importee';
  if (deja.has(emp.souple)) return 'peut_etre_deja_importee';
  return null;
}

// classerLignes : niveaux 1 à 3 du cahier des charges (sans abonnements ni catégories, voir analyserReleve).
// Retourne un tableau parallèle à `lignes` : { statut:'deja_importee'|'peut_etre_deja_importee'|'rapprochement_propose'|'nouvelle',
//   candidat?, empreinte, souple, explication }
export function classerLignes(DATA, lignes, empreintesDejaImportees) {
  const deja = new Set(empreintesDejaImportees || []);
  const emp = empreintesLignes(lignes);
  const sorties = lignes.map((l, i) => ({ empreinte: emp[i].id, souple: emp[i].souple, statut: statutImport(emp[i], deja) }));
  const aTraiter = [];
  sorties.forEach((s, i) => { if (!s.statut) aTraiter.push(i); });
  const attrib = attribuer(lignes, aTraiter, saisiesRapprochables(DATA));
  sorties.forEach((s, i) => {
    if (s.statut === 'deja_importee') s.explication = 'Déjà importée lors d\'un import précédent';
    else if (s.statut === 'peut_etre_deja_importee') s.explication = 'Même date et même montant qu\'une ligne déjà importée : est-ce la même opération ?';
    else if (attrib[i]) {
      s.statut = 'rapprochement_propose'; s.candidat = decrireCandidat(attrib[i]);
      s.explication = attrib[i].ambigu ? 'Plusieurs saisies correspondent : à vous de choisir' : (attrib[i].motif === 'montant_proche' ? 'Ressemble à une saisie existante, avec un montant légèrement différent' : 'Correspond à une saisie déjà présente dans Indépuls');
    } else { s.statut = 'nouvelle'; s.explication = 'Nouvelle ligne : proposition de création'; }
  });
  return sorties;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ENCAISSEMENTS : À QUELLE MISSION CORRESPOND CETTE ENTRÉE D'ARGENT ?
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Missions dont le nom de client apparaît dans le libellé bancaire (au moins un mot significatif en commun),
// les plus ressemblantes d'abord. Jamais une certitude : la personne choisit (liste complète dans l'écran).
const MOTS_SOCIETE = new Set(['sas', 'sarl', 'eurl', 'sasu', 'sa', 'snc', 'ei', 'association', 'asso', 'conseil', 'consulting', 'groupe', 'societe', 'cabinet', 'agence', 'studio', 'atelier']);
export function suggererMissions(DATA, libelle, detail) {
  const res = suggererSur(DATA, libelle);
  return res.length || !detail ? res : suggererSur(DATA, detail);
}
function suggererSur(DATA, libelle) {
  const lib = new Set(mots(libelle));
  const res = [];
  (DATA.missions || []).forEach((m) => {
    if (m.isManagement || m.statut === 'ref' || !m.client) return;
    const toks = mots(m.client).filter((w) => !MOTS_SOCIETE.has(w));
    const communs = toks.filter((w) => lib.has(w));
    if (communs.length) res.push({ missionId: m.id, client: m.client, score: communs.length / Math.max(1, toks.length) + communs.length * 0.1 });
  });
  return res.sort((a, b) => b.score - a.score);
}
// Nom de client proposé pour une nouvelle mission : les mots du libellé sans les mentions bancaires ni les références.
export function clientSuggere(libelle) {
  const mm = libelleCle(libelle).split(' ').filter((w) => w.length >= 2 && !MOTS_VIDES.has(w) && !['ref', 'fact', 'facture', 'reglement', 'rglt', 'remise', 'cheque', 'chq', 'paiement', 'virement'].includes(w));
  return mm.map((w) => (['sas', 'sarl', 'eurl', 'sasu', 'sa', 'snc'].includes(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// PIPELINE COMPLET
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Retourne { lignes:[{ index, ligne, empreinte, souple, statut, groupe, nature, categorie, confiance, explication,
//   candidat?, couverture?, type? }], propositions:[...], resume:{...} }.
// statut : deja_importee | peut_etre_deja_importee | couverte_abonnement | abonnement_possible | rapprochement_propose | nouvelle
// groupe : a_verifier | deja_couvertes | ignorees
export function analyserReleve(DATA, parsed, empreintesDejaImportees, reglesImport) {
  const lignes = parsed.lignes || [];
  const deja = new Set(empreintesDejaImportees || []);
  const emp = empreintesLignes(lignes);
  const res = lignes.map((l, i) => ({ index: i, ligne: l, empreinte: emp[i].id, souple: emp[i].souple, statut: null, groupe: null, nature: null, categorie: null, confiance: null, explication: '' }));

  // 1. Déjà importées.
  res.forEach((r) => { const s = statutImport({ id: r.empreinte, souple: r.souple }, deja); if (s) r.statut = s; });

  // 2. Abonnements existants (uniquement les lignes pas encore traitées).
  const restantes = res.filter((r) => !r.statut).map((r) => r.index);
  const rec = rapprocherRecurrentes(DATA, restantes.map((i) => lignes[i]));
  restantes.forEach((i, k) => {
    const c = rec.couvertures[k];
    if (!c) return;
    res[i].couverture = c;
    res[i].statut = c.statut === 'couverte' ? 'couverte_abonnement' : 'abonnement_possible';
    res[i].explication = c.explication;
  });

  // 3. Rapprochement avec les saisies manuelles (jamais pour une ligne déjà couverte ou déjà importée).
  const libres = res.filter((r) => !r.statut || r.statut === 'abonnement_possible').map((r) => r.index);
  const attrib = attribuer(lignes, libres, saisiesRapprochables(DATA));
  Object.keys(attrib).forEach((i) => {
    const r = res[i];
    r.statut = 'rapprochement_propose'; r.candidat = decrireCandidat(attrib[i]); delete r.couverture;
    r.explication = attrib[i].ambigu ? 'Plusieurs saisies correspondent : à vous de choisir' : (attrib[i].motif === 'montant_proche' ? 'Ressemble à une saisie existante, avec un montant légèrement différent' : 'Correspond à une saisie déjà présente dans Indépuls');
  });

  // 4. Nature et catégorie pour toutes les lignes, puis groupes.
  res.forEach((r) => {
    let p = proposerCategorie(r.ligne.libelle, reglesImport, r.ligne.montant, DATA.depenses);
    if (p.confiance === 'basse' && r.ligne.detail) { const p2 = proposerCategorie(r.ligne.detail, reglesImport, r.ligne.montant, DATA.depenses); if (p2.confiance !== 'basse') p = p2; }
    r.nature = p.nature; r.categorie = p.categorie; r.confiance = p.confiance; r.source = p.source; r.motifCategorie = p.motif;
    if (p.type) r.type = p.type;
    if (!r.statut) {
      r.statut = 'nouvelle';
      r.explication = ['charges_sociales', 'impots', 'interne', 'a_ignorer', 'remboursement'].includes(p.nature) ? p.motif : 'Nouvelle ligne : proposition de création';
    }
    if (r.statut === 'deja_importee' || r.statut === 'couverte_abonnement') r.groupe = 'deja_couvertes';
    else if (r.statut === 'rapprochement_propose' || r.statut === 'peut_etre_deja_importee' || r.statut === 'abonnement_possible') r.groupe = 'a_verifier';
    else if (['charges_sociales', 'impots', 'interne', 'a_ignorer'].includes(p.nature)) r.groupe = 'ignorees';
    else r.groupe = 'a_verifier';
  });

  // 5. Propositions d'abonnement (mise à jour de montant, création) : jamais appliquées sans réponse.
  const propositions = rec.propositions.slice();
  const candidatsCreation = res.filter((r) => r.statut === 'nouvelle' && r.nature === 'depense').map((r) => r.index);
  detecterNouvellesRecurrentes(lignes, candidatsCreation).forEach((p) => propositions.push(p));

  const resume = { total: res.length, a_verifier: 0, deja_couvertes: 0, ignorees: 0 };
  res.forEach((r) => { resume[r.groupe]++; });
  return { lignes: res, propositions, resume };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// L'INVERSE : saisies sans ligne bancaire (vérifier que tout est pointé)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Saisies manuelles de la période du fichier qui n'ont AUCUNE ligne bancaire en face. Ce n'est pas une
// erreur : un paiement en espèces ou depuis un autre compte est légitime, la personne répond.
// Aussi : abonnements actifs sur la période sans prélèvement correspondant.
export function saisiesNonPointees(DATA, analyse, periode) {
  const lignes = analyse.lignes;
  if (!lignes.length) return { saisies: [], abonnements: [] };
  const debut = (periode && periode.debut) || lignes[0].ligne.date;
  const fin = (periode && periode.fin) || lignes[lignes.length - 1].ligne.date;
  const pointees = new Set();
  lignes.forEach((r) => { if (r.candidat) pointees.add(r.candidat.type + ':' + r.candidat.id); if (r.couverture) pointees.add('abo:' + r.couverture.depenseId + '|' + mois(r.ligne.date)); });
  const s = saisiesRapprochables(DATA);
  const saisies = [];
  s.depenses.concat(s.encaissements).forEach((x) => {
    if (x.date >= debut && x.date <= fin && !pointees.has(x.type + ':' + x.id)) saisies.push({ type: x.type, id: x.id, date: x.date, montant: x.montantTTC, libelle: x.libelle, missionId: x.missionId });
  });
  s.ponctuels.forEach((x) => {
    if (x.mk >= debut.slice(0, 7) && x.mk <= fin.slice(0, 7) && !pointees.has(x.type + ':' + x.id)) saisies.push({ type: x.type, id: x.id, mk: x.mk, montant: x.montantTTC, libelle: x.libelle });
  });
  saisies.sort((a, b) => ((a.date || a.mk) < (b.date || b.mk) ? -1 : 1));
  // Abonnements : seulement pour les mois ENTIÈREMENT couverts par le fichier.
  const abonnements = [];
  const moisCouverts = [];
  for (let d = new Date(Date.UTC(Number(debut.slice(0, 4)), Number(debut.slice(5, 7)) - 1, 1)); d <= new Date(jourUTC(fin)); d.setUTCMonth(d.getUTCMonth() + 1)) {
    const mk = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
    const premier = mk + '-01', dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    if (premier >= debut && dernier <= fin) moisCouverts.push(mk);
  }
  (DATA.depenses || []).filter((d) => (d.recurrence === 'mensuelle' || d.recurrence === 'annuelle') && d.date).forEach((d) => {
    moisCouverts.forEach((mk) => {
      if (recurrenteActive(d, mk) && !pointees.has('abo:' + d.id + '|' + mk)) abonnements.push({ depenseId: d.id, libelle: d.libelle || '', mois: mk, montant: Math.abs(d.montant || 0) });
    });
  });
  return { saisies, abonnements };
}
