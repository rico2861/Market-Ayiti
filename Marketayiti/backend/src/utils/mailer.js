const nodemailer = require('nodemailer');
const logger = require('./logger');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 5000,
  socketTimeout:    10000,
  greetingTimeout:   5000,
});

async function sendMail({ to, subject, html, text }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('SMTP not configured — skipping email to ' + to);
    return { emailSent: false };
  }
  try {
    const info = await transporter.sendMail({
      from:    process.env.SMTP_FROM || `AyitiMarket <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text: text || subject, // plain-text fallback reduces spam score
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return { emailSent: true, messageId: info.messageId };
  } catch (err) {
    logger.error(`Email failed to ${to}: ${err.message}`);
    throw err;
  }
}

// ─── Shared layout ────────────────────────────────────────────────────────────

const BRAND_PRIMARY = '#C8A84B';   // gold — works on both dark and white bg
const BRAND_TEXT    = '#1A1A2E';   // near-black for body text on white
const BORDER_COLOR  = '#E5E7EB';
const MUTED_COLOR   = '#6B7280';
const APP_URL       = () => process.env.APP_URL || 'https://ayitimarket.com';
const SUPPORT_EMAIL = () => process.env.SMTP_USER || 'support@ayitimarket.com';

/**
 * White-background layout — better deliverability than dark themes.
 * Uses inline styles only (no <style> block) for maximum client compatibility.
 */
function baseLayout({ title, preheader, content }) {
  return `<!DOCTYPE html>
<html lang="ht" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Preheader (hidden preview text in inbox) -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#1A1A2E;border-radius:8px;padding:14px 28px;">
                    <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#FFFFFF;font-family:Arial,sans-serif;">
                      Ayiti<span style="color:${BRAND_PRIMARY};">Market</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background-color:#FFFFFF;border:1px solid ${BORDER_COLOR};border-radius:10px;overflow:hidden;">

              <!-- Top accent bar -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:${BRAND_PRIMARY};height:4px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Content area -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:36px 40px;">
                    ${content}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 8px;" align="center">
              <p style="margin:0 0 6px;font-size:12px;color:${MUTED_COLOR};font-family:Arial,sans-serif;line-height:1.6;">
                AyitiMarket &mdash; Platfom pari prediksyon ann Ayiti
              </p>
              <p style="margin:0 0 6px;font-size:12px;color:${MUTED_COLOR};font-family:Arial,sans-serif;">
                <a href="${APP_URL()}" style="color:${BRAND_PRIMARY};text-decoration:none;">${APP_URL()}</a>
                &nbsp;&bull;&nbsp;
                <a href="mailto:${SUPPORT_EMAIL()}" style="color:${MUTED_COLOR};text-decoration:none;">${SUPPORT_EMAIL()}</a>
              </p>
              <p style="margin:0;font-size:11px;color:#9CA3AF;font-family:Arial,sans-serif;">
                Ou resevwa imel sa a paske yon aksyon te fèt sou kont ou a.<br/>
                Si ou panse se yon erè, kontakte sipò nou an.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Reusable components ──────────────────────────────────────────────────────

function codeBlock(code, borderColor = BRAND_PRIMARY) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#F9FAFB;border:2px solid ${borderColor};border-radius:8px;">
            <tr>
              <td style="padding:20px 48px;">
                <span style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;letter-spacing:14px;color:${borderColor};">
                  ${code}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function divider() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
    <tr><td style="border-top:1px solid ${BORDER_COLOR};font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>`;
}

function ctaButton(label, href) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0;display:block;text-align:center;">
      <tr>
        <td align="center">
          <a href="${href}" target="_blank"
             style="display:inline-block;background-color:${BRAND_PRIMARY};color:#1A1A2E;text-decoration:none;
                    font-family:Arial,sans-serif;font-size:14px;font-weight:700;
                    padding:14px 36px;border-radius:6px;letter-spacing:0.3px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

function infoBox(rows) {
  const rowsHtml = rows.map(([label, value]) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};font-size:13px;color:${MUTED_COLOR};font-family:Arial,sans-serif;width:40%;vertical-align:top;">
        ${label}
      </td>
      <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};font-size:13px;color:${BRAND_TEXT};font-family:Arial,sans-serif;font-weight:600;vertical-align:top;">
        ${value}
      </td>
    </tr>`).join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid ${BORDER_COLOR};border-radius:6px;border-collapse:separate;margin:20px 0;">
      <tr>
        <td style="padding:0 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${rowsHtml}
          </table>
        </td>
      </tr>
    </table>`;
}

function stepList(steps) {
  return steps.map((step, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
      <tr>
        <td style="width:28px;vertical-align:top;">
          <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background-color:${BRAND_PRIMARY};
                       text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#1A1A2E;font-family:Arial,sans-serif;">
            ${i + 1}
          </span>
        </td>
        <td style="vertical-align:top;padding-left:10px;font-size:13px;color:${BRAND_TEXT};font-family:Arial,sans-serif;line-height:1.6;padding-top:2px;">
          ${step}
        </td>
      </tr>
    </table>`).join('');
}

function alertBox(message, type = 'info') {
  const colors = {
    info:    { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF' },
    warning: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E' },
    danger:  { bg: '#FEF2F2', border: '#EF4444', text: '#991B1B' },
  };
  const c = colors[type] || colors.info;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="background-color:${c.bg};border-left:4px solid ${c.border};border-radius:0 6px 6px 0;padding:12px 16px;">
          <p style="margin:0;font-size:13px;color:${c.text};font-family:Arial,sans-serif;line-height:1.6;">
            ${message}
          </p>
        </td>
      </tr>
    </table>`;
}

// ─── Email templates ──────────────────────────────────────────────────────────

function welcomeEmail({ username, email }) {
  const loginUrl = `${APP_URL()}/connexion`;
  const content = `
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:${BRAND_TEXT};font-family:Arial,sans-serif;">
      Byenveni sou AyitiMarket
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:${MUTED_COLOR};font-family:Arial,sans-serif;line-height:1.6;">
      Bonjou <strong style="color:${BRAND_TEXT};">${username}</strong>,
      kont ou kreye avek siksè. Ou prèt pou kòmanse fè prediksyon sou platfòm nou an.
    </p>

    ${infoBox([
      ['Non itilizatè', username],
      ['Adrès imel', email],
      ['Estati kont', 'Aktif'],
    ])}

    ${ctaButton('Konekte kounye a', loginUrl)}

    ${divider()}

    <p style="margin:20px 0 0;font-size:12px;color:${MUTED_COLOR};font-family:Arial,sans-serif;line-height:1.6;">
      Si ou pa kreye kont sa a, kontakte nou nan
      <a href="mailto:${SUPPORT_EMAIL()}" style="color:${BRAND_PRIMARY};text-decoration:none;">${SUPPORT_EMAIL()}</a>.
    </p>
  `;
  return {
    subject: 'Kont ou aktif — Byenveni sou AyitiMarket',
    text: `Bonjou ${username}, kont ou kreye avek siksè sou AyitiMarket. Konekte: ${loginUrl}`,
    html: baseLayout({
      title: 'Byenveni sou AyitiMarket',
      preheader: `Bonjou ${username}, kont ou kreye avek siksè. Ou prèt pou kòmanse.`,
      content,
    }),
  };
}

function resetCodeEmail({ username, code, expiresMinutes = 15 }) {
  const content = `
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:${BRAND_TEXT};font-family:Arial,sans-serif;">
      Reyinisyalize modpas ou
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:${MUTED_COLOR};font-family:Arial,sans-serif;line-height:1.6;">
      Bonjou <strong style="color:${BRAND_TEXT};">${username}</strong>,<br/>
      nou resevwa yon demann pou reyinisyalize modpas kont ou a.
      Itilize kòd verifikasyon anba a pou kontinye.
    </p>

    <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:${MUTED_COLOR};font-family:Arial,sans-serif;
              text-transform:uppercase;letter-spacing:0.8px;">
      Kòd verifikasyon
    </p>
    ${codeBlock(code, BRAND_PRIMARY)}

    ${infoBox([
      ['Valab pou', `${expiresMinutes} minit`],
      ['Itilizasyon', 'Yon sèl fwa sèlman'],
    ])}

    ${alertBox('Si ou pa mande reyinisyalizasyon sa a, ou ka inyore mesaj sa a. Kont ou an sekirite.', 'info')}

    ${divider()}

    <p style="margin:20px 0 0;font-size:12px;color:${MUTED_COLOR};font-family:Arial,sans-serif;line-height:1.6;">
      Pa janm pataje kòd sa a ak pèsonn.
      AyitiMarket pap janm mande ou kòd ou pa mesaj oswa telefòn.
    </p>
  `;
  return {
    subject: `Kòd verifikasyon ou — AyitiMarket`,
    text: `Bonjou ${username}, kòd reyinisyalizasyon modpas ou: ${code} (valid ${expiresMinutes} minit). Pa pataje li.`,
    html: baseLayout({
      title: 'Reyinisyalizasyon modpas — AyitiMarket',
      preheader: `Kòd verifikasyon ou: ${code}. Valid ${expiresMinutes} minit.`,
      content,
    }),
  };
}

function lockoutEmail({ username, minutes, code }) {
  const content = `
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:${BRAND_TEXT};font-family:Arial,sans-serif;">
      Kont ou bloke temporèman
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:${MUTED_COLOR};font-family:Arial,sans-serif;line-height:1.6;">
      Bonjou <strong style="color:${BRAND_TEXT};">${username}</strong>,<br/>
      kont ou bloke apre plizyè tantativ koneksyon ki echwe.
      Itilize kòd deblokaj anba a ansanm ak yon nouvo modpas pou reouvri kont ou a.
    </p>

    <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:${MUTED_COLOR};font-family:Arial,sans-serif;
              text-transform:uppercase;letter-spacing:0.8px;">
      Kòd deblokaj
    </p>
    ${codeBlock(code, '#DC2626')}

    ${infoBox([
      ['Dire blokkaj', `${minutes} minit maksimòm`],
      ['Valab pou', `${minutes} minit`],
      ['Itilizasyon', 'Yon sèl fwa sèlman'],
    ])}

    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${BRAND_TEXT};font-family:Arial,sans-serif;">
      Etap pou debloke kont ou:
    </p>
    ${stepList([
      'Retounen sou paj koneksyon an.',
      'Antre kòd deblokaj ki montre anwo a.',
      'Chwazi yon nouvo modpas solid.',
      'Kont ou pral debloke imedyatman.',
    ])}

    ${alertBox(
      'Si se pa ou ki te eseye konekte, inyore mesaj sa a epi kontakte sipò nou imedyatman.',
      'warning'
    )}

    ${divider()}

    <p style="margin:20px 0 0;font-size:12px;color:${MUTED_COLOR};font-family:Arial,sans-serif;line-height:1.6;">
      Pa janm pataje kòd sa a ak pèsonn.
      AyitiMarket pap janm mande kòd ou pa telefòn oswa pa rezo sosyal.
      Kontakte nou: <a href="mailto:${SUPPORT_EMAIL()}" style="color:${BRAND_PRIMARY};text-decoration:none;">${SUPPORT_EMAIL()}</a>
    </p>
  `;
  return {
    subject: `Kont AyitiMarket ou bloke — Aksyon requis`,
    text: `Bonjou ${username}, kont ou bloke. Kòd deblokaj: ${code} (valid ${minutes} minit). Retounen sou sit la pou debloke li.`,
    html: baseLayout({
      title: 'Kont bloke — AyitiMarket',
      preheader: `Kont ou bloke. Kòd deblokaj ou: ${code}. Valid ${minutes} minit.`,
      content,
    }),
  };
}

module.exports = { sendMail, resetCodeEmail, welcomeEmail, lockoutEmail };
