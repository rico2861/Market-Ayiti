import { useTranslation } from 'react-i18next';
import { useParams, useLocation } from 'react-router-dom';
import { Shield, FileText, Mail, Info } from 'lucide-react';

const PAGES: Record<string, {
  icon: React.ReactNode;
  fr: { title: string; content: React.ReactNode };
  ht: { title: string; content: React.ReactNode };
}> = {
  cgu: {
    icon: <FileText size={24} color="#1f6feb"/>,
    fr: {
      title: "Conditions Générales d'Utilisation",
      content: (
        <div style={{ color:'#8b949e', fontSize:14, lineHeight:1.8 }}>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>1. Acceptation des conditions</h2>
          <p>En utilisant AyitiMarket, vous acceptez les présentes conditions d'utilisation dans leur intégralité. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre plateforme.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>2. Description du service</h2>
          <p>AyitiMarket est une plateforme de marchés de prédiction dédiée aux événements haïtiens. Les utilisateurs peuvent parier sur l'issue d'événements futurs en utilisant des HTG (Gourdes haïtiennes).</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>3. Éligibilité</h2>
          <p>Vous devez avoir au moins 18 ans pour utiliser AyitiMarket. En vous inscrivant, vous confirmez avoir atteint l'âge légal requis dans votre pays de résidence.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>4. Compte utilisateur</h2>
          <p>Vous êtes responsable de la confidentialité de vos identifiants de connexion. Toute activité sur votre compte est de votre responsabilité. Signalez immédiatement tout accès non autorisé.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>5. Dépôts et retraits</h2>
          <p>Les transactions sont effectuées via MonCash. Des frais de 1,5% s'appliquent à chaque transaction. Le minimum de retrait est de 250 HTG. AyitiMarket n'est pas responsable des délais de traitement de MonCash.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>6. Paris et résolution</h2>
          <p>Les résultats des marchés sont déterminés par l'équipe AyitiMarket sur la base de sources vérifiables. Les décisions de résolution sont définitives.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>7. Jeu responsable</h2>
          <p>AyitiMarket encourage le jeu responsable. Ne pariez que ce que vous pouvez vous permettre de perdre. Si vous pensez avoir un problème de jeu, contactez-nous.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>8. Modification des conditions</h2>
          <p>AyitiMarket se réserve le droit de modifier ces conditions à tout moment. Les changements entrent en vigueur dès leur publication sur la plateforme.</p>
          <p style={{ marginTop:32, fontSize:12, color:'#484f58' }}>Dernière mise à jour : Janvier 2026</p>
        </div>
      )
    },
    ht: {
      title: "Kondisyon Jeneral Itilizasyon",
      content: (
        <div style={{ color:'#8b949e', fontSize:14, lineHeight:1.8 }}>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>1. Akseptasyon kondisyon yo</h2>
          <p>Lè w itilize AyitiMarket, ou aksepte tout kondisyon itilizasyon ki prezan yo. Si ou pa dakò ak kondisyon sa yo, tanpri pa itilize platfòm nou an.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>2. Deskripsyon sèvis la</h2>
          <p>AyitiMarket se yon platfòm machè prediksyon dedye pou evènman ayisyen yo. Itilizatè yo ka pari sou rezilta evènman ki pral vini yo lè yo itilize HTG (Goud Ayisyen).</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>3. Kondisyon laj</h2>
          <p>Ou dwe gen omwen 18 an pou itilize AyitiMarket. Lè w enskri, ou konfime ou gen laj legal ki obligatwa nan peyi kote w rete a.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>4. Kont itilizatè</h2>
          <p>Ou responsab pou konfidansyalite idantifyan koneksyon ou yo. Tout aktivite sou kont ou se responsabilite ou. Avèti nou imedyatman si gen aksè san otorizasyon.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>5. Depozit ak retrè</h2>
          <p>Transaksyon yo fèt via MonCash. Gen frè 1.5% sou chak transaksyon. Minimòm retrè se 250 HTG. AyitiMarket pa responsab pou délè trete MonCash.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>6. Pari ak rezolisyon</h2>
          <p>Rezilta machè yo detèmine pa ekip AyitiMarket a sou baz sous ki verifye. Desizyon rezolisyon yo definitif.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>7. Pari responsab</h2>
          <p>AyitiMarket ankouraje pari responsab. Pa pari plis pase sa ou kapab pèdi. Si ou panse ou gen yon pwoblèm pari, kontakte nou.</p>
          <p style={{ marginTop:32, fontSize:12, color:'#484f58' }}>Dènye aktualizasyon: Janvye 2026</p>
        </div>
      )
    }
  },
  confidentialite: {
    icon: <Shield size={24} color="#3fb950"/>,
    fr: {
      title: "Politique de Confidentialité",
      content: (
        <div style={{ color:'#8b949e', fontSize:14, lineHeight:1.8 }}>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Données collectées</h2>
          <p>Nous collectons : votre email ou numéro de téléphone à l'inscription, vos historiques de transactions et de paris, votre adresse IP pour la sécurité.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Utilisation des données</h2>
          <p>Vos données servent uniquement à : gérer votre compte, traiter vos transactions via MonCash, améliorer nos services, vous contacter en cas de besoin.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Partage des données</h2>
          <p>Nous ne vendons jamais vos données personnelles. Nous partageons uniquement les informations nécessaires avec MonCash pour le traitement des paiements.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Sécurité</h2>
          <p>Vos mots de passe sont chiffrés (bcrypt). Vos sessions sont sécurisées par JWT. Nous n'avons jamais accès à votre PIN MonCash.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Vos droits</h2>
          <p>Vous pouvez demander la suppression de votre compte et de vos données à tout moment en nous contactant.</p>
        </div>
      )
    },
    ht: {
      title: "Politik Konfidansyalite",
      content: (
        <div style={{ color:'#8b949e', fontSize:14, lineHeight:1.8 }}>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Done nou kolekte</h2>
          <p>Nou kolekte: imel oswa nimewo telefòn ou lè w enskri, istorik transaksyon ak pari ou yo, adrès IP ou pou sekirite.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Itilizasyon done yo</h2>
          <p>Done ou yo sèlman itilize pou: jere kont ou, trete transaksyon ou yo via MonCash, amelyore sèvis nou yo, kontakte ou si nesesè.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Pataje done</h2>
          <p>Nou pa janm vann done pèsonèl ou. Nou sèlman pataje enfòmasyon ki nesesè ak MonCash pou trete peman yo.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Sekirite</h2>
          <p>Modpas ou yo kode (bcrypt). Sesyon ou yo pwoteje pa JWT. Nou pa janm gen aksè nan PIN MonCash ou.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Dwa ou yo</h2>
          <p>Ou ka mande efasman kont ou ak done ou yo nenpòt ki lè lè w kontakte nou.</p>
        </div>
      )
    }
  },
  contact: {
    icon: <Mail size={24} color="#d29922"/>,
    fr: {
      title: "Contactez-nous",
      content: (
        <div style={{ color:'#8b949e', fontSize:14, lineHeight:1.8 }}>
          <div style={{ display:'grid', gap:16, marginTop:16 }}>
            {[
              { label:'Email général', value:'contact@ayitimarket.com', icon:'📧' },
              { label:'Support technique', value:'support@ayitimarket.com', icon:'🛠️' },
              { label:'Partenariats', value:'partners@ayitimarket.com', icon:'🤝' },

            ].map(({ label, value, icon }) => (
              <div key={label} style={{ background:'#161b22', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                <span style={{ fontSize:24 }}>{icon}</span>
                <div>
                  <div style={{ fontSize:12, color:'#484f58', marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:14, color:'white', fontWeight:500 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:24, padding:'16px 20px', background:'rgba(31,111,235,0.08)', border:'1px solid rgba(31,111,235,0.2)', borderRadius:10 }}>
            <p style={{ margin:0, color:'#388bfd', fontSize:13 }}>
              ⏱️ Temps de réponse moyen : <strong>24-48 heures</strong> en jours ouvrables.
            </p>
          </div>
        </div>
      )
    },
    ht: {
      title: "Kontakte Nou",
      content: (
        <div style={{ color:'#8b949e', fontSize:14, lineHeight:1.8 }}>
          <div style={{ display:'grid', gap:16, marginTop:16 }}>
            {[
              { label:'Imel jeneral', value:'contact@ayitimarket.com', icon:'📧' },
              { label:'Sipò teknik', value:'support@ayitimarket.com', icon:'🛠️' },
              { label:'Patenèship', value:'partners@ayitimarket.com', icon:'🤝' },

            ].map(({ label, value, icon }) => (
              <div key={label} style={{ background:'#161b22', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                <span style={{ fontSize:24 }}>{icon}</span>
                <div>
                  <div style={{ fontSize:12, color:'#484f58', marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:14, color:'white', fontWeight:500 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:24, padding:'16px 20px', background:'rgba(31,111,235,0.08)', border:'1px solid rgba(31,111,235,0.2)', borderRadius:10 }}>
            <p style={{ margin:0, color:'#388bfd', fontSize:13 }}>
              ⏱️ Tan repon mwayèn: <strong>24-48 èdtan</strong> nan jou travay yo.
            </p>
          </div>
        </div>
      )
    }
  },
  about: {
    icon: <Info size={24} color="#a371f7"/>,
    fr: {
      title: "À propos d'AyitiMarket",
      content: (
        <div style={{ color:'#8b949e', fontSize:14, lineHeight:1.8 }}>
          <p style={{ fontSize:16, color:'white', lineHeight:1.6 }}>AyitiMarket est la première plateforme de marchés de prédiction dédiée à Haïti et à la diaspora haïtienne.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Notre mission</h2>
          <p>Permettre aux Haïtiens et à la diaspora de s'exprimer sur l'avenir de leur pays à travers des marchés de prédiction transparents et décentralisés.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Comment ça fonctionne</h2>
          <p>Les utilisateurs parient sur l'issue d'événements réels (élections, sports, économie, culture). Les prix des marchés reflètent la sagesse collective et les probabilités estimées par la communauté.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Inspiré de Polymarket</h2>
          <p>AyitiMarket s'inspire du modèle Polymarket, adapté au contexte haïtien avec MonCash comme moyen de paiement principal.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginTop:24 }}>
            {[
              { label:'Marchés actifs', value:'10+', color:'#1f6feb' },
              { label:'Utilisateurs', value:'500+', color:'#3fb950' },
              { label:'Volume HTG', value:'500K+', color:'#d29922' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background:'#161b22', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'14px 16px', textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:700, color, fontFamily:'JetBrains Mono,monospace' }}>{value}</div>
                <div style={{ fontSize:11, color:'#484f58', marginTop:4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    ht: {
      title: "Sou AyitiMarket",
      content: (
        <div style={{ color:'#8b949e', fontSize:14, lineHeight:1.8 }}>
          <p style={{ fontSize:16, color:'white', lineHeight:1.6 }}>AyitiMarket se premye platfòm machè prediksyon ki dedye pou Ayiti ak dyaspora ayisyen an.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Misyon nou</h2>
          <p>Pèmèt Ayisyen ak dyaspora yo eksprime tèt yo sou lavni peyi yo atravè machè prediksyon ki transparan ak desantralize.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Kijan sa travay</h2>
          <p>Itilizatè yo pari sou rezilta evènman reyèl (eleksyon, spò, ekonomi, kilti). Pri machè yo reflete saj kolektif ak probabilite ki estime pa kominote a.</p>
          <h2 style={{ color:'white', fontSize:16, marginTop:24 }}>Enspire pa Polymarket</h2>
          <p>AyitiMarket enspire pa modèl Polymarket, adapte pou kontèks ayisyen an ak MonCash kòm mwayen peman prensipal.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginTop:24 }}>
            {[
              { label:'Machè aktif', value:'10+', color:'#1f6feb' },
              { label:'Itilizatè', value:'500+', color:'#3fb950' },
              { label:'Volim HTG', value:'500K+', color:'#d29922' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background:'#161b22', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'14px 16px', textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:700, color, fontFamily:'JetBrains Mono,monospace' }}>{value}</div>
                <div style={{ fontSize:11, color:'#484f58', marginTop:4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )
    }
  }
};

export default function StaticPage() {
  const { page } = useParams<{ page?: string }>();
  const { i18n } = useTranslation();
  const { pathname } = useLocation();
  // Determine page from URL path if param not found
  const pageKey = page || pathname.split('/').filter(Boolean).pop() || '';
  const locale = i18n.language?.slice(0,2) === 'fr' ? 'fr' : 'ht';

  const pageData = PAGES[pageKey];
  if (!pageData) return (
    <div className="container py-16" style={{ textAlign:'center', paddingTop:80 }}>
      <p style={{ color:'#8b949e' }}>Page introuvable / Paj pa jwenn — <em>{pageKey}</em></p>
    </div>
  );

  const content = pageData[locale as 'fr'|'ht'];
  return (
    <div className="container py-8 fade-in" style={{ maxWidth: 760 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        {pageData.icon}
        <h1 style={{ fontSize:24, fontWeight:700, color:'white', margin:0 }}>{content.title}</h1>
      </div>
      {content.content}
    </div>
  );
}
