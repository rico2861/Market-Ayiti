import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, LogOut, User, TrendingUp, Menu, X,
  ChevronDown, Wallet, Home, BarChart2, Award, Globe,
  Vote, Trophy, Music, Users, Grid3X3, Layers, Flame, Bell, Gift,
  CheckCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../hooks/useLocale';
import { SUPPORTED_LOCALES, LOCALE_NAMES } from '../../i18n';
import type { MarketCategory } from '../../types';
import WalletModal from '../wallet/WalletModal';
import { notificationsAPI } from '../../api';
import clsx from 'clsx';

const CAT_ICONS: Record<string, React.ReactNode> = {
  '':       <Layers size={11} />,
  nouvo:    <Flame size={11} />,
  politik:  <Vote size={11} />,
  spo:      <Trophy size={11} />,
  ekonomi:  <BarChart2 size={11} />,
  kilti:    <Music size={11} />,
  sosyal:   <Users size={11} />,
  lot:      <Grid3X3 size={11} />,
};

export default function Header() {
  const { t } = useTranslation();
  const { user, logout, initialized } = useAuth();
  const { locale, changeLocale, path } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeCategory = (searchParams.get('category') || '') as MarketCategory | '';

  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletMode, setWalletMode] = useState<'deposit' | 'withdraw'>('deposit');

  const openWallet = (mode: 'deposit' | 'withdraw' = 'deposit') => { setWalletMode(mode); setWalletOpen(true); };
  const [langOpen, setLangOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchVal, setSearchVal] = useState(searchParams.get('q') || '');
  const [searchFocus, setSearchFocus] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(64);

  const [searchOpen, setSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);

  const fetchNotifs = useCallback(async () => {
    if (!user) return;
    try {
      const r = await notificationsAPI.list(10);
      setNotifs(r.data.notifications ?? []);
      setUnread(r.data.unread ?? 0);
    } catch {}
  }, [user]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  const handleOpenNotif = () => {
    setNotifOpen(v => !v);
    if (!notifOpen) fetchNotifs(); // refresh on open
  };

  const dropRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!headerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      const h = e.contentRect.height;
      setHeaderHeight(h);
      document.documentElement.style.setProperty('--header-h', `${h}px`);
    });
    ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => { setMobileOpen(false); setSearchOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => mobileSearchRef.current?.focus(), 80);
  }, [searchOpen]);

  useEffect(() => {
    if (mobileOpen) document.body.classList.add('no-scroll');
    else document.body.classList.remove('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, [mobileOpen]);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setSearchVal(q);
  }, [searchParams.get('q')]);

  const handleSearchChange = (val: string) => {
    setSearchVal(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) {
      if (location.pathname.includes('markets')) {
        setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('q'); return n; }, { replace: true });
      }
      return;
    }
    debounceRef.current = setTimeout(() => {
      const marketsPath = path('markets');
      if (!location.pathname.includes('markets')) {
        navigate(`${marketsPath}?q=${encodeURIComponent(val.trim())}`);
      } else {
        setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('q', val.trim()); return n; }, { replace: true });
      }
    }, 300);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) navigate(`${path('markets')}?q=${encodeURIComponent(searchVal.trim())}`);
  };

  const handleCat = (cat: MarketCategory | '') => {
    const marketsPath = path('markets');
    if (!location.pathname.includes('markets') && location.pathname !== path('home')) {
      navigate(cat ? `${marketsPath}?category=${cat}` : marketsPath);
      return;
    }
    setSearchParams(prev => {
      const n = new URLSearchParams(prev);
      if (cat) n.set('category', cat);
      else n.delete('category');
      return n;
    }, { replace: true });
    if (location.pathname === path('home') && cat) {
      navigate(`${marketsPath}?category=${cat}`);
    }
  };

  const isActive = (p: string) => location.pathname === p;
  const onMarketsOrHome = location.pathname === path('home') || location.pathname.startsWith(path('markets'));

  const fr = locale === 'fr';
  const CATS: { id: MarketCategory | ''; label: string }[] = [
    { id: '', label: fr ? 'Tous' : 'Tout' },
    { id: 'nouvo', label: fr ? 'Actualité' : 'Nouvo' },
    { id: 'politik', label: fr ? 'Politique' : 'Politik' },
    { id: 'spo', label: fr ? 'Sport' : 'Spò' },
    { id: 'ekonomi', label: fr ? 'Économie' : 'Ekonomi' },
    { id: 'kilti', label: fr ? 'Culture' : 'Kilti' },
    { id: 'sosyal', label: fr ? 'Social' : 'Sosyal' },
    { id: 'lot', label: fr ? 'Autre' : 'Lòt' },
  ];

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  /* ── Logo component (reused in topbar + mobile menu) ── */
  const Logo = () => (
    <Link to={path('home')} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: 'linear-gradient(135deg,#1d4ed8,#2563eb)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: '0 2px 10px rgba(37,99,235,.3)',
      }}>
        <TrendingUp size={15} color="white" strokeWidth={2.5} />
      </div>
      <span style={{ fontWeight: 800, color: 'white', fontSize: 15, letterSpacing: '-.4px', lineHeight: 1 }}>
        Ayiti<span style={{ color: '#388bfd' }}>Market</span>
      </span>
    </Link>
  );

  return (
    <>
      {walletOpen && user && <WalletModal initialMode={walletMode} onClose={() => setWalletOpen(false)} />}

      <header ref={headerRef} className="fixed top-0 left-0 right-0 z-40"
        style={{
          background: scrolled ? 'rgba(13,17,23,0.97)' : '#0d1117',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.5)' : 'none',
          transition: 'background .2s, box-shadow .2s',
          paddingTop: 'env(safe-area-inset-top, 0px)'
        }}>

        {/* Main nav row */}
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 56 }}>

            {/* Logo */}
            <div style={{ marginRight: 4 }}>
              <Logo />
            </div>

            {/* Desktop nav links */}
            <nav className="hidden lg:flex items-center gap-0.5" style={{ marginRight: 4 }}>
              {[
                { to: path('home'), label: t('nav.home') },
                { to: path('markets'), label: t('nav.markets') },
                ...(user ? [{ to: path('myBets'), label: t('nav.my_bets') }] : []),
              ].map(n => (
                <Link key={n.to} to={n.to}
                  className={clsx('px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                    isActive(n.to) ? 'text-white bg-white/[0.07]' : 'text-[#8b949e] hover:text-white hover:bg-white/[0.04]')}
                  style={{ textDecoration: 'none' }}>
                  {n.label}
                </Link>
              ))}
            </nav>

            {/* Search — Desktop */}
            <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: 0, maxWidth: 440 }} className="hidden lg:flex">
              <div style={{
                position: 'relative', width: '100%', display: 'flex', alignItems: 'center',
                borderRadius: 12,
                background: searchFocus ? 'rgba(56,139,253,0.06)' : 'rgba(255,255,255,0.05)',
                border: `1.5px solid ${searchFocus ? 'rgba(56,139,253,0.6)' : 'rgba(255,255,255,0.1)'}`,
                boxShadow: searchFocus ? '0 0 0 3px rgba(56,139,253,0.12)' : 'none',
                transition: 'border-color .2s, box-shadow .2s, background .2s',
              }}>
                <Search size={14} style={{
                  position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                  color: searchFocus ? '#388bfd' : '#484f58',
                  pointerEvents: 'none', transition: 'color .2s', flexShrink: 0,
                }} />
                <input ref={searchRef} type="search" value={searchVal}
                  onChange={e => handleSearchChange(e.target.value)}
                  onFocus={() => setSearchFocus(true)}
                  onBlur={() => setSearchFocus(false)}
                  placeholder={t('nav.search_placeholder')}
                  style={{
                    width: '100%', background: 'transparent', border: 'none', borderRadius: 12,
                    padding: '8px 36px 8px 36px', color: 'white', fontSize: 13,
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
                {!searchVal ? (
                  <span style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 5, padding: '1px 6px', fontSize: 10, color: '#484f58',
                    pointerEvents: 'none', fontFamily: 'monospace',
                  }}>/</span>
                ) : (
                  <button type="button" onClick={() => { setSearchVal(''); if (location.pathname.includes('markets')) setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('q'); return n; }, { replace: true }); }}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%',
                      width: 20, height: 20, cursor: 'pointer', color: '#8b949e',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                    <X size={11} />
                  </button>
                )}
              </div>
            </form>

            <div style={{ flex: 1 }} />

            {/* Search icon — Mobile/tablet only (lg:hidden) */}
            <button onClick={() => setSearchOpen(true)} className="lg:hidden"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, cursor: 'pointer', color: '#8b949e', flexShrink: 0,
                transition: 'all .2s ease',
              }}>
              <Search size={16} />
            </button>

            {/* Right side */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

              {/* Language switcher */}
              <div ref={langRef} style={{ position: 'relative' }}>
                <button onClick={() => setLangOpen(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, cursor: 'pointer', color: '#8b949e', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    transition: 'all .2s ease'
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                    (e.currentTarget as HTMLElement).style.color = '#e6edf3';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                    (e.currentTarget as HTMLElement).style.color = '#8b949e';
                  }}>
                  <Globe size={13} />{locale.toUpperCase()}<ChevronDown size={11} />
                </button>
                {langOpen && (
                  <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#161b22',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 6,
                    zIndex: 100, minWidth: 130, boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                  }}>
                    {SUPPORTED_LOCALES.map(loc => (
                      <button key={loc} onClick={() => { changeLocale(loc); setLangOpen(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                          background: locale === loc ? 'rgba(31,111,235,0.15)' : 'none',
                          border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 13, color: locale === loc ? '#388bfd' : '#e6edf3', fontWeight: locale === loc ? 600 : 400,
                          textAlign: 'left'
                        }}>
                        <span style={{ fontSize: 16 }}>{loc === 'fr' ? '🇫🇷' : '🇭🇹'}</span>
                        {LOCALE_NAMES[loc]}
                        {locale === loc && <span style={{ marginLeft: 'auto', color: '#388bfd', fontSize: 12 }}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Notification bell */}
              {user && (
                <div ref={notifRef} style={{ position: 'relative' }}>
                  <button
                    onClick={handleOpenNotif}
                    style={{
                      position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 34, height: 34,
                      background: notifOpen ? 'rgba(56,139,253,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${notifOpen ? 'rgba(56,139,253,0.35)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 10, cursor: 'pointer', color: notifOpen ? '#388bfd' : '#8b949e',
                      transition: 'all .2s ease',
                    }}>
                    <Bell size={15} />
                    {unread > 0 && (
                      <span style={{
                        position: 'absolute', top: -4, right: -4,
                        minWidth: 16, height: 16, borderRadius: 8,
                        background: '#f85149', color: 'white',
                        fontSize: 9, fontWeight: 800, lineHeight: '16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px', border: '2px solid #0d1117',
                      }}>
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <div style={{
                      position: 'fixed',
                      right: 8, top: (notifRef.current?.getBoundingClientRect().bottom ?? 56) + 8,
                      background: '#161b22', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 16, padding: 0, zIndex: 200,
                      width: 'min(340px, calc(100vw - 16px))',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                      overflow: 'hidden',
                    }}>
                      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>
                          {fr ? 'Notifications' : 'Notifikasyon'}
                        </span>
                        <Link to={path('notifications')} onClick={() => setNotifOpen(false)}
                          style={{ fontSize: 11, color: '#388bfd', fontWeight: 600, textDecoration: 'none' }}>
                          {fr ? 'Tout voir →' : 'Wè tout →'}
                        </Link>
                      </div>
                      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                        {notifs.filter((n: any) => !n.read).length === 0 ? (
                          <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                            <Bell size={24} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.12, color: '#8b949e' }} />
                            <p style={{ fontSize: 12, color: '#484f58', margin: 0 }}>
                              {fr ? 'Aucune notification' : 'Pa gen notifikasyon'}
                            </p>
                          </div>
                        ) : notifs.filter((n: any) => !n.read).map((n: any) => (
                          <button key={n.id}
                            onClick={() => {
                              notificationsAPI.markRead(n.id).catch(() => {});
                              setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                              setUnread(u => Math.max(0, u - 1));
                            }}
                            style={{
                              width: '100%', textAlign: 'left', cursor: 'pointer',
                              padding: '12px 16px',
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              background: 'rgba(56,139,253,0.04)',
                              display: 'flex', gap: 10, alignItems: 'flex-start',
                              border: 'none', fontFamily: 'inherit',
                            }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                              background: n.type === 'cashback' ? 'rgba(168,85,247,0.15)' : n.type === 'bonus' ? 'rgba(168,85,247,0.15)' : n.type === 'win' || n.type === 'win_bonus' ? 'rgba(63,185,80,0.15)' : 'rgba(56,139,253,0.12)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: n.type === 'cashback' || n.type === 'bonus' ? '#c084fc' : n.type === 'win' || n.type === 'win_bonus' ? '#3fb950' : '#388bfd',
                            }}>
                              {(n.type === 'cashback' || n.type === 'bonus') ? <Gift size={14} /> : <Bell size={14} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: 'white', margin: '0 0 2px' }}>{n.title}</p>
                              <p style={{ fontSize: 11, color: '#8b949e', margin: 0, lineHeight: 1.4 }}>{n.message}</p>
                            </div>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#388bfd', flexShrink: 0, marginTop: 5 }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {user ? (
                <>
                  {/* Wallet pill — responsive: compact on mobile, full on sm+ */}
                  <button onClick={() => openWallet('deposit')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px',
                      background: 'rgba(22,199,132,0.08)', border: '1px solid rgba(22,199,132,0.2)',
                      borderRadius: 10, cursor: 'pointer', transition: 'all .2s ease',
                      fontFamily: 'inherit', flexShrink: 0, position: 'relative',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(22,199,132,0.15)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(22,199,132,0.08)'; }}>
                    <Wallet size={13} color="#16c784" />
                    {/* Balance — always visible */}
                    <span style={{ color: '#16c784', fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', whiteSpace: 'nowrap' }}>
                      {Math.floor(user.balance).toLocaleString()}
                      <span style={{ opacity: 0.6, fontSize: 10, marginLeft: 2 }}>HTG</span>
                    </span>
                    {/* Bonus badge — always visible */}
                    {(user.bonus_balance ?? 0) > 0 && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '2px 6px', borderRadius: 7,
                        background: 'rgba(168,85,247,0.18)', color: '#c084fc',
                        fontSize: 10, fontWeight: 700, border: '1px solid rgba(168,85,247,0.28)',
                        fontFamily: 'JetBrains Mono,monospace', whiteSpace: 'nowrap',
                      }}>
                        +{Math.floor(user.bonus_balance)}B
                      </span>
                    )}
                  </button>

                  {/* User dropdown */}
                  <div ref={dropRef} style={{ position: 'relative' }}>
                    <button onClick={() => setDropOpen(v => !v)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s ease'
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                      }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', background: '#1f6feb',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0
                      }}>
                        {user.username[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize: 12, color: '#e6edf3', fontWeight: 500 }} className="hidden sm:block">
                        {user.username}
                      </span>
                      <ChevronDown size={11} color="#8b949e" className="hidden sm:block" />
                    </button>
                    {dropOpen && (
                      <div style={{
                        position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#161b22',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 8,
                        zIndex: 100, minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                      }}>
                        <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 6 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>@{user.username}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <span style={{ fontSize: 12, color: '#16c784', fontFamily: 'JetBrains Mono,monospace' }}>
                              {user.balance.toLocaleString()} HTG
                            </span>
                            {(user.bonus_balance ?? 0) > 0 && (
                              <span style={{
                                padding: '1px 6px', borderRadius: 6,
                                background: 'rgba(168,85,247,0.15)', color: '#c084fc',
                                fontSize: 10, fontWeight: 700, border: '1px solid rgba(168,85,247,0.25)',
                              }}>
                                +{Math.floor(user.bonus_balance)} B
                              </span>
                            )}
                          </div>
                        </div>
                        {[
                          { to: path('profile'), icon: <User size={13} />, label: locale === 'fr' ? 'Mon Profil' : 'Pwofil Mwen' },
                          { to: path('portfolio'), icon: <Wallet size={13} />, label: locale === 'fr' ? 'Portefeuille' : 'Pòtfolyo' },
                          { to: path('myBets'), icon: <BarChart2 size={13} />, label: locale === 'fr' ? 'Mes Paris' : 'Pari Mwen' },
                        ].map(({ to, icon, label }) => (
                          <Link key={to} to={to} onClick={() => setDropOpen(false)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                              borderRadius: 8, fontSize: 13, color: '#e6edf3', textDecoration: 'none',
                              transition: 'background .12s'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                            <span style={{ color: '#8b949e' }}>{icon}</span>{label}
                          </Link>
                        ))}
                        <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '6px 0' }} />
                        <button onClick={() => { setDropOpen(false); logout(); navigate(path('home')); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                            borderRadius: 8, fontSize: 13, color: '#f85149', background: 'none', border: 'none',
                            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,81,73,0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                          <LogOut size={13} /> {locale === 'fr' ? 'Déconnexion' : 'Dekonekte'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : initialized ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Link to={path('login')} className="btn-ghost hidden sm:flex" style={{ padding: '6px 12px', fontSize: 12 }}>
                    {t('nav.login')}
                  </Link>
                  <Link to={path('register')} className="btn-yellow" style={{ padding: '6px 12px', fontSize: 12 }}>
                    {t('nav.register')}
                  </Link>
                </div>
              ) : (
                <div style={{ width: 80, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)' }} />
              )}

              {/* Hamburger — HIDDEN ON DESKTOP */}
              <button onClick={() => setMobileOpen(v => !v)} className="md:hidden"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', height: 36,
                  background: mobileOpen ? 'rgba(56,139,253,0.12)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${mobileOpen ? 'rgba(56,139,253,0.35)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 10, cursor: 'pointer',
                  color: mobileOpen ? '#388bfd' : '#8b949e',
                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  transition: 'all .2s ease', flexShrink: 0,
                }}>
                {mobileOpen ? <X size={16} /> : <Menu size={16} />}
                <span style={{ fontSize: 12 }}>{mobileOpen ? 'Fermer' : 'Menu'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category bar */}
        {onMarketsOrHome && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="container">
              <div className="noscroll" style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', padding: '7px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8, flexShrink: 0 }}>
                  <div className="live-dot" />
                  <span style={{ color: '#f85149', fontSize: 10, fontWeight: 700, letterSpacing: '1px' }}>LIVE</span>
                </div>
                <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)', flexShrink: 0, marginRight: 4 }} />
                {CATS.map(c => (
                  <button key={c.id} onClick={() => handleCat(c.id as MarketCategory | '')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer', flexShrink: 0,
                      background: activeCategory === c.id ? '#1f6feb' : 'rgba(255,255,255,0.04)',
                      color: activeCategory === c.id ? 'white' : '#8b949e',
                      border: '1px solid ' + (activeCategory === c.id ? '#1f6feb' : 'rgba(255,255,255,0.07)'),
                      fontWeight: activeCategory === c.id ? 600 : 400,
                      fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap'
                    }}>
                    {CAT_ICONS[c.id]} {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Mobile search overlay */}
      {searchOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
        }} onClick={() => setSearchOpen(false)}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            background: '#0d1117',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            padding: '12px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            animation: 'slideDown .18s ease-out',
          }} onClick={e => e.stopPropagation()}>
            <style>{`@keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
            <form onSubmit={e => { handleSearchSubmit(e); setSearchOpen(false); }} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{
                flex: 1, position: 'relative', display: 'flex', alignItems: 'center',
                background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(56,139,253,0.5)',
                borderRadius: 12, boxShadow: '0 0 0 3px rgba(56,139,253,0.1)',
              }}>
                <Search size={16} style={{ position: 'absolute', left: 13, color: '#388bfd', pointerEvents: 'none' }} />
                <input
                  ref={mobileSearchRef}
                  type="search"
                  value={searchVal}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder={t('nav.search_placeholder')}
                  style={{
                    width: '100%', background: 'transparent', border: 'none', borderRadius: 12,
                    padding: '11px 36px 11px 40px', color: 'white', fontSize: 15,
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
                {searchVal && (
                  <button type="button" onClick={() => setSearchVal('')}
                    style={{
                      position: 'absolute', right: 10, background: 'rgba(255,255,255,0.1)',
                      border: 'none', borderRadius: '50%', width: 22, height: 22,
                      cursor: 'pointer', color: '#8b949e',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <X size={12} />
                  </button>
                )}
              </div>
              <button type="button" onClick={() => setSearchOpen(false)}
                style={{
                  padding: '10px 14px', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                  color: '#8b949e', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                {fr ? 'Annuler' : 'Anile'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Spacer */}
      <div style={{ height: headerHeight + (onMarketsOrHome ? 10 : 0), flexShrink: 0 }} />

      {/* Mobile menu drawer */}
      <div className={clsx('mobile-menu md:hidden', mobileOpen && 'open')}>
        <div style={{ padding: 16 }}>
          {/* Header row: logo + close */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Logo />
            <button onClick={() => setMobileOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 8, cursor: 'pointer', color: '#8b949e', padding: '6px 10px',
                display: 'flex', alignItems: 'center'
              }}>
              <X size={18} />
            </button>
          </div>

          {/* Mobile nav links */}
          <nav style={{ marginBottom: 16 }}>
            {[
              { to: path('home'), label: t('nav.home'), icon: <Home size={15} /> },
              { to: path('markets'), label: t('nav.markets'), icon: <BarChart2 size={15} /> },
              ...(user ? [
                { to: path('portfolio'), label: t('nav.portfolio'), icon: <Wallet size={15} /> },
                { to: path('myBets'), label: t('nav.my_bets'), icon: <Award size={15} /> },
              ] : []),
            ].map(n => (
              <Link key={n.to} to={n.to}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                  fontSize: 14, fontWeight: 500, marginBottom: 4, textDecoration: 'none',
                  background: isActive(n.to) ? 'rgba(255,255,255,0.06)' : 'none',
                  color: isActive(n.to) ? 'white' : '#8b949e'
                }}>
                <span style={{ color: isActive(n.to) ? '#1f6feb' : '#484f58' }}>{n.icon}</span>{n.label}
              </Link>
            ))}
          </nav>

          {/* Language */}
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 10, color: '#484f58', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: '0 0 8px' }}>
              {t('nav.language')}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {SUPPORTED_LOCALES.map(loc => (
                <button key={loc} onClick={() => { changeLocale(loc); setMobileOpen(false); }}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    background: locale === loc ? '#1f6feb' : '#21262d',
                    color: locale === loc ? 'white' : '#8b949e', border: 'none'
                  }}>
                  {loc === 'fr' ? '🇫🇷' : '🇭🇹'} {LOCALE_NAMES[loc]}
                </button>
              ))}
            </div>
          </div>

          {/* User section */}
          {user ? (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: '#161b22', borderRadius: 12, marginBottom: 10,
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', background: '#1f6feb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: 'white', flexShrink: 0
                }}>
                  {user.username[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>@{user.username}</div>
                  <div style={{ fontSize: 13, color: '#3fb950', fontFamily: 'JetBrains Mono,monospace', marginTop: 1 }}>
                    {Math.floor(user.balance).toLocaleString()} HTG
                    {(user.bonus_balance ?? 0) > 0 && (
                      <span style={{ marginLeft: 6, color: '#c084fc', fontSize: 11 }}>
                        +{Math.floor(user.bonus_balance)} Bonus
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => { setMobileOpen(false); openWallet('deposit'); }}
                  style={{
                    padding: '7px 14px', background: 'rgba(63,185,80,0.1)',
                    border: '1px solid rgba(63,185,80,0.3)', borderRadius: 8,
                    color: '#3fb950', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit', flexShrink: 0
                  }}>
                  + Depoze
                </button>
              </div>
              <button onClick={() => { setMobileOpen(false); logout(); navigate(path('home')); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#f85149', fontSize: 13, fontFamily: 'inherit', borderRadius: 8
                }}>
                <LogOut size={14} /> {locale === 'fr' ? 'Déconnexion' : 'Dekonekte'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link to={path('login')} className="btn-ghost" style={{ justifyContent: 'center', padding: 11 }}>{t('nav.login')}</Link>
              <Link to={path('register')} className="btn-yellow" style={{ justifyContent: 'center', padding: 11 }}>{t('nav.register')}</Link>
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav — mobile/tablet */}
      <nav className="bottom-nav">
        {[
          { to: path('home'),    icon: Home,     label: t('nav.home'),      exact: true },
          { to: path('markets'), icon: BarChart2, label: t('nav.markets'),   exact: false },
          { to: user ? path('portfolio') : path('login'),   icon: Wallet, label: user ? t('nav.portfolio') : t('nav.login'),  exact: false },
          { to: user ? path('myBets')    : path('register'), icon: user ? Award : User, label: user ? t('nav.my_bets') : t('nav.register'), exact: false },
        ].map(({ to, icon: Icon, label, exact }) => {
          const active = exact ? location.pathname === to : location.pathname === to || location.pathname.startsWith(to + '/') || location.pathname.startsWith(to.replace(/\/[^/]+$/, '/market/'));
          return (
            <Link key={to + label} to={to} className={clsx('bnav-item', active && 'active')}>
              <Icon size={20} /><span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

