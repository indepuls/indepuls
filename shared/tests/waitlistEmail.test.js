// ── TESTS : shared/core/waitlistEmail.js (2026-10-02) ─────────────────────────
// Emails déclenchés à chaque inscription sur la liste d'attente (api/waitlist-notify.js) :
// bienvenue à l'inscrit + alerte à Faustine. Fonctions pures, sans réseau ni DOM.

import { decideEnvoiBienvenue, renderBienvenueEmail, renderAlerteEmail, MAX_BIENVENUES_PAR_HEURE } from '../core/waitlistEmail.js';

let passed = 0, failed = 0;
function ok(label, cond) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}
function section(title) { console.log(`\n── ${title}`); }

section('decideEnvoiBienvenue : première inscription, rythme normal');
{
  const d = decideEnvoiBienvenue({ nbMemeEmail: 1, nbDerniereHeure: 1 });
  ok('envoie la bienvenue', d.bienvenue === true);
  ok('pas marquée déjà inscrite', d.dejaInscrit === false);
}

section('decideEnvoiBienvenue : même adresse déjà présente');
{
  const d = decideEnvoiBienvenue({ nbMemeEmail: 2, nbDerniereHeure: 2 });
  ok('pas de 2e bienvenue', d.bienvenue === false);
  ok('marquée déjà inscrite', d.dejaInscrit === true);
  ok('raison explicite', d.raison === 'deja_inscrit');
}

section('decideEnvoiBienvenue : rafale (robot probable)');
{
  const limite = decideEnvoiBienvenue({ nbMemeEmail: 1, nbDerniereHeure: MAX_BIENVENUES_PAR_HEURE });
  ok('à la limite exacte : encore envoyée', limite.bienvenue === true);
  const d = decideEnvoiBienvenue({ nbMemeEmail: 1, nbDerniereHeure: MAX_BIENVENUES_PAR_HEURE + 1 });
  ok('au-delà : plus de bienvenue', d.bienvenue === false);
  ok('raison explicite', d.raison === 'rafale');
}

section('decideEnvoiBienvenue : comptages absents (lecture Supabase échouée)');
{
  const d = decideEnvoiBienvenue({});
  ok('par prudence, envoie quand même (1 seule inscription supposée)', d.bienvenue === true);
}

section('renderBienvenueEmail : contenu validé par Faustine');
{
  const { subject, html, text } = renderBienvenueEmail({ prenom: 'Marie' });
  ok('objet', subject === 'Votre place est réservée sur Indépuls');
  ok('salue par le prénom', html.includes('Bonjour Marie,') && text.includes('Bonjour Marie,'));
  ok('prix garanti à vie', html.includes('19&nbsp;€ par mois, à vie') && text.includes('19 € par mois, à vie'));
  ok('rien à payer', html.includes('rien à payer'));
  ok('question ouverte', html.includes('qu\'est-ce qui vous a donné envie de vous inscrire'));
  ok('lien démo', html.includes('https://indepuls.fr/demo/'));
  ok('désinscription par « stop »', html.includes('stop') && text.includes('stop'));
  ok('signé Faustine', html.includes('Faustine') && text.includes('Faustine'));
  ok('aucun tiret cadratin', !html.includes('—') && !text.includes('—') && !subject.includes('—'));
}

section('renderBienvenueEmail : sans prénom');
{
  const { html, text } = renderBienvenueEmail({ prenom: '' });
  ok('« Bonjour, » sans espace orphelin', html.includes('Bonjour,') && text.includes('Bonjour,') && !html.includes('Bonjour ,'));
}

section('renderBienvenueEmail : saisie malveillante échappée');
{
  const { html } = renderBienvenueEmail({ prenom: '<script>alert(1)</script>' });
  ok('aucune balise injectée', !html.includes('<script>'));
  ok('texte échappé', html.includes('&lt;script&gt;'));
}

section('renderAlerteEmail : nouvelle inscription');
{
  const { subject, html } = renderAlerteEmail({ prenom: 'Marie', email: 'marie@exemple.fr', metier: 'Coach', bienvenueEnvoyee: true, dejaInscrit: false });
  ok('objet avec prénom et métier', subject === 'Nouvelle inscription : Marie, Coach');
  ok('email visible', html.includes('marie@exemple.fr'));
  ok('confirme la bienvenue envoyée', html.includes('email de bienvenue lui a été envoyé'));
}

section('renderAlerteEmail : déjà inscrite / rafale / champs vides');
{
  const deja = renderAlerteEmail({ prenom: 'Marie', email: 'm@x.fr', metier: '', bienvenueEnvoyee: false, dejaInscrit: true });
  ok('objet signale la réinscription', deja.subject.includes('déjà inscrite'));
  ok('pas de métier : objet propre', !deja.subject.includes(', ,') && !deja.subject.endsWith(','));
  const rafale = renderAlerteEmail({ prenom: '', email: 'bot@x.fr', metier: '', bienvenueEnvoyee: false, dejaInscrit: false, raison: 'rafale' });
  ok('rafale expliquée', rafale.html.includes('inscriptions en une heure'));
  ok('sans prénom : objet lisible', rafale.subject === 'Nouvelle inscription : bot@x.fr');
  const xss = renderAlerteEmail({ prenom: '<b>x</b>', email: 'a@b.c', metier: '<img src=x>', bienvenueEnvoyee: true, dejaInscrit: false });
  ok('saisie échappée dans l\'alerte', !xss.html.includes('<img src=x>') && !xss.html.includes('<b>x</b>'));
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
