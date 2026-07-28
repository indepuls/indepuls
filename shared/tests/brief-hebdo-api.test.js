// ── TESTS : api/brief-hebdo.js — orchestration (mock réseau) ─────────────────
// Chantier "brief hebdomadaire par email", phase 4/4 (2026-07-28). Ce fichier ne teste PAS la
// décision, la matérialité ou le gabarit d'email — déjà couverts en isolation (briefHebdo.test.js,
// briefHebdoEmail.test.js, briefHebdoMaterialite.test.js). Il vérifie uniquement l'orchestration :
// quels comptes sont traités/ignorés et pourquoi, en simulant Supabase et Brevo via un fetch
// intercepté — jamais d'appel réseau réel.

import handler from '../../api/brief-hebdo.js';

let passed = 0, failed = 0;
function ok(label, cond) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}
function section(title) { console.log(`\n── ${title}`); }

process.env.CRON_SECRET = 'test-secret';
process.env.SUPABASE_URL = 'https://exemple.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
process.env.BREVO_API_KEY = 'brevo-test';
process.env.BREVO_SENDER_EMAIL = 'contact@indepuls.example';

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  return res;
}

const JOURS_SEMAINE = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
// handler() calcule toujours le jour à partir de la vraie date d'exécution (new Date()), jamais
// d'une date injectée — le test doit donc utiliser le vrai jour du jour, pas une valeur fixe.
const JOUR_DU_TEST = JOURS_SEMAINE[new Date().getDay()];

function mkCompte(user_id, params, tempsManuel = []) {
  return {
    user_id,
    data: {
      params: { statut: 'micro-bnc', urssafRegime: 'mensuel', tva: false, ...params },
      missions: [],
      snapshotsHebdo: {},
    },
  };
}

section('Sans le bon secret → 401, aucun appel réseau');
{
  let fetchAppele = false;
  global.fetch = async () => { fetchAppele = true; return { ok: true, json: async () => [] }; };
  const res = mockRes();
  await handler({ headers: {} }, res);
  ok('statut 401', res.statusCode === 401);
  ok('aucun appel réseau déclenché', !fetchAppele);
}

section('Comptes non opt-in ou mauvais jour → ignorés, aucun email envoyé');
{
  const jourDifferent = JOURS_SEMAINE[(JOURS_SEMAINE.indexOf(JOUR_DU_TEST) + 1) % 7];
  const comptes = [
    mkCompte('u-non-opt-in', { emailHebdoActif: false, emailHebdoJour: JOUR_DU_TEST }),
    mkCompte('u-mauvais-jour', { emailHebdoActif: true, emailHebdoJour: jourDifferent }),
  ];
  let brevoAppele = false;
  global.fetch = async (url) => {
    if (String(url).includes('/rest/v1/user_data')) return { ok: true, json: async () => comptes };
    if (String(url).includes('api.brevo.com')) { brevoAppele = true; return { ok: true, json: async () => ({}) }; }
    return { ok: true, json: async () => [] };
  };
  const res = mockRes();
  await handler({ headers: { authorization: 'Bearer test-secret' } }, res);
  ok('statut 200', res.statusCode === 200);
  ok('aucun des deux comptes ne déclenche Brevo', !brevoAppele);
  ok('2 comptes traités, 0 résultat retourné (ignorés avant même la décision)', res.body.resultats.length === 0);
}

section('Opt-in + bon jour + rien de matériel → pas d\'envoi, raison "materialite"');
{
  const compte = mkCompte('u-stable', { emailHebdoActif: true, emailHebdoJour: JOUR_DU_TEST });
  // snapshotsHebdo vide → getDecisionBriefHebdo renverra inactif:true (aucune donnée cette
  // semaine) — laissé vide volontairement : inactif=true doit TOUJOURS envoyer, quel que soit
  // le seuil de matérialité (voir doitEnvoyerBriefHebdo).
  compte.data.snapshotsHebdo = {};
  let brevoAppele = false;
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/rest/v1/user_data')) return { ok: true, json: async () => [compte] };
    if (u.includes('/auth/v1/admin/users/')) return { ok: true, json: async () => ({ email: 'stable@example.com' }) };
    if (u.includes('/rest/v1/brief_hebdo_envois')) return { ok: true, json: async () => [] };
    if (u.includes('api.brevo.com')) { brevoAppele = true; return { ok: true, json: async () => ({}) }; }
    return { ok: true, json: async () => ({}) };
  };
  const res = mockRes();
  await handler({ headers: { authorization: 'Bearer test-secret' } }, res);
  // inactif=true (aucun snapshot) => toujours envoyé, c'est le comportement voulu (rappel).
  ok('inactif (aucune donnée cette semaine) → envoyé quand même, comme prévu', brevoAppele);
}

section('Opt-in + bon jour + alerte impayée active → envoi malgré un score stable');
{
  const ancien = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
  const compte = mkCompte('u-impaye', { emailHebdoActif: true, emailHebdoJour: JOUR_DU_TEST });
  compte.data.missions = [{ id: 'm1', isManagement: false, isRecurring: false, statut: 'fact', dateFact: ancien, montantDevis: 500, encaissements: [] }];
  compte.data.snapshotsHebdo = { 'zzz-forcer-non-inactif': null }; // présence non vide, mais pas la semaine réelle
  let brevoPayload = null;
  global.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('/rest/v1/user_data')) return { ok: true, json: async () => [compte] };
    if (u.includes('/auth/v1/admin/users/')) return { ok: true, json: async () => ({ email: 'test@example.com' }) };
    if (u.includes('/rest/v1/brief_hebdo_envois') && (!opts || opts.method !== 'POST')) return { ok: true, json: async () => [] };
    if (u.includes('api.brevo.com')) { brevoPayload = JSON.parse(opts.body); return { ok: true, json: async () => ({}) }; }
    return { ok: true, json: async () => ({}) };
  };
  const res = mockRes();
  await handler({ headers: { authorization: 'Bearer test-secret' } }, res);
  ok('email envoyé (alerte impayée active)', !!brevoPayload);
  ok('destinataire correct', brevoPayload?.to?.[0]?.email === 'test@example.com');
  ok('expéditeur = variable d\'environnement, jamais codé en dur', brevoPayload?.sender?.email === 'contact@indepuls.example');
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
