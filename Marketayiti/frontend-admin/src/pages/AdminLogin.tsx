import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import toast from 'react-hot-toast';

export default function AdminLogin() {
  const { login, loading } = useAdminAuth();
  // useNavigate for SPA navigation (no full-page reload)
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier || !password) { setError('Tous les champs sont requis'); return; }
    try {
      await login(identifier, password);
      toast.success('Bienvenue Admin');
      navigate('/dashboard', { replace: true });
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Identifiant ou mot de passe incorrect');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, background: '#0d1117'
    }}>
      <div className="card fade-in" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: '#1f6feb',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px'
          }}>
            <TrendingUp size={22} color="white" strokeWidth={2.5} />
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>
            AyitiMarket Admin
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#8b949e' }}>
            Connexion au panneau d'administration
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase',
              letterSpacing: '0.06em', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Identifiant
            </label>
            <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
              placeholder="Email, téléphone ou username" className="input" autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase',
              letterSpacing: '0.06em', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Mot de passe
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" className="input" autoComplete="current-password" />
          </div>

          {error && (
            <div style={{
              background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)',
              borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f85149',
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: 12 }}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#484f58' }}>
          Accès réservé aux administrateurs
        </p>
      </div>
    </div>
  );
}
