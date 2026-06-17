// ── STOCKAGE & MIGRATIONS ────────────────────────────────────
// Gestion localStorage, migration de schéma, import/export JSON.
// Identique dans freelance et artisan, sauf STORAGE_KEY et SCHEMA_VERSION
// qui sont injectés par le mode appelant.

// ── MIGRATIONS ───────────────────────────────────────────────

export function migrate(data, schemaVersion) {
  delete data.params?.dashboardWidgets;

  const catMap = {
    'Mutuelle & prévoyance':    'Assurances & prévoyance',
    'Prestataires':             'Sous-traitance & prestataires'
  };
  (data.depenses || []).forEach(d => {
    if (!d.categorie) d.categorie = 'Autre';
    if (catMap[d.categorie]) d.categorie = catMap[d.categorie];
  });

  const themeMap = { 'atlantique': 'ocean', 'sepia': 'latte', 'dark': 'nuit' };
  if (data.theme && themeMap[data.theme]) data.theme = themeMap[data.theme];

  if (data.isExample === undefined) data.isExample = false;
  data.schemaVersion = schemaVersion;
  return data;
}

export function applyDefaults(data, defaultData) {
  const def = defaultData;
  if (!data.params) data.params = def.params;
  Object.keys(def.params).forEach(k => {
    if (data.params[k] === undefined) data.params[k] = def.params[k];
  });
  if (!data.categories)    data.categories = def.categories;
  if (!data.missions)      data.missions = def.missions;
  if (!data.revenus)       data.revenus = {};
  if (!data.depenses)      data.depenses = [];
  if (!data.archives)      data.archives = {};
  if (!data.bilans)        data.bilans = {};
  if (!data.tempsInterne)  data.tempsInterne = {};
  (data.missions || []).forEach(m => {
    if (m.encaissements === undefined)       m.encaissements = [];
    if (m.typeMission === undefined)         m.typeMission = 'individuelle';
    if (m.nbParticipants === undefined)      m.nbParticipants = 0;
    if (m.prixParParticipant === undefined)  m.prixParParticipant = 0;
    if (m.tempsCreation === undefined)       m.tempsCreation = 0;
    if (m.tempsAnimation === undefined)      m.tempsAnimation = 0;
    if (m.tempsSupport === undefined)        m.tempsSupport = 0;
    if (m.montantVente == null)              m.montantVente = 0;
    if (m.montantPrestation == null)         m.montantPrestation = 0;
    // Cohérence montantDevis = montantPrestation + montantVente (modèle unifié).
    // Anciennes missions Artisan saisies sans ventilation explicite : on préserve
    // le comportement déjà affiché à l'écran (100% prestation, sauf part vente connue),
    // au lieu de laisser presta+vente diverger silencieusement du devis.
    if (!m.isRecurring && (m.montantPrestation + m.montantVente) !== (m.montantDevis || 0)) {
      m.montantPrestation = (m.montantDevis || 0) - m.montantVente;
    }
  });
  return data;
}

// ── LOAD / SAVE ──────────────────────────────────────────────

export function loadData({ storageKey, schemaVersion, getDefaultData, getExampleData, showToast }) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return getExampleData();
    let parsed = JSON.parse(raw);
    if (parsed.isExample) return getExampleData();
    parsed = migrate(parsed, schemaVersion);
    parsed = applyDefaults(parsed, getDefaultData());
    return parsed;
  } catch (e) {
    return getExampleData();
  }
}

export function saveData(DATA, storageKey, showToast) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(DATA));
  } catch (e) {
    showToast('⚠️ Sauvegarde impossible — exportez vos données maintenant.', 'var(--err)');
  }
}

// ── EXPORT JSON ──────────────────────────────────────────────

export function exportData(DATA) {
  const json = JSON.stringify(DATA, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `indepuls_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── IMPORT JSON ──────────────────────────────────────────────

export function handleImport(event, { storageKey, schemaVersion, getDefaultData, getExampleData, showToast, onSuccess }) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      let parsed = JSON.parse(e.target.result);
      // Sauvegarde automatique avant écrasement
      localStorage.setItem(storageKey + '_backup_' + Date.now(), JSON.stringify(
        JSON.parse(localStorage.getItem(storageKey) || '{}')
      ));
      // Nettoyage des vieilles sauvegardes (garde les 3 dernières)
      const _bks = Object.keys(localStorage).filter(k => k.startsWith(storageKey + '_backup_')).sort();
      while (_bks.length > 3) localStorage.removeItem(_bks.shift());

      parsed = migrate(parsed, schemaVersion);
      parsed = applyDefaults(parsed, getDefaultData());
      onSuccess(parsed);
      showToast('✅ Données importées avec succès.');
    } catch (err) {
      showToast('❌ Fichier invalide — importation annulée.', 'var(--err)');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}
