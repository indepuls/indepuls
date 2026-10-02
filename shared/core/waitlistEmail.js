// ── EMAILS DE LA LISTE D'ATTENTE (2026-10-02) ────────────────────────────────
// Déclenchés à chaque inscription (Supabase Database Webhook → api/waitlist-notify.js) :
//   1. un email de bienvenue à l'inscrit (texte validé par Faustine, signé d'elle, réponses vers
//      contact@indepuls.fr) ;
//   2. une alerte à Faustine (contact@indepuls.fr), avec répondre-à = l'adresse de l'inscrit.
// Fonctions pures (aucun réseau, aucun DOM) : la décision et le contenu sont testés dans
// shared/tests/waitlistEmail.test.js, la fonction serverless ne fait qu'orchestrer.
//
// Le formulaire est public : prénom/métier/email sont des saisies libres, TOUJOURS échappées.

import { escapeHtml } from './utils.js';

// Au-delà, on suppose un robot : plus aucun email de bienvenue (Faustine reçoit encore les
// alertes). Évite qu'un tiers fasse envoyer des centaines d'emails au nom d'Indépuls, ce qui
// ferait suspendre le compte Brevo.
export const MAX_BIENVENUES_PAR_HEURE = 20;

const DEMO_URL = 'https://indepuls.fr/demo/';

// nbMemeEmail : nombre de lignes waitlist avec cette adresse, inscription courante comprise.
// nbDerniereHeure : nombre d'inscriptions sur la dernière heure, inscription courante comprise.
// Comptages absents (lecture Supabase en échec) : on suppose le cas normal plutôt que de priver
// une vraie personne de sa confirmation.
export function decideEnvoiBienvenue({ nbMemeEmail = 1, nbDerniereHeure = 1 } = {}) {
  if (nbMemeEmail > 1) return { bienvenue: false, dejaInscrit: true, raison: 'deja_inscrit' };
  if (nbDerniereHeure > MAX_BIENVENUES_PAR_HEURE) return { bienvenue: false, dejaInscrit: false, raison: 'rafale' };
  return { bienvenue: true, dejaInscrit: false, raison: null };
}

// Saisie libre : espaces et retours à la ligne ramenés à un espace (l'objet d'un email doit tenir sur une ligne).
function propre(s) { return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 120); }

export function renderBienvenueEmail({ prenom = '' } = {}) {
  const p = propre(prenom);
  const salutation = p ? `Bonjour ${p},` : 'Bonjour,';
  const salutationHtml = p ? `Bonjour ${escapeHtml(p)},` : 'Bonjour,';
  const subject = 'Votre place est réservée sur Indépuls';

  const text = [
    salutation,
    '',
    'Merci pour votre inscription : votre place sur la liste d\'attente est réservée.',
    '',
    'Concrètement :',
    '- vous serez prévenu(e) en priorité à l\'ouverture, dans les prochaines semaines ;',
    '- vous garderez le prix de lancement de 19 € par mois, à vie ;',
    '- d\'ici là, vous n\'avez rien à faire et rien à payer.',
    '',
    'Une question m\'aiderait beaucoup : qu\'est-ce qui vous a donné envie de vous inscrire ? Répondez simplement à cet email, c\'est moi qui lis les réponses.',
    '',
    `En attendant, vous pouvez explorer la démo : ${DEMO_URL}`,
    '',
    'À très vite,',
    'Faustine, fondatrice d\'Indépuls',
    '',
    'Vous ne souhaitez plus être sur la liste ? Répondez « stop » à cet email et je vous retire.',
  ].join('\n');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1EFEA;font-family:Arial,Helvetica,sans-serif;color:#141538;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EFEA;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;padding:32px 30px;">
<tr><td style="font-size:15.5px;line-height:1.65;color:#141538;">
<p style="margin:0 0 16px;">${salutationHtml}</p>
<p style="margin:0 0 16px;">Merci pour votre inscription : votre place sur la liste d'attente est réservée.</p>
<p style="margin:0 0 8px;">Concrètement :</p>
<ul style="margin:0 0 16px;padding-left:20px;">
<li style="margin:0 0 6px;">vous serez prévenu(e) en priorité à l'ouverture, dans les prochaines semaines ;</li>
<li style="margin:0 0 6px;">vous garderez le prix de lancement de <strong>19&nbsp;€ par mois, à vie</strong> ;</li>
<li style="margin:0;">d'ici là, vous n'avez rien à faire et rien à payer.</li>
</ul>
<p style="margin:0 0 16px;">Une question m'aiderait beaucoup : qu'est-ce qui vous a donné envie de vous inscrire ? Répondez simplement à cet email, c'est moi qui lis les réponses.</p>
<p style="margin:0 0 22px;">En attendant, vous pouvez <a href="${DEMO_URL}" style="color:#5B2C4A;font-weight:bold;">explorer la démo</a>.</p>
<p style="margin:0;">À très vite,<br><strong>Faustine</strong>, fondatrice d'Indépuls</p>
</td></tr></table>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#7a7a8a;">Vous ne souhaitez plus être sur la liste ? Répondez « stop » à cet email et je vous retire.</p>
</td></tr></table></body></html>`;

  return { subject, html, text };
}

export function renderAlerteEmail({ prenom = '', email = '', metier = '', bienvenueEnvoyee = false, dejaInscrit = false, raison = null } = {}) {
  const p = propre(prenom), m = propre(metier), e = propre(email);
  const qui = [p || e, m].filter(Boolean).join(', ');
  const subject = `Nouvelle inscription : ${qui}${dejaInscrit ? ' (déjà inscrite)' : ''}`;

  let statut;
  if (bienvenueEnvoyee) statut = 'L\'email de bienvenue lui a été envoyé automatiquement.';
  else if (dejaInscrit) statut = 'Cette adresse était déjà sur la liste : pas de second email de bienvenue.';
  else if (raison === 'rafale') statut = `Plus de ${MAX_BIENVENUES_PAR_HEURE} inscriptions en une heure : email de bienvenue suspendu (robot probable). À vérifier dans Supabase.`;
  else statut = 'L\'email de bienvenue n\'a pas pu être envoyé : pense à lui écrire toi-même.';

  const ligne = (label, val) => `<tr><td style="padding:4px 14px 4px 0;color:#7a7a8a;">${label}</td><td style="padding:4px 0;font-weight:bold;">${escapeHtml(val || '(non renseigné)')}</td></tr>`;
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;font-family:Arial,Helvetica,sans-serif;color:#141538;font-size:15px;line-height:1.6;">
<p style="margin:0 0 12px;"><strong>Nouvelle inscription sur la liste d'attente.</strong></p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">${ligne('Prénom', p)}${ligne('Email', e)}${ligne('Métier', m)}</table>
<p style="margin:0 0 10px;">${statut}</p>
<p style="margin:0;color:#7a7a8a;font-size:13px;">Répondre à cet email écrit directement à la personne.</p>
</body></html>`;

  return { subject, html };
}
