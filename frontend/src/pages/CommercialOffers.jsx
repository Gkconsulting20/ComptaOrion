import React from 'react';
import './commercial-offers.css';

const CORE_FEATURES = [
  'Clients et fournisseurs avec identifiant unique et état de compte',
  'Devis, factures, règlements, échéances et escompte de règlement',
  'Retours et avoirs, notes de débit client et avoirs qualité fournisseur',
  'Commandes fournisseur, réceptions de stock et factures directes pour les services sans stock',
  'Trésorerie : banque, caisse, prévisions, réception et dépôt des chèques clients',
  'Stock, entrepôts, unités et conversions',
  'Dépenses : création, approbations manager puis comptable, remboursement sur le compte bancaire exact (521 virement / 571 espèces) ; aucune TVA déductible automatique',
  'TVA au taux de l’entreprise choisi à l’inscription (0 %, 18 % ou personnalisé), avec aperçu TVA sur les ventes',
  'Clôture et réouverture d’exercice, avec protection des périodes clôturées',
  'Import de fichiers compatibles',
  'Comptabilité générale, journaux, balance, grand livre et états financiers',
  'SYSCOHADA par défaut, avec plan comptable personnalisé facultatif',
  'Impôts : relevés TVA et brouillons de déclarations indicatifs, sans dépôt auprès de l’OTR ; aucun paiement d’impôt depuis le logiciel',
  'Gestion des utilisateurs et des droits par module',
  'Tableau de bord de suivi'
];

const OFFERS = [
  {
    name: 'Base',
    audience: 'Pour démarrer avec une gestion centralisée',
    description: 'Les fonctions essentielles pour suivre l’activité et tenir les comptes.',
    features: [
      ...CORE_FEATURES,
      'Coût de revient et prix de vente définis manuellement'
    ],
    monthlyPrice: '9 900,00 XOF',
    annualPrice: '99 000,00 XOF',
    accent: 'base'
  },
  {
    name: 'Standard',
    audience: 'Pour mieux maîtriser les achats et les marges',
    description: 'Le socle Base avec la lecture OCR des factures fournisseurs.',
    features: [
      ...CORE_FEATURES,
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
      ...CORE_FEATURES,
      'Lecture OCR des factures fournisseurs par photo (français)',
      'Coût moyen pondéré calculé depuis les réceptions, avec frais logistiques répartis selon le poids',
      'Prix de vente calculé depuis le coût réel reçu et la majoration choisie; aucun prix calculé avant réception',
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
          <p>Offre de lancement : 2 mois gratuits sur chaque nouvel abonnement payant — la facturation commence au 3e mois ; sur 12 mois, le client paie 10 mois. La commission du commercial n’est due qu’à partir du premier paiement du client.</p>
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
          Assistant IA est exclu de l’offre actuelle.
          Un utilisateur supplémentaire est proposé à 2 500,00 XOF par mois.
          Le calcul automatique du coût est contrôlé côté serveur pour Premium et l’essai. TVA : taux de l’entreprise
          choisi à l’inscription, aperçu sur les ventes, déclarations (brouillons) fonctionnelles. L’accès gratuit d’un
          comptable invité reste un avantage prévu, mais son parcours de connexion, notamment le lien WhatsApp,
          doit être validé avant de le présenter comme opérationnel. Ne pas présenter la préparation fiscale comme un dépôt officiel.
        </span>
      </aside>
    </section>
  );
}
