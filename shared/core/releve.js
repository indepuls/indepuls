// ── IMPORT DE RELEVÉ BANCAIRE : LECTURE DU FICHIER ET EMPREINTES (2026-10-06) ─────────────────────
// Fonctions PURES, sans DOM, sans accès au cloud, sans dépendance externe. Le fichier est lu dans le
// navigateur et n'est jamais conservé : on ne garde que les lignes validées et des empreintes.
// Aucune de ces fonctions ne lève d'exception pour un fichier mal formé : une ligne illisible va dans
// `rejets` avec un motif, un fichier inutilisable renvoie `erreur`.
//
// parseReleve(entree, options) retourne :
//   { format:'csv'|'ofx'|null, encodage, devise, deviseDetectee, soldeOuverture, soldeCloture, dateCloture,
//     lignes:[{date:'AAAA-MM-JJ', libelle, montant (signé), ficheId?}], rejets:[{numeroLigne, ligneBrute, motif}],
//     colonnes?:{...}, erreur?:{code, message}, mappingNecessaire?:true, entetes?, apercu? }
// Les lignes sont toujours triées par date croissante (ordre chronologique réel pour un fichier "du plus
// récent au plus ancien"). Deux lignes strictement identiques le même jour sont TOUTES les deux conservées.

export const LIMITE_OCTETS = 5 * 1024 * 1024;
export const LIMITE_LIGNES = 20000;

// ── Utilitaires ────────────────────────────────────────────────────────────────────────────────
const arrondi2 = (n) => { const r = Math.round(n * 100) / 100; return r === 0 ? 0 : r; };

export function normaliserEspaces(s) {
  return String(s == null ? '' : s).replace(/[\s  ]+/g, ' ').trim();
}

// Minuscules, sans accents, espaces normalisés (les chiffres sont conservés).
export function normaliserLibelle(s) {
  return normaliserEspaces(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Version "clé" : lettres seulement (les chiffres de référence variables, la ponctuation disparaissent).
export function libelleCle(s) {
  return normaliserLibelle(s).replace(/[^a-z]+/g, ' ').trim();
}

function erreurResultat(code, message) {
  return { format: null, encodage: null, devise: 'EUR', deviseDetectee: false, soldeOuverture: null, soldeCloture: null,
    dateCloture: null, lignes: [], rejets: [], erreur: { code, message } };
}

// ── Encodage ───────────────────────────────────────────────────────────────────────────────────
function versOctets(entree) {
  if (entree instanceof ArrayBuffer) return new Uint8Array(entree);
  if (ArrayBuffer.isView(entree)) return new Uint8Array(entree.buffer, entree.byteOffset, entree.byteLength);
  return null;
}

// Détecte UTF-8 (avec ou sans BOM), UTF-16 (avec BOM), sinon cp1252 (qui couvre aussi latin-1).
export function decoderTexte(entree) {
  if (typeof entree === 'string') return { texte: entree.replace(/^﻿/, ''), encodage: 'texte' };
  const o = versOctets(entree);
  if (!o) return { texte: '', encodage: null };
  if (o.length >= 3 && o[0] === 0xEF && o[1] === 0xBB && o[2] === 0xBF) {
    return { texte: new TextDecoder('utf-8').decode(o.subarray(3)), encodage: 'utf-8' };
  }
  if (o.length >= 2 && o[0] === 0xFF && o[1] === 0xFE) return { texte: new TextDecoder('utf-16le').decode(o.subarray(2)), encodage: 'utf-16' };
  if (o.length >= 2 && o[0] === 0xFE && o[1] === 0xFF) return { texte: new TextDecoder('utf-16be').decode(o.subarray(2)), encodage: 'utf-16' };
  try {
    return { texte: new TextDecoder('utf-8', { fatal: true }).decode(o), encodage: 'utf-8' };
  } catch (e) {
    return { texte: new TextDecoder('windows-1252').decode(o), encodage: 'cp1252' };
  }
}

// ── Montants ───────────────────────────────────────────────────────────────────────────────────
// `decimal` : le séparateur décimal du FICHIER (',' ou '.'), détecté une fois sur l'ensemble des montants,
// ce qui lève l'ambiguïté d'un "1.800" (milliers dans un fichier à virgule décimale, décimales sinon).
export function parseMontant(brut, decimal) {
  if (brut == null) return null;
  let s = String(brut).replace(/[\s  ]+/g, '');
  if (!s) return null;
  s = s.replace(/€|EUR|eur/g, '');
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/[-−]$/.test(s)) { neg = true; s = s.slice(0, -1); }
  if (/^[-−]/.test(s)) { neg = true; s = s.slice(1); }
  if (/^\+/.test(s)) s = s.slice(1);
  if ((decimal || ',') === ',') s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const v = parseFloat(s);
  if (!isFinite(v)) return null;
  return arrondi2(neg ? -v : v);
}

function detecterDecimal(chaines) {
  let virgule = 0, point = 0;
  chaines.forEach((c) => {
    const s = String(c == null ? '' : c).replace(/[^\d.,]/g, '');
    if (/,\d{1,2}$/.test(s)) virgule++;
    else if (/\.\d{1,2}$/.test(s)) point++;
  });
  return point > virgule ? '.' : ',';
}

// ── Dates ──────────────────────────────────────────────────────────────────────────────────────
const MOTIF_DATE = /^\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}$/;

function enleverHeure(s) {
  return String(s == null ? '' : s).trim().replace(/[T ]\d{1,2}:\d{2}.*$/, '').trim();
}
export function ressembleADate(s) { return MOTIF_DATE.test(enleverHeure(s)); }

// Ordre des composantes d'après l'ensemble du fichier : 'YMD', 'DMY' ou 'MDY' (défaut français : DMY).
function detecterOrdreDates(chaines) {
  let dmy = 0, mdy = 0, ymd = 0;
  chaines.forEach((c) => {
    const s = enleverHeure(c);
    if (!MOTIF_DATE.test(s)) return;
    const p = s.split(/[/.\-]/).map(Number);
    if (String(s).split(/[/.\-]/)[0].length === 4) { ymd++; return; }
    if (p[0] > 12) dmy++;
    else if (p[1] > 12) mdy++;
  });
  if (ymd >= dmy && ymd >= mdy && ymd > 0) return 'YMD';
  return mdy > dmy ? 'MDY' : 'DMY';
}

// Retourne 'AAAA-MM-JJ', ou null si la date est illisible ou impossible (31/02).
export function parseDate(brut, ordre) {
  const s = enleverHeure(brut);
  if (!MOTIF_DATE.test(s)) return null;
  const morceaux = s.split(/[/.\-]/);
  let a = Number(morceaux[0]), b = Number(morceaux[1]), c = Number(morceaux[2]);
  let y, m, d;
  if (morceaux[0].length === 4) { y = a; m = b; d = c; }
  else if ((ordre || 'DMY') === 'MDY') { m = a; d = b; y = c; }
  else { d = a; m = b; y = c; }
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1970 || y > 2100) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

// ── CSV ────────────────────────────────────────────────────────────────────────────────────────
// Découpe en lignes physiques en respectant les guillemets (un saut de ligne entre guillemets reste dans la ligne).
function decouperLignes(texte) {
  const lignes = [];
  let courant = '', dansGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const ch = texte[i];
    if (ch === '"') dansGuillemets = !dansGuillemets;
    if (!dansGuillemets && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && texte[i + 1] === '\n') i++;
      lignes.push(courant); courant = '';
    } else courant += ch;
  }
  lignes.push(courant);
  return lignes;
}

function decouperChamps(ligne, sep) {
  const champs = [];
  let c = '', dansGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const ch = ligne[i];
    if (dansGuillemets) {
      if (ch === '"') { if (ligne[i + 1] === '"') { c += '"'; i++; } else dansGuillemets = false; }
      else c += ch;
    } else if (ch === '"') dansGuillemets = true;
    else if (ch === sep) { champs.push(c); c = ''; }
    else c += ch;
  }
  champs.push(c);
  return champs;
}

function detecterSeparateur(lignes) {
  const candidats = [';', '\t', ','];
  let meilleur = ';', meilleurScore = 0;
  candidats.forEach((sep) => {
    const effectifs = {};
    lignes.slice(0, 80).forEach((l) => {
      if (!l.trim()) return;
      const n = decouperChamps(l, sep).length;
      if (n >= 2) effectifs[n] = (effectifs[n] || 0) + 1;
    });
    const score = Math.max(0, ...Object.values(effectifs));
    if (score > meilleurScore) { meilleurScore = score; meilleur = sep; }
  });
  return meilleur;
}

const cleEntete = (s) => normaliserLibelle(s).replace(/[^a-z0-9]/g, '');

// Rôle probable d'une colonne d'après son en-tête, avec un score (le plus haut gagne par rôle).
function roleEntete(cle) {
  if (!cle) return null;
  if (/account|compte|categ|comment|iban|numero|supplier/.test(cle)) return null;
  const r = [];
  if (/^(debit)/.test(cle)) r.push(['debit', 3]);
  if (/^(credit)/.test(cle) && !/creditor/.test(cle)) r.push(['credit', 3]);
  if (/solde|balance/.test(cle)) r.push(['solde', 3]);
  if (/devise|currency|monnaie/.test(cle)) r.push(['devise', 3]);
  if (/^(montant|amount|somme)/.test(cle)) {
    let sc = 3;
    if (/ttc|total/.test(cle)) sc = 4;
    if (/(^|[^a-z])ht$|tva|hors/.test(cle) && !/ttc/.test(cle)) sc = 1;
    r.push(['montant', sc]);
  }
  if (/^date|posted/.test(cle)) {
    let sc = 1;
    if (/oper|op$|^dateop/.test(cle)) sc = 4;
    else if (/compta|transaction/.test(cle)) sc = 3;
    else if (cle === 'date') sc = 3;
    if (/valeur|^dateval|valid|regl/.test(cle)) sc = 0.5;
    r.push(['date', sc]);
  }
  if (/complement|informations?$/.test(cle)) r.push(['detail', 3]);
  else if (/libelle|label/.test(cle)) r.push(['libelle', 4]);
  else if (/description|intitule|objet|designation|nature/.test(cle)) r.push(['libelle', 2]);
  else if (/memo|detail/.test(cle)) r.push(['libelle', 1]);
  return r.length ? r : null;
}

// Cherche la ligne d'en-tête (dans les 40 premières lignes) et en déduit les colonnes.
function detecterEntete(lignesChamps) {
  for (let i = 0; i < Math.min(40, lignesChamps.length); i++) {
    const champs = lignesChamps[i];
    const roles = {};
    const indicesSolde = [];
    champs.forEach((c, idx) => {
      const rr = roleEntete(cleEntete(c));
      if (!rr) return;
      if (rr.some(([role]) => role === 'solde')) indicesSolde.push(idx);
      rr.forEach(([role, score]) => { if (!roles[role] || score > roles[role].score) roles[role] = { idx, score }; });
    });
    // Boursorama : la colonne du montant s'appelle "Solde" et une seconde colonne "Solde" donne le solde du compte.
    // Sans colonne montant/débit/crédit mais avec deux colonnes "solde" : la première est le montant, la dernière le solde.
    if (!roles.montant && !roles.debit && !roles.credit && indicesSolde.length >= 2) {
      roles.montant = { idx: indicesSolde[0], score: 3 };
      roles.solde = { idx: indicesSolde[indicesSolde.length - 1], score: 3 };
    }
    const aMontant = roles.montant || roles.debit || roles.credit;
    if (roles.date && aMontant) {
      const colonnes = {};
      Object.keys(roles).forEach((k) => { colonnes[k] = roles[k].idx; });
      // un même indice ne peut servir deux rôles : on garde le rôle de plus haut score
      const vus = {};
      Object.keys(roles).sort((a, b) => roles[b].score - roles[a].score).forEach((k) => {
        if (vus[roles[k].idx] !== undefined) delete colonnes[k]; else vus[roles[k].idx] = k;
      });
      return { index: i, colonnes };
    }
  }
  return null;
}

function lireCsv(texte, options) {
  const lignesBrutes = decouperLignes(texte);
  if (lignesBrutes.length > LIMITE_LIGNES) {
    return erreurResultat('trop_volumineux', 'Ce fichier contient trop de lignes (plus de ' + LIMITE_LIGNES + '). Exportez une période plus courte.');
  }
  const sep = detecterSeparateur(lignesBrutes);
  const champsParLigne = lignesBrutes.map((l) => decouperChamps(l, sep));
  const detecte = detecterEntete(champsParLigne);
  const mappingManuel = options && options.mapping ? options.mapping : null;

  let colonnes, indexEntete;
  if (mappingManuel) {
    colonnes = Object.assign({}, mappingManuel);
    indexEntete = options.ligneEntete != null ? options.ligneEntete : (detecte ? detecte.index : -1);
  } else if (detecte) {
    colonnes = detecte.colonnes; indexEntete = detecte.index;
  } else {
    const apercu = champsParLigne.filter((c) => c.some((x) => x.trim())).slice(0, 5);
    const res = erreurResultat('mapping_incertain', 'Les colonnes de ce fichier n\'ont pas été reconnues automatiquement.');
    res.format = 'csv'; res.mappingNecessaire = true; res.apercu = apercu;
    res.entetes = apercu[0] || [];
    res.ligneEntetePropose = Math.max(0, champsParLigne.findIndex((c) => c.some((x) => x.trim())));
    return res;
  }
  const aMontant = colonnes.montant != null || colonnes.debit != null || colonnes.credit != null;
  if (colonnes.date == null || !aMontant) {
    const res = erreurResultat('mapping_incertain', 'Il manque une colonne date ou montant.');
    res.format = 'csv'; res.mappingNecessaire = true; res.entetes = indexEntete >= 0 ? champsParLigne[indexEntete] : [];
    res.apercu = champsParLigne.filter((c) => c.some((x) => x.trim())).slice(0, 5);
    return res;
  }

  // Passe 1 : formats de date et de nombre sur l'ensemble du fichier.
  const donnees = [];
  for (let i = indexEntete + 1; i < champsParLigne.length; i++) donnees.push({ i, champs: champsParLigne[i] });
  const val = (champs, col) => (col == null ? '' : (champs[col] == null ? '' : champs[col]));
  const ordre = detecterOrdreDates(donnees.map((d) => val(d.champs, colonnes.date)));
  const chainesMontants = [];
  donnees.forEach((d) => ['montant', 'debit', 'credit', 'solde'].forEach((r) => { if (colonnes[r] != null) chainesMontants.push(val(d.champs, colonnes[r])); }));
  const decimal = detecterDecimal(chainesMontants);

  // Passe 2 : lecture ligne par ligne, jamais d'exception.
  const lignes = [], soldes = [], rejets = [];
  let soldeCloturePied = null, dateCloturePied = null, deviseLue = null, dejaUneLigne = false;
  donnees.forEach((d) => {
    const champs = d.champs;
    const brute = lignesBrutes[d.i];
    if (!brute.trim() || champs.every((c) => !String(c).trim())) return;
    const cellDate = val(champs, colonnes.date);
    // Pied de page "Solde au 30/09/2026;6.875,09" : lu comme solde de clôture, jamais comme une ligne.
    const premier = normaliserLibelle(champs.find((c) => String(c).trim()) || '');
    if (/^solde\b/.test(premier) && !ressembleADate(cellDate)) {
      const dm = /(\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4})/.exec(brute);
      const nombres = champs.map((c) => parseMontant(c, decimal)).filter((v) => v != null);
      if (nombres.length) { soldeCloturePied = nombres[nombres.length - 1]; dateCloturePied = dm ? parseDate(dm[1], ordre) : null; }
      return;
    }
    if (!String(cellDate).trim()) { rejets.push({ numeroLigne: d.i + 1, ligneBrute: brute, motif: 'Date manquante' }); return; }
    if (!ressembleADate(cellDate)) {
      if (!dejaUneLigne && indexEntete < 0) return; // texte avant la première ligne de données : ignoré
      rejets.push({ numeroLigne: d.i + 1, ligneBrute: brute, motif: 'Date illisible' }); return;
    }
    const date = parseDate(cellDate, ordre);
    if (!date) { rejets.push({ numeroLigne: d.i + 1, ligneBrute: brute, motif: 'Date impossible' }); return; }
    // Montant : colonne signée, ou colonnes Débit / Crédit séparées.
    let montant = null;
    if (colonnes.montant != null) {
      const c = val(champs, colonnes.montant);
      if (!String(c).trim()) { rejets.push({ numeroLigne: d.i + 1, ligneBrute: brute, motif: 'Montant manquant' }); return; }
      montant = parseMontant(c, decimal);
      if (montant == null) { rejets.push({ numeroLigne: d.i + 1, ligneBrute: brute, motif: 'Montant illisible' }); return; }
    } else {
      const cd = String(val(champs, colonnes.debit)).trim(), cc = String(val(champs, colonnes.credit)).trim();
      if (!cd && !cc) { rejets.push({ numeroLigne: d.i + 1, ligneBrute: brute, motif: 'Montant manquant' }); return; }
      const vd = cd ? parseMontant(cd, decimal) : 0, vc = cc ? parseMontant(cc, decimal) : 0;
      if (vd == null || vc == null) { rejets.push({ numeroLigne: d.i + 1, ligneBrute: brute, motif: 'Montant illisible' }); return; }
      montant = arrondi2(Math.abs(vc) - Math.abs(vd));
    }
    dejaUneLigne = true;
    const ligneLue = { date, libelle: normaliserEspaces(val(champs, colonnes.libelle)), montant };
    // Texte bancaire complet (facultatif) : jamais dans les empreintes, seulement en repli pour reconnaître un client ou une catégorie.
    const detailLu = colonnes.detail != null ? normaliserEspaces(val(champs, colonnes.detail)) : '';
    if (detailLu && normaliserLibelle(detailLu) !== normaliserLibelle(ligneLue.libelle)) ligneLue.detail = detailLu;
    lignes.push(ligneLue);
    soldes.push(colonnes.solde != null ? parseMontant(val(champs, colonnes.solde), decimal) : null);
    if (colonnes.devise != null) { const dv = normaliserEspaces(val(champs, colonnes.devise)).toUpperCase(); if (dv && !deviseLue) deviseLue = dv; }
  });

  let devise = deviseLue, deviseDetectee = !!deviseLue;
  if (!devise && indexEntete >= 0 && /€|eur/i.test(champsParLigne[indexEntete].join(' '))) { devise = 'EUR'; deviseDetectee = true; }
  return { format: 'csv', separateur: sep, colonnes, lignesBrutes: lignes, soldesBruts: soldes, rejets, soldeCloturePied, dateCloturePied, devise: devise || 'EUR', deviseDetectee };
}

// ── OFX (1.x SGML et 2.x XML) ──────────────────────────────────────────────────────────────────
function decoderEntites(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'').replace(/&amp;/g, '&');
}
function baliseOfx(bloc, nom) {
  const m = new RegExp('<' + nom + '>([^<\\r\\n]*)', 'i').exec(bloc);
  return m ? decoderEntites(m[1]).trim() : null;
}
function dateOfx(s) {
  if (!s) return null;
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
  return m ? parseDate(m[1] + '-' + m[2] + '-' + m[3], 'YMD') : null;
}

function lireOfx(texte) {
  const blocs = texte.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi) || [];
  if (blocs.length > LIMITE_LIGNES) {
    return erreurResultat('trop_volumineux', 'Ce fichier contient trop de lignes (plus de ' + LIMITE_LIGNES + '). Exportez une période plus courte.');
  }
  const lignes = [], rejets = [], ids = [];
  blocs.forEach((bloc, i) => {
    const date = dateOfx(baliseOfx(bloc, 'DTPOSTED'));
    const brutMontant = baliseOfx(bloc, 'TRNAMT');
    const montant = brutMontant == null ? null : parseMontant(brutMontant.replace(',', '.'), '.');
    const brute = bloc.replace(/\s+/g, ' ').trim();
    if (!date) { rejets.push({ numeroLigne: i + 1, ligneBrute: brute, motif: 'Date illisible' }); return; }
    if (montant == null) { rejets.push({ numeroLigne: i + 1, ligneBrute: brute, motif: 'Montant illisible' }); return; }
    // NAME est souvent tronqué à 32 caractères par la banque : on garde le texte le plus complet.
    const name = normaliserEspaces(baliseOfx(bloc, 'NAME') || ''), memo = normaliserEspaces(baliseOfx(bloc, 'MEMO') || '');
    let libelle = name || memo;
    if (name && memo && memo.length > name.length && normaliserLibelle(memo).startsWith(normaliserLibelle(name))) libelle = memo;
    const ligne = { date, libelle, montant };
    const fitid = baliseOfx(bloc, 'FITID');
    if (fitid) ligne.ficheId = fitid;
    lignes.push(ligne); ids.push(fitid);
  });
  const curdef = baliseOfx(texte, 'CURDEF');
  const solde = /<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]*)[\s\S]*?<DTASOF>([^<\r\n]*)/i.exec(texte);
  return { format: 'ofx', lignesBrutes: lignes, soldesBruts: null, rejets,
    soldeCloturePied: solde ? parseMontant(solde[1].replace(',', '.'), '.') : null,
    dateCloturePied: solde ? dateOfx(solde[2].trim()) : null,
    devise: curdef ? curdef.toUpperCase() : 'EUR', deviseDetectee: !!curdef };
}

// ── Point d'entrée ─────────────────────────────────────────────────────────────────────────────
// entree : octets du fichier (Uint8Array, ArrayBuffer, Buffer) ou texte déjà décodé.
// options : { mapping?:{date,libelle,montant,debit,credit,solde,devise (indices de colonne)}, ligneEntete? }
export function parseReleve(entree, options) {
  try {
    const octets = versOctets(entree);
    if (octets && octets.length === 0) return erreurResultat('vide', 'Ce fichier est vide.');
    if (typeof entree === 'string' && !entree.trim()) return erreurResultat('vide', 'Ce fichier est vide.');
    if (octets && octets.length > LIMITE_OCTETS) {
      return erreurResultat('trop_volumineux', 'Ce fichier est trop volumineux. Exportez une période plus courte.');
    }
    if (octets && octets.length >= 4 && octets[0] === 0x50 && octets[1] === 0x4B && octets[2] === 0x03 && octets[3] === 0x04) {
      return erreurResultat('excel_non_supporte', 'Les fichiers Excel ne sont pas lus. Enregistrez votre relevé au format CSV (ou OFX) et réessayez.');
    }
    if (octets && octets.length >= 4 && octets[0] === 0x25 && octets[1] === 0x50 && octets[2] === 0x44 && octets[3] === 0x46) {
      return erreurResultat('pdf_non_supporte', 'Les relevés PDF ne sont pas lus. Utilisez l\'export CSV ou OFX de votre banque.');
    }
    const { texte, encodage } = decoderTexte(entree);
    if (!texte.trim()) return erreurResultat('vide', 'Ce fichier est vide.');
    if (/^\s*!Type:/i.test(texte)) return erreurResultat('qif_non_supporte', 'Le format QIF n\'est pas lu. Utilisez l\'export CSV ou OFX de votre banque.');

    const estOfx = /<OFX[\s>]/i.test(texte) || /^\s*OFXHEADER/i.test(texte) || /<STMTTRN>/i.test(texte);
    const brut = estOfx ? lireOfx(texte) : lireCsv(texte, options);
    if (brut.erreur) { brut.encodage = encodage; return brut; }

    // Ordre : toujours chronologique en sortie (un export "du plus récent au plus ancien" est retourné).
    let lignes = brut.lignesBrutes.map((l, i) => ({ l, s: brut.soldesBruts ? brut.soldesBruts[i] : null }));
    if (lignes.length > 1 && lignes[0].l.date > lignes[lignes.length - 1].l.date) lignes.reverse();
    lignes = lignes.map((x, i) => ({ x, i })).sort((a, b) => (a.x.l.date < b.x.l.date ? -1 : a.x.l.date > b.x.l.date ? 1 : a.i - b.i)).map((o) => o.x);

    // Soldes : pied de page / LEDGERBAL en priorité, sinon colonne "solde" (dernière ligne chronologique).
    let soldeCloture = brut.soldeCloturePied, dateCloture = brut.dateCloturePied, soldeOuverture = null;
    const dernier = lignes[lignes.length - 1], premier = lignes[0];
    if (soldeCloture == null && dernier && dernier.s != null) { soldeCloture = dernier.s; dateCloture = dernier.l.date; }
    if (soldeCloture != null && !dateCloture && dernier) dateCloture = dernier.l.date;
    if (premier && premier.s != null) soldeOuverture = arrondi2(premier.s - premier.l.montant);
    else if (brut.format === 'ofx' && soldeCloture != null && dateCloture && dernier && dateCloture === dernier.l.date) {
      soldeOuverture = arrondi2(soldeCloture - lignes.reduce((t, x) => t + x.l.montant, 0));
    }

    return {
      format: brut.format, encodage, devise: brut.devise, deviseDetectee: brut.deviseDetectee,
      soldeOuverture, soldeCloture, dateCloture,
      lignes: lignes.map((x) => x.l), rejets: brut.rejets,
      colonnes: brut.colonnes || null, separateur: brut.separateur || null,
    };
  } catch (e) {
    return erreurResultat('illisible', 'Ce fichier n\'a pas pu être lu.');
  }
}

// Libellé lisible pour une dépense créée : sans les mentions bancaires (PAIEMENT CB, PRLV SEPA...), le numéro de carte,
// les références et les dates collées (ddmm). Le texte d'origine reste affiché avant validation et sert aux empreintes.
export function libelleNettoye(libelle) {
  let t = normaliserEspaces(libelle);
  t = t.replace(/ CARTE [0-9]{4}( .*)?$/i, '');
  for (let i = 0; i < 4; i++) t = t.replace(/^(PAIEMENT (CB|PSC)|PAIEMENT|PRLV SEPA|PRLV|VIR SEPA|VIR INST|VIR DE|VIR|F COTIS|COTIS|CB|CARTE) +/i, '');
  t = t.split(' ').filter((w) => {
    if (/^[0-9]{4}$/.test(w)) { const a = Number(w.slice(0, 2)), b = Number(w.slice(2)); if (a >= 1 && a <= 31 && b >= 1 && b <= 12) return false; }
    const nu = w.replace(/[/.,;:]+$/, '');
    if (/^[0-9]{5,}$/.test(nu)) return false;
    if (/^[A-Za-z0-9]*[0-9][A-Za-z0-9]{5,}$/.test(nu)) return false;
    if (/^[0-9A-Za-z]*[0-9]+-[0-9]+$/.test(nu)) return false;
    return !/^(VAD)$/i.test(w);
  }).join(' ');
  t = t.replace(/( +(REF|FACT|FACTURE|N|NO))* *[0-9]{1,3}( +(REF|FACT|FACTURE))*$/i, '').replace(/ +(REF|FACT|FACTURE)$/i, '').trim();
  return t.length >= 3 ? t : normaliserEspaces(libelle);
}

// ── Empreintes de ligne ────────────────────────────────────────────────────────────────────────
// Hash 53 bits (cyrb53) : stable, sans dépendance, largement suffisant pour distinguer des lignes d'un relevé.
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const centimes = (m) => Math.round(m * 100);

// Empreinte principale : l'identifiant de la banque (FITID) s'il existe, sinon date + montant + libellé
// "sans chiffres" + rang parmi les lignes strictement identiques du même jour.
export function empreinteLigne(ligne, indexDansGroupe) {
  if (ligne.ficheId) return 'f:' + hash(String(ligne.ficheId));
  return 'h:' + hash(ligne.date + '|' + centimes(ligne.montant) + '|' + libelleCle(ligne.libelle) + '|' + (indexDansGroupe || 0));
}
// Empreinte "souple" : sans le libellé. Une même opération peut être libellée différemment entre un export
// CSV et un export OFX : si seule l'empreinte souple correspond, on DEMANDE à la personne (jamais en silence).
export function empreinteSouple(ligne, rangDuJour) {
  return 's:' + hash(ligne.date + '|' + centimes(ligne.montant) + '|' + (rangDuJour || 0));
}

// Calcule les deux empreintes de chaque ligne d'un fichier (les rangs sont calculés dans le fichier).
export function empreintesLignes(lignes) {
  const rangsStricts = {}, rangsSouples = {};
  return lignes.map((l) => {
    const kStrict = l.date + '|' + centimes(l.montant) + '|' + libelleCle(l.libelle);
    const kSouple = l.date + '|' + centimes(l.montant);
    const rs = rangsStricts[kStrict] || 0; rangsStricts[kStrict] = rs + 1;
    const ro = rangsSouples[kSouple] || 0; rangsSouples[kSouple] = ro + 1;
    return { id: empreinteLigne(l, rs), souple: empreinteSouple(l, ro) };
  });
}
