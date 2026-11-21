import { useState } from 'react';
import { downloadReport, downloadReportRows } from '../utils/exportReport';

// Bouton de téléchargement d'un rapport avec choix du format (PDF / Excel / HTML).
// Mode élément : elementId = id du bloc HTML déjà rendu à l'écran (le même que
// l'ancien téléchargement HTML). Mode lignes : rows = tableau de tableaux
// (première ligne = en-têtes), pour les rapports sans bloc identifié (ex. TVA).
// baseName : nom du fichier sans extension (ex. Grand_Livre_2026-01-01_2026-12-31).
// title : titre affiché en haut du document.
export default function DownloadReportButton({ elementId, rows, baseName, title, style }) {
  const [format, setFormat] = useState('pdf');
  const [busy, setBusy] = useState(false);
  return (
    <span style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value)}
        aria-label="Format du téléchargement"
        style={{ padding: '8px 6px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: 'white', cursor: 'pointer' }}
      >
        <option value="pdf">PDF</option>
        <option value="xlsx">Excel</option>
        <option value="html">HTML</option>
      </select>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            if (rows) await downloadReportRows({ rows, baseName, title, format });
            else await downloadReport({ elementId, baseName, title, format });
          } finally {
            setBusy(false);
          }
        }}
        style={style || { padding: '8px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        ⬇️ Télécharger
      </button>
    </span>
  );
}
