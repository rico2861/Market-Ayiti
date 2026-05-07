import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, LogOut, User, TrendingUp, Menu, X,
  ChevronDown, Wallet, Home, BarChart2, Award, Globe, Bell
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../hooks/useLocale';
import { SUPPORTED_LOCALES, LOCALE_NAMES } from '../../i18n';
import type { MarketCategory } from '../../types';
import WalletModal from '../wallet/WalletModal';
import clsx from 'clsx';

const CAT_EMOJI: Record<string, string> = {
  '':'🌐', nouvo:'🔥', politik:'🗳️', spo:'⚽', ekonomi:'💰', kilti:'🎭', sosyal:'🏘️', lot:'📌'
};

export default function Header() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { locale, changeLocale, path } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeCategory = (searchParams.get('category') || '') as MarketCategory | '';

  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropOpen,   setDropOpen]   = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [langOpen,   setLangOpen]   = useState(false);
  const [scrolled,   setScrolled]   = useState(false);
  const [searchVal,  setSearchVal]  = useState(searchParams.get('q') || '');
  const [headerHeight, setHeaderHeight] = useState(64);

  const dropRef   = useRef<HTMLDivElement>(null);
  const langRef   = useRef<HTMLDivElement>(null);
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
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

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

  const CATS: { id: MarketCategory | ''; label: string }[] = [
    { id: '',        label: t('categories.all') },
    { id: 'politik', label: t('categories.politik') },
    { id: 'spo',     label: t('categories.spo') },
    { id: 'ekonomi', label: t('categories.ekonomi') },
    { id: 'kilti',   label: t('categories.kilti') },
    { id: 'sosyal',  label: t('categories.sosyal') },
    { id: 'lot',     label: t('categories.lot') },
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
    <Link to={path('home')} style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
      <div style={{
        width:30, height:30, borderRadius:8,
        background:'linear-gradient(135deg,#1d4ed8,#2563eb)',
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        boxShadow:'0 2px 10px rgba(37,99,235,.3)',
      }}>
        <TrendingUp size={15} color="white" strokeWidth={2.5}/>
      </div>
      {/* ★ Always visible — removed hidden sm:block */}
      <span style={{ fontWeight:800, color:'white', fontSize:15, letterSpacing:'-.4px', lineHeight:1 }}>
        Ayiti<span style={{ color:'#388bfd' }}>Market</span>
      </span>
    </Link>
  );

  return (
    <>
      {walletOpen && user && <WalletModal onClose={() => setWalletOpen(false)} />}

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
          <div style={{ display:'flex', alignItems:'center', gap:8, height:56 }}>

            {/* ★ Logo — wordmark always visible on all screen sizes */}
            <div style={{ marginRight:4 }}>
              <Logo />
            </div>

            {/* Desktop nav links */}
            <nav className="hidden lg:flex items-center gap-0.5" style={{ marginRight:4 }}>
              {[
                { to:path('home'),    label:t('nav.home') },
                { to:path('markets'), label:t('nav.markets') },
                ...(user ? [{ to:path('myBets'), label:t('nav.my_bets') }] : []),
              ].map(n => (
                <Link key={n.to} to={n.to}
                  className={clsx('px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                    isActive(n.to) ? 'text-white bg-white/[0.07]' : 'text-[#8b949e] hover:text-white hover:bg-white/[0.04]')}
                  style={{ textDecoration:'none' }}>
                  {n.label}
                </Link>
              ))}
            </nav>

            {/* Search */}
            <form onSubmit={handleSearchSubmit} style={{ flex:1, maxWidth:460 }} className="hidden md:flex">
              <div style={{ position:'relative', width:'100%' }}>
                <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#484f58', pointerEvents:'none' }}/>
                <input ref={searchRef} type="search" value={searchVal}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder={t('nav.search_placeholder')}
                  style={{ width:'100%', background:'#21262d', border:'1px solid rgba(255,255,255,0.08)',
                    borderRadius:8, padding:'7px 36px 7px 34px', color:'white', fontSize:13,
                    outline:'none', fontFamily:'inherit', transition:'border-color .15s, background .15s' }}
                  onFocus={e => { e.target.style.borderColor='#1f6feb'; e.target.style.background='#161b22'; }}
                  onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.08)'; e.target.style.background='#21262d'; }}
                />
                {!searchVal && (
                  <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                    background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                    borderRadius:4, padding:'1px 6px', fontSize:11, color:'#484f58', pointerEvents:'none' }}>/</span>
                )}
              </div>
            </form>

            <div style={{ flex:1 }}/>

            {/* Right side */}
            <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>

              {/* Language switcher */}
              <div ref={langRef} style={{ position:'relative' }}>
                <button onClick={() => setLangOpen(v=>!v)}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 10px',
                    background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                    borderRadius:8, cursor:'pointer', color:'#8b949e', fontSize:12, fontWeight:600, fontFamily:'inherit' }}>
                  <Globe size={13}/>{locale.toUpperCase()}<ChevronDown size={11}/>
                </button>
                {langOpen && (
                  <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:'#161b22',
                    border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:6,
                    zIndex:100, minWidth:130, boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}>
                    {SUPPORTED_LOCALES.map(loc => (
                      <button key={loc} onClick={() => { changeLocale(loc); setLangOpen(false); }}
                        style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 12px',
                          background: locale===loc ? 'rgba(31,111,235,0.15)' : 'none',
                          border:'none', borderRadius:7, cursor:'pointer', fontFamily:'inherit',
                          fontSize:13, color: locale===loc ? '#388bfd' : '#e6edf3', fontWeight: locale===loc ? 600 : 400,
                          textAlign:'left' }}>
                        <span style={{ fontSize:16 }}>{loc==='fr'?'🇫🇷':'🇭🇹'}</span>
                        {LOCALE_NAMES[loc]}
                        {locale===loc && <span style={{ marginLeft:'auto', color:'#388bfd', fontSize:12 }}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {user ? (
                <>
                  {/* Balance pill — hidden on mobile (shown in bottom nav / drawer instead) */}
                  <button onClick={() => setWalletOpen(true)}
                    className="hidden sm:flex"
                    style={{ alignItems:'center', gap:5, padding:'6px 10px',
                      background:'rgba(63,185,80,0.1)', border:'1px solid rgba(63,185,80,0.2)',
                      borderRadius:8, cursor:'pointer', color:'#3fb950', fontSize:12, fontWeight:700,
                      fontFamily:'JetBrains Mono,monospace' }}>
                    <Wallet size={12}/>
                    {Math.floor(user.balance).toLocaleString()} HTG
                  </button>

                  {/* User dropdown */}
                  <div ref={dropRef} style={{ position:'relative' }}>
                    <button onClick={() => setDropOpen(v=>!v)}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px',
                        background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                        borderRadius:8, cursor:'pointer', fontFamily:'inherit' }}>
                      <div style={{ width:24, height:24, borderRadius:'50%', background:'#1f6feb',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:11, fontWeight:700, color:'white', flexShrink:0 }}>
                        {user.username[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize:12, color:'#e6edf3', fontWeight:500 }} className="hidden sm:block">
                        {user.username}
                      </span>
                      <ChevronDown size={11} color="#8b949e" className="hidden sm:block"/>
                    </button>
                    {dropOpen && (
                      <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:'#161b22',
                        border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:8,
                        zIndex:100, minWidth:200, boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}>
                        <div style={{ padding:'8px 12px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)', marginBottom:6 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'white' }}>@{user.username}</div>
                          <div style={{ fontSize:12, color:'#3fb950', fontFamily:'JetBrains Mono,monospace', marginTop:2 }}>
                            {user.balance.toLocaleString()} HTG
                          </div>
                        </div>
                        {[
                          { to:path('profile'),   icon:<User size={13}/>,    label: locale==='fr'?'Mon Profil':'Pwofil Mwen' },
                          { to:path('portfolio'), icon:<Wallet size={13}/>,  label: locale==='fr'?'Portefeuille':'Pòtfolyo' },
                          { to:path('myBets'),    icon:<BarChart2 size={13}/>, label: locale==='fr'?'Mes Paris':'Pari Mwen' },
                        ].map(({ to, icon, label }) => (
                          <Link key={to} to={to} onClick={() => setDropOpen(false)}
                            style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                              borderRadius:8, fontSize:13, color:'#e6edf3', textDecoration:'none',
                              transition:'background .12s' }}
                            onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.05)')}
                            onMouseLeave={e=>(e.currentTarget.style.background='none')}>
                            <span style={{ color:'#8b949e' }}>{icon}</span>{label}
                          </Link>
                        ))}
                        <hr style={{ border:'none', borderTop:'1px solid rgba(255,255,255,0.06)', margin:'6px 0' }}/>
                        <button onClick={() => { setDropOpen(false); logout(); navigate(path('home')); }}
                          style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 12px',
                            borderRadius:8, fontSize:13, color:'#f85149', background:'none', border:'none',
                            cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}
                          onMouseEnter={e=>(e.currentTarget.style.background='rgba(248,81,73,0.08)')}
                          onMouseLeave={e=>(e.currentTarget.style.background='none')}>
                          <LogOut size={13}/> {locale==='fr'?'Déconnexion':'Dekonekte'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display:'flex', gap:6 }}>
                  <Link to={path('login')} className="btn-ghost hidden sm:flex" style={{ padding:'6px 12px', fontSize:12 }}>
                    {t('nav.login')}
                  </Link>
                  <Link to={path('register')} className="btn-yellow" style={{ padding:'6px 12px', fontSize:12 }}>
                    {t('nav.register')}
                  </Link>
                </div>
              )}

              {/* Hamburger — mobile only */}
              <button onClick={() => setMobileOpen(v=>!v)} className="lg:hidden"
                style={{ width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
                  background:'none', border:'none', cursor:'pointer', color:'#8b949e' }}>
                {mobileOpen ? <X size={20}/> : <Menu size={20}/>}
              </button>
            </div>
          </div>
        </div>

        {/* Category bar */}
        {onMarketsOrHome && (
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <div className="container">
              <div className="noscroll" style={{ display:'flex', alignItems:'center', gap:4, overflowX:'auto', padding:'7px 0' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, paddingRight:8, flexShrink:0 }}>
                  <div className="live-dot"/>
                  <span style={{ color:'#f85149', fontSize:10, fontWeight:700, letterSpacing:'1px' }}>LIVE</span>
                </div>
                <div style={{ width:1, height:14, background:'rgba(255,255,255,0.08)', flexShrink:0, marginRight:4 }}/>
                {CATS.map(c => (
                  <button key={c.id} onClick={() => handleCat(c.id as MarketCategory | '')}
                    style={{ padding:'4px 12px', borderRadius:20, fontSize:12, cursor:'pointer', flexShrink:0,
                      background: activeCategory===c.id ? '#1f6feb' : 'rgba(255,255,255,0.04)',
                      color: activeCategory===c.id ? 'white' : '#8b949e',
                      border:'1px solid '+(activeCategory===c.id?'#1f6feb':'rgba(255,255,255,0.07)'),
                      fontWeight: activeCategory===c.id ? 600 : 400,
                      fontFamily:'inherit', transition:'all .15s', whiteSpace:'nowrap' }}>
                    {CAT_EMOJI[c.id]} {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Spacer */}
      <div style={{ height: headerHeight + (onMarketsOrHome ? 10 : 0), flexShrink:0 }}/>

      {/* Mobile menu drawer */}
      <div className={clsx('mobile-menu lg:hidden', mobileOpen && 'open')}>
        <div style={{ padding:16 }}>
          {/* ★ Header row: logo + close */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <Logo />
            <button onClick={() => setMobileOpen(false)}
              style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)',
                borderRadius:8, cursor:'pointer', color:'#8b949e', padding:'6px 10px',
                display:'flex', alignItems:'center' }}>
              <X size={18}/>
            </button>
          </div>

          {/* Mobile search */}
          <form onSubmit={handleSearchSubmit} style={{ marginBottom:16 }}>
            <div style={{ position:'relative' }}>
              <Search size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#484f58' }}/>
              <input type="search" value={searchVal} onChange={e => handleSearchChange(e.target.value)}
                placeholder={t('nav.search_placeholder')} className="input" style={{ paddingLeft:36 }}/>
            </div>
          </form>

          {/* Mobile nav links */}
          <nav style={{ marginBottom:16 }}>
            {[
              { to:path('home'),      label:t('nav.home'),      icon:<Home size={15}/> },
              { to:path('markets'),   label:t('nav.markets'),   icon:<BarChart2 size={15}/> },
              ...(user ? [
                { to:path('portfolio'), label:t('nav.portfolio'), icon:<Wallet size={15}/> },
                { to:path('myBets'),    label:t('nav.my_bets'),   icon:<Award size={15}/> },
              ] : []),
            ].map(n => (
              <Link key={n.to} to={n.to}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10,
                  fontSize:14, fontWeight:500, marginBottom:4, textDecoration:'none',
                  background: isActive(n.to) ? 'rgba(255,255,255,0.06)' : 'none',
                  color: isActive(n.to) ? 'white' : '#8b949e' }}>
                <span style={{ color:isActive(n.to)?'#1f6feb':'#484f58' }}>{n.icon}</span>{n.label}
              </Link>
            ))}
          </nav>

          {/* Language */}
          <div style={{ marginBottom:16, paddingBottom:16, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize:10, color:'#484f58', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600, margin:'0 0 8px' }}>
              {t('nav.language')}
            </p>
            <div style={{ display:'flex', gap:8 }}>
              {SUPPORTED_LOCALES.map(loc => (
                <button key={loc} onClick={() => { changeLocale(loc); setMobileOpen(false); }}
                  style={{ flex:1, padding:'8px 12px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                    background: locale===loc ? '#1f6feb' : '#21262d',
                    color: locale===loc ? 'white' : '#8b949e', border:'none' }}>
                  {loc==='fr'?'🇫🇷':'🇭🇹'} {LOCALE_NAMES[loc]}
                </button>
              ))}
            </div>
          </div>

          {/* User section */}
          {user ? (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                background:'#161b22', borderRadius:12, marginBottom:10,
                border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width:38, height:38, borderRadius:'50%', background:'#1f6feb',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:16, fontWeight:700, color:'white', flexShrink:0 }}>
                  {user.username[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'white' }}>@{user.username}</div>
                  <div style={{ fontSize:13, color:'#3fb950', fontFamily:'JetBrains Mono,monospace', marginTop:1 }}>
                    {Math.floor(user.balance).toLocaleString()} HTG
                  </div>
                </div>
                <button onClick={() => { setMobileOpen(false); setWalletOpen(true); }}
                  style={{ padding:'7px 14px', background:'rgba(63,185,80,0.1)',
                    border:'1px solid rgba(63,185,80,0.3)', borderRadius:8,
                    color:'#3fb950', fontSize:12, fontWeight:700, cursor:'pointer',
                    fontFamily:'inherit', flexShrink:0 }}>
                  + Depoze
                </button>
              </div>
              <button onClick={() => { setMobileOpen(false); logout(); navigate(path('home')); }}
                style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'9px 12px',
                  background:'none', border:'none', cursor:'pointer',
                  color:'#f85149', fontSize:13, fontFamily:'inherit', borderRadius:8 }}>
                <LogOut size={14}/> {locale==='fr'?'Déconnexion':'Dekonekte'}
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <Link to={path('login')} className="btn-ghost" style={{ justifyContent:'center', padding:11 }}>{t('nav.login')}</Link>
              <Link to={path('register')} className="btn-yellow" style={{ justifyContent:'center', padding:11 }}>{t('nav.register')}</Link>
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav — mobile/tablet */}
      <nav className="bottom-nav">
        {[
          { to:path('home'),    icon:Home,      label:t('nav.home') },
          { to:path('markets'), icon:BarChart2,  label:t('nav.markets') },
          { to:user?path('portfolio'):path('login'), icon:Wallet, label:user?t('nav.portfolio'):t('nav.login') },
          { to:user?path('myBets'):path('register'), icon:user?Award:User, label:user?t('nav.my_bets'):t('nav.register') },
        ].map(({ to, icon:Icon, label }) => (
          <Link key={to+label} to={to} className={clsx('bnav-item', isActive(to)&&'active')}>
            <Icon size={20}/><span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}