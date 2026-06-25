/**
 * Shared branded email layout for שמים וארץ automated emails.
 */

export const getFrontendUrl = (path = "") => {
  const base = (
    process.env.FRONTEND_URL || "https://shamaimveeretz.com"
  )
    .replace(/\/$/, "")
    .replace("shmamaimveeretz.com", "shamaimveeretz.com");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

export const EMAIL_LOGO_URL =
  process.env.EMAIL_LOGO_URL ||
  "https://res.cloudinary.com/dhayarvh3/image/upload/v1782423291/logo.png";

export const getLogoUrl = () => EMAIL_LOGO_URL;

const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Noto+Serif+Hebrew:wght@400;600;700&family=Manrope:wght@400;500;600;700&display=swap";

export const emailDivider = () => `
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0;">
    <tr>
      <td style="border-top:1px solid #d0c5af;"></td>
      <td style="padding:0 14px;font-size:11px;color:#d4af37;white-space:nowrap;">&#9670;</td>
      <td style="border-top:1px solid #d0c5af;"></td>
    </tr>
  </table>`;

export const emailButton = (href, label) => `
  <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin:32px auto 8px;">
    <tr>
      <td align="center" style="background-color:#735c00;border-radius:2px;">
        <a href="${href}" target="_blank" style="display:inline-block;padding:14px 36px;font-family:'Manrope',Arial,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.5px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;

export const emailInfoBox = (content, variant = "default") => {
  const styles = {
    default: "background-color:#fbf3e5;border:1px solid #d0c5af;",
    accent: "background-color:#efe7da;border:1px solid #d4af37;",
    notice: "background-color:#fff8ee;border-right:4px solid #d4af37;",
  };
  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="${styles[variant] || styles.default};margin:24px 0;">
      <tr>
        <td style="padding:24px 28px;">${content}</td>
      </tr>
    </table>`;
};

export const emailSectionTitle = (title) => `
  <p style="font-family:'Manrope',Arial,sans-serif;font-size:10px;font-weight:600;color:#934b19;letter-spacing:3px;text-transform:uppercase;margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid #d4af37;">
    ${title}
  </p>`;

const buildHeader = () => {
  const logoUrl = getLogoUrl();
  const shopUrl = getFrontendUrl();

  return `
    <tr>
      <td align="center" style="padding:36px 32px 28px;background-color:#0f1a2e;border-bottom:1px solid #1e3a5f;">
        <a href="${shopUrl}" target="_blank" style="text-decoration:none;">
          <img src="${logoUrl}" alt="שמים וארץ" width="220" style="display:block;margin:0 auto;max-width:220px;width:100%;height:auto;border:0;" />
        </a>
        <p style="font-family:'Manrope',Arial,sans-serif;font-size:10px;color:#d4af37;letter-spacing:3px;text-transform:uppercase;margin:16px 0 0;opacity:0.9;">תכשיטי יהדות בעבודת יד</p>
      </td>
    </tr>`;
};

const buildFooter = (extra = "") => `
  <tr>
    <td style="background-color:#d4af37;padding:36px 32px;text-align:center;">
      <p style="font-family:'Noto Serif Hebrew',Georgia,serif;font-size:18px;font-weight:700;color:#241a00;margin:0 0 6px;">שמים וארץ</p>
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:10px;color:#554300;letter-spacing:2px;text-transform:uppercase;margin:0 0 18px;opacity:0.9;">Handcrafted Jewish Jewelry</p>
      <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin-bottom:16px;">
        <tr><td style="width:56px;border-top:1px solid rgba(255,255,255,0.35);"></td></tr>
      </table>
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:12px;color:#554300;margin:0 0 6px;opacity:0.9;">
        <a href="${getFrontendUrl()}" style="color:#554300;text-decoration:none;">${getFrontendUrl()}</a>
      </p>
      ${process.env.EMAIL_USER ? `<p style="font-family:'Manrope',Arial,sans-serif;font-size:12px;color:#554300;margin:0 0 6px;opacity:0.9;">${process.env.EMAIL_USER}</p>` : ""}
      ${process.env.BUSINESS_PHONE ? `<p style="font-family:'Manrope',Arial,sans-serif;font-size:12px;color:#554300;margin:0 0 6px;opacity:0.9;">${process.env.BUSINESS_PHONE}</p>` : ""}
      ${extra}
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:11px;color:#554300;margin:20px 0 0;opacity:0.7;">© כל הזכויות שמורות לשמים וארץ</p>
    </td>
  </tr>`;

/**
 * Full branded customer email layout.
 */
export const buildEmailLayout = ({ body, footerExtra = "" }) => `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <link href="${FONT_LINK}" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background-color:#fff8f0;font-family:'Manrope',Arial,sans-serif;color:#1f1b13;-webkit-font-smoothing:antialiased;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fff8f0;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background-color:#ffffff;border:1px solid #d0c5af;">
          ${buildHeader()}
          <tr>
            <td style="padding:40px 48px;">${body}</td>
          </tr>
          ${buildFooter(footerExtra)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/**
 * Simpler layout for internal/admin notifications.
 */
export const buildAdminEmailLayout = ({ title, body }) => `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <link href="${FONT_LINK}" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background-color:#f5f3ef;font-family:'Manrope',Arial,sans-serif;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #d0c5af;">
          <tr>
            <td align="center" style="padding:24px 32px 20px;background-color:#0f1a2e;">
              <img src="${getLogoUrl()}" alt="שמים וארץ" width="160" style="display:block;margin:0 auto;max-width:160px;width:100%;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 16px;background:#735c00;">
              <p style="font-family:'Manrope',Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.75);letter-spacing:2px;text-transform:uppercase;margin:0 0 6px;">מערכת ניהול</p>
              <h1 style="font-family:'Noto Serif Hebrew',Georgia,serif;font-size:20px;font-weight:600;color:#ffffff;margin:0;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px;">${body}</td>
          </tr>
          <tr>
            <td style="padding:16px 36px 24px;border-top:1px solid #e8e2d6;">
              <p style="font-family:'Manrope',Arial,sans-serif;font-size:11px;color:#7f7663;margin:0;text-align:center;">
                הודעה אוטומטית ממערכת שמים וארץ · ${new Date().toLocaleString("he-IL")}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export const emailGreeting = (name) => `
  <h2 style="font-family:'Noto Serif Hebrew',Georgia,serif;font-size:22px;font-weight:600;color:#1f1b13;margin:0 0 16px;">שלום ${name},</h2>`;

export const emailParagraph = (text) => `
  <p style="font-family:'Manrope',Arial,sans-serif;font-size:15px;color:#4d4635;line-height:1.8;margin:0 0 20px;">${text}</p>`;
