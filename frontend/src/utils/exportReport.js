// exportReport.js — Téléchargement des rapports en PDF, Excel (XLSX) ou HTML.
// Le contenu vient du tableau déjà rendu à l'écran (document.getElementById(elementId)) :
// c'est le même contenu que l'ancien téléchargement HTML, donc aucun risque de divergence
// entre ce qui s'affiche et ce qui se télécharge.
// Les librairies xlsx et jspdf sont chargées dynamiquement (import()) pour ne pas
// alourdir le paquet principal : elles ne se chargent que quand l'utilisateur télécharge.

function cleanName(name, fallback) {
  const s = String(name || '').replace(/\s+/g, ' ').trim();
  return s || fallback;
}

function headingForTable(table, index) {
  // Cherche un titre proche du tableau : caption, puis un titre (h1-h4) juste avant,
  // en remontant d'un niveau si besoin. Sinon « Tableau N ».
  const caption = table.querySelector('caption');
  if (caption && caption.textContent.trim()) return cleanName(caption.textContent, `Tableau ${index + 1}`);
  let node = table;
  for (let depth = 0; depth < 3 && node; depth++) {
    let prev = node.previousElementSibling;
    while (prev) {
      if (/^H[1-4]$/.test(prev.tagName)) return cleanName(prev.textContent, `Tableau ${index + 1}`);
      const h = prev.querySelector && prev.querySelector('h1,h2,h3,h4,strong');
      if (h && h.textContent.trim()) return cleanName(h.textContent, `Tableau ${index + 1}`);
      prev = prev.previousElementSibling;
    }
    node = node.parentElement;
  }
  return `Tableau ${index + 1}`;
}

function tablesOf(el) {
  return Array.from(el.querySelectorAll('table'));
}

function downloadHtml(el, baseName, title) {
  const htmlContent = `
    <html>
      <head><meta charset="utf-8"><title>${title}</title>
        <style>body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; } table { width: 100%; border-collapse: collapse; margin: 10px 0; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #f5f5f5; }</style>
      </head>
      <body>
        <h2>${title}</h2>
        ${el.innerHTML}
      </body>
    </html>
  `;
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadExcel(el, baseName, title) {
  const mod = await import('xlsx');
  const XLSX = mod.default || mod;
  const wb = XLSX.utils.book_new();
  const tables = tablesOf(el);
  if (!tables.length) {
    const text = (el.innerText || '').split('\n').map((l) => [l]);
    const ws = XLSX.utils.aoa_to_sheet([[title], [], ...text]);
    XLSX.utils.book_append_sheet(wb, ws, 'Rapport');
  } else {
    const usedNames = new Set();
    tables.forEach((table, i) => {
      let name = headingForTable(table, i).slice(0, 31).replace(/[\\/?*\[\]:]/g, ' ').trim() || `Tableau ${i + 1}`;
      let unique = name;
      let n = 2;
      while (usedNames.has(unique)) unique = `${name.slice(0, 28)} ${n++}`;
      usedNames.add(unique);
      const ws = XLSX.utils.table_to_sheet(table);
      if (i === 0) XLSX.utils.sheet_add_aoa(ws, [[title], []], { origin: 'A1' });
      XLSX.utils.book_append_sheet(wb, ws, unique);
    });
  }
  XLSX.writeFile(wb, `${baseName}.xlsx`);
}

async function downloadPdf(el, baseName, title) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 32;
  let y = 36;
  doc.setFontSize(14);
  doc.text(title, margin, y);
  y += 18;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`ComptaOrion — généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, y);
  doc.setTextColor(0);
  y += 14;
  const tables = tablesOf(el);
  if (!tables.length) {
    const lines = doc.splitTextToSize(el.innerText || '', pageWidth - margin * 2);
    doc.setFontSize(10);
    doc.text(lines, margin, y);
  } else {
    tables.forEach((table, i) => {
      const heading = headingForTable(table, i);
      if (i > 0) {
        // Nouvelle section : saut de page si on est trop bas.
        if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = 36; }
      }
      doc.setFontSize(11);
      doc.text(heading, margin, y);
      y += 8;
      autoTable(doc, {
        html: table,
        startY: y,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [245, 245, 245], textColor: 20 },
      });
      y = doc.lastAutoTable.finalY + 16;
      if (y > doc.internal.pageSize.getHeight() - 60 && i < tables.length - 1) { doc.addPage(); y = 36; }
    });
  }
  doc.save(`${baseName}.pdf`);
}

export async function downloadReport({ elementId, baseName, title, format }) {
  const el = document.getElementById(elementId);
  if (!el) {
    alert('Contenu du rapport introuvable. Veuillez réessayer.');
    return;
  }
  const safeBase = String(baseName || 'rapport').replace(/[\\/?*:"<>|]/g, '_');
  const safeTitle = cleanName(title, safeBase.replace(/_/g, ' '));
  try {
    if (format === 'xlsx') await downloadExcel(el, safeBase, safeTitle);
    else if (format === 'pdf') await downloadPdf(el, safeBase, safeTitle);
    else downloadHtml(el, safeBase, safeTitle);
  } catch (e) {
    console.error('Échec du téléchargement du rapport :', e);
    alert(`Le téléchargement en ${format === 'xlsx' ? 'Excel' : format === 'pdf' ? 'PDF' : 'HTML'} a échoué. Réessayez ou choisissez un autre format.`);
  }
}

// Variante sans élément DOM : le rapport est fourni sous forme de lignes
// (tableau de tableaux, la première ligne = en-têtes). Utilisée par les rapports
// dont le contenu n'est pas rendu dans un bloc identifié (ex. résumé TVA).
export async function downloadReportRows({ rows, baseName, title, format }) {
  const safeBase = String(baseName || 'rapport').replace(/[\\/?*:"<>|]/g, '_');
  const safeTitle = cleanName(title, safeBase.replace(/_/g, ' '));
  const data = Array.isArray(rows) && rows.length ? rows : [['Aucune donnée']];
  try {
    if (format === 'xlsx') {
      const mod = await import('xlsx');
      const XLSX = mod.default || mod;
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([[safeTitle], [], ...data]);
      XLSX.utils.book_append_sheet(wb, ws, 'Rapport');
      XLSX.writeFile(wb, `${safeBase}.xlsx`);
    } else if (format === 'pdf') {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const margin = 32;
      doc.setFontSize(14);
      doc.text(safeTitle, margin, 36);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`ComptaOrion — généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, 54);
      doc.setTextColor(0);
      autoTable(doc, {
        head: [data[0]],
        body: data.slice(1),
        startY: 68,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [245, 245, 245], textColor: 20 },
      });
      doc.save(`${safeBase}.pdf`);
    } else {
      const rowsHtml = data.map((r, i) => `<tr>${r.map((c) => (i === 0 ? `<th>${c}</th>` : `<td>${c}</td>`)).join('')}</tr>`).join('');
      const htmlContent = `<html><head><meta charset="utf-8"><title>${safeTitle}</title><style>body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; } table { width: 100%; border-collapse: collapse; margin: 10px 0; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #f5f5f5; }</style></head><body><h2>${safeTitle}</h2><table>${rowsHtml}</table></body></html>`;
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeBase}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    console.error('Échec du téléchargement du rapport :', e);
    alert(`Le téléchargement en ${format === 'xlsx' ? 'Excel' : format === 'pdf' ? 'PDF' : 'HTML'} a échoué. Réessayez ou choisissez un autre format.`);
  }
}
