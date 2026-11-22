export const ACCOUNTING_ACCOUNT_ROLES = [
  { key: 'stock', label: 'Stock de marchandises', defaultNumber: '31' },
  { key: 'opening_stock_counterpart', label: 'Contrepartie du stock d’ouverture', defaultNumber: '101' },
  { key: 'supplier', label: 'Fournisseurs', defaultNumber: '401' },
  { key: 'supplier_pending', label: 'Factures fournisseurs non parvenues', defaultNumber: '408' },
  { key: 'customer', label: 'Clients', defaultNumber: '4111' },
  { key: 'checks_to_deposit', label: 'Chèques à encaisser', defaultNumber: '5112' },
  { key: 'purchase_returns', label: 'Retours et réductions sur achats', defaultNumber: '609' },
  { key: 'employee_advances', label: 'Avances au personnel', defaultNumber: '421' },
  { key: 'personnel_expenses', label: 'Charges de personnel', defaultNumber: '64' },
  { key: 'salary_payable', label: 'Rémunérations dues au personnel', defaultNumber: '421' },
  { key: 'social_contributions', label: 'Organismes sociaux (cotisations)', defaultNumber: '431' },
  { key: 'salary_advances', label: 'Avances sur salaires', defaultNumber: '422' },
  { key: 'vat_payable', label: 'TVA à payer', defaultNumber: '4434' },
  { key: 'tax_payable', label: 'Autres impôts et taxes à payer', defaultNumber: '44' },
  { key: 'bank', label: 'Banque', defaultNumber: '52' },
  { key: 'cash', label: 'Caisse', defaultNumber: '57' },
  { key: 'merchandise_purchases', label: 'Achats de marchandises', defaultNumber: '601' },
  { key: 'cost_of_goods_sold', label: 'Coût des marchandises vendues', defaultNumber: '603' },
  { key: 'price_variances', label: 'Écarts de prix sur achats', defaultNumber: '603' },
  { key: 'service_purchases', label: 'Achats de services et transport', defaultNumber: '61' },
  { key: 'external_expenses', label: 'Autres charges externes', defaultNumber: '62' },
  { key: 'sales', label: 'Ventes', defaultNumber: '701' },
  { key: 'vat_deductible', label: 'TVA déductible', defaultNumber: '445' },
  { key: 'vat_collected', label: 'TVA collectée', defaultNumber: '443' },
  { key: 'cash_discount_granted', label: 'Escomptes accordés', defaultNumber: '673' },
  { key: 'cash_discount_received', label: 'Escomptes obtenus', defaultNumber: '773' },
  { key: 'sales_returns', label: 'Retours et réductions sur ventes', defaultNumber: '709' },
];

export const PRICE_VARIANCE_ACCOUNT_TYPES = ['charge', 'charges', 'produit', 'produits'];
const PRICE_VARIANCE_ACCOUNT_TYPE_SET = new Set([
  ...PRICE_VARIANCE_ACCOUNT_TYPES,
  'expense',
  'expenses',
  'income',
  'revenue',
  'revenues',
]);

export function isPriceVarianceAccount(account) {
  const type = String(account?.type || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
  const category = String(account?.categorie || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
  const number = String(account?.numero || '').trim();
  if (PRICE_VARIANCE_ACCOUNT_TYPE_SET.has(type) || /^[67]/.test(number)) return true;
  return ['charge', 'charges', 'produit', 'produits', 'resultat', 'results'].includes(category)
    && !/^[89]/.test(number);
}

export const ACCOUNTING_ACCOUNT_ROLE_BY_KEY = new Map(
  ACCOUNTING_ACCOUNT_ROLES.map((role) => [role.key, role]),
);
