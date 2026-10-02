// ── FONCTION SERVERLESS — EMAILS À CHAQUE INSCRIPTION SUR LA LISTE D'ATTENTE (2026-10-02) ──
// Appelée par un Supabase Database Webhook (table public.waitlist, événement INSERT), configuré
// dans le tableau de bord Supabase avec l'en-tête Authorization: Bearer <WAITLIST_WEBHOOK_SECRET>.
//
// Orchestration uniquement : la décision (doublon, rafale) et le contenu des emails sont dans
// shared/core/waitlistEmail.js, testés. Ce fichier lit deux comptages dans Supabase et envoie via
// Brevo (mêmes variables d'environnement que api/brief-hebdo.js).
//
// Ne renvoie jamais d'erreur 5xx à Supabase pour un échec d'envoi : le webhook n'a rien à rejouer,
// l'inscription est déjà enregistrée. Le résultat détaillé est dans la réponse JSON (logs Vercel).

import { decideEnvoiBienvenue, renderBienvenueEmail, renderAlerteEmail } from '../shared/core/waitlistEmail.js';

const CONTACT_EMAIL = 'contact@indepuls.fr';

// Clés "Secret keys" Supabase (sb_secret_...) : uniquement dans l'en-tête apikey, jamais en Bearer
// (même piège que dans api/brief-hebdo.js).
function supabaseHeaders(secretKey) {
  return { apikey: secretKey };
}

async function compter(url, secretKey) {
  try {
    const r = await fetch(url, { headers: supabaseHeaders(secretKey) });
    if (!r.ok) return undefined;
    const rows = await r.json();
    return Array.isArray(rows) ? rows.length : undefined;
  } catch {
    return undefined;
  }
}

async function envoyerBrevo(brevoApiKey, payload) {
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  const auth = req.headers['authorization'];
  if (!process.env.WAITLIST_WEBHOOK_SECRET || auth !== `Bearer ${process.env.WAITLIST_WEBHOOK_SECRET}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const record = req.body?.record;
  if (req.body?.type !== 'INSERT' || req.body?.table !== 'waitlist' || !record?.email) {
    res.status(200).json({ ok: true, ignore: true });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  const email = String(record.email).trim();
  const prenom = record.prenom || '';
  const metier = record.metier || '';

  // Le formulaire ne vérifie que la présence d'un "@" : une adresse mal formée ne doit jamais faire
  // échouer l'alerte à Faustine (Brevo refuse tout l'envoi si le replyTo est invalide).
  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // ilike sans joker = égalité insensible à la casse (Marie@X.fr et marie@x.fr sont la même personne).
  // On ne retire que les jokers explicites % et * ; "_" (fréquent dans les adresses) reste, au pire
  // il rapproche deux adresses quasi identiques, ce qui ne prive que d'un doublon d'email.
  const emailFiltre = encodeURIComponent(email.replace(/[%*]/g, ''));
  const ilYAUneHeure = new Date(Date.now() - 3600 * 1000).toISOString();
  const [nbMemeEmail, nbDerniereHeure] = await Promise.all([
    compter(`${supabaseUrl}/rest/v1/waitlist?email=ilike.${emailFiltre}&select=id`, secretKey),
    compter(`${supabaseUrl}/rest/v1/waitlist?created_at=gte.${encodeURIComponent(ilYAUneHeure)}&select=id`, secretKey),
  ]);

  const decision = decideEnvoiBienvenue({ nbMemeEmail, nbDerniereHeure });

  let bienvenueEnvoyee = false;
  if (decision.bienvenue && emailValide) {
    const { subject, html, text } = renderBienvenueEmail({ prenom });
    bienvenueEnvoyee = await envoyerBrevo(brevoApiKey, {
      sender: { name: 'Faustine · Indépuls', email: senderEmail },
      replyTo: { email: CONTACT_EMAIL, name: 'Faustine · Indépuls' },
      to: [{ email }],
      subject,
      htmlContent: html,
      textContent: text,
    });
  }

  const alerte = renderAlerteEmail({ prenom, email, metier, bienvenueEnvoyee, dejaInscrit: decision.dejaInscrit, raison: decision.raison });
  const alerteEnvoyee = await envoyerBrevo(brevoApiKey, {
    sender: { name: 'Indépuls', email: senderEmail },
    ...(emailValide ? { replyTo: { email } } : {}),
    to: [{ email: CONTACT_EMAIL }],
    subject: alerte.subject,
    htmlContent: alerte.html,
  });

  res.status(200).json({ ok: true, bienvenueEnvoyee, alerteEnvoyee, raison: decision.raison });
}
