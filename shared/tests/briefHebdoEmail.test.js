// ── TESTS : shared/core/briefHebdoEmail.js — renderBriefHebdoEmailHtml() ─────
// Chantier "brief hebdomadaire par email", phase 3/4 (2026-07-27). Gabarit HTML pur : prend la
// décision de la phase 2 ({inactif, score, delta, pilierFaible}) + quelques chaînes fournies par
// l'appelant (jamais lues depuis DATA ici — séparation stricte décision/affichage), retourne
// {subject, html}. Aucune dépendance au DOM (doit pouvoir tourner côté serveur, Deno/Node, sans
// navigateur).

import { renderBriefHebdoEmailHtml } from '../core/briefHebdoEmail.js';

let passed = 0, failed = 0;
function ok(label, cond) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}
function section(title) { console.log(`\n── ${title}`); }

const baseOpts = { prenom: 'Faustine', appUrl: 'https://indepuls.example/app', unsubscribeUrl: 'https://indepuls.example/unsub?u=abc' };

section('Inactif — jamais de chiffre de score, uniquement la relance douce');
{
  const { subject, html } = renderBriefHebdoEmailHtml({ inactif: true, score: null, delta: null, pilierFaible: null }, baseOpts);
  ok('sujet non vide', subject && subject.length > 0);
  ok('mentionne Faustine (personnalisation)', html.includes('Faustine'));
  ok('ton positif, jamais culpabilisant ("oublié")', !/oubli/i.test(html));
  ok('ne mentionne aucun score chiffré', !/Score de Santé est de \d/.test(html));
  ok('contient le lien app', html.includes(baseOpts.appUrl));
  ok('contient le lien de désabonnement', html.includes(baseOpts.unsubscribeUrl));
}

section('Actif, sans comparaison possible (delta=null)');
{
  const { html } = renderBriefHebdoEmailHtml({ inactif: false, score: 62, delta: null, pilierFaible: 'horizon' }, baseOpts);
  ok('affiche le score', html.includes('62'));
  ok('ne fabrique pas de comparaison', !/points? (de plus|de moins|gagnés|perdus)/i.test(html));
  ok('mentionne le pilier faible (horizon → trajectoire annuelle)', /trajectoire annuelle/i.test(html));
}

section('Actif, delta positif — jamais de "+" redondant, jamais de faiblesse après une bonne nouvelle');
{
  const { html, subject } = renderBriefHebdoEmailHtml({ inactif: false, score: 70, delta: 15, pilierFaible: 'remplissage' }, baseOpts);
  ok('affiche le score', html.includes('70'));
  ok('mentionne le delta', html.includes('15'));
  // Retour Faustine 2026-07-28 : "de plus" suit déjà le chiffre, le "+" devant est redondant.
  ok('pas de "+15" (le "+" est redondant avec "de plus" juste après)', !html.includes('+15'));
  // Retour Faustine 2026-07-28 : ne jamais faire suivre une bonne nouvelle d'une remarque sur
  // une faiblesse — ça retombe l'ambiance juste après avoir félicité.
  ok('ne mentionne PAS le pilier faible malgré pilierFaible=remplissage (progression positive)', !/planning/i.test(html));
  ok('affiche un encouragement générique à la place', /lancée/i.test(html));
  ok('sujet sans "+" non plus', !subject.includes('+15'));
}

section('Actif, delta négatif — ton "élan", jamais alarmiste');
{
  const { html } = renderBriefHebdoEmailHtml({ inactif: false, score: 45, delta: -18, pilierFaible: 'trésorerie' }, baseOpts);
  ok('affiche le score', html.includes('45'));
  ok('affiche le delta (18, sans forcément le signe textuel alarmiste)', html.includes('18'));
  ok('jamais de mot alarmiste', !/(catastrophe|alerte rouge|urgent|danger)/i.test(html));
  ok('pilier trésorerie → texte encaissements/relance', /(encaissement|relance)/i.test(html));
}

section('Échappement HTML — prénom avec caractères spéciaux');
{
  const { html } = renderBriefHebdoEmailHtml(
    { inactif: false, score: 50, delta: null, pilierFaible: 'rentabilité' },
    { ...baseOpts, prenom: '<script>alert(1)</script>' }
  );
  ok('le prénom est échappé, jamais injecté tel quel', !html.includes('<script>alert(1)</script>'));
  ok('pilier rentabilité → texte tarifs/taux horaire', /(tarif|taux horaire)/i.test(html));
}

section('Vocabulaire interdit (convention déjà en place dans tout le produit)');
{
  const cas = [
    { inactif: true, score: null, delta: null, pilierFaible: null },
    { inactif: false, score: 30, delta: -5, pilierFaible: 'remplissage' },
    { inactif: false, score: 90, delta: 8, pilierFaible: 'horizon' },
  ];
  cas.forEach((d, i) => {
    const { html } = renderBriefHebdoEmailHtml(d, baseOpts);
    ok(`cas #${i} — jamais "il manque"`, !/il manque/i.test(html));
  });
}

section('Encodage — meta charset UTF-8 (retour visuel : accents cassés sans elle, "IndÃ©puls")');
{
  const { html } = renderBriefHebdoEmailHtml({ inactif: false, score: 62, delta: null, pilierFaible: null }, baseOpts);
  ok('déclare <meta charset="utf-8"> dans le <head>', /<meta charset="utf-8">/i.test(html));
  ok('le <head> précède le <body>', html.indexOf('<head>') < html.indexOf('<body'));
}

section('Aucun tiret cadratin dans les textes (retour Faustine 2026-07-27 — "trop étiqueté IA")');
{
  const cas = [
    { inactif: true, score: null, delta: null, pilierFaible: null },
    { inactif: false, score: 62, delta: null, pilierFaible: 'horizon' },
    { inactif: false, score: 70, delta: 15, pilierFaible: 'remplissage' },
    { inactif: false, score: 45, delta: -18, pilierFaible: 'trésorerie' },
  ];
  cas.forEach((d, i) => {
    const { html, subject } = renderBriefHebdoEmailHtml(d, baseOpts);
    ok(`cas #${i} — pas de "—" dans le HTML`, !html.includes('—'));
    ok(`cas #${i} — pas de "—" dans le sujet`, !subject.includes('—'));
  });
}

section('Petit visuel — barre de score (jamais un compteur de série/streak)');
{
  const { html: htmlActif } = renderBriefHebdoEmailHtml({ inactif: false, score: 74, delta: null, pilierFaible: null }, baseOpts);
  ok('la barre de score est présente quand un score existe', /background:#84cc16/.test(htmlActif));
  const { html: htmlInactif } = renderBriefHebdoEmailHtml({ inactif: true, score: null, delta: null, pilierFaible: null }, baseOpts);
  ok('aucune barre affichée en mode inactif (rien à mesurer)', !/border-radius:6px;height:10px/.test(htmlInactif));
  ok('jamais de mot "série" ou "streak" (pas de mécanique à préserver)', !/(série|streak|jours? consécutifs?)/i.test(htmlActif));
}

section('En-tête — logo réel si fourni, repli texte sinon');
{
  const { html: sansLogo } = renderBriefHebdoEmailHtml({ inactif: false, score: 60, delta: null, pilierFaible: null }, baseOpts);
  ok('sans logoUrl : repli sur le texte "Indépuls"', /Indépuls<\/span>/.test(sansLogo));
  ok('sans logoUrl : aucune balise <img>', !sansLogo.includes('<img'));

  const { html: avecLogo } = renderBriefHebdoEmailHtml(
    { inactif: false, score: 60, delta: null, pilierFaible: null },
    { ...baseOpts, logoUrl: 'data:image/png;base64,AAAA' }
  );
  ok('avec logoUrl : balise <img> présente', avecLogo.includes('<img'));
  ok('avec logoUrl : src correct', avecLogo.includes('src="data:image/png;base64,AAAA"'));
  ok('avec logoUrl : alt renseigné (images bloquées par défaut chez de nombreux clients)', avecLogo.includes('alt="Indépuls"'));
}

section('CTA adapté au contenu affiché (retour Faustine 2026-07-28)');
{
  const { html: htmlInactif } = renderBriefHebdoEmailHtml({ inactif: true, score: null, delta: null, pilierFaible: null }, baseOpts);
  ok('inactif → CTA "Voir mon Score de Santé"', htmlInactif.includes('>Voir mon Score de Santé<'));

  const { html: htmlTreso } = renderBriefHebdoEmailHtml({ inactif: false, score: 45, delta: -18, pilierFaible: 'trésorerie' }, baseOpts);
  ok('pilier trésorerie (négatif) → CTA "Relancer mes encaissements"', htmlTreso.includes('>Relancer mes encaissements<'));

  const { html: htmlRemplissage } = renderBriefHebdoEmailHtml({ inactif: false, score: 50, delta: null, pilierFaible: 'remplissage' }, baseOpts);
  ok('pilier remplissage (sans comparaison) → CTA "Voir mon planning"', htmlRemplissage.includes('>Voir mon planning<'));

  const { html: htmlPositif } = renderBriefHebdoEmailHtml({ inactif: false, score: 70, delta: 15, pilierFaible: 'remplissage' }, baseOpts);
  ok('progression positive → CTA générique (aucune faiblesse mise en avant)', htmlPositif.includes('>Ouvrir Indépuls<'));
}

section('Pilier inconnu ou absent — pas de crash, texte de repli générique');
{
  const { html } = renderBriefHebdoEmailHtml({ inactif: false, score: 55, delta: null, pilierFaible: 'inexistant' }, baseOpts);
  ok('rend quand même une phrase', html.length > 0);
  const { html: html2 } = renderBriefHebdoEmailHtml({ inactif: false, score: 55, delta: null, pilierFaible: null }, baseOpts);
  ok('pilierFaible=null ne casse rien', html2.length > 0);
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
