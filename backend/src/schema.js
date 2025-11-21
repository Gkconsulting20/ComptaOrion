import { pgTable, serial, text, varchar, integer, decimal, boolean, timestamp, date, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==========================================
// ENUMS
// ==========================================

export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'accountant', 'employee', 'viewer']);
export const transactionTypeEnum = pgEnum('transaction_type', ['encaissement', 'decaissement']);
export const orderStatusEnum = pgEnum('order_status', ['brouillon', 'confirmee', 'preparee', 'livree', 'annulee']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['brouillon', 'envoyee', 'payee', 'annulee', 'retard']);
export const expenseStatusEnum = pgEnum('expense_status', ['brouillon', 'soumise', 'approuvee', 'rejetee', 'remboursee']);
export const stockMovementTypeEnum = pgEnum('stock_movement_type', ['entree', 'sortie', 'transfert', 'ajustement']);
export const journalTypeEnum = pgEnum('journal_type', ['achats', 'ventes', 'banque', 'caisse', 'od']);

// ==========================================
// MODULE 9: MULTI-ENTREPRISE & ADMINISTRATION
// ==========================================

export const entreprises = pgTable('entreprises', {
  id: serial('id').primaryKey(),
  nom: varchar('nom', { length: 255 }).notNull(),
  raisonSociale: varchar('raison_sociale', { length: 255 }),
  numeroSiret: varchar('numero_siret', { length: 50 }),
  adresse: text('adresse'),
  ville: varchar('ville', { length: 100 }),
  pays: varchar('pays', { length: 100 }).default('Côte d\'Ivoire'),
  telephone: varchar('telephone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  devise: varchar('devise', { length: 10 }).default('FCFA'),
  tauxTva: decimal('taux_tva', { precision: 5, scale: 2 }).default('18.00'),
  logoUrl: text('logo_url'),
  actif: boolean('actif').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nom: varchar('nom', { length: 100 }),
  prenom: varchar('prenom', { length: 100 }),
  role: userRoleEnum('role').default('employee'),
  actif: boolean('actif').default(true),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ==========================================
// MODULE 4: CLIENTS & CRM
// ==========================================

export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  numeroClient: varchar('numero_client', { length: 50 }).unique(),
  nom: varchar('nom', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).default('particulier'), // particulier, entreprise
  email: varchar('email', { length: 255 }),
  telephone: varchar('telephone', { length: 50 }),
  adresse: text('adresse'),
  ville: varchar('ville', { length: 100 }),
  pays: varchar('pays', { length: 100 }),
  categorieClient: varchar('categorie_client', { length: 100 }).default('standard'),
  limiteCredit: decimal('limite_credit', { precision: 15, scale: 2 }).default('0'),
  delaiPaiement: integer('delai_paiement').default(30), // jours
  remise: decimal('remise', { precision: 5, scale: 2 }).default('0'), // %
  soldeDu: decimal('solde_du', { precision: 15, scale: 2 }).default('0'),
  actif: boolean('actif').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ==========================================
// MODULE 5: FOURNISSEURS
// ==========================================

export const fournisseurs = pgTable('fournisseurs', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  numeroFournisseur: varchar('numero_fournisseur', { length: 50 }).unique(),
  raisonSociale: varchar('raison_sociale', { length: 255 }).notNull(),
  contactPrincipal: varchar('contact_principal', { length: 255 }),
  fonction: varchar('fonction', { length: 100 }),
  email: varchar('email', { length: 255 }),
  telephone: varchar('telephone', { length: 50 }),
  adresse: text('adresse'),
  categorie: varchar('categorie', { length: 100 }),
  delaiPaiement: integer('delai_paiement').default(30),
  compteBancaire: varchar('compte_bancaire', { length: 100 }),
  banque: varchar('banque', { length: 255 }),
  soldeDu: decimal('solde_du', { precision: 15, scale: 2 }).default('0'),
  actif: boolean('actif').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ==========================================
// MODULE 6: STOCK & INVENTAIRE
// ==========================================

export const produits = pgTable('produits', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  reference: varchar('reference', { length: 100 }).unique(),
  nom: varchar('nom', { length: 255 }).notNull(),
  description: text('description'),
  categorie: varchar('categorie', { length: 100 }),
  uniteMesure: varchar('unite_mesure', { length: 50 }).default('pièce'),
  quantite: decimal('quantite', { precision: 15, scale: 3 }).default('0'),
  stockMinimum: decimal('stock_minimum', { precision: 15, scale: 3 }).default('0'),
  prixAchat: decimal('prix_achat', { precision: 15, scale: 2 }).default('0'),
  prixVente: decimal('prix_vente', { precision: 15, scale: 2 }).default('0'),
  fournisseurId: integer('fournisseur_id').references(() => fournisseurs.id),
  emplacement: varchar('emplacement', { length: 255 }),
  actif: boolean('actif').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const mouvementsStock = pgTable('mouvements_stock', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  produitId: integer('produit_id').references(() => produits.id).notNull(),
  type: stockMovementTypeEnum('type').notNull(),
  quantite: decimal('quantite', { precision: 15, scale: 3 }).notNull(),
  prixUnitaire: decimal('prix_unitaire', { precision: 15, scale: 2 }),
  reference: varchar('reference', { length: 255 }), // référence commande, facture, etc.
  notes: text('notes'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// ==========================================
// MODULE 12: PRISE DE COMMANDE
// ==========================================

export const commandes = pgTable('commandes', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  numeroCommande: varchar('numero_commande', { length: 100 }).unique(),
  clientId: integer('client_id').references(() => clients.id).notNull(),
  statut: orderStatusEnum('statut').default('brouillon'),
  dateCommande: date('date_commande').defaultNow(),
  dateLivraison: date('date_livraison'),
  totalHT: decimal('total_ht', { precision: 15, scale: 2 }).default('0'),
  totalTVA: decimal('total_tva', { precision: 15, scale: 2 }).default('0'),
  totalTTC: decimal('total_ttc', { precision: 15, scale: 2 }).default('0'),
  remise: decimal('remise', { precision: 15, scale: 2 }).default('0'),
  fraisLivraison: decimal('frais_livraison', { precision: 15, scale: 2 }).default('0'),
  notes: text('notes'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const commandeItems = pgTable('commande_items', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  commandeId: integer('commande_id').references(() => commandes.id).notNull(),
  produitId: integer('produit_id').references(() => produits.id).notNull(),
  quantite: decimal('quantite', { precision: 15, scale: 3 }).notNull(),
  prixUnitaire: decimal('prix_unitaire', { precision: 15, scale: 2 }).notNull(),
  remise: decimal('remise', { precision: 5, scale: 2 }).default('0'),
  totalLigne: decimal('total_ligne', { precision: 15, scale: 2 }).notNull(),
});

export const bonsLivraison = pgTable('bons_livraison', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  numeroBL: varchar('numero_bl', { length: 100 }).unique(),
  commandeId: integer('commande_id').references(() => commandes.id),
  clientId: integer('client_id').references(() => clients.id).notNull(),
  dateLivraison: date('date_livraison').defaultNow(),
  signatureClient: text('signature_client'),
  notes: text('notes'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const bonLivraisonItems = pgTable('bon_livraison_items', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  bonLivraisonId: integer('bon_livraison_id').references(() => bonsLivraison.id).notNull(),
  produitId: integer('produit_id').references(() => produits.id).notNull(),
  quantite: decimal('quantite', { precision: 15, scale: 3 }).notNull(),
});

// ==========================================
// MODULE 4: FACTURATION & VENTES
// ==========================================

export const factures = pgTable('factures', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  numeroFacture: varchar('numero_facture', { length: 100 }).unique(),
  clientId: integer('client_id').references(() => clients.id).notNull(),
  commandeId: integer('commande_id').references(() => commandes.id),
  statut: invoiceStatusEnum('statut').default('brouillon'),
  dateFacture: date('date_facture').defaultNow(),
  dateEcheance: date('date_echeance'),
  totalHT: decimal('total_ht', { precision: 15, scale: 2 }).default('0'),
  totalTVA: decimal('total_tva', { precision: 15, scale: 2 }).default('0'),
  totalTTC: decimal('total_ttc', { precision: 15, scale: 2 }).default('0'),
  montantPaye: decimal('montant_paye', { precision: 15, scale: 2 }).default('0'),
  soldeRestant: decimal('solde_restant', { precision: 15, scale: 2 }).default('0'),
  notes: text('notes'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const factureItems = pgTable('facture_items', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  factureId: integer('facture_id').references(() => factures.id).notNull(),
  produitId: integer('produit_id').references(() => produits.id),
  description: text('description').notNull(),
  quantite: decimal('quantite', { precision: 15, scale: 3 }).notNull(),
  prixUnitaire: decimal('prix_unitaire', { precision: 15, scale: 2 }).notNull(),
  remise: decimal('remise', { precision: 5, scale: 2 }).default('0'),
  totalLigne: decimal('total_ligne', { precision: 15, scale: 2 }).notNull(),
});

export const paiements = pgTable('paiements', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  factureId: integer('facture_id').references(() => factures.id),
  clientId: integer('client_id').references(() => clients.id),
  montant: decimal('montant', { precision: 15, scale: 2 }).notNull(),
  modePaiement: varchar('mode_paiement', { length: 100 }), // espèces, virement, mobile money, etc.
  reference: varchar('reference', { length: 255 }),
  datePaiement: date('date_paiement').defaultNow(),
  notes: text('notes'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// ==========================================
// MODULE 2: TRÉSORERIE
// ==========================================

export const comptesBancaires = pgTable('comptes_bancaires', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  nomCompte: varchar('nom_compte', { length: 255 }).notNull(),
  numeroCompte: varchar('numero_compte', { length: 100 }),
  banque: varchar('banque', { length: 255 }),
  soldeInitial: decimal('solde_initial', { precision: 15, scale: 2 }).default('0'),
  soldeActuel: decimal('solde_actuel', { precision: 15, scale: 2 }).default('0'),
  type: varchar('type', { length: 50 }).default('banque'), // banque, caisse, mobile money
  actif: boolean('actif').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const transactionsTresorerie = pgTable('transactions_tresorerie', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  compteBancaireId: integer('compte_bancaire_id').references(() => comptesBancaires.id).notNull(),
  type: transactionTypeEnum('type').notNull(),
  montant: decimal('montant', { precision: 15, scale: 2 }).notNull(),
  dateTransaction: date('date_transaction').defaultNow(),
  categorie: varchar('categorie', { length: 100 }),
  description: text('description'),
  tiersNom: varchar('tiers_nom', { length: 255 }), // client ou fournisseur
  numeroPiece: varchar('numero_piece', { length: 100 }),
  modePaiement: varchar('mode_paiement', { length: 100 }),
  rapproche: boolean('rapproche').default(false),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// ==========================================
// MODULE 1: COMPTABILITÉ GÉNÉRALE
// ==========================================

export const comptesComptables = pgTable('comptes_comptables', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  numero: varchar('numero', { length: 50 }).notNull(),
  nom: varchar('nom', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // actif, passif, produit, charge, capitaux
  categorie: varchar('categorie', { length: 100 }), // bilan, résultat
  compteParent: varchar('compte_parent', { length: 50 }),
  soldeDebiteur: decimal('solde_debiteur', { precision: 15, scale: 2 }).default('0'),
  soldeCrediteur: decimal('solde_crediteur', { precision: 15, scale: 2 }).default('0'),
  actif: boolean('actif').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const journaux = pgTable('journaux', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  code: varchar('code', { length: 20 }).notNull(),
  nom: varchar('nom', { length: 255 }).notNull(),
  type: journalTypeEnum('type').notNull(),
  actif: boolean('actif').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const ecritures = pgTable('ecritures', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  journalId: integer('journal_id').references(() => journaux.id).notNull(),
  numeroEcriture: varchar('numero_ecriture', { length: 100 }).unique(),
  dateEcriture: date('date_ecriture').notNull(),
  libelle: text('libelle').notNull(),
  numeroPiece: varchar('numero_piece', { length: 100 }),
  valide: boolean('valide').default(false),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const lignesEcriture = pgTable('lignes_ecriture', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  ecritureId: integer('ecriture_id').references(() => ecritures.id).notNull(),
  compteComptableId: integer('compte_comptable_id').references(() => comptesComptables.id).notNull(),
  debit: decimal('debit', { precision: 15, scale: 2 }).default('0'),
  credit: decimal('credit', { precision: 15, scale: 2 }).default('0'),
  libelle: text('libelle'),
});

// ==========================================
// MODULE 3: DÉPENSES & NOTES DE FRAIS
// ==========================================

export const depenses = pgTable('depenses', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  employeId: integer('employe_id').references(() => users.id).notNull(),
  montant: decimal('montant', { precision: 15, scale: 2 }).notNull(),
  dateDepense: date('date_depense').notNull(),
  categorie: varchar('categorie', { length: 100 }),
  description: text('description'),
  justificatifUrl: text('justificatif_url'),
  statut: expenseStatusEnum('statut').default('brouillon'),
  montantApprouve: decimal('montant_approuve', { precision: 15, scale: 2 }),
  montantRembourse: decimal('montant_rembourse', { precision: 15, scale: 2 }).default('0'),
  approuvePar: integer('approuve_par').references(() => users.id),
  dateApprobation: timestamp('date_approbation'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ==========================================
// MODULE 8: IMMOBILISATIONS
// ==========================================

export const immobilisations = pgTable('immobilisations', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  nom: varchar('nom', { length: 255 }).notNull(),
  categorie: varchar('categorie', { length: 100 }),
  dateAcquisition: date('date_acquisition').notNull(),
  valeurAcquisition: decimal('valeur_acquisition', { precision: 15, scale: 2 }).notNull(),
  valeurResiduelle: decimal('valeur_residuelle', { precision: 15, scale: 2 }).default('0'),
  dureeAmortissement: integer('duree_amortissement').notNull(), // en mois
  methodeAmortissement: varchar('methode_amortissement', { length: 50 }).default('lineaire'), // linéaire, dégressif
  amortissementCumule: decimal('amortissement_cumule', { precision: 15, scale: 2 }).default('0'),
  valeurNette: decimal('valeur_nette', { precision: 15, scale: 2 }),
  actif: boolean('actif').default(true),
  dateCession: date('date_cession'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ==========================================
// MODULE 7: EMPLOYÉS (HR LITE)
// ==========================================

export const employes = pgTable('employes', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  userId: integer('user_id').references(() => users.id),
  matricule: varchar('matricule', { length: 50 }).unique(),
  nom: varchar('nom', { length: 100 }).notNull(),
  prenom: varchar('prenom', { length: 100 }).notNull(),
  poste: varchar('poste', { length: 100 }),
  departement: varchar('departement', { length: 100 }),
  salaire: decimal('salaire', { precision: 15, scale: 2 }),
  dateEmbauche: date('date_embauche'),
  telephone: varchar('telephone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  adresse: text('adresse'),
  actif: boolean('actif').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const avancesSalaire = pgTable('avances_salaire', {
  id: serial('id').primaryKey(),
  entrepriseId: integer('entreprise_id').references(() => entreprises.id).notNull(),
  employeId: integer('employe_id').references(() => employes.id).notNull(),
  montant: decimal('montant', { precision: 15, scale: 2 }).notNull(),
  dateAvance: date('date_avance').notNull(),
  montantRembourse: decimal('montant_rembourse', { precision: 15, scale: 2 }).default('0'),
  statut: varchar('statut', { length: 50 }).default('en_cours'), // en_cours, rembourse
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ==========================================
// RELATIONS
// ==========================================

export const entreprisesRelations = relations(entreprises, ({ many }) => ({
  users: many(users),
  clients: many(clients),
  fournisseurs: many(fournisseurs),
  produits: many(produits),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  entreprise: one(entreprises, {
    fields: [users.entrepriseId],
    references: [entreprises.id],
  }),
  commandes: many(commandes),
  factures: many(factures),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  entreprise: one(entreprises, {
    fields: [clients.entrepriseId],
    references: [entreprises.id],
  }),
  commandes: many(commandes),
  factures: many(factures),
}));

export const fournisseursRelations = relations(fournisseurs, ({ one, many }) => ({
  entreprise: one(entreprises, {
    fields: [fournisseurs.entrepriseId],
    references: [entreprises.id],
  }),
  produits: many(produits),
}));

export const produitsRelations = relations(produits, ({ one, many }) => ({
  entreprise: one(entreprises, {
    fields: [produits.entrepriseId],
    references: [entreprises.id],
  }),
  fournisseur: one(fournisseurs, {
    fields: [produits.fournisseurId],
    references: [fournisseurs.id],
  }),
  mouvements: many(mouvementsStock),
}));

export const commandesRelations = relations(commandes, ({ one, many }) => ({
  entreprise: one(entreprises, {
    fields: [commandes.entrepriseId],
    references: [entreprises.id],
  }),
  client: one(clients, {
    fields: [commandes.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [commandes.userId],
    references: [users.id],
  }),
  items: many(commandeItems),
  facture: many(factures),
}));

export const facturesRelations = relations(factures, ({ one, many }) => ({
  entreprise: one(entreprises, {
    fields: [factures.entrepriseId],
    references: [entreprises.id],
  }),
  client: one(clients, {
    fields: [factures.clientId],
    references: [clients.id],
  }),
  commande: one(commandes, {
    fields: [factures.commandeId],
    references: [commandes.id],
  }),
  items: many(factureItems),
  paiements: many(paiements),
}));
