import React from 'react';
import './commercial-offers.css';

const BASE_FEATURES = [
  'Clients, devis, factures et règlements',
  'Fournisseurs, achats et échéances',
  'Trésorerie : banque, caisse et prévisions',
  'Gestion du stock, unités et conversions',
  'Saisie des factures fournisseur',
  'Comptabilité générale, journaux et états financiers',
  'Gestion des utilisateurs et des droits par module',
  'Invitation gratuite d’un comptable externe (1 compte par entreprise, hors quota des 3 utilisateurs)',
  'Tableau de bord de suivi'
];

const OFFERS = [
  {
    name: 'Base',
    audience: 'Pour démarrer avec une gestion centralisée',
    description: 'Les fonctions essentielles pour suivre l’activité et tenir les comptes.',
    features: [
      ...BASE_FEATURES,
      'Coût de revient et prix de vente définis manuellement'
    ],
    monthlyPrice: '9 900,00 XOF',
    annualPrice: '99 000,00 XOF',
    accent: 'base'
  },
  {
    name: 'Standard',
    audience: 'Pour mieux maîtriser les achats et les marges',
    description: 'Le socle Base avec une gestion manuelle des coûts et prix produits.',
    features: [
      ...BASE_FEATURES,
      'Coût de revient et prix de vente définis manuellement',
      'Lecture OCR des factures fournisseurs par photo (français)'
    ],
    monthlyPrice: '17 900,00 XOF',
    annualPrice: '179 000,00 XOF',
    accent: 'standard',
    featured: true
  },
  {
    name: 'Premium',
    audience: 'Pour les organisations et activités par projet',
    description: 'Le socle Standard, avec le calcul automatique du coût réel et du prix de vente.',
    features: [
      ...BASE_FEATURES,
      'Lecture OCR des factures fournisseurs par photo (français)',
      'Coût moyen pondéré avec frais logistiques répartis selon le poids',
      'Catalogue de prix de vente calculé selon la marge définie',
      'Prix de vente calculé depuis le coût réel et la marge choisie',
      'Comptabilité associative : budgets, financements et dépenses par projet',
      'Suivi des paiements partiels et du solde des projets',
      'Détail des montants des états financiers et accès aux opérations'
    ],
    monthlyPrice: '29 900,00 XOF',
    annualPrice: '299 000,00 XOF',
    accent: 'premium'
  }
];

export default function CommercialOffers() {
  return (
    <section className="commercial-offers" aria-labelledby="commercial-offers-title">
      <div className="commercial-offers__heading">
        <div>
          <span className="commercial-offers__eyebrow">OFFRE COMMERCIALE</span>
          <h2 id="commercial-offers-title">Les forfaits ComptaOrion</h2>
          <p>Une gestion comptable et opérationnelle adaptée à la taille de l’activité.</p>
          <p>Essai gratuit de 30 jours avec accès au calcul automatique Premium pour évaluer le logiciel.</p>
        </div>
        <span className="commercial-offers__status">Tarifs proposés</span>
      </div>

      <div className="commercial-offers__grid">
        {OFFERS.map((offer) => (
          <article
            className={`commercial-offer-card commercial-offer-card--${offer.accent}${offer.featured ? ' is-featured' : ''}`}
            key={offer.name}
          >
            {offer.featured && <span className="commercial-offer-card__badge">Le plus complet au quotidien</span>}
            <h3>{offer.name}</h3>
            <p className="commercial-offer-card__audience">{offer.audience}</p>
            <p className="commercial-offer-card__description">{offer.description}</p>
            <div className="commercial-offer-card__price">
              <div className="commercial-offer-card__monthly">
                <strong>{offer.monthlyPrice}</strong>
                <span>/ mois</span>
              </div>
              <small>Par entreprise · 3 utilisateurs inclus</small>
              <div className="commercial-offer-card__annual">
                {offer.annualPrice} / an · 2 mois offerts
              </div>
            </div>
            <h4>Fonctionnalités incluses</h4>
            <ul>
              {offer.features.map((feature) => (
                <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <aside className="commercial-offers__internal-note">
        <strong>Repères pour l’équipe commerciale</strong>
        <span>
          Paie &amp; RH, Assistant IA et Immobilisations sont exclus de l’offre actuelle.
          Un utilisateur supplémentaire est proposé à 2 500,00 XOF par mois.
          Le traitement HT/TTC doit être confirmé avant facturation. Les limites par forfait et la facturation
          automatique ne sont pas encore appliquées dans le parcours d’inscription.
          Ne pas présenter la préparation fiscale comme un dépôt officiel.
        </span>
      </aside>
    </section>
  );
}
