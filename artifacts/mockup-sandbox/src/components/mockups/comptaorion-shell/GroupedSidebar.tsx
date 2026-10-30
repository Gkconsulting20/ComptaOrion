import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  Boxes,
  ChartNoAxesCombined,
  ChevronDown,
  FileText,
  Handshake,
  Landmark,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Package,
  Settings2,
  ShoppingBag,
  Truck,
  Users,
  X,
} from "lucide-react";

const sales = [
  { month: "Jan", value: 1_800_000 },
  { month: "Fév", value: 2_450_000 },
  { month: "Mar", value: 1_950_000 },
  { month: "Avr", value: 2_900_000 },
  { month: "Mai", value: 2_600_000 },
  { month: "Juin", value: 3_200_000 },
];

const expenses = [
  { name: "Achats", value: 48, color: "#2d6c9f" },
  { name: "Salaires", value: 27, color: "#c79a43" },
  { name: "Transport", value: 15, color: "#5a9a8e" },
  { name: "Autres", value: 10, color: "#a8b4bc" },
];

const groups = [
  {
    title: "Pilotage",
    items: [{ label: "Tableau de Bord", icon: LayoutDashboard }],
  },
  {
    title: "Tiers",
    items: [
      { label: "Clients", icon: Users },
      { label: "Fournisseurs", icon: Truck },
    ],
  },
  {
    title: "Opérations",
    items: [
      { label: "Trésorerie", icon: Banknote },
      { label: "Stock", icon: Boxes },
    ],
  },
  {
    title: "Comptabilité",
    items: [
      { label: "Comptabilité", icon: FileText },
      { label: "Comptabilité associations", icon: Handshake },
      { label: "Impôts (en préparation)", icon: Landmark },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Intégrations", icon: Link2 },
      { label: "Paramètres", icon: Settings2 },
    ],
  },
];

const primaryKpis = [
  { label: "Ventes", value: "3 200 000", unit: "XOF", note: "Période en cours", tone: "positive", icon: ShoppingBag },
  { label: "Dépenses", value: "2 420 000", unit: "XOF", note: "Période en cours", tone: "negative", icon: Banknote },
  { label: "Marge brute", value: "24,4", unit: "%", note: "CA 3,2 M · CMV 2,42 M", tone: "blue", icon: ChartNoAxesCombined },
  { label: "Cashflow", value: "780 000", unit: "XOF", note: "", tone: "positive", icon: Landmark },
  { label: "Factures en retard", value: "3", unit: "", note: "420 000 XOF", tone: "gold", icon: FileText },
  { label: "Stock faible", value: "2 produits", unit: "", note: "", tone: "slate", icon: Package },
];

const cycleKpis = [
  { label: "Délai paiement clients (DSO)", value: "24 jours", tone: "violet" },
  { label: "Délai paiement fournisseurs (DPO)", value: "18 jours", tone: "teal" },
  { label: "Rotation stock (DIO)", value: "42 jours", tone: "orange" },
  { label: "Cycle conversion trésorerie (CCC)", value: "48 jours", tone: "positive" },
  { label: "Valeur stock", value: "5 240 000 XOF", tone: "blue" },
  { label: "CMV", value: "2 420 000 XOF", tone: "slate" },
];

function OrionMark() {
  return (
    <svg className="go-mark" viewBox="0 0 42 42" role="img" aria-label="ComptaOrion">
      <rect x="1" y="1" width="40" height="40" rx="12" fill="#173d62" />
      <path d="M12 11.5h13.5M12 17h8.5M12 22.5h13.5M12 28h8.5" stroke="#f6f2e8" strokeWidth="2" strokeLinecap="round" />
      <path d="M28.5 11.5v16.8" stroke="#d8ad58" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="28.5" cy="11.5" r="2.4" fill="#e5bb69" />
      <circle cx="28.5" cy="28.3" r="2.4" fill="#e5bb69" />
      <circle cx="33.2" cy="19.8" r="1.5" fill="#f6f2e8" />
      <path d="M28.5 19.8h4.7" stroke="#d8ad58" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function MetricCard({ label, value, unit, note, tone, icon: Icon }: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  tone: string;
  icon?: typeof ShoppingBag;
}) {
  return (
    <article className={`go-metric go-tone-${tone}`}>
      <div className="go-metric-top">
        <span className="go-metric-label">{label}</span>
        {Icon && <span className="go-metric-icon"><Icon size={16} strokeWidth={1.8} /></span>}
      </div>
      <strong className="go-metric-value">{value}{unit && <small> {unit}</small>}</strong>
      {note && <span className="go-metric-note">{note}</span>}
    </article>
  );
}

export function GroupedSidebar() {
  const [active, setActive] = useState("Tableau de Bord");
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === "undefined" || window.innerWidth > 680);
  const [sessionNotice, setSessionNotice] = useState(false);

  return (
    <div className="grouped-orion">
      <style>{`
        .grouped-orion, .grouped-orion * { box-sizing: border-box; }
        .grouped-orion {
          --ink: #1b3448; --muted: #748392; --line: #e4e9ec; --paper: #f5f7f6;
          min-height: 100dvh; display: flex; color: var(--ink); background: var(--paper);
          font-family: 'DM Sans', 'Avenir Next', sans-serif; font-size: 13px;
        }
        .go-sidebar {
          position: sticky; top: 0; display: flex; flex: 0 0 264px; flex-direction: column;
          width: 264px; height: 100dvh; padding: 19px 13px 16px; overflow-y: auto;
          background: #fbfcfb; border-right: 1px solid var(--line);
        }
        .go-sidebar.is-closed { width: 0; flex-basis: 0; padding-right: 0; padding-left: 0; overflow: hidden; border-right: 0; }
        .go-brand { display: flex; align-items: center; gap: 10px; padding: 1px 7px 18px; border-bottom: 1px solid var(--line); }
        .go-mark { display: block; width: 40px; height: 40px; flex: 0 0 40px; }
        .go-brand-copy { display: grid; gap: 2px; }
        .go-brand-copy strong { font-size: 15px; letter-spacing: -.045em; font-weight: 750; color: #183b5a; }
        .go-brand-copy span { color: #82909c; font-size: 10px; letter-spacing: .015em; }
        .go-nav { padding-top: 12px; }
        .go-nav-group { margin: 0 0 8px; }
        .go-group-title { margin: 0; padding: 9px 10px 5px; color: #9aa5ad; font-size: 9px; font-weight: 750; letter-spacing: .11em; text-transform: uppercase; }
        .go-nav-item {
          display: flex; width: 100%; min-height: 35px; align-items: center; gap: 10px; padding: 7px 10px;
          border: 0; border-radius: 7px; color: #5c6b78; background: transparent; text-align: left;
          font: inherit; font-size: 12px; line-height: 1.25; cursor: pointer; transition: color .16s, background .16s, transform .16s;
        }
        .go-nav-item:hover { color: #1d4e73; background: #eff4f6; }
        .go-nav-item:active { transform: translateY(1px); }
        .go-nav-item.is-active { color: #1b4b70; background: #eaf2f6; font-weight: 700; }
        .go-nav-icon { width: 17px; flex: 0 0 17px; color: #80909c; }
        .go-nav-item.is-active .go-nav-icon { color: #2b6b95; }
        .go-sidebar-foot { margin-top: auto; padding: 12px 10px 0; border-top: 1px solid var(--line); color: #98a3aa; font-size: 10px; }
        .go-shell { min-width: 0; flex: 1; }
        .go-topbar {
          position: sticky; top: 0; z-index: 5; display: flex; min-height: 68px; align-items: center;
          justify-content: space-between; gap: 20px; padding: 10px 30px;
          border-bottom: 1px solid var(--line); background: rgba(255,255,255,.94); backdrop-filter: blur(12px);
        }
        .go-heading { display: flex; min-width: 0; align-items: center; gap: 13px; }
        .go-toggle {
          display: grid; width: 34px; height: 34px; flex: 0 0 34px; place-items: center; padding: 0;
          border: 1px solid #e2e8eb; border-radius: 8px; color: #536777; background: #fff; cursor: pointer;
        }
        .go-toggle:hover { background: #f1f5f6; }
        .go-title-block { display: flex; min-width: 0; align-items: center; gap: 14px; }
        .go-page-title { overflow: hidden; margin: 0; color: #18354d; font-family: 'Manrope', 'DM Sans', sans-serif; font-size: 18px; font-weight: 750; letter-spacing: -.04em; text-overflow: ellipsis; white-space: nowrap; }
        .go-company { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border: 1px solid #e4e9eb; border-radius: 6px; color: #586978; background: #f8faf9; font-size: 10px; font-weight: 700; letter-spacing: .08em; }
        .go-company-mark { width: 6px; height: 6px; border-radius: 2px; background: #d0a44e; }
        .go-actions { display: flex; align-items: center; gap: 15px; }
        .go-user { display: flex; align-items: center; gap: 8px; color: #526372; font-size: 11px; font-weight: 600; white-space: nowrap; }
        .go-avatar { display: grid; width: 30px; height: 30px; place-items: center; border: 1px solid #dce6ea; border-radius: 50%; color: #275b7b; background: #edf4f6; font-size: 11px; font-weight: 750; }
        .go-logout { display: inline-flex; align-items: center; gap: 7px; min-height: 32px; padding: 0 9px; border: 1px solid transparent; border-radius: 7px; color: #71808c; background: transparent; font: inherit; font-size: 11px; cursor: pointer; }
        .go-logout:hover { color: #964f46; background: #faf1ef; }
        .go-notice { position: absolute; top: 56px; right: 26px; padding: 9px 12px; border: 1px solid #e6e9e8; border-radius: 8px; color: #50616d; background: white; box-shadow: 0 8px 24px rgba(30,50,65,.08); font-size: 11px; }
        .go-content { width: min(100%, 1500px); margin: 0 auto; padding: 25px 30px 32px; }
        .go-intro { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 12px; }
        .go-eyebrow { margin: 0 0 6px; color: #a0854f; font-size: 9px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
        .go-intro h2 { margin: 0; color: #18354d; font-family: 'Manrope', 'DM Sans', sans-serif; font-size: 22px; font-weight: 750; letter-spacing: -.045em; line-height: 1.15; }
        .go-intro p { margin: 6px 0 0; color: var(--muted); font-size: 11px; }
        .go-period { display: inline-flex; align-items: center; gap: 8px; padding: 8px 11px; border: 1px solid #dfe6e8; border-radius: 7px; color: #516372; background: #fff; font-size: 11px; white-space: nowrap; }
        .go-sample { display: flex; align-items: center; gap: 7px; margin: 0 0 9px; color: #8b979e; font-size: 9px; }
        .go-sample-dot { width: 6px; height: 6px; border-radius: 50%; background: #c3a05c; }
        .go-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .go-metric { position: relative; min-width: 0; min-height: 103px; padding: 13px 15px 12px; border: 1px solid #e4e9e9; border-radius: 9px; background: #fff; }
        .go-metric:before { position: absolute; top: 13px; bottom: 13px; left: 0; width: 2px; border-radius: 0 2px 2px 0; background: var(--accent); content: ''; }
        .go-metric-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .go-metric-label { color: #74828b; font-size: 10px; line-height: 1.35; }
        .go-metric-icon { display: grid; width: 25px; height: 25px; flex: 0 0 25px; place-items: center; border-radius: 7px; color: var(--accent); background: var(--soft); }
        .go-metric-value { display: block; margin-top: 8px; color: #284052; font-family: 'Manrope', 'DM Sans', sans-serif; font-size: 19px; font-weight: 750; letter-spacing: -.04em; line-height: 1.15; overflow-wrap: anywhere; }
        .go-metric-value small { color: #7d8a92; font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 0; }
        .go-metric-note { display: block; margin-top: 5px; color: #99a3a8; font-size: 9px; }
        .go-tone-positive { --accent: #42856e; --soft: #edf5f0; }
        .go-tone-negative { --accent: #bb675e; --soft: #fbf1ef; }
        .go-tone-blue { --accent: #39769a; --soft: #edf4f7; }
        .go-tone-gold { --accent: #bd9143; --soft: #f8f3e9; }
        .go-tone-slate { --accent: #84919a; --soft: #f0f3f4; }
        .go-tone-violet { --accent: #8b76a8; --soft: #f3f0f7; }
        .go-tone-teal { --accent: #4f9787; --soft: #edf6f3; }
        .go-tone-orange { --accent: #c1844b; --soft: #f9f2eb; }
        .go-cycle { margin-top: 22px; }
        .go-section-head { display: flex; align-items: center; gap: 9px; margin: 0 0 10px; }
        .go-section-head h3 { margin: 0; color: #3c5263; font-size: 12px; font-weight: 750; }
        .go-section-rule { height: 1px; flex: 1; background: #e3e9e9; }
        .go-cycle-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
        .go-cycle .go-metric { min-height: 74px; padding: 11px 13px; }
        .go-cycle .go-metric:before { top: 11px; bottom: 11px; }
        .go-cycle .go-metric-value { margin-top: 7px; font-size: 15px; }
        .go-charts { display: grid; grid-template-columns: 1.25fr 1fr; gap: 11px; margin-top: 22px; }
        .go-chart-card { min-width: 0; padding: 15px 16px 10px; border: 1px solid #e4e9e9; border-radius: 9px; background: #fff; }
        .go-chart-title { margin: 0 0 3px; color: #344d60; font-size: 12px; font-weight: 750; }
        .go-chart-subtitle { margin: 0; color: #98a2a7; font-size: 9px; }
        .go-chart { width: 100%; height: 218px; margin-top: 8px; }
        .go-tooltip { padding: 8px 10px; border: 1px solid #e0e6e7; border-radius: 7px; color: #344b5d; background: #fff; box-shadow: 0 4px 14px rgba(30,50,65,.08); font-size: 10px; }
        .go-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: -1px; color: #71808a; font-size: 9px; }
        .go-legend-item { display: inline-flex; align-items: center; gap: 5px; }
        .go-legend-swatch { width: 7px; height: 7px; border-radius: 2px; }
        .go-mobile-backdrop { display: none; }
        @media (min-width: 1200px) {
          .go-kpis { grid-template-columns: repeat(6, minmax(0, 1fr)); }
          .go-cycle-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
        }
        @media (max-width: 900px) {
          .go-sidebar { flex-basis: 236px; width: 236px; }
          .go-topbar { padding-right: 20px; padding-left: 20px; }
          .go-content { padding-right: 20px; padding-left: 20px; }
          .go-kpis, .go-cycle-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 680px) {
          .grouped-orion { display: block; }
          .go-sidebar { position: fixed; z-index: 12; top: 0; bottom: 0; left: 0; width: min(286px, 86vw); height: 100dvh; transform: translateX(-102%); transition: transform .2s ease; box-shadow: 12px 0 35px rgba(24,50,68,.11); }
          .go-sidebar.is-open { transform: translateX(0); }
          .go-sidebar.is-closed { width: min(286px, 86vw); flex-basis: auto; padding: 19px 13px 16px; border-right: 1px solid var(--line); }
          .go-mobile-backdrop { position: fixed; z-index: 11; inset: 0; display: block; border: 0; background: rgba(25,42,54,.25); }
          .go-topbar { min-height: 61px; padding: 9px 14px; }
          .go-title-block { gap: 8px; }
          .go-page-title { font-size: 15px; }
          .go-company { padding: 4px 7px; font-size: 9px; }
          .go-actions { gap: 5px; }
          .go-user { gap: 6px; }
          .go-user-name { display: none; }
          .go-logout { width: 32px; justify-content: center; padding: 0; }
          .go-logout span:last-child { display: none; }
          .go-content { padding: 20px 14px 24px; }
          .go-intro { align-items: flex-start; flex-direction: column; gap: 12px; }
          .go-period { width: 100%; justify-content: space-between; }
          .go-kpis, .go-cycle-grid { grid-template-columns: 1fr; }
          .go-metric { min-height: 93px; }
          .go-charts { grid-template-columns: 1fr; }
          .go-chart { height: 205px; }
        }
      `}</style>
      {sidebarOpen && <button className="go-mobile-backdrop" aria-label="Fermer la navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`go-sidebar${sidebarOpen ? " is-open" : " is-closed"}`} id="grouped-navigation" aria-label="Navigation principale">
        <div className="go-brand">
          <OrionMark />
          <div className="go-brand-copy"><strong>ComptaOrion</strong><span>Gestion financière</span></div>
        </div>
        <nav className="go-nav" aria-label="Modules">
          {groups.map((group) => (
            <section className="go-nav-group" key={group.title} aria-label={group.title}>
              <h2 className="go-group-title">{group.title}</h2>
              {group.items.map(({ label, icon: Icon }) => (
                <button
                  type="button"
                  key={label}
                  className={`go-nav-item${active === label ? " is-active" : ""}`}
                  aria-current={active === label ? "page" : undefined}
                  onClick={() => { setActive(label); setSidebarOpen(false); }}
                >
                  <Icon className="go-nav-icon" size={16} strokeWidth={1.8} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </section>
          ))}
        </nav>
        <div className="go-sidebar-foot">NERU · Espace de gestion</div>
      </aside>

      <div className="go-shell">
        <header className="go-topbar">
          <div className="go-heading">
            <button
              className="go-toggle"
              type="button"
              aria-label={sidebarOpen ? "Fermer la navigation" : "Ouvrir la navigation"}
              aria-expanded={sidebarOpen}
              aria-controls="grouped-navigation"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              {sidebarOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
            <div className="go-title-block">
              <h1 className="go-page-title">{active}</h1>
              <span className="go-company"><i className="go-company-mark" />NERU</span>
            </div>
          </div>
          <div className="go-actions">
            <div className="go-user"><span className="go-avatar">U</span><span className="go-user-name">Utilisateur</span></div>
            <button className="go-logout" type="button" onClick={() => setSessionNotice((shown) => !shown)} aria-label="Déconnexion">
              <LogOut size={14} /><span>Déconnexion</span>
            </button>
          </div>
          {sessionNotice && <div className="go-notice" role="status">Session de démonstration</div>}
        </header>

        <main className="go-content">
          <section className="go-intro">
            <div>
              <p className="go-eyebrow">Tableau de bord · NERU</p>
              <h2>Vue d’ensemble</h2>
              <p>Votre activité financière sur la période sélectionnée</p>
            </div>
            <div className="go-period" aria-label="Période affichée">
              <span>01 janv. – 31 déc. 2026</span><ChevronDown size={14} />
            </div>
          </section>

          <div className="go-sample"><span className="go-sample-dot" />Chiffres fictifs · données d’exemple</div>
          <section className="go-kpis" aria-label="Indicateurs financiers">
            {primaryKpis.map((item) => <MetricCard key={item.label} {...item} />)}
          </section>

          <section className="go-cycle" aria-labelledby="cycle-heading">
            <div className="go-section-head"><h3 id="cycle-heading">Cycle de trésorerie</h3><span className="go-section-rule" /></div>
            <div className="go-cycle-grid">
              {cycleKpis.map((item) => <MetricCard key={item.label} {...item} />)}
            </div>
          </section>

          <section className="go-charts" aria-label="Graphiques financiers">
            <article className="go-chart-card">
              <h3 className="go-chart-title">Évolution des ventes (12 mois)</h3>
              <p className="go-chart-subtitle">Ventes mensuelles · XOF</p>
              <div className="go-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sales} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#edf0ef" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#84919a", fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#84919a", fontSize: 9 }} tickFormatter={(value) => `${Math.round(value / 1_000_000)}M`} />
                    <Tooltip
                      contentStyle={{ border: "1px solid #e3e9e8", borderRadius: 7, fontSize: 10 }}
                      formatter={(value: number) => [`${value.toLocaleString("fr-FR")} XOF`, "Ventes"]}
                    />
                    <Bar dataKey="value" fill="#39769a" radius={[4, 4, 0, 0]} maxBarSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="go-chart-card">
              <h3 className="go-chart-title">Répartition des dépenses</h3>
              <p className="go-chart-subtitle">Part par catégorie · %</p>
              <div className="go-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenses} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={3} stroke="none">
                      {expenses.map((item) => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ border: "1px solid #e3e9e8", borderRadius: 7, fontSize: 10 }} formatter={(value: number) => [`${value}%`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="go-legend">
                {expenses.map((item) => <span className="go-legend-item" key={item.name}><i className="go-legend-swatch" style={{ background: item.color }} />{item.name} {item.value}%</span>)}
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
