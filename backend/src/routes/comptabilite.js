import express from 'express';
import { db } from '../db.js';
import { 
  plansComptables, comptes, journaux, ecritures, lignesEcritures, 
  soldesComptes, auditLogs, entreprises 
} from '../schema.js';
import { eq, and, desc, gte, lte, sum, sql } from 'drizzle-orm';

const router = express.Router();

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
    const { entrepriseId, dateDebut, dateFin } = req.query;
    const eId = parseInt(entrepriseId);
    
    // Récupérer tous les comptes avec leurs soldes
    const allComptes = await db.query.comptes.findMany({
      where: eq(comptes.entrepriseId, eId)
    });
    
    // Calculer les soldes à partir des écritures
    const ecrituresData = await db.execute(sql`
      SELECT le.compte_id, 
             SUM(COALESCE(le.debit, 0)) as total_debit,
             SUM(COALESCE(le.credit, 0)) as total_credit
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      WHERE e.entreprise_id = ${eId}
      ${dateDebut ? sql`AND e.date >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date <= ${dateFin}` : sql``}
      GROUP BY le.compte_id
    `);
    
    const soldesMap = {};
    const rows = ecrituresData.rows || ecrituresData || [];
    rows.forEach(row => {
      soldesMap[row.compte_id] = {
        debit: parseFloat(row.total_debit || 0),
        credit: parseFloat(row.total_credit || 0)
      };
    });
    
    // Structurer le bilan
    const actif = { immobilise: [], circulant: [], tresorerie: [], total: 0 };
    const passif = { capitaux: [], dettes: [], total: 0 };
    
    allComptes.forEach(compte => {
      const solde = soldesMap[compte.id] || { debit: 0, credit: 0 };
      const soldeFinal = solde.debit - solde.credit;
      
      const compteData = {
        numero: compte.numero,
        nom: compte.nom,
        solde: Math.abs(soldeFinal)
      };
      
      if (compte.numero.startsWith('2')) {
        actif.immobilise.push(compteData);
        actif.total += soldeFinal > 0 ? soldeFinal : 0;
      } else if (compte.numero.startsWith('3') || compte.numero.startsWith('4')) {
        if (compte.categorie === 'Actif') {
          actif.circulant.push(compteData);
          actif.total += soldeFinal > 0 ? soldeFinal : 0;
        } else {
          passif.dettes.push(compteData);
          passif.total += soldeFinal < 0 ? Math.abs(soldeFinal) : 0;
        }
      } else if (compte.numero.startsWith('5')) {
        actif.tresorerie.push(compteData);
        actif.total += soldeFinal > 0 ? soldeFinal : 0;
      } else if (compte.numero.startsWith('1')) {
        passif.capitaux.push(compteData);
        passif.total += Math.abs(soldeFinal);
      }
    });
    
    res.json({
      actif,
      passif,
      equilibre: Math.abs(actif.total - passif.total) < 0.01
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Compte de résultat
router.get('/rapports/resultat', async (req, res) => {
  try {
    const { entrepriseId, dateDebut, dateFin } = req.query;
    const eId = parseInt(entrepriseId);
    
    const allComptes = await db.query.comptes.findMany({
      where: eq(comptes.entrepriseId, eId)
    });
    
    const ecrituresData = await db.execute(sql`
      SELECT le.compte_id, 
             SUM(COALESCE(le.debit, 0)) as total_debit,
             SUM(COALESCE(le.credit, 0)) as total_credit
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      WHERE e.entreprise_id = ${eId}
      ${dateDebut ? sql`AND e.date >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date <= ${dateFin}` : sql``}
      GROUP BY le.compte_id
    `);
    
    const soldesMap = {};
    const rows = ecrituresData.rows || ecrituresData || [];
    rows.forEach(row => {
      soldesMap[row.compte_id] = {
        debit: parseFloat(row.total_debit || 0),
        credit: parseFloat(row.total_credit || 0)
      };
    });
    
    const charges = { exploitation: [], financieres: [], exceptionnelles: [], total: 0 };
    const produits = { exploitation: [], financiers: [], exceptionnels: [], total: 0 };
    
    allComptes.forEach(compte => {
      const solde = soldesMap[compte.id] || { debit: 0, credit: 0 };
      
      const compteData = {
        numero: compte.numero,
        nom: compte.nom,
        montant: 0
      };
      
      if (compte.numero.startsWith('6')) {
        compteData.montant = solde.debit;
        if (compte.numero.startsWith('66') || compte.numero.startsWith('67')) {
          charges.financieres.push(compteData);
        } else {
          charges.exploitation.push(compteData);
        }
        charges.total += compteData.montant;
      } else if (compte.numero.startsWith('7')) {
        compteData.montant = solde.credit;
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
    
    res.json({
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
    
    // Récupérer les lignes d'écritures pour ce compte
    const lignes = await db.query.lignesEcritures.findMany({
      where: eq(lignesEcritures.compteId, parseInt(compteId)),
      with: {
        ecriture: true
      }
    });
    
    // Filtrer par entreprise et par dates si fournies
    let filteredLignes = lignes.filter(l => l.ecriture?.entrepriseId === eId);
    
    if (dateDebut) {
      const start = new Date(dateDebut);
      filteredLignes = filteredLignes.filter(l => new Date(l.ecriture?.dateEcriture || l.ecriture?.date) >= start);
    }
    if (dateFin) {
      const end = new Date(dateFin);
      filteredLignes = filteredLignes.filter(l => new Date(l.ecriture?.dateEcriture || l.ecriture?.date) <= end);
    }
    
    const result = filteredLignes.map(l => ({
      id: l.id,
      date: l.ecriture?.dateEcriture || l.ecriture?.date || l.ecriture?.createdAt,
      libelle: l.description || l.ecriture?.libelle || l.ecriture?.description,
      reference: l.ecriture?.reference || l.ecriture?.numeroPiece,
      debit: l.type === 'debit' ? parseFloat(l.montant || 0) : 0,
      credit: l.type === 'credit' ? parseFloat(l.montant || 0) : 0
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    res.json(result);
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
    const { entrepriseId, numero, nom, categorie, sousCategorie, devise, userId, ipAddress } = req.body;

    const compte = await db.insert(comptes).values({
      entrepriseId: parseInt(entrepriseId),
      numero,
      nom,
      categorie, // Actif, Passif, Capitaux propres, Charges, Produits
      sousCategorie,
      devise: devise || 'XOF',
      solde: 0,
      actif: true
    }).returning();

    await db.insert(auditLogs).values({
      entrepriseId: parseInt(entrepriseId),
      userId,
      action: 'CREATE',
      table: 'comptes',
      recordId: compte[0].id,
      description: `Compte créé: ${numero} - ${nom}`,
      ipAddress
    });

    res.json(compte[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/comptes', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const accounts = await db.query.comptes.findMany({
      where: eq(comptes.entrepriseId, parseInt(entrepriseId))
    });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GESTION DES JOURNAUX
// ==========================================

router.post('/journaux', async (req, res) => {
  try {
    const { entrepriseId, code, nom, type } = req.body;
    const journal = await db.insert(journaux).values({
      entrepriseId: parseInt(entrepriseId),
      code,
      nom,
      type, // Achats, Ventes, Banque, Caisse, OD
      actif: true
    }).returning();
    res.json(journal[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/journaux', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const journals = await db.query.journaux.findMany({
      where: eq(journaux.entrepriseId, parseInt(entrepriseId))
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
    const { entrepriseId, journalId, dateEcriture, reference, description, userId, ipAddress } = req.body;

    const ecriture = await db.insert(ecritures).values({
      entrepriseId: parseInt(entrepriseId),
      journalId: parseInt(journalId),
      dateEcriture: new Date(dateEcriture),
      reference,
      description,
      statut: 'brouillon',
      totalDebit: 0,
      totalCredit: 0
    }).returning();

    await db.insert(auditLogs).values({
      entrepriseId: parseInt(entrepriseId),
      userId,
      action: 'CREATE',
      table: 'ecritures',
      recordId: ecriture[0].id,
      description: `Écriture créée: ${reference}`,
      ipAddress
    });

    res.json(ecriture[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ecritures', async (req, res) => {
  try {
    const { entrepriseId, journalId } = req.query;
    const where = [eq(ecritures.entrepriseId, parseInt(entrepriseId))];
    if (journalId) where.push(eq(ecritures.journalId, parseInt(journalId)));

    const entries = await db.query.ecritures.findMany({
      where: and(...where),
      orderBy: desc(ecritures.dateEcriture)
    });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// LIGNES D'ÉCRITURES (DÉBIT/CRÉDIT)
// ==========================================

router.post('/lignes', async (req, res) => {
  try {
    const { entrepriseId, ecritureId, compteId, montant, type, description } = req.body;

    const ligne = await db.insert(lignesEcritures).values({
      entrepriseId: parseInt(entrepriseId),
      ecritureId: parseInt(ecritureId),
      compteId: parseInt(compteId),
      montant: parseFloat(montant),
      type, // debit ou credit
      description
    }).returning();

    // Mettre à jour totaux de l'écriture
    const ecriture = await db.query.ecritures.findFirst({
      where: eq(ecritures.id, parseInt(ecritureId))
    });

    const lignes = await db.query.lignesEcritures.findMany({
      where: eq(lignesEcritures.ecritureId, parseInt(ecritureId))
    });

    let totalDebit = 0, totalCredit = 0;
    lignes.forEach(l => {
      if (l.type === 'debit') totalDebit += parseFloat(l.montant);
      else totalCredit += parseFloat(l.montant);
    });

    await db.update(ecritures).set({
      totalDebit,
      totalCredit
    }).where(eq(ecritures.id, parseInt(ecritureId)));

    res.json(ligne[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/lignes/:ecritureId', async (req, res) => {
  try {
    const { ecritureId } = req.params;
    const lines = await db.query.lignesEcritures.findMany({
      where: eq(lignesEcritures.ecritureId, parseInt(ecritureId))
    });
    res.json(lines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// VALIDATION & MODIFICATION
// ==========================================

router.post('/ecritures/:id/valider', async (req, res) => {
  try {
    const { id } = req.params;
    const ecriture = await db.query.ecritures.findFirst({
      where: eq(ecritures.id, parseInt(id))
    });

    if (!ecriture) return res.status(404).json({ error: 'Écriture non trouvée' });

    // Vérifier l'équilibre (débit = crédit)
    if (parseFloat(ecriture.totalDebit) !== parseFloat(ecriture.totalCredit)) {
      return res.status(400).json({ error: 'Écriture non équilibrée', debit: ecriture.totalDebit, credit: ecriture.totalCredit });
    }

    const updated = await db.update(ecritures).set({
      statut: 'validée'
    }).where(eq(ecritures.id, parseInt(id))).returning();

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/ecritures/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { dateEcriture, reference, description, userId } = req.body;

    const updated = await db.update(ecritures).set({
      dateEcriture: dateEcriture ? new Date(dateEcriture) : undefined,
      reference,
      description
    }).where(eq(ecritures.id, parseInt(id))).returning();

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/ecritures/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, ipAddress } = req.body;

    // Supprimer les lignes d'abord
    await db.delete(lignesEcritures).where(eq(lignesEcritures.ecritureId, parseInt(id)));

    // Puis l'écriture
    await db.delete(ecritures).where(eq(ecritures.id, parseInt(id)));

    res.json({ message: 'Écriture supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GRAND LIVRE
// ==========================================

router.get('/grand-livre', async (req, res) => {
  try {
    const { entrepriseId, compteId, dateDebut, dateFin } = req.query;

    const conditions = [
      eq(lignesEcritures.entrepriseId, parseInt(entrepriseId)),
      eq(ecritures.statut, 'validée')
    ];
    if (compteId) conditions.push(eq(lignesEcritures.compteId, parseInt(compteId)));
    if (dateDebut) conditions.push(gte(ecritures.dateEcriture, new Date(dateDebut)));
    if (dateFin) conditions.push(lte(ecritures.dateEcriture, new Date(dateFin)));

    const lignes = await db
      .select({
        id: lignesEcritures.id,
        compteId: lignesEcritures.compteId,
        montant: lignesEcritures.montant,
        type: lignesEcritures.type,
        description: lignesEcritures.description,
        dateEcriture: ecritures.dateEcriture,
        reference: ecritures.reference
      })
      .from(lignesEcritures)
      .innerJoin(ecritures, eq(lignesEcritures.ecritureId, ecritures.id))
      .where(and(...conditions));

    res.json(lignes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// BALANCE GÉNÉRALE
// ==========================================

router.get('/balance', async (req, res) => {
  try {
    const { entrepriseId } = req.query;

    const lignes = await db
      .select({
        compteId: lignesEcritures.compteId,
        montant: lignesEcritures.montant,
        type: lignesEcritures.type
      })
      .from(lignesEcritures)
      .innerJoin(ecritures, eq(lignesEcritures.ecritureId, ecritures.id))
      .where(
        and(
          eq(lignesEcritures.entrepriseId, parseInt(entrepriseId)),
          eq(ecritures.statut, 'validée')
        )
      );

    const balance = {};
    lignes.forEach(ligne => {
      if (!balance[ligne.compteId]) {
        balance[ligne.compteId] = { debit: 0, credit: 0 };
      }
      if (ligne.type === 'debit') {
        balance[ligne.compteId].debit += parseFloat(ligne.montant);
      } else {
        balance[ligne.compteId].credit += parseFloat(ligne.montant);
      }
    });

    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RAPPORTS FINANCIERS
// ==========================================

// Bilan Comptable
router.get('/bilan', async (req, res) => {
  try {
    const { entrepriseId, dateDebut, dateFin } = req.query;
    
    // Récupérer tous les comptes et leurs soldes
    const comptesData = await db.query.comptes.findMany({
      where: eq(comptes.entrepriseId, parseInt(entrepriseId))
    });

    // Calculer les soldes basés sur les écritures validées avec JOIN
    let query = db
      .select({
        compteId: lignesEcritures.compteId,
        montant: lignesEcritures.montant,
        type: lignesEcritures.type
      })
      .from(lignesEcritures)
      .innerJoin(ecritures, eq(lignesEcritures.ecritureId, ecritures.id))
      .where(
        and(
          eq(lignesEcritures.entrepriseId, parseInt(entrepriseId)),
          eq(ecritures.statut, 'validée')
        )
      );
    
    if (dateDebut) {
      query = query.where(
        and(
          eq(lignesEcritures.entrepriseId, parseInt(entrepriseId)),
          eq(ecritures.statut, 'validée'),
          gte(ecritures.dateEcriture, new Date(dateDebut))
        )
      );
    }
    if (dateFin) {
      const conditions = [
        eq(lignesEcritures.entrepriseId, parseInt(entrepriseId)),
        eq(ecritures.statut, 'validée'),
        lte(ecritures.dateEcriture, new Date(dateFin))
      ];
      if (dateDebut) conditions.push(gte(ecritures.dateEcriture, new Date(dateDebut)));
      query = query.where(and(...conditions));
    }
    
    const lignes = await query;

    const soldesComptes = {};
    lignes.forEach(ligne => {
      if (!soldesComptes[ligne.compteId]) {
        soldesComptes[ligne.compteId] = 0;
      }
      if (ligne.type === 'debit') {
        soldesComptes[ligne.compteId] += parseFloat(ligne.montant);
      } else {
        soldesComptes[ligne.compteId] -= parseFloat(ligne.montant);
      }
    });

    // Classifier les comptes
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
      const solde = soldesComptes[compte.id] || 0;
      const item = { compte: compte.numero, nom: compte.nom, montant: solde };

      if (compte.categorie === 'Actif') {
        if (compte.numero.startsWith('2')) bilan.actif.immobilisations.push(item);
        else if (compte.numero.startsWith('3') || compte.numero.startsWith('4')) bilan.actif.stocksCreances.push(item);
        else if (compte.numero.startsWith('5')) bilan.actif.tresorerie.push(item);
        bilan.actif.total += solde;
      } else if (compte.categorie === 'Passif' || compte.categorie === 'Capitaux propres') {
        if (compte.numero.startsWith('1')) bilan.passif.capitauxPropres.push(item);
        else bilan.passif.dettes.push(item);
        bilan.passif.total += Math.abs(solde);
      }
    });

    res.json(bilan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Compte de Résultat
router.get('/compte-resultat', async (req, res) => {
  try {
    const { entrepriseId, dateDebut, dateFin } = req.query;

    const comptesData = await db.query.comptes.findMany({
      where: eq(comptes.entrepriseId, parseInt(entrepriseId))
    });

    // Construire les conditions de filtrage
    const conditions = [
      eq(lignesEcritures.entrepriseId, parseInt(entrepriseId)),
      eq(ecritures.statut, 'validée')
    ];
    if (dateDebut) conditions.push(gte(ecritures.dateEcriture, new Date(dateDebut)));
    if (dateFin) conditions.push(lte(ecritures.dateEcriture, new Date(dateFin)));

    const lignes = await db
      .select({
        compteId: lignesEcritures.compteId,
        montant: lignesEcritures.montant,
        type: lignesEcritures.type
      })
      .from(lignesEcritures)
      .innerJoin(ecritures, eq(lignesEcritures.ecritureId, ecritures.id))
      .where(and(...conditions));

    const soldesComptes = {};
    lignes.forEach(ligne => {
      if (!soldesComptes[ligne.compteId]) {
        soldesComptes[ligne.compteId] = 0;
      }
      if (ligne.type === 'debit') {
        soldesComptes[ligne.compteId] += parseFloat(ligne.montant);
      } else {
        soldesComptes[ligne.compteId] -= parseFloat(ligne.montant);
      }
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
      const solde = Math.abs(soldesComptes[compte.id] || 0);
      const item = { compte: compte.numero, nom: compte.nom, montant: solde };

      if (compte.categorie === 'Produits') {
        if (compte.numero.startsWith('70')) resultat.produits.ventesMarchandises.push(item);
        else if (compte.numero.startsWith('71') || compte.numero.startsWith('72')) resultat.produits.prestationsServices.push(item);
        else resultat.produits.autresProduits.push(item);
        resultat.produits.total += solde;
      } else if (compte.categorie === 'Charges') {
        if (compte.numero.startsWith('60')) resultat.charges.achats.push(item);
        else if (compte.numero.startsWith('61') || compte.numero.startsWith('62')) resultat.charges.services.push(item);
        else if (compte.numero.startsWith('63') || compte.numero.startsWith('64')) resultat.charges.personnel.push(item);
        else resultat.charges.autresCharges.push(item);
        resultat.charges.total += solde;
      }
    });

    resultat.resultatNet = resultat.produits.total - resultat.charges.total;

    res.json(resultat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rapport des Journaux
router.get('/rapport-journaux', async (req, res) => {
  try {
    const { entrepriseId, dateDebut, dateFin } = req.query;

    const conditions = [
      eq(ecritures.entrepriseId, parseInt(entrepriseId)),
      eq(ecritures.statut, 'validée')
    ];
    if (dateDebut) conditions.push(gte(ecritures.dateEcriture, new Date(dateDebut)));
    if (dateFin) conditions.push(lte(ecritures.dateEcriture, new Date(dateFin)));

    const ecrituresData = await db
      .select({
        id: ecritures.id,
        journalId: ecritures.journalId,
        dateEcriture: ecritures.dateEcriture,
        reference: ecritures.reference,
        description: ecritures.description,
        totalDebit: ecritures.totalDebit,
        totalCredit: ecritures.totalCredit
      })
      .from(ecritures)
      .where(and(...conditions));

    const journauxData = await db.query.journaux.findMany({
      where: eq(journaux.entrepriseId, parseInt(entrepriseId))
    });

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
        rapportParJournal[ecriture.journalId].ecritures.push(ecriture);
        rapportParJournal[ecriture.journalId].totalDebit += parseFloat(ecriture.totalDebit || 0);
        rapportParJournal[ecriture.journalId].totalCredit += parseFloat(ecriture.totalCredit || 0);
        rapportParJournal[ecriture.journalId].nombreEcritures++;
      }
    });

    res.json({
      journaux: Object.values(rapportParJournal),
      totaux: {
        debit: ecrituresData.reduce((sum, e) => sum + parseFloat(e.totalDebit || 0), 0),
        credit: ecrituresData.reduce((sum, e) => sum + parseFloat(e.totalCredit || 0), 0),
        nombreEcritures: ecrituresData.length
      }
    });
  } catch (error) {
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
