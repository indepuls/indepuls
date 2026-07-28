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

section('Actif, delta positif');
{
  const { html } = renderBriefHebdoEmailHtml({ inactif: false, score: 70, delta: 15, pilierFaible: 'remplissage' }, baseOpts);
  ok('affiche le score', html.includes('70'));
  ok('mentionne la progression avec le bon delta', /\+?15/.test(html));
  ok('pilier remplissage → texte planning', /planning/i.test(html));
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
