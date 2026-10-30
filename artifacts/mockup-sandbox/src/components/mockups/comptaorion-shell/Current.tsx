import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./_group.css";

const modules = [
  ["📊", "Tableau de Bord"],
  ["👥", "Clients"],
  ["🏭", "Fournisseurs"],
  ["💰", "Trésorerie"],
  ["📦", "Stock"],
  ["📖", "Comptabilité"],
  ["🤝", "Comptabilité associations"],
  ["🏛️", "Impôts (en préparation)"],
  ["🔗", "Intégrations"],
  ["⚙️", "Paramètres"],
];

const sales = [
  { month: "Jan", value: 1_800_000 },
  { month: "Fév", value: 2_450_000 },
  { month: "Mar", value: 1_950_000 },
  { month: "Avr", value: 2_900_000 },
  { month: "Mai", value: 2_600_000 },
  { month: "Juin", value: 3_200_000 },
];

const expenses = [
  { name: "Achats", value: 48, color: "#2c78a8" },
  { name: "Salaires", value: 27, color: "#d6a33a" },
  { name: "Transport", value: 15, color: "#58a897" },
  { name: "Autres", value: 10, color: "#9ba7b2" },
];

function Kpi({ label, value, color, note }: { label: string; value: string; color: string; note?: string }) {
  return (
    <div className="current-kpi" style={{ borderLeftColor: color }}>
      <span className="current-kpi-label">{label}</span>
      <strong style={{ color }}>{value}</strong>
      {note && <span className="current-kpi-note">{note}</span>}
    </div>
  );
}

export function Current() {
  return (
    <div className="current-app">
      <aside className="current-sidebar">
        <div className="current-brand">
          <img src="/__mockup/images/comptaorion-original.png" alt="Logo ComptaOrion actuel" />
          <div><strong>ComptaOrion</strong><span>Gestion financière</span></div>
        </div>
        <nav className="current-nav" aria-label="Navigation principale">
          {modules.map(([icon, label], index) => (
            <button className={`current-nav-item${index === 0 ? " active" : ""}`} key={label}>
              <span className="current-nav-icon">{icon}</span><span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="current-main">
        <header className="current-topbar">
          <div className="current-topbar-title">
            <button className="current-menu-icon" aria-label="Réduire le menu">☰</button>
            <div><h1>Tableau de bord</h1><span>NERU</span></div>
          </div>
          <div className="current-actions">
            <span className="current-user"><b>U</b> Utilisateur</span>
            <button className="current-logout">Déconnexion</button>
          </div>
        </header>

        <main className="current-content">
          <section className="current-page-header">
            <div><h2>Vue d’ensemble</h2><p>Votre activité financière sur la période sélectionnée</p></div>
            <button className="current-period">01 janv. – 31 déc. 2026⌄</button>
          </section>

          <div className="current-demo-note">Données d’exemple</div>
          <section className="current-kpi-grid" aria-label="Indicateurs financiers">
            <Kpi label="Ventes" value="3 200 000 XOF" color="#28a745" note="Période en cours" />
            <Kpi label="Dépenses" value="2 420 000 XOF" color="#dc3545" note="Période en cours" />
            <Kpi label="Marge brute" value="24,4 %" color="#17a2b8" note="CA 3,2 M · CMV 2,42 M" />
            <Kpi label="Cashflow" value="780 000 XOF" color="#28a745" />
            <Kpi label="Factures en retard" value="3" color="#d39e00" note="420 000 XOF" />
            <Kpi label="Stock faible" value="2 produits" color="#6c757d" />
          </section>

          <section className="current-cycle">
            <h3>Cycle de trésorerie</h3>
            <div className="current-cycle-grid">
              <Kpi label="Délai paiement clients (DSO)" value="24 jours" color="#6f42c1" />
              <Kpi label="Délai paiement fournisseurs (DPO)" value="18 jours" color="#20c997" />
              <Kpi label="Rotation stock (DIO)" value="42 jours" color="#fd7e14" />
              <Kpi label="Cycle conversion trésorerie (CCC)" value="48 jours" color="#28a745" />
              <Kpi label="Valeur stock" value="5 240 000 XOF" color="#17a2b8" />
              <Kpi label="CMV" value="2 420 000 XOF" color="#6c757d" />
            </div>
          </section>

          <section className="current-charts">
            <article className="current-chart-card">
              <h3>Évolution des ventes (12 mois)</h3>
              <div className="current-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(value) => `${Math.round(value / 1_000_000)}M`} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#287ac2" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="current-chart-card">
              <h3>Répartition des dépenses</h3>
              <div className="current-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenses} dataKey="value" nameKey="name" innerRadius={56} outerRadius={92} paddingAngle={3}>
                      {expenses.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
