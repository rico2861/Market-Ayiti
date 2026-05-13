import toast from 'react-hot-toast';
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const base: React.CSSProperties = {
  background: '#161b22',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#e6edf3',
  fontSize: 13,
  fontFamily: 'Inter,sans-serif',
  maxWidth: 380,
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  padding: '12px 14px',
};

function show(icon: React.ReactNode, title: string, message?: string, borderColor = 'rgba(255,255,255,0.1)') {
  toast.custom((t) => (
    <div
      style={{
        ...base,
        borderColor,
        opacity: t.visible ? 1 : 0,
        transition: 'opacity 0.2s',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ flexShrink: 0, marginTop: 1 }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: message ? 2 : 0 }}>{title}</div>
        {message && <div style={{ color: '#8b949e', fontSize: 12, lineHeight: 1.4 }}>{message}</div>}
      </div>
    </div>
  ), { duration: 3500 });
}

export function useAlert() {
  return {
    success: (title: string, message?: string) =>
      show(<CheckCircle size={16} color="#3fb950" />, title, message, 'rgba(63,185,80,0.3)'),

    error: (title: string, message?: string) =>
      show(<AlertCircle size={16} color="#f85149" />, title, message, 'rgba(248,81,73,0.3)'),

    warning: (title: string, message?: string) =>
      show(<AlertTriangle size={16} color="#d29922" />, title, message, 'rgba(210,153,34,0.3)'),

    info: (title: string, message?: string) =>
      show(<Info size={16} color="#388bfd" />, title, message, 'rgba(56,139,253,0.3)'),
  };
}

export default useAlert;
