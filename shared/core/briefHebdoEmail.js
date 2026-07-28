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

// Bouton d'action (CTA) — adapté au pilier mis en avant plutôt qu'un "Ouvrir Indépuls" générique
// à chaque fois (retour Faustine 2026-07-28), sauf quand aucune action précise n'est pointée
// (score en hausse, aucun pilier faible connu).
const CTA_PAR_PILIER = {
  'rentabilité': 'Revoir mes tarifs',
  'remplissage': 'Voir mon planning',
  'trésorerie': 'Relancer mes encaissements',
  'horizon': 'Voir ma trajectoire',
};
const CTA_DEFAUT = 'Ouvrir Indépuls';
const CTA_INACTIF = 'Compléter ma semaine';

// Petit visuel du score (retour Faustine 2026-07-27, inspiration Duolingo "sans pression") : une
// simple barre colorée, jamais un compteur de série/streak — pas de notion de jours consécutifs
// à préserver, aucune mécanique qui pourrait culpabiliser en cas d'absence une semaine donnée.
// Mêmes seuils de couleur que le Score de Santé in-app (voir wScoreSante(), scoreColor).
// Tables imbriquées avec largeurs en pourcentage (pas de flexbox/grid) : le motif "barre de
// progression" le plus fiable en email, y compris sur Outlook.
function barreScore(score) {
  if (score == null) return '';
  const couleur = score >= 80 ? '#2d7a4f' : score >= 60 ? '#84cc16' : score >= 40 ? '#c97316' : score >= 20 ? '#f97316' : '#b91c1c';
  const pct = Math.max(0, Math.min(100, score));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0 0;">
              <tr><td style="background:#e0dcd6;border-radius:6px;height:10px;font-size:0;line-height:0;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="${pct}%" style="height:10px;">
                  <tr><td style="background:${couleur};border-radius:6px;height:10px;font-size:0;line-height:0;">&nbsp;</td></tr>
                </table>
              </td></tr>
            </table>`;
}

// Retourne {corps, cta} — corps est du HTML de niveau "bloc" (jamais enveloppé dans un <p> par
// l'appelant : un <table> imbriqué dans un <p> est invalide et casse le rendu sur certains
// clients email), cta le libellé du bouton d'action, adapté au contenu affiché.
function contenu(decision) {
  if (decision.inactif) {
    return {
      corps: '<p style="margin:0;">Ça fait une semaine qu\'on ne vous a pas revue. Deux minutes suffisent pour garder une vue à jour sur votre activité.</p>',
      cta: CTA_INACTIF,
    };
  }

  let phraseScore;
  if (decision.delta == null) {
    phraseScore = `Votre Score de Santé est de <strong>${decision.score}/100</strong> cette semaine.`;
  } else if (decision.delta > 0) {
    phraseScore = `Votre Score de Santé est de <strong>${decision.score}/100</strong> cette semaine, soit <strong>${decision.delta} points</strong> de plus que la semaine dernière 👏`;
  } else if (decision.delta < 0) {
    phraseScore = `Votre Score de Santé est de <strong>${decision.score}/100</strong> cette semaine, en retrait de <strong>${Math.abs(decision.delta)} points</strong> par rapport à la semaine dernière.`;
  } else {
    phraseScore = `Votre Score de Santé est stable à <strong>${decision.score}/100</strong> cette semaine.`;
  }

  // Ne jamais faire suivre une bonne nouvelle d'une remarque sur une faiblesse (retour Faustine
  // 2026-07-28 : ça retombe l'ambiance juste après avoir félicité). Uniquement dans ce cas, un
  // encouragement générique remplace le texte lié au pilier faible, et le bouton reste générique
  // (rien de précis à corriger n'est mis en avant).
  const masquerPilier = decision.delta > 0;
  const pilierTexte = masquerPilier ? 'Continuez sur cette lancée.' : (ACTION_PAR_PILIER[decision.pilierFaible] || ACTION_PAR_DEFAUT);
  const cta = masquerPilier ? CTA_DEFAUT : (CTA_PAR_PILIER[decision.pilierFaible] || CTA_DEFAUT);

  const corps = `<p style="margin:0;">${phraseScore}</p>${barreScore(decision.score)}<p style="margin:16px 0 0 0;">${pilierTexte}</p>`;
  return { corps, cta };
}

function sujet(decision) {
  if (decision.inactif) return 'On ne vous a pas revue cette semaine 👋';
  return `Votre Score de Santé : ${decision.score}/100 cette semaine`;
}

// En-tête : logo réel si fourni (logoUrl — data URI pour les aperçus locaux, URL hébergée en
// production, phase 4), repli sur le texte "Indépuls" sinon (ex. tests unitaires qui ne passent
// pas de logo). Le logo disponible (Indépuls_logo_navy_transparent.png) est en marine sur fond
// transparent : fond d'en-tête clair ici pour qu'il reste lisible, pas de bandeau marine plein
// comme dans la 1ʳᵉ version du gabarit. `alt` toujours renseigné : de nombreux clients email
// bloquent les images par défaut.
function enTete(logoUrl) {
  if (logoUrl) {
    return `<img src="${logoUrl}" alt="Indépuls" width="140" style="display:block;margin:0 auto;max-width:140px;height:auto;border:0;">`;
  }
  return `<span style="color:${COULEURS.marine};font-size:18px;font-weight:bold;">Indépuls</span>`;
}

export function renderBriefHebdoEmailHtml(decision, { prenom = '', appUrl = '#', unsubscribeUrl = '#', logoUrl = '' } = {}) {
  const prenomSafe = escapeHtml(prenom);
  const salutation = prenomSafe ? `Bonjour ${prenomSafe},` : 'Bonjour,';
  const { corps, cta } = contenu(decision);
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
          <td align="center" style="background:#ffffff;padding:24px 28px 16px 28px;border-bottom:2px solid ${COULEURS.prune};">
            ${enTete(logoUrl)}
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:${COULEURS.marine};font-size:15px;line-height:1.6;">
            <p style="margin:0 0 16px 0;">${salutation}</p>
            <div style="margin:0 0 24px 0;">${corps}</div>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr><td style="background:${COULEURS.prune};border-radius:8px;">
                <a href="${appUrl}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">${cta}</a>
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
