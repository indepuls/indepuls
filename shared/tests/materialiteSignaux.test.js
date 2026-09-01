// ── TESTS : signaux de matérialité du brief hebdomadaire (chantier phase 4, 2026-07-28) ──
// getMissionsImpayees (extraite d'indepuls.html — duplication évitée, pas ajoutée : la copie
// inline est remplacée par un appel au pont, voir indepuls.html) + les deux fonctions
// d'échéance fiscale (date uniquement, jamais le montant — pas besoin du montant pour la
// décision d'envoi "matérialité", qui ne demande qu'un booléen "proche ou non").

import { getMissionsImpayees, getProchaineEcheanceUrssafDaysLeft, getProchaineEcheanceTvaDaysLeft, getAlerteAcre, getEcheancesFiscalesGeneriques } from '../core/calculs.js';

let passed = 0, failed = 0;
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function test(label, actual, expected) {
  if (eq(actual, expected)) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`); failed++; }
}
function ok(label, cond) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}
function section(title) { console.log(`\n── ${title}`); }

function mkMission(overrides = {}) {
  return Object.assign({
    id: 'm1', isManagement: false, isRecurring: false, statut: 'fact',
    dateFact: null, montantDevis: 1000, encaissements: [],
  }, overrides);
}

section('getMissionsImpayees — même logique que la copie historique d\'indepuls.html');
{
  const ancien = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10); // 20 jours
  const recent = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);  // 5 jours (sous le seuil de 14j)
  const D = {
    missions: [
      mkMission({ id: 'vieille', dateFact: ancien, montantDevis: 500, encaissements: [] }), // impayée, 20j
      mkMission({ id: 'recente', dateFact: recent, montantDevis: 500, encaissements: [] }), // impayée mais trop récente
      mkMission({ id: 'payee', dateFact: ancien, montantDevis: 500, encaissements: [{ montant: 500 }] }), // soldée
      mkMission({ id: 'gestion', isManagement: true, dateFact: ancien, montantDevis: 500, encaissements: [] }), // exclue
      mkMission({ id: 'recurrente', isRecurring: true, dateFact: ancien, montantDevis: 500, encaissements: [] }), // exclue
    ],
  };
  const r = getMissionsImpayees(D);
  // Retour {m,days,reste} — m = objet mission COMPLET (pas juste son id) : un appelant
  // existant (buildAlerts() dans indepuls.html) déstructure m.client/m.description directement.
  test('une seule mission remontée (la vieille, impayée, >= 14j)', r.map(x => x.m.id), ['vieille']);
  ok('m est bien l\'objet mission complet, pas juste son id', typeof r[0].m === 'object' && r[0].m.statut === 'fact');
  ok('reste dû correct', r[0].reste === 500);
  ok('nombre de jours cohérent (>= 14)', r[0].days >= 14);
}

section('getProchaineEcheanceUrssafDaysLeft — régime mensuel');
{
  const D = { params: { urssafRegime: 'mensuel' } };
  const maintenant = new Date(2026, 6, 15); // 15 juillet 2026
  const jours = getProchaineEcheanceUrssafDaysLeft(D, maintenant);
  // Dernier jour de juillet 2026 = 31/07 → 16 jours après le 15/07.
  test('échéance = dernier jour du mois courant', jours, 16);
}

section('getProchaineEcheanceUrssafDaysLeft — régime trimestriel');
{
  const D = { params: { urssafRegime: 'trimestriel' } };
  const maintenant = new Date(2026, 6, 15); // 15 juillet 2026, T3 (juil-sept), échéance fin octobre
  const jours = getProchaineEcheanceUrssafDaysLeft(D, maintenant);
  const attendu = Math.ceil((new Date(2026, 9, 31) - maintenant) / 86400000);
  test('échéance = dernier jour du mois suivant la fin du trimestre', jours, attendu);
}

section('getProchaineEcheanceTvaDaysLeft — franchise en base → aucune échéance');
{
  const D = { params: { tva: false } };
  // getTvaRegime(D) doit renvoyer 'franchise' quand tva est désactivée — voir calculs.js.
  test('null (pas de TVA à déclarer)', getProchaineEcheanceTvaDaysLeft(D, new Date(2026, 6, 15)), null);
}

section('getAlerteAcre — pas activé ou pas de date de fin → null');
{
  test('acreActif absent → null', getAlerteAcre({ params: {} }), null);
  test('acreActif=false → null', getAlerteAcre({ params: { acreActif: false, acreDateFin: '2026-09-01' } }), null);
  test('acreActif=true mais pas de date de fin → null', getAlerteAcre({ params: { acreActif: true, acreDateFin: '' } }), null);
}

section('getAlerteAcre — fenêtre d\'alerte (dernier trimestre avant la fin)');
{
  const D = { params: { acreActif: true, acreDateFin: '2026-09-01' } };
  test('95 j avant la fin → hors fenêtre (null)', getAlerteAcre(D, new Date(2026, 4, 28)), null); // 28 mai
  const r90 = getAlerteAcre(D, new Date(2026, 5, 3)); // ~90 j avant
  ok('90 j avant la fin → alerte déclenchée', r90 !== null && r90.daysLeft <= 90);
  const r5 = getAlerteAcre(D, new Date(2026, 7, 27)); // 5 j avant
  test('5 j avant la fin → daysLeft=5', r5.daysLeft, 5);
  test('date de fin correcte transmise', r5.dateFin, '2026-09-01');
  test('après la date de fin → null (rappel tardif inutile)', getAlerteAcre(D, new Date(2026, 8, 5)), null);
}

section('getEcheancesFiscalesGeneriques — CFE (15 décembre, date stable)');
{
  const loin = getEcheancesFiscalesGeneriques(new Date(2026, 7, 1)); // 1er août : hors fenêtre
  ok('hors fenêtre CFE → aucune entrée cfe', !loin.some(e => e.type === 'cfe'));
  const proche = getEcheancesFiscalesGeneriques(new Date(2026, 11, 10)); // 10 décembre : dans la fenêtre
  const cfe = proche.find(e => e.type === 'cfe');
  ok('CFE apparaît quand on approche du 15 décembre', !!cfe);
  test('daysLeft CFE cohérent (10 déc → 15 déc = 5 j)', cfe.daysLeft, 5);
  test('dateKey CFE = année courante', cfe.dateKey, '2026-12-15');
}

section('getEcheancesFiscalesGeneriques — déclaration de revenus (mois de mai uniquement, jamais de date précise)');
{
  const avril = getEcheancesFiscalesGeneriques(new Date(2026, 3, 30));
  ok('avril → pas encore de rappel déclaration', !avril.some(e => e.type === 'declaration_revenus'));
  const mai = getEcheancesFiscalesGeneriques(new Date(2026, 4, 15));
  const decl = mai.find(e => e.type === 'declaration_revenus');
  ok('mai → rappel déclaration présent', !!decl);
  test('pas de compte à rebours (daysLeft null, volontairement vague)', decl.daysLeft, null);
  const juin = getEcheancesFiscalesGeneriques(new Date(2026, 5, 1));
  ok('juin → rappel déclaration disparu', !juin.some(e => e.type === 'declaration_revenus'));
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
