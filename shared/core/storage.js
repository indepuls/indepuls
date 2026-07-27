// ── STOCKAGE & MIGRATIONS ────────────────────────────────────
// Gestion localStorage, migration de schéma, import/export JSON.
// Identique dans freelance et artisan, sauf STORAGE_KEY et SCHEMA_VERSION
// qui sont injectés par le mode appelant.

// ── MIGRATIONS ───────────────────────────────────────────────

export function migrate(data, schemaVersion, deps = {}) {
  const { getDefaultModules, uuid, today } = deps;
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

  // Migrations dépendant de getDefaultModules (vocabulaire/défauts par métier — fourni par
  // l'appelant, jamais recalculé ici). Ignorées si non fourni (ex. tests ciblant une autre
  // partie de migrate() sans avoir besoin de celle-ci).
  if (getDefaultModules) {
    // Migrer modePlanning → modules.calendrier + modules.estimation
    if (data.params?.modePlanning) {
      if (!data.params.modules) data.params.modules = getDefaultModules(data.params.metier);
      const mp = data.params.modePlanning;
      data.params.modules.calendrier = mp === 'calendrier';
      data.params.modules.estimation = mp !== 'calendrier';
      delete data.params.modePlanning;
    }
    // Migrer modules.planning (string) → booléens
    if (data.params?.modules?.planning !== undefined) {
      const p = data.params.modules.planning;
      data.params.modules.calendrier = p === 'calendrier';
      data.params.modules.estimation = p !== 'calendrier';
      delete data.params.modules.planning;
    }
  }

  // Datation systématique du temps réel (chantier "Temps prévu", Étape 4) : le chrono ne verse
  // plus dans timerAccumulated mais dans tempsManuel, daté. On ne connaît pas la date réelle
  // d'origine du temps déjà accumulé — approximation assumée (date du jour de la migration)
  // plutôt qu'une perte d'historique ; le gap est négligeable en pratique.
  if (uuid && today) {
    (data.missions || []).forEach(m => {
      if (m.timerAccumulated > 0) {
        if (!m.tempsManuel) m.tempsManuel = [];
        m.tempsManuel.push({ id: uuid(), date: today(), ms: m.timerAccumulated });
        m.timerAccumulated = 0;
      }
    });
  }

  // v32 : ajout du modèle de retours (fabrication + achat_revente) — comptes existants sans
  // la clé, jamais de perte de données possible ici (tableau vide par défaut).
  if (!data.retours) data.retours = [];
  // v33 : lots d'investissement (achat_revente) — comptes existants sans la clé, tableau vide
  // par défaut, aucune perte de données possible.
  if (!data.lots) data.lots = [];

  data.schemaVersion = schemaVersion;
  return data;
}

export function applyDefaults(data, defaultData, deps = {}) {
  const { getDefaultModules, uuid, today } = deps;
  const def = defaultData;
  if (!data.params) data.params = def.params;
  Object.keys(def.params).forEach(k => {
    if (data.params[k] === undefined) data.params[k] = def.params[k];
  });
  if (getDefaultModules) {
    if (!data.params.modules) {
      data.params.modules = getDefaultModules(data.params.metier);
    } else {
      const defMods = getDefaultModules(data.params.metier);
      Object.keys(defMods).forEach(k => { if (data.params.modules[k] === undefined) data.params.modules[k] = defMods[k]; });
    }
  }
  if (!data.categories)    data.categories = def.categories;
  if (!data.missions)      data.missions = def.missions;
  if (!data.revenus)       data.revenus = {};
  if (!data.depenses)      data.depenses = [];
  if (!data.archives)      data.archives = {};
  if (!data.bilans)        data.bilans = {};
  if (!data.tempsInterne)  data.tempsInterne = {};
  if (!data.recettesManuel) data.recettesManuel = [];

  // Migration collectif (chantier "vue calendrier" Phase 3, 2026-07) : tempsCreation/
  // tempsAnimation/tempsSupport comptaient jusqu'ici comme temps RÉEL ; ils deviennent un temps
  // ESTIMATIF comme pour toute autre mission (le temps réel vient désormais du chrono/temps
  // manuel). Le temps déjà accumulé dedans est converti UNE SEULE FOIS en entrées tempsManuel
  // catégorisées, puis les 3 champs sont remis à 0. Idempotent via m._collectifTempsMigre.
  const _catsCollectifAAjouter = new Set();
  (data.missions || []).forEach(m => {
    if (m.encaissements === undefined)       m.encaissements = [];
    if (m.typeMission === undefined)         m.typeMission = 'individuelle';
    if (m.nbParticipants === undefined)      m.nbParticipants = 0;
    if (m.prixParParticipant === undefined)  m.prixParParticipant = 0;
    if (m.tempsCreation === undefined)       m.tempsCreation = 0;
    if (m.tempsAnimation === undefined)      m.tempsAnimation = 0;
    if (m.tempsSupport === undefined)        m.tempsSupport = 0;
    if (m.sessions === undefined)            m.sessions = [];
    if (m.montantVente == null)              m.montantVente = 0;
    if (m.montantPrestation == null)         m.montantPrestation = 0;
    // Cohérence montantDevis = montantPrestation + montantVente (modèle unifié).
    // Anciennes missions Artisan saisies sans ventilation explicite : on préserve
    // le comportement déjà affiché à l'écran (100% prestation, sauf part vente connue),
    // au lieu de laisser presta+vente diverger silencieusement du devis.
    if (!m.isRecurring && (m.montantPrestation + m.montantVente) !== (m.montantDevis || 0)) {
      m.montantPrestation = (m.montantDevis || 0) - m.montantVente;
    }
    if (uuid && today && m.typeMission === 'collectif' && !m._collectifTempsMigre) {
      const dateRef = m.dateFact || (m.tempsManuel && m.tempsManuel[0] && m.tempsManuel[0].date) || today();
      if (!m.tempsManuel) m.tempsManuel = [];
      [['tempsCreation', 'Création'], ['tempsAnimation', 'Animation'], ['tempsSupport', 'Suivi']].forEach(([champ, cat]) => {
        if (m[champ] > 0) {
          m.tempsManuel.push({ id: uuid(), date: dateRef, ms: m[champ] * 3600000, categorie: cat });
          _catsCollectifAAjouter.add(cat);
        }
      });
      m.tempsCreation = 0; m.tempsAnimation = 0; m.tempsSupport = 0;
      m._collectifTempsMigre = true;
    }
  });
  if (_catsCollectifAAjouter.size) {
    if (!data.categoriesTemps) data.categoriesTemps = [];
    _catsCollectifAAjouter.forEach(cat => { if (!data.categoriesTemps.includes(cat)) data.categoriesTemps.push(cat); });
  }
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
