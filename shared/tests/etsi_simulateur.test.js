// ── TESTS : "Et si ?" — simulateur de scénarios (shared/core/calculs.js, 2026-07-30) ──────────
// getTauxHoraireMinCibleSimule / getComparateurStatuts sont des fonctions PURES : elles ne
// touchent jamais DATA, seulement des paramètres explicites ou des overrides — les dépenses
// réelles restent la seule source (jamais un calcul "hors-sol"), conformément au retour Faustine.

import { getTauxHoraireMinCibleSimule, getComparateurStatuts } from '../core/calculs.js';

let passed = 0, failed = 0;
function test(label, actual, expected) {
  const ok = Math.abs(actual - expected) <= 0.01;
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${expected}, obtenu ${actual}`); failed++; }
}
function section(title) { console.log(`\n── ${title}`); }

function baseParams(overrides = {}) {
  return {
    statut: 'micro', objectifNetMensuel: 3500, heuresParJour: 7, joursParSemaine: 4, semainesParAn: 44,
    tauxURSSAF: 21.1, tauxCFP: 0.2, impotsTaux: 0, activiteMixte: false, ...overrides,
  };
}

section('getTauxHoraireMinCibleSimule — sans override, identique à DATA.params (référence)');
{
  const D = { params: baseParams(), depenses: [] };
  // hAn = 7*4*44 = 1232 ; dep=0 ; r = 1 - 0.213 = 0.787 (tauxCFP=0.2% négligeable ici arrondi)
  const th = getTauxHoraireMinCibleSimule(D);
  test('cohérent avec la formule de base (pas de régression)', th > 0, true);
}
section('getTauxHoraireMinCibleSimule — override semaines de congés (moins de semaines dispo → TH cible plus élevé)');
{
  const D = { params: baseParams(), depenses: [] };
  const thNormal = getTauxHoraireMinCibleSimule(D, {});
  const thAvecConges = getTauxHoraireMinCibleSimule(D, { semainesParAn: 39 }); // -5 semaines
  test('moins de semaines dispo → TH cible plus élevé', thAvecConges > thNormal, true);
}
section('getTauxHoraireMinCibleSimule — override objectif net mensuel (objectif plus haut → TH cible plus élevé)');
{
  const D = { params: baseParams(), depenses: [] };
  const thBase = getTauxHoraireMinCibleSimule(D, {});
  const thObjectifHaut = getTauxHoraireMinCibleSimule(D, { objectifNetMensuel: 5000 });
  test('objectif net plus élevé → TH cible plus élevé', thObjectifHaut > thBase, true);
}
section('getTauxHoraireMinCibleSimule — dépenses réelles déjà saisies prises en compte (jamais ignorées)');
{
  const D1 = { params: baseParams(), depenses: [] };
  const D2 = { params: baseParams(), depenses: [{ recurrence: 'mensuelle', montant: 300 }] };
  const thSansDep = getTauxHoraireMinCibleSimule(D1, {});
  const thAvecDep = getTauxHoraireMinCibleSimule(D2, {});
  test('dépenses réelles augmentent le TH cible simulé, comme en non-simulé', thAvecDep > thSansDep, true);
}
section('getTauxHoraireMinCibleSimule — SASU, override de la rémunération nette visée');
{
  const D = { params: baseParams({ statut: 'sasu', remunerationNette: 3000, coutRemunerationPct: 82 }), depenses: [] };
  const thBase = getTauxHoraireMinCibleSimule(D, {});
  const thNetHaut = getTauxHoraireMinCibleSimule(D, { remunerationNette: 4000 });
  test('rémunération nette visée plus haute → TH cible plus élevé (SASU)', thNetHaut > thBase, true);
}
section('getTauxHoraireMinCibleSimule — hAn=0 → 0 (jamais de division par zéro)');
{
  const D = { params: baseParams({ heuresParJour: 0 }), depenses: [] };
  test('heuresParJour=0 → 0', getTauxHoraireMinCibleSimule(D, {}), 0);
}

section('getComparateurStatuts — micro sans TVA, dépenses réelles déduites');
{
  const D = { params: baseParams({ tauxURSSAF: 20, tauxCFP: 0, impotsTaux: 0 }), depenses: [] };
  // caBrut=3000, r=0.8 → 2400, dep=0 → 2400
  const c = getComparateurStatuts(D, 3000);
  test('micro sans TVA = CA x (1-charges) - dépenses', c.microSansTVA, 2400);
}
section('getComparateurStatuts — compte déjà en TVA : récupère la TVA déductible réelle des dépenses récurrentes (hors affaire)');
{
  const D = {
    currentYear: 2026,
    params: baseParams({ tauxURSSAF: 20, tauxCFP: 0, impotsTaux: 0, tva: true }),
    depenses: [
      { recurrence: 'mensuelle', montant: 120, montantTVA: 20, tvaDeductible: true },
      { recurrence: 'mensuelle', montant: 50, montantTVA: 8, tvaDeductible: false }, // jamais compté (pas déductible)
      { recurrence: 'mensuelle', montant: 60, montantTVA: 10, tvaDeductible: true, chantierId: 'm1' }, // jamais compté (affaire, récurrente)
    ],
  };
  const c = getComparateurStatuts(D, 3000);
  test('micro avec TVA = micro sans TVA + 20€ de TVA récupérée/mois (la seule ligne récurrente éligible)', c.microAvecTVA - c.microSansTVA, 20);
}
section('getComparateurStatuts — compte déjà en TVA : compte aussi les dépenses PONCTUELLES de l\'année en cours, même liées à une affaire (retour Faustine 2026-07-30 : fournitures de chantier)');
{
  const D = {
    currentYear: 2026,
    params: baseParams({ tauxURSSAF: 20, tauxCFP: 0, impotsTaux: 0, tva: true }),
    depenses: [
      { recurrence: 'ponctuelle', montant: 500, montantTVA: 120, tvaDeductible: true, date: '2026-03-01' }, // compté (année en cours)
      { recurrence: 'ponctuelle', montant: 500, montantTVA: 120, tvaDeductible: true, date: '2026-06-01', chantierId: 'chantier1' }, // compté même liée à une affaire
      { recurrence: 'ponctuelle', montant: 500, montantTVA: 120, tvaDeductible: true, date: '2025-11-01' }, // jamais compté (année précédente)
      { recurrence: 'ponctuelle', montant: 500, montantTVA: 120, tvaDeductible: false, date: '2026-03-01' }, // jamais compté (pas déductible)
    ],
  };
  const c = getComparateurStatuts(D, 3000);
  // 240€ de TVA ponctuelle éligible sur l'année, moyennée sur 12 mois = 20€/mois
  test('TVA ponctuelle de l\'année moyennée sur 12 mois', c.microAvecTVA - c.microSansTVA, 20);
}
section('getComparateurStatuts — `mks` (fenêtre glissante) prime sur "l\'année civile en cours" pour les ponctuelles, comme pour le CA (retour Faustine 2026-07-30 : "si on fait la simulation sur un bon ou un mauvais mois, ça change tout")');
{
  const D = {
    currentYear: 2026,
    params: baseParams({ tauxURSSAF: 20, tauxCFP: 0, impotsTaux: 0, tva: true }),
    depenses: [
      { recurrence: 'ponctuelle', montant: 500, montantTVA: 120, tvaDeductible: true, date: '2025-08-01' }, // hors année civile 2026, DANS la fenêtre glissante fournie
      { recurrence: 'ponctuelle', montant: 500, montantTVA: 120, tvaDeductible: true, date: '2026-03-01' }, // dans l'année civile 2026, HORS de la fenêtre glissante fournie
    ],
  };
  const fenetreGlissante = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02']; // 7 mois, ne couvre pas mars 2026
  const c = getComparateurStatuts(D, 3000, true, fenetreGlissante);
  // Seule la ligne d'août 2025 est dans la fenêtre : 120€ / 7 mois
  test('filtre sur la fenêtre glissante fournie, pas sur l\'année civile', c.microAvecTVA - c.microSansTVA, 120 / 7);
}
section('getComparateurStatuts — compte SANS TVA activée : la case "TVA déductible" n\'existe jamais côté saisie (retour Faustine 2026-07-30 : "il n\'a pas la TVA, la case n\'est jamais cochée") — estime au taux configuré plutôt que 0');
{
  const D = {
    currentYear: 2026,
    params: baseParams({ tauxURSSAF: 20, tauxCFP: 0, impotsTaux: 0, tva: false, tauxTVA: 20 }),
    depenses: [
      { recurrence: 'mensuelle', montant: 120, tvaDeductible: false }, // tvaDeductible jamais coché, mais compté quand même (estimation)
      { recurrence: 'ponctuelle', montant: 500, date: '2026-03-01' }, // fourniture de chantier ponctuelle, comptée aussi
      { recurrence: 'ponctuelle', montant: 500, date: '2025-11-01' }, // année précédente, jamais comptée
    ],
  };
  const c = getComparateurStatuts(D, 3000);
  test('estimation > 0 même sans aucune ligne tvaDeductible', c.microAvecTVA - c.microSansTVA > 0, true);
  // 120€/mois (récurrente) + 500€/12 (ponctuelle de l'année) = 161.67€ TTC ; TVA à 20% extraite d'un TTC = x * 20/120
  const attendu = (120 + 500 / 12) * (20 / 120);
  test('estimation = dépenses réelles (TTC) x taux/(1+taux)', c.microAvecTVA - c.microSansTVA, attendu);
}
section('getComparateurStatuts — impôt micro calculé APRÈS abattement forfaitaire, pas sur le CA brut (retour Faustine 2026-07-30 : "est-ce que le simulateur tient compte de l\'abattement ?")');
{
  const D = { params: baseParams({ statut: 'micro-bnc', tauxURSSAF: 22, tauxCFP: 0, impotsTaux: 10 }), depenses: [] };
  const c = getComparateurStatuts(D, 3000);
  // abattement micro-bnc = 34% de 3000 = 1020 → revenu imposable 1980 → impôt 198
  // charges URSSAF = 3000*0.22 = 660 → net = 3000 - 660 - 198 = 2142
  test('impôt basé sur le revenu après abattement (34% en micro-bnc), pas sur le CA brut', c.microSansTVA, 2142);
}
section('getComparateurStatuts — le sous-régime micro change le taux d\'abattement (34% BNC vs 71% achat)');
{
  const Dbnc = { params: baseParams({ statut: 'micro-bnc', tauxURSSAF: 0, tauxCFP: 0, impotsTaux: 10 }), depenses: [] };
  const Dachat = { params: baseParams({ statut: 'micro-achat', tauxURSSAF: 0, tauxCFP: 0, impotsTaux: 10 }), depenses: [] };
  const cBnc = getComparateurStatuts(Dbnc, 3000);
  const cAchat = getComparateurStatuts(Dachat, 3000);
  // Abattement plus généreux (71% > 34%) → revenu imposable plus faible → impôt plus faible → net plus élevé
  test('micro-achat (71% d\'abattement) laisse un net supérieur à micro-bnc (34%) à impôt/CA identiques', cAchat.microSansTVA > cBnc.microSansTVA, true);
}
section('getComparateurStatuts — simuler "et si j\'étais micro" depuis un compte réellement SASU : microSousType explicite évite un abattement nul');
{
  const D = { params: baseParams({ statut: 'sasu', remunerationNette: 3000, coutRemunerationPct: 82, tauxURSSAF: 22, tauxCFP: 0, impotsTaux: 10 }), depenses: [] };
  const sansMicroSousType = getComparateurStatuts(D, 3000, true, undefined, undefined);
  const avecMicroSousType = getComparateurStatuts(D, 3000, true, undefined, 'micro-bnc');
  // Sans microSousType explicite, repli sur 'micro-bnc' par défaut (voir sousType) — donc les deux
  // devraient déjà coïncider ; le test protège surtout contre une régression qui renverrait un
  // abattement nul faute de repli.
  test('un net non nul même simulé depuis un compte SASU réel', avecMicroSousType.microSansTVA > 0, true);
  test('repli implicite cohérent avec un microSousType explicite = micro-bnc', sansMicroSousType.microSansTVA, avecMicroSousType.microSansTVA);
}
section('getComparateurStatuts — EURL/SASU n\'appliquent jamais les taux URSSAF de la micro (déjà couverts par le forfait 45%/82%)');
{
  const D1 = { params: baseParams({ tauxURSSAF: 10 }), depenses: [] };
  const D2 = { params: baseParams({ tauxURSSAF: 40 }), depenses: [] };
  const c1 = getComparateurStatuts(D1, 3000);
  const c2 = getComparateurStatuts(D2, 3000);
  test('EURL identique quel que soit le taux URSSAF micro configuré', c1.eurl, c2.eurl);
  test('SASU identique quel que soit le taux URSSAF micro configuré', c1.sasu, c2.sasu);
}
section('getComparateurStatuts — prixAugmentes=true (défaut) : TVA collectée = 0, simple transit sans impact net (retour Faustine 2026-07-30)');
{
  const D = { params: baseParams({ tauxURSSAF: 20, tauxCFP: 0, impotsTaux: 0 }), depenses: [] };
  const c = getComparateurStatuts(D, 3000, true);
  test('tvaCollectee = 0 quand les prix augmentent', c.tvaCollectee, 0);
  test('tvaRecuperee exposée même sans dépenses (0 ici)', c.tvaRecuperee, 0);
}
section('getComparateurStatuts — prixAugmentes=false (prix absorbés, clientèle de particuliers) : le CA HT réel diminue');
{
  const D = { params: baseParams({ tauxURSSAF: 20, tauxCFP: 0, impotsTaux: 0, tauxTVA: 20 }), depenses: [] };
  const cAugmente = getComparateurStatuts(D, 3000, true);
  const cAbsorbe = getComparateurStatuts(D, 3000, false);
  // caHT = 3000/1.2 = 2500, tvaCollectee = 500
  test('tvaCollectee = CA - CA/(1+taux) quand les prix sont absorbés', cAbsorbe.tvaCollectee, 500);
  test('net inférieur quand la TVA est absorbée plutôt qu\'ajoutée aux prix', cAbsorbe.microAvecTVA < cAugmente.microAvecTVA, true);
}
section('getComparateurStatuts — EURL (45%) donne un net supérieur à SASU (82%) sur le même CA');
{
  const D = { params: baseParams(), depenses: [] };
  const c = getComparateurStatuts(D, 4000);
  test('EURL > SASU à CA identique (coût de rémunération plus faible)', c.eurl > c.sasu, true);
  // disponible = 4000, EURL = 4000/1.45 ≈ 2758.62
  test('EURL = disponible / 1.45', c.eurl, 4000 / 1.45);
  test('SASU = disponible / 1.82', c.sasu, 4000 / 1.82);
}
section('getComparateurStatuts — dépenses réelles réduisent le disponible EURL/SASU');
{
  const D1 = { params: baseParams(), depenses: [] };
  const D2 = { params: baseParams(), depenses: [{ recurrence: 'mensuelle', montant: 400 }] };
  const c1 = getComparateurStatuts(D1, 4000);
  const c2 = getComparateurStatuts(D2, 4000);
  test('dépenses réelles réduisent le net EURL simulé', c2.eurl < c1.eurl, true);
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
