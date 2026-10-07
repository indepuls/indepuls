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

import { libelleCle, libelleNettoye } from './releve.js';
import { suggererMissions, clientSuggere, libellesProches, proposerCategorie } from './releve_classement.js';

export const MAX_EMPREINTES = 3000;   // environ 1 500 lignes : les plus anciennes sont oubliées d'abord
export const MAX_LOTS = 12;

const arrondi2 = (n) => Math.round(n * 100) / 100;

// Actions possibles pour une ligne : creer | rapprocher | couvrir | ignorer | plus_tard | deja
//   plus_tard : argent reçu (traité à l'étape suivante), n'est PAS mémorisé : la ligne reviendra
//   deja      : déjà importée, rien à faire
// Actions pour de l'argent reçu : rapprocher (saisie existante) | mission (rattacher à une mission) | nouvelle_mission |
// ponctuel (revenu ponctuel) | ignorer | plus_tard (pas encore décidé : NON mémorisé, la ligne reviendra au prochain import).
export function decisionsParDefaut(analyse, DATA) {
  const d = {};
  analyse.lignes.forEach((r) => {
    let action;
    if (r.statut === 'deja_importee') action = 'deja';
    else if (r.statut === 'couverte_abonnement') action = 'couvrir';
    else if (r.statut === 'abonnement_possible') action = 'couvrir';
    else if (r.statut === 'peut_etre_deja_importee') action = 'ignorer';
    else if (r.statut === 'rapprochement_propose') action = 'rapprocher';
    else if (r.nature === 'encaissement' || r.nature === 'remboursement') action = 'plus_tard';
    else if (r.groupe === 'ignorees') action = 'ignorer';
    else action = 'creer';
    d[r.index] = { action, categorie: r.categorie || 'Autre', retenirRegle: false };
    if (r.nature === 'encaissement' && r.ligne.montant > 0 && action === 'plus_tard') {
      // Un client reconnu dans le libellé : proposition de le rattacher à sa mission. Sinon : à décider (jamais en silence).
      const sug = DATA ? suggererMissions(DATA, r.ligne.libelle, r.ligne.detail) : [];
      d[r.index].clientNom = clientSuggere(r.ligne.libelle);
      d[r.index].typePonctuel = 'prestation';
      if (sug.length && (sug.length === 1 || sug[0].score - sug[1].score >= 0.5)) { d[r.index].action = 'mission'; d[r.index].missionId = sug[0].missionId; }
      else if (sug.length) d[r.index].missionId = sug[0].missionId;
    } else if (r.nature === 'remboursement') {
      d[r.index].typePonctuel = 'hors_ca';
      d[r.index].clientNom = clientSuggere(r.ligne.libelle);
      if (DATA) {
        if (r.ligne.montant < 0) {
          const sug = suggererMissions(DATA, r.ligne.libelle, r.ligne.detail);
          if (sug.length) { d[r.index].missionId = sug[0].missionId; const att = retoursEnAttente(DATA, sug[0].missionId); if (att.length === 1) d[r.index].retourId = att[0].id; }
        } else {
          const ded = depensesDeductibles(DATA, Math.abs(r.ligne.montant), r.ligne.libelle, r.ligne.date, r.ligne.detail);
          if (ded.length && ded[0].proche) d[r.index].depenseId = ded[0].id;
          const sug = suggererMissions(DATA, r.ligne.libelle, r.ligne.detail);
          if (sug.length) d[r.index].missionId = sug[0].missionId;
        }
      }
    }
  });
  return d;
}

// Dépenses ponctuelles qu'un remboursement (ou un avoir) reçu peut réduire : montant suffisant, antérieures au remboursement,
// la plus ressemblante d'abord (libellé proche, puis date la plus proche).
export function depensesDeductibles(DATA, montant, libelle, dateLigne, detail) {
  const liste = [];
  (DATA.depenses || []).forEach((d) => {
    if (!d || d.recurrence === 'mensuelle' || d.recurrence === 'annuelle' || !d.date) return;
    if ((d.montant || 0) < montant - 0.01) return;
    if (dateLigne && d.date > dateLigne) return;
    liste.push({ id: d.id, libelle: d.libelle || '', date: d.date, montant: d.montant, proche: libellesProches(libelle, d.libelle || '') || !!(detail && libellesProches(detail, d.libelle || '')) });
  });
  return liste.sort((a, b) => (b.proche - a.proche) || (a.date < b.date ? 1 : -1)).slice(0, 40);
}
// Retours déjà signalés pour une vente et pas encore remboursés (statut demande ou accepte).
export function retoursEnAttente(DATA, missionId) {
  return (DATA.retours || []).filter((r) => r.missionId === missionId && (r.statut === 'demande' || r.statut === 'accepte'));
}
export const profilRetours = (DATA) => !!(DATA && DATA.params && DATA.params.modules && DATA.params.modules.objectif === 'marge_commande');

// Catégorie à pré-remplir dans le formulaire de dépense quand la personne tape un libellé : d'après ses dépenses
// précédentes, ses règles retenues, puis les mots-clés. null si rien de fiable (« Autre » n'est jamais une suggestion).
export function suggererCategorie(DATA, libelle) {
  if (!libelle || libelle.trim().length < 3) return null;
  const p = proposerCategorie(libelle, DATA.reglesImport || [], -1, DATA.depenses || []);
  if (p.nature !== 'depense' || !p.categorie || p.categorie === 'Autre' || p.confiance === 'basse') return null;
  return { categorie: p.categorie, source: p.source, motif: p.motif };
}

// Un mot-clé simple pour une règle apprise : le premier mot significatif du libellé.
const MOTS_VIDES = new Set(['prlv', 'sepa', 'cb', 'carte', 'vir', 'virement', 'paiement', 'pai', 'achat', 'prelevement', 'facture', 'fact', 'ref', 'mandat', 'sa', 'sas', 'sarl', 'eu', 'eurl', 'de', 'du', 'des', 'la', 'le', 'les', 'et']);
export function motCleSuggere(libelle) {
  const m = libelleCle(libelle).split(' ').find((w) => w.length >= 3 && !MOTS_VIDES.has(w));
  return m || '';
}

// Statistiques de mesure (locales, rien n'est envoyé) : lignes proposées, validées telles quelles, corrigées.
export function statistiques(analyse, decisions, DATA) {
  const defaut = decisionsParDefaut(analyse, DATA);
  let proposees = 0, tellesQuelles = 0, corrigees = 0;
  analyse.lignes.forEach((r) => {
    if (r.groupe === 'deja_couvertes' && r.statut === 'deja_importee') return;
    proposees++;
    const a = decisions[r.index] || defaut[r.index], b = defaut[r.index];
    if (a.action === b.action && a.categorie === b.categorie) tellesQuelles++; else corrigees++;
  });
  return { proposees, tellesQuelles, corrigees };
}

function modeReglementDe(libelle) {
  const l = libelleCle(libelle);
  if (/(^| )(cb|carte)( |$)/.test(l)) return 'carte';
  if (/(^| )(prlv|prelevement)( |$)/.test(l)) return 'prelevement';
  if (/(^| )(chq|cheque|remise cheque)( |$)/.test(l)) return 'cheque';
  if (/(^| )(vir|virement)( |$)/.test(l)) return 'virement';
  return '';
}
const htDe = (DATA, ttc) => (DATA.params && DATA.params.tva ? arrondi2(ttc / (1 + (DATA.params.tauxTVA || 20) / 100)) : ttc);
const sigEnc = (e) => [e.date, e.montant, e.montantTTC == null ? '' : e.montantTTC].join('|');
const sigPonc = (e) => [e.date, e.montant, e.libelle].join('|');
const sigMission = (m) => [m.client, m.montantDevis].join('|');

function nouveauLotId(date) { return 'imp-' + date.replace(/[^0-9]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6); }
const signature = (d) => [d.date, d.montant, d.categorie, d.libelle].join('|');

// Applique l'import : crée les dépenses décidées, estampille les saisies rapprochées (sans les modifier),
// mémorise les empreintes, retient les règles demandées. Retourne le lot (aussi rangé dans DATA.importsReleve).
// options : { maintenant:'AAAA-MM-JJTHH:MM:SS', auteurId?, solde?:{ valeur, date } , parsedMeta?:{debut,fin} }
export function appliquerImport(DATA, analyse, decisions, options) {
  const opt = options || {};
  const maintenant = opt.maintenant || new Date().toISOString();
  const lotId = nouveauLotId(maintenant);
  const lot = { corrections: [], retoursCrees: [], retoursMaj: [], nbDeductions: 0, id: lotId, date: maintenant, periode: opt.periode || null, creees: [], rapprochees: [], encaissementsCrees: [], missionsCreees: [], ponctuelsCrees: [], rapprocheesEnc: [], totaux: { revenus: 0, depenses: 0 }, nbIgnorees: 0, nbCouvertes: 0, empreintes: [], stats: statistiques(analyse, decisions, DATA) };
  DATA.depenses = DATA.depenses || [];
  DATA.empreintesImportees = DATA.empreintesImportees || [];
  const dejaConnues = new Set(DATA.empreintesImportees);
  const memoriser = (r) => { [r.empreinte, r.souple].forEach((e) => { if (!dejaConnues.has(e)) { dejaConnues.add(e); DATA.empreintesImportees.push(e); lot.empreintes.push(e); } }); };

  analyse.lignes.forEach((r) => {
    const dec = decisions[r.index] || { action: 'ignorer' };
    if (dec.action === 'deja' || dec.action === 'plus_tard') return;
    if (dec.action === 'creer') {
      const dep = { id: 'dep-' + lotId + '-' + r.index, date: r.ligne.date, categorie: dec.categorie || 'Autre', libelle: libelleNettoye(r.ligne.libelle), montant: arrondi2(Math.abs(r.ligne.montant)),
        recurrence: 'ponctuelle', dateDebut: '', tvaDeductible: false, montantTVA: 0, importId: r.empreinte, importLot: lotId };
      if (opt.auteurId) dep.auteurId = opt.auteurId;
      DATA.depenses.push(dep);
      lot.creees.push({ id: dep.id, sig: signature(dep) });
      lot.totaux.depenses = arrondi2(lot.totaux.depenses + dep.montant);
      memoriser(r);
    } else if (dec.action === 'rapprocher' && r.candidat && r.candidat.type === 'depense') {
      const d = DATA.depenses.find((x) => x.id === r.candidat.id);
      if (d && !d.importId) {
        d.importId = r.empreinte; d.importLot = lotId; lot.rapprochees.push(d.id); memoriser(r);
        // Montant corrigé avec celui de la banque, seulement si la personne l'a demandé.
        const nouveau = arrondi2(Math.abs(r.ligne.montant));
        if (dec.corrigerMontant && d.montant !== nouveau) { lot.corrections.push({ type: 'depense', id: d.id, avant: { montant: d.montant }, apres: { montant: nouveau } }); d.montant = nouveau; }
      }
    } else if (dec.action === 'rapprocher' && r.candidat && r.candidat.type === 'encaissement') {
      const m = (DATA.missions || []).find((x) => x.id === r.candidat.missionId);
      const e = m && (m.encaissements || []).find((x) => x.id === r.candidat.id);
      if (e && !e.importId) {
        e.importId = r.empreinte; e.importLot = lotId; lot.rapprocheesEnc.push({ type: 'encaissement', missionId: m.id, id: e.id }); memoriser(r);
        const ttc = arrondi2(Math.abs(r.ligne.montant));
        if (dec.corrigerMontant && Math.abs((e.montantTTC != null ? e.montantTTC : e.montant) - ttc) > 0.001) {
          lot.corrections.push({ type: 'encaissement', missionId: m.id, id: e.id, avant: { montant: e.montant, montantTTC: e.montantTTC }, apres: { montant: htDe(DATA, ttc), montantTTC: DATA.params && DATA.params.tva ? ttc : undefined } });
          e.montant = htDe(DATA, ttc); if (DATA.params && DATA.params.tva) e.montantTTC = ttc;
        }
      }
    } else if (dec.action === 'rapprocher' && r.candidat && r.candidat.type === 'revenu_ponctuel') {
      const e = ((DATA.revenus && DATA.revenus[r.candidat.mk] && DATA.revenus[r.candidat.mk].autresList) || []).find((x) => x.id === r.candidat.id);
      if (e && !e.importId) {
        e.importId = r.empreinte; e.importLot = lotId; lot.rapprocheesEnc.push({ type: 'revenu_ponctuel', mk: r.candidat.mk, id: e.id }); memoriser(r);
        const ht = htDe(DATA, arrondi2(Math.abs(r.ligne.montant)));
        if (dec.corrigerMontant && Math.abs(e.montant - ht) > 0.001) {
          lot.corrections.push({ type: 'revenu_ponctuel', mk: r.candidat.mk, id: e.id, avant: { montant: e.montant, montantPrestation: e.montantPrestation, montantVente: e.montantVente }, apres: { montant: ht, montantPrestation: e.montantPrestation ? ht : 0, montantVente: e.montantVente ? ht : 0 } });
          e.montant = ht; if (e.montantPrestation) e.montantPrestation = ht; if (e.montantVente) e.montantVente = ht;
        }
      }
    } else if (dec.action === 'mission' || dec.action === 'nouvelle_mission') {
      // Argent reçu rattaché à une mission (existante, ou créée pour ce client) : encaissement HT, TTC conservé si TVA.
      const ttc = arrondi2(Math.abs(r.ligne.montant));
      let m = dec.action === 'mission' ? (DATA.missions || []).find((x) => x.id === dec.missionId) : null;
      if (dec.action === 'nouvelle_mission') {
        const ht0 = htDe(DATA, ttc);
        m = { id: 'mis-' + lotId + '-' + r.index, auteurId: opt.auteurId || null, client: (dec.clientNom || 'Client').trim() || 'Client', categorie: '', description: 'Créée depuis un import de relevé bancaire',
          montantDevis: ht0, montantPrestation: ht0, montantVente: 0, statut: 'fact', dateFact: r.ligne.date, notes: '', isRecurring: false, montantMensuel: 0, dateDebutRec: '', nbMoisRec: null,
          chargeEstimee: 0, chargeUnit: 'h_sem', tempsPrevu: null, sessions: [], typeMission: 'individuelle', nbParticipants: 0, prixParParticipant: 0, sourceAcquisition: '', quantite: null, prixAchat: null, lotId: null,
          heuresSaisies: 0, timerAccumulated: 0, timerRunning: false, timerStart: null, tempsManuel: [], isManagement: false, encaissements: [], importLot: lotId };
        DATA.missions = DATA.missions || [];
        DATA.missions.push(m);
        lot.missionsCreees.push({ id: m.id, sig: sigMission(m) });
      }
      if (m) {
        const enc = { id: 'enc-' + lotId + '-' + r.index, date: r.ligne.date, type: 'paiement', montant: htDe(DATA, ttc), note: r.ligne.libelle.slice(0, 80), modeReglement: modeReglementDe(r.ligne.libelle), importId: r.empreinte, importLot: lotId };
        if (DATA.params && DATA.params.tva) enc.montantTTC = ttc;
        (m.encaissements = m.encaissements || []).push(enc);
        lot.encaissementsCrees.push({ missionId: m.id, id: enc.id, sig: sigEnc(enc) });
        lot.totaux.revenus = arrondi2(lot.totaux.revenus + ttc);
        memoriser(r);
      }
    } else if (dec.action === 'retour') {
      // Remboursement fait à un client : un retour (statut rembourse) sur la vente, ou le retour déjà signalé marqué remboursé.
      const m = (DATA.missions || []).find((x) => x.id === dec.missionId);
      if (m) {
        const ttc = arrondi2(Math.abs(r.ligne.montant)), ht = htDe(DATA, ttc);
        DATA.retours = DATA.retours || [];
        const exist = dec.retourId ? DATA.retours.find((x) => x.id === dec.retourId && x.missionId === m.id) : null;
        if (exist) {
          lot.retoursMaj.push({ id: exist.id, avant: { statut: exist.statut, montant: exist.montant, dateRemboursement: exist.dateRemboursement, dateModif: exist.dateModif }, apres: { statut: 'rembourse', montant: ht, dateRemboursement: r.ligne.date } });
          exist.statut = 'rembourse'; exist.montant = ht; exist.dateRemboursement = r.ligne.date; exist.dateModif = r.ligne.date; exist.importLot = lotId;
        } else {
          const total = (m.montantDevis || m.montantPrestation || m.montantVente || 0) > 0 && ht >= (m.montantDevis || m.montantPrestation || m.montantVente) * 0.99;
          const ret = { id: 'ret-' + lotId + '-' + r.index, missionId: m.id, date: r.ligne.date, motif: 'Importé depuis le relevé bancaire', statut: 'rembourse', montant: ht, type: total ? 'total' : 'partiel',
            dateCreation: r.ligne.date, dateModif: null, dateRemboursement: r.ligne.date, importLot: lotId, importId: r.empreinte };
          DATA.retours.push(ret);
          lot.retoursCrees.push({ id: ret.id, sig: [ret.missionId, ret.montant, ret.dateRemboursement].join('|') });
        }
        memoriser(r);
      }
    } else if (dec.action === 'deduire') {
      // Remboursement ou avoir reçu d'un fournisseur : la dépense concernée est réduite (annulable).
      const d = (DATA.depenses || []).find((x) => x.id === dec.depenseId);
      const ttc = arrondi2(Math.abs(r.ligne.montant));
      if (d && (d.montant || 0) >= ttc - 0.01) {
        const apres = arrondi2(Math.max(0, d.montant - ttc));
        lot.corrections.push({ type: 'depense', id: d.id, avant: { montant: d.montant }, apres: { montant: apres } });
        d.montant = apres;
        lot.nbDeductions++;
        lot.totaux.depenses = arrondi2(lot.totaux.depenses - ttc);
        memoriser(r);
      }
    } else if (dec.action === 'ponctuel') {
      const ttc = arrondi2(Math.abs(r.ligne.montant)), type = dec.typePonctuel || 'prestation', ht = htDe(DATA, ttc), mk = r.ligne.date.slice(0, 7);
      DATA.revenus = DATA.revenus || {};
      if (!DATA.revenus[mk]) DATA.revenus[mk] = {};
      if (!DATA.revenus[mk].autresList) DATA.revenus[mk].autresList = [];
      const e = { id: 'pon-' + lotId + '-' + r.index, libelle: (dec.clientNom || r.ligne.libelle).slice(0, 80), montant: ht, type, date: r.ligne.date, mk,
        montantPrestation: type === 'prestation' ? ht : 0, montantVente: type === 'vente' ? ht : 0, modeReglement: type !== 'hors_ca' ? modeReglementDe(r.ligne.libelle) : '', refJustificative: '', importId: r.empreinte, importLot: lotId };
      DATA.revenus[mk].autresList.push(e);
      lot.ponctuelsCrees.push({ mk, id: e.id, sig: sigPonc(e) });
      if (type !== 'hors_ca') lot.totaux.revenus = arrondi2(lot.totaux.revenus + ttc);
      memoriser(r);
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
  // Encaissements créés : supprimés seulement s'ils n'ont pas été modifiés depuis ; une mission créée par l'import
  // n'est supprimée que si elle est redevenue vide et inchangée.
  res.encaissementsSupprimes = 0; res.encaissementsConserves = 0; res.missionsSupprimees = 0; res.missionsConservees = 0;
  (lot.encaissementsCrees || []).forEach((c) => {
    const m = (DATA.missions || []).find((x) => x.id === c.missionId);
    const e = m && (m.encaissements || []).find((x) => x.id === c.id);
    if (!e) return;
    if (sigEnc(e) === c.sig) { m.encaissements = m.encaissements.filter((x) => x.id !== c.id); res.encaissementsSupprimes++; }
    else { delete e.importLot; res.encaissementsConserves++; }
  });
  (lot.missionsCreees || []).forEach((c) => {
    const m = (DATA.missions || []).find((x) => x.id === c.id);
    if (!m) return;
    if (sigMission(m) === c.sig && !(m.encaissements || []).length && !(m.tempsManuel || []).length && !(m.sessions || []).length) { DATA.missions = DATA.missions.filter((x) => x.id !== c.id); res.missionsSupprimees++; }
    else { delete m.importLot; res.missionsConservees++; }
  });
  (lot.ponctuelsCrees || []).forEach((c) => {
    const liste = (DATA.revenus && DATA.revenus[c.mk] && DATA.revenus[c.mk].autresList) || [];
    const e = liste.find((x) => x.id === c.id);
    if (!e) return;
    if (sigPonc(e) === c.sig) { DATA.revenus[c.mk].autresList = liste.filter((x) => x.id !== c.id); res.encaissementsSupprimes++; }
    else { delete e.importLot; res.encaissementsConserves++; }
  });
  (lot.rapprocheesEnc || []).forEach((c) => {
    let e = null;
    if (c.type === 'encaissement') { const m = (DATA.missions || []).find((x) => x.id === c.missionId); e = m && (m.encaissements || []).find((x) => x.id === c.id); }
    else e = ((DATA.revenus && DATA.revenus[c.mk] && DATA.revenus[c.mk].autresList) || []).find((x) => x.id === c.id);
    if (e && e.importLot === lotId) { delete e.importId; delete e.importLot; res.rapprochementsRetires++; }
  });
  (lot.retoursCrees || []).forEach((c) => {
    const x = (DATA.retours || []).find((y) => y.id === c.id);
    if (!x) return;
    if ([x.missionId, x.montant, x.dateRemboursement].join('|') === c.sig) { DATA.retours = DATA.retours.filter((y) => y.id !== c.id); res.encaissementsSupprimes += 0; res.retoursSupprimes = (res.retoursSupprimes || 0) + 1; }
    else { delete x.importLot; delete x.importId; res.retoursConserves = (res.retoursConserves || 0) + 1; }
  });
  (lot.retoursMaj || []).forEach((c) => {
    const x = (DATA.retours || []).find((y) => y.id === c.id);
    if (x && x.statut === c.apres.statut && x.montant === c.apres.montant) {
      Object.keys(c.avant).forEach((k) => { if (c.avant[k] === undefined) delete x[k]; else x[k] = c.avant[k]; });
      delete x.importLot;
    }
  });
  (lot.corrections || []).forEach((c) => {
    let e = null;
    if (c.type === 'depense') e = (DATA.depenses || []).find((x) => x.id === c.id);
    else if (c.type === 'encaissement') { const m = (DATA.missions || []).find((x) => x.id === c.missionId); e = m && (m.encaissements || []).find((x) => x.id === c.id); }
    else e = ((DATA.revenus && DATA.revenus[c.mk] && DATA.revenus[c.mk].autresList) || []).find((x) => x.id === c.id);
    if (e && e.montant === c.apres.montant) Object.keys(c.avant).forEach((k) => { if (c.avant[k] === undefined) delete e[k]; else e[k] = c.avant[k]; });
  });
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

// ── IMPACT DE L'IMPORT SUR LES INDICATEURS (fenêtre récapitulative) ─────────────────────────────
// Aucun nouveau calcul : l'appelant fournit deux instantanés obtenus avec les fonctions EXISTANTES, avant puis après
// l'import { caMois, depensesMois, tauxHoraireMin }. Un constat n'apparaît que si l'écart est significatif ; au plus
// 3 constats, formulés comme des estimations, avec d'où ils viennent. Sinon : « Rien de changé dans vos indicateurs ».
// ctx : { moisLibelle, revenusImportes, depensesImportees, unite:'€/h'|'€/jour', facteurUnite, soldeMaj?:{ apres, dateLibelle } }
export function calculerImpactImport(avant, apres, ctx) {
  const c = ctx || {};
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  const titre = 'Vous venez d\'importer ' + fmt(c.revenusImportes || 0) + ' € de revenus et ' + fmt(c.depensesImportees || 0) + ' € de dépenses' + (c.moisLibelle ? ' pour ' + c.moisLibelle : '') + '.';
  const constats = [];
  const poids = (x) => (x && x.caMois > 0 ? Math.round(x.depensesMois / x.caMois * 1000) / 10 : null);
  const pa = poids(avant), pb = poids(apres);
  if (pa != null && pb != null && Math.abs(pb - pa) >= 1) {
    constats.push({ cle: 'poids_depenses', texte: 'Vos dépenses représentent maintenant environ ' + String(pb).replace('.', ',') + ' % de votre chiffre d\'affaires' + (c.moisLibelle ? ' de ' + c.moisLibelle : '') + ', contre ' + String(pa).replace('.', ',') + ' % avant l\'import.',
      source: 'Calculé en comparant les dépenses du mois à votre chiffre d\'affaires du mois.' });
  }
  if (avant && apres && avant.tauxHoraireMin != null && apres.tauxHoraireMin != null) {
    const f = c.facteurUnite || 1, a = avant.tauxHoraireMin * f, b = apres.tauxHoraireMin * f;
    if (Math.abs(b - a) >= (c.seuilUnite || 1)) {
      constats.push({ cle: 'seuil', texte: 'Pour atteindre votre objectif, votre minimum à facturer passe d\'environ ' + fmt(a) + ' à ' + fmt(b) + ' ' + (c.unite || '€/h') + '.',
        source: 'Il intègre vos dépenses moyennes : celles qui viennent d\'être ajoutées le font monter ou baisser.' });
    }
  }
  if (avant && apres && Math.abs((apres.caMois || 0) - (avant.caMois || 0)) >= 20) {
    constats.push({ cle: 'ca', texte: 'Votre chiffre d\'affaires' + (c.moisLibelle ? ' de ' + c.moisLibelle : '') + ' passe d\'environ ' + fmt(avant.caMois) + ' à ' + fmt(apres.caMois) + ' €.',
      source: 'Il s\'agit des encaissements ajoutés par l\'import.' });
  }
  if (c.soldeMaj) {
    constats.push({ cle: 'solde', texte: 'Votre trésorerie s\'appuie maintenant sur votre solde réel de ' + fmt(c.soldeMaj.apres) + ' €' + (c.soldeMaj.dateLibelle ? ' au ' + c.soldeMaj.dateLibelle : '') + '.',
      source: 'Vous avez choisi de mettre à jour votre solde avec celui du relevé.' });
  }
  const retenus = constats.slice(0, 3);
  return { titre, constats: retenus, rienDeChange: retenus.length === 0 };
}
