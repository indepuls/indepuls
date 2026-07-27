// ── DIFF STRUCTUREL — mode ombre duplication B (audit externe 2026-07-26) ────
// Compare deux arbres de données et retourne la liste des CHEMINS qui divergent — jamais les
// valeurs elles-mêmes. Un chemin ("missions[3].tempsManuel") ne peut jamais faire fuiter de
// donnée utilisateur (nom de client, montant...) vers un service tiers (Sentry) en cas d'écart ;
// c'est une condition non négociable de l'instrumentation ombre, pas un détail d'implémentation.
//
// Exclut PAR PRINCIPE toute clé listée dans `volatileKeys` (jamais un chemin exact) : ce sont des
// champs dont la valeur est régénérée à chaque exécution (ex. `id` via uuid()) et dont la
// divergence ne signale jamais un vrai écart de logique métier. Toute future migration qui
// génère un nouvel identifiant sous un autre nom de champ doit ajouter ce nom à cette liste.

export const DEFAULT_VOLATILE_KEYS = ['id'];

export function diffPaths(a, b, volatileKeys = DEFAULT_VOLATILE_KEYS, path = '') {
  const paths = [];
  if (a === b) return paths;

  const ta = a === null ? 'null' : typeof a;
  const tb = b === null ? 'null' : typeof b;
  if (ta !== tb) return [path || '(racine)'];
  if (ta !== 'object') return [path || '(racine)'];

  const aIsArr = Array.isArray(a), bIsArr = Array.isArray(b);
  if (aIsArr !== bIsArr) return [path || '(racine)'];

  if (aIsArr) {
    if (a.length !== b.length) paths.push(`${path || '(racine)'}.length`);
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      paths.push(...diffPaths(a[i], b[i], volatileKeys, `${path}[${i}]`));
    }
    return paths;
  }

  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.forEach(k => {
    if (volatileKeys.includes(k)) return;
    paths.push(...diffPaths(a[k], b[k], volatileKeys, path ? `${path}.${k}` : k));
  });
  return paths;
}
