#!/usr/bin/env node
// ── REJEU HORS-LIGNE — mode ombre duplication B (audit externe 2026-07-26) ──────
// Outil d'analyse PONCTUEL (pas un test automatisé, pas exécuté en CI) : rejoue, sur des
// instantanés DATA réels déjà capturés (table Supabase `user_data_backups`, filet ajouté lors
// de l'incident du 13 juillet), la même comparaison que le mode ombre en production — mais hors
// ligne, ce soir, sans attendre 3 semaines de shadow-mode et sans rien envoyer nulle part.
//
// Usage :
//   node shared/scripts/replay_shadow_diff.js chemin/vers/snapshots.json
//
// Format attendu du fichier d'entrée : un tableau JSON d'objets DATA (la colonne `data` de
// chaque ligne de `user_data_backups`, exportée depuis le SQL Editor Supabase — "Export as JSON"
// sur le résultat d'un SELECT). Rien n'est envoyé sur le réseau ; tout reste local.
//
// Important — limite connue : ces instantanés sont capturés APRÈS que loadData() a déjà
// appliqué migrate()/applyDefaults() localement dans le navigateur (le trigger Supabase se
// déclenche sur syncToCloud(), qui suit toujours saveData()). Ce rejeu revalide donc surtout
// l'IDEMPOTENCE d'applyDefaults() sur des données déjà migrées, pas les branches de migration
// elles-mêmes (celles-ci ont vraisemblablement déjà tourné côté client avant la capture). Le
// mode ombre en continu (voir indepuls.html, _shadowCheckStorageMigration) reste la seule preuve
// qui couvre aussi les branches de migration sur des comptes pas encore rechargés depuis.

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node shared/scripts/replay_shadow_diff.js chemin/vers/snapshots.json');
    process.exit(1);
  }

  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'indepuls.html'), 'utf8');
  const extract = (name) => {
    const re = new RegExp(`function ${name}\\s*\\([^)]*\\)\\s*\\{`, 'm');
    const m = re.exec(html);
    if (!m) throw new Error(`Fonction ${name}() introuvable dans indepuls.html`);
    let depth = 0, start = m.index + m[0].length - 1, i = start;
    do {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') depth--;
      i++;
    } while (depth > 0 && i < html.length);
    return html.slice(m.index, i);
  };

  // Extraction directe des fonctions live d'indepuls.html — comparaison fidèle, pas une
  // réimplémentation approchée qui pourrait elle-même diverger.
  const getDefaultModulesSrc = extract('getDefaultModules');
  const uuidSrc  = extract('uuid');
  const todaySrc = extract('today');
  const migrateSrc = extract('migrate');
  const applyDefaultsSrc = extract('applyDefaults');
  const getDefaultDataSrc = extract('getDefaultData');

  const SCHEMA_VERSION = 33; // tenu à jour manuellement — voir `const SCHEMA_VERSION` dans indepuls.html
  const sandbox = new Function(
    'getTauxStatut', 'SCHEMA_VERSION',
    `
    ${getDefaultModulesSrc}
    ${uuidSrc}
    ${todaySrc}
    ${getDefaultDataSrc}
    ${migrateSrc}
    ${applyDefaultsSrc}
    return { getDefaultModules, uuid, today, getDefaultData, migrate, applyDefaults };
    `
  );
  // getTauxStatut n'est utilisé que par getDefaultData() (taux par défaut) — un stub suffit
  // pour ce rejeu, qui compare toujours les MÊMES params fournis en entrée, jamais ce défaut.
  const liveFns = sandbox(() => ({ urssafPresta: 0, cfpPresta: 0, urssafVente: 0, cfpVente: 0 }), SCHEMA_VERSION);

  const S = await import(pathToFileURL(path.join(__dirname, '..', 'core', 'storage.js')).href);
  const D = await import(pathToFileURL(path.join(__dirname, '..', 'core', 'diff.js')).href);

  const snapshots = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const list = Array.isArray(snapshots) ? snapshots : [snapshots];
  console.log(`${list.length} instantané(s) à rejouer...\n`);

  let nbEcarts = 0;
  list.forEach((snap, idx) => {
    const rawA = structuredClone(snap);
    const rawB = structuredClone(snap);

    const deps = { getDefaultModules: liveFns.getDefaultModules, uuid: liveFns.uuid, today: liveFns.today };

    let shadow = S.migrate(rawA, SCHEMA_VERSION, deps);
    shadow = S.applyDefaults(shadow, liveFns.getDefaultData(), deps);

    let real = liveFns.migrate(rawB);
    real = liveFns.applyDefaults(real);

    const diffs = D.diffPaths(shadow, real);
    if (diffs.length) {
      nbEcarts++;
      console.log(`❌ Instantané #${idx} — ${diffs.length} écart(s) (chemins uniquement, jamais de valeurs) :`);
      diffs.slice(0, 30).forEach(p => console.log(`   - ${p}`));
    } else {
      console.log(`✅ Instantané #${idx} — aucun écart`);
    }
  });

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`${list.length - nbEcarts}/${list.length} instantanés identiques, ${nbEcarts} avec écart(s).`);
  if (nbEcarts > 0) process.exitCode = 1;
}

main();
