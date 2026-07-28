// ── TESTS : shared/core/briefHebdo.js — doitEnvoyerBriefHebdo() ──────────────
// Chantier "brief hebdomadaire par email", phase 2bis (2026-07-28). Seuil de matérialité proposé
// par un audit externe (Claude Cowork) suite à un constat de Faustine : sans lui, une activité
// stable reçoit littéralement le même email chaque semaine (delta proche de zéro, même pilier
// faible d'une semaine à l'autre) — paradoxal puisque c'est justement le profil à fidéliser.
//
// Fonction pure : ne recalcule rien, se contente d'évaluer si au moins UNE des 4 conditions déjà
// posées est vraie. Les signaux (échéance, alerte, semaines depuis dernier envoi) sont fournis
// par l'appelant (futur cron, phase 4) — jamais recalculés ici, jamais lus depuis DATA.

import { doitEnvoyerBriefHebdo } from '../core/briefHebdo.js';

let passed = 0, failed = 0;
function ok(label, cond) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}
function section(title) { console.log(`\n── ${title}`); }

section('Inactif — toujours envoyé, c\'est le rôle même du rappel');
{
  const d = { inactif: true, score: null, delta: null, pilierFaible: null };
  ok('envoyé même sans aucun signal', doitEnvoyerBriefHebdo(d, {}));
  ok('envoyé même avec tous les signaux à "rien à signaler"', doitEnvoyerBriefHebdo(d, { echeanceProcheDaysLeft: 30, alerteActive: false, semainesDepuisDernierEnvoi: 0 }));
}

section('Delta — seuil de 5 points, dans un sens ou l\'autre');
{
  ok('delta=+5 (borne incluse) → envoyé', doitEnvoyerBriefHebdo({ inactif: false, score: 65, delta: 5, pilierFaible: 'horizon' }, {}));
  ok('delta=-5 (borne incluse) → envoyé', doitEnvoyerBriefHebdo({ inactif: false, score: 55, delta: -5, pilierFaible: 'horizon' }, {}));
  ok('delta=+4 → PAS envoyé (sous le seuil, aucun autre signal)', !doitEnvoyerBriefHebdo({ inactif: false, score: 64, delta: 4, pilierFaible: 'horizon' }, {}));
  ok('delta=-4 → PAS envoyé', !doitEnvoyerBriefHebdo({ inactif: false, score: 56, delta: -4, pilierFaible: 'horizon' }, {}));
  ok('delta=0 (activité parfaitement stable) → PAS envoyé sans autre signal', !doitEnvoyerBriefHebdo({ inactif: false, score: 60, delta: 0, pilierFaible: 'horizon' }, {}));
  ok('delta=null (pas de comparaison possible) → PAS envoyé sans autre signal', !doitEnvoyerBriefHebdo({ inactif: false, score: 60, delta: null, pilierFaible: 'horizon' }, {}));
}

section('Échéance fiscale proche (≤ 7 jours)');
{
  const stable = { inactif: false, score: 60, delta: 1, pilierFaible: 'horizon' };
  ok('échéance dans 7 jours (borne incluse) → envoyé malgré un delta stable', doitEnvoyerBriefHebdo(stable, { echeanceProcheDaysLeft: 7 }));
  ok('échéance dans 3 jours → envoyé', doitEnvoyerBriefHebdo(stable, { echeanceProcheDaysLeft: 3 }));
  ok('échéance dans 8 jours → PAS envoyé par ce seul signal', !doitEnvoyerBriefHebdo(stable, { echeanceProcheDaysLeft: 8 }));
  ok('échéance dans 30 jours → PAS envoyé', !doitEnvoyerBriefHebdo(stable, { echeanceProcheDaysLeft: 30 }));
}

section('Alerte concrète active (impayé...)');
{
  const stable = { inactif: false, score: 60, delta: 1, pilierFaible: 'horizon' };
  ok('alerteActive=true → envoyé malgré un delta stable', doitEnvoyerBriefHebdo(stable, { alerteActive: true }));
  ok('alerteActive=false → n\'ajoute rien', !doitEnvoyerBriefHebdo(stable, { alerteActive: false }));
}

section('Garde-fou — au moins un envoi toutes les 3-4 semaines');
{
  const stable = { inactif: false, score: 60, delta: 1, pilierFaible: 'horizon' };
  ok('3 semaines sans envoi (borne incluse) → envoyé malgré une activité stable', doitEnvoyerBriefHebdo(stable, { semainesDepuisDernierEnvoi: 3 }));
  ok('4 semaines sans envoi → envoyé', doitEnvoyerBriefHebdo(stable, { semainesDepuisDernierEnvoi: 4 }));
  ok('2 semaines sans envoi → PAS encore envoyé par ce seul signal', !doitEnvoyerBriefHebdo(stable, { semainesDepuisDernierEnvoi: 2 }));
  ok('0 semaine (email parti la semaine dernière) → PAS envoyé', !doitEnvoyerBriefHebdo(stable, { semainesDepuisDernierEnvoi: 0 }));
}

section('Aucun signal fourni du tout (objet vide ou omis) — ne casse rien');
{
  const stable = { inactif: false, score: 60, delta: 1, pilierFaible: 'horizon' };
  ok('signals={} → pas d\'erreur, pas envoyé (rien de matériel)', !doitEnvoyerBriefHebdo(stable, {}));
  ok('signals omis → pas d\'erreur, pas envoyé', !doitEnvoyerBriefHebdo(stable));
}

section('Activité stable sur plusieurs semaines de suite — le scénario initial de Faustine');
{
  // Semaine 1 : rien à signaler → pas envoyé. Semaine 2 : idem. Semaine 3 : garde-fou déclenché.
  const stable = { inactif: false, score: 60, delta: 0, pilierFaible: 'horizon' };
  ok('semaine 1 (0 depuis dernier envoi réel, pas de garde-fou encore) → pas envoyé', !doitEnvoyerBriefHebdo(stable, { semainesDepuisDernierEnvoi: 1 }));
  ok('semaine 2 → toujours pas envoyé', !doitEnvoyerBriefHebdo(stable, { semainesDepuisDernierEnvoi: 2 }));
  ok('semaine 3 → le garde-fou se déclenche, envoyé', doitEnvoyerBriefHebdo(stable, { semainesDepuisDernierEnvoi: 3 }));
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
