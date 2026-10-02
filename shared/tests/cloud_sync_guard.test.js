// Garde-fou statique — protège contre la réapparition du bug de perte de données cloud
// (2026-07-13, voir CLAUDE.md "FIX CRITIQUE — Perte de données cloud").
//
// Ce n'est PAS un test d'intégration (loadFromCloud/syncToCloud sont des closures privées,
// non exposées sur window, jamais appelables depuis un test Node classique). C'est un filet
// beaucoup plus modeste mais réel : il vérifie par analyse de texte que les 2 règles
// non négociables sont toujours écrites dans indepuls.html, et échoue bruyamment sinon.
// Objectif : qu'une régression soit détectée en quelques secondes en lançant ce script,
// plutôt que découverte des semaines plus tard par un compte utilisateur écrasé.
//
// À lancer avant tout commit touchant loadData(), loadFromCloud(), syncToCloud(),
// loadDemoWithCurrentParams() ou authLoadDemo() — et idéalement avant chaque push.

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', '..', 'indepuls.html');
const html = fs.readFileSync(htmlPath, 'utf8');

let failures = [];

function extractFunctionBlock(source, signature, windowSize) {
  const idx = source.indexOf(signature);
  if (idx === -1) return null;
  return source.slice(idx, idx + windowSize);
}

// ── Règle 1 (13 juillet) : loadFromCloud() doit TOUJOURS charger les données cloud ──
// existantes dès qu'elles existent pour l'utilisateur authentifié, sans condition sur
// l'état local (DATA.isExample ou autre).
// Fenêtre élargie le 2026-08 : la garde anti-contamination inter-comptes (estampille _ownerUid)
// ajoute ~1400 caractères en tête de loadFromCloud, repoussant la condition du 13 juillet plus
// bas dans la fonction. La règle est inchangée, seule la fenêtre de scan grandit pour la contenir.
const loadBlock = extractFunctionBlock(html, 'async function loadFromCloud', 3600);
if (!loadBlock) {
  failures.push('loadFromCloud() introuvable dans indepuls.html — fonction renommée ou déplacée ? Ce garde-fou doit être mis à jour.');
} else {
  if (/if\s*\(\s*res\.data\s*&&\s*res\.data\.data\s*&&\s*!DATA\.isExample\s*\)/.test(loadBlock)) {
    failures.push(
      'RÉGRESSION CRITIQUE — loadFromCloud() bloque de nouveau le chargement des données ' +
      'cloud existantes quand DATA.isExample est vrai. C\'est exactement le bug du 13 juillet 2026 ' +
      '(un résidu local de mode démo empêchait de charger les vraies données cloud). ' +
      'Règle : une session authentifiée avec des données cloud existantes doit TOUJOURS l\'emporter.'
    );
  }
  if (!/if\s*\(\s*res\.data\s*&&\s*res\.data\.data\s*\)\s*\{/.test(loadBlock)) {
    failures.push(
      'loadFromCloud() : la condition de chargement attendue (if (res.data && res.data.data) {) ' +
      'est introuvable ou a changé de forme — vérifier manuellement que la règle du 13 juillet tient toujours.'
    );
  }
}

// ── Règle 2 (13 juillet, renforcée 21 juillet) : syncToCloud() ne doit JAMAIS envoyer ──
// de données de démo vers le cloud, quelle que soit la raison qui a mené à cet état —
// y compris si DATA change de référence pendant l'attente réseau de la fonction.
const syncBlock = extractFunctionBlock(html, 'async function syncToCloud', 2200);
if (!syncBlock) {
  failures.push('syncToCloud() introuvable dans indepuls.html — fonction renommée ou déplacée ? Ce garde-fou doit être mis à jour.');
} else {
  if (!/if\s*\(\s*DATA\.isExample\s*\)\s*return;/.test(syncBlock)) {
    failures.push(
      'RÉGRESSION CRITIQUE — syncToCloud() ne commence plus par "if (DATA.isExample) return;". ' +
      'Sans ce garde-fou, une session en mode démo peut écraser silencieusement les vraies ' +
      'données cloud au prochain saveData(). C\'est le dernier rempart du fix du 13 juillet 2026.'
    );
  }
  if (!/const\s+_snapshot\s*=\s*DATA\s*;/.test(syncBlock)) {
    failures.push(
      'RÉGRESSION — syncToCloud() ne capture plus DATA dans une référence figée (_snapshot) ' +
      'avant l\'attente réseau. Sans cette capture, un changement de profil/démo survenant ' +
      'pendant l\'await peut envoyer du contenu démo au cloud malgré le garde-fou ci-dessus ' +
      '(bug du 21 juillet 2026, voir CLAUDE.md).'
    );
  }
  if (!/_snapshot\.isExample/.test(syncBlock)) {
    failures.push(
      'RÉGRESSION — syncToCloud() ne revérifie plus _snapshot.isExample après l\'attente réseau. ' +
      'La revérification post-await est nécessaire même avec la capture ci-dessus.'
    );
  }
}

// ── Règle 3 (2026-10-02, palier A multi-associés) : en lecture seule d'un compte partagé ──
// (window._lectureSeule), DATA contient les données d'une AUTRE personne. Aucune écriture ne doit
// alors jamais partir, ni vers le cache local ni vers le cloud. Chaque porte d'écriture doit
// commencer par vérifier ce verrou : saveData() (cache local), le wrapper window.saveData,
// syncToCloud() (cloud), le rechargement au retour sur l'onglet, l'import et la réinitialisation.
const portesLectureSeule = [
  ['function saveData()', 900, 'saveData() (cache local)'],
  ['window.saveData = function', 300, 'wrapper window.saveData'],
  ['async function syncToCloud', 700, 'syncToCloud() (cloud)'],
  ['async function _verifierFraicheurCloud', 500, 'rechargement au retour sur l\'onglet'],
  ['function handleImport', 300, 'import d\'une sauvegarde'],
  ['async function confirmReset', 500, 'réinitialisation du compte'],
];
portesLectureSeule.forEach(([signature, fenetre, nom]) => {
  const bloc = extractFunctionBlock(html, signature, fenetre);
  if (!bloc) {
    failures.push(nom + ' introuvable dans indepuls.html (' + signature + '), fonction renommée ou déplacée ? Ce garde-fou doit être mis à jour.');
  } else if (!/window\._lectureSeule/.test(bloc)) {
    failures.push(
      'RÉGRESSION CRITIQUE : ' + nom + ' ne vérifie plus window._lectureSeule en tête de fonction. ' +
      'Sans ce verrou, la consultation du compte d\'une autre personne (palier A multi-associés) ' +
      'pourrait écrire SES données dans le cache local ou le cloud du membre connecté.'
    );
  }
});

// ── Règle 4 (2026-10-02, étape 2 multi-associés) : en mode partagé (window._partage), la ligne cloud
// est écrite par PLUSIEURS personnes. Aucune porte d'écriture ne doit alors suivre le chemin solo
// (upsert aveugle, rechargement brut, cache local d'un membre, import, réinitialisation) : chacune
// doit tester window._partage AVANT d'écrire. Sans cela, une personne écraserait le travail de l'autre.
const portesPartage = [
  ['function saveData()', 1300, 'saveData() (pas de cache local pour un membre)'],
  ['async function syncToCloud', 900, 'syncToCloud() (pas d\'upsert solo en mode partagé)'],
  ['async function _verifierFraicheurCloud', 700, 'rechargement au retour sur l\'onglet (fusion, pas de rechargement brut)'],
  ['function handleImport', 400, 'import d\'une sauvegarde'],
  ['async function confirmReset', 600, 'réinitialisation du compte'],
];
portesPartage.forEach(([signature, fenetre, nom]) => {
  const bloc = extractFunctionBlock(html, signature, fenetre);
  if (!bloc) failures.push(nom + ' introuvable dans indepuls.html (' + signature + '). Garde-fou à mettre à jour.');
  else if (!/window\._partage/.test(bloc)) {
    failures.push('RÉGRESSION CRITIQUE : ' + nom + ' ne tient plus compte de window._partage. Dans un compte partagé, ' +
      'cette porte d\'écriture écraserait en aveugle le travail des autres personnes.');
  }
});
// L'upsert solo ne doit jamais précéder le test _partage dans syncToCloud.
{
  const bloc = extractFunctionBlock(html, 'async function syncToCloud', 4000) || '';
  const iPartage = bloc.indexOf('window._partage');
  const iUpsert = bloc.indexOf('.upsert(');
  if (iPartage === -1 || iUpsert === -1 || iPartage > iUpsert) {
    failures.push('RÉGRESSION CRITIQUE : dans syncToCloud(), le test window._partage doit précéder l\'upsert solo.');
  }
}

if (failures.length) {
  console.error('❌ GARDE-FOU CLOUD SYNC — ' + failures.length + ' problème(s) détecté(s)\n');
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`));
  console.error('Voir CLAUDE.md, section "FIX CRITIQUE — Perte de données cloud" (2026-07-13) et son suivi du 21 juillet.');
  console.error('Ne PAS pousser en production tant que ce test échoue.');
  process.exit(1);
} else {
  console.log('✅ Garde-fou cloud sync : les règles anti-perte-de-données sont bien en place (2 règles du 13 juillet et verrous de lecture seule).');
}
