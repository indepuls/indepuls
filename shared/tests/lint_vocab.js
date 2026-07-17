/**
 * Lint consultatif — repère les mots de vocabulaire métier (mission/chantier/commande/vente…)
 * potentiellement écrits en dur dans indepuls.html, au lieu de passer par tVocab().
 *
 * Contexte : plusieurs bugs corrigés en 2026-07 venaient du même pattern — un texte censé
 * s'adapter au profil de l'utilisateur (ex. "Créez votre premier chantier") contenait en fait
 * le mot d'un seul profil en dur, visible aux autres profils dans un contexte qui n'avait pas
 * de sens ("Ajoutez un client ou un programme dès la création de votre mission" affiché à un
 * artisan bâtiment). Ce script automatise la première passe de détection.
 *
 * Ce N'EST PAS un test au sens strict : il ne fait jamais échouer une build (pas de process.exit
 * non-zéro), et il produit volontairement des faux positifs (voir ZONES EXCLUES ci-dessous) —
 * une revue humaine reste nécessaire sur chaque ligne signalée. Objectif : remplacer un audit
 * ponctuel complet par un balayage régulier et rapide, pas remplacer le jugement humain.
 *
 * Exécution : node shared/tests/lint_vocab.js
 * Aucune dépendance externe.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'indepuls.html');
const lines = fs.readFileSync(FILE, 'utf8').split('\n');

// ── 1. Extraction dynamique des mots à surveiller ──────────────────────────
// Lus directement depuis VOCABULARY_FAMILIES (item/items) plutôt que recopiés à la main ici :
// si un 5e profil est ajouté un jour, la liste se met à jour toute seule, sans script à
// retoucher. `client`/`acheteur` volontairement exclus : "Client" est déjà la valeur commune à
// 3 profils sur 4, le signaler produirait presque uniquement du bruit.
function extractVocabWords() {
  const startIdx = lines.findIndex(l => l.startsWith('const VOCABULARY_FAMILIES'));
  if (startIdx === -1) throw new Error('VOCABULARY_FAMILIES introuvable — le script doit être mis à jour.');
  const words = new Set();
  for (let i = startIdx; i < lines.length; i++) {
    const m = lines[i].match(/\b(?:item|items):\s*'([^']+)'/g);
    if (m) m.forEach(seg => {
      const val = seg.match(/'([^']+)'/)[1];
      val.split(/\s*\/\s*/).forEach(w => words.add(w.trim().toLowerCase())); // "Client / Acheteur" → 2 mots
    });
    if (lines[i].startsWith('};')) break; // fin du bloc
  }
  return [...words];
}

// ── 2. Zones exclues (vocabulaire légitimement en dur) ─────────────────────
// - Les blocs qui DÉFINISSENT le vocabulaire (VOCABULARY_FAMILIES et alentours) : c'est la
//   source de vérité, pas une fuite.
// - getExampleData() : les données de démo décrivent un vrai métier fictif en langage naturel
//   ("Coaching de groupe", missions d'un chantier précis…) — ça n'a pas à passer par tVocab().
const EXCLUDED_BLOCKS = [
  'const VOCABULARY_FAMILIES',
  'const BUSINESS_PROFILE_MAP',
  'const METIER_MIGRATION_FL',
  'const PROFIL_DESCRIPTIONS',
  'const PROFIL_LABELS',
  'function getExampleData',
];

function findExcludedRanges() {
  const ranges = [];
  for (const marker of EXCLUDED_BLOCKS) {
    const startIdx = lines.findIndex(l => l.startsWith(marker));
    if (startIdx === -1) continue; // marqueur renommé/déplacé — signalé en fin de script
    let depth = 0, started = false, endIdx = startIdx;
    for (let i = startIdx; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === '{') { depth++; started = true; }
        else if (ch === '}') depth--;
      }
      if (started && depth <= 0) { endIdx = i; break; }
    }
    ranges.push({ marker, start: startIdx, end: endIdx });
  }
  return ranges;
}

function isExcluded(lineIdx, ranges) {
  return ranges.some(r => lineIdx >= r.start && lineIdx <= r.end);
}

// ── 3. Balayage ─────────────────────────────────────────────────────────────
// Ne retient que les occurrences trouvées à l'intérieur d'un littéral de chaîne (entre
// guillemets/apostrophes/backticks) — élimine la quasi-totalité des faux positifs venant des
// identifiants de code (DATA.missions, chantierId, #page-missions…), qui ne sont jamais
// eux-mêmes entre guillemets suivis d'un texte en langage naturel.
function quotedSegments(line) {
  const segments = [];
  const re = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(line))) segments.push(m[2]);
  return segments;
}

function run() {
  const words = extractVocabWords();
  const excludedRanges = findExcludedRanges();
  const missingMarkers = EXCLUDED_BLOCKS.filter(m => !excludedRanges.some(r => r.marker === m));

  const findings = [];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) return;
    if (line.includes('tVocab(')) return; // ligne déjà dynamique
    if (isExcluded(idx, excludedRanges)) return;

    const segments = quotedSegments(line);
    if (!segments.length) return;

    for (const seg of segments) {
      // Ignore les segments sans espace : ce sont des identifiants/valeurs techniques
      // ('chantierId', 'achat_revente'...), jamais du texte affiché à l'utilisateur.
      if (!/\s/.test(seg)) continue;
      for (const word of words) {
        const re = new RegExp(`\\b${word}s?\\b`, 'i');
        if (re.test(seg)) {
          findings.push({ line: idx + 1, word, snippet: trimmed.slice(0, 140) });
          break; // un seul signalement par segment, même si plusieurs mots matchent
        }
      }
    }
  });

  console.log('═'.repeat(70));
  console.log('LINT VOCABULAIRE MÉTIER — indepuls.html');
  console.log('═'.repeat(70));
  console.log(`Mots surveillés : ${words.join(', ')}`);
  console.log(`Zones exclues   : ${excludedRanges.map(r => r.marker).join(', ')}`);
  if (missingMarkers.length) {
    console.log(`⚠️  Marqueurs introuvables (script à ajuster) : ${missingMarkers.join(', ')}`);
  }
  console.log('');

  if (findings.length === 0) {
    console.log('✅ Aucune occurrence suspecte trouvée.');
  } else {
    console.log(`${findings.length} occurrence(s) à vérifier à la main (faux positifs attendus) :\n`);
    findings.forEach(f => console.log(`  L${f.line} [${f.word}] ${f.snippet}`));
  }
  console.log('\nRappel : ce script ne fait jamais échouer une build — revue humaine requise.');
}

run();
