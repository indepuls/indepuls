// ── FONCTION SERVERLESS — BRIEF HEBDOMADAIRE PAR EMAIL (chantier 2026-07-27/28, phase 4/4) ──
// Déclenchée une fois par jour par Vercel Cron (voir vercel.json) — c'est la logique métier
// ci-dessous qui décide, pour chaque compte, si aujourd'hui est le bon jour et s'il y a
// vraiment quelque chose à dire (voir doitEnvoyerBriefHebdo, shared/core/briefHebdo.js).
//
// Orchestration UNIQUEMENT ici : aucune logique de décision, de matérialité ou de mise en forme
// n'est réécrite dans ce fichier — tout est importé, déjà testé, de shared/core/. Ce fichier se
// contente de lire Supabase, appeler ces fonctions, et envoyer via Brevo.
//
// N'écrit JAMAIS dans user_data.data (réservé à la synchronisation client — cf. règle du 13
// juillet "le cloud gagne toujours" dans indepuls.html) : le suivi des envois réels vit dans sa
// propre table, brief_hebdo_envois (voir CLAUDE.md pour le SQL de création).

import { getDecisionBriefHebdo, doitEnvoyerBriefHebdo } from '../shared/core/briefHebdo.js';
import { renderBriefHebdoEmailHtml } from '../shared/core/briefHebdoEmail.js';
import { getMissionsImpayees, getProchaineEcheanceUrssafDaysLeft, getProchaineEcheanceTvaDaysLeft } from '../shared/core/calculs.js';

const JOURS_SEMAINE = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const APP_URL = 'https://indepuls.vercel.app/indepuls.html';
const LOGO_URL = 'https://indepuls.vercel.app/assets/logo-indepuls.png';

function supabaseHeaders(secretKey) {
  return { apikey: secretKey, Authorization: `Bearer ${secretKey}` };
}

// Signaux de matérialité pour UN compte — regroupés ici pour rester testables par injection
// (voir shared/tests, ce fichier lui-même n'est pas couvert par les tests Node du même type
// puisqu'il dépend d'un vrai réseau ; la logique qu'il appelle l'est déjà intégralement).
async function calculerSignaux(data, user_id, maintenant, { supabaseUrl, secretKey }) {
  const alerteActive = getMissionsImpayees(data).length > 0;
  const echeanceUrssaf = getProchaineEcheanceUrssafDaysLeft(data, maintenant);
  const echeanceTva = getProchaineEcheanceTvaDaysLeft(data, maintenant);
  const echeanceProcheDaysLeft = [echeanceUrssaf, echeanceTva].filter(d => d != null).sort((a, b) => a - b)[0] ?? null;

  const envoiResp = await fetch(
    `${supabaseUrl}/rest/v1/brief_hebdo_envois?user_id=eq.${user_id}&app_type=eq.indepuls&select=sent_at&order=sent_at.desc&limit=1`,
    { headers: supabaseHeaders(secretKey) }
  );
  const envois = envoiResp.ok ? await envoiResp.json() : [];
  const semainesDepuisDernierEnvoi = envois.length
    ? Math.floor((maintenant - new Date(envois[0].sent_at)) / (7 * 86400000))
    : 99; // jamais envoyé — bien au-delà du garde-fou (3-4 semaines), traité comme prioritaire

  return { alerteActive, echeanceProcheDaysLeft, semainesDepuisDernierEnvoi };
}

export default async function handler(req, res) {
  // Protection : seul un appel muni du bon secret peut déclencher un envoi réel (Vercel Cron
  // envoie ce header automatiquement quand CRON_SECRET est configuré côté projet — voir
  // https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
  const auth = req.headers['authorization'];
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  const maintenant = new Date();
  const jourAujourdhui = JOURS_SEMAINE[maintenant.getDay()];

  const dataResp = await fetch(`${supabaseUrl}/rest/v1/user_data?app_type=eq.indepuls&select=user_id,data`, {
    headers: supabaseHeaders(secretKey),
  });
  if (!dataResp.ok) {
    res.status(502).json({ error: 'supabase_user_data_failed', status: dataResp.status });
    return;
  }
  const rows = await dataResp.json();

  const resultats = [];

  for (const { user_id, data } of rows) {
    // Case à cocher pas encore exposée dans Paramètres (voir CLAUDE.md) — tant qu'elle n'existe
    // pas, emailHebdoActif reste à false pour tout le monde, cette route ne fait donc rien.
    if (!data?.params?.emailHebdoActif) { continue; }
    if ((data.params.emailHebdoJour || 'lundi') !== jourAujourdhui) { continue; }

    const decision = getDecisionBriefHebdo(data, maintenant);
    const signaux = await calculerSignaux(data, user_id, maintenant, { supabaseUrl, secretKey });

    if (!doitEnvoyerBriefHebdo(decision, signaux)) {
      resultats.push({ user_id, envoye: false, raison: 'materialite' });
      continue;
    }

    const userResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user_id}`, {
      headers: supabaseHeaders(secretKey),
    });
    if (!userResp.ok) { resultats.push({ user_id, envoye: false, raison: 'utilisateur_introuvable' }); continue; }
    const user = await userResp.json();
    const email = user?.email;
    if (!email) { resultats.push({ user_id, envoye: false, raison: 'pas_email' }); continue; }

    const prenom = data.params?.nom || '';
    const { subject, html } = renderBriefHebdoEmailHtml(decision, {
      prenom,
      appUrl: APP_URL,
      unsubscribeUrl: `${APP_URL}#params`,
      logoUrl: LOGO_URL,
    });

    const sendResp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Indépuls', email: senderEmail },
        to: [{ email }],
        subject,
        htmlContent: html,
      }),
    });

    if (!sendResp.ok) {
      resultats.push({ user_id, envoye: false, raison: 'envoi_echoue', status: sendResp.status });
      continue;
    }

    await fetch(`${supabaseUrl}/rest/v1/brief_hebdo_envois`, {
      method: 'POST',
      headers: { ...supabaseHeaders(secretKey), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id, app_type: 'indepuls' }),
    });

    resultats.push({ user_id, envoye: true });
  }

  res.status(200).json({ ok: true, traites: rows.length, resultats });
}
