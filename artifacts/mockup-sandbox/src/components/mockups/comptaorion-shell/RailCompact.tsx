import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  ChevronDown,
  CreditCard,
  FileChartColumn,
  Handshake,
  Landmark,
  LogOut,
  Package,
  Settings2,
  Users,
  Wallet,
} from "lucide-react";
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

const modules = [
  { label: "Tableau de Bord", icon: BarChart3 },
  { label: "Clients", icon: Users },
  { label: "Fournisseurs", icon: Building2 },
  { label: "Trésorerie", icon: Wallet },
  { label: "Stock", icon: Boxes },
  { label: "Comptabilité", icon: FileChartColumn },
  { label: "Comptabilité associations", icon: Handshake },
  { label: "Impôts (en préparation)", icon: Landmark },
  { label: "Intégrations", icon: CreditCard },
  { label: "Paramètres", icon: Settings2 },
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
  { name: "Achats", value: 48, color: "#397ca1" },
  { name: "Salaires", value: 27, color: "#d6a443" },
  { name: "Transport", value: 15, color: "#5b9b8e" },
  { name: "Autres", value: 10, color: "#a6b1b6" },
];

const primaryMetrics = [
  { label: "Ventes", value: "3 200 000 FCFA", note: "Période en cours", color: "#34826a", Icon: ArrowUpRight },
  { label: "Dépenses", value: "2 420 000 FCFA", note: "Période en cours", color: "#b45d56", Icon: ArrowDownRight },
  { label: "Marge brute", value: "24,4 %", note: "CA 3,2 M · CMV 2,42 M", color: "#3f7f9b", Icon: BarChart3 },
  { label: "Cashflow", value: "780 000 FCFA", note: "", color: "#34826a", Icon: Wallet },
  { label: "Factures en retard", value: "3", note: "420 000 FCFA", color: "#b88732", Icon: CalendarDays },
  { label: "Stock faible", value: "2 produits", note: "", color: "#718087", Icon: Package },
];

const cycleMetrics = [
  { label: "Délai paiement clients (DSO)", value: "24 jours", color: "#6684a5" },
  { label: "Délai paiement fournisseurs (DPO)", value: "18 jours", color: "#4e9785" },
  { label: "Rotation stock (DIO)", value: "42 jours", color: "#bd8149" },
  { label: "Cycle conversion trésorerie (CCC)", value: "48 jours", color: "#56856c" },
  { label: "Valeur stock", value: "5 240 000 FCFA", color: "#4b8296" },
  { label: "CMV", value: "2 420 000 FCFA", color: "#748187" },
];

function OrionMark() {
  return (
    <div className="rc-mark" aria-label="ComptaOrion">
      <svg viewBox="0 0 40 40" role="img" aria-hidden="true">
        <path d="M20 2.8 24.9 15.1 37.2 20l-12.3 4.9L20 37.2l-4.9-12.3L2.8 20l12.3-4.9L20 2.8Z" fill="#e3b353" />
        <path d="m20 9.2 2.9 7.9 7.9 2.9-7.9 2.9-2.9 7.9-2.9-7.9-7.9-2.9 7.9-2.9L20 9.2Z" fill="#f8f5eb" />
        <circle cx="20" cy="20" r="3.2" fill="#28556f" />
      </svg>
    </div>
  );
}

function MetricCard({ label, value, note, color, Icon, compact = false }: {
  label: string; value: string; note?: string; color: string; Icon?: typeof Wallet; compact?: boolean;
}) {
  return (
    <article className={`rc-metric${compact ? " rc-metric-compact" : ""}`}>
      <div className="rc-metric-top">
        <span className="rc-metric-label">{label}</span>
        {Icon && <span className="rc-metric-icon" style={{ color }}><Icon size={15} strokeWidth={1.8} /></span>}
      </div>
      <strong style={{ color: compact ? "#263f4d" : color }}>{value}</strong>
      {note ? <span className="rc-metric-note">{note}</span> : null}
    </article>
  );
}

function money(value: number) {
  return `${(value / 1_000_000).toFixed(1).replace(".", ",")} M`;
}

export function RailCompact() {
  const [active, setActive] = useState("Tableau de Bord");
  const [sessionNotice, setSessionNotice] = useState(false);

  return (
    <div className="rail-compact">
      <style>{`
        .rail-compact, .rail-compact * { box-sizing: border-box; }
        .rail-compact {
          --ink: #243e4c; --muted: #71828a; --line: #e5e9e6; --paper: #fbfcf9;
          display: flex; min-height: 100vh; width: 100%; color: var(--ink);
          background: #f3f6f2; font-family: "DM Sans", "Avenir Next", sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .rc-rail {
          position: sticky; top: 0; display: flex; flex: 0 0 72px; width: 72px;
          height: 100vh; flex-direction: column; align-items: center; padding: 17px 8px 14px;
          color: #dbe6e8; background: #23485e;
        }
        .rc-brand { display: grid; place-items: center; width: 48px; height: 48px; margin-bottom: 21px; }
        .rc-mark { display: grid; width: 39px; height: 39px; place-items: center; border-radius: 12px; background: #315b70; }
        .rc-mark svg { width: 27px; height: 27px; }
        .rc-nav { display: flex; width: 100%; flex: 1; flex-direction: column; align-items: center; gap: 5px; }
        .rc-nav-item {
          position: relative; display: grid; width: 46px; height: 43px; flex: 0 0 43px;
          place-items: center; border: 0; border-radius: 12px; color: #c3d3d8;
          background: transparent; cursor: pointer; transition: background .18s ease, color .18s ease;
        }
        .rc-nav-item:hover, .rc-nav-item:focus-visible { color: #fff; background: #31596d; outline: none; }
        .rc-nav-item[aria-current="page"] { color: #f0c667; background: #31596d; }
        .rc-nav-item[aria-current="page"]::before { position: absolute; left: -8px; width: 3px; height: 22px; border-radius: 0 3px 3px 0; background: #e3b353; content: ""; }
        .rc-tip {
          position: absolute; z-index: 20; left: calc(100% + 12px); top: 50%; transform: translate(-3px, -50%);
          padding: 8px 10px; border: 1px solid #dce4e4; border-radius: 7px; color: #294653;
          background: #fff; box-shadow: 0 8px 24px #1d3d4b20; font-size: 12px; font-weight: 600;
          white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .14s ease, transform .14s ease;
        }
        .rc-nav-item:hover .rc-tip, .rc-nav-item:focus-visible .rc-tip { transform: translate(0, -50%); opacity: 1; }
        .rc-main { display: flex; min-width: 0; flex: 1; flex-direction: column; }
        .rc-topbar-start { display: flex; min-width: 0; align-items: center; gap: 18px; }
        .rc-wordmark { display: flex; flex: 0 0 auto; align-items: center; gap: 7px; color: #31566a; font-size: 12px; font-weight: 750; letter-spacing: -.025em; }
        .rc-wordmark .rc-mark { width: 27px; height: 27px; border-radius: 8px; }
        .rc-wordmark .rc-mark svg { width: 19px; height: 19px; }
        .rc-heading { padding-left: 17px; border-left: 1px solid #dfe6e2; }
        .rc-topbar {
          position: sticky; z-index: 5; top: 0; display: flex; min-height: 70px; align-items: center;
          justify-content: space-between; gap: 20px; padding: 10px clamp(18px, 3vw, 42px);
          border-bottom: 1px solid #e4e9e6; background: rgba(251,252,249,.96); backdrop-filter: blur(10px);
        }
        .rc-heading { min-width: 0; }
        .rc-heading h1 { margin: 0; color: #234455; font-size: 17px; font-weight: 700; letter-spacing: -.025em; }
        .rc-heading p { margin: 3px 0 0; color: #7c8b8f; font-size: 11px; }
        .rc-top-actions { display: flex; align-items: center; gap: 16px; }
        .rc-user { display: flex; align-items: center; gap: 8px; color: #51656c; font-size: 12px; font-weight: 600; }
        .rc-avatar { display: grid; width: 31px; height: 31px; place-items: center; border: 1px solid #d9e4e1; border-radius: 50%; color: #315c70; background: #edf3ef; font-size: 12px; }
        .rc-logout {
          display: flex; align-items: center; gap: 7px; padding: 8px 10px; border: 1px solid #e3e8e5;
          border-radius: 8px; color: #5d6f74; background: transparent; font: inherit; font-size: 11px; cursor: pointer;
        }
        .rc-logout:hover { border-color: #c9d6d2; background: #f3f6f2; }
        .rc-content { width: 100%; max-width: 1600px; margin: 0 auto; padding: 26px clamp(18px, 3vw, 42px) 34px; }
        .rc-overview { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 15px; }
        .rc-overview h2 { margin: 0; color: #274656; font-size: 21px; font-weight: 700; letter-spacing: -.035em; }
        .rc-overview p { margin: 5px 0 0; color: #7a898d; font-size: 12px; }
        .rc-period {
          display: inline-flex; align-items: center; gap: 9px; min-height: 37px; padding: 0 11px;
          border: 1px solid #dfe6e2; border-radius: 8px; color: #50676f; background: #fff; font: inherit;
          font-size: 11px; font-weight: 600;
        }
        .rc-demo { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; color: #8b9898; font-size: 10px; letter-spacing: .015em; }
        .rc-demo::before { width: 6px; height: 6px; border-radius: 50%; background: #d6a443; content: ""; }
        .rc-metric-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin-bottom: 23px; }
        .rc-metric {
          min-width: 0; min-height: 106px; padding: 13px 14px 12px; border: 1px solid #e4e9e5;
          border-radius: 10px; background: #fff;
        }
        .rc-metric-top { display: flex; min-height: 18px; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 12px; }
        .rc-metric-label { color: #718087; font-size: 10px; line-height: 1.35; }
        .rc-metric-icon { display: grid; width: 24px; height: 24px; flex: 0 0 24px; place-items: center; border-radius: 7px; background: #f1f5f2; }
        .rc-metric strong { display: block; overflow-wrap: anywhere; font-size: clamp(14px, 1.1vw, 17px); font-weight: 700; letter-spacing: -.035em; line-height: 1.25; }
        .rc-metric-note { display: block; margin-top: 5px; color: #98a3a3; font-size: 9px; }
        .rc-cycle { margin-bottom: 24px; }
        .rc-section-heading { display: flex; align-items: center; gap: 9px; margin: 0 0 10px; color: #435f69; font-size: 13px; font-weight: 700; }
        .rc-section-heading::before { width: 3px; height: 14px; border-radius: 3px; background: #d6a443; content: ""; }
        .rc-cycle-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 9px; }
        .rc-metric-compact { min-height: 82px; padding: 11px 12px; background: #f9fbf8; }
        .rc-metric-compact .rc-metric-top { margin-bottom: 9px; }
        .rc-metric-compact .rc-metric-label { font-size: 9px; }
        .rc-metric-compact strong { font-size: clamp(13px, 1vw, 15px); }
        .rc-charts { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(280px, 1fr); gap: 12px; }
        .rc-chart-card { min-width: 0; padding: 16px 17px 12px; border: 1px solid #e4e9e5; border-radius: 11px; background: #fff; }
        .rc-chart-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .rc-chart-head h3 { margin: 0; color: #36525e; font-size: 12px; font-weight: 700; }
        .rc-chart-caption { color: #9aa5a2; font-size: 9px; }
        .rc-chart { width: 100%; height: 228px; margin-top: 13px; }
        .rc-legend { display: flex; flex-wrap: wrap; gap: 10px 15px; margin-top: -2px; color: #778589; font-size: 10px; }
        .rc-legend span { display: inline-flex; align-items: center; gap: 5px; }
        .rc-dot { width: 7px; height: 7px; border-radius: 2px; }
        .rc-notice {
          position: fixed; right: 20px; bottom: 20px; z-index: 30; padding: 12px 15px;
          border: 1px solid #dce5e1; border-radius: 9px; color: #355563; background: #fff;
          box-shadow: 0 10px 30px #22475b1a; font-size: 12px;
        }
        @media (max-width: 1100px) {
          .rc-metric-grid, .rc-cycle-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 740px) {
          .rc-rail { flex-basis: 58px; width: 58px; padding-right: 5px; padding-left: 5px; }
          .rc-nav-item { width: 42px; }
          .rc-nav-item[aria-current="page"]::before { left: -5px; }
          .rc-topbar { min-height: 63px; padding-right: 14px; padding-left: 16px; }
          .rc-content { padding: 21px 15px 28px; }
          .rc-charts { grid-template-columns: 1fr; }
          .rc-chart { height: 210px; }
          .rc-chart-caption { display: none; }
        }
        @media (max-width: 480px) {
          .rc-rail { flex-basis: 52px; width: 52px; }
          .rc-brand { margin-bottom: 15px; }
          .rc-mark { width: 35px; height: 35px; }
          .rc-mark svg { width: 25px; height: 25px; }
          .rc-nav { gap: 3px; }
          .rc-nav-item { width: 39px; height: 40px; flex-basis: 40px; }
          .rc-top-actions { gap: 8px; }
          .rc-topbar-start { gap: 10px; }
          .rc-wordmark { font-size: 0; }
          .rc-heading { padding-left: 10px; }
          .rc-user { gap: 0; }
          .rc-user-name, .rc-logout span { display: none; }
          .rc-logout { width: 34px; height: 34px; justify-content: center; padding: 0; }
          .rc-overview { align-items: flex-start; flex-direction: column; gap: 12px; }
          .rc-metric-grid, .rc-cycle-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .rc-metric { min-height: 99px; padding: 11px; }
          .rc-metric-compact { min-height: 75px; }
          .rc-metric strong { font-size: 14px; }
          .rc-metric-compact strong { font-size: 13px; }
          .rc-chart-card { padding: 14px 12px 10px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rc-nav-item, .rc-tip { transition: none; }
        }
      `}</style>

      <aside className="rc-rail" aria-label="Navigation principale">
        <div className="rc-brand"><OrionMark /></div>
        <nav className="rc-nav" aria-label="Modules">
          {modules.map(({ label, icon: Icon }) => (
            <button
              type="button"
              key={label}
              className="rc-nav-item"
              aria-label={label}
              aria-current={active === label ? "page" : undefined}
              title={label}
              onClick={() => setActive(label)}
            >
              <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
              <span className="rc-tip" role="tooltip">{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="rc-main">
        <header className="rc-topbar">
          <div className="rc-topbar-start">
            <div className="rc-wordmark"><OrionMark /><span>ComptaOrion</span></div>
            <div className="rc-heading">
              <h1>{active}</h1>
              <p>NERU</p>
            </div>
          </div>
          <div className="rc-top-actions">
            <div className="rc-user" aria-label="Utilisateur">
              <span className="rc-avatar" aria-hidden="true">U</span>
              <span className="rc-user-name">Utilisateur</span>
            </div>
            <button type="button" className="rc-logout" onClick={() => setSessionNotice(true)} aria-label="Déconnexion">
              <LogOut size={15} /><span>Déconnexion</span>
            </button>
          </div>
        </header>

        <main className="rc-content">
          <section className="rc-overview" aria-label="Vue d’ensemble">
            <div>
              <h2>Vue d’ensemble</h2>
              <p>Votre activité financière sur la période sélectionnée</p>
            </div>
            <div className="rc-period" aria-label="Période sélectionnée">
              <CalendarDays size={14} /> 01 janv. – 31 déc. 2026 <ChevronDown size={14} />
            </div>
          </section>

          <div className="rc-demo">Chiffres fictifs · données d’exemple</div>
          <section className="rc-metric-grid" aria-label="Indicateurs financiers">
            {primaryMetrics.map(({ label, value, note, color, Icon }) => (
              <MetricCard key={label} label={label} value={value} note={note} color={color} Icon={Icon} />
            ))}
          </section>

          <section className="rc-cycle" aria-labelledby="rc-cycle-heading">
            <h3 className="rc-section-heading" id="rc-cycle-heading">Cycle de trésorerie</h3>
            <div className="rc-cycle-grid">
              {cycleMetrics.map((metric) => <MetricCard key={metric.label} {...metric} compact />)}
            </div>
          </section>

          <section className="rc-charts" aria-label="Graphiques financiers">
            <article className="rc-chart-card">
              <div className="rc-chart-head">
                <h3>Évolution des ventes (12 mois)</h3>
                <span className="rc-chart-caption">Montants en FCFA</span>
              </div>
              <div className="rc-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sales} margin={{ top: 8, right: 7, left: -17, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#edf0ed" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#839095", fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#879396", fontSize: 9 }} tickFormatter={money} />
                    <Tooltip formatter={(value: number) => [`${value.toLocaleString("fr-FR")} FCFA`, "Ventes"]} contentStyle={{ border: "1px solid #e4e9e5", borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="value" fill="#397ca1" radius={[4, 4, 0, 0]} maxBarSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="rc-chart-card">
              <div className="rc-chart-head">
                <h3>Répartition des dépenses</h3>
                <span className="rc-chart-caption">Part par catégorie</span>
              </div>
              <div className="rc-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenses} dataKey="value" nameKey="name" innerRadius={55} outerRadius={84} paddingAngle={3} stroke="none">
                      {expenses.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} %`, "Part"]} contentStyle={{ border: "1px solid #e4e9e5", borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="rc-legend">
                {expenses.map((item) => <span key={item.name}><i className="rc-dot" style={{ background: item.color }} />{item.name} {item.value}%</span>)}
              </div>
            </article>
          </section>
        </main>
      </div>
      {sessionNotice && (
        <div className="rc-notice" role="status" onClick={() => setSessionNotice(false)}>
          Déconnexion non activée dans cet aperçu · fermer
        </div>
      )}
    </div>
  );
}
