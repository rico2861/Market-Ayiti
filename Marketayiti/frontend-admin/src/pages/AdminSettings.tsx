import { useState, useEffect } from 'react';
import { Save, Globe, DollarSign, Shield, Bell, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../components/AdminLayout';

const STORAGE_KEY = 'ayitimarket_admin_settings';

interface Settings {
  platformName:     string;
  commissionRate:   string;
  minDeposit:       string;
  maxDeposit:       string;
  minWithdraw:      string;
  maxWithdraw:      string;
  maintenanceMode:  boolean;
  autoCloseMarkets: boolean;
  maxBetsPerUser:   string;
}

const DEFAULTS: Settings = {
  platformName:     'AyitiMarket',
  commissionRate:   '1.5',
  minDeposit:       '100',
  maxDeposit:       '500000',
  minWithdraw:      '500',
  maxWithdraw:      '200000',
  maintenanceMode:  false,
  autoCloseMarkets: true,
  maxBetsPerUser:   '50',
};

function Section({ icon: Icon, title, children, color = '#1f6feb' }: { icon: any; title: string; children: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={15} color={color} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: 'white', fontWeight: 500, marginBottom: 2 }}>{label}</div>
        {help && <div style={{ fontSize: 11, color: '#484f58' }}>{help}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)} style={{
      width: 44, height: 24, borderRadius: 12, cursor: 'pointer', position: 'relative', transition: 'background .2s',
      background: checked ? '#3fb950' : '#21262d', border: `1px solid ${checked ? '#3fb950' : 'rgba(255,255,255,0.12)'}`,
    }}>
      <div style={{
        position: 'absolute', top: 2, left: checked ? 22 : 2, width: 18, height: 18,
        borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULTS });
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSettings({ ...DEFAULTS, ...JSON.parse(stored) });
    } catch {}
  }, []);

  const S = (k: keyof Settings, v: any) => setSettings(s => ({ ...s, [k]: v }));

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    toast.success('Paramètres sauvegardés');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULTS });
    localStorage.removeItem(STORAGE_KEY);
    toast.success('Paramètres réinitialisés');
  };

  return (
    <AdminLayout>
      <div style={{ padding: 24, maxWidth: 760 }} className="fade-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>Paramètres</h1>
            <div style={{ fontSize: 12, color: '#484f58', marginTop: 2 }}>Configuration de la plateforme</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleReset} className="btn btn-ghost btn-sm"><RefreshCw size={13} /> Réinitialiser</button>
            <button onClick={handleSave} className="btn btn-primary">
              <Save size={14} /> {saved ? 'Sauvegardé !' : 'Sauvegarder'}
            </button>
          </div>
        </div>

        {/* Platform */}
        <Section icon={Globe} title="Général" color="#1f6feb">
          <Field label="Nom de la plateforme" help="Affiché dans l'interface et les emails">
            <input value={settings.platformName} onChange={e => S('platformName', e.target.value)} className="input" style={{ width: 220 }} />
          </Field>
          <Field label="Mode maintenance" help="Désactive l'accès utilisateur à la plateforme">
            <Toggle checked={settings.maintenanceMode} onChange={v => S('maintenanceMode', v)} />
          </Field>
          <Field label="Fermeture auto des marchés expirés" help="Ferme automatiquement les marchés passé leur date de fin">
            <Toggle checked={settings.autoCloseMarkets} onChange={v => S('autoCloseMarkets', v)} />
          </Field>
          <Field label="Paris max par utilisateur" help="Nombre maximum de paris actifs simultanés par compte">
            <input type="number" value={settings.maxBetsPerUser} onChange={e => S('maxBetsPerUser', e.target.value)} className="input" style={{ width: 100 }} min={1} />
          </Field>
        </Section>

        {/* Finance */}
        <Section icon={DollarSign} title="Finances & Commissions" color="#d29922">
          <Field label="Taux de commission (%)" help="Commission prélevée sur chaque transaction (dépôt/retrait)">
            <input type="number" value={settings.commissionRate} onChange={e => S('commissionRate', e.target.value)} className="input" style={{ width: 100 }} min={0} max={100} step={0.1} />
          </Field>
          <Field label="Dépôt minimum (HTG)" help="Montant minimum pour un dépôt via MonCash">
            <input type="number" value={settings.minDeposit} onChange={e => S('minDeposit', e.target.value)} className="input" style={{ width: 140 }} min={1} />
          </Field>
          <Field label="Dépôt maximum (HTG)" help="Montant maximum pour un dépôt via MonCash">
            <input type="number" value={settings.maxDeposit} onChange={e => S('maxDeposit', e.target.value)} className="input" style={{ width: 140 }} min={1} />
          </Field>
          <Field label="Retrait minimum (HTG)" help="Montant minimum pour un retrait">
            <input type="number" value={settings.minWithdraw} onChange={e => S('minWithdraw', e.target.value)} className="input" style={{ width: 140 }} min={1} />
          </Field>
          <Field label="Retrait maximum (HTG)" help="Montant maximum pour un retrait">
            <input type="number" value={settings.maxWithdraw} onChange={e => S('maxWithdraw', e.target.value)} className="input" style={{ width: 140 }} min={1} />
          </Field>
        </Section>

        {/* Security */}
        <Section icon={Shield} title="Sécurité" color="#f85149">
          <div style={{ padding: '12px 16px', background: 'rgba(248,81,73,0.06)', borderRadius: 8, border: '1px solid rgba(248,81,73,0.15)' }}>
            <div style={{ fontSize: 12, color: '#f85149', fontWeight: 600, marginBottom: 6 }}>Informations de sécurité</div>
            <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: '#8b949e', lineHeight: 2 }}>
              <li>JWT access tokens : expiration 2h</li>
              <li>JWT refresh tokens : expiration 30j</li>
              <li>Rate limiting global : 500 req/min</li>
              <li>Rate limiting auth : 50 tentatives / 15 min</li>
              <li>Mots de passe : bcrypt 12 rounds</li>
            </ul>
          </div>
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title="Notifications" color="#a371f7">
          <div style={{ padding: '12px 16px', background: 'rgba(163,113,247,0.06)', borderRadius: 8, border: '1px solid rgba(163,113,247,0.15)' }}>
            <div style={{ fontSize: 12, color: '#a371f7', fontWeight: 600, marginBottom: 4 }}>Notifications email</div>
            <div style={{ fontSize: 12, color: '#484f58' }}>
              Configuration email disponible via les variables d'environnement du backend.<br />
              Les notifications sont envoyées depuis <code style={{ color: '#8b949e', background: '#21262d', padding: '1px 5px', borderRadius: 4 }}>MAIL_FROM</code>.
            </div>
          </div>
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSave} className="btn btn-primary" style={{ minWidth: 140 }}>
            <Save size={14} /> {saved ? 'Sauvegardé !' : 'Sauvegarder les paramètres'}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
