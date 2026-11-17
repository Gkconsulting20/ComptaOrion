// Keep document numbers and product references unique within an organisation,
// not across unrelated customers. Run inside the schema upgrade transaction.
export const PURCHASE_NUMBERING_STATEMENTS = [
  ['commandes_achat', 'numero_commande', 'numero'],
  ['factures_achat', 'numero_facture', 'numero'],
  ['bons_reception', 'numero', 'numero'],
  ['produits', 'reference', 'reference'],
  // Legacy databases may retain the old global constraint even though the
  // current schema already declares a company-scoped accounting index.
  ['ecritures', 'numero_ecriture', 'numero'],
].flatMap(([table, column, label]) => [
  // Establish the replacement before relaxing the old constraint. No row or
  // document number is changed and same-company duplicates remain forbidden.
  `CREATE UNIQUE INDEX IF NOT EXISTS "${table}_entreprise_${label}_unique" ON "${table}" ("entreprise_id", "${column}")`,
  `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${table}_${column}_unique"`,
]);
