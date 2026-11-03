import React, { useState, useEffect } from 'react';

export function Inscription() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commercialInfo, setCommercialInfo] = useState(null);
  const [formData, setFormData] = useState({
    nomEntreprise: '',
    nomAdministrateur: '',
    email: '',
    telephone: '',
    pays: 'Togo',
    planId: '',
    motDePasse: '',
    confirmationMotDePasse: '',
    commercialId: null
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refId = urlParams.get('ref');
    if (refId) {
      setFormData(prev => ({ ...prev, commercialId: parseInt(refId) }));
      fetch(`/api/public/commercial/${refId}`)
        .then(res => {
          if (!res.ok) throw new Error('Lien de parrainage indisponible');
          return res.json();
        })
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
    fetch('/api/public/plans')
      .then(res => {
        if (!res.ok) throw new Error('Erreur lors du chargement des forfaits');
        return res.json();
      })
      .then(data => {
        if (!Array.isArray(data)) throw new Error('Réponse des forfaits invalide');
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
    setFormData(prev => ({
      ...prev,
      [name]: name === 'planId' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedPlan) {
      setError('Aucun forfait actif n’est disponible pour le moment.');
      return;
    }
    if (formData.motDePasse.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (formData.motDePasse !== formData.confirmationMotDePasse) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);

    try {
      const response = await fetch('/api/public/inscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'inscription');
      }

      setSuccess(data.message || 'Votre espace est créé. Vous pouvez vous connecter.');
    } catch (err) {
      console.error('Erreur inscription:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPlan = plans.find(p => p.id === parseInt(formData.planId));

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

  if (success) {
    return (
      <main style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        backgroundColor: '#f5f5f5',
      }}>
        <section style={{
          width: '100%',
          maxWidth: '520px',
          padding: '36px',
          borderRadius: '12px',
          backgroundColor: 'white',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          textAlign: 'center',
        }}>
          <h1 style={{ color: '#256b48', marginTop: 0 }}>Essai gratuit activé</h1>
          <p aria-live="polite" style={{ color: '#4b5563', lineHeight: 1.6 }}>{success}</p>
          <a href="/" style={{
            display: 'inline-block',
            marginTop: '12px',
            padding: '12px 20px',
            borderRadius: '8px',
            backgroundColor: '#3157a4',
            color: 'white',
            fontWeight: 700,
            textDecoration: 'none',
          }}>
            Se connecter
          </a>
        </section>
      </main>
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
            Essayez ComptaOrion gratuitement
          </h2>
          <p style={{ color: '#666', marginBottom: '30px' }}>
            Créez l’espace de votre entreprise en quelques minutes. Aucun paiement ni carte bancaire n’est demandé.
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

          {success && (
            <div role="status" aria-live="polite" style={{
              backgroundColor: '#e8f5e9',
              border: '1px solid #81c784',
              borderRadius: '6px',
              padding: '12px 15px',
              marginBottom: '20px',
              color: '#256b48',
            }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
              gap: '20px',
              marginBottom: '20px',
            }}>
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
                <label htmlFor="trial-email" style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' }}>
                  Email *
                </label>
                <input
                  id="trial-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
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

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="trial-admin-name" style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' }}>
                Nom complet de l’administrateur *
              </label>
              <input
                id="trial-admin-name"
                type="text"
                name="nomAdministrateur"
                value={formData.nomAdministrateur}
                onChange={handleChange}
                minLength={2}
                maxLength={120}
                autoComplete="name"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '15px',
                  boxSizing: 'border-box',
                }}
                placeholder="Ex. Afi Mensah"
              />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
              gap: '20px',
              marginBottom: '20px',
            }}>
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
                  placeholder="+228 XX XX XX XX"
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
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
              gap: '20px',
              marginBottom: '20px',
            }}>
              <div>
                <label htmlFor="trial-password" style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' }}>
                  Mot de passe *
                </label>
                <input
                  id="trial-password"
                  type="password"
                  name="motDePasse"
                  value={formData.motDePasse}
                  onChange={handleChange}
                  minLength={8}
                  autoComplete="new-password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '15px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label htmlFor="trial-password-confirm" style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' }}>
                  Confirmer le mot de passe *
                </label>
                <input
                  id="trial-password-confirm"
                  type="password"
                  name="confirmationMotDePasse"
                  value={formData.confirmationMotDePasse}
                  onChange={handleChange}
                  minLength={8}
                  autoComplete="new-password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '15px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px', color: '#333' }}>
                Votre essai gratuit
              </h3>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                  Forfait d’essai *
                </label>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {plans.length === 0 && (
                    <div role="status" style={{
                      padding: '14px',
                      borderRadius: '8px',
                      border: '1px solid #f0d58a',
                      backgroundColor: '#fff8e7',
                      color: '#735515'
                    }}>
                      Aucun forfait actif n’est disponible. L’inscription en ligne est momentanément indisponible ; veuillez contacter l’administrateur.
                    </div>
                  )}
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
                          {parseFloat(plan.prix).toLocaleString('fr-FR', { maximumFractionDigits: plan.devise === 'XOF' || !plan.devise ? 0 : 2 })} {plan.devise || 'XOF'}
                        </strong>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#999' }}>
                          30 jours
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div role="note" style={{
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1px solid #81c784',
                backgroundColor: '#e8f5e9',
                color: '#256b48',
              }}>
                Les 30 jours commencent à la création de votre organisation. Aucun paiement n’est demandé.
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedPlan}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: submitting || !selectedPlan ? '#ccc' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: submitting || !selectedPlan ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {submitting ? 'Création de votre espace…' : 'Créer mon espace gratuitement'}
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
