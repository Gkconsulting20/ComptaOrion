import React, { useEffect, useState } from 'react';
import './accountant-invitation.css';

export function AccountantInvitationAccept() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successEmail, setSuccessEmail] = useState('');
  const [form, setForm] = useState({
    username: '',
    prenom: '',
    nom: '',
    password: '',
    passwordConfirmation: '',
  });

  useEffect(() => {
    if (!token) {
      setError('Le lien d’invitation est incomplet.');
      setLoading(false);
      return;
    }
    fetch(`/api/public/accountant-invitations/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Invitation invalide ou expirée.');
        return body;
      })
      .then(setInvitation)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.passwordConfirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/public/accountant-invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          username: form.username,
          prenom: form.prenom,
          nom: form.nom,
          password: form.password,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Impossible d’accepter l’invitation.');
      setSuccessEmail(body.email);
      setInvitation(null);
      window.history.replaceState({}, '', '/invitation-comptable');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="accountant-invitation">
      <section className="accountant-invitation__card">
        <div className="accountant-invitation__brand">ComptaOrion</div>
        {loading ? (
          <p className="accountant-invitation__muted">Vérification de l’invitation…</p>
        ) : successEmail ? (
          <div>
            <h1>Invitation acceptée</h1>
            <p>Votre compte comptable est créé pour <strong>{successEmail}</strong>.</p>
            <p>Vous pouvez maintenant vous connecter. Les données accessibles dépendront des droits accordés par l’entreprise.</p>
            <a className="accountant-invitation__button" href="/">Aller à la connexion</a>
          </div>
        ) : invitation ? (
          <div>
            <h1>Accès comptable invité</h1>
            <p><strong>{invitation.entreprise}</strong> vous invite à consulter sa comptabilité.</p>
            <p className="accountant-invitation__email">{invitation.email}</p>
            <p className="accountant-invitation__muted">
              Cet accès est limité à cette entreprise. Vous commencerez avec des droits de lecture seule.
            </p>
            <form onSubmit={handleSubmit}>
              <label>
                Nom d’utilisateur
                <input required maxLength={100} value={form.username}
                  onChange={(event) => setForm({ ...form, username: event.target.value })} />
              </label>
              <div className="accountant-invitation__grid">
                <label>
                  Prénom
                  <input maxLength={100} value={form.prenom}
                    onChange={(event) => setForm({ ...form, prenom: event.target.value })} />
                </label>
                <label>
                  Nom
                  <input maxLength={100} value={form.nom}
                    onChange={(event) => setForm({ ...form, nom: event.target.value })} />
                </label>
              </div>
              <label>
                Choisissez un mot de passe
                <input required type="password" minLength={12} autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })} />
              </label>
              <label>
                Confirmez le mot de passe
                <input required type="password" minLength={12} autoComplete="new-password"
                  value={form.passwordConfirmation}
                  onChange={(event) => setForm({ ...form, passwordConfirmation: event.target.value })} />
              </label>
              <button className="accountant-invitation__button" type="submit" disabled={saving}>
                {saving ? 'Création du compte…' : 'Accepter et créer mon compte'}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <h1>Invitation indisponible</h1>
            <p>{error || 'Demandez à l’entreprise de vous envoyer une nouvelle invitation.'}</p>
            <a className="accountant-invitation__secondary" href="/">Retour à la connexion</a>
          </div>
        )}
        {error && invitation && <div className="accountant-invitation__error" role="alert">{error}</div>}
        <p className="accountant-invitation__footnote">
          ComptaOrion ne vous demandera jamais de transmettre votre mot de passe à l’entreprise.
        </p>
      </section>
    </main>
  );
}
