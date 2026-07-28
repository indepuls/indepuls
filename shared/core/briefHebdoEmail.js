// ── BRIEF HEBDOMADAIRE PAR EMAIL — GABARIT (chantier 2026-07-27, phase 3/4) ──
// Prend la décision pure de briefHebdo.js (phase 2) + quelques chaînes fournies par l'appelant
// (jamais lues depuis DATA ici — séparation stricte décision/affichage) et rend {subject, html}.
// Zéro dépendance au DOM : doit pouvoir tourner côté serveur (Deno/Node, phase 4) sans navigateur.
//
// Contraintes propres au HTML email (différentes du web classique) : pas de flexbox/grid, pas de
// variables CSS, styles UNIQUEMENT en inline (beaucoup de clients ignorent ou cassent un
// <style> externe) — mise en page en table, une seule colonne, polices web-safe avec repli.

import { escapeHtml } from './utils.js';

const COULEURS = { marine: '#141538', prune: '#5B2C4A', creme: '#F1EFEA', beige: '#BB9E81' };

// Textes volontairement génériques et courts (pas un miroir du Brief in-app — voir CLAUDE.md,
// phase 3 : le rôle de cet email est de signaler une tendance, pas de dupliquer le détail déjà
// visible dans l'app). Un seul chiffre, une seule action, ton "élan" déjà en place partout
// ailleurs dans le produit — jamais "il manque", jamais alarmiste.
const ACTION_PAR_PILIER = {
  'rentabilité': 'Un rapide coup d\'œil à vos tarifs ou votre taux horaire pourrait faire la différence cette semaine.',
  'remplissage': 'Il reste de la place dans votre planning à combler cette semaine.',
  'trésorerie': 'Quelques encaissements méritent une relance cette semaine.',
  'horizon': 'Votre trajectoire annuelle mérite un point rapide cette semaine.',
};
const ACTION_PAR_DEFAUT = 'Direction Indépuls pour voir où concentrer votre attention cette semaine.';

function messageCorps(decision) {
  if (decision.inactif) {
    return 'Ça fait une semaine qu\'on ne vous a pas revue — 2 minutes suffisent pour garder une vue à jour sur votre activité.';
  }
  const action = ACTION_PAR_PILIER[decision.pilierFaible] || ACTION_PAR_DEFAUT;
  let phraseScore;
  if (decision.delta == null) {
    phraseScore = `Votre Score de Santé est de <strong>${decision.score}/100</strong> cette semaine.`;
  } else if (decision.delta > 0) {
    phraseScore = `Votre Score de Santé est de <strong>${decision.score}/100</strong> cette semaine — <strong>+${decision.delta} points</strong> par rapport à la semaine dernière 👏`;
  } else if (decision.delta < 0) {
    phraseScore = `Votre Score de Santé est de <strong>${decision.score}/100</strong> cette semaine, en retrait de <strong>${Math.abs(decision.delta)} points</strong> par rapport à la semaine dernière.`;
  } else {
    phraseScore = `Votre Score de Santé est stable à <strong>${decision.score}/100</strong> cette semaine.`;
  }
  return `${phraseScore}<br>${action}`;
}

function sujet(decision) {
  if (decision.inactif) return 'On ne vous a pas revue cette semaine 👋';
  return `Votre Score de Santé : ${decision.score}/100 cette semaine`;
}

export function renderBriefHebdoEmailHtml(decision, { prenom = '', appUrl = '#', unsubscribeUrl = '#' } = {}) {
  const prenomSafe = escapeHtml(prenom);
  const salutation = prenomSafe ? `Bonjour ${prenomSafe},` : 'Bonjour,';
  const corps = messageCorps(decision);
  const subject = sujet(decision);

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:${COULEURS.creme};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COULEURS.creme};padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:${COULEURS.marine};padding:18px 28px;">
            <span style="color:${COULEURS.creme};font-size:18px;font-weight:bold;">Indépuls</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:${COULEURS.marine};font-size:15px;line-height:1.6;">
            <p style="margin:0 0 16px 0;">${salutation}</p>
            <p style="margin:0 0 24px 0;">${corps}</p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr><td style="background:${COULEURS.prune};border-radius:8px;">
                <a href="${appUrl}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">Ouvrir Indépuls</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;background:${COULEURS.creme};font-size:11px;color:${COULEURS.beige};line-height:1.5;">
            Vous recevez ce récapitulatif hebdomadaire car vous l'avez activé dans vos réglages Indépuls.
            <a href="${unsubscribeUrl}" style="color:${COULEURS.beige};">Se désabonner</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
