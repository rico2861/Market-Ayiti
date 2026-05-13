import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, MessageCircle, Mail, Book, Eye, ChevronDown } from 'lucide-react';

export default function Help() {
    const location = useLocation();
    const lang = location.pathname.split('/')[1] as 'ht' | 'fr' || 'ht';
    const isHT = lang === 'ht';

    const text = {
        ht: {
            title: 'Sant Èd',
            contact: 'Kontak nou',
            email: 'Imel',
            chat: 'Chate',
            docs: 'Dokimantasyon',
            faq: 'Kesyon souvan',
            support24: 'Sipò 24/7',
            fastResponse: 'Repons vit',
            guides: 'Gid detaye',
        },
        fr: {
            title: 'Centre d\'aide',
            contact: 'Nous contacter',
            email: 'Email',
            chat: 'Chat',
            docs: 'Documentation',
            faq: 'Questions fréquentes',
            support24: 'Support 24/7',
            fastResponse: 'Réponse rapide',
            guides: 'Guides détaillés',
        }
    }[lang];

    const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

    const faqs = [
        {
            q: isHT ? 'Kijan fè yon kont ?' : 'Comment créer un compte ?',
            a: isHT ? 'Klike sou "Enskri", mete imel ou epi kreye yon paspò sekirize.' : 'Cliquez sur "S\'inscrire", entrez votre email et créez un mot de passe sécurisé.',
        },
        {
            q: isHT ? 'Ki sa yon machè prediktif ?' : 'Qu\'est-ce qu\'un marché de prédiction ?',
            a: isHT ? 'Yon machè prediktif se yon platfòm kote ou ka pari sou rezilta evènman nan avni.' : 'Un marché de prédiction est une plateforme où vous pouvez parier sur le résultat d\'événements futurs.',
        },
        {
            q: isHT ? 'Kijan depoze lajan ?' : 'Comment déposer de l\'argent ?',
            a: isHT ? 'Al nan pòtfolyo w, klike sou "Depoze", mete montan an epi swiv enstriksyon yo.' : 'Allez dans votre portefeuille, cliquez sur "Déposer", entrez le montant et suivez les instructions.',
        },
        {
            q: isHT ? 'Ki sa frè yo ?' : 'Quels sont les frais ?',
            a: isHT ? 'Frè transaksyon yo se 1.5% pou chak depo oswa retrè.' : 'Les frais de transaction sont de 1.5% pour chaque dépôt ou retrait.',
        },
    ];

    const contactMethods = [
        {
            icon: Mail,
            label: text.email,
            contact: 'support@ayitimarket.ht',
            desc: text.support24,
            color: '#388bfd',
        },
        {
            icon: MessageCircle,
            label: text.chat,
            contact: isHT ? 'Chat dirèk' : 'Chat en direct',
            desc: text.fastResponse,
            color: '#22c55e',
        },
        {
            icon: Book,
            label: text.docs,
            contact: isHT ? 'Li gid nou yo' : 'Lire nos guides',
            desc: text.guides,
            color: '#a855f7',
        },
    ];

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0d1117',
            padding: '20px 16px 120px',
        }}>
            <div style={{ maxWidth: 700, margin: '0 auto' }}>
                {/* Header */}
                <h1 style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: 'white',
                    margin: '0 0 32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                }}>
                    <HelpCircle size={28} color="#06b6d4" />
                    {text.title}
                </h1>

                {/* Contact Methods */}
                <div style={{ marginBottom: 40 }}>
                    <h2 style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '.1em',
                        margin: '0 0 12px',
                        paddingLeft: 4,
                    }}>
                        {text.contact}
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {contactMethods.map((method, i) => (
                            <button
                                key={i}
                                style={{
                                    padding: '16px',
                                    background: 'rgba(255,255,255,.03)',
                                    border: '1px solid rgba(255,255,255,.08)',
                                    borderRadius: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 14,
                                    textDecoration: 'none',
                                    transition: 'all .3s',
                                    cursor: 'pointer',
                                    width: '100%',
                                    textAlign: 'left',
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.06)';
                                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.12)';
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.03)';
                                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.08)';
                                }}
                            >
                                <div
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 10,
                                        background: `${method.color}20`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    <method.icon size={20} color={method.color} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#c9d1d9', margin: 0 }}>
                                        {method.label}
                                    </p>
                                    <p style={{ fontSize: 11, color: '#64748b', margin: '6px 0 0' }}>
                                        {method.contact}
                                    </p>
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 600, color: '#8b949e' }}>
                                    {method.desc}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* FAQs */}
                <div>
                    <h2 style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '.1em',
                        margin: '0 0 12px',
                        paddingLeft: 4,
                    }}>
                        {text.faq}
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {faqs.map((faq, i) => (
                            <div
                                key={i}
                                style={{
                                    background: 'rgba(255,255,255,.03)',
                                    border: '1px solid rgba(255,255,255,.08)',
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                    transition: 'all .3s',
                                }}
                            >
                                <button
                                    onClick={() => setExpandedFAQ(expandedFAQ === i ? null : i)}
                                    style={{
                                        width: '100%',
                                        padding: '14px 16px',
                                        background: 'transparent',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'all .3s',
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLElement).parentElement!.style.background = 'rgba(255,255,255,.05)';
                                        (e.currentTarget as HTMLElement).parentElement!.style.borderColor = 'rgba(255,255,255,.12)';
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLElement).parentElement!.style.background = 'rgba(255,255,255,.03)';
                                        (e.currentTarget as HTMLElement).parentElement!.style.borderColor = 'rgba(255,255,255,.08)';
                                    }}
                                >
                                    <Eye size={16} color="#388bfd" style={{ flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#c9d1d9' }}>
                                        {faq.q}
                                    </span>
                                    <ChevronDown
                                        size={14}
                                        color="#64748b"
                                        style={{
                                            transform: expandedFAQ === i ? 'rotate(180deg)' : 'rotate(0)',
                                            transition: 'transform .3s',
                                            flexShrink: 0,
                                        }}
                                    />
                                </button>

                                {expandedFAQ === i && (
                                    <div
                                        style={{
                                            padding: '0 16px 14px',
                                            borderTop: '1px solid rgba(255,255,255,.08)',
                                            fontSize: 12,
                                            color: '#8b949e',
                                            lineHeight: 1.6,
                                        }}
                                    >
                                        {faq.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}