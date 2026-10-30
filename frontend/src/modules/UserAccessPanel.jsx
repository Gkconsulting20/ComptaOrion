import React, { useEffect, useState } from 'react';
import api from '../api';
import {
  MODULE_PERMISSION_LEVELS,
  USER_MANAGEABLE_MODULES,
  resolveModulePermissions,
} from '@shared/access-policy.js';
import './user-access.css';

const createEmptyForm = () => ({
  username: '',
  email: '',
  nom: '',
  prenom: '',
  password: '',
  role: 'employee',
  modulePermissions: resolveModulePermissions('employee'),
});

function PermissionMatrix({ modules, levels, value = {}, onChange, disabled = false }) {
  const moduleList = modules?.length ? modules : USER_MANAGEABLE_MODULES;
  const permissionLevels = levels?.length ? levels : MODULE_PERMISSION_LEVELS;
  return (
    <div className="user-access__matrix">
      {moduleList.map((module) => (
        <label className="user-access__permission" key={module.id}>
          <span>{module.label}</span>
          <select
            aria-label={`Droit ${module.label}`}
            value={value[module.id] || 'none'}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, [module.id]: event.target.value })}
          >
            {permissionLevels.map((level) => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

export function UserAccessPanel({ currentUserId }) {
  const [data, setData] = useState({ users: [], activeUsers: 0, userLimit: 3, roles: [] });
  const [drafts, setDrafts] = useState({});
  const [form, setForm] = useState(createEmptyForm);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadUsers = async () => {
    setError('');
    try {
      const result = await api.get('/user-management');
      setData(result);
      setDrafts(Object.fromEntries((result.users || []).map((user) => [
        user.id,
        {
          role: user.role,
          actif: Boolean(user.actif),
          modulePermissions: user.modulePermissions || resolveModulePermissions(user.role),
        },
      ])));
    } catch (loadError) {
      setError(loadError.message || 'Impossible de charger les utilisateurs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const updateDraft = (userId, changes) => {
    setDrafts((current) => ({
      ...current,
      [userId]: { ...current[userId], ...changes },
    }));
  };

  const saveUser = async (user) => {
    setSavingId(user.id);
    setError('');
    setNotice('');
    try {
      await api.put(`/user-management/${user.id}`, drafts[user.id]);
      setNotice(`Les accès de ${user.email} ont été enregistrés.`);
      await loadUsers();
    } catch (saveError) {
      setError(saveError.message || 'Impossible d’enregistrer les accès.');
    } finally {
      setSavingId(null);
    }
  };

  const createUser = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError('');
    setNotice('');
    try {
      const result = await api.post('/user-management', form);
      setForm(createEmptyForm());
      setNotice(result.message || 'Utilisateur créé.');
      await loadUsers();
    } catch (createError) {
      setError(createError.message || 'Impossible de créer cet utilisateur.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p>Chargement des utilisateurs…</p>;

  const atLimit = data.activeUsers >= data.userLimit;

  return (
    <section className="user-access">
      <header className="user-access__header">
        <div>
          <h3>Utilisateurs de votre entreprise</h3>
          <p>Créez les comptes de votre équipe et choisissez leurs droits pour chaque module.</p>
        </div>
        <div className="user-access__count">
          {data.activeUsers} / {data.userLimit} comptes actifs
        </div>
      </header>

      {error && <div className="user-access__alert user-access__alert--error" role="alert">{error}</div>}
      {notice && <div className="user-access__alert user-access__alert--success" role="status">{notice}</div>}

      <div className="user-access__roles">
        {data.roles.map((role) => (
          <div className="user-access__role" key={role.value}>
            <strong>{role.label}</strong>
            <span>{role.description}</span>
          </div>
        ))}
      </div>

      <form className="user-access__create" onSubmit={createUser}>
        <div className="user-access__section-heading">
          <div>
            <h4>Ajouter un utilisateur</h4>
            <p>Le compte sera rattaché uniquement à votre entreprise.</p>
          </div>
        </div>
        <div className="user-access__form-grid">
          <label>
            Nom d’utilisateur
            <input required maxLength={100} value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </label>
          <label>
            Courriel
            <input required type="email" maxLength={255} value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            Prénom
            <input value={form.prenom} onChange={(event) => setForm({ ...form, prenom: event.target.value })} />
          </label>
          <label>
            Nom
            <input value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} />
          </label>
          <label>
            Mot de passe initial
            <input required type="password" minLength={12} autoComplete="new-password"
              value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          <label>
            Accès
            <select value={form.role} onChange={(event) => {
              const role = event.target.value;
              setForm((current) => ({
                ...current,
                role,
                modulePermissions: resolveModulePermissions(role),
              }));
            }}>
              {data.roles.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </label>
        </div>
        <details className="user-access__permissions">
          <summary>Définir les droits de chaque module</summary>
          <p className="user-access__hint">
            Lecture seule consulte les données; saisie et modification autorise les créations et mises à jour;
            gestion complète autorise aussi les suppressions.
          </p>
          {form.role === 'admin' ? (
            <p className="user-access__hint">Le profil administrateur conserve la gestion complète de l’entreprise.</p>
          ) : (
            <PermissionMatrix
              modules={data.modules}
              levels={data.permissionLevels}
              value={form.modulePermissions}
              onChange={(modulePermissions) => setForm((current) => ({ ...current, modulePermissions }))}
            />
          )}
        </details>
        <p className="user-access__hint">
          Le mot de passe doit contenir au moins 12 caractères. Communiquez-le à l’utilisateur par un canal privé.
        </p>
        <button className="user-access__primary" type="submit" disabled={creating || atLimit}>
          {creating ? 'Création…' : atLimit ? 'Limite du forfait atteinte' : 'Créer le compte'}
        </button>
      </form>

      <div className="user-access__section-heading user-access__list-heading">
        <div>
          <h4>Comptes existants</h4>
          <p>Désactivez un compte pour retirer son accès tout en conservant son historique.</p>
        </div>
      </div>
      <div className="user-access__table-wrap">
        <table className="user-access__table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Accès</th>
              <th>Statut</th>
              <th>Droits</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {data.users.map((user) => {
              const draft = drafts[user.id] || {
                role: user.role,
                actif: Boolean(user.actif),
                modulePermissions: user.modulePermissions || resolveModulePermissions(user.role),
              };
              const dirty = draft.role !== user.role ||
                draft.actif !== Boolean(user.actif) ||
                JSON.stringify(draft.modulePermissions) !== JSON.stringify(user.modulePermissions);
              const isExpanded = Number(expandedUserId) === Number(user.id);
              return (
                <React.Fragment key={user.id}>
                  <tr>
                    <td>
                      <strong>{[user.prenom, user.nom].filter(Boolean).join(' ') || user.username}</strong>
                      <span>{user.email}</span>
                      <small>@{user.username}</small>
                    </td>
                    <td>
                      <select aria-label={`Profil de ${user.email}`} value={draft.role}
                        disabled={Number(user.id) === Number(currentUserId)}
                        onChange={(event) => {
                          const role = event.target.value;
                          updateDraft(user.id, {
                            role,
                            modulePermissions: resolveModulePermissions(role),
                          });
                        }}>
                        {data.roles.map((role) => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <label className="user-access__active">
                        <input type="checkbox" checked={draft.actif}
                          disabled={Number(user.id) === Number(currentUserId)}
                          onChange={(event) => updateDraft(user.id, { actif: event.target.checked })} />
                        {draft.actif ? 'Actif' : 'Désactivé'}
                      </label>
                    </td>
                    <td>
                      <button className="user-access__toggle" type="button"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedUserId(isExpanded ? null : user.id)}>
                        {isExpanded ? 'Masquer' : 'Configurer'}
                      </button>
                    </td>
                    <td>
                      <button className="user-access__save" type="button" disabled={!dirty || savingId === user.id}
                        onClick={() => saveUser(user)}>
                        {savingId === user.id ? 'Enregistrement…' : 'Enregistrer'}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="user-access__expanded-row">
                      <td colSpan="5">
                        {draft.role === 'admin' ? (
                          <p className="user-access__hint">Le profil administrateur conserve la gestion complète de l’entreprise.</p>
                        ) : (
                          <PermissionMatrix
                            modules={data.modules}
                            levels={data.permissionLevels}
                            value={draft.modulePermissions}
                            onChange={(modulePermissions) => updateDraft(user.id, { modulePermissions })}
                          />
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {data.users.length === 0 && (
              <tr><td colSpan="5" className="user-access__empty">Aucun utilisateur trouvé.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="user-access__footnote">
        Les changements de rôle, de droits ou de statut ferment les sessions de l’utilisateur.
        Les suppressions définitives ne sont pas proposées afin de préserver les traces d’audit.
      </p>
    </section>
  );
}
