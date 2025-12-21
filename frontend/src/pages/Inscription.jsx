import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function Inscription() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commercialInfo, setCommercialInfo] = useState(null);
  const [formData, setFormData] = useState({
    nomEntreprise: '',
    email: '',
    telephone: '',
    pays: 'Bénin',
    planId: '',
    dureeEnMois: 12,
    methodePaiement: 'fedapay',
    commercialId: null
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refId = urlParams.get('ref');
    if (refId) {
      setFormData(prev => ({ ...prev, commercialId: parseInt(refId) }));
      fetch(`${API_BASE}/api/public/commercial/${refId}`)
        .then(res => res.json())
        .then(data => {
          if (data.nom) {
            setCommercialInfo(data);
          }
        })
        .catch(() => {});
    }
  }, []);

  const PAYS_AFRIQUE = [
    'Bénin', 'Burkina Faso', 'Cameroun', 'Congo-Brazzaville', 'Congo-Kinshasa',
    'Côte d\'Ivoire', 'Gabon', 'Guinée', 'Mali', 'Niger', 'Sénégal', 
    'Tchad', 'Togo'
  ];

  useEffect(() => {
    fetch(`${API_BASE}/api/public/plans`)
      .then(res => res.json())
      .then(data => {
        setPlans(data);
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, planId: data[0].id }));
        }
      })
      .catch(err => {
        console.error('Erreur chargement plans:', err);
        setError('Impossible de charger les plans tarifaires');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/public/inscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'inscription');
      }

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        alert('Inscription réussie ! Vérifiez votre email pour les identifiants.');
      }
    } catch (err) {
      console.error('Erreur inscription:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPlan = plans.find(p => p.id === parseInt(formData.planId));
  const montantTotal = selectedPlan ? parseFloat(selectedPlan.prix) * parseInt(formData.dureeEnMois) : 0;

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '18px', color: '#666' }}>Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '40px 30px',
          color: 'white',
          textAlign: 'center'
        }}>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '32px', fontWeight: 'bold' }}>
            💼 ComptaOrion
          </h1>
          <p style={{ margin: 0, fontSize: '18px', opacity: 0.95 }}>
            L'ERP professionnel pour l'Afrique
          </p>
          {commercialInfo && (
            <div style={{
              marginTop: '15px',
              padding: '10px 20px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: '20px',
              display: 'inline-block'
            }}>
              Recommandé par <strong>{commercialInfo.nom} {commercialInfo.prenom}</strong>
            </div>
          )}
        </div>

        {/* Corps */}
        <div style={{ padding: '40px 30px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '10px', fontSize: '24px', color: '#333' }}>
            Inscription & Abonnement
          </h2>
          <p style={{ color: '#666', marginBottom: '30px' }}>
            Créez votre compte et choisissez votre plan pour commencer à gérer votre entreprise dès aujourd'hui.
          </p>

          {error && (
            <div style={{
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '6px',
              padding: '12px 15px',
              marginBottom: '20px',
              color: '#c33'
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' }}>
                  Nom de l'Entreprise *
                </label>
                <input
                  type="text"
                  name="nomEntreprise"
                  value={formData.nomEntreprise}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Ex: Entreprise SARL"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' }}>
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="contact@entreprise.com"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' }}>
                  Téléphone
                </label>
                <input
                  type="tel"
                  name="telephone"
                  value={formData.telephone}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="+229 XX XX XX XX"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' }}>
                  Pays *
                </label>
                <select
                  name="pays"
                  value={formData.pays}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                >
                  {PAYS_AFRIQUE.map(pays => (
                    <option key={pays} value={pays}>{pays}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px', color: '#333' }}>
                Choix du Plan
              </h3>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                  Plan Tarifaire *
                </label>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {plans.map(plan => (
                    <label
                      key={plan.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '15px',
                        border: formData.planId === plan.id ? '2px solid #667eea' : '1px solid #ddd',
                        borderRadius: '8px',
                        backgroundColor: formData.planId === plan.id ? '#f0f4ff' : 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <input
                        type="radio"
                        name="planId"
                        value={plan.id}
                        checked={formData.planId === plan.id}
                        onChange={handleChange}
                        style={{ marginRight: '12px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '16px', color: '#333' }}>{plan.nom}</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
                          {plan.descriptionFeatures || 'Plan complet'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '20px', color: '#667eea' }}>
                          {parseFloat(plan.prix).toLocaleString()} {plan.devise || 'XOF'}
                        </strong>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#999' }}>
                          /{plan.periode || 'mois'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                  Durée de l'Abonnement *
                </label>
                <select
                  name="dureeEnMois"
                  value={formData.dureeEnMois}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="1">1 mois</option>
                  <option value="3">3 mois (-5%)</option>
                  <option value="6">6 mois (-10%)</option>
                  <option value="12">12 mois (-15%)</option>
                </select>
              </div>

              {selectedPlan && (
                <div style={{
                  backgroundColor: '#e8f5e9',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid #81c784'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ color: '#666' }}>Prix mensuel:</span>
                    <strong>{parseFloat(selectedPlan.prix).toLocaleString()} {selectedPlan.devise || 'XOF'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ color: '#666' }}>Durée:</span>
                    <strong>{formData.dureeEnMois} mois</strong>
                  </div>
                  <div style={{
                    borderTop: '2px solid #4caf50',
                    marginTop: '10px',
                    paddingTop: '10px',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2e7d32' }}>Total:</span>
                    <strong style={{ fontSize: '22px', color: '#2e7d32' }}>
                      {montantTotal.toLocaleString()} {selectedPlan.devise || 'XOF'}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#333' }}>
                Méthode de Paiement *
              </label>
              <div style={{ display: 'grid', gap: '10px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  border: formData.methodePaiement === 'fedapay' ? '2px solid #667eea' : '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: formData.methodePaiement === 'fedapay' ? '#f0f4ff' : 'white',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="methodePaiement"
                    value="fedapay"
                    checked={formData.methodePaiement === 'fedapay'}
                    onChange={handleChange}
                    style={{ marginRight: '12px' }}
                  />
                  <div>
                    <strong>FedaPay</strong>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#666' }}>
                      Mobile Money (MTN, Moov, Orange Money) - Recommandé pour l'Afrique
                    </p>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  border: formData.methodePaiement === 'stripe' ? '2px solid #667eea' : '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: formData.methodePaiement === 'stripe' ? '#f0f4ff' : 'white',
                  cursor: 'not-allowed',
                  opacity: 0.5
                }}>
                  <input
                    type="radio"
                    name="methodePaiement"
                    value="stripe"
                    disabled
                    style={{ marginRight: '12px' }}
                  />
                  <div>
                    <strong>Stripe</strong>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#666' }}>
                      Cartes bancaires internationales (Bientôt disponible)
                    </p>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  border: formData.methodePaiement === 'paypal' ? '2px solid #667eea' : '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: formData.methodePaiement === 'paypal' ? '#f0f4ff' : 'white',
                  cursor: 'not-allowed',
                  opacity: 0.5
                }}>
                  <input
                    type="radio"
                    name="methodePaiement"
                    value="paypal"
                    disabled
                    style={{ marginRight: '12px' }}
                  />
                  <div>
                    <strong>PayPal</strong>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#666' }}>
                      Paiement international (Bientôt disponible)
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: submitting ? '#ccc' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {submitting ? 'Traitement en cours...' : `Procéder au Paiement (${montantTotal.toLocaleString()} ${selectedPlan?.devise || 'XOF'})`}
            </button>

            <p style={{ marginTop: '20px', fontSize: '13px', color: '#999', textAlign: 'center' }}>
              En vous inscrivant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
            </p>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '30px', paddingBottom: '20px' }}>
        <p style={{ color: '#666', fontSize: '14px' }}>
          Déjà un compte ? <a href="/" style={{ color: '#667eea', textDecoration: 'none', fontWeight: 'bold' }}>Se connecter</a>
        </p>
      </div>
    </div>
  );
}
