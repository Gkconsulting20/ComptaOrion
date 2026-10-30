import React, { useState } from 'react';

const DEMO_SECTIONS = [
  { id: 'dashboard', label: 'Vue d’ensemble', icon: '▦' },
  { id: 'clients', label: 'Clients & factures', icon: '♙' },
  { id: 'fournisseurs', label: 'Fournisseurs & achats', icon: '⇄' },
  { id: 'tresorerie', label: 'Trésorerie', icon: '◉' },
  { id: 'stock', label: 'Stock', icon: '▣' },
  { id: 'comptabilite', label: 'Comptabilité', icon: '▤' },
  { id: 'associations', label: 'Comptabilité associations', icon: '◇' },
  { id: 'impots', label: 'Impôts', icon: '▧' },
  { id: 'integrations', label: 'Intégrations', icon: '↗' },
  { id: 'security', label: 'Sécurité', icon: '⬡' },
  { id: 'settings', label: 'Paramètres', icon: '⚙' }
];

const DEMO_SALES = [
  { month: 'Mai', value: 1.9 },
  { month: 'Juin', value: 2.5 },
  { month: 'Juil.', value: 2.2 },
  { month: 'Août', value: 2.8 },
  { month: 'Sept.', value: 3.1 },
  { month: 'Oct.', value: 2.8 }
];

const DEMO_CLIENTS = [
  { name: 'Coopérative Agri-Sud', city: 'Kpalimé', balance: '325 000', status: 'À relancer' },
  { name: 'Ferme des Plateaux', city: 'Atakpamé', balance: '180 000', status: 'En règle' },
  { name: 'Établissements Améyo', city: 'Lomé', balance: '95 000', status: 'En règle' }
];

const DEMO_INVOICES = [
  { reference: 'FV-2026-018', client: 'Coopérative Agri-Sud', date: '12 oct. 2026', amount: '425 000', status: 'Payée' },
  { reference: 'FV-2026-021', client: 'Ferme des Plateaux', date: '18 oct. 2026', amount: '180 000', status: 'Partiellement payée' },
  { reference: 'FV-2026-024', client: 'Établissements Améyo', date: '21 oct. 2026', amount: '95 000', status: 'À payer' }
];

const DEMO_SUPPLIERS = [
  { name: 'AgroParts Import', country: 'Chine', due: '1 850 000', term: 'Échéance dans 62 jours' },
  { name: 'Transport Horizon', country: 'Togo', due: '240 000', term: 'Échéance dans 14 jours' },
  { name: 'Emballages du Golfe', country: 'Togo', due: '85 000', term: 'Payé' }
];

const DEMO_CASH_MOVEMENTS = [
  { date: '21 oct. 2026', label: 'Encaissement FV-2026-018', account: 'Banque principale', amount: '+425 000' },
  { date: '20 oct. 2026', label: 'Loyer boutique', account: 'Banque principale', amount: '−180 000' },
  { date: '18 oct. 2026', label: 'Vente comptoir', account: 'Caisse', amount: '+95 000' }
];

const DEMO_ENTRIES = [
  { date: '21 oct. 2026', journal: 'Ventes', number: 'VE-2026-00000018', label: 'Facture FV-2026-018', debit: '425 000', credit: '425 000' },
  { date: '20 oct. 2026', journal: 'Achats', number: 'AC-2026-000023', label: 'Réception marchandises', debit: '750 000', credit: '750 000' },
  { date: '20 oct. 2026', journal: 'Banque', number: 'BQ-2026-000041', label: 'Paiement du loyer', debit: '180 000', credit: '180 000' }
];

const DEMO_ASSOCIATION_PROJECTS = [
  { name: 'Jardin scolaire de Kévé', funder: 'Fonds de solidarité agricole', budget: '3 000 000', spent: '1 250 000', remaining: '1 750 000' },
  { name: 'Formation des coopératives', funder: 'Programme local de développement', budget: '1 800 000', spent: '740 000', remaining: '1 060 000' }
];

const DEMO_INTEGRATIONS = [
  { name: 'Paiements en ligne', detail: 'Traitement des encaissements', status: 'Exemple fictif' },
  { name: 'Notifications e-mail', detail: 'Envoi de factures et rappels', status: 'Exemple fictif' },
  { name: 'Documents et pièces', detail: 'Stockage privé des justificatifs', status: 'Exemple fictif' }
];

const DEMO_USERS = [
  { name: 'Administrateur', scope: 'Gestion des accès et paramètres' },
  { name: 'Comptable', scope: 'Journaux, écritures et états' },
  { name: 'Commercial', scope: 'Clients, devis et factures' }
];

const DEMO_SETTINGS = [
  { label: 'Entreprise', value: 'AgroNova Démo' },
  { label: 'Devise principale', value: 'XOF' },
  { label: 'Unité de stock illustrée', value: 'Kilogramme (kg)' },
  { label: 'Période comptable', value: 'Exercice annuel' }
];

const DEMO_PRODUCTS = [
  { name: 'Motoculteur 12 CV', sku: 'AGR-012', quantity: '4 unités', cost: '410 000', price: '533 000' },
  { name: 'Pompe d’irrigation', sku: 'IRR-040', quantity: '18 unités', cost: '62 500', price: '81 250' },
  { name: 'Kit goutte-à-goutte', sku: 'KIT-115', quantity: '32 unités', cost: '18 000', price: '23 400' }
];

function formatAmount(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('fr-FR')} XOF`;
}

function DemoPanel({ section }) {
  if (section === 'clients') {
    return (
      <>
        <section className="prospect-demo-panel">
          <div className="prospect-demo-section-heading">
            <div><span className="prospect-demo-eyebrow">RELATIONS CLIENTS</span><h2>Suivi des clients</h2></div>
            <span className="prospect-demo-count">3 exemples</span>
          </div>
          <div className="prospect-demo-table-wrap">
            <table className="prospect-demo-table">
              <thead><tr><th>Client</th><th>Ville</th><th>Solde dû</th><th>Situation</th></tr></thead>
              <tbody>{DEMO_CLIENTS.map((client) => (
                <tr key={client.name}>
                  <td><strong>{client.name}</strong></td><td>{client.city}</td>
                  <td>{client.balance} XOF</td>
                  <td><span className={`prospect-demo-status${client.status === 'À relancer' ? ' is-warning' : ''}`}>{client.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
        <section className="prospect-demo-panel">
          <div className="prospect-demo-section-heading">
            <div><span className="prospect-demo-eyebrow">VENTES</span><h2>Factures clients</h2></div>
            <span className="prospect-demo-count">3 exemples</span>
          </div>
          <div className="prospect-demo-table-wrap">
            <table className="prospect-demo-table">
              <thead><tr><th>Référence</th><th>Client</th><th>Date</th><th>Montant</th><th>Statut</th></tr></thead>
              <tbody>{DEMO_INVOICES.map((invoice) => (
                <tr key={invoice.reference}>
                  <td><strong>{invoice.reference}</strong></td><td>{invoice.client}</td><td>{invoice.date}</td>
                  <td>{invoice.amount} XOF</td>
                  <td><span className={`prospect-demo-status${invoice.status === 'À payer' ? ' is-warning' : ''}`}>{invoice.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="prospect-demo-note">Les factures, devis, paiements et soldes clients sont regroupés dans le module Clients.</p>
        </section>
      </>
    );
  }

  if (section === 'fournisseurs') {
    return (
      <section className="prospect-demo-panel">
        <div className="prospect-demo-section-heading">
          <div><span className="prospect-demo-eyebrow">ACHATS & ÉCHÉANCES</span><h2>Fournisseurs</h2></div>
          <span className="prospect-demo-count">3 exemples</span>
        </div>
        <div className="prospect-demo-list">
          {DEMO_SUPPLIERS.map((supplier) => (
            <article className="prospect-demo-list-row" key={supplier.name}>
              <div><strong>{supplier.name}</strong><span>{supplier.country} · {supplier.term}</span></div>
              <b>{supplier.due} XOF</b>
            </article>
          ))}
        </div>
        <p className="prospect-demo-note">Les factures fournisseurs, paiements et échéances peuvent être rapprochés de la comptabilité.</p>
      </section>
    );
  }

  if (section === 'stock') {
    return (
      <section className="prospect-demo-panel">
        <div className="prospect-demo-section-heading">
          <div><span className="prospect-demo-eyebrow">INVENTAIRE</span><h2>Articles et prix de vente</h2></div>
          <span className="prospect-demo-count">3 articles</span>
        </div>
        <div className="prospect-demo-table-wrap">
          <table className="prospect-demo-table">
            <thead><tr><th>Article</th><th>Référence</th><th>Stock</th><th>CMV</th><th>Prix indicatif</th></tr></thead>
            <tbody>{DEMO_PRODUCTS.map((product) => (
              <tr key={product.sku}>
                <td><strong>{product.name}</strong></td><td>{product.sku}</td><td>{product.quantity}</td>
                <td>{product.cost} XOF</td><td>{product.price} XOF</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="prospect-demo-note">Prix d’exemple calculés avec une marge de démonstration de 30 % du coût de revient.</p>
      </section>
    );
  }

  if (section === 'tresorerie') {
    return (
      <>
        <section className="prospect-demo-kpis" aria-label="Indicateurs de trésorerie fictifs">
          {[
            { label: 'Banque principale', value: 1_430_000, detail: 'solde disponible', color: 'blue', icon: '▣' },
            { label: 'Caisse', value: 120_000, detail: 'solde disponible', color: 'green', icon: '◉' },
            { label: 'Encaissements du mois', value: 890_000, detail: 'paiements reçus', color: 'purple', icon: '↗' },
            { label: 'Décaissements du mois', value: 540_000, detail: 'paiements effectués', color: 'orange', icon: '↘' }
          ].map((card) => (
            <article className={`prospect-demo-kpi is-${card.color}`} key={card.label}>
              <div className="prospect-demo-kpi-top"><span>{card.label}</span><i aria-hidden="true">{card.icon}</i></div>
              <strong>{formatAmount(card.value)}</strong><small>{card.detail}</small>
            </article>
          ))}
        </section>
        <section className="prospect-demo-panel">
          <div className="prospect-demo-section-heading">
            <div><span className="prospect-demo-eyebrow">MOUVEMENTS</span><h2>Dernières opérations de trésorerie</h2></div>
            <span className="prospect-demo-count">Exemples fictifs</span>
          </div>
          <div className="prospect-demo-table-wrap">
            <table className="prospect-demo-table">
              <thead><tr><th>Date</th><th>Libellé</th><th>Compte</th><th>Montant</th></tr></thead>
              <tbody>{DEMO_CASH_MOVEMENTS.map((movement) => (
                <tr key={movement.label}>
                  <td>{movement.date}</td><td><strong>{movement.label}</strong></td>
                  <td>{movement.account}</td><td>{movement.amount} XOF</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="prospect-demo-note">Suivi des comptes bancaires et de caisse, des encaissements, des paiements et des rapprochements.</p>
        </section>
      </>
    );
  }

  if (section === 'comptabilite') {
    return (
      <>
        <section className="prospect-demo-kpis" aria-label="Indicateurs comptables fictifs">
          {[
            { label: 'Écritures validées', value: '128', detail: 'sur la période', color: 'blue', icon: '▤', raw: true },
            { label: 'Débits', value: 1_355_000, detail: 'journaux confondus', color: 'green', icon: '↘' },
            { label: 'Crédits', value: 1_355_000, detail: 'journaux confondus', color: 'purple', icon: '↗' },
            { label: 'Écart de balance', value: 0, detail: 'débits = crédits', color: 'orange', icon: '✓' }
          ].map((card) => (
            <article className={`prospect-demo-kpi is-${card.color}`} key={card.label}>
              <div className="prospect-demo-kpi-top"><span>{card.label}</span><i aria-hidden="true">{card.icon}</i></div>
              <strong>{card.raw ? card.value : formatAmount(card.value)}</strong><small>{card.detail}</small>
            </article>
          ))}
        </section>
        <section className="prospect-demo-panel">
          <div className="prospect-demo-section-heading">
            <div><span className="prospect-demo-eyebrow">JOURNAUX & ÉCRITURES</span><h2>Opérations comptables</h2></div>
            <span className="prospect-demo-count">Exemples équilibrés</span>
          </div>
          <div className="prospect-demo-table-wrap">
            <table className="prospect-demo-table">
              <thead><tr><th>Date</th><th>Journal</th><th>N° d’écriture</th><th>Libellé</th><th>Débit</th><th>Crédit</th></tr></thead>
              <tbody>{DEMO_ENTRIES.map((entry) => (
                <tr key={entry.number}>
                  <td>{entry.date}</td><td>{entry.journal}</td><td><strong>{entry.number}</strong></td>
                  <td>{entry.label}</td><td>{entry.debit} XOF</td><td>{entry.credit} XOF</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="prospect-demo-note">La comptabilité centralise les écritures et permet de consulter les journaux, la balance et les états financiers. La piste d’audit conserve les modifications importantes.</p>
        </section>
      </>
    );
  }

  if (section === 'associations') {
    return (
      <>
        <section className="prospect-demo-panel">
          <div className="prospect-demo-section-heading">
            <div><span className="prospect-demo-eyebrow">SUIVI PAR PROJET</span><h2>Comptabilité des associations</h2></div>
            <span className="prospect-demo-count">2 projets fictifs</span>
          </div>
          <div className="prospect-demo-table-wrap">
            <table className="prospect-demo-table">
              <thead><tr><th>Projet</th><th>Financement</th><th>Budget</th><th>Dépenses</th><th>Disponible</th></tr></thead>
              <tbody>{DEMO_ASSOCIATION_PROJECTS.map((project) => (
                <tr key={project.name}>
                  <td><strong>{project.name}</strong></td><td>{project.funder}</td>
                  <td>{project.budget} XOF</td><td>{project.spent} XOF</td><td>{project.remaining} XOF</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
        <div className="prospect-demo-lower-grid">
          <section className="prospect-demo-panel">
            <div className="prospect-demo-section-heading">
              <div><span className="prospect-demo-eyebrow">CONTRÔLE BUDGÉTAIRE</span><h2>Suivi des fonds</h2></div>
            </div>
            <div className="prospect-demo-summary-row"><span>Financements reçus</span><strong>4 800 000 XOF</strong></div>
            <div className="prospect-demo-summary-row"><span>Dépenses affectées aux projets</span><strong>1 990 000 XOF</strong></div>
            <div className="prospect-demo-summary-row"><span>Solde des financements</span><strong>2 810 000 XOF</strong></div>
          </section>
          <section className="prospect-demo-panel">
            <div className="prospect-demo-section-heading">
              <div><span className="prospect-demo-eyebrow">COMPTABILITÉ</span><h2>Traçabilité</h2></div>
            </div>
            <p className="prospect-demo-note">Les recettes et dépenses d’un projet peuvent être suivies avec leur budget, leur financement et leurs justificatifs. Ces exemples ne sont pas reliés à une association réelle.</p>
          </section>
        </div>
      </>
    );
  }

  if (section === 'integrations') {
    return (
      <section className="prospect-demo-panel">
        <div className="prospect-demo-section-heading">
          <div><span className="prospect-demo-eyebrow">CONNEXIONS</span><h2>Intégrations disponibles</h2></div>
          <span className="prospect-demo-badge">Accès administrateur</span>
        </div>
        <div className="prospect-demo-list">
          {DEMO_INTEGRATIONS.map((integration) => (
            <article className="prospect-demo-list-row" key={integration.name}>
              <div><strong>{integration.name}</strong><span>{integration.detail}</span></div>
              <b>{integration.status}</b>
            </article>
          ))}
        </div>
        <p className="prospect-demo-note">Cette page montre des exemples d’intégrations. Aucune connexion réelle n’est activée depuis la démo publique.</p>
      </section>
    );
  }

  if (section === 'security') {
    return (
      <section className="prospect-demo-panel">
        <div className="prospect-demo-section-heading">
          <div><span className="prospect-demo-eyebrow">ACCÈS & TRAÇABILITÉ</span><h2>Rôles des utilisateurs</h2></div>
          <span className="prospect-demo-badge">Accès administrateur</span>
        </div>
        <div className="prospect-demo-list">
          {DEMO_USERS.map((user) => (
            <article className="prospect-demo-list-row" key={user.name}>
              <div><strong>{user.name}</strong><span>{user.scope}</span></div>
              <b>Accès limité par rôle</b>
            </article>
          ))}
        </div>
        <p className="prospect-demo-note">Les exemples illustrent une séparation des rôles et une piste d’audit. Ils ne correspondent pas à des comptes réels.</p>
      </section>
    );
  }

  if (section === 'settings') {
    return (
      <section className="prospect-demo-panel">
        <div className="prospect-demo-section-heading">
          <div><span className="prospect-demo-eyebrow">CONFIGURATION</span><h2>Paramètres de l’entreprise</h2></div>
          <span className="prospect-demo-badge">Données fictives</span>
        </div>
        <div className="prospect-demo-list">
          {DEMO_SETTINGS.map((setting) => (
            <article className="prospect-demo-list-row" key={setting.label}>
              <div><strong>{setting.label}</strong></div><b>{setting.value}</b>
            </article>
          ))}
        </div>
        <p className="prospect-demo-note">Les paramètres réels sont propres à chaque entreprise et ne sont pas modifiables dans cette démonstration.</p>
      </section>
    );
  }

  if (section === 'impots') {
    return (
      <section className="prospect-demo-panel">
        <div className="prospect-demo-section-heading">
          <div><span className="prospect-demo-eyebrow">SUIVI FISCAL</span><h2>Suivi des taxes</h2></div>
          <span className="prospect-demo-badge">Exemple uniquement</span>
        </div>
        <div className="prospect-demo-tax-grid">
          <article><span>TVA facturée</span><strong>486 000 XOF</strong><small>Exemple fictif sur la période</small></article>
          <article><span>TVA récupérable</span><strong>201 500 XOF</strong><small>Exemple fictif sur la période</small></article>
          <article><span>Solde indicatif</span><strong>284 500 XOF</strong><small>À contrôler avant toute déclaration</small></article>
        </div>
        <p className="prospect-demo-note">Les chiffres sont fictifs et ne constituent pas une déclaration fiscale validée ou transmise à l’OTR.</p>
      </section>
    );
  }

  return (
    <>
      <section className="prospect-demo-kpis" aria-label="Indicateurs de démonstration">
        {[
          { label: 'Ventes', value: 2_840_000, detail: 'sur la période', color: 'green', icon: '↗' },
          { label: 'Dépenses comptabilisées', value: 1_975_000, detail: 'charges enregistrées', color: 'orange', icon: '↘' },
          { label: 'Marge brute', value: 865_000, detail: '30,5 % des ventes', color: 'blue', icon: '◫' },
          { label: 'Trésorerie', value: 1_430_000, detail: 'banque et caisse', color: 'purple', icon: '◉' }
        ].map((card) => (
          <article className={`prospect-demo-kpi is-${card.color}`} key={card.label}>
            <div className="prospect-demo-kpi-top"><span>{card.label}</span><i aria-hidden="true">{card.icon}</i></div>
            <strong>{formatAmount(card.value)}</strong>
            <small>{card.detail}</small>
          </article>
        ))}
      </section>

      <div className="prospect-demo-lower-grid">
        <section className="prospect-demo-panel">
          <div className="prospect-demo-section-heading">
            <div><span className="prospect-demo-eyebrow">ACTIVITÉ</span><h2>Ventes mensuelles</h2></div>
            <span className="prospect-demo-period">Mai – Oct. 2026</span>
          </div>
          <div className="prospect-demo-bars" aria-label="Graphique fictif des ventes">
            {DEMO_SALES.map((month) => (
              <div className="prospect-demo-bar-column" key={month.month}>
                <span>{month.value.toFixed(1)} M</span>
                <div><i style={{ height: `${(month.value / 3.2) * 100}%` }} /></div>
                <small>{month.month}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="prospect-demo-panel prospect-demo-summary">
          <div className="prospect-demo-section-heading">
            <div><span className="prospect-demo-eyebrow">À SUIVRE</span><h2>Points d’attention</h2></div>
          </div>
          <div className="prospect-demo-summary-row"><span>Factures clients ouvertes</span><strong>4</strong></div>
          <div className="prospect-demo-summary-row"><span>Dettes fournisseurs</span><strong>2 175 000 XOF</strong></div>
          <div className="prospect-demo-summary-row"><span>Produits à réapprovisionner</span><strong>2</strong></div>
          <p className="prospect-demo-note">Ces chiffres sont fictifs et servent uniquement à présenter l’interface.</p>
        </section>
      </div>
    </>
  );
}

export function ProspectDemo() {
  const [section, setSection] = useState('dashboard');
  const activeSection = DEMO_SECTIONS.find((item) => item.id === section);
  const sectionDescriptions = {
    dashboard: 'Vue synthétique des indicateurs de l’entreprise.',
    clients: 'Clients, devis, factures et règlements.',
    fournisseurs: 'Achats, dettes fournisseurs et échéances.',
    tresorerie: 'Comptes de banque et de caisse et mouvements.',
    stock: 'Articles, quantités, coût de revient et prix de vente.',
    comptabilite: 'Journaux, écritures comptables et contrôles.',
    associations: 'Budgets, financements et dépenses par projet.',
    impots: 'Suivi indicatif des taxes et de la TVA.',
    integrations: 'Connexions facultatives accessibles aux administrateurs.',
    security: 'Gestion des rôles et traçabilité des opérations.',
    settings: 'Paramètres comptables et informations de l’entreprise.'
  };

  return (
    <div className="prospect-demo">
      <style>{`
        * { box-sizing: border-box; }
        .prospect-demo { min-height: 100vh; background:#f4f7f8; color:#263747; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
        .prospect-demo-shell { min-height:100vh; display:grid; grid-template-columns:238px minmax(0,1fr); }
        .prospect-demo-sidebar { background:#263b4d; color:#fff; display:flex; flex-direction:column; padding:24px 14px; }
        .prospect-demo-brand { display:flex; gap:12px; align-items:center; padding:4px 10px 24px; border-bottom:1px solid rgba(255,255,255,.14); margin-bottom:24px; }
        .prospect-demo-mark { width:42px; height:42px; border-radius:10px; background:#fff; object-fit:contain; padding:3px; border:1px solid rgba(255,255,255,.3); flex:0 0 auto; }
        .prospect-demo-brand strong { display:block; font-size:15px; letter-spacing:.01em; }
        .prospect-demo-brand small { display:block; color:#b5c5cf; margin-top:4px; font-size:11px; }
        .prospect-demo-nav-label { padding:4px 10px 8px; color:#91a6b4; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
        .prospect-demo-nav-list { display:flex; flex-direction:column; }
        .prospect-demo-nav { border:0; background:transparent; color:#dce7ed; padding:11px 10px; margin:2px 0; border-radius:9px; text-align:left; display:flex; align-items:center; gap:12px; cursor:pointer; font:inherit; font-size:13px; }
        .prospect-demo-nav:hover,.prospect-demo-nav.is-active { color:#fff; background:#36566e; }
        .prospect-demo-nav.is-active { box-shadow:inset 3px 0 #6fd0b4; }
        .prospect-demo-nav-icon { width:19px; font-size:17px; text-align:center; color:#acd0d7; }
        .prospect-demo-mobile-nav-hint { display:none; }
        .prospect-demo-side-foot { margin-top:auto; padding:14px 10px 0; color:#b5c5cf; border-top:1px solid rgba(255,255,255,.14); font-size:11px; line-height:1.5; }
        .prospect-demo-main { min-width:0; }
        .prospect-demo-topbar { min-height:70px; display:flex; justify-content:space-between; align-items:center; gap:20px; padding:12px 32px; background:#fff; border-bottom:1px solid #e2e8eb; }
        .prospect-demo-top-title { display:flex; align-items:center; gap:12px; color:#263747; font-weight:700; }
        .prospect-demo-company { border:1px solid #e1e7e9; background:#f7fafb; color:#5f6e78; padding:5px 10px; border-radius:7px; font-size:11px; font-weight:600; }
        .prospect-demo-top-actions { display:flex; align-items:center; gap:14px; color:#62727d; font-size:12px; }
        .prospect-demo-top-actions a { text-decoration:none; background:#225d74; color:#fff; font-weight:700; padding:10px 13px; border-radius:8px; white-space:nowrap; }
        .prospect-demo-content { max-width:1420px; margin:0 auto; padding:28px 32px 40px; }
        .prospect-demo-banner { display:flex; align-items:flex-start; gap:12px; padding:13px 16px; border-radius:10px; border:1px solid #e5d8aa; background:#fff9e9; color:#6a5822; font-size:12px; line-height:1.5; margin-bottom:25px; }
        .prospect-demo-banner strong { display:block; margin-bottom:2px; }
        .prospect-demo-heading { display:flex; justify-content:space-between; align-items:flex-end; gap:18px; margin-bottom:20px; }
        .prospect-demo-eyebrow { color:#75858f; font-size:10px; letter-spacing:.1em; font-weight:800; }
        .prospect-demo-heading h1 { margin:5px 0 5px; font-size:25px; letter-spacing:-.03em; color:#233847; }
        .prospect-demo-heading p { margin:0; color:#75858f; font-size:13px; }
        .prospect-demo-readonly { color:#426a62; background:#e9f5f1; border:1px solid #d3e9e1; padding:8px 11px; border-radius:20px; font-size:11px; font-weight:700; white-space:nowrap; }
        .prospect-demo-kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:13px; margin-bottom:15px; }
        .prospect-demo-kpi,.prospect-demo-panel { background:#fff; border:1px solid #e2e8eb; border-radius:12px; box-shadow:0 3px 12px rgba(26,52,67,.035); }
        .prospect-demo-kpi { padding:17px; border-top:3px solid #4a9380; }
        .prospect-demo-kpi.is-orange { border-top-color:#e49a46; }.prospect-demo-kpi.is-blue { border-top-color:#4d8eb2; }.prospect-demo-kpi.is-purple { border-top-color:#816bb1; }
        .prospect-demo-kpi-top { display:flex; justify-content:space-between; align-items:center; color:#6c7a84; font-size:12px; }
        .prospect-demo-kpi-top i { font-style:normal; color:#4d8290; font-size:17px; background:#eff5f5; border-radius:8px; width:30px;height:30px;display:grid;place-items:center; }
        .prospect-demo-kpi strong { display:block; margin:13px 0 5px; font-size:20px; letter-spacing:-.03em; color:#263b4d; white-space:nowrap; }
        .prospect-demo-kpi small { color:#87949c; font-size:11px; }
        .prospect-demo-lower-grid { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(280px,.85fr); gap:15px; }
        .prospect-demo-panel { padding:20px; margin-bottom:15px; }
        .prospect-demo-section-heading { display:flex; justify-content:space-between; align-items:center; gap:14px; margin-bottom:18px; }
        .prospect-demo-section-heading h2 { margin:4px 0 0; font-size:16px; letter-spacing:-.02em; }
        .prospect-demo-period,.prospect-demo-count { color:#74828b; font-size:11px; }
        .prospect-demo-bars { height:205px; display:flex; align-items:flex-end; justify-content:space-around; gap:12px; border-bottom:1px solid #e7ecee; padding:0 8px; }
        .prospect-demo-bar-column { height:100%; flex:1; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:7px; }
        .prospect-demo-bar-column span { font-size:9px; color:#84919a; }
        .prospect-demo-bar-column div { width:min(36px,70%); height:70%; display:flex; align-items:flex-end; background:#edf3f4; border-radius:6px 6px 2px 2px; overflow:hidden; }
        .prospect-demo-bar-column i { width:100%; border-radius:6px 6px 0 0; background:linear-gradient(180deg,#60a697,#387f7e); }
        .prospect-demo-bar-column small { color:#74828b; font-size:10px; padding-bottom:8px; }
        .prospect-demo-summary-row { display:flex; justify-content:space-between; gap:10px; border-bottom:1px solid #edf0f1; padding:13px 0; font-size:12px; color:#687780; }
        .prospect-demo-summary-row strong { color:#2e414e; text-align:right; }
        .prospect-demo-note { color:#89959c; font-size:11px; line-height:1.5; margin:16px 0 0; }
        .prospect-demo-table-wrap { overflow-x:auto; }
        .prospect-demo-table { width:100%; border-collapse:collapse; min-width:620px; font-size:12px; }
        .prospect-demo-table th { text-align:left; color:#788791; font-size:10px; text-transform:uppercase; letter-spacing:.06em; padding:11px 10px; background:#f7f9fa; border-bottom:1px solid #e8edef; }
        .prospect-demo-table td { padding:13px 10px; border-bottom:1px solid #edf0f1; color:#596a74; }
        .prospect-demo-table td strong { color:#334957; }
        .prospect-demo-status { display:inline-block; padding:4px 8px; background:#eaf5ef; color:#418061; border-radius:20px; font-size:10px; font-weight:700; }
        .prospect-demo-status.is-warning { color:#9a6c29; background:#fff3dd; }
        .prospect-demo-list-row { display:flex; justify-content:space-between; gap:18px; padding:14px 4px; border-bottom:1px solid #edf0f1; font-size:12px; }
        .prospect-demo-list-row div { display:grid; gap:5px; }.prospect-demo-list-row strong { color:#334957; }.prospect-demo-list-row span { color:#839099; font-size:11px; }.prospect-demo-list-row b { color:#334957; white-space:nowrap; }
        .prospect-demo-badge { color:#896d36; background:#fff4dd; border:1px solid #f0e1bd; padding:7px 10px; border-radius:7px; font-size:10px; }
        .prospect-demo-tax-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
        .prospect-demo-tax-grid article { display:grid; gap:10px; padding:16px; border-radius:9px; background:#f7f9fa; border:1px solid #e9edef; }
        .prospect-demo-tax-grid span,.prospect-demo-tax-grid small { color:#778690; font-size:11px; }.prospect-demo-tax-grid strong { font-size:16px; color:#314858; }.prospect-demo-tax-grid small { line-height:1.4; }
        .prospect-demo-footer { display:flex; justify-content:space-between; gap:14px; align-items:center; padding:18px 0 0; color:#89959c; font-size:11px; }
        .prospect-demo-footer a { color:#2a7187; font-weight:700; text-decoration:none; }
        @media (max-width: 960px) { .prospect-demo-shell { grid-template-columns:205px minmax(0,1fr); }.prospect-demo-content { padding:23px 20px 32px; }.prospect-demo-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); }.prospect-demo-lower-grid { grid-template-columns:1fr; } }
        @media (max-width: 640px) { .prospect-demo-shell { display:block; }.prospect-demo-sidebar { padding:12px; }.prospect-demo-brand { padding:4px 7px 12px; margin-bottom:12px; }.prospect-demo-nav-label,.prospect-demo-side-foot { display:none; }.prospect-demo-nav-list { display:flex; flex-direction:row; overflow-x:auto; gap:5px; }.prospect-demo-nav { flex:0 0 auto; padding:9px 10px; font-size:11px; }.prospect-demo-nav-icon { display:none; }.prospect-demo-mobile-nav-hint { display:block; padding:5px 4px 0; color:#b5c5cf; text-align:right; font-size:10px; }.prospect-demo-topbar { flex-wrap:wrap; gap:8px; padding:12px 16px; min-height:58px; }.prospect-demo-top-title { min-width:0; flex:1; font-size:12px; }.prospect-demo-company { display:none; }.prospect-demo-top-actions span { display:none; }.prospect-demo-content { padding:18px 13px 28px; }.prospect-demo-heading { align-items:flex-start; flex-direction:column; }.prospect-demo-heading h1 { font-size:21px; }.prospect-demo-kpis { gap:9px; }.prospect-demo-kpi { padding:13px; }.prospect-demo-kpi strong { font-size:15px; }.prospect-demo-panel { padding:15px; }.prospect-demo-tax-grid { grid-template-columns:1fr; }.prospect-demo-footer { align-items:flex-start; flex-direction:column; } }
      `}</style>
      <div className="prospect-demo-shell">
        <aside className="prospect-demo-sidebar" aria-label="Navigation de démonstration">
          <div className="prospect-demo-brand">
            <img className="prospect-demo-mark" src="/logo-comptaorion.png" alt="" aria-hidden="true" />
            <div><strong>ComptaOrion</strong><small>Gestion financière</small></div>
          </div>
          <div className="prospect-demo-nav-label">Démonstration</div>
          <nav className="prospect-demo-nav-list">
            {DEMO_SECTIONS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`prospect-demo-nav${section === item.id ? ' is-active' : ''}`}
                onClick={() => setSection(item.id)}
                aria-current={section === item.id ? 'page' : undefined}
              >
                <span className="prospect-demo-nav-icon" aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="prospect-demo-mobile-nav-hint">Faites défiler pour afficher tous les modules →</div>
          <div className="prospect-demo-side-foot">Entreprise fictive<br />Données de démonstration uniquement</div>
        </aside>
        <div className="prospect-demo-main">
          <header className="prospect-demo-topbar">
            <div className="prospect-demo-top-title">{activeSection?.label || 'Vue d’ensemble'} <span className="prospect-demo-company">AGRONOVA DÉMO</span></div>
            <div className="prospect-demo-top-actions">
              <span>Environnement de présentation</span>
              <a href="/inscription">Créer un espace</a>
            </div>
          </header>
          <main className="prospect-demo-content">
            <div className="prospect-demo-banner" role="note">
              <span aria-hidden="true">ⓘ</span>
              <div><strong>Démo publique en lecture seule</strong>Toutes les personnes, opérations et sommes affichées sont fictives. Aucun compte client ni aucune donnée réelle ne sont consultés.</div>
            </div>
            <div className="prospect-demo-heading">
              <div>
                <span className="prospect-demo-eyebrow">{activeSection?.label.toUpperCase()} · AGRONOVA DÉMO</span>
                <h1>{activeSection?.label || 'Vue d’ensemble'}</h1>
                <p>{sectionDescriptions[section] || 'Exemple de suivi financier pour une entreprise de matériel agricole.'}</p>
              </div>
              <span className="prospect-demo-readonly">● Consultation uniquement</span>
            </div>
            <DemoPanel section={section} />
            <footer className="prospect-demo-footer">
              <span>ComptaOrion · Démonstration fictive, sans connexion à une base client</span>
              <a href="/">Accéder à la connexion</a>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
