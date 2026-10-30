import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowDownRight, ArrowUpRight, Boxes, Building2, CalendarDays, ChartNoAxesCombined,
  ChevronDown, CircleDollarSign, ClipboardList, Command, FileText, Landmark, LogOut,
  Menu as MenuIcon, Package, Settings2, Users, Wallet, X,
} from "lucide-react";

const modules = [
  { label: "Tableau de Bord", icon: ChartNoAxesCombined },
  { label: "Clients", icon: Users },
  { label: "Fournisseurs", icon: Building2 },
  { label: "Trésorerie", icon: Wallet },
  { label: "Stock", icon: Boxes },
  { label: "Comptabilité", icon: FileText },
  { label: "Comptabilité associations", icon: Landmark },
  { label: "Impôts (en préparation)", icon: ClipboardList },
  { label: "Intégrations", icon: Command },
  { label: "Paramètres", icon: Settings2 },
];

const sales = [
  { month: "Jan", value: 1800000 },
  { month: "Fév", value: 2450000 },
  { month: "Mar", value: 1950000 },
  { month: "Avr", value: 2900000 },
  { month: "Mai", value: 2600000 },
  { month: "Juin", value: 3200000 },
];

const expenses = [
  { name: "Achats", value: 48, color: "#3979a4" },
  { name: "Salaires", value: 27, color: "#d3a34c" },
  { name: "Transport", value: 15, color: "#6a9d91" },
  { name: "Autres", value: 10, color: "#a8b2b8" },
];

const primaryMetrics = [
  { label: "Ventes", value: "3 200 000", unit: "XOF", note: "Période en cours", color: "teal", icon: ArrowUpRight },
  { label: "Dépenses", value: "2 420 000", unit: "XOF", note: "Période en cours", color: "rose", icon: ArrowDownRight },
  { label: "Marge brute", value: "24,4", unit: "%", note: "CA 3,2 M · CMV 2,42 M", color: "blue", icon: ChartNoAxesCombined },
  { label: "Cashflow", value: "780 000", unit: "XOF", note: "", color: "teal", icon: CircleDollarSign },
  { label: "Factures en retard", value: "3", unit: "", note: "420 000 XOF", color: "gold", icon: FileText },
  { label: "Stock faible", value: "2 produits", unit: "", note: "", color: "slate", icon: Package },
];

const cycleMetrics = [
  { label: "Délai paiement clients (DSO)", value: "24 jours", color: "blue" },
  { label: "Délai paiement fournisseurs (DPO)", value: "18 jours", color: "teal" },
  { label: "Rotation stock (DIO)", value: "42 jours", color: "gold" },
  { label: "Cycle conversion trésorerie (CCC)", value: "48 jours", color: "teal" },
  { label: "Valeur stock", value: "5 240 000 XOF", color: "blue" },
  { label: "CMV", value: "2 420 000 XOF", color: "slate" },
];

function MetricCard({ metric }) {
  const Icon = metric.icon;
  return (
    <article className={`fw-metric fw-${metric.color}`}>
      <div className="fw-metric-top">
        <span>{metric.label}</span>
        {Icon && <Icon size={17} strokeWidth={1.8} aria-hidden="true" />}
      </div>
      <strong>{metric.value}{metric.unit && <small> {metric.unit}</small>}</strong>
      {metric.note && <p>{metric.note}</p>}
    </article>
  );
}

export function FocusWorkspace() {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [activeModule, setActiveModule] = useState("Tableau de Bord");

  return (
    <div className="fw-app">
      <style>{`
        .fw-app, .fw-app * { box-sizing: border-box; }
        .fw-app {
          --ink: #203344; --muted: #72818a; --line: #e4e9e7; --paper: #f6f8f5;
          --blue: #3979a4; --gold: #c3923f;
          min-height: 100vh; background: var(--paper); color: var(--ink);
          font-family: "DM Sans", "Avenir Next", sans-serif; position: relative;
        }
        .fw-topbar {
          height: 76px; padding: 0 clamp(18px, 4vw, 54px); display: flex; align-items: center;
          justify-content: space-between; gap: 22px; background: #fbfcfa;
          border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 5;
        }
        .fw-left, .fw-brand, .fw-heading, .fw-actions, .fw-user, .fw-period {
          display: flex; align-items: center;
        }
        .fw-left { gap: 22px; min-width: 0; }
        .fw-brand { gap: 10px; flex-shrink: 0; }
        .fw-mark {
          width: 38px; height: 38px; display: grid; place-items: center; position: relative;
          border-radius: 12px; color: #fff; background: #315f7c; overflow: hidden;
          font: 700 14px/1 "Sora", sans-serif; letter-spacing: -1px;
        }
        .fw-mark:before { content: ""; position: absolute; width: 10px; height: 10px; border: 1.5px solid #e3bd75; border-radius: 50%; right: 5px; top: 5px; }
        .fw-mark span { position: relative; margin-left: -3px; margin-top: 2px; }
        .fw-brand-copy { display: grid; gap: 2px; }
        .fw-brand-copy strong { font: 700 14px/1.1 "Sora", sans-serif; letter-spacing: -.45px; }
        .fw-brand-copy small { font-size: 10px; color: #849197; letter-spacing: .035em; }
        .fw-divider { width: 1px; height: 32px; background: var(--line); }
        .fw-heading { display: grid; align-content: center; gap: 3px; min-width: 0; }
        .fw-heading h1 { margin: 0; font: 650 16px/1.2 "Sora", sans-serif; letter-spacing: -.35px; white-space: nowrap; }
        .fw-heading span { color: #788790; font-size: 11px; }
        .fw-heading b { color: #36586c; font-weight: 650; }
        .fw-icon-button {
          width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid #dfe6e4;
          background: #fff; color: #385569; border-radius: 10px; cursor: pointer; transition: background .18s, transform .18s;
        }
        .fw-icon-button:hover { background: #eff4f1; transform: translateY(-1px); }
        .fw-actions { gap: 18px; flex-shrink: 0; }
        .fw-user { gap: 9px; color: #52636c; font-size: 12px; font-weight: 600; }
        .fw-avatar { width: 31px; height: 31px; border-radius: 50%; display: grid; place-items: center; color: #315f7c; background: #e5eff2; font-size: 12px; }
        .fw-logout { border: 0; padding: 8px 0; background: transparent; color: #68767b; display: flex; align-items: center; gap: 7px; font: inherit; font-size: 12px; cursor: pointer; }
        .fw-logout:hover { color: #a5554a; }
        .fw-navigation {
          position: absolute; z-index: 9; top: 65px; left: clamp(18px, 4vw, 54px);
          width: min(330px, calc(100vw - 32px)); padding: 12px; border: 1px solid #dfe7e4;
          border-radius: 14px; background: #fff; box-shadow: 0 18px 48px rgba(31,55,68,.16);
          animation: fw-enter .16s ease-out both;
        }
        @keyframes fw-enter { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .fw-nav-head { display: flex; align-items: center; justify-content: space-between; padding: 5px 7px 11px; color: #77858b; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
        .fw-nav-close { width: 25px; height: 25px; display: grid; place-items: center; border: 0; border-radius: 7px; color: #718188; background: transparent; cursor: pointer; }
        .fw-nav-close:hover { background: #f1f5f3; }
        .fw-nav-list { display: grid; gap: 3px; }
        .fw-nav-item { width: 100%; min-height: 39px; padding: 7px 9px; display: flex; align-items: center; gap: 11px; text-align: left; border: 0; border-radius: 8px; background: transparent; color: #52636b; font: inherit; font-size: 12px; cursor: pointer; }
        .fw-nav-item svg { color: #829197; }
        .fw-nav-item:hover { background: #f4f7f5; }
        .fw-nav-item.is-active { color: #285875; background: #eaf2f3; font-weight: 650; }
        .fw-nav-item.is-active svg { color: #3979a4; }
        .fw-content { max-width: 1480px; margin: 0 auto; padding: 30px clamp(18px, 4vw, 54px) 48px; }
        .fw-overview { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-bottom: 16px; }
        .fw-eyebrow { color: #8a969a; font-size: 10px; font-weight: 650; letter-spacing: .11em; text-transform: uppercase; margin: 0 0 7px; }
        .fw-overview h2 { margin: 0; color: #203344; font: 600 25px/1.18 "Sora", sans-serif; letter-spacing: -.8px; }
        .fw-overview p { margin: 7px 0 0; color: #718087; font-size: 12px; }
        .fw-period { gap: 9px; min-height: 37px; padding: 0 12px; color: #53666e; background: #fff; border: 1px solid #e0e7e4; border-radius: 8px; font: inherit; font-size: 11px; white-space: nowrap; }
        .fw-sample { margin: 0 0 12px; color: #8b9698; font-size: 10px; text-align: right; }
        .fw-primary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 11px; }
        .fw-metric { min-width: 0; min-height: 111px; padding: 15px 16px 13px; position: relative; overflow: hidden; background: #fff; border: 1px solid #e3e9e6; border-radius: 11px; }
        .fw-metric:before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--accent); }
        .fw-metric-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #78868b; font-size: 11px; line-height: 1.3; }
        .fw-metric-top svg { color: var(--accent); flex-shrink: 0; }
        .fw-metric strong { display: block; margin-top: 13px; color: #2d414e; font: 650 20px/1.1 "Sora", sans-serif; letter-spacing: -.6px; }
        .fw-metric strong small { color: #79868a; font: 500 10px/1 "DM Sans", sans-serif; letter-spacing: 0; }
        .fw-metric p { margin: 5px 0 0; color: #99a3a4; font-size: 10px; }
        .fw-teal { --accent: #398477; } .fw-rose { --accent: #b56961; } .fw-blue { --accent: #3979a4; }
        .fw-gold { --accent: #bb8a36; } .fw-slate { --accent: #73828a; }
        .fw-cycle { margin-top: 26px; }
        .fw-section-heading { display: flex; align-items: center; gap: 9px; margin: 0 0 11px; color: #425762; font: 600 13px/1.3 "Sora", sans-serif; }
        .fw-section-heading:before { content: ""; width: 3px; height: 15px; border-radius: 3px; background: #c79b50; }
        .fw-cycle-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 9px; }
        .fw-cycle-grid .fw-metric { min-height: 83px; padding: 12px 12px 11px; border-radius: 9px; }
        .fw-cycle-grid .fw-metric-top { font-size: 10px; min-height: 24px; }
        .fw-cycle-grid .fw-metric-top svg { display: none; }
        .fw-cycle-grid .fw-metric strong { margin-top: 8px; font-size: 15px; letter-spacing: -.35px; }
        .fw-charts { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(300px, .9fr); gap: 12px; margin-top: 25px; }
        .fw-chart-card { min-width: 0; padding: 16px 17px 11px; border: 1px solid #e3e9e6; border-radius: 11px; background: #fff; }
        .fw-chart-title { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
        .fw-chart-title h3 { margin: 0; color: #3b505b; font: 600 12px/1.4 "Sora", sans-serif; }
        .fw-chart-title span { color: #9aa4a5; font-size: 9px; }
        .fw-chart { width: 100%; height: 226px; }
        .fw-tooltip { padding: 8px 10px; border: 1px solid #e1e8e5; border-radius: 7px; color: #40545e; background: #fff; font-size: 11px; box-shadow: 0 6px 20px rgba(30,48,56,.08); }
        .fw-legend { display: flex; justify-content: center; flex-wrap: wrap; gap: 11px; margin: -4px 0 3px; }
        .fw-legend span { display: inline-flex; align-items: center; gap: 5px; color: #768389; font-size: 10px; }
        .fw-legend i { width: 7px; height: 7px; border-radius: 2px; display: inline-block; }
        @media (min-width: 1200px) { .fw-primary-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
        @media (max-width: 920px) {
          .fw-cycle-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .fw-charts { grid-template-columns: 1fr 1fr; }
          .fw-actions { gap: 11px; }
        }
        @media (max-width: 650px) {
          .fw-topbar { min-height: 68px; height: auto; padding: 10px 15px; gap: 10px; }
          .fw-left { gap: 11px; }
          .fw-divider { display: none; }
          .fw-brand-copy small { display: none; }
          .fw-brand-copy strong { font-size: 12px; }
          .fw-mark { width: 34px; height: 34px; }
          .fw-heading h1 { font-size: 13px; }
          .fw-heading span { font-size: 10px; }
          .fw-actions { gap: 8px; }
          .fw-user { gap: 0; }
          .fw-user > span:last-child { display: none; }
          .fw-logout span:last-child { display: none; }
          .fw-logout { padding: 7px; }
          .fw-content { padding: 23px 15px 34px; }
          .fw-overview { align-items: flex-start; flex-direction: column; gap: 14px; }
          .fw-overview h2 { font-size: 22px; }
          .fw-period { align-self: stretch; justify-content: space-between; }
          .fw-primary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .fw-metric { min-height: 104px; padding: 13px 13px 11px; }
          .fw-metric strong { font-size: 17px; }
          .fw-cycle { margin-top: 22px; }
          .fw-cycle-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .fw-cycle-grid .fw-metric { min-height: 78px; }
          .fw-charts { grid-template-columns: 1fr; margin-top: 21px; }
          .fw-chart { height: 215px; }
          .fw-chart-title span { display: none; }
          .fw-navigation { top: 61px; left: 12px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fw-app *, .fw-app *:before { animation-duration: .01ms !important; transition-duration: .01ms !important; }
        }
      `}</style>

      <header className="fw-topbar">
        <div className="fw-left">
          <button
            className="fw-icon-button"
            type="button"
            aria-label={navigationOpen ? "Fermer la navigation" : "Ouvrir la navigation"}
            aria-expanded={navigationOpen}
            aria-controls="fw-navigation"
            onClick={() => setNavigationOpen((open) => !open)}
          >
            {navigationOpen ? <X size={18} /> : <MenuIcon size={19} />}
          </button>
          <div className="fw-brand" aria-label="ComptaOrion">
            <div className="fw-mark" aria-hidden="true"><span>CO</span></div>
            <div className="fw-brand-copy"><strong>ComptaOrion</strong><small>GESTION FINANCIÈRE</small></div>
          </div>
          <div className="fw-divider" aria-hidden="true" />
          <div className="fw-heading">
            <h1>{activeModule}</h1>
            <span>Entreprise · <b>NERU</b></span>
          </div>
        </div>
        <div className="fw-actions">
          <div className="fw-user"><span className="fw-avatar">U</span><span>Utilisateur</span></div>
          <button type="button" className="fw-logout" aria-label="Déconnexion"><LogOut size={15} /><span>Déconnexion</span></button>
        </div>
      </header>

      {navigationOpen && (
        <nav id="fw-navigation" className="fw-navigation" aria-label="Navigation principale">
          <div className="fw-nav-head"><span>Modules</span><button className="fw-nav-close" type="button" aria-label="Fermer la navigation" onClick={() => setNavigationOpen(false)}><X size={15} /></button></div>
          <div className="fw-nav-list">
            {modules.map(({ label, icon: Icon }) => (
              <button
                type="button"
                key={label}
                className={`fw-nav-item${activeModule === label ? " is-active" : ""}`}
                aria-current={activeModule === label ? "page" : undefined}
                onClick={() => { setActiveModule(label); setNavigationOpen(false); }}
              >
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="fw-content">
        <section className="fw-overview">
          <div>
            <p className="fw-eyebrow">Vue financière</p>
            <h2>Vue d’ensemble</h2>
            <p>Votre activité financière sur la période sélectionnée</p>
          </div>
          <button className="fw-period" type="button"><CalendarDays size={15} />01 janv. – 31 déc. 2026<ChevronDown size={14} /></button>
        </section>

        <p className="fw-sample">Chiffres fictifs · Données d’exemple</p>
        <section className="fw-primary-grid" aria-label="Indicateurs financiers">
          {primaryMetrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
        </section>

        <section className="fw-cycle" aria-labelledby="fw-cycle-title">
          <h3 className="fw-section-heading" id="fw-cycle-title">Cycle de trésorerie</h3>
          <div className="fw-cycle-grid">
            {cycleMetrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
          </div>
        </section>

        <section className="fw-charts" aria-label="Graphiques financiers">
          <article className="fw-chart-card">
            <div className="fw-chart-title"><h3>Évolution des ventes (12 mois)</h3><span>Montants en XOF</span></div>
            <div className="fw-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sales} margin={{ top: 14, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#edf0ee" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#879397", fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#879397", fontSize: 9 }} tickFormatter={(value) => `${Math.round(value / 1000000)}M`} />
                  <Tooltip contentStyle={{ border: "1px solid #e1e8e5", borderRadius: 8, fontSize: 11 }} formatter={(value) => [`${Number(value).toLocaleString("fr-FR")} XOF`, "Ventes"]} />
                  <Bar dataKey="value" fill="#3979a4" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
          <article className="fw-chart-card">
            <div className="fw-chart-title"><h3>Répartition des dépenses</h3><span>Par catégorie</span></div>
            <div className="fw-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenses} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={3} stroke="none">
                    {expenses.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ border: "1px solid #e1e8e5", borderRadius: 8, fontSize: 11 }} formatter={(value, name) => [`${value}%`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="fw-legend">{expenses.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name} {item.value}%</span>)}</div>
          </article>
        </section>
      </main>
    </div>
  );
}
