// ── RÉFÉRENTIEL FISCAL ───────────────────────────────────────
// Source unique de vérité pour les taux et seuils fiscaux.
// Mise à jour annuelle : modifier ce seul fichier.

// Seuils TVA 2026 (source : DGFIP)
export const TVA_SEUILS = {
  prestation: { franchise: 37500, tolerance: 41250 },
  achat:      { franchise: 85000, tolerance: 93500 }
};

// Taux cotisations 2026 (source : URSSAF)
// urssafPresta/cfpPresta : taux de l'activité principale déclarée.
// urssafVente/cfpVente   : taux sur la part ventes en activité mixte (BIC commerce).
export const TAUX_URSSAF = {
  'micro-bnc':   { urssafPresta: 25.6, cfpPresta: 0.2, urssafVente: 12.3, cfpVente: 0.1 },
  'micro-bic':   { urssafPresta: 21.2, cfpPresta: 0.3, urssafVente: 12.3, cfpVente: 0.1 },
  'micro-achat': { urssafPresta: 12.3, cfpPresta: 0.1, urssafVente: 12.3, cfpVente: 0.1 },
  // Note micro-achat : urssafPresta = taux vente (activité principale déclarée).
  // En activité mixte, la colonne prestations utilise toujours le taux BNC — voir onStatutChange().
};

// Retourne les taux du statut donné, avec fallback sur micro-bnc.
export function getTauxStatut(statut) {
  return TAUX_URSSAF[statut] || TAUX_URSSAF['micro-bnc'];
}

// Abattements forfaitaires micro 2026 (source : DGFIP)
// Appliqués au CA pour obtenir le revenu imposable estimé.
// Ne s'appliquent PAS aux cotisations URSSAF ni à la TVA.
// Pour activité mixte : presta et vente sont calculés séparément puis additionnés.
export const ABATTEMENTS_MICRO = {
  'micro-bnc':   { presta: 0.34, vente: 0.34 }, // Libéral / BNC : 34 % sur tout le CA
  'micro-bic':   { presta: 0.50, vente: 0.71 }, // Services BIC : 50 % presta, 71 % vente
  'micro-achat': { presta: 0.50, vente: 0.71 }, // Commerce : 71 % (non mixte) ou 50+71 % (mixte)
};
export const ABATTEMENT_MINIMUM = 305; // € — plancher légal d'abattement

// Plafonds du régime micro 2026 (source : DGFIP)
// Distincts des seuils de franchise TVA — ne pas confondre.
//   TVA franchise prestation : 37 500 €  (dans TVA_SEUILS)
//   TVA franchise vente      : 85 000 €  (dans TVA_SEUILS)
//   Plafond régime micro BNC : 83 600 €  (ci-dessous)
//   Plafond régime micro BIC : 83 600 €  (ci-dessous)
//   Plafond régime micro achat/commerce : 203 100 €  (ci-dessous)
// En activité mixte : plafond global 203 100 € + sous-plafond prestations 83 600 €.
export const MICRO_LIMITS = {
  'micro-bnc':   { global:  83600, sousPlafondPresta: null },
  'micro-bic':   { global:  83600, sousPlafondPresta: null },
  'micro-achat': { global: 203100, sousPlafondPresta: 83600 }, // sousPlafondPresta s'active en mixte
};

// Catégories de dépenses et couleurs associées
export const DEP_CATEGORIES = [
  'Logiciels & abonnements','Marketing & communication','Formation',
  'Téléphonie & internet','Déplacements','Assurances & prévoyance',
  'Frais bancaires','Expert-comptable & juridique','Sous-traitance & prestataires',
  'Matériel & équipement','Coworking & bureau','Outils IA',
  'Hébergement & nom de domaine','Livres & ressources professionnelles','Autre'
];
export const DEP_CAT_COLORS = [
  '#5B2C4A','#be185d','#1e40af','#0891b2','#65a30d','#2d7a4f','#0369a1',
  '#92400e','#c97316','#7c3aed','#0e7490','#6d28d9','#4338ca','#b45309','#6b7280'
];

// Libellés et couleurs des sources d'acquisition
export const SRC_LABELS = {
  'recommandation':  'Recommandation / bouche-à-oreille',
  'client_existant': 'Client existant',
  'reseau':          'Réseau professionnel',
  'social':          'Instagram / réseaux sociaux',
  'web':             'Site internet / Google',
  'publicite':       'Publicité payante',
  'prospection':     'Prospection directe',
  'plateforme':      'Plateforme / annuaire',
  'autre':           'Autre'
};
export const SRC_COLORS = {
  'recommandation':  '#4CAF50',
  'client_existant': '#2196F3',
  'reseau':          '#9C27B0',
  'social':          '#E91E63',
  'web':             '#FF9800',
  'publicite':       '#F44336',
  'prospection':     '#00BCD4',
  'plateforme':      '#8BC34A',
  'autre':           '#9E9E9E'
};
