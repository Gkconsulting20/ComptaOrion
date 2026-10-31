import express from 'express';
import { db } from '../db.js';
import { 
  plansComptables, comptes, comptesComptables, journaux, ecritures, lignesEcritures, 
  soldesComptes, entreprises
} from '../schema.js';
import { eq, and, desc, gte, lte, sum, sql } from 'drizzle-orm';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';
import { synchroniserTransactionDepuisEcriture } from '../services/treasuryJournalSync.js';
import { generateNumeroEcriture } from '../services/comptabiliteService.js';

const router = express.Router();

function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Plan comptable SYSCOHADA complet
const PLAN_SYSCOHADA = [
  // Classe 1 - Comptes de ressources durables
  { numero: '101', nom: 'Capital social', categorie: 'Capitaux propres', classe: '1' },
  { numero: '106', nom: 'Réserves', categorie: 'Capitaux propres', classe: '1' },
  { numero: '109', nom: 'Actionnaires, capital souscrit non appelé', categorie: 'Capitaux propres', classe: '1' },
  { numero: '110', nom: 'Report à nouveau', categorie: 'Capitaux propres', classe: '1' },
  { numero: '120', nom: 'Résultat de l\'exercice (bénéfice)', categorie: 'Capitaux propres', classe: '1' },
  { numero: '129', nom: 'Résultat de l\'exercice (perte)', categorie: 'Capitaux propres', classe: '1' },
  { numero: '130', nom: 'Résultat en instance d\'affectation', categorie: 'Capitaux propres', classe: '1' },
  { numero: '140', nom: 'Subventions d\'investissement', categorie: 'Capitaux propres', classe: '1' },
  { numero: '160', nom: 'Emprunts et dettes assimilées', categorie: 'Passif', classe: '1' },
  { numero: '161', nom: 'Emprunts obligataires', categorie: 'Passif', classe: '1' },
  { numero: '162', nom: 'Emprunts auprès des établissements de crédit', categorie: 'Passif', classe: '1' },
  { numero: '165', nom: 'Dépôts et cautionnements reçus', categorie: 'Passif', classe: '1' },
  { numero: '170', nom: 'Dettes de crédit-bail et contrats assimilés', categorie: 'Passif', classe: '1' },
  { numero: '180', nom: 'Dettes liées à des participations', categorie: 'Passif', classe: '1' },
  { numero: '190', nom: 'Provisions financières pour risques et charges', categorie: 'Passif', classe: '1' },
  
  // Classe 2 - Comptes d'actif immobilisé
  { numero: '201', nom: 'Frais d\'établissement', categorie: 'Actif', classe: '2' },
  { numero: '211', nom: 'Terrains', categorie: 'Actif', classe: '2' },
  { numero: '212', nom: 'Agencements et aménagements de terrains', categorie: 'Actif', classe: '2' },
  { numero: '213', nom: 'Constructions', categorie: 'Actif', classe: '2' },
  { numero: '215', nom: 'Installations techniques', categorie: 'Actif', classe: '2' },
  { numero: '218', nom: 'Autres immobilisations corporelles', categorie: 'Actif', classe: '2' },
  { numero: '221', nom: 'Brevets, licences, logiciels', categorie: 'Actif', classe: '2' },
  { numero: '231', nom: 'Immobilisations corporelles en cours', categorie: 'Actif', classe: '2' },
  { numero: '241', nom: 'Matériel de transport', categorie: 'Actif', classe: '2' },
  { numero: '244', nom: 'Mobilier et matériel de bureau', categorie: 'Actif', classe: '2' },
  { numero: '245', nom: 'Matériel informatique', categorie: 'Actif', classe: '2' },
  { numero: '260', nom: 'Participations et créances rattachées', categorie: 'Actif', classe: '2' },
  { numero: '270', nom: 'Autres immobilisations financières', categorie: 'Actif', classe: '2' },
  { numero: '280', nom: 'Amortissements des immobilisations', categorie: 'Actif', classe: '2' },
  { numero: '290', nom: 'Provisions pour dépréciation', categorie: 'Actif', classe: '2' },
  
  // Classe 3 - Comptes de stocks
  { numero: '310', nom: 'Marchandises', categorie: 'Actif', classe: '3' },
  { numero: '320', nom: 'Matières premières et fournitures liées', categorie: 'Actif', classe: '3' },
  { numero: '330', nom: 'Autres approvisionnements', categorie: 'Actif', classe: '3' },
  { numero: '340', nom: 'Produits en cours', categorie: 'Actif', classe: '3' },
  { numero: '350', nom: 'Services en cours', categorie: 'Actif', classe: '3' },
  { numero: '360', nom: 'Produits finis', categorie: 'Actif', classe: '3' },
  { numero: '370', nom: 'Produits intermédiaires', categorie: 'Actif', classe: '3' },
  { numero: '380', nom: 'Stocks à l\'extérieur', categorie: 'Actif', classe: '3' },
  { numero: '390', nom: 'Dépréciations des stocks', categorie: 'Actif', classe: '3' },
  
  // Classe 4 - Comptes de tiers
  { numero: '401', nom: 'Fournisseurs', categorie: 'Passif', classe: '4' },
  { numero: '408', nom: 'Fournisseurs - Factures non parvenues', categorie: 'Passif', classe: '4' },
  { numero: '409', nom: 'Fournisseurs débiteurs', categorie: 'Actif', classe: '4' },
  { numero: '411', nom: 'Clients', categorie: 'Actif', classe: '4' },
  { numero: '412', nom: 'Clients - Effets à recevoir', categorie: 'Actif', classe: '4' },
  { numero: '416', nom: 'Clients douteux ou litigieux', categorie: 'Actif', classe: '4' },
  { numero: '418', nom: 'Clients - Produits non encore facturés', categorie: 'Actif', classe: '4' },
  { numero: '419', nom: 'Clients créditeurs', categorie: 'Passif', classe: '4' },
  { numero: '421', nom: 'Personnel - Rémunérations dues', categorie: 'Passif', classe: '4' },
  { numero: '422', nom: 'Personnel - Avances et acomptes', categorie: 'Actif', classe: '4' },
  { numero: '431', nom: 'Sécurité sociale', categorie: 'Passif', classe: '4' },
  { numero: '441', nom: 'État - Impôts sur les bénéfices', categorie: 'Passif', classe: '4' },
  { numero: '442', nom: 'État - Autres impôts et taxes', categorie: 'Passif', classe: '4' },
  { numero: '443', nom: 'État - TVA facturée', categorie: 'Passif', classe: '4' },
  { numero: '445', nom: 'État - TVA récupérable', categorie: 'Actif', classe: '4' },
  { numero: '447', nom: 'État - Impôts retenus à la source', categorie: 'Passif', classe: '4' },
  { numero: '449', nom: 'État - Créances et dettes diverses', categorie: 'Passif', classe: '4' },
  { numero: '471', nom: 'Comptes d\'attente à régulariser', categorie: 'Actif', classe: '4' },
  { numero: '476', nom: 'Charges constatées d\'avance', categorie: 'Actif', classe: '4' },
  { numero: '477', nom: 'Produits constatés d\'avance', categorie: 'Passif', classe: '4' },
  { numero: '490', nom: 'Dépréciations des comptes de tiers', categorie: 'Actif', classe: '4' },
  
  // Classe 5 - Comptes de trésorerie
  { numero: '512', nom: 'Banques', categorie: 'Actif', classe: '5' },
  { numero: '513', nom: 'Chèques à encaisser', categorie: 'Actif', classe: '5' },
  { numero: '514', nom: 'Chèques à l\'encaissement', categorie: 'Actif', classe: '5' },
  { numero: '515', nom: 'Caisse', categorie: 'Actif', classe: '5' },
  { numero: '517', nom: 'Régies d\'avances et accréditifs', categorie: 'Actif', classe: '5' },
  { numero: '518', nom: 'Virements de fonds', categorie: 'Actif', classe: '5' },
  { numero: '520', nom: 'Banques, découverts', categorie: 'Passif', classe: '5' },
  { numero: '530', nom: 'Établissements financiers', categorie: 'Actif', classe: '5' },
  { numero: '560', nom: 'Banques, crédits de trésorerie', categorie: 'Passif', classe: '5' },
  { numero: '570', nom: 'Caisses', categorie: 'Actif', classe: '5' },
  { numero: '580', nom: 'Virements internes', categorie: 'Actif', classe: '5' },
  { numero: '590', nom: 'Dépréciations des titres de placement', categorie: 'Actif', classe: '5' },
  
  // Classe 6 - Comptes de charges
  { numero: '601', nom: 'Achats de marchandises', categorie: 'Charges', classe: '6' },
  { numero: '602', nom: 'Achats de matières premières', categorie: 'Charges', classe: '6' },
  { numero: '604', nom: 'Achats d\'études et prestations de services', categorie: 'Charges', classe: '6' },
  { numero: '605', nom: 'Autres achats', categorie: 'Charges', classe: '6' },
  { numero: '608', nom: 'Frais accessoires d\'achat', categorie: 'Charges', classe: '6' },
  { numero: '610', nom: 'Transports sur achats', categorie: 'Charges', classe: '6' },
  { numero: '612', nom: 'Transports sur ventes', categorie: 'Charges', classe: '6' },
  { numero: '613', nom: 'Locations et charges locatives', categorie: 'Charges', classe: '6' },
  { numero: '614', nom: 'Charges locatives et de copropriété', categorie: 'Charges', classe: '6' },
  { numero: '616', nom: 'Primes d\'assurance', categorie: 'Charges', classe: '6' },
  { numero: '618', nom: 'Autres services extérieurs', categorie: 'Charges', classe: '6' },
  { numero: '621', nom: 'Personnel extérieur à l\'entreprise', categorie: 'Charges', classe: '6' },
  { numero: '622', nom: 'Rémunérations d\'intermédiaires et honoraires', categorie: 'Charges', classe: '6' },
  { numero: '623', nom: 'Publicité, publications, relations publiques', categorie: 'Charges', classe: '6' },
  { numero: '624', nom: 'Frais de transport et de déplacements', categorie: 'Charges', classe: '6' },
  { numero: '625', nom: 'Frais de télécommunication', categorie: 'Charges', classe: '6' },
  { numero: '626', nom: 'Frais bancaires', categorie: 'Charges', classe: '6' },
  { numero: '627', nom: 'Services bancaires et assimilés', categorie: 'Charges', classe: '6' },
  { numero: '628', nom: 'Divers services extérieurs', categorie: 'Charges', classe: '6' },
  { numero: '631', nom: 'Impôts, taxes et versements assimilés', categorie: 'Charges', classe: '6' },
  { numero: '641', nom: 'Rémunérations du personnel', categorie: 'Charges', classe: '6' },
  { numero: '645', nom: 'Charges de sécurité sociale', categorie: 'Charges', classe: '6' },
  { numero: '646', nom: 'Charges sociales sur congés à payer', categorie: 'Charges', classe: '6' },
  { numero: '651', nom: 'Pertes sur créances clients', categorie: 'Charges', classe: '6' },
  { numero: '654', nom: 'Pertes sur créances', categorie: 'Charges', classe: '6' },
  { numero: '658', nom: 'Charges diverses de gestion courante', categorie: 'Charges', classe: '6' },
  { numero: '661', nom: 'Intérêts des emprunts', categorie: 'Charges', classe: '6' },
  { numero: '665', nom: 'Escomptes accordés', categorie: 'Charges', classe: '6' },
  { numero: '671', nom: 'Intérêts des emprunts et dettes', categorie: 'Charges', classe: '6' },
  { numero: '675', nom: 'Pertes de change', categorie: 'Charges', classe: '6' },
  { numero: '681', nom: 'Dotations aux amortissements d\'exploitation', categorie: 'Charges', classe: '6' },
  { numero: '686', nom: 'Dotations aux provisions financières', categorie: 'Charges', classe: '6' },
  { numero: '691', nom: 'Impôts sur les bénéfices', categorie: 'Charges', classe: '6' },
  
  // Classe 7 - Comptes de produits
  { numero: '701', nom: 'Ventes de marchandises', categorie: 'Produits', classe: '7' },
  { numero: '702', nom: 'Ventes de produits finis', categorie: 'Produits', classe: '7' },
  { numero: '703', nom: 'Ventes de produits intermédiaires', categorie: 'Produits', classe: '7' },
  { numero: '704', nom: 'Ventes de travaux', categorie: 'Produits', classe: '7' },
  { numero: '705', nom: 'Ventes d\'études et prestations de services', categorie: 'Produits', classe: '7' },
  { numero: '706', nom: 'Produits des activités annexes', categorie: 'Produits', classe: '7' },
  { numero: '707', nom: 'Produits accessoires', categorie: 'Produits', classe: '7' },
  { numero: '708', nom: 'Produits des opérations faites en commun', categorie: 'Produits', classe: '7' },
  { numero: '711', nom: 'Subventions d\'exploitation', categorie: 'Produits', classe: '7' },
  { numero: '721', nom: 'Production immobilisée', categorie: 'Produits', classe: '7' },
  { numero: '736', nom: 'Variation des stocks de produits finis', categorie: 'Produits', classe: '7' },
  { numero: '754', nom: 'Redevances pour brevets et licences', categorie: 'Produits', classe: '7' },
  { numero: '758', nom: 'Produits divers de gestion courante', categorie: 'Produits', classe: '7' },
  { numero: '761', nom: 'Revenus des participations', categorie: 'Produits', classe: '7' },
  { numero: '762', nom: 'Revenus des autres immobilisations financières', categorie: 'Produits', classe: '7' },
  { numero: '765', nom: 'Escomptes obtenus', categorie: 'Produits', classe: '7' },
  { numero: '771', nom: 'Intérêts des prêts et créances', categorie: 'Produits', classe: '7' },
  { numero: '775', nom: 'Gains de change', categorie: 'Produits', classe: '7' },
  { numero: '781', nom: 'Reprises sur amortissements et provisions', categorie: 'Produits', classe: '7' },
  { numero: '786', nom: 'Reprises de provisions financières', categorie: 'Produits', classe: '7' },
  { numero: '791', nom: 'Reprises de provisions d\'exploitation', categorie: 'Produits', classe: '7' },
  
  // Classe 8 - Comptes spéciaux
  { numero: '801', nom: 'Résultat d\'exploitation', categorie: 'Résultat', classe: '8' },
  { numero: '810', nom: 'Résultat financier', categorie: 'Résultat', classe: '8' },
  { numero: '820', nom: 'Résultat des activités ordinaires', categorie: 'Résultat', classe: '8' },
  { numero: '830', nom: 'Résultat hors activités ordinaires', categorie: 'Résultat', classe: '8' },
  { numero: '840', nom: 'Impôts sur le résultat', categorie: 'Résultat', classe: '8' },
  { numero: '850', nom: 'Résultat net de l\'exercice', categorie: 'Résultat', classe: '8' },
];

// Initialiser le plan comptable SYSCOHADA
router.post('/init-syscohada', async (req, res) => {
  try {
    const { entrepriseId } = req.body;
    const eId = parseInt(entrepriseId);
    
    // Vérifier si des comptes existent déjà
    const existingComptes = await db.query.comptes.findMany({
      where: eq(comptes.entrepriseId, eId)
    });
    
    if (existingComptes.length > 10) {
      return res.status(400).json({ 
        error: 'Le plan comptable est déjà initialisé',
        count: existingComptes.length 
      });
    }
    
    // Insérer tous les comptes SYSCOHADA
    const insertedComptes = [];
    for (const compte of PLAN_SYSCOHADA) {
      try {
        const result = await db.insert(comptes).values({
          entrepriseId: eId,
          numero: compte.numero,
          nom: compte.nom,
          categorie: compte.categorie,
          sousCategorie: compte.classe,
          devise: 'XOF',
          solde: 0,
          actif: true
        }).returning();
        insertedComptes.push(result[0]);
      } catch (err) {
        // Ignorer les doublons
        console.log(`Compte ${compte.numero} existe déjà`);
      }
    }
    
    // Créer les journaux de base
    const journauxBase = [
      { code: 'AC', nom: 'Journal des Achats', type: 'achats' },
      { code: 'VE', nom: 'Journal des Ventes', type: 'ventes' },
      { code: 'BQ', nom: 'Journal de Banque', type: 'banque' },
      { code: 'CA', nom: 'Journal de Caisse', type: 'caisse' },
      { code: 'OD', nom: 'Journal des Opérations Diverses', type: 'od' },
      { code: 'SA', nom: 'Journal des Salaires', type: 'od' },
      { code: 'AN', nom: 'Journal à Nouveaux', type: 'od' }
    ];
    
    for (const journal of journauxBase) {
      try {
        await db.insert(journaux).values({
          entrepriseId: eId,
          code: journal.code,
          nom: journal.nom,
          type: journal.type,
          actif: true
        });
      } catch (err) {
        console.log(`Journal ${journal.code} existe déjà`);
      }
    }
    
    res.json({ 
      message: 'Plan comptable SYSCOHADA initialisé',
      comptesCreés: insertedComptes.length,
      total: PLAN_SYSCOHADA.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bilan comptable
router.get('/rapports/bilan', async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const eId = req.entrepriseId || parseInt(req.query.entrepriseId);
    
    const allComptes = await db.query.comptesComptables.findMany({
      where: eq(comptesComptables.entrepriseId, eId)
    });
    
    const ecrituresData = await db.execute(sql`
      SELECT le.compte_comptable_id, 
             SUM(COALESCE(le.debit, 0)) as total_debit,
             SUM(COALESCE(le.credit, 0)) as total_credit
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      JOIN comptes_comptables cc ON cc.id = le.compte_comptable_id
      WHERE e.entreprise_id = ${eId}
        AND e.valide = true
        AND le.entreprise_id = ${eId}
        AND cc.entreprise_id = ${eId}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
      GROUP BY le.compte_comptable_id
    `);
    
    const soldesMap = {};
    const rows = ecrituresData.rows || ecrituresData || [];
    rows.forEach(row => {
      soldesMap[row.compte_comptable_id] = {
        debit: parseFloat(row.total_debit || 0),
        credit: parseFloat(row.total_credit || 0)
      };
    });

    const resultatPeriodeData = await db.execute(sql`
      SELECT le.compte_comptable_id,
             SUM(COALESCE(le.debit, 0)) as total_debit,
             SUM(COALESCE(le.credit, 0)) as total_credit
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      JOIN comptes_comptables cc ON cc.id = le.compte_comptable_id
      WHERE e.entreprise_id = ${eId}
        AND e.valide = true
        AND le.entreprise_id = ${eId}
        AND cc.entreprise_id = ${eId}
        AND (cc.numero LIKE '6%' OR cc.numero LIKE '7%')
        ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
        ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
      GROUP BY le.compte_comptable_id
    `);
    const soldesResultatPeriodeMap = {};
    (resultatPeriodeData.rows || resultatPeriodeData || []).forEach(row => {
      soldesResultatPeriodeMap[row.compte_comptable_id] = {
        debit: parseFloat(row.total_debit || 0),
        credit: parseFloat(row.total_credit || 0)
      };
    });
    
    // Calculer le résultat net (Produits classe 7 - Charges classe 6)
    let totalCharges = 0;
    let totalProduits = 0;
    allComptes.forEach(compte => {
      const solde = soldesResultatPeriodeMap[compte.id] || { debit: 0, credit: 0 };
      if (compte.numero.startsWith('6')) {
        totalCharges += solde.debit - solde.credit;
      } else if (compte.numero.startsWith('7')) {
        totalProduits += solde.credit - solde.debit;
      }
    });
    const resultatNet = totalProduits - totalCharges;
    
    // Structurer le bilan selon SYSCOHADA
    const actif = { 
      immobilise: [], 
      amortissements: [],
      circulant: [], 
      tresorerie: [], 
      total: 0,
      totalBrut: 0,
      totalAmortissements: 0
    };
    const passif = { 
      capitaux: [], 
      dettes: [], 
      resultatExercice: 0, 
      total: 0 
    };
    
    allComptes.forEach(compte => {
      const solde = soldesMap[compte.id] || { debit: 0, credit: 0 };
      const soldeBrut = solde.debit - solde.credit;
      
      // Ignorer les comptes de charges (6) et produits (7)
      if (compte.numero.startsWith('6') || compte.numero.startsWith('7')) return;
      if (compte.numero.startsWith('8')) return;
      
      // Ignorer les comptes sans solde
      if (Math.abs(soldeBrut) < 0.01) return;
      
      const numero = compte.numero;
      
      // CLASSE 1 - Capitaux propres et dettes financières (solde créditeur = passif)
      if (numero.startsWith('1')) {
        const montant = Math.abs(soldeBrut);
        passif.capitaux.push({
          id: compte.id,
          numero: numero,
          nom: compte.nom,
          solde: montant
        });
        passif.total += montant;
      }
      // CLASSE 2 - Immobilisations
      else if (numero.startsWith('2')) {
        // Comptes 28x et 29x = Amortissements et provisions (solde créditeur, à déduire de l'actif)
        if (numero.startsWith('28') || numero.startsWith('29')) {
          const montant = Math.abs(soldeBrut);
          actif.amortissements.push({
            id: compte.id,
            numero: numero,
            nom: compte.nom,
            solde: montant
          });
          actif.totalAmortissements += montant;
          actif.total -= montant;
        } else {
          // Immobilisations brutes (solde débiteur)
          const montant = soldeBrut > 0 ? soldeBrut : 0;
          if (montant > 0) {
            actif.immobilise.push({
              id: compte.id,
              numero: numero,
              nom: compte.nom,
              solde: montant
            });
            actif.totalBrut += montant;
            actif.total += montant;
          }
        }
      }
      // CLASSE 3 - Stocks (solde débiteur = actif)
      else if (numero.startsWith('3')) {
        if (numero.startsWith('39')) {
          // Provisions pour dépréciation de stocks
          const montant = Math.abs(soldeBrut);
          actif.total -= montant;
        } else {
          const montant = soldeBrut > 0 ? soldeBrut : 0;
          if (montant > 0) {
            actif.circulant.push({
              id: compte.id,
              numero: numero,
              nom: compte.nom,
              solde: montant
            });
            actif.total += montant;
          }
        }
      }
      // CLASSE 4 - Comptes de tiers (classement selon le signe du solde)
      else if (numero.startsWith('4')) {
        if (numero.startsWith('49')) {
          // Provisions pour dépréciation des comptes de tiers
          const montant = Math.abs(soldeBrut);
          actif.total -= montant;
        } else if (soldeBrut > 0) {
          // Solde débiteur = créances (actif)
          actif.circulant.push({
            id: compte.id,
            numero: numero,
            nom: compte.nom,
            solde: soldeBrut
          });
          actif.total += soldeBrut;
        } else if (soldeBrut < 0) {
          // Solde créditeur = dettes (passif)
          const montant = Math.abs(soldeBrut);
          passif.dettes.push({
            id: compte.id,
            numero: numero,
            nom: compte.nom,
            solde: montant
          });
          passif.total += montant;
        }
      }
      // CLASSE 5 - Trésorerie
      else if (numero.startsWith('5')) {
        if (soldeBrut > 0) {
          actif.tresorerie.push({
            id: compte.id,
            numero: numero,
            nom: compte.nom,
            solde: soldeBrut
          });
          actif.total += soldeBrut;
        } else if (soldeBrut < 0) {
          // Découvert bancaire = passif
          const montant = Math.abs(soldeBrut);
          passif.dettes.push({
            id: compte.id,
            numero: numero,
            nom: compte.nom,
            solde: montant
          });
          passif.total += montant;
        }
      }
    });
    
    // Ajouter le résultat de l'exercice aux capitaux propres
    passif.resultatExercice = resultatNet;
    if (Math.abs(resultatNet) > 0.01) {
      const isPerte = resultatNet < 0;
      passif.capitaux.push({
        id: 'resultat',
        numero: isPerte ? '129' : '120',
        nom: isPerte ? 'Résultat de l\'exercice (Perte)' : 'Résultat de l\'exercice (Bénéfice)',
        solde: Math.abs(resultatNet),
        isResultat: true,
        isPerte: isPerte
      });
      // Une perte réduit les capitaux propres, un bénéfice les augmente
      // Mathématiquement: Total Passif = Capitaux + Résultat + Dettes
      if (isPerte) {
        passif.total -= Math.abs(resultatNet);
      } else {
        passif.total += Math.abs(resultatNet);
      }
    }
    
    // Trier les comptes par numéro
    actif.immobilise.sort((a, b) => a.numero.localeCompare(b.numero));
    actif.amortissements.sort((a, b) => a.numero.localeCompare(b.numero));
    actif.circulant.sort((a, b) => a.numero.localeCompare(b.numero));
    actif.tresorerie.sort((a, b) => a.numero.localeCompare(b.numero));
    passif.capitaux.sort((a, b) => a.numero.localeCompare(b.numero));
    passif.dettes.sort((a, b) => a.numero.localeCompare(b.numero));
    
    const entreprise = await db.query.entreprises.findFirst({
      where: eq(entreprises.id, eId)
    });
    
    res.json({
      entreprise: {
        nom: entreprise?.nom,
        logo: entreprise?.logo,
        adresse: entreprise?.adresse,
        telephone: entreprise?.telephone,
        email: entreprise?.email,
        rccm: entreprise?.rccm,
        ifu: entreprise?.ifu
      },
      actif,
      passif,
      resultatComptes: allComptes
        .filter(compte => compte.numero.startsWith('6') || compte.numero.startsWith('7'))
        .map(({ id, numero, nom }) => ({ id, numero, nom })),
      resultatNet,
      totalCharges,
      totalProduits,
      dateFin,
      equilibre: Math.abs(actif.total - passif.total) < 1
    });
  } catch (error) {
    console.error('Erreur bilan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Compte de résultat
router.get('/rapports/resultat', async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const eId = req.entrepriseId || parseInt(req.query.entrepriseId);
    
    const allComptes = await db.query.comptesComptables.findMany({
      where: eq(comptesComptables.entrepriseId, eId)
    });
    
    const ecrituresData = await db.execute(sql`
      SELECT le.compte_comptable_id, 
             SUM(COALESCE(le.debit, 0)) as total_debit,
             SUM(COALESCE(le.credit, 0)) as total_credit
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      JOIN comptes_comptables cc ON cc.id = le.compte_comptable_id
      WHERE e.entreprise_id = ${eId}
        AND e.valide = true
        AND le.entreprise_id = ${eId}
        AND cc.entreprise_id = ${eId}
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
      GROUP BY le.compte_comptable_id
    `);
    
    const soldesMap = {};
    const rows = ecrituresData.rows || ecrituresData || [];
    rows.forEach(row => {
      soldesMap[row.compte_comptable_id] = {
        debit: parseFloat(row.total_debit || 0),
        credit: parseFloat(row.total_credit || 0)
      };
    });
    
    const charges = { exploitation: [], financieres: [], exceptionnelles: [], total: 0 };
    const produits = { exploitation: [], financiers: [], exceptionnels: [], total: 0 };
    
    allComptes.forEach(compte => {
      const solde = soldesMap[compte.id] || { debit: 0, credit: 0 };
      
      const compteData = {
        id: compte.id,
        compte: compte.numero,
        nom: compte.nom,
        montant: 0
      };
      
      if (compte.numero.startsWith('6')) {
        compteData.montant = solde.debit - solde.credit;
        if (compteData.montant === 0) return;
        if (compte.numero.startsWith('66') || compte.numero.startsWith('67')) {
          charges.financieres.push(compteData);
        } else {
          charges.exploitation.push(compteData);
        }
        charges.total += compteData.montant;
      } else if (compte.numero.startsWith('7')) {
        compteData.montant = solde.credit - solde.debit;
        if (compteData.montant === 0) return;
        if (compte.numero.startsWith('76') || compte.numero.startsWith('77')) {
          produits.financiers.push(compteData);
        } else {
          produits.exploitation.push(compteData);
        }
        produits.total += compteData.montant;
      }
    });
    
    const resultatExploitation = produits.exploitation.reduce((s, p) => s + p.montant, 0) - 
                                  charges.exploitation.reduce((s, c) => s + c.montant, 0);
    const resultatFinancier = produits.financiers.reduce((s, p) => s + p.montant, 0) - 
                              charges.financieres.reduce((s, c) => s + c.montant, 0);
    const resultatNet = produits.total - charges.total;
    
    // Récupérer les infos de l'entreprise pour le logo
    const entreprise = await db.query.entreprises.findFirst({
      where: eq(entreprises.id, eId)
    });
    
    res.json({
      entreprise: {
        nom: entreprise?.nom,
        logo: entreprise?.logo
      },
      charges,
      produits,
      resultatExploitation,
      resultatFinancier,
      resultatNet,
      benefice: resultatNet > 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Détail paginé des écritures validées qui composent un ou plusieurs montants de rapport
router.get('/rapports/drill-down', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId;
    if (!entrepriseId) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const rawAccountIds = typeof req.query.accountIds === 'string' ? req.query.accountIds : '';
    const accountIdTokens = rawAccountIds.split(',');
    const parsedAccountIds = accountIdTokens.map(value => Number(value));
    if (
      !rawAccountIds ||
      accountIdTokens.length > 300 ||
      accountIdTokens.some(value => !/^\d+$/.test(value)) ||
      parsedAccountIds.some(id => !Number.isInteger(id) || id <= 0)
    ) {
      return res.status(400).json({ error: 'Sélection de comptes invalide' });
    }
    const accountIds = [...new Set(parsedAccountIds)];

    const { dateDebut, dateFin } = req.query;
    if (
      (dateDebut && !isISODate(dateDebut)) ||
      (dateFin && !isISODate(dateFin)) ||
      (dateDebut && dateFin && dateDebut > dateFin)
    ) {
      return res.status(400).json({ error: 'Période invalide' });
    }

    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 200)
      : 100;
    const offset = (page - 1) * limit;
    const accountIdsSql = sql.join(accountIds.map(id => sql`${id}`), sql`, `);
    const dateDebutFilter = dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``;
    const dateFinFilter = dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``;

    const mouvementsResult = await db.execute(sql`
      SELECT
        le.id,
        e.id AS ecriture_id,
        e.date_ecriture AS date,
        COALESCE(j.code, '') AS journal,
        COALESCE(e.numero_piece, '') AS reference,
        COALESCE(le.libelle, e.libelle, '') AS libelle,
        cc.numero AS compte_numero,
        cc.nom AS compte_nom,
        COALESCE(le.debit, 0) AS debit,
        COALESCE(le.credit, 0) AS credit,
        SUM(COALESCE(le.debit, 0) - COALESCE(le.credit, 0))
          OVER (ORDER BY e.date_ecriture, e.id, le.id) AS solde_cumule
      FROM lignes_ecriture le
      JOIN ecritures e ON e.id = le.ecriture_id
      JOIN comptes_comptables cc ON cc.id = le.compte_comptable_id
      LEFT JOIN journaux j ON j.id = e.journal_id
      WHERE e.entreprise_id = ${entrepriseId}
        AND e.valide = true
        AND le.entreprise_id = ${entrepriseId}
        AND cc.entreprise_id = ${entrepriseId}
        AND le.compte_comptable_id IN (${accountIdsSql})
        ${dateDebutFilter}
        ${dateFinFilter}
      ORDER BY e.date_ecriture, e.id, le.id
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`
      SELECT COUNT(*) AS total
      FROM lignes_ecriture le
      JOIN ecritures e ON e.id = le.ecriture_id
      JOIN comptes_comptables cc ON cc.id = le.compte_comptable_id
      WHERE e.entreprise_id = ${entrepriseId}
        AND e.valide = true
        AND le.entreprise_id = ${entrepriseId}
        AND cc.entreprise_id = ${entrepriseId}
        AND le.compte_comptable_id IN (${accountIdsSql})
        ${dateDebutFilter}
        ${dateFinFilter}
    `);
    const totalsResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(le.debit), 0) AS total_debit,
        COALESCE(SUM(le.credit), 0) AS total_credit
      FROM lignes_ecriture le
      JOIN ecritures e ON e.id = le.ecriture_id
      JOIN comptes_comptables cc ON cc.id = le.compte_comptable_id
      WHERE e.entreprise_id = ${entrepriseId}
        AND e.valide = true
        AND le.entreprise_id = ${entrepriseId}
        AND cc.entreprise_id = ${entrepriseId}
        AND le.compte_comptable_id IN (${accountIdsSql})
        ${dateDebutFilter}
        ${dateFinFilter}
    `);

    const rows = mouvementsResult.rows || mouvementsResult || [];
    const countRows = countResult.rows || countResult || [];
    const totalRows = totalsResult.rows || totalsResult || [];
    const total = Number(countRows[0]?.total || 0);
    const totalDebit = Number(totalRows[0]?.total_debit || 0);
    const totalCredit = Number(totalRows[0]?.total_credit || 0);

    res.json({
      mouvements: rows.map(row => ({
        id: row.id,
        ecritureId: row.ecriture_id,
        date: row.date,
        journal: row.journal,
        reference: row.reference,
        libelle: row.libelle,
        compteNumero: row.compte_numero,
        compteNom: row.compte_nom,
        debit: Number(row.debit || 0),
        credit: Number(row.credit || 0),
        soldeCumule: Number(row.solde_cumule || 0)
      })),
      totaux: {
        totalDebit,
        totalCredit,
        solde: totalDebit - totalCredit
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erreur drill-down rapports financiers:', error);
    res.status(500).json({ error: 'Impossible de charger les transactions de ce montant' });
  }
});

// Rapport des Journaux
router.get('/rapport-journaux', async (req, res) => {
  try {
    const { dateDebut, dateFin, journalId } = req.query;
    const eId = req.entrepriseId || parseInt(req.query.entrepriseId);
    
    // Récupérer les journaux de l'entreprise (filtrer par journalId si fourni)
    let allJournaux;
    if (journalId) {
      allJournaux = await db.query.journaux.findMany({
        where: and(eq(journaux.entrepriseId, eId), eq(journaux.id, parseInt(journalId)))
      });
    } else {
      allJournaux = await db.query.journaux.findMany({
        where: eq(journaux.entrepriseId, eId)
      });
    }
    
    // Pour chaque journal, calculer les totaux
    const journauxRapport = [];
    let totalGeneralDebit = 0;
    let totalGeneralCredit = 0;
    let totalGeneralEcritures = 0;
    
    for (const journal of allJournaux) {
      const ecrituresJournal = await db.execute(sql`
        SELECT e.id, e.date_ecriture, e.numero_piece, e.libelle,
               SUM(COALESCE(le.debit, 0)) as total_debit,
               SUM(COALESCE(le.credit, 0)) as total_credit
        FROM ecritures e
        LEFT JOIN lignes_ecriture le ON le.ecriture_id = e.id
        WHERE e.entreprise_id = ${eId}
        AND e.journal_id = ${journal.id}
        ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
        ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
        GROUP BY e.id, e.date_ecriture, e.numero_piece, e.libelle
        ORDER BY e.date_ecriture
      `);
      
      const rows = ecrituresJournal.rows || ecrituresJournal || [];
      const nombreEcritures = rows.length;
      const debitJournal = rows.reduce((sum, r) => sum + parseFloat(r.total_debit || 0), 0);
      const creditJournal = rows.reduce((sum, r) => sum + parseFloat(r.total_credit || 0), 0);
      
      if (nombreEcritures > 0) {
        journauxRapport.push({
          code: journal.code,
          nom: journal.nom,
          type: journal.type,
          nombreEcritures,
          debit: debitJournal,
          credit: creditJournal,
          ecritures: rows.map(r => ({
            date: r.date_ecriture,
            reference: r.numero_piece,
            libelle: r.libelle,
            debit: parseFloat(r.total_debit || 0),
            credit: parseFloat(r.total_credit || 0)
          }))
        });
        
        totalGeneralDebit += debitJournal;
        totalGeneralCredit += creditJournal;
        totalGeneralEcritures += nombreEcritures;
      }
    }
    
    // Infos entreprise
    const entreprise = await db.query.entreprises.findFirst({
      where: eq(entreprises.id, eId)
    });
    
    res.json({
      entreprise: {
        nom: entreprise?.nom,
        logo: entreprise?.logo,
        adresse: entreprise?.adresse,
        telephone: entreprise?.telephone,
        email: entreprise?.email,
        rccm: entreprise?.rccm,
        ifu: entreprise?.ifu
      },
      periode: { dateDebut, dateFin },
      journaux: journauxRapport,
      totaux: {
        nombreEcritures: totalGeneralEcritures,
        debit: totalGeneralDebit,
        credit: totalGeneralCredit,
        equilibre: Math.abs(totalGeneralDebit - totalGeneralCredit) < 0.01
      }
    });
  } catch (error) {
    console.error('Erreur rapport journaux:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tableau des Flux de Trésorerie
router.get('/rapports/flux-tresorerie', async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const eId = req.entrepriseId || parseInt(req.query.entrepriseId);
    
    // Récupérer les mouvements des comptes de trésorerie (classe 5)
    const fluxData = await db.execute(sql`
      SELECT cc.numero, cc.nom,
             SUM(COALESCE(le.debit, 0)) as entrees,
             SUM(COALESCE(le.credit, 0)) as sorties
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
      WHERE e.entreprise_id = ${eId}
      AND cc.numero LIKE '5%'
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
      GROUP BY cc.numero, cc.nom
      ORDER BY cc.numero
    `);
    
    // Flux d'exploitation (produits et charges)
    const fluxExploitation = await db.execute(sql`
      SELECT 
        CASE 
          WHEN cc.numero LIKE '7%' THEN 'Encaissements clients'
          WHEN cc.numero LIKE '6%' THEN 'Décaissements fournisseurs'
        END as categorie,
        SUM(CASE WHEN cc.numero LIKE '7%' THEN COALESCE(le.credit, 0) ELSE 0 END) as encaissements,
        SUM(CASE WHEN cc.numero LIKE '6%' THEN COALESCE(le.debit, 0) ELSE 0 END) as decaissements
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
      WHERE e.entreprise_id = ${eId}
      AND (cc.numero LIKE '6%' OR cc.numero LIKE '7%')
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
      GROUP BY CASE WHEN cc.numero LIKE '7%' THEN 'Encaissements clients' WHEN cc.numero LIKE '6%' THEN 'Décaissements fournisseurs' END
    `);
    
    // Flux d'investissement (classe 2)
    const fluxInvestissement = await db.execute(sql`
      SELECT cc.numero, cc.nom,
             SUM(COALESCE(le.debit, 0)) as acquisitions,
             SUM(COALESCE(le.credit, 0)) as cessions
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
      WHERE e.entreprise_id = ${eId}
      AND cc.numero LIKE '2%'
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
      GROUP BY cc.numero, cc.nom
      ORDER BY cc.numero
    `);

    // Flux de financement (classe 1 - capitaux, emprunts)
    const fluxFinancement = await db.execute(sql`
      SELECT cc.numero, cc.nom,
             SUM(COALESCE(le.credit, 0)) as apports,
             SUM(COALESCE(le.debit, 0)) as remboursements
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
      WHERE e.entreprise_id = ${eId}
      AND (cc.numero LIKE '10%' OR cc.numero LIKE '11%' OR cc.numero LIKE '12%' 
           OR cc.numero LIKE '13%' OR cc.numero LIKE '14%' OR cc.numero LIKE '15%' 
           OR cc.numero LIKE '16%' OR cc.numero LIKE '17%' OR cc.numero LIKE '18%' OR cc.numero LIKE '19%')
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
      GROUP BY cc.numero, cc.nom
      ORDER BY cc.numero
    `);
    
    const rowsFlux = fluxData.rows || fluxData || [];
    const rowsExpl = fluxExploitation.rows || fluxExploitation || [];
    const rowsInv = fluxInvestissement.rows || fluxInvestissement || [];
    const rowsFin = fluxFinancement.rows || fluxFinancement || [];
    
    // Calculer les totaux
    const totalEntrees = rowsFlux.reduce((sum, r) => sum + parseFloat(r.entrees || 0), 0);
    const totalSorties = rowsFlux.reduce((sum, r) => sum + parseFloat(r.sorties || 0), 0);
    
    // Encaissements exploitation
    const encaissementsExpl = rowsExpl.find(r => r.categorie === 'Encaissements clients');
    const decaissementsExpl = rowsExpl.find(r => r.categorie === 'Décaissements fournisseurs');
    
    // Investissements
    const totalAcquisitions = rowsInv.reduce((sum, r) => sum + parseFloat(r.acquisitions || 0), 0);
    const totalCessions = rowsInv.reduce((sum, r) => sum + parseFloat(r.cessions || 0), 0);

    // Financement
    const totalApports = rowsFin.reduce((sum, r) => sum + parseFloat(r.apports || 0), 0);
    const totalRemboursements = rowsFin.reduce((sum, r) => sum + parseFloat(r.remboursements || 0), 0);
    
    // Infos entreprise
    const entreprise = await db.query.entreprises.findFirst({
      where: eq(entreprises.id, eId)
    });
    
    res.json({
      entreprise: {
        nom: entreprise?.nom,
        logo: entreprise?.logo,
        adresse: entreprise?.adresse,
        telephone: entreprise?.telephone,
        email: entreprise?.email,
        rccm: entreprise?.rccm,
        ifu: entreprise?.ifu
      },
      periode: { dateDebut, dateFin },
      fluxExploitation: {
        encaissements: parseFloat(encaissementsExpl?.encaissements || 0),
        decaissements: parseFloat(decaissementsExpl?.decaissements || 0),
        net: parseFloat(encaissementsExpl?.encaissements || 0) - parseFloat(decaissementsExpl?.decaissements || 0)
      },
      fluxInvestissement: {
        acquisitions: totalAcquisitions,
        cessions: totalCessions,
        net: totalCessions - totalAcquisitions,
        details: rowsInv.map(r => ({
          compte: r.numero,
          nom: r.nom,
          acquisitions: parseFloat(r.acquisitions || 0),
          cessions: parseFloat(r.cessions || 0)
        }))
      },
      fluxFinancement: {
        apports: totalApports,
        remboursements: totalRemboursements,
        net: totalApports - totalRemboursements,
        details: rowsFin.map(r => ({
          compte: r.numero,
          nom: r.nom,
          apports: parseFloat(r.apports || 0),
          remboursements: parseFloat(r.remboursements || 0)
        }))
      },
      fluxTresorerie: {
        comptes: rowsFlux.map(r => ({
          numero: r.numero,
          nom: r.nom,
          entrees: parseFloat(r.entrees || 0),
          sorties: parseFloat(r.sorties || 0),
          solde: parseFloat(r.entrees || 0) - parseFloat(r.sorties || 0)
        })),
        totalEntrees,
        totalSorties,
        variationNette: totalEntrees - totalSorties
      }
    });
  } catch (error) {
    console.error('Erreur flux trésorerie:', error);
    res.status(500).json({ error: error.message });
  }
});

// Journal Général
router.get('/rapports/journal-general', async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const eId = req.entrepriseId || parseInt(req.query.entrepriseId);
    
    // Récupérer toutes les écritures avec leurs lignes
    const ecrituresData = await db.execute(sql`
      SELECT e.id, e.date_ecriture, e.numero_piece, e.libelle, 
             j.code as journal_code, j.nom as journal_nom,
             cc.numero as compte_numero, cc.nom as compte_nom,
             le.libelle as ligne_libelle,
             COALESCE(le.debit, 0) as debit,
             COALESCE(le.credit, 0) as credit
      FROM ecritures e
      JOIN journaux j ON e.journal_id = j.id
      LEFT JOIN lignes_ecriture le ON le.ecriture_id = e.id
      LEFT JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
      WHERE e.entreprise_id = ${eId}
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
      ORDER BY e.date_ecriture, e.id, cc.numero
    `);
    
    const rows = ecrituresData.rows || ecrituresData || [];
    
    // Grouper par écriture
    const ecrituresMap = new Map();
    let totalDebit = 0;
    let totalCredit = 0;
    
    rows.forEach(row => {
      if (!ecrituresMap.has(row.id)) {
        ecrituresMap.set(row.id, {
          id: row.id,
          date: row.date_ecriture,
          reference: row.numero_piece,
          libelle: row.libelle,
          journal: { code: row.journal_code, nom: row.journal_nom },
          lignes: []
        });
      }
      
      if (row.compte_numero) {
        const debit = parseFloat(row.debit || 0);
        const credit = parseFloat(row.credit || 0);
        ecrituresMap.get(row.id).lignes.push({
          compte: row.compte_numero,
          nomCompte: row.compte_nom,
          libelle: row.ligne_libelle || row.libelle,
          debit,
          credit
        });
        totalDebit += debit;
        totalCredit += credit;
      }
    });
    
    // Infos entreprise
    const entreprise = await db.query.entreprises.findFirst({
      where: eq(entreprises.id, eId)
    });
    
    res.json({
      entreprise: {
        nom: entreprise?.nom,
        logo: entreprise?.logo,
        adresse: entreprise?.adresse,
        telephone: entreprise?.telephone,
        email: entreprise?.email,
        rccm: entreprise?.rccm,
        ifu: entreprise?.ifu
      },
      periode: { dateDebut, dateFin },
      ecritures: Array.from(ecrituresMap.values()),
      totaux: {
        nombreEcritures: ecrituresMap.size,
        debit: totalDebit,
        credit: totalCredit,
        equilibre: Math.abs(totalDebit - totalCredit) < 0.01
      }
    });
  } catch (error) {
    console.error('Erreur journal général:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export CSV des comptes
router.get('/export/comptes', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId || parseInt(req.query.entrepriseId);
    if (!entrepriseId || isNaN(entrepriseId)) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }
    const allComptes = await db.query.comptes.findMany({
      where: eq(comptes.entrepriseId, entrepriseId)
    });
    
    const csv = [
      'Numero;Nom;Categorie;Solde;Devise',
      ...allComptes.map(c => `${c.numero};${c.nom};${c.categorie};${c.solde};${c.devise}`)
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=plan_comptable.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CHARTE DES COMPTES - Rapport structuré
// ==========================================

const CLASSES_SYSCOHADA = {
  '1': { nom: 'Comptes de ressources durables', type: 'Bilan' },
  '2': { nom: 'Comptes d\'actif immobilisé', type: 'Bilan' },
  '3': { nom: 'Comptes de stocks', type: 'Bilan' },
  '4': { nom: 'Comptes de tiers', type: 'Bilan' },
  '5': { nom: 'Comptes de trésorerie', type: 'Bilan' },
  '6': { nom: 'Comptes de charges', type: 'Gestion' },
  '7': { nom: 'Comptes de produits', type: 'Gestion' },
  '8': { nom: 'Comptes spéciaux', type: 'Résultat' }
};

router.get('/rapports/charte-comptes', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId || parseInt(req.query.entrepriseId);
    if (!entrepriseId || isNaN(entrepriseId)) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }

    const allComptes = await db.query.comptesComptables.findMany({
      where: eq(comptesComptables.entrepriseId, entrepriseId),
      orderBy: (comptesComptables, { asc }) => [asc(comptesComptables.numero)]
    });

    const comptesSecondaires = await db.query.comptes.findMany({
      where: eq(comptes.entrepriseId, entrepriseId)
    });

    const soldesFromEcritures = await db.select({
      compteComptableId: lignesEcritures.compteComptableId,
      numero: comptesComptables.numero,
      totalDebit: sql`COALESCE(SUM(CAST(${lignesEcritures.debit} AS DECIMAL)), 0)`,
      totalCredit: sql`COALESCE(SUM(CAST(${lignesEcritures.credit} AS DECIMAL)), 0)`
    })
    .from(lignesEcritures)
    .innerJoin(ecritures, eq(lignesEcritures.ecritureId, ecritures.id))
    .innerJoin(comptesComptables, eq(lignesEcritures.compteComptableId, comptesComptables.id))
    .where(eq(ecritures.entrepriseId, entrepriseId))
    .groupBy(lignesEcritures.compteComptableId, comptesComptables.numero);

    const soldesMapByNumero = {};
    for (const s of soldesFromEcritures) {
      if (s.numero) {
        soldesMapByNumero[s.numero] = {
          debit: parseFloat(s.totalDebit || 0),
          credit: parseFloat(s.totalCredit || 0)
        };
      }
    }

    const normalizeCompte = (c) => {
      const ecritureSolde = soldesMapByNumero[c.numero] || { debit: 0, credit: 0 };
      let soldeDebit = ecritureSolde.debit;
      let soldeCredit = ecritureSolde.credit;
      
      if (soldeDebit === 0 && soldeCredit === 0) {
        if (c.solde !== undefined && c.solde !== null) {
          const soldeVal = parseFloat(c.solde || 0);
          if (soldeVal >= 0) {
            soldeDebit = soldeVal;
          } else {
            soldeCredit = Math.abs(soldeVal);
          }
        } else {
          soldeDebit = parseFloat(c.soldeDebiteur || 0);
          soldeCredit = parseFloat(c.soldeCrediteur || 0);
        }
      }
      
      const soldeNet = soldeDebit - soldeCredit;
      return {
        id: c.id,
        numero: c.numero,
        nom: c.nom,
        categorie: c.categorie || c.type || '',
        devise: c.devise || 'XOF',
        solde: soldeNet,
        soldeDebiteur: soldeDebit,
        soldeCrediteur: soldeCredit,
        actif: c.actif !== false
      };
    };

    const allComptesUnified = [];
    const seen = new Set();
    
    for (const c of allComptes) {
      if (!seen.has(c.numero)) {
        allComptesUnified.push(normalizeCompte(c));
        seen.add(c.numero);
      }
    }
    for (const c of comptesSecondaires) {
      if (!seen.has(c.numero)) {
        allComptesUnified.push(normalizeCompte(c));
        seen.add(c.numero);
      }
    }
    allComptesUnified.sort((a, b) => (a.numero || '').localeCompare(b.numero || ''));

    const entreprise = await db.query.entreprises.findFirst({
      where: eq(entreprises.id, entrepriseId)
    });

    const parClasse = {};
    for (const classe of Object.keys(CLASSES_SYSCOHADA)) {
      parClasse[classe] = {
        classe,
        ...CLASSES_SYSCOHADA[classe],
        comptes: [],
        nombreComptes: 0,
        totalSoldeDebiteur: 0,
        totalSoldeCrediteur: 0
      };
    }

    for (const compte of allComptesUnified) {
      const classe = compte.numero ? compte.numero.charAt(0) : null;
      if (classe && parClasse[classe]) {
        parClasse[classe].comptes.push(compte);
        parClasse[classe].nombreComptes++;
        parClasse[classe].totalSoldeDebiteur += compte.soldeDebiteur;
        parClasse[classe].totalSoldeCrediteur += compte.soldeCrediteur;
      }
    }

    res.json({
      entreprise: {
        id: entreprise?.id,
        nom: entreprise?.nom,
        logo: entreprise?.logo
      },
      dateGeneration: new Date().toISOString(),
      systemeComptable: 'SYSCOHADA',
      totalComptes: allComptesUnified.length,
      classes: Object.values(parClasse).filter(c => c.nombreComptes > 0),
      planReference: PLAN_SYSCOHADA
    });
  } catch (error) {
    console.error('Erreur GET /rapports/charte-comptes:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/charte-comptes', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId || parseInt(req.query.entrepriseId);
    if (!entrepriseId || isNaN(entrepriseId)) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }

    const comptesComptablesList = await db.query.comptesComptables.findMany({
      where: eq(comptesComptables.entrepriseId, entrepriseId),
      orderBy: (comptesComptables, { asc }) => [asc(comptesComptables.numero)]
    });

    const comptesSecondaires = await db.query.comptes.findMany({
      where: eq(comptes.entrepriseId, entrepriseId)
    });

    const soldesFromEcritures = await db.select({
      compteComptableId: lignesEcritures.compteComptableId,
      numero: comptesComptables.numero,
      totalDebit: sql`COALESCE(SUM(CAST(${lignesEcritures.debit} AS DECIMAL)), 0)`,
      totalCredit: sql`COALESCE(SUM(CAST(${lignesEcritures.credit} AS DECIMAL)), 0)`
    })
    .from(lignesEcritures)
    .innerJoin(ecritures, eq(lignesEcritures.ecritureId, ecritures.id))
    .innerJoin(comptesComptables, eq(lignesEcritures.compteComptableId, comptesComptables.id))
    .where(eq(ecritures.entrepriseId, entrepriseId))
    .groupBy(lignesEcritures.compteComptableId, comptesComptables.numero);

    const soldesMapByNumero = {};
    for (const s of soldesFromEcritures) {
      if (s.numero) {
        soldesMapByNumero[s.numero] = {
          debit: parseFloat(s.totalDebit || 0),
          credit: parseFloat(s.totalCredit || 0)
        };
      }
    }

    const normalizeCompte = (c) => {
      const ecritureSolde = soldesMapByNumero[c.numero] || { debit: 0, credit: 0 };
      let soldeDebit = ecritureSolde.debit;
      let soldeCredit = ecritureSolde.credit;
      
      if (soldeDebit === 0 && soldeCredit === 0) {
        if (c.solde !== undefined && c.solde !== null) {
          const soldeVal = parseFloat(c.solde || 0);
          if (soldeVal >= 0) {
            soldeDebit = soldeVal;
          } else {
            soldeCredit = Math.abs(soldeVal);
          }
        } else {
          soldeDebit = parseFloat(c.soldeDebiteur || 0);
          soldeCredit = parseFloat(c.soldeCrediteur || 0);
        }
      }
      
      const soldeNet = soldeDebit - soldeCredit;
      return {
        numero: c.numero,
        nom: c.nom,
        categorie: c.categorie || c.type || '',
        devise: c.devise || 'XOF',
        solde: soldeNet,
        soldeDebiteur: soldeDebit,
        soldeCrediteur: soldeCredit,
        actif: c.actif !== false
      };
    };

    const allComptes = [];
    const seen = new Set();
    for (const c of comptesComptablesList) {
      if (!seen.has(c.numero)) {
        allComptes.push(normalizeCompte(c));
        seen.add(c.numero);
      }
    }
    for (const c of comptesSecondaires) {
      if (!seen.has(c.numero)) {
        allComptes.push(normalizeCompte(c));
        seen.add(c.numero);
      }
    }
    allComptes.sort((a, b) => (a.numero || '').localeCompare(b.numero || ''));

    const entreprise = await db.query.entreprises.findFirst({
      where: eq(entreprises.id, entrepriseId)
    });

    const csv = [
      `CHARTE DES COMPTES - ${entreprise?.nom || 'Entreprise'}`,
      `Date de génération: ${new Date().toLocaleDateString('fr-FR')}`,
      `Système comptable: SYSCOHADA`,
      '',
      'Classe;Numéro;Intitulé;Catégorie;Débit;Crédit;Solde;Devise;Statut',
      ...allComptes.map(c => {
        const classe = c.numero ? c.numero.charAt(0) : '';
        return `${classe};${c.numero};${c.nom};${c.categorie || ''};${c.soldeDebiteur};${c.soldeCrediteur};${c.solde};${c.devise};${c.actif ? 'Actif' : 'Inactif'}`;
      })
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=charte_comptes_${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('Erreur export charte-comptes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export CSV des écritures
router.get('/export/ecritures', async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const eId = req.entrepriseId || parseInt(req.query.entrepriseId);
    if (!eId || isNaN(eId)) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }
    
    let query = eq(ecritures.entrepriseId, eId);
    
    const allEcritures = await db.query.ecritures.findMany({
      where: query,
      with: { lignes: true }
    });
    
    const csv = [
      'Date;Journal;Numero;Libelle;Compte;Debit;Credit',
      ...allEcritures.flatMap(e => 
        (e.lignes || []).map(l => 
          `${e.date};${e.journalId};${e.numeroPiece};${e.libelle};${l.compteId};${l.debit};${l.credit}`
        )
      )
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=ecritures.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// DRILL-DOWN: Écritures par compte
// ==========================================

router.get('/compte/:compteId/ecritures', async (req, res) => {
  try {
    const { compteId } = req.params;
    const { dateDebut, dateFin } = req.query;
    const eId = req.entrepriseId || parseInt(req.query.entrepriseId);
    
    if (!eId || isNaN(eId)) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }
    
    // Requête SQL directe pour récupérer les écritures du compte
    const result = await db.execute(sql`
      SELECT 
        le.id,
        e.date_ecriture as date,
        e.libelle,
        e.numero_piece as reference,
        le.debit,
        le.credit
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      WHERE le.compte_comptable_id = ${parseInt(compteId)}
        AND e.entreprise_id = ${eId}
        ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
        ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
      ORDER BY e.date_ecriture
    `);
    
    const rows = result.rows || result || [];
    const ecritures = rows.map(r => ({
      id: r.id,
      date: r.date,
      libelle: r.libelle,
      reference: r.reference,
      debit: parseFloat(r.debit || 0),
      credit: parseFloat(r.credit || 0)
    }));
    
    res.json(ecritures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GESTION DU PLAN COMPTABLE
// ==========================================

router.get('/plans', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const plans = await db.query.plansComptables.findMany({
      where: eq(plansComptables.entrepriseId, parseInt(entrepriseId))
    });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/plans', async (req, res) => {
  try {
    const { entrepriseId, nom, systeme, description } = req.body;
    const plan = await db.insert(plansComptables).values({
      entrepriseId: parseInt(entrepriseId),
      nom,
      systeme, // SYSCOHADA, IFRS, PCG
      description,
      actif: true
    }).returning();
    res.json(plan[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CRUD COMPTES COMPTABLES
// ==========================================

router.post('/comptes', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId;
    const { numero, nom, categorie, sousCategorie, devise } = req.body;
    if (!entrepriseId) return res.status(400).json({ error: 'Entreprise non identifiée' });

    const compte = await db.transaction(async (tx) => {
      const [created] = await tx.insert(comptes).values({
        entrepriseId: Number(entrepriseId),
        numero,
        nom,
        categorie,
        sousCategorie,
        devise: devise || 'XOF',
        solde: 0,
        actif: true
      }).returning();

      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'comptes',
        recordId: created.id,
        nouvelleValeur: created,
        description: `Compte créé: ${numero} - ${nom}`,
        executor: tx,
        required: true
      });
      return created;
    });

    res.json(compte);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/comptes', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId || req.query.entrepriseId;
    if (!entrepriseId) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }
    const accounts = await db.query.comptesComptables.findMany({
      where: eq(comptesComptables.entrepriseId, parseInt(entrepriseId)),
      orderBy: (comptesComptables, { asc }) => [asc(comptesComptables.numero)]
    });
    res.json(accounts);
  } catch (error) {
    console.error('Erreur GET /comptes:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GESTION DES JOURNAUX
// ==========================================

// Journaux standard à créer pour chaque entreprise
const JOURNAUX_STANDARD = [
  { code: 'AC', nom: 'Journal des Achats', type: 'Achats' },
  { code: 'VE', nom: 'Journal des Ventes', type: 'Ventes' },
  { code: 'BQ', nom: 'Journal de Banque', type: 'Banque' },
  { code: 'CA', nom: 'Journal de Caisse', type: 'Caisse' },
  { code: 'OD', nom: 'Journal des Opérations Diverses', type: 'OD' },
  { code: 'AN', nom: 'Journal des À-Nouveaux', type: 'AN' },
];

// Initialiser les journaux standard pour une entreprise (idempotent, case-insensitive)
router.post('/journaux/initialiser', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId || parseInt(req.body.entrepriseId);
    if (!entrepriseId) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }

    // Récupérer les journaux existants
    const existingJournaux = await db.query.journaux.findMany({
      where: eq(journaux.entrepriseId, entrepriseId)
    });
    // Normaliser les codes existants en majuscules pour comparaison case-insensitive
    const existingCodes = new Set(existingJournaux.map(j => j.code.toUpperCase()));

    // Créer uniquement les journaux manquants (idempotent)
    const createdJournaux = [];
    for (const j of JOURNAUX_STANDARD) {
      const normalizedCode = j.code.toUpperCase();
      if (!existingCodes.has(normalizedCode)) {
        const [created] = await db.insert(journaux).values({
          entrepriseId,
          code: normalizedCode,
          nom: j.nom,
          type: j.type,
          actif: true
        }).returning();
        createdJournaux.push(created);
        existingCodes.add(normalizedCode); // Éviter les doublons si appelé en boucle
      }
    }

    // Récupérer tous les journaux après l'initialisation
    const allJournaux = await db.query.journaux.findMany({
      where: eq(journaux.entrepriseId, entrepriseId)
    });

    res.status(createdJournaux.length > 0 ? 201 : 200).json({ 
      message: createdJournaux.length > 0 
        ? `${createdJournaux.length} journaux créés avec succès`
        : 'Journaux déjà complets',
      journaux: allJournaux,
      nouveaux: createdJournaux.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/journaux', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId || parseInt(req.body.entrepriseId);
    const { code, nom, type } = req.body;
    
    if (!entrepriseId) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }
    if (!code || !nom) {
      return res.status(400).json({ error: 'code et nom sont obligatoires' });
    }
    const normalizedCode = String(code).trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,20}$/.test(normalizedCode)) {
      return res.status(400).json({ error: 'Le code doit contenir 1 à 20 lettres, chiffres, tirets ou soulignés.' });
    }
    const [existingJournal] = await db.select({ id: journaux.id }).from(journaux).where(and(
      eq(journaux.entrepriseId, entrepriseId),
      sql`upper(${journaux.code}) = ${normalizedCode}`
    )).limit(1);
    if (existingJournal) {
      return res.status(409).json({ error: `Le code de journal ${normalizedCode} existe déjà pour cette entreprise.` });
    }

    const journal = await db.insert(journaux).values({
      entrepriseId,
      code: normalizedCode,
      nom,
      type: String(type || 'OD').toLowerCase(),
      actif: true
    }).returning();
    res.status(201).json(journal[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/journaux', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId || parseInt(req.query.entrepriseId);
    if (!entrepriseId) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }
    
    const journals = await db.query.journaux.findMany({
      where: eq(journaux.entrepriseId, entrepriseId)
    });
    res.json(journals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CRÉATION D'ÉCRITURES COMPTABLES
// ==========================================

router.post('/ecritures', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId;
    const { journalId, dateEcriture, reference, description, lignes } = req.body;

    if (!entrepriseId) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }
    if (!journalId) {
      return res.status(400).json({ error: 'journalId est obligatoire' });
    }

    // Valider que le journal appartient à l'entreprise
    const [journal] = await db.select().from(journaux).where(and(
      eq(journaux.id, parseInt(journalId)),
      eq(journaux.entrepriseId, entrepriseId)
    )).limit(1);
    if (!journal) {
      return res.status(400).json({ error: 'Journal non trouvé ou n\'appartient pas à l\'entreprise' });
    }

    // Valider l'équilibre des lignes si fournies
    if (lignes && lignes.length > 0) {
      let totalDebit = 0, totalCredit = 0;
      for (const l of lignes) {
        totalDebit += parseFloat(l.debit || 0);
        totalCredit += parseFloat(l.credit || 0);
      }
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return res.status(400).json({ 
          error: 'L\'écriture n\'est pas équilibrée', 
          totalDebit, 
          totalCredit,
          difference: totalDebit - totalCredit
        });
      }
    }

    const ecriture = await db.transaction(async (tx) => {
      const numeroEcriture = await generateNumeroEcriture(
        Number(entrepriseId),
        journal,
        new Date(dateEcriture),
        tx
      );
      const [created] = await tx.insert(ecritures).values({
        entrepriseId: Number(entrepriseId),
        journalId: parseInt(journalId),
        numeroEcriture,
        dateEcriture: new Date(dateEcriture),
        numeroPiece: reference || null,
        libelle: description || null,
        userId: req.user?.id || req.userId || null,
        valide: false
      }).returning();

      const lignesCreees = lignes?.length
        ? await tx.insert(lignesEcritures).values(lignes.map((ligne) => ({
            entrepriseId: Number(entrepriseId),
            ecritureId: created.id,
            compteComptableId: parseInt(ligne.compteComptableId),
            debit: ligne.debit || '0',
            credit: ligne.credit || '0',
            libelle: ligne.libelle || description || null
          }))).returning()
        : [];
      const totalDebit = lignesCreees.reduce((sum, ligne) => sum + Number(ligne.debit || 0), 0);
      const totalCredit = lignesCreees.reduce((sum, ligne) => sum + Number(ligne.credit || 0), 0);

      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'ecritures',
        recordId: created.id,
        nouvelleValeur: {
          ecriture: created,
          lignes: lignesCreees,
          totalDebit,
          totalCredit
        },
        description: `Écriture créée: ${reference || created.numeroPiece || created.id} - Journal: ${journal.code}`,
        executor: tx,
        required: true
      });

      return { ...created, totalDebit, totalCredit };
    });

    res.status(201).json(ecriture);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ecritures', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId || parseInt(req.query.entrepriseId);
    const { journalId, dateDebut, dateFin, valide } = req.query;
    
    if (!entrepriseId) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }

    const conditions = [eq(ecritures.entrepriseId, entrepriseId)];
    if (journalId) conditions.push(eq(ecritures.journalId, parseInt(journalId)));
    if (dateDebut) conditions.push(gte(ecritures.dateEcriture, new Date(dateDebut)));
    if (dateFin) conditions.push(lte(ecritures.dateEcriture, new Date(dateFin)));
    if (valide !== undefined) conditions.push(eq(ecritures.valide, valide === 'true'));

    const entries = await db
      .select({
        id: ecritures.id,
        numeroEcriture: ecritures.numeroEcriture,
        dateEcriture: ecritures.dateEcriture,
        reference: ecritures.numeroPiece,
        description: ecritures.libelle,
        valide: ecritures.valide,
        journalId: ecritures.journalId,
        journalCode: journaux.code,
        journalNom: journaux.nom,
        createdAt: ecritures.createdAt
      })
      .from(ecritures)
      .innerJoin(journaux, eq(ecritures.journalId, journaux.id))
      .where(and(...conditions))
      .orderBy(desc(ecritures.dateEcriture));

    const entriesWithTotals = await Promise.all(entries.map(async (entry) => {
      const lignes = await db.query.lignesEcritures.findMany({
        where: eq(lignesEcritures.ecritureId, entry.id)
      });
      const totalDebit = lignes.reduce((acc, l) => acc + parseFloat(l.debit || 0), 0);
      const totalCredit = lignes.reduce((acc, l) => acc + parseFloat(l.credit || 0), 0);
      return { ...entry, totalDebit, totalCredit };
    }));

    res.json(entriesWithTotals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/controles-integrite', async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        e.id,
        e.numero_ecriture AS "numeroEcriture",
        e.date_ecriture AS "dateEcriture",
        j.code AS "journalCode",
        j.nom AS "journalNom",
        j.type AS "journalType",
        COUNT(le.id)::int AS "nombreLignes",
        COALESCE(SUM(le.debit), 0)::numeric AS "totalDebit",
        COALESCE(SUM(le.credit), 0)::numeric AS "totalCredit"
      FROM ecritures e
      JOIN journaux j ON j.id = e.journal_id AND j.entreprise_id = e.entreprise_id
      LEFT JOIN lignes_ecriture le
        ON le.ecriture_id = e.id
        AND (le.entreprise_id = e.entreprise_id OR le.entreprise_id IS NULL)
      WHERE e.entreprise_id = ${req.entrepriseId}
      GROUP BY e.id, j.code, j.nom, j.type
      ORDER BY e.date_ecriture, e.id
    `);
    const entries = result.rows || result || [];
    const numberCounts = new Map();
    const sequences = new Map();
    const journalSummaries = new Map();
    const issues = { sansNumero: [], nonEquilibrees: [], sansLignes: [], doublons: [], sequencesManquantes: [] };
    let historicalFormatCount = 0;

    const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const entry of entries) {
      const number = String(entry.numeroEcriture || '').trim();
      const journalCode = String(entry.journalCode || '').trim().toUpperCase();
      const journalType = String(entry.journalType || '').toLowerCase();
      const journalKey = `${journalCode}`;
      const summary = journalSummaries.get(journalKey) || {
        code: journalCode,
        nom: entry.journalNom,
        type: journalType,
        nombreEcritures: 0,
        formatHistorique: 0,
        sequencesVerifiees: 0,
        lacunes: 0
      };
      summary.nombreEcritures += 1;
      journalSummaries.set(journalKey, summary);

      if (!number) {
        issues.sansNumero.push({ id: entry.id, date: entry.dateEcriture, journal: journalCode });
      } else {
        numberCounts.set(number, [...(numberCounts.get(number) || []), entry]);
        const width = journalType === 'ventes' ? 8 : 6;
        const canonicalPattern = new RegExp(`^${escapeRegExp(journalCode)}-(20\\d{2})-(\\d{${width}})$`);
        const match = number.match(canonicalPattern);
        if (match) {
          const sequenceKey = `${journalCode}:${match[1]}`;
          const sequence = Number(match[2]);
          sequences.set(sequenceKey, [...(sequences.get(sequenceKey) || []), sequence]);
          summary.sequencesVerifiees += 1;
        } else {
          summary.formatHistorique += 1;
          historicalFormatCount += 1;
        }
      }

      const debit = Number(entry.totalDebit || 0);
      const credit = Number(entry.totalCredit || 0);
      if (Number(entry.nombreLignes || 0) === 0) {
        issues.sansLignes.push({ id: entry.id, number: number || null, journal: journalCode });
      }
      if (Math.abs(debit - credit) > 0.01) {
        issues.nonEquilibrees.push({
          id: entry.id,
          number: number || null,
          journal: journalCode,
          debit,
          credit,
          ecart: debit - credit
        });
      }
    }

    for (const [number, matchingEntries] of numberCounts) {
      if (matchingEntries.length > 1) {
        issues.doublons.push({
          numeroEcriture: number,
          ids: matchingEntries.map((entry) => entry.id),
          journal: matchingEntries.map((entry) => entry.journalCode)
        });
      }
    }

    let totalGaps = 0;
    for (const [key, values] of sequences) {
      const ordered = [...new Set(values)].sort((a, b) => a - b);
      const [journal, year] = key.split(':');
      for (let index = 1; index < ordered.length; index += 1) {
        const missing = ordered[index] - ordered[index - 1] - 1;
        if (missing > 0) {
          totalGaps += missing;
          const summary = journalSummaries.get(journal);
          if (summary) summary.lacunes += missing;
          issues.sequencesManquantes.push({
            journal,
            exercice: Number(year),
            apres: ordered[index - 1],
            avant: ordered[index],
            numerosManquants: missing
          });
        }
      }
    }

    const totals = {
      ecritures: entries.length,
      sansNumero: issues.sansNumero.length,
      doublons: issues.doublons.length,
      nonEquilibrees: issues.nonEquilibrees.length,
      sansLignes: issues.sansLignes.length,
      sequencesManquantes: totalGaps,
      formatsHistoriques: historicalFormatCount
    };
    const conforme = totals.sansNumero === 0
      && totals.doublons === 0
      && totals.nonEquilibrees === 0
      && totals.sansLignes === 0
      && totals.sequencesManquantes === 0;

    return res.json({
      success: true,
      conforme,
      controle: 'Numéros, doublons, équilibre et continuité des séquences récentes',
      verifieLe: new Date().toISOString(),
      totals,
      journaux: [...journalSummaries.values()],
      anomalies: Object.fromEntries(Object.entries(issues).map(([key, values]) => [key, values.slice(0, 100)]))
    });
  } catch (error) {
    console.error('Erreur GET /api/comptabilite/controles-integrite:', error);
    return res.status(500).json({
      success: false,
      message: 'Impossible de vérifier l’intégrité des écritures comptables.'
    });
  }
});

// Valider une écriture (passer de brouillon à validée)
router.post('/ecritures/:id/valider', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId;
    const { id } = req.params;

    if (!entrepriseId) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }

    const validation = await db.transaction(async (tx) => {
      const [ecriture] = await tx.select().from(ecritures).where(and(
        eq(ecritures.id, parseInt(id)),
        eq(ecritures.entrepriseId, Number(entrepriseId))
      )).limit(1);
      if (!ecriture) throw Object.assign(new Error('Écriture non trouvée'), { status: 404 });
      if (ecriture.valide) throw Object.assign(new Error('L\'écriture est déjà validée'), { status: 400 });

      const lignes = await tx.select().from(lignesEcritures).where(and(
        eq(lignesEcritures.ecritureId, parseInt(id)),
        eq(lignesEcritures.entrepriseId, Number(entrepriseId))
      ));
      const totalDebit = lignes.reduce((sum, ligne) => sum + Number(ligne.debit || 0), 0);
      const totalCredit = lignes.reduce((sum, ligne) => sum + Number(ligne.credit || 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw Object.assign(new Error('L\'écriture n\'est pas équilibrée et ne peut pas être validée'), {
          status: 400,
          totalDebit,
          totalCredit,
          difference: totalDebit - totalCredit
        });
      }

      const [journal] = await tx.select().from(journaux).where(and(
        eq(journaux.id, ecriture.journalId),
        eq(journaux.entrepriseId, Number(entrepriseId))
      )).limit(1);
      if (!journal) throw Object.assign(new Error('Journal de l’écriture introuvable'), { status: 400 });
      const numeroEcriture = ecriture.numeroEcriture || await generateNumeroEcriture(
        Number(entrepriseId),
        journal,
        ecriture.dateEcriture,
        tx
      );
      const [updated] = await tx.update(ecritures).set({
        valide: true,
        numeroEcriture,
        updatedAt: new Date()
      }).where(and(
        eq(ecritures.id, parseInt(id)),
        eq(ecritures.entrepriseId, Number(entrepriseId))
      )).returning();

      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'ecritures',
        recordId: parseInt(id),
        ancienneValeur: { ecriture, lignes },
        nouvelleValeur: { ecriture: updated, lignes, totalDebit, totalCredit },
        description: `Écriture validée: ${numeroEcriture}`,
        executor: tx,
        required: true
      });
      const treasurySync = await synchroniserTransactionDepuisEcriture({
        entrepriseId: Number(entrepriseId),
        ecritureId: updated.id,
        auditInfo: extractAuditInfo(req),
        executor: tx,
      });
      return { ecriture: updated, totalDebit, totalCredit, treasurySync };
    });

    res.json({ 
      message: 'Écriture validée avec succès',
      ecriture: validation.ecriture,
      totalDebit: validation.totalDebit,
      totalCredit: validation.totalCredit,
      treasurySync: validation.treasurySync,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message,
      totalDebit: error.totalDebit,
      totalCredit: error.totalCredit,
      difference: error.difference
    });
  }
});

// ==========================================
// LIGNES D'ÉCRITURES (DÉBIT/CRÉDIT)
// ==========================================

router.post('/lignes', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId;
    const { ecritureId, compteComptableId, debit, credit, libelle } = req.body;

    if (!entrepriseId) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }
    if (!ecritureId || !compteComptableId) {
      return res.status(400).json({ error: 'ecritureId et compteComptableId sont obligatoires' });
    }

    // Validation : debit et credit doivent être non-négatifs
    const debitVal = parseFloat(debit || 0);
    const creditVal = parseFloat(credit || 0);
    if (debitVal < 0 || creditVal < 0) {
      return res.status(400).json({ error: 'Les montants débit et crédit doivent être positifs' });
    }
    // Une ligne doit avoir soit débit soit crédit (pas les deux ou aucun)
    if ((debitVal === 0 && creditVal === 0) || (debitVal > 0 && creditVal > 0)) {
      return res.status(400).json({ error: 'Une ligne doit avoir soit un débit soit un crédit (pas les deux)' });
    }

    const result = await db.transaction(async (tx) => {
      const [ecriture] = await tx.select().from(ecritures).where(and(
        eq(ecritures.id, parseInt(ecritureId)),
        eq(ecritures.entrepriseId, Number(entrepriseId))
      )).limit(1);
      if (!ecriture) throw Object.assign(new Error('Écriture non trouvée'), { status: 404 });
      if (ecriture.valide) {
        throw Object.assign(new Error('Impossible d\'ajouter une ligne à une écriture validée'), { status: 400 });
      }

      const [compte] = await tx.select().from(comptesComptables).where(and(
        eq(comptesComptables.id, parseInt(compteComptableId)),
        eq(comptesComptables.entrepriseId, Number(entrepriseId))
      )).limit(1);
      if (!compte) throw Object.assign(new Error('Compte comptable non trouvé'), { status: 400 });

      const [ligne] = await tx.insert(lignesEcritures).values({
        entrepriseId: Number(entrepriseId),
        ecritureId: parseInt(ecritureId),
        compteComptableId: parseInt(compteComptableId),
        debit: debit || '0',
        credit: credit || '0',
        libelle: libelle || ''
      }).returning();

      const allLignes = await tx.select().from(lignesEcritures).where(and(
        eq(lignesEcritures.ecritureId, parseInt(ecritureId)),
        eq(lignesEcritures.entrepriseId, Number(entrepriseId))
      ));
      const totalDebit = allLignes.reduce((sum, line) => sum + Number(line.debit || 0), 0);
      const totalCredit = allLignes.reduce((sum, line) => sum + Number(line.credit || 0), 0);
      await tx.update(ecritures).set({ updatedAt: new Date() }).where(and(
        eq(ecritures.id, parseInt(ecritureId)),
        eq(ecritures.entrepriseId, Number(entrepriseId))
      ));

      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'lignes_ecriture',
        recordId: ligne.id,
        nouvelleValeur: { ligne, ecritureId: parseInt(ecritureId), totalDebit, totalCredit },
        description: `Ligne ajoutée à l’écriture ${ecriture.numeroPiece || ecriture.numeroEcriture || ecriture.id}`,
        executor: tx,
        required: true
      });

      const equilibre = Math.abs(totalDebit - totalCredit) < 0.01;
      return { ligne, totalDebit, totalCredit, equilibre };
    });
    res.status(201).json({
      ...result.ligne,
      debit: Number(result.ligne.debit || 0),
      credit: Number(result.ligne.credit || 0),
      ecritureTotaux: {
        totalDebit: result.totalDebit,
        totalCredit: result.totalCredit,
        equilibre: result.equilibre,
        message: result.equilibre ? 'Écriture équilibrée' : `Écart de ${Math.abs(result.totalDebit - result.totalCredit).toFixed(2)}`
      }
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/lignes/:ecritureId', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId || parseInt(req.query.entrepriseId);
    const { ecritureId } = req.params;

    if (!entrepriseId) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }

    // Vérifier que l'écriture appartient à l'entreprise
    const ecriture = await db.query.ecritures.findFirst({
      where: and(
        eq(ecritures.id, parseInt(ecritureId)),
        eq(ecritures.entrepriseId, entrepriseId)
      )
    });
    if (!ecriture) {
      return res.status(404).json({ error: 'Écriture non trouvée' });
    }

    const lines = await db
      .select({
        id: lignesEcritures.id,
        compteComptableId: lignesEcritures.compteComptableId,
        compteNumero: comptesComptables.numero,
        compteNom: comptesComptables.nom,
        debit: lignesEcritures.debit,
        credit: lignesEcritures.credit,
        libelle: lignesEcritures.libelle
      })
      .from(lignesEcritures)
      .innerJoin(comptesComptables, eq(lignesEcritures.compteComptableId, comptesComptables.id))
      .where(eq(lignesEcritures.ecritureId, parseInt(ecritureId)));

    res.json(lines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// VALIDATION & MODIFICATION
// ==========================================

router.put('/ecritures/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { dateEcriture, reference, description } = req.body;
    const entrepriseId = req.entrepriseId;
    if (!entrepriseId) return res.status(400).json({ error: 'Entreprise non identifiée' });

    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(ecritures).where(and(
        eq(ecritures.id, parseInt(id)),
        eq(ecritures.entrepriseId, Number(entrepriseId))
      )).limit(1);
      if (!existing) throw Object.assign(new Error('Écriture non trouvée'), { status: 404 });

      const [result] = await tx.update(ecritures).set({
        dateEcriture: dateEcriture ? new Date(dateEcriture) : undefined,
        numeroPiece: reference,
        libelle: description,
        updatedAt: new Date()
      }).where(and(
        eq(ecritures.id, parseInt(id)),
        eq(ecritures.entrepriseId, Number(entrepriseId))
      )).returning();

      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'ecritures',
        recordId: parseInt(id),
        ancienneValeur: existing,
        nouvelleValeur: result,
        description: `Écriture modifiée: ${result.numeroPiece || result.numeroEcriture || id}`,
        executor: tx,
        required: true
      });
      return result;
    });

    res.json(updated);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.delete('/ecritures/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const entrepriseId = req.entrepriseId;
    if (!entrepriseId) return res.status(400).json({ error: 'Entreprise non identifiée' });

    await db.transaction(async (tx) => {
      const [ecriture] = await tx.select().from(ecritures).where(and(
        eq(ecritures.id, parseInt(id)),
        eq(ecritures.entrepriseId, Number(entrepriseId))
      )).limit(1);
      if (!ecriture) throw Object.assign(new Error('Écriture non trouvée'), { status: 404 });

      const lignes = await tx.select().from(lignesEcritures)
        .where(eq(lignesEcritures.ecritureId, parseInt(id)));
      await logAudit({
        ...extractAuditInfo(req),
        action: 'DELETE',
        table: 'ecritures',
        recordId: parseInt(id),
        ancienneValeur: { ecriture, lignes },
        description: `Écriture supprimée: ${ecriture.numeroPiece || ecriture.numeroEcriture || id}`,
        executor: tx,
        required: true
      });

      await tx.delete(lignesEcritures).where(eq(lignesEcritures.ecritureId, parseInt(id)));
      await tx.delete(ecritures).where(and(
        eq(ecritures.id, parseInt(id)),
        eq(ecritures.entrepriseId, Number(entrepriseId))
      ));
    });
    res.json({ message: 'Écriture supprimée' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ==========================================
// GRAND LIVRE
// ==========================================

router.get('/grand-livre', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId || parseInt(req.query.entrepriseId);
    const { compteId, dateDebut, dateFin } = req.query;

    if (!entrepriseId) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }

    const conditions = [
      eq(lignesEcritures.entrepriseId, entrepriseId),
      eq(ecritures.valide, true)
    ];
    if (compteId) conditions.push(eq(lignesEcritures.compteComptableId, parseInt(compteId)));
    if (dateDebut) conditions.push(gte(ecritures.dateEcriture, new Date(dateDebut)));
    if (dateFin) conditions.push(lte(ecritures.dateEcriture, new Date(dateFin)));

    const lignes = await db
      .select({
        id: lignesEcritures.id,
        compteComptableId: lignesEcritures.compteComptableId,
        compteNumero: comptesComptables.numero,
        compteNom: comptesComptables.nom,
        debit: lignesEcritures.debit,
        credit: lignesEcritures.credit,
        libelle: lignesEcritures.libelle,
        dateEcriture: ecritures.dateEcriture,
        reference: ecritures.numeroPiece,
        journalCode: journaux.code,
        journalNom: journaux.nom
      })
      .from(lignesEcritures)
      .innerJoin(ecritures, eq(lignesEcritures.ecritureId, ecritures.id))
      .innerJoin(comptesComptables, eq(lignesEcritures.compteComptableId, comptesComptables.id))
      .innerJoin(journaux, eq(ecritures.journalId, journaux.id))
      .where(and(...conditions))
      .orderBy(ecritures.dateEcriture, comptesComptables.numero);

    // Grouper par compte pour le grand livre
    const grandLivre = {};
    lignes.forEach(ligne => {
      const key = ligne.compteComptableId;
      if (!grandLivre[key]) {
        grandLivre[key] = {
          compteId: key,
          numero: ligne.compteNumero,
          nom: ligne.compteNom,
          lignes: [],
          totalDebit: 0,
          totalCredit: 0,
          solde: 0
        };
      }
      grandLivre[key].lignes.push({
        id: ligne.id,
        date: ligne.dateEcriture,
        journal: ligne.journalCode,
        reference: ligne.reference,
        libelle: ligne.libelle,
        debit: parseFloat(ligne.debit || 0),
        credit: parseFloat(ligne.credit || 0)
      });
      grandLivre[key].totalDebit += parseFloat(ligne.debit || 0);
      grandLivre[key].totalCredit += parseFloat(ligne.credit || 0);
    });

    // Calculer les soldes
    Object.values(grandLivre).forEach(compte => {
      compte.solde = compte.totalDebit - compte.totalCredit;
    });

    // Trier par numéro de compte
    const result = Object.values(grandLivre).sort((a, b) => a.numero.localeCompare(b.numero));

    res.json({
      comptes: result,
      totaux: {
        totalDebit: result.reduce((acc, c) => acc + c.totalDebit, 0),
        totalCredit: result.reduce((acc, c) => acc + c.totalCredit, 0)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// BALANCE GÉNÉRALE
// ==========================================

router.get('/balance', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId || parseInt(req.query.entrepriseId);
    const { dateDebut, dateFin } = req.query;
    
    if (!entrepriseId) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }
    if (
      (dateDebut && !isISODate(dateDebut)) ||
      (dateFin && !isISODate(dateFin)) ||
      (dateDebut && dateFin && dateDebut > dateFin)
    ) {
      return res.status(400).json({ error: 'Période invalide' });
    }

    // Récupérer les lignes d'écriture avec les comptes comptables
    const lignesData = await db
      .select({
        compteId: lignesEcritures.compteComptableId,
        debit: lignesEcritures.debit,
        credit: lignesEcritures.credit,
        compteNumero: comptesComptables.numero,
        compteNom: comptesComptables.nom,
        compteType: comptesComptables.type
      })
      .from(lignesEcritures)
      .innerJoin(ecritures, eq(lignesEcritures.ecritureId, ecritures.id))
      .innerJoin(comptesComptables, eq(lignesEcritures.compteComptableId, comptesComptables.id))
      .where(and(
        eq(lignesEcritures.entrepriseId, entrepriseId),
        eq(ecritures.valide, true),
        ...(dateDebut ? [gte(ecritures.dateEcriture, new Date(dateDebut))] : []),
        ...(dateFin ? [lte(ecritures.dateEcriture, new Date(dateFin))] : [])
      ));

    // Agréger par compte
    const balance = {};
    lignesData.forEach(ligne => {
      const key = ligne.compteId;
      if (!balance[key]) {
        balance[key] = { 
          compteId: key,
          numero: ligne.compteNumero,
          nom: ligne.compteNom,
          type: ligne.compteType,
          debit: 0, 
          credit: 0,
          solde: 0
        };
      }
      balance[key].debit += parseFloat(ligne.debit || 0);
      balance[key].credit += parseFloat(ligne.credit || 0);
    });

    // Calculer les soldes et trier par numéro de compte
    const balanceArray = Object.values(balance).map(compte => ({
      ...compte,
      solde: compte.debit - compte.credit
    })).sort((a, b) => a.numero.localeCompare(b.numero));

    // Totaux
    const totaux = balanceArray.reduce((acc, c) => ({
      totalDebit: acc.totalDebit + c.debit,
      totalCredit: acc.totalCredit + c.credit
    }), { totalDebit: 0, totalCredit: 0 });

    res.json({ 
      comptes: balanceArray, 
      totaux,
      equilibre: Math.abs(totaux.totalDebit - totaux.totalCredit) < 0.01
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Drill-down des mouvements d'un compte par numéro (pour TVA et comptes créditeurs)
router.get('/compte-mouvements/:numeroCompte', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId;
    if (!entrepriseId) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    
    const { numeroCompte } = req.params;
    const { dateDebut, dateFin, page = 1, limit = 100 } = req.query;
    
    // Trouver le compte par son numéro
    const compte = await db.query.comptesComptables.findFirst({
      where: and(
        eq(comptesComptables.entrepriseId, entrepriseId),
        eq(comptesComptables.numero, numeroCompte)
      )
    });
    
    if (!compte) {
      return res.status(404).json({ error: 'Compte non trouvé' });
    }
    
    // Construire les conditions de filtre
    const conditions = [
      eq(lignesEcritures.entrepriseId, entrepriseId),
      eq(lignesEcritures.compteComptableId, compte.id)
    ];
    
    if (dateDebut) {
      conditions.push(gte(ecritures.dateEcriture, new Date(dateDebut)));
    }
    if (dateFin) {
      conditions.push(lte(ecritures.dateEcriture, new Date(dateFin)));
    }
    
    // Récupérer les mouvements avec jointures via SQL brut
    const mouvementsRaw = await db.execute(sql`
      SELECT 
        le.id,
        e.date_ecriture as date,
        COALESCE(j.code, '') as journal_code,
        COALESCE(e.numero_piece, '') as reference,
        COALESCE(e.libelle, '') as libelle,
        COALESCE(le.debit, 0) as debit,
        COALESCE(le.credit, 0) as credit
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      LEFT JOIN journaux j ON e.journal_id = j.id
      WHERE le.compte_comptable_id = ${compte.id}
        AND e.entreprise_id = ${entrepriseId}
        ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
        ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
      ORDER BY e.date_ecriture, e.id
    `);
    
    const mouvements = mouvementsRaw.rows || mouvementsRaw || [];
    
    // Calculer le solde cumulé
    let soldeCumule = 0;
    const mouvementsAvecSolde = mouvements.map(m => {
      const debit = parseFloat(m.debit || 0);
      const credit = parseFloat(m.credit || 0);
      soldeCumule += debit - credit;
      return {
        id: m.id,
        date: m.date ? new Date(m.date).toLocaleDateString('fr-FR') : '',
        journal: m.journal_code || '',
        reference: m.reference || '',
        libelle: m.libelle || '',
        debit: debit,
        credit: credit,
        soldeCumule: soldeCumule
      };
    });
    
    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const paginatedData = mouvementsAvecSolde.slice(offset, offset + parseInt(limit));
    
    // Totaux
    const totaux = {
      totalDebit: mouvementsAvecSolde.reduce((s, m) => s + m.debit, 0),
      totalCredit: mouvementsAvecSolde.reduce((s, m) => s + m.credit, 0),
      solde: soldeCumule
    };
    
    res.json({
      compte: {
        numero: compte.numero,
        nom: compte.nom,
        type: compte.type
      },
      mouvements: paginatedData,
      totaux,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: mouvementsAvecSolde.length,
        totalPages: Math.ceil(mouvementsAvecSolde.length / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Erreur drill-down compte:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RAPPORTS FINANCIERS
// ==========================================

// Bilan Comptable
router.get('/bilan', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId || parseInt(req.query.entrepriseId);
    const { dateDebut, dateFin } = req.query;
    
    if (!entrepriseId) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }

    // Récupérer tous les comptes comptables
    const comptesData = await db.query.comptesComptables.findMany({
      where: eq(comptesComptables.entrepriseId, entrepriseId)
    });

    // Calculer les soldes basés sur les écritures validées
    const conditions = [eq(lignesEcritures.entrepriseId, entrepriseId)];
    if (dateDebut) conditions.push(gte(ecritures.dateEcriture, new Date(dateDebut)));
    if (dateFin) conditions.push(lte(ecritures.dateEcriture, new Date(dateFin)));

    const lignes = await db
      .select({
        compteId: lignesEcritures.compteComptableId,
        debit: lignesEcritures.debit,
        credit: lignesEcritures.credit
      })
      .from(lignesEcritures)
      .innerJoin(ecritures, eq(lignesEcritures.ecritureId, ecritures.id))
      .where(and(...conditions));

    // Calculer les soldes par compte (débit - crédit)
    const soldesMap = {};
    lignes.forEach(ligne => {
      if (!soldesMap[ligne.compteId]) {
        soldesMap[ligne.compteId] = 0;
      }
      soldesMap[ligne.compteId] += parseFloat(ligne.debit || 0) - parseFloat(ligne.credit || 0);
    });

    // Classifier les comptes selon SYSCOHADA
    const bilan = {
      actif: {
        immobilisations: [],
        stocksCreances: [],
        tresorerie: [],
        total: 0
      },
      passif: {
        capitauxPropres: [],
        dettes: [],
        total: 0
      }
    };

    comptesData.forEach(compte => {
      const solde = soldesMap[compte.id] || 0;
      if (solde === 0) return;
      
      const item = { compte: compte.numero, nom: compte.nom, montant: Math.abs(solde) };

      // Classes SYSCOHADA: 1=Capitaux, 2=Immob, 3=Stocks, 4=Tiers, 5=Trésorerie, 6=Charges, 7=Produits
      const classe = compte.numero.charAt(0);
      
      if (['2'].includes(classe)) {
        bilan.actif.immobilisations.push(item);
        bilan.actif.total += Math.abs(solde);
      } else if (['3'].includes(classe)) {
        bilan.actif.stocksCreances.push(item);
        bilan.actif.total += Math.abs(solde);
      } else if (['4'].includes(classe) && solde > 0) {
        bilan.actif.stocksCreances.push(item);
        bilan.actif.total += solde;
      } else if (['4'].includes(classe) && solde < 0) {
        bilan.passif.dettes.push(item);
        bilan.passif.total += Math.abs(solde);
      } else if (['5'].includes(classe)) {
        bilan.actif.tresorerie.push(item);
        bilan.actif.total += Math.abs(solde);
      } else if (['1'].includes(classe)) {
        bilan.passif.capitauxPropres.push(item);
        bilan.passif.total += Math.abs(solde);
      }
    });

    res.json(bilan);
  } catch (error) {
    console.error('Erreur bilan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Compte de Résultat
router.get('/compte-resultat', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId || parseInt(req.query.entrepriseId);
    const { dateDebut, dateFin } = req.query;

    if (!entrepriseId) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }

    // Récupérer tous les comptes comptables
    const comptesData = await db.query.comptesComptables.findMany({
      where: eq(comptesComptables.entrepriseId, entrepriseId)
    });

    // Construire les conditions de filtrage
    const conditions = [eq(lignesEcritures.entrepriseId, entrepriseId)];
    if (dateDebut) conditions.push(gte(ecritures.dateEcriture, new Date(dateDebut)));
    if (dateFin) conditions.push(lte(ecritures.dateEcriture, new Date(dateFin)));

    const lignes = await db
      .select({
        compteId: lignesEcritures.compteComptableId,
        debit: lignesEcritures.debit,
        credit: lignesEcritures.credit
      })
      .from(lignesEcritures)
      .innerJoin(ecritures, eq(lignesEcritures.ecritureId, ecritures.id))
      .where(and(...conditions));

    // Calculer les soldes par compte
    const soldesMap = {};
    lignes.forEach(ligne => {
      if (!soldesMap[ligne.compteId]) {
        soldesMap[ligne.compteId] = 0;
      }
      // Pour les produits (classe 7): crédit - débit = solde positif
      // Pour les charges (classe 6): débit - crédit = solde positif
      soldesMap[ligne.compteId] += parseFloat(ligne.credit || 0) - parseFloat(ligne.debit || 0);
    });

    const resultat = {
      produits: {
        ventesMarchandises: [],
        prestationsServices: [],
        autresProduits: [],
        total: 0
      },
      charges: {
        achats: [],
        services: [],
        personnel: [],
        autresCharges: [],
        total: 0
      },
      resultatNet: 0
    };

    comptesData.forEach(compte => {
      const solde = soldesMap[compte.id] || 0;
      if (solde === 0) return;
      
      const classe = compte.numero.charAt(0);
      const item = { compte: compte.numero, nom: compte.nom, montant: Math.abs(solde) };

      // Classe 7 = Produits (solde créditeur)
      if (classe === '7') {
        if (compte.numero.startsWith('70')) resultat.produits.ventesMarchandises.push(item);
        else if (compte.numero.startsWith('71') || compte.numero.startsWith('72')) resultat.produits.prestationsServices.push(item);
        else resultat.produits.autresProduits.push(item);
        resultat.produits.total += Math.abs(solde);
      }
      // Classe 6 = Charges (solde débiteur)
      else if (classe === '6') {
        if (compte.numero.startsWith('60')) resultat.charges.achats.push(item);
        else if (compte.numero.startsWith('61') || compte.numero.startsWith('62')) resultat.charges.services.push(item);
        else if (compte.numero.startsWith('63') || compte.numero.startsWith('64')) resultat.charges.personnel.push(item);
        else resultat.charges.autresCharges.push(item);
        resultat.charges.total += Math.abs(solde);
      }
    });

    resultat.resultatNet = resultat.produits.total - resultat.charges.total;

    res.json(resultat);
  } catch (error) {
    console.error('Erreur compte-resultat:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rapport des Journaux
router.get('/rapport-journaux', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId || parseInt(req.query.entrepriseId);
    const { dateDebut, dateFin } = req.query;

    if (!entrepriseId) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }

    // Récupérer les journaux
    const journauxData = await db.query.journaux.findMany({
      where: eq(journaux.entrepriseId, entrepriseId)
    });

    // Récupérer les écritures avec leurs lignes
    const conditions = [eq(ecritures.entrepriseId, entrepriseId)];
    if (dateDebut) conditions.push(gte(ecritures.dateEcriture, new Date(dateDebut)));
    if (dateFin) conditions.push(lte(ecritures.dateEcriture, new Date(dateFin)));

    const ecrituresData = await db
      .select({
        id: ecritures.id,
        journalId: ecritures.journalId,
        numeroEcriture: ecritures.numeroEcriture,
        dateEcriture: ecritures.dateEcriture,
        libelle: ecritures.libelle,
        numeroPiece: ecritures.numeroPiece,
        valide: ecritures.valide
      })
      .from(ecritures)
      .where(and(...conditions));

    // Récupérer les totaux des lignes par écriture
    const lignesData = await db
      .select({
        ecritureId: lignesEcritures.ecritureId,
        debit: lignesEcritures.debit,
        credit: lignesEcritures.credit
      })
      .from(lignesEcritures)
      .where(eq(lignesEcritures.entrepriseId, entrepriseId));

    // Calculer les totaux par écriture
    const totauxParEcriture = {};
    lignesData.forEach(l => {
      if (!totauxParEcriture[l.ecritureId]) {
        totauxParEcriture[l.ecritureId] = { debit: 0, credit: 0 };
      }
      totauxParEcriture[l.ecritureId].debit += parseFloat(l.debit || 0);
      totauxParEcriture[l.ecritureId].credit += parseFloat(l.credit || 0);
    });

    // Construire le rapport par journal
    const rapportParJournal = {};
    journauxData.forEach(journal => {
      rapportParJournal[journal.id] = {
        code: journal.code,
        nom: journal.nom,
        ecritures: [],
        totalDebit: 0,
        totalCredit: 0,
        nombreEcritures: 0
      };
    });

    ecrituresData.forEach(ecriture => {
      if (rapportParJournal[ecriture.journalId]) {
        const totaux = totauxParEcriture[ecriture.id] || { debit: 0, credit: 0 };
        rapportParJournal[ecriture.journalId].ecritures.push({
          ...ecriture,
          totalDebit: totaux.debit,
          totalCredit: totaux.credit
        });
        rapportParJournal[ecriture.journalId].totalDebit += totaux.debit;
        rapportParJournal[ecriture.journalId].totalCredit += totaux.credit;
        rapportParJournal[ecriture.journalId].nombreEcritures++;
      }
    });

    const totalDebit = Object.values(rapportParJournal).reduce((s, j) => s + j.totalDebit, 0);
    const totalCredit = Object.values(rapportParJournal).reduce((s, j) => s + j.totalCredit, 0);

    res.json({
      journaux: Object.values(rapportParJournal),
      totaux: {
        debit: totalDebit,
        credit: totalCredit,
        nombreEcritures: ecrituresData.length
      }
    });
  } catch (error) {
    console.error('Erreur rapport-journaux:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CLÔTURE D'EXERCICE
// ==========================================

// Prévisualisation de la clôture (sans exécution)
router.get('/cloture-exercice/preview', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId;
    const { annee } = req.query;

    if (!entrepriseId) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    if (!annee) {
      return res.status(400).json({ error: 'Année requise' });
    }

    const dateDebut = `${annee}-01-01`;
    const dateFin = `${annee}-12-31`;

    // Récupérer tous les comptes
    const comptesData = await db.query.comptesComptables.findMany({
      where: eq(comptesComptables.entrepriseId, entrepriseId)
    });

    // Récupérer les lignes d'écritures de l'exercice
    const conditions = [
      eq(ecritures.entrepriseId, entrepriseId),
      gte(ecritures.dateEcriture, new Date(dateDebut)),
      lte(ecritures.dateEcriture, new Date(dateFin))
    ];

    const ecrituresData = await db
      .select({ id: ecritures.id })
      .from(ecritures)
      .where(and(...conditions));

    const ecritureIds = ecrituresData.map(e => e.id);

    // Calculer les soldes par compte
    const soldesMap = {};
    if (ecritureIds.length > 0) {
      const lignesData = await db
        .select({
          compteComptableId: lignesEcritures.compteComptableId,
          debit: lignesEcritures.debit,
          credit: lignesEcritures.credit
        })
        .from(lignesEcritures)
        .where(eq(lignesEcritures.entrepriseId, entrepriseId));

      // Filtrer les lignes qui correspondent aux écritures de l'exercice
      const ecritureIdsSet = new Set(ecritureIds);
      const lignesExercice = await db
        .select({
          compteComptableId: lignesEcritures.compteComptableId,
          debit: lignesEcritures.debit,
          credit: lignesEcritures.credit,
          ecritureId: lignesEcritures.ecritureId
        })
        .from(lignesEcritures)
        .where(eq(lignesEcritures.entrepriseId, entrepriseId));

      lignesExercice.forEach(l => {
        if (ecritureIdsSet.has(l.ecritureId)) {
          const compteId = l.compteComptableId;
          if (!soldesMap[compteId]) soldesMap[compteId] = 0;
          soldesMap[compteId] += parseFloat(l.debit || 0) - parseFloat(l.credit || 0);
        }
      });
    }

    // Séparer comptes de résultat et comptes de bilan
    const comptesResultat = { charges: [], produits: [] };
    const comptesBilan = [];
    let totalCharges = 0;
    let totalProduits = 0;

    comptesData.forEach(compte => {
      const solde = soldesMap[compte.id] || 0;
      if (solde === 0) return;

      const classe = compte.numero.charAt(0);

      if (classe === '6') {
        // Charges (solde débiteur)
        comptesResultat.charges.push({
          numero: compte.numero,
          nom: compte.nom,
          solde: Math.abs(solde)
        });
        totalCharges += Math.abs(solde);
      } else if (classe === '7') {
        // Produits (solde créditeur)
        comptesResultat.produits.push({
          numero: compte.numero,
          nom: compte.nom,
          solde: Math.abs(solde)
        });
        totalProduits += Math.abs(solde);
      } else if (['1', '2', '3', '4', '5'].includes(classe)) {
        // Comptes de bilan
        comptesBilan.push({
          numero: compte.numero,
          nom: compte.nom,
          solde: solde
        });
      }
    });

    const resultatNet = totalProduits - totalCharges;

    res.json({
      annee: parseInt(annee),
      comptesResultat: {
        charges: comptesResultat.charges.sort((a, b) => a.numero.localeCompare(b.numero)),
        produits: comptesResultat.produits.sort((a, b) => a.numero.localeCompare(b.numero)),
        totalCharges,
        totalProduits
      },
      resultatNet,
      typeResultat: resultatNet >= 0 ? 'benefice' : 'perte',
      compteResultat: resultatNet >= 0 ? '120' : '129',
      comptesBilan: comptesBilan.sort((a, b) => a.numero.localeCompare(b.numero)),
      message: resultatNet >= 0 
        ? `Bénéfice de ${resultatNet.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF à reporter sur le compte 120`
        : `Perte de ${Math.abs(resultatNet).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF à reporter sur le compte 129`
    });
  } catch (error) {
    console.error('Erreur preview clôture:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exécution de la clôture d'exercice
router.post('/cloture-exercice', async (req, res) => {
  try {
    const entrepriseId = req.entrepriseId;
    const { annee } = req.body;

    if (!entrepriseId) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    if (!annee) {
      return res.status(400).json({ error: 'Année requise' });
    }

    const dateDebut = `${annee}-01-01`;
    const dateFin = `${annee}-12-31`;
    const dateClotureStr = `${annee}-12-31`;
    const dateOuvertureStr = `${parseInt(annee) + 1}-01-01`;

    // Récupérer tous les comptes
    const comptesData = await db.query.comptesComptables.findMany({
      where: eq(comptesComptables.entrepriseId, entrepriseId)
    });

    const comptesMap = {};
    comptesData.forEach(c => {
      comptesMap[c.numero] = c;
    });

    // Récupérer les écritures de l'exercice
    const ecrituresData = await db
      .select({ id: ecritures.id })
      .from(ecritures)
      .where(and(
        eq(ecritures.entrepriseId, entrepriseId),
        gte(ecritures.dateEcriture, new Date(dateDebut)),
        lte(ecritures.dateEcriture, new Date(dateFin))
      ));

    const ecritureIds = ecrituresData.map(e => e.id);
    const ecritureIdsSet = new Set(ecritureIds);

    // Calculer les soldes par compte
    const soldesMap = {};
    const lignesExercice = await db
      .select({
        compteComptableId: lignesEcritures.compteComptableId,
        debit: lignesEcritures.debit,
        credit: lignesEcritures.credit,
        ecritureId: lignesEcritures.ecritureId
      })
      .from(lignesEcritures)
      .where(eq(lignesEcritures.entrepriseId, entrepriseId));

    lignesExercice.forEach(l => {
      if (ecritureIdsSet.has(l.ecritureId)) {
        const compteId = l.compteComptableId;
        if (!soldesMap[compteId]) soldesMap[compteId] = 0;
        soldesMap[compteId] += parseFloat(l.debit || 0) - parseFloat(l.credit || 0);
      }
    });

    // Séparer les comptes - Conserver le signe réel du solde
    // Solde = Débit - Crédit
    // Charges (classe 6): normalement solde positif (débiteur)
    // Produits (classe 7): normalement solde négatif (créditeur)
    let totalCharges = 0;
    let totalProduits = 0;
    const comptesResultat = []; // Tous les comptes de résultat avec leur solde réel
    const comptesBilan = [];

    comptesData.forEach(compte => {
      const solde = soldesMap[compte.id] || 0;
      if (solde === 0) return;

      const classe = compte.numero.charAt(0);

      if (classe === '6' || classe === '7') {
        // Comptes de résultat - conserver le signe réel
        comptesResultat.push({ compte, solde });
        if (classe === '6') {
          // Charges: solde positif = débit, donc on ajoute à totalCharges
          totalCharges += solde > 0 ? solde : 0;
          totalProduits += solde < 0 ? Math.abs(solde) : 0; // Charge créditeur exceptionnel = produit
        } else {
          // Produits: solde négatif = crédit, donc on prend la valeur absolue
          totalProduits += solde < 0 ? Math.abs(solde) : 0;
          totalCharges += solde > 0 ? solde : 0; // Produit débiteur exceptionnel = charge
        }
      } else if (['1', '2', '3', '4', '5'].includes(classe)) {
        comptesBilan.push({ compte, solde });
      }
    });

    const resultatNet = totalProduits - totalCharges;
    const estBenefice = resultatNet >= 0;
    const compteResultatNumero = estBenefice ? '120' : '129';

    // Récupérer le journal OD (Opérations Diverses)
    const journalOD = await db.query.journaux.findFirst({
      where: and(
        eq(journaux.entrepriseId, entrepriseId),
        eq(journaux.code, 'OD')
      )
    });

    if (!journalOD) {
      return res.status(400).json({ error: 'Journal OD non trouvé' });
    }

    // Récupérer le journal AN (À Nouveau)
    const journalAN = await db.query.journaux.findFirst({
      where: and(
        eq(journaux.entrepriseId, entrepriseId),
        eq(journaux.code, 'AN')
      )
    });

    if (!journalAN) {
      return res.status(400).json({ error: 'Journal AN non trouvé' });
    }

    // Vérifier/créer le compte de résultat
    let compteResultat = comptesMap[compteResultatNumero];
    if (!compteResultat) {
      const [newCompte] = await db.insert(comptesComptables).values({
        entrepriseId,
        numero: compteResultatNumero,
        nom: estBenefice ? "Résultat de l'exercice (bénéfice)" : "Résultat de l'exercice (perte)",
        type: 'detail',
        categorie: 'Capitaux propres',
        actif: true
      }).returning();
      compteResultat = newCompte;
    }

    // ==========================================
    // 1. ÉCRITURE DE CLÔTURE DES COMPTES DE RÉSULTAT
    // ==========================================
    const { ecritureCloture, numeroEcritureCloture } = await db.transaction(async (tx) => {
      const numeroEcriture = await generateNumeroEcriture(
        entrepriseId,
        journalOD,
        new Date(dateClotureStr),
        tx
      );
      const [entry] = await tx.insert(ecritures).values({
        entrepriseId,
        journalId: journalOD.id,
        numeroEcriture,
        dateEcriture: new Date(dateClotureStr),
        libelle: `Clôture des comptes de résultat exercice ${annee}`,
        numeroPiece: `CLOTURE-${annee}`,
        valide: true
      }).returning();
      return { ecritureCloture: entry, numeroEcritureCloture: numeroEcriture };
    });

    const lignesCloture = [];
    let totalDebitCloture = 0;
    let totalCreditCloture = 0;

    // Solder tous les comptes de résultat en inversant leur solde
    // Si solde > 0 (débiteur), on crédite pour solder
    // Si solde < 0 (créditeur), on débite pour solder
    for (const { compte, solde } of comptesResultat) {
      if (solde > 0) {
        // Solde débiteur → crédit pour solder
        lignesCloture.push({
          entrepriseId,
          ecritureId: ecritureCloture.id,
          compteComptableId: compte.id,
          debit: '0',
          credit: solde.toString(),
          libelle: `Solde compte ${compte.numero} - ${compte.nom}`
        });
        totalCreditCloture += solde;
      } else {
        // Solde créditeur → débit pour solder
        lignesCloture.push({
          entrepriseId,
          ecritureId: ecritureCloture.id,
          compteComptableId: compte.id,
          debit: Math.abs(solde).toString(),
          credit: '0',
          libelle: `Solde compte ${compte.numero} - ${compte.nom}`
        });
        totalDebitCloture += Math.abs(solde);
      }
    }

    // Reporter le résultat sur le compte 120 ou 129
    // Le résultat équilibre l'écriture de clôture
    const differenceResultat = totalCreditCloture - totalDebitCloture;
    if (differenceResultat >= 0) {
      // Plus de crédits que de débits = bénéfice → débit du résultat pour équilibrer
      lignesCloture.push({
        entrepriseId,
        ecritureId: ecritureCloture.id,
        compteComptableId: compteResultat.id,
        debit: differenceResultat.toString(),
        credit: '0',
        libelle: `Résultat de l'exercice ${annee}`
      });
      totalDebitCloture += differenceResultat;
    } else {
      // Plus de débits que de crédits = perte → crédit du résultat pour équilibrer
      lignesCloture.push({
        entrepriseId,
        ecritureId: ecritureCloture.id,
        compteComptableId: compteResultat.id,
        debit: '0',
        credit: Math.abs(differenceResultat).toString(),
        libelle: `Résultat de l'exercice ${annee}`
      });
      totalCreditCloture += Math.abs(differenceResultat);
    }

    // Validation: l'écriture de clôture doit être équilibrée
    if (Math.abs(totalDebitCloture - totalCreditCloture) > 0.01) {
      throw new Error(`Écriture de clôture non équilibrée: Débit=${totalDebitCloture}, Crédit=${totalCreditCloture}`);
    }

    // Insérer les lignes de clôture
    await db.insert(lignesEcritures).values(lignesCloture);

    // ==========================================
    // 2. ÉCRITURE D'OUVERTURE DU NOUVEL EXERCICE
    // ==========================================
    // Calculer les nouveaux soldes de bilan (incluant le résultat)
    const soldesBilanFinaux = {};
    comptesBilan.forEach(({ compte, solde }) => {
      soldesBilanFinaux[compte.id] = { compte, solde };
    });

    // Ajouter le résultat au bilan
    // Le compte de résultat (120 ou 129) a été mouvementé dans l'écriture de clôture
    // Pour le bilan d'ouverture, on reporte ce solde
    if (compteResultat) {
      if (!soldesBilanFinaux[compteResultat.id]) {
        soldesBilanFinaux[compteResultat.id] = { compte: compteResultat, solde: 0 };
      }
      // Dans l'écriture de clôture:
      // - Si differenceResultat >= 0 (crédits > débits = produits > charges = bénéfice):
      //   On a DÉBITÉ le compte résultat pour équilibrer
      //   Le compte 120 (bénéfice) doit apparaître au CRÉDIT du passif dans le bilan
      //   Donc pour le report, on ajoute un solde NÉGATIF (créditeur)
      // - Si differenceResultat < 0 (débits > crédits = charges > produits = perte):
      //   On a CRÉDITÉ le compte résultat pour équilibrer
      //   Le compte 129 (perte) doit apparaître au DÉBIT de l'actif dans le bilan
      //   Donc pour le report, on ajoute un solde POSITIF (débiteur)
      // 
      // Dans les deux cas: solde_report = -differenceResultat
      // Car si on a débité dans la clôture, le report est créditeur (passif)
      // Et si on a crédité dans la clôture, le report est débiteur (actif)
      soldesBilanFinaux[compteResultat.id].solde += differenceResultat;
    }

    const { ecritureOuverture, numeroEcritureOuverture } = await db.transaction(async (tx) => {
      const numeroEcriture = await generateNumeroEcriture(
        entrepriseId,
        journalAN,
        new Date(dateOuvertureStr),
        tx
      );
      const [entry] = await tx.insert(ecritures).values({
        entrepriseId,
        journalId: journalAN.id,
        numeroEcriture,
        dateEcriture: new Date(dateOuvertureStr),
        libelle: `Bilan d'ouverture exercice ${parseInt(annee) + 1}`,
        numeroPiece: `OUVERTURE-${parseInt(annee) + 1}`,
        valide: true
      }).returning();
      return { ecritureOuverture: entry, numeroEcritureOuverture: numeroEcriture };
    });

    const lignesOuverture = [];
    let totalDebitOuverture = 0;
    let totalCreditOuverture = 0;

    Object.values(soldesBilanFinaux).forEach(({ compte, solde }) => {
      if (solde === 0) return;

      if (solde > 0) {
        // Solde débiteur
        lignesOuverture.push({
          entrepriseId,
          ecritureId: ecritureOuverture.id,
          compteComptableId: compte.id,
          debit: solde.toString(),
          credit: '0',
          libelle: `Report à nouveau ${compte.numero}`
        });
        totalDebitOuverture += solde;
      } else {
        // Solde créditeur
        lignesOuverture.push({
          entrepriseId,
          ecritureId: ecritureOuverture.id,
          compteComptableId: compte.id,
          debit: '0',
          credit: Math.abs(solde).toString(),
          libelle: `Report à nouveau ${compte.numero}`
        });
        totalCreditOuverture += Math.abs(solde);
      }
    });

    // Validation: l'écriture d'ouverture doit être équilibrée
    if (Math.abs(totalDebitOuverture - totalCreditOuverture) > 1) {
      throw new Error(`Écriture d'ouverture non équilibrée: Débit=${totalDebitOuverture.toLocaleString('fr-FR')}, Crédit=${totalCreditOuverture.toLocaleString('fr-FR')}`);
    }

    // Insérer les lignes d'ouverture
    if (lignesOuverture.length > 0) {
      await db.insert(lignesEcritures).values(lignesOuverture);
    }

    // Enregistrer dans l'audit log
    await logAudit({
      ...extractAuditInfo(req),
      action: 'CLOTURE_EXERCICE',
      table: 'ecritures',
      nouvelleValeur: {
        annee,
        resultatNet,
        typeResultat: estBenefice ? 'benefice' : 'perte',
        compteResultat: compteResultatNumero,
        ecritureCloture: numeroEcritureCloture,
        ecritureOuverture: numeroEcritureOuverture
      },
      description: `Clôture de l'exercice ${annee}`,
      required: false
    });

    res.json({
      success: true,
      message: `Exercice ${annee} clôturé avec succès`,
      details: {
        resultatNet,
        typeResultat: estBenefice ? 'benefice' : 'perte',
        compteResultat: compteResultatNumero,
        ecritureCloture: {
          numero: numeroEcritureCloture,
          lignes: lignesCloture.length
        },
        ecritureOuverture: {
          numero: numeroEcritureOuverture,
          lignes: lignesOuverture.length,
          totalDebit: totalDebitOuverture,
          totalCredit: totalCreditOuverture
        }
      }
    });
  } catch (error) {
    console.error('Erreur clôture exercice:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// DRILL-DOWN MOUVEMENTS PAR COMPTE
// ==========================================

router.get('/compte-mouvements/:numeroCompte', async (req, res) => {
  try {
    const { numeroCompte } = req.params;
    const { dateDebut, dateFin, page = 1, limit = 100 } = req.query;
    const eId = req.entrepriseId;
    
    if (!eId) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    
    if (!numeroCompte) {
      return res.status(400).json({ error: 'Numéro de compte requis' });
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const mouvementsData = await db.execute(sql`
      SELECT 
        le.id,
        e.date_ecriture as date,
        j.code as journal_code,
        j.nom as journal_nom,
        e.numero_piece as reference,
        e.libelle as libelle_ecriture,
        le.libelle as libelle_ligne,
        COALESCE(le.debit, 0) as debit,
        COALESCE(le.credit, 0) as credit,
        cc.numero as numero_compte,
        cc.nom as nom_compte,
        e.id as ecriture_id
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
      JOIN journaux j ON e.journal_id = j.id
      WHERE e.entreprise_id = ${eId}
      AND cc.numero LIKE ${numeroCompte + '%'}
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
      ORDER BY e.date_ecriture, e.id, le.id
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `);
    
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
      WHERE e.entreprise_id = ${eId}
      AND cc.numero LIKE ${numeroCompte + '%'}
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
    `);
    
    const totauxResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CAST(le.debit AS DECIMAL)), 0) as total_debit,
        COALESCE(SUM(CAST(le.credit AS DECIMAL)), 0) as total_credit
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
      WHERE e.entreprise_id = ${eId}
      AND cc.numero LIKE ${numeroCompte + '%'}
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
    `);
    
    const rows = mouvementsData.rows || mouvementsData || [];
    const countRows = countResult.rows || countResult || [];
    const totauxRows = totauxResult.rows || totauxResult || [];
    
    const total = parseInt(countRows[0]?.total || 0);
    const totalDebit = parseFloat(totauxRows[0]?.total_debit || 0);
    const totalCredit = parseFloat(totauxRows[0]?.total_credit || 0);
    const solde = totalDebit - totalCredit;
    
    let soldeCumul = 0;
    const mouvements = rows.map(row => {
      const debit = parseFloat(row.debit || 0);
      const credit = parseFloat(row.credit || 0);
      soldeCumul += debit - credit;
      return {
        id: row.id,
        date: row.date,
        journal: row.journal_code,
        journalNom: row.journal_nom,
        reference: row.reference,
        libelle: row.libelle_ligne || row.libelle_ecriture,
        debit,
        credit,
        soldeCumul,
        ecritureId: row.ecriture_id
      };
    });
    
    const compteInfo = await db.execute(sql`
      SELECT numero, nom FROM comptes_comptables 
      WHERE entreprise_id = ${eId} AND numero = ${numeroCompte}
      LIMIT 1
    `);
    const compteRows = compteInfo.rows || compteInfo || [];
    
    res.json({
      compte: {
        numero: numeroCompte,
        nom: compteRows[0]?.nom || 'Compte ' + numeroCompte
      },
      mouvements,
      totaux: {
        totalDebit,
        totalCredit,
        solde
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Erreur mouvements compte:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// EXPORT
// ==========================================

router.get('/export', async (req, res) => {
  try {
    const { entrepriseId, type } = req.query; // type: ecritures, grand-livre, balance

    if (type === 'ecritures') {
      const entries = await db.query.ecritures.findMany({
        where: eq(ecritures.entrepriseId, parseInt(entrepriseId))
      });
      const headers = 'Date,Journal,Référence,Description,Débit,Crédit,Statut\n';
      const rows = entries.map(e =>
        `"${e.dateEcriture}","${e.journalId}","${e.reference}","${e.description}","${e.totalDebit}","${e.totalCredit}","${e.statut}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="ecritures.csv"');
      res.send(headers + rows);
    }
    res.json({ message: 'Export généré' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
