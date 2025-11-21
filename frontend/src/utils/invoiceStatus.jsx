import React from 'react';

/**
 * Utilitaire centralisé pour gérer l'affichage des statuts de factures
 * 
 * Statuts possibles (backend/src/schema.js):
 * - invoiceStatusEnum: ['brouillon', 'envoyee', 'payee', 'annulee', 'retard']
 * - Statut spécifique fournisseurs: 'partiellement_payee'
 */

export const INVOICE_STATUS_CONFIG = {
  brouillon: {
    label: '📝 Brouillon',
    bg: '#e9ecef',
    color: '#495057'
  },
  envoyee: {
    label: '📤 Envoyée',
    bg: '#fff3cd',
    color: '#856404'
  },
  payee: {
    label: '✅ Payée',
    bg: '#d4edda',
    color: '#155724'
  },
  partiellement_payee: {
    label: '💰 Partiellement payée',
    bg: '#fff3cd',
    color: '#856404'
  },
  annulee: {
    label: '❌ Annulée',
    bg: '#f8d7da',
    color: '#721c24'
  },
  retard: {
    label: '⏰ En retard',
    bg: '#f8d7da',
    color: '#721c24'
  },
  // Statuts legacy possibles (pour compatibilité)
  validee: {
    label: '✓ Validée',
    bg: '#d1ecf1',
    color: '#0c5460'
  },
  en_attente: {
    label: '⏳ En attente',
    bg: '#fff3cd',
    color: '#856404'
  }
};

/**
 * Retourne la configuration d'affichage pour un statut de facture
 * @param {string} statut - Le statut de la facture
 * @param {number|string} montantPaye - Le montant déjà payé (optionnel, pour détection intelligente)
 * @param {number|string} montantTTC - Le montant total TTC (optionnel)
 * @returns {object} Configuration avec label, bg (backgroundColor), color
 */
export function getInvoiceStatusDisplay(statut, montantPaye = 0, montantTTC = 0) {
  // Si le statut existe directement dans la config, le retourner
  if (INVOICE_STATUS_CONFIG[statut]) {
    return INVOICE_STATUS_CONFIG[statut];
  }

  // Fallback: afficher le statut brut avec un style par défaut
  return {
    label: statut || 'Inconnu',
    bg: '#e9ecef',
    color: '#495057'
  };
}

/**
 * Composant React pour afficher un badge de statut
 * @param {object} props - Props du composant
 * @param {string} props.statut - Le statut de la facture
 * @param {number|string} props.montantPaye - Montant payé (optionnel)
 * @param {number|string} props.montantTTC - Montant total TTC (optionnel)
 * @param {object} props.style - Styles additionnels (optionnel)
 * @returns {JSX.Element} Badge de statut
 */
export function InvoiceStatusBadge({ statut, montantPaye, montantTTC, style = {} }) {
  const display = getInvoiceStatusDisplay(statut, montantPaye, montantTTC);
  
  return (
    <span style={{
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '12px',
      backgroundColor: display.bg,
      color: display.color,
      fontWeight: '500',
      ...style
    }}>
      {display.label}
    </span>
  );
}
