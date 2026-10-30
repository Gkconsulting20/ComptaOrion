import React from 'react';
import './commercial-offers.css';

const BASE_FEATURES = [
  'Clients, devis, factures et règlements',
  'Fournisseurs, achats et échéances',
  'Trésorerie : banque, caisse et prévisions',
  'Gestion du stock, unités et conversions',
  'Comptabilité générale, journaux et états financiers',
  'Gestion des utilisateurs et des droits par module',
  'Tableau de bord de suivi'
];

const OFFERS = [
  {
    name: 'Base',
    audience: 'Pour démarrer avec une gestion centralisée',
    description: 'Les fonctions essentielles pour suivre l’activité et tenir les comptes.',
    features: BASE_FEATURES,
    accent: 'base'
  },
  {
    name: 'Standard',
    audience: 'Pour mieux maîtriser les achats et les marges',
    description: 'Le socle Base, complété par l’automatisation des factures et du coût de revient.',
    features: [
      ...BASE_FEATURES,
      'Lecture OCR des factures fournisseurs par photo (français)',
      'Coût moyen pondéré avec frais logistiques répartis selon le poids',
      'Catalogue de prix de vente calculé selon la marge définie'
    ],
    accent: 'standard',
    featured: true
  },
  {
    name: 'Premium',
    audience: 'Pour les organisations et activités par projet',
    description: 'Le socle Standard, avec un suivi approfondi des projets et des comptes.',
    features: [
      ...BASE_FEATURES,
      'Lecture OCR des factures fournisseurs par photo (français)',
      'Coût moyen pondéré avec frais logistiques répartis selon le poids',
      'Catalogue de prix de vente calculé selon la marge définie',
      'Comptabilité associative : budgets, financements et dépenses par projet',
      'Suivi des paiements partiels et du solde des projets',
      'Détail des montants des états financiers et accès aux opérations'
    ],
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
        </div>
        <span className="commercial-offers__status">Tarifs à confirmer</span>
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
            <div className="commercial-offer-card__price">Prix à définir</div>
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
          Les tarifs et les limites d’accès par forfait ne sont pas encore configurés dans l’inscription.
          Ne pas présenter la préparation fiscale comme un dépôt officiel.
        </span>
      </aside>
    </section>
  );
}
