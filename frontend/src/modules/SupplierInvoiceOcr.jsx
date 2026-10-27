import React, { useEffect, useState } from 'react';
import { parseSupplierInvoiceText } from '../utils/supplierInvoiceOcr.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export default function SupplierInvoiceOcr({ onExtract }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selectFile = (event) => {
    const selected = event.target.files?.[0] || null;
    event.target.value = '';
    if (!selected) return;
    if (!['image/jpeg', 'image/png'].includes(selected.type)) {
      setFile(null);
      setStatus('Choisissez une image JPG ou PNG.');
      return;
    }
    if (selected.size > MAX_IMAGE_BYTES) {
      setFile(null);
      setStatus('La photo doit faire moins de 8 Mo.');
      return;
    }
    setFile(selected);
    setProgress(0);
    setStatus('Photo prête à être lue.');
  };

  const readImage = async () => {
    if (!file || reading) return;
    setReading(true);
    setProgress(0);
    setStatus('Chargement du moteur OCR français…');

    let worker;
    try {
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker('fra', 1, {
        logger: (message) => {
          if (message.status === 'recognizing text') {
            setProgress(Math.round((message.progress || 0) * 100));
            setStatus(`Lecture de la photo… ${Math.round((message.progress || 0) * 100)} %`);
          }
        }
      });
      const result = await worker.recognize(file);
      const extracted = parseSupplierInvoiceText(result.data.text);
      onExtract(extracted);
      setStatus('Lecture terminée. Vérifiez chaque champ avant d’enregistrer.');
    } catch (error) {
      console.error('Erreur OCR facture fournisseur:', error);
      setStatus('La lecture a échoué. Vous pouvez saisir les champs manuellement.');
    } finally {
      if (worker) await worker.terminate().catch(() => {});
      setReading(false);
    }
  };

  return (
    <section style={{ border: '1px solid #d9e2ec', borderRadius: 8, padding: 14, marginBottom: 16, background: '#f8fbff' }}>
      <h4 style={{ margin: '0 0 8px' }}>Lire une facture par photo</h4>
      <p style={{ margin: '0 0 12px', color: '#52606d', fontSize: 13 }}>
        La photo est lue sur cet appareil, sans service IA ni envoi de l’image. Le moteur OCR français se télécharge au premier usage; la photo n’est pas conservée dans le dossier.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 12px', background: '#fff', border: '1px solid #9fb3c8', borderRadius: 6, cursor: 'pointer' }}>
          Choisir ou prendre une photo
          <input
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            onChange={selectFile}
            style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
          />
        </label>
        <button type="button" onClick={readImage} disabled={!file || reading} style={{ minHeight: 40, padding: '0 14px', border: 0, borderRadius: 6, color: '#fff', background: reading || !file ? '#829ab1' : '#1976d2', cursor: reading || !file ? 'not-allowed' : 'pointer' }}>
          {reading ? 'Lecture…' : 'Lire la facture'}
        </button>
        {file && <span style={{ color: '#52606d', fontSize: 13 }}>{file.name}</span>}
      </div>
      {previewUrl && (
        <img src={previewUrl} alt="Aperçu local de la facture" style={{ display: 'block', maxWidth: 240, maxHeight: 220, objectFit: 'contain', marginTop: 12, borderRadius: 4 }} />
      )}
      {reading && (
        <progress max="100" value={progress} style={{ display: 'block', width: '100%', marginTop: 12 }} />
      )}
      {status && <p role="status" style={{ margin: '10px 0 0', color: '#334e68', fontSize: 13 }}>{status}</p>}
    </section>
  );
}
