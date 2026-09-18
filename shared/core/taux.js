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

// Taux du versement fiscal libératoire (VFL) 2026 (source : DGFIP/URSSAF), en % du CA BRUT :
// à la différence de l'impôt classique, aucun abattement forfaitaire ne s'applique avant, le
// taux fixe porte directement sur le CA encaissé. Micro-entreprise uniquement (SASU/EURL n'ont
// pas accès au VFL, voir isSASU()). presta/vente répliquent la même logique que
// TAUX_URSSAF/ABATTEMENTS_MICRO : pour micro-achat, la colonne "presta" (activité mixte) suit la
// même convention que tauxCotisationsPrestation dans applyStatutParams() (indepuls.html), traitée
// comme une activité libérale (BNC), pas comme du commerce.
export const TAUX_VFL = {
  'micro-bnc':   { presta: 2.2, vente: 1.0 },
  'micro-bic':   { presta: 1.7, vente: 1.0 },
  'micro-achat': { presta: 2.2, vente: 1.0 },
};

// Plafond d'éligibilité au versement libératoire 2026 (source : DGFIP), en euros par part de
// quotient familial. Condition d'accès : le revenu fiscal de référence (RFR) du foyer de l'année
// N-2 par rapport à l'année pour laquelle on déclare, divisé par le nombre de parts de cette même
// année N-2, ne doit pas dépasser ce montant. Distinct du barème de l'impôt (tranches) : c'est une
// condition d'accès au régime, pas un taux d'imposition. Cohérence attendue : ce montant coïncide
// avec le haut de la tranche à 11 % du barème ci-dessous (l'éligibilité au VFL correspond aux deux
// tranches les plus basses du barème). Si l'un des deux change lors d'une mise à jour annuelle et
// pas l'autre, vérifier qu'il ne s'agit pas d'une erreur de recopie.
export const PLAFOND_VFL_PAR_PART = 29579;

// Barème progressif de l'impôt sur le revenu 2026, applicable aux revenus 2025 (source :
// service-public.fr, loi de finances 2026 promulguée le 19 février 2026, revalorisation +0,9 %).
// Chaque tranche est bornée par son plafond haut ; taux marginal appliqué à la part de revenu
// comprise entre le plafond de la tranche précédente et celui-ci. Utilisé avec le mécanisme du
// quotient familial simple (voir getImpotBaremeProgressif) : SANS décote ni plafonnement du
// quotient familial (règles applicables aux revenus proches du seuil d'imposition, ou aux foyers
// avec plusieurs parts liées à des enfants), toujours une estimation, jamais un calcul officiel.
export const BAREME_IR = [
  { plafond: 11600,     taux: 0 },
  { plafond: 29579,     taux: 0.11 },
  { plafond: 84577,     taux: 0.30 },
  { plafond: 181917,    taux: 0.41 },
  { plafond: Infinity,  taux: 0.45 },
];

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
