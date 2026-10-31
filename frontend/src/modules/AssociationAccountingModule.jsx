import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api';

const today = () => new Date().toISOString().slice(0, 10);
const amount = (value) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
const styles = {
  panel: { background: '#fff', border: '1px solid #e5e9f0', borderRadius: 14, padding: 22 },
  button: { border: 0, borderRadius: 9, padding: '10px 15px', background: '#176b54', color: '#fff', cursor: 'pointer', fontWeight: 650 },
  secondary: { border: '1px solid #d8e2e7', borderRadius: 9, padding: '9px 13px', background: '#fff', color: '#29443d', cursor: 'pointer', fontWeight: 600 },
  input: { boxSizing: 'border-box', width: '100%', border: '1px solid #d4dce4', borderRadius: 8, padding: '10px 12px', background: '#fff', color: '#24333e' },
  label: { display: 'grid', gap: 6, color: '#43535e', fontSize: 13, fontWeight: 600 },
};

const emptyProject = () => ({
  code: '', nom: '', description: '', bailleur: '', referenceConvention: '',
  dateDebut: today(), dateFin: '', budgetTotal: '', devise: 'XOF',
});
const cash = (value, currency = 'XOF') => {
  const code = String(currency || 'XOF').trim().toUpperCase();
  return `${amount(value)} ${code === 'FCFA' ? 'XOF' : code}`;
};
const newPaymentRequestKey = () => `asso-payment-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const statusLabel = { actif: 'En cours', suspendu: 'Suspendu', termine: 'Terminé', archive: 'Archivé' };
const statusColor = { actif: '#13734d', suspendu: '#a4530d', termine: '#526170', archive: '#657584' };

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadProjectReport(report) {
  const rows = [
    ['Projet', report.project.code, report.project.nom],
    ['Poste budgetaire', 'Budget alloue'],
    ...report.budgets.map((line) => [line.poste, line.montantAlloue, line.compteNumero || '']),
    [],
    ['Depenses', 'Date', 'Categorie', 'Description', 'Montant total', 'Montant paye', 'Solde a payer', 'Statut de paiement', 'Etat approbation', 'Details des paiements'],
    ...report.expenses.map((item) => [
      item.id, item.dateDepense, item.categorie, item.description, item.montant,
      item.montantPaye ?? 0, item.soldeAPayer ?? item.montant,
      item.statutPaiement || 'non_payee', item.statut,
      (item.paiements || []).map((payment) => [
        payment.datePaiement, payment.montant, payment.numeroPiece,
        payment.ecritureNumero, payment.compteTresorerieNumero, payment.compteChargeNumero,
      ].filter(Boolean).join(' / ')).join(' | '),
    ]),
    [],
    ['Financements', 'Bailleur', 'Reference', 'Montant engage'],
    ...report.financings.map((item) => [item.id, item.bailleur, item.referenceConvention, item.montantEngage]),
    [],
    ['Versements', 'Date', 'Piece', 'Montant', 'Ecriture comptable'],
    ...report.receipts.map((item) => [item.dateVersement, item.numeroPiece, item.montant, item.ecritureNumero]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `suivi-${report.project.code.toLowerCase()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function Field({ label, children }) {
  return <label style={styles.label}><span>{label}</span>{children}</label>;
}

function Empty({ children }) {
  return <div style={{ color: '#677782', textAlign: 'center', padding: '32px 18px' }}>{children}</div>;
}

export function AssociationAccountingModule() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [report, setReport] = useState(null);
  const [unlinkedExpenses, setUnlinkedExpenses] = useState([]);
  const [accounts, setAccounts] = useState({ treasury: [], grants: [], expenseAccounts: [] });
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newProject, setNewProject] = useState(false);
  const [budgetPost, setBudgetPost] = useState({ poste: '', montantAlloue: '' });
  const [pledge, setPledge] = useState({ bailleur: '', referenceConvention: '', montantEngage: '' });
  const [receipt, setReceipt] = useState({ financementId: '', montant: '', dateVersement: today(), numeroPiece: '', compteTresorerieId: '', compteProduitId: '' });
  const [expenseId, setExpenseId] = useState('');
  const [paymentExpenseId, setPaymentExpenseId] = useState(null);
  const [paymentRequestKey, setPaymentRequestKey] = useState('');
  const [paymentForm, setPaymentForm] = useState({
    montant: '', datePaiement: today(), numeroPiece: '', compteTresorerieId: '', compteChargeId: '',
  });
  const [projectForm, setProjectForm] = useState(emptyProject);

  const selected = useMemo(() => projects.find((project) => project.id === selectedId) || null, [projects, selectedId]);

  const loadProjects = useCallback(async (keepSelection = true) => {
    const rows = await api.get('/associations/projects');
    setProjects(rows || []);
    const selectedExists = (rows || []).some((project) => project.id === selectedId);
    if (!keepSelection || !selectedExists) setSelectedId(rows?.[0]?.id || null);
    return rows || [];
  }, [selectedId]);

  const loadProjectDetail = useCallback(async (id) => {
    if (!id) {
      setReport(null);
      return;
    }
    const detail = await api.get(`/associations/projects/${id}/report`);
    setReport(detail);
  }, []);

  const loadPage = useCallback(async () => {
    setError('');
    try {
      await loadProjects();
      const [options, expenses] = await Promise.all([
        api.get('/associations/accounts'),
        api.get('/depenses/list'),
      ]);
       setAccounts(options || { treasury: [], grants: [], expenseAccounts: [] });
      setUnlinkedExpenses((expenses || []).filter((expense) => !expense.projetId));
    } catch (err) {
      setError(err.message || 'Impossible de charger les données associatives.');
    } finally {
      setLoading(false);
    }
  }, [loadProjects]);

  const reloadDetail = useCallback(async () => {
    if (!selectedId) return;
    try {
      await Promise.all([loadProjects(), loadProjectDetail(selectedId)]);
      const expenses = await api.get('/depenses/list');
      setUnlinkedExpenses((expenses || []).filter((expense) => !expense.projetId));
    } catch (err) {
      setError(err.message || 'Impossible de mettre à jour le suivi.');
    }
  }, [loadProjectDetail, loadProjects, selectedId]);

  useEffect(() => { loadPage(); }, [loadPage]);
  useEffect(() => {
    if (!selectedId) { setReport(null); return; }
    loadProjectDetail(selectedId).catch((err) => setError(err.message || 'Impossible de charger le projet.'));
  }, [selectedId, loadProjectDetail]);

  const runAction = async (action, successMessage, closeForm) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
      closeForm?.();
      await reloadDetail();
    } catch (err) {
      setError(err.message || 'L’opération a échoué.');
    } finally {
      setSaving(false);
    }
  };

  const submitProject = (event) => {
    event.preventDefault();
    runAction(async () => {
      const created = await api.post('/associations/projects', { ...projectForm, budgetTotal: Number(projectForm.budgetTotal) });
      const updatedProjects = await loadProjects(false);
      setSelectedId(created.id || updatedProjects.find((project) => project.code === projectForm.code.toUpperCase())?.id || null);
      setTab('overview');
    }, 'Projet créé. Vous pouvez maintenant définir son budget et ses financements.', () => {
      setNewProject(false);
      setProjectForm(emptyProject());
    });
  };

  const addBudget = (event) => {
    event.preventDefault();
    if (!selectedId) return;
    runAction(() => api.post(`/associations/projects/${selectedId}/budgets`, {
      poste: budgetPost.poste.trim(),
      montantAlloue: Number(budgetPost.montantAlloue),
    }), 'Poste ajouté au budget.', () => setBudgetPost({ poste: '', montantAlloue: '' }));
  };

  const addFunding = (event) => {
    event.preventDefault();
    if (!selectedId) return;
    runAction(() => api.post(`/associations/projects/${selectedId}/financings`, {
      ...pledge,
      montantEngage: Number(pledge.montantEngage),
    }), 'Engagement du bailleur enregistré.', () => setPledge({ bailleur: '', referenceConvention: '', montantEngage: '' }));
  };

  const recordReceipt = (event, financingId) => {
    event.preventDefault();
    if (!selectedId) return;
    runAction(() => api.post(`/associations/projects/${selectedId}/financings/${financingId}/receipts`, {
      ...receipt,
      montant: Number(receipt.montant),
      financementId: Number(financingId),
      compteTresorerieId: Number(receipt.compteTresorerieId),
      compteProduitId: Number(receipt.compteProduitId),
    }), 'Versement reçu et écriture comptable équilibrée créée.', () => setReceipt({
      financementId: '', montant: '', dateVersement: today(), numeroPiece: '',
      compteTresorerieId: '', compteProduitId: '',
    }));
  };

  const linkExpense = (event) => {
    event.preventDefault();
    if (!selectedId || !expenseId) return;
    runAction(() => api.post(`/associations/projects/${selectedId}/expenses`, { depenseId: Number(expenseId) }),
      'Dépense rattachée au projet.', () => setExpenseId(''));
  };

  const recordExpensePayment = (event, item) => {
    event.preventDefault();
    if (!selectedId || !item) return;
    const remaining = Number(item.soldeAPayer ?? (Number(item.montant) - Number(item.montantPaye || 0)));
    const paidAmount = Number(paymentForm.montant);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0 || paidAmount > remaining) {
      setError(`Le montant doit être supérieur à 0 et ne pas dépasser le solde de ${cash(remaining, selected.devise)}.`);
      return;
    }
    const requestKey = paymentRequestKey || newPaymentRequestKey();
    setPaymentRequestKey(requestKey);
    runAction(() => api.post(`/associations/projects/${selectedId}/expenses/${item.id}/payments`, {
      montant: paidAmount,
      datePaiement: paymentForm.datePaiement,
      numeroPiece: paymentForm.numeroPiece.trim(),
      compteTresorerieId: Number(paymentForm.compteTresorerieId),
      compteChargeId: Number(paymentForm.compteChargeId),
    }, { headers: { 'X-Idempotency-Key': requestKey } }), 'Paiement enregistré et écriture comptable équilibrée créée.', () => {
      setPaymentExpenseId(null);
      setPaymentRequestKey('');
      setPaymentForm({ montant: '', datePaiement: today(), numeroPiece: '', compteTresorerieId: '', compteChargeId: '' });
    });
  };

  const archiveProject = () => {
    if (!selectedId || !window.confirm('Archiver ce projet ? Ses écritures, dépenses et financements seront conservés.')) return;
    runAction(() => api.put(`/associations/projects/${selectedId}`, { statut: 'archive' }), 'Projet archivé.');
  };

  const tabs = [
    ['overview', 'Vue d’ensemble'],
    ['budgets', 'Budgets'],
    ['financings', 'Bailleurs & versements'],
    ['expenses', 'Dépenses'],
    ['report', 'Rapport'],
  ];

  if (loading) return <div style={{ padding: 32 }}>Chargement de la comptabilité associative…</div>;

  return (
    <main style={{ padding: '26px clamp(14px, 3vw, 36px)', color: '#20313b', maxWidth: 1500, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div style={{ color: '#176b54', fontWeight: 700, fontSize: 12, letterSpacing: '.09em', textTransform: 'uppercase' }}>Gestion associative · SYSCOHADA</div>
          <h1 style={{ margin: '7px 0 5px', fontSize: 'clamp(24px, 4vw, 34px)' }}>Comptabilité des associations</h1>
          <div style={{ color: '#60707c', maxWidth: 720 }}>Budgets par projet, conventions de financement, dépenses et versements reliés aux écritures comptables de l’association.</div>
        </div>
        <button type="button" style={styles.button} onClick={() => setNewProject(true)}>＋ Nouveau projet</button>
      </header>

      {error && <div role="alert" style={{ padding: 13, borderRadius: 9, background: '#fff2f0', color: '#983f35', marginBottom: 14 }}>{error}</div>}
      {notice && <div role="status" style={{ padding: 13, borderRadius: 9, background: '#eaf7ef', color: '#176b54', marginBottom: 14 }}>{notice}</div>}

      {!projects.length && !newProject ? (
        <section style={{ ...styles.panel, textAlign: 'center', padding: '54px 24px' }}>
          <h2>Aucun projet associatif</h2>
          <p style={{ color: '#64737c' }}>Créez un projet pour suivre son budget, ses bailleurs, ses versements et les dépenses liées aux fonctions existantes de l’ERP.</p>
          <button type="button" style={styles.button} onClick={() => setNewProject(true)}>Créer le premier projet</button>
        </section>
      ) : null}

      {projects.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(225px, 290px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
          <aside style={{ ...styles.panel, padding: 12 }}>
            <div style={{ padding: '7px 9px 12px', color: '#60707c', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Portefeuille de projets</div>
            {projects.map((project) => (
              <button key={project.id} type="button" onClick={() => { setSelectedId(project.id); setTab('overview'); setNotice(''); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 7, padding: 12, borderRadius: 9, border: project.id === selectedId ? '1px solid #93c5b0' : '1px solid transparent', background: project.id === selectedId ? '#eff8f3' : '#fff', cursor: 'pointer' }}>
                <strong style={{ display: 'block', color: '#20313b' }}>{project.nom}</strong>
                <span style={{ display: 'block', marginTop: 4, color: '#60707c', fontSize: 12 }}>{project.code} · {cash(project.totals?.spent, project.devise)}</span>
                <span style={{ display: 'inline-block', marginTop: 6, color: statusColor[project.statut], fontSize: 11, fontWeight: 700 }}>{statusLabel[project.statut] || project.statut}</span>
              </button>
            ))}
          </aside>

          {selected && (
            <section style={{ minWidth: 0, display: 'grid', gap: 15 }}>
              <div style={{ ...styles.panel, padding: '17px 21px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ color: '#176b54', fontSize: 12, fontWeight: 700 }}>{selected.code} · {selected.bailleur || 'Financement à préciser'}</div>
                    <h2 style={{ margin: '5px 0', fontSize: 22 }}>{selected.nom}</h2>
                    <div style={{ color: '#64737c', fontSize: 13 }}>{selected.dateDebut} — {selected.dateFin || 'Sans date de fin'} · Budget {cash(selected.budgetTotal, selected.devise)}</div>
                  </div>
                  {selected.statut !== 'archive' && <button type="button" style={styles.secondary} onClick={archiveProject}>Archiver</button>}
                </div>
              </div>

              <nav aria-label="Sections du projet" style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {tabs.map(([id, label]) => (
                  <button type="button" key={id} onClick={() => { setTab(id); setNotice(''); }}
                    aria-current={tab === id ? 'page' : undefined}
                    style={{ ...styles.secondary, background: tab === id ? '#176b54' : '#fff', color: tab === id ? '#fff' : '#29443d', borderColor: tab === id ? '#176b54' : '#d8e2e7' }}>{label}</button>
                ))}
              </nav>

              {tab === 'overview' && report && (
                <section style={{ display: 'grid', gap: 15 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
                    {[
                      ['Budget autorisé', cash(selected.budgetTotal, selected.devise)],
                      ['Dépenses payées', cash(report.totals.spent, selected.devise)],
                      ['Engagements de dépenses', cash(report.totals.committed ?? 0, selected.devise)],
                      ['Solde à payer', cash(report.totals.unpaid ?? 0, selected.devise)],
                      ['Financements reçus', cash(report.totals.received, selected.devise)],
                      ['Reste à financer', cash(Math.max(Number(selected.budgetTotal) - report.totals.received, 0), selected.devise)],
                    ].map(([title, value]) => <div key={title} style={{ ...styles.panel, padding: 17 }}><div style={{ fontSize: 12, color: '#60707c' }}>{title}</div><strong style={{ display: 'block', fontSize: 20, marginTop: 6 }}>{value}</strong></div>)}
                  </div>
                  <section style={styles.panel}>
                    <h3 style={{ marginTop: 0 }}>Exécution du budget</h3>
                    <div style={{ color: '#60707c', fontSize: 13, marginBottom: 9 }}>
                      {cash(report.totals.budgetLines, selected.devise)} ventilés sur {cash(selected.budgetTotal, selected.devise)} · {cash(report.totals.spent, selected.devise)} de dépenses saisies
                    </div>
                    <div role="progressbar" aria-label="Budget réparti en postes" aria-valuenow={Math.min(100, Math.round(report.totals.budgetLines / Math.max(Number(selected.budgetTotal), 1) * 100))} style={{ height: 10, background: '#e9eff0', borderRadius: 9, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, report.totals.budgetLines / Math.max(Number(selected.budgetTotal), 1) * 100)}%`, height: '100%', background: report.totals.budgetAllocatedRemaining < 0 ? '#cc554c' : '#359671' }} />
                    </div>
                  </section>
                  <section style={styles.panel}>
                    <h3 style={{ marginTop: 0 }}>Dernières opérations</h3>
                    {report.expenses.length === 0 && report.receipts.length === 0 ? <Empty>Aucune dépense ou recette pour ce projet.</Empty> : (
                      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr>{['Date', 'Opération', 'Poste / bailleur', 'Montant', 'Statut'].map((heading) => <th key={heading} style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid #e5e9f0', color: '#687680' }}>{heading}</th>)}</tr></thead>
                        <tbody>{[
                          ...report.expenses.map((item) => ({ date: item.dateDepense, description: item.description || 'Dépense', source: item.categorie || 'Dépense', montant: item.montant, status: item.statut || 'en_attente', key: `e-${item.id}` })),
                          ...report.receipts.map((item) => ({ date: item.dateVersement, description: `Versement ${item.ecritureNumero || ''}`.trim(), source: report.financings.find((f) => f.id === item.financementId)?.bailleur || 'Financement', montant: item.montant, status: 'Comptabilisé', key: `r-${item.id}` })),
                        ].slice(0, 8).map((item) => <tr key={item.key}><td style={{ padding: 10, borderBottom: '1px solid #eef1f3' }}>{String(item.date || '').slice(0, 10)}</td><td style={{ padding: 10, borderBottom: '1px solid #eef1f3' }}>{item.description}</td><td style={{ padding: 10, borderBottom: '1px solid #eef1f3' }}>{item.source}</td><td style={{ padding: 10, borderBottom: '1px solid #eef1f3' }}>{cash(item.montant, selected.devise)}</td><td style={{ padding: 10, borderBottom: '1px solid #eef1f3' }}>{item.status}</td></tr>)}</tbody>
                      </table></div>
                    )}
                  </section>
                </section>
              )}

              {tab === 'budgets' && report && (
                <section style={{ display: 'grid', gap: 15 }}>
                  <form onSubmit={addBudget} style={{ ...styles.panel, display: 'grid', gridTemplateColumns: 'minmax(160px,1.5fr) minmax(140px,.7fr) auto', gap: 11, alignItems: 'end' }}>
                    <Field label="Poste budgétaire"><input style={styles.input} value={budgetPost.poste} maxLength={160} placeholder="Ex. Formation communautaire" onChange={(event) => setBudgetPost({ ...budgetPost, poste: event.target.value })} required /></Field>
                    <Field label={`Montant alloué (${selected.devise})`}><input style={styles.input} type="number" step="0.01" min="0.01" value={budgetPost.montantAlloue} onChange={(event) => setBudgetPost({ ...budgetPost, montantAlloue: event.target.value })} required /></Field>
                    <button style={styles.button} disabled={saving} type="submit">Ajouter</button>
                  </form>
                  <section style={styles.panel}>
                    <h3 style={{ marginTop: 0 }}>Ventilation budgétaire</h3>
                    {report.budgets.length === 0 ? <Empty>Ajoutez les lignes du budget approuvé. Le total des postes ne peut dépasser le budget du projet.</Empty> :
                      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>{['Poste', 'Compte SYSCOHADA', 'Budget'].map((label) => <th key={label} style={{ padding: 10, textAlign: 'left', color: '#60707c', borderBottom: '1px solid #e5e9f0' }}>{label}</th>)}</tr></thead>
                        <tbody>{report.budgets.map((line) => <tr key={line.id}><td style={{ padding: 11, borderBottom: '1px solid #edf0f2' }}>{line.poste}</td><td style={{ padding: 11, borderBottom: '1px solid #edf0f2' }}>{line.compteNumero ? `${line.compteNumero} · ${line.compteNom}` : '—'}</td><td style={{ padding: 11, borderBottom: '1px solid #edf0f2' }}>{cash(line.montantAlloue, selected.devise)}</td></tr>)}</tbody>
                        <tfoot><tr><th colSpan="2" style={{ textAlign: 'left', padding: 11 }}>Total réparti</th><th style={{ textAlign: 'left', padding: 11 }}>{cash(report.totals.budgetLines, selected.devise)}</th></tr></tfoot>
                      </table></div>}
                    <div style={{ marginTop: 12, color: '#60707c', fontSize: 12 }}>Budget restant à répartir : {cash(report.totals.budgetAllocatedRemaining, selected.devise)}.</div>
                  </section>
                </section>
              )}

              {tab === 'financings' && report && (
                <section style={{ display: 'grid', gap: 15 }}>
                  <form onSubmit={addFunding} style={{ ...styles.panel, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 11, alignItems: 'end' }}>
                    <Field label="Bailleur / partenaire"><input style={styles.input} value={pledge.bailleur} onChange={(event) => setPledge({ ...pledge, bailleur: event.target.value })} maxLength={255} required /></Field>
                    <Field label="Convention / référence"><input style={styles.input} value={pledge.referenceConvention} onChange={(event) => setPledge({ ...pledge, referenceConvention: event.target.value })} maxLength={120} /></Field>
                    <Field label={`Financement engagé (${selected.devise})`}><input style={styles.input} type="number" min="0.01" step="0.01" value={pledge.montantEngage} onChange={(event) => setPledge({ ...pledge, montantEngage: event.target.value })} required /></Field>
                    <button type="submit" style={styles.button} disabled={saving}>Enregistrer l’engagement</button>
                  </form>
                  {report.financings.length === 0 ? <section style={styles.panel}><Empty>Aucun engagement financier enregistré pour ce projet.</Empty></section> :
                    report.financings.map((financing) => {
                      const paid = report.receipts.filter((item) => item.financementId === financing.id).reduce((sum, item) => sum + Number(item.montant), 0);
                      return <article key={financing.id} style={{ ...styles.panel, display: 'grid', gap: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15, flexWrap: 'wrap' }}>
                          <div><strong>{financing.bailleur}</strong><div style={{ color: '#62717d', fontSize: 13, marginTop: 5 }}>{financing.referenceConvention || 'Sans référence'}</div></div>
                          <div style={{ textAlign: 'right' }}><strong>{cash(paid, selected.devise)} / {cash(financing.montantEngage, selected.devise)}</strong><div style={{ color: '#62717d', fontSize: 12 }}>Reçu / engagé · reste {cash(Math.max(0, Number(financing.montantEngage) - paid), selected.devise)}</div></div>
                        </div>
                        {paid + 0.005 < Number(financing.montantEngage) && (
                          <form onSubmit={(event) => recordReceipt(event, financing.id)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))', gap: 10, paddingTop: 13, borderTop: '1px solid #e8ecef' }}>
                            <Field label={`Versement reçu (${selected.devise})`}><input style={styles.input} type="number" min="0.01" max={Number(financing.montantEngage) - paid} step="0.01" value={receipt.financementId === String(financing.id) ? receipt.montant : ''} onChange={(event) => setReceipt({ ...receipt, financementId: String(financing.id), montant: event.target.value })} required /></Field>
                            <Field label="Date du reçu"><input style={styles.input} type="date" value={receipt.dateVersement} onChange={(event) => setReceipt({ ...receipt, dateVersement: event.target.value })} required /></Field>
                            <Field label="Nº de pièce"><input style={styles.input} value={receipt.numeroPiece} maxLength={120} onChange={(event) => setReceipt({ ...receipt, numeroPiece: event.target.value })} /></Field>
                            <Field label="Compte banque / caisse"><select style={styles.input} value={receipt.financementId === String(financing.id) ? receipt.compteTresorerieId : ''} onChange={(event) => setReceipt({ ...receipt, financementId: String(financing.id), compteTresorerieId: event.target.value })} required><option value="">Choisir</option>{accounts.treasury.map((item) => <option key={item.id} value={item.id}>{item.numero} · {item.nom}</option>)}</select></Field>
                            <Field label="Compte de subvention / don"><select style={styles.input} value={receipt.financementId === String(financing.id) ? receipt.compteProduitId : ''} onChange={(event) => setReceipt({ ...receipt, financementId: String(financing.id), compteProduitId: event.target.value })} required><option value="">Choisir</option>{accounts.grants.map((item) => <option key={item.id} value={item.id}>{item.numero} · {item.nom}</option>)}</select></Field>
                            <button type="submit" style={{ ...styles.button, alignSelf: 'end' }} disabled={saving || !accounts.treasury.length || !accounts.grants.length}>Comptabiliser le reçu</button>
                          </form>
                        )}
                        {paid > 0 && <div style={{ display: 'grid', gap: 6 }}>{report.receipts.filter((item) => item.financementId === financing.id).map((item) => <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', color: '#566671', fontSize: 13 }}><span>{item.dateVersement} · pièce {item.numeroPiece || '—'} · écriture {item.ecritureNumero}</span><strong>{cash(item.montant, selected.devise)}</strong></div>)}</div>}
                      </article>;
                    })}
                  {(!accounts.treasury.length || !accounts.grants.length) && <p style={{ ...styles.panel, color: '#8a5516' }}>Le plan SYSCOHADA doit être initialisé et contenir des comptes banque/caisse (51–57) et subventions/dons (13, 14, 71 ou 74) pour comptabiliser un reçu.</p>}
                </section>
              )}

              {tab === 'expenses' && report && (
                <section style={{ display: 'grid', gap: 15 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 10 }}>
                    {[
                      ['Dépenses engagées', cash(report.totals.committed ?? 0, selected.devise), 'Engagements actifs'],
                      ['Réellement payé', cash(report.totals.spent ?? 0, selected.devise), 'Décaissements comptabilisés'],
                      ['Solde à payer', cash(report.totals.unpaid ?? 0, selected.devise), 'Reste dû sur les dépenses'],
                      ['En attente d’approbation', cash(report.totals.pendingApproval ?? 0, selected.devise), 'Montant des dossiers à valider'],
                    ].map(([label, value, caption]) => (
                      <div key={label} style={{ ...styles.panel, padding: 15 }}>
                        <div style={{ color: '#60707c', fontSize: 12 }}>{label}</div>
                        <strong style={{ display: 'block', fontSize: 18, marginTop: 5 }}>{value}</strong>
                        <div style={{ color: '#829098', fontSize: 11, marginTop: 3 }}>{caption}</div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={linkExpense} style={{ ...styles.panel, display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) auto', gap: 11, alignItems: 'end' }}>
                    <Field label="Rattacher une dépense existante">
                      <select style={styles.input} value={expenseId} onChange={(event) => setExpenseId(event.target.value)} required>
                        <option value="">Choisir une dépense de l’ERP</option>
                        {unlinkedExpenses.map((item) => <option key={item.id} value={item.id}>#{item.id} · {String(item.dateDepense).slice(0, 10)} · {item.description || 'Dépense'} · {cash(item.montant, selected.devise)}</option>)}
                      </select>
                    </Field>
                    <button type="submit" style={styles.button} disabled={saving || !unlinkedExpenses.length}>Rattacher au projet</button>
                  </form>
                  <section style={styles.panel}>
                    <h3 style={{ marginTop: 0 }}>Dépenses du module existant</h3>
                    {report.expenses.length === 0 ? <Empty>Choisissez une dépense existante ci-dessus ou sélectionnez ce projet lors de la création d’une dépense.</Empty> :
                      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr>{['Date', 'Description / catégorie', 'Total', 'Payé', 'Solde dû', 'Approbation', 'Paiement', 'Action'].map((label) => <th key={label} style={{ textAlign: 'left', padding: 9, borderBottom: '1px solid #e5e9f0', color: '#60707c', whiteSpace: 'nowrap' }}>{label}</th>)}</tr></thead>
                        <tbody>{report.expenses.map((item) => {
                          const paid = Number(item.montantPaye ?? 0);
                          const due = Math.max(0, Number(item.soldeAPayer ?? (Number(item.montant) - paid)));
                          const paymentState = {
                            non_payee: ['Non payée', '#9b4d35', '#fff1eb'],
                            partiellement_payee: ['Partiellement payée', '#8a5b14', '#fff7e6'],
                            payee: ['Payée', '#176b54', '#eaf7ef'],
                          }[item.statutPaiement] || [item.statutPaiement || 'Non payée', '#53636e', '#f0f3f3'];
                          return <React.Fragment key={item.id}>
                            <tr>
                              <td style={{ padding: 10, borderBottom: '1px solid #edf0f2', whiteSpace: 'nowrap' }}>{String(item.dateDepense || '').slice(0, 10)}</td>
                              <td style={{ padding: 10, borderBottom: '1px solid #edf0f2', minWidth: 170 }}><strong>{item.description || 'Dépense'}</strong><div style={{ color: '#687680', fontSize: 12, marginTop: 3 }}>{item.categorie || 'Sans catégorie'}</div></td>
                              <td style={{ padding: 10, borderBottom: '1px solid #edf0f2', whiteSpace: 'nowrap' }}>{cash(item.montant, selected.devise)}</td>
                              <td style={{ padding: 10, borderBottom: '1px solid #edf0f2', whiteSpace: 'nowrap', color: '#176b54', fontWeight: 700 }}>{cash(paid, selected.devise)}</td>
                              <td style={{ padding: 10, borderBottom: '1px solid #edf0f2', whiteSpace: 'nowrap', color: due > 0 ? '#9b4d35' : '#53636e', fontWeight: 700 }}>{cash(due, selected.devise)}</td>
                              <td style={{ padding: 10, borderBottom: '1px solid #edf0f2', whiteSpace: 'nowrap' }}>{item.statut || '—'}</td>
                              <td style={{ padding: 10, borderBottom: '1px solid #edf0f2' }}><span style={{ display: 'inline-block', borderRadius: 99, padding: '4px 8px', color: paymentState[1], background: paymentState[2], fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{paymentState[0]}</span></td>
                              <td style={{ padding: 10, borderBottom: '1px solid #edf0f2', whiteSpace: 'nowrap' }}>
                                {due > 0 && <button type="button" style={styles.button} disabled={saving} onClick={() => {
                                  setPaymentExpenseId(paymentExpenseId === item.id ? null : item.id);
                                  setPaymentRequestKey('');
                                  setPaymentForm({ montant: '', datePaiement: today(), numeroPiece: '', compteTresorerieId: '', compteChargeId: '' });
                                  setError('');
                                }}>{paymentExpenseId === item.id ? 'Fermer' : 'Enregistrer un paiement'}</button>}
                                <button type="button" style={{ ...styles.secondary, color: '#a33b35', marginLeft: 7 }} disabled={saving} onClick={() => runAction(() => api.delete(`/associations/projects/${selected.id}/expenses/${item.id}`), 'Dépense détachée.')}>Détacher</button>
                              </td>
                            </tr>
                            {(item.paiements?.length > 0 || paymentExpenseId === item.id) && <tr>
                              <td colSpan="8" style={{ padding: '10px 14px 14px', background: '#f8faf9', borderBottom: '1px solid #edf0f2' }}>
                                {item.paiements?.length > 0 && <div style={{ display: 'grid', gap: 7, marginBottom: paymentExpenseId === item.id ? 14 : 0 }}>
                                  <strong style={{ color: '#52636d', fontSize: 12 }}>Historique des paiements</strong>
                                  {item.paiements.map((payment) => <div key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', color: '#596a73', fontSize: 12, padding: '7px 0', borderTop: '1px solid #e8eeeb' }}>
                                    <span>{String(payment.datePaiement || '').slice(0, 10)} · Pièce {payment.numeroPiece || '—'} · Écriture {payment.ecritureNumero || '—'}</span>
                                    <span>{payment.compteTresorerieNumero || 'Trésorerie —'} → {payment.compteChargeNumero || 'Charge —'}</span>
                                    <strong>{cash(payment.montant, selected.devise)}</strong>
                                  </div>)}
                                </div>}
                                {paymentExpenseId === item.id && <form onSubmit={(event) => recordExpensePayment(event, item)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, alignItems: 'end', paddingTop: 11, borderTop: item.paiements?.length ? '1px solid #e1e9e5' : 0 }}>
                                  <div style={{ gridColumn: '1/-1', color: '#53636e', fontSize: 12 }}>Solde restant : <strong>{cash(due, selected.devise)}</strong>. Un paiement partiel est possible.</div>
                                  <Field label={`Montant payé (${selected.devise})`}><input style={styles.input} type="number" min="0.01" max={due} step="0.01" value={paymentForm.montant} onChange={(event) => setPaymentForm({ ...paymentForm, montant: event.target.value })} required /></Field>
                                  <Field label="Date du paiement"><input style={styles.input} type="date" value={paymentForm.datePaiement} onChange={(event) => setPaymentForm({ ...paymentForm, datePaiement: event.target.value })} required /></Field>
                                  <Field label="Numéro de pièce"><input style={styles.input} value={paymentForm.numeroPiece} maxLength={120} onChange={(event) => setPaymentForm({ ...paymentForm, numeroPiece: event.target.value })} /></Field>
                                  <Field label="Compte banque / caisse"><select style={styles.input} value={paymentForm.compteTresorerieId} onChange={(event) => setPaymentForm({ ...paymentForm, compteTresorerieId: event.target.value })} required><option value="">Choisir un compte</option>{accounts.treasury.map((account) => <option key={account.id} value={account.id}>{account.numero} · {account.nom}</option>)}</select></Field>
                                  <Field label="Compte de charge / actif"><select style={styles.input} value={paymentForm.compteChargeId} onChange={(event) => setPaymentForm({ ...paymentForm, compteChargeId: event.target.value })} required><option value="">Choisir un compte</option>{(accounts.expenseAccounts || []).map((account) => <option key={account.id} value={account.id}>{account.numero} · {account.nom}</option>)}</select></Field>
                                  <button type="submit" style={styles.button} disabled={saving || !accounts.treasury.length || !accounts.expenseAccounts?.length}>{saving ? 'Enregistrement…' : 'Valider le paiement'}</button>
                                </form>}
                              </td>
                            </tr>}
                          </React.Fragment>;
                        })}</tbody>
                      </table></div>}
                    {(!accounts.treasury.length || !accounts.expenseAccounts?.length) && <div role="note" style={{ marginTop: 12, padding: 11, borderRadius: 8, background: '#fff7e6', color: '#805612', fontSize: 12 }}>Le paiement nécessite au moins un compte de trésorerie et un compte de classe 2 ou 6 dans le plan comptable.</div>}
                    <div style={{ fontSize: 12, color: '#687680', marginTop: 10 }}>Les dépenses restent dans leur module et leur workflow d’approbation. Les rattacher ne crée pas de seconde dépense.</div>
                  </section>
                </section>
              )}

              {tab === 'report' && report && (
                <section style={{ ...styles.panel, display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div><h3 style={{ margin: 0 }}>État financier du projet</h3><p style={{ margin: '6px 0 0', color: '#667680', fontSize: 13 }}>Financements reçus appuyés par une écriture équilibrée ; dépenses issues des dossiers ERP rattachés.</p></div>
                    <button type="button" style={styles.button} onClick={() => downloadProjectReport(report)}>Exporter le rapport CSV</button>
                  </div>
                  <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 550 }}>
                    <tbody>{[
                      ['Budget total approuvé', cash(selected.budgetTotal, selected.devise)],
                      ['Budget réparti', cash(report.totals.budgetLines, selected.devise)],
                      ['Dépenses réellement payées', cash(report.totals.spent, selected.devise)],
                      ['Engagements actifs', cash(report.totals.committed ?? 0, selected.devise)],
                      ['Solde des dépenses à payer', cash(report.totals.unpaid ?? 0, selected.devise)],
                      ['Dépenses en attente d’approbation', cash(report.totals.pendingApproval ?? 0, selected.devise)],
                      ['Financements engagés', cash(report.totals.pledged, selected.devise)],
                      ['Financements reçus et comptabilisés', cash(report.totals.received, selected.devise)],
                      ['Dépenses restant sous le budget total', cash(report.totals.budgetRemaining, selected.devise)],
                    ].map(([label, value]) => <tr key={label}><th style={{ padding: 11, textAlign: 'left', borderBottom: '1px solid #edf0f2', color: '#53636e', fontWeight: 550 }}>{label}</th><td style={{ padding: 11, borderBottom: '1px solid #edf0f2', textAlign: 'right', fontWeight: 700 }}>{value}</td></tr>)}</tbody>
                  </table></div>
                  <div style={{ color: '#63737d', fontSize: 12 }}>Les rapports comptables généraux restent accessibles dans « Comptabilité » ; les opérations d’encaissement de ce projet y sont reliées au journal de banque ou de caisse.</div>
                </section>
              )}
            </section>
          )}
        </div>
      )}

      {newProject && (
        <div onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setNewProject(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,35,42,.52)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <form onSubmit={submitProject} style={{ width: 'min(680px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 15, padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 13 }}>
            <div style={{ gridColumn: '1/-1' }}><h2 style={{ margin: 0 }}>Nouveau projet associatif</h2><p style={{ color: '#687680', fontSize: 13 }}>Les données seront isolées dans la comptabilité de cette entreprise.</p></div>
            <Field label="Code unique"><input style={styles.input} value={projectForm.code} maxLength={30} placeholder="Ex. SANTE-2026" onChange={(event) => setProjectForm({ ...projectForm, code: event.target.value })} required /></Field>
            <Field label="Nom du projet"><input style={styles.input} value={projectForm.nom} maxLength={255} onChange={(event) => setProjectForm({ ...projectForm, nom: event.target.value })} required /></Field>
            <Field label="Bailleur principal"><input style={styles.input} value={projectForm.bailleur} maxLength={255} onChange={(event) => setProjectForm({ ...projectForm, bailleur: event.target.value })} /></Field>
            <Field label="Convention"><input style={styles.input} value={projectForm.referenceConvention} maxLength={120} onChange={(event) => setProjectForm({ ...projectForm, referenceConvention: event.target.value })} /></Field>
            <Field label="Budget total approuvé"><input style={styles.input} type="number" min="0.01" step="0.01" value={projectForm.budgetTotal} onChange={(event) => setProjectForm({ ...projectForm, budgetTotal: event.target.value })} required /></Field>
            <Field label="Devise"><select style={styles.input} value={projectForm.devise} onChange={(event) => setProjectForm({ ...projectForm, devise: event.target.value })}>{[['XOF','XOF'],['XAF','XAF'],['EUR','EUR'],['USD','USD'],['CDF','CDF'],['GNF','GNF'],['NGN','NGN'],['GHS','GHS']].map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
            <Field label="Date de début"><input style={styles.input} type="date" value={projectForm.dateDebut} onChange={(event) => setProjectForm({ ...projectForm, dateDebut: event.target.value })} required /></Field>
            <Field label="Date de fin"><input style={styles.input} type="date" value={projectForm.dateFin} onChange={(event) => setProjectForm({ ...projectForm, dateFin: event.target.value })} /></Field>
            <div style={{ gridColumn: '1/-1' }}><Field label="Description / objectifs"><textarea style={{ ...styles.input, minHeight: 85, resize: 'vertical' }} value={projectForm.description} maxLength={4000} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} /></Field></div>
            <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 4 }}><button type="button" style={styles.secondary} disabled={saving} onClick={() => setNewProject(false)}>Annuler</button><button type="submit" style={styles.button} disabled={saving}>{saving ? 'Enregistrement…' : 'Créer le projet'}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
