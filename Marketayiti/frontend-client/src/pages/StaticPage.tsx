import { useLocation } from 'react-router-dom';
import { useLocale } from '../hooks/useLocale';
import {
  TrendingUp, Mail, MessageCircle, Shield, FileText,
  HelpCircle, ChevronRight, MapPin, Clock, AlertCircle
} from 'lucide-react';

/* ── detect which static page ── */
function useStaticPage() {
  const { pathname } = useLocation();
  if (pathname.includes('confidentialite') || pathname.includes('privacy')) return 'privacy';
  if (pathname.includes('cgu') || pathname.includes('terms')) return 'terms';
  if (pathname.includes('contact')) return 'contact';
  if (pathname.includes('about')) return 'about';
  if (pathname.includes('help')) return 'help';
  if (pathname.includes('faq')) return 'faq';
  return 'about';
}

/* ── shared layout ── */
function PageShell({ title, subtitle, icon, children }: {
  title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ background: '#090d12', minHeight: '80vh', padding: '48px 16px 80px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 48, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(31,111,235,0.2), rgba(56,139,253,0.1))',
            border: '1px solid rgba(56,139,253,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', color: '#388bfd'
          }}>{icon}</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'white', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
            {title}
          </h1>
          <p style={{ fontSize: 15, color: '#8b949e', margin: 0 }}>{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: '0 0 14px', borderLeft: '3px solid #388bfd', paddingLeft: 12 }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: '#8b949e', lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#161b22', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '20px 24px', marginBottom: 16
    }}>
      {children}
    </div>
  );
}

/* ── page: about ── */
function AboutPage({ locale }: { locale: string }) {
  const isFr = locale === 'fr';
  return (
    <PageShell
      title={isFr ? 'À propos d\'AyitiMarket' : 'Sou AyitiMarket'}
      subtitle={isFr ? 'La première plateforme de marchés prédictifs haïtienne' : 'Premye platfòm mache prediksyon ayisyen an'}
      icon={<TrendingUp size={26} />}
    >
      <div style={{
        background: 'linear-gradient(135deg, rgba(31,111,235,0.08), rgba(56,139,253,0.04))',
        border: '1px solid rgba(56,139,253,0.15)', borderRadius: 14, padding: '24px 28px', marginBottom: 36,
        display: 'flex', alignItems: 'center', gap: 16
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <TrendingUp size={20} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Ayiti<span style={{ color: '#388bfd' }}>Market</span></div>
          <div style={{ fontSize: 13, color: '#8b949e', marginTop: 2 }}>
            {isFr ? 'Marchés prédictifs en temps réel' : 'Mache prediksyon an tan reyèl'}
          </div>
        </div>
      </div>

      <Section title={isFr ? 'Notre mission' : 'Misyon nou'}>
        <p>
          {isFr
            ? 'AyitiMarket est la première plateforme haïtienne de marchés prédictifs. Nous permettons aux utilisateurs de parier sur des événements réels en Haïti et dans le monde — politique, sport, économie, culture — et de gagner des récompenses basées sur leurs prédictions.'
            : 'AyitiMarket se premye platfòm mache prediksyon ayisyen an. Nou pèmèt itilizatè yo pari sou evènman reyèl ann Ayiti ak nan mond lan — politik, spò, ekonomi, kilti — epi genyen rekonpans ki baze sou prediksyon yo.'}
        </p>
      </Section>

      <Section title={isFr ? 'Comment ça fonctionne' : 'Kijan li travay'}>
        {[
          { n: '1', t: isFr ? 'Parcourez les marchés' : 'Gade mache yo', d: isFr ? 'Explorez des centaines de marchés actifs sur différents sujets.' : 'Eksplore santèn mache aktif sou sijè diferan.' },
          { n: '2', t: isFr ? 'Placez vos paris' : 'Mete pari ou', d: isFr ? 'Misez sur l\'issue que vous prévoyez avec vos HTG.' : 'Mize sou rezilta ou prevwa a ak HTG ou.' },
          { n: '3', t: isFr ? 'Suivez en temps réel' : 'Swiv an tan reyèl', d: isFr ? 'Les cotes évoluent dynamiquement selon les paris placés.' : 'Kòt yo evolye dinamikman selon pari ki plase.' },
          { n: '4', t: isFr ? 'Encaissez vos gains' : 'Kolekte kòb ou', d: isFr ? 'Recevez vos récompenses si votre prédiction s\'avère correcte.' : 'Resevwa rekonpans ou si prediksyon ou kòrèk.' },
        ].map(step => (
          <Card key={step.n}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(56,139,253,0.15)', border: '1px solid rgba(56,139,253,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#388bfd', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {step.n}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 4 }}>{step.t}</div>
                <div style={{ fontSize: 13, color: '#8b949e' }}>{step.d}</div>
              </div>
            </div>
          </Card>
        ))}
      </Section>

      <Section title={isFr ? 'Nous contacter' : 'Kontakte nou'}>
        <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={15} color="#388bfd" />
          <span>contact@ayitimarket.com</span>
        </p>
      </Section>
    </PageShell>
  );
}

/* ── page: contact ── */
function ContactPage({ locale }: { locale: string }) {
  const isFr = locale === 'fr';
  return (
    <PageShell
      title={isFr ? 'Contactez-nous' : 'Kontakte Nou'}
      subtitle={isFr ? 'Notre équipe est disponible pour vous aider' : 'Ekip nou an disponib pou ede ou'}
      icon={<Mail size={26} />}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 40 }}>
        {[
          { icon: <Mail size={20} color="#388bfd" />, label: 'Email', value: 'contact@ayitimarket.com', bg: 'rgba(56,139,253,0.08)', border: 'rgba(56,139,253,0.2)' },
          { icon: <MessageCircle size={20} color="#3fb950" />, label: isFr ? 'Support Live' : 'Sipò Live', value: isFr ? 'Chat disponible' : 'Chat disponib', bg: 'rgba(63,185,80,0.08)', border: 'rgba(63,185,80,0.2)' },
          { icon: <Clock size={20} color="#d29922" />, label: isFr ? 'Horaires' : 'Orè', value: '8h – 22h (EST)', bg: 'rgba(210,153,34,0.08)', border: 'rgba(210,153,34,0.2)' },
          { icon: <MapPin size={20} color="#a371f7" />, label: 'Location', value: 'Port-au-Prince, Haïti', bg: 'rgba(163,113,247,0.08)', border: 'rgba(163,113,247,0.2)' },
        ].map(item => (
          <div key={item.label} style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ marginBottom: 10 }}>{item.icon}</div>
            <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 14, color: 'white', fontWeight: 600 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <Card>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 16 }}>
          {isFr ? 'Envoyer un message' : 'Voye yon mesaj'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input placeholder={isFr ? 'Votre nom' : 'Non ou'} style={{
            background: '#21262d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
            padding: '10px 14px', color: 'white', fontSize: 13, fontFamily: 'inherit', outline: 'none'
          }} />
          <input type="email" placeholder={isFr ? 'Votre email' : 'Email ou'} style={{
            background: '#21262d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
            padding: '10px 14px', color: 'white', fontSize: 13, fontFamily: 'inherit', outline: 'none'
          }} />
          <textarea placeholder={isFr ? 'Votre message...' : 'Mesaj ou...'} rows={4} style={{
            background: '#21262d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
            padding: '10px 14px', color: 'white', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical'
          }} />
          <button style={{
            background: 'linear-gradient(135deg, #388bfd, #1f6feb)', color: 'white',
            border: 'none', borderRadius: 8, padding: '11px 24px',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8
          }}>
            <Mail size={14} />
            {isFr ? 'Envoyer' : 'Voye'}
          </button>
        </div>
      </Card>
    </PageShell>
  );
}

/* ── page: terms ── */
function TermsPage({ locale }: { locale: string }) {
  const isFr = locale === 'fr';
  return (
    <PageShell
      title={isFr ? 'Conditions Générales' : 'Kondisyon Jeneral'}
      subtitle={isFr ? 'Dernière mise à jour: Mai 2026' : 'Dènye mizajou: Me 2026'}
      icon={<FileText size={26} />}
    >
      <div style={{ marginBottom: 24, padding: '14px 16px', background: 'rgba(210,153,34,0.08)', border: '1px solid rgba(210,153,34,0.2)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AlertCircle size={16} color="#d29922" style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 13, color: '#d29922' }}>
          {isFr ? 'En utilisant AyitiMarket, vous acceptez ces conditions.' : 'Lè ou itilize AyitiMarket, ou aksepte kondisyon sa yo.'}
        </span>
      </div>

      {[
        {
          t: isFr ? '1. Acceptation des conditions' : '1. Akseptasyon kondisyon yo',
          d: isFr ? 'En accédant à AyitiMarket, vous acceptez d\'être lié par ces conditions d\'utilisation. Si vous n\'acceptez pas ces conditions, veuillez ne pas utiliser notre service.' : 'Lè ou aksede AyitiMarket, ou aksepte lye pa kondisyon itilizasyon sa yo. Si ou pa aksepte kondisyon sa yo, tanpri pa itilize sèvis nou an.'
        },
        {
          t: isFr ? '2. Éligibilité' : '2. Elijibilite',
          d: isFr ? 'Vous devez avoir au moins 18 ans pour utiliser AyitiMarket. En vous inscrivant, vous confirmez que vous avez l\'âge légal requis dans votre juridiction.' : 'Ou dwe gen omwen 18 an pou itilize AyitiMarket. Lè ou enskri, ou konfime ke ou gen laj legal ki obligatwa nan jiridiksyon ou an.'
        },
        {
          t: isFr ? '3. Paris et transactions' : '3. Pari ak tranzaksyon',
          d: isFr ? 'Tous les paris sont définitifs une fois confirmés. Les fonds déposés peuvent être retirés selon nos conditions de retrait. AyitiMarket se réserve le droit d\'annuler des paris en cas d\'erreur technique.' : 'Tout pari yo definitif yon fwa konfime. Lajan ki depoze ka retire selon kondisyon retri nou an. AyitiMarket rezève dwa pou anile pari yo an ka erè teknik.'
        },
        {
          t: isFr ? '4. Responsabilité' : '4. Responsabilite',
          d: isFr ? 'AyitiMarket n\'est pas responsable des pertes résultant de vos décisions de pari. Le trading de prédiction comporte des risques et vous pourriez perdre tout ou partie de votre capital.' : 'AyitiMarket pa responsab pèt ki soti nan desizyon pari ou yo. Echanj prediksyon pote risk epi ou ka pèdi tout oswa yon pati nan kapital ou.'
        },
        {
          t: isFr ? '5. Modifications' : '5. Modifikasyon',
          d: isFr ? 'AyitiMarket se réserve le droit de modifier ces conditions à tout moment. Les modifications entrent en vigueur dès leur publication sur le site.' : 'AyitiMarket rezève dwa modifye kondisyon sa yo nenpòt ki lè. Modifikasyon yo antre an vigè depi yo pibliye sou sit la.'
        },
      ].map(s => (
        <Section key={s.t} title={s.t}><p>{s.d}</p></Section>
      ))}
    </PageShell>
  );
}

/* ── page: privacy ── */
function PrivacyPage({ locale }: { locale: string }) {
  const isFr = locale === 'fr';
  return (
    <PageShell
      title={isFr ? 'Politique de Confidentialité' : 'Politik Konfidansyalite'}
      subtitle={isFr ? 'Vos données sont protégées et respectées' : 'Done ou yo pwoteje epi respekte'}
      icon={<Shield size={26} />}
    >
      {[
        {
          t: isFr ? '1. Données collectées' : '1. Done kolekte',
          d: isFr ? 'Nous collectons les informations que vous nous fournissez lors de l\'inscription (email, nom d\'utilisateur), ainsi que les données d\'utilisation de la plateforme (paris, transactions, préférences).' : 'Nou kolekte enfòmasyon ou ba nou lè ou enskri (imèl, non itilizatè), ansanm ak done itilizasyon platfòm nan (pari, tranzaksyon, preferans).'
        },
        {
          t: isFr ? '2. Utilisation des données' : '2. Itilizasyon done yo',
          d: isFr ? 'Vos données sont utilisées pour: fournir nos services, améliorer la plateforme, vous envoyer des notifications importantes, prévenir la fraude et respecter nos obligations légales.' : 'Done ou yo itilize pou: bay sèvis nou yo, amelyore platfòm nan, voye notifikasyon enpòtan ban ou, anpeche fwòd ak respekte obligasyon legal nou yo.'
        },
        {
          t: isFr ? '3. Partage des données' : '3. Pataj done yo',
          d: isFr ? 'Nous ne vendons jamais vos données personnelles. Nous pouvons partager des données agrégées et anonymisées pour des analyses statistiques.' : 'Nou pa janm vann done pèsonèl ou yo. Nou ka pataje done agrege ak anonim pou analiz estatistik.'
        },
        {
          t: isFr ? '4. Sécurité' : '4. Sekirite',
          d: isFr ? 'Nous utilisons des mesures de sécurité standard incluant le chiffrement HTTPS, les mots de passe hashés, et les cookies HttpOnly sécurisés.' : 'Nou itilize mezi sekirite estanda ki enkli chifreman HTTPS, modpas ki hache, ak kuki HttpOnly sekirize.'
        },
        {
          t: isFr ? '5. Vos droits' : '5. Dwa ou yo',
          d: isFr ? 'Vous avez le droit d\'accéder, de modifier ou de supprimer vos données personnelles. Contactez-nous à privacy@ayitimarket.com.' : 'Ou gen dwa aksede, modifye oswa efase done pèsonèl ou yo. Kontakte nou nan privacy@ayitimarket.com.'
        },
      ].map(s => (
        <Section key={s.t} title={s.t}><p>{s.d}</p></Section>
      ))}
    </PageShell>
  );
}

/* ── page: help ── */
function HelpPage({ locale }: { locale: string }) {
  const isFr = locale === 'fr';
  const faqs = isFr ? [
    { q: 'Comment déposer des fonds?', a: 'Cliquez sur votre solde en haut à droite, puis choisissez "Déposer". Vous pouvez déposer via MonCash ou carte.' },
    { q: 'Comment fonctionne un marché?', a: 'Chaque marché pose une question binaire (Oui/Non). Vous pariez sur un résultat et gagnez si vous avez raison quand le marché est résolu.' },
    { q: 'Comment retirer mes gains?', a: 'Allez dans votre Portefeuille, cliquez sur "Retirer". Les retraits sont traités sous 24-48h.' },
    { q: 'Puis-je annuler un pari?', a: 'Non, les paris sont définitifs une fois confirmés. Assurez-vous de vérifier avant de confirmer.' },
    { q: 'Mon compte est bloqué, que faire?', a: 'Contactez notre support à contact@ayitimarket.com en indiquant votre nom d\'utilisateur.' },
  ] : [
    { q: 'Kijan pou mete lajan?', a: 'Klike sou balans ou anwo adwat, chwazi "Depoze". Ou ka depoze via MonCash oswa kat.' },
    { q: 'Kijan yon mache travay?', a: 'Chak mache poze yon kesyon binè (Wi/Non). Ou pari sou yon rezilta epi ou genyen si ou gen rezon lè mache a rezoud.' },
    { q: 'Kijan pou retire kòb mwen?', a: 'Ale nan Pòtfolyo ou, klike sou "Retire". Retri yo trete nan 24-48è.' },
    { q: 'Eske mwen ka anile yon pari?', a: 'Non, pari yo definitif yon fwa konfime. Asire ou tcheke anvan ou konfime.' },
    { q: 'Kont mwen bloke, kisa pou mwen fè?', a: 'Kontakte sipò nou an nan contact@ayitimarket.com ak non itilizatè ou.' },
  ];

  return (
    <PageShell
      title={isFr ? 'Centre d\'aide' : 'Sant Èd'}
      subtitle={isFr ? 'Trouvez des réponses à vos questions' : 'Jwenn repons pou kesyon ou yo'}
      icon={<HelpCircle size={26} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {faqs.map((faq, i) => (
          <details key={i} style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
            <summary style={{
              padding: '14px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              listStyle: 'none', userSelect: 'none'
            }}>
              <span>{faq.q}</span>
              <ChevronRight size={16} color="#8b949e" style={{ flexShrink: 0, transition: 'transform 0.2s' }} />
            </summary>
            <div style={{ padding: '0 18px 14px', fontSize: 13, color: '#8b949e', lineHeight: 1.7 }}>
              {faq.a}
            </div>
          </details>
        ))}
      </div>

      <div style={{ marginTop: 40, padding: '20px 24px', background: 'rgba(56,139,253,0.06)', border: '1px solid rgba(56,139,253,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 4 }}>
            {isFr ? 'Besoin d\'aide supplémentaire?' : 'Bezwen plis èd?'}
          </div>
          <div style={{ fontSize: 13, color: '#8b949e' }}>contact@ayitimarket.com</div>
        </div>
        <a href="mailto:contact@ayitimarket.com" style={{
          background: 'linear-gradient(135deg, #388bfd, #1f6feb)', color: 'white',
          padding: '10px 20px', borderRadius: 8, textDecoration: 'none',
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Mail size={14} />
          {isFr ? 'Contacter' : 'Kontakte'}
        </a>
      </div>
    </PageShell>
  );
}

/* ── default export ── */
export default function StaticPage() {
  const page = useStaticPage();
  const { locale } = useLocale();

  switch (page) {
    case 'about':       return <AboutPage locale={locale} />;
    case 'contact':     return <ContactPage locale={locale} />;
    case 'terms':       return <TermsPage locale={locale} />;
    case 'privacy':     return <PrivacyPage locale={locale} />;
    case 'help':        return <HelpPage locale={locale} />;
    default:            return <AboutPage locale={locale} />;
  }
}
