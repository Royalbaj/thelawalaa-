import "server-only";
import { Resend } from "resend";

// Every email the site sends (account emails, order confirmations, staff
// invites) goes through here: from "Thelawalaa", in one branded layout.
// Needs RESEND_API_KEY and thelawalaa.com verified in Resend; Admin →
// Settings → "Send a test email" shows exactly what Resend says if not.

/** Where links and images in emails point — always the real domain. */
export const EMAIL_SITE = "https://www.thelawalaa.com";
const FROM_ACCOUNT = "Thelawalaa <hello@thelawalaa.com>";
export const FROM_ORDERS = "Thelawalaa <orders@thelawalaa.com>";
const REPLY_TO = "hello@thelawalaa.com";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
/** For Admin → Settings → Email setup (domain status). Server-only, like the key. */
export const resendClient = () => resend;
/** The domain our emails are sent from — must be verified in Resend. */
export const EMAIL_DOMAIN = "thelawalaa.com";

export type SendResult = { ok: true } | { ok: false; error: string };

// Whether the last send worked. Used so the sign-up / reset answers look the
// same whether or not an account exists, even while email is failing.
let lastSendOk = true;
export const emailRecentlyWorking = () => lastSendOk;

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string; from?: string }): Promise<SendResult> {
  const fail = (error: string): SendResult => {
    lastSendOk = false;
    // Shows up in Vercel's logs — the usual cause is thelawalaa.com not verified in Resend.
    console.error(`[email] Not sent "${msg.subject}": ${error}`);
    return { ok: false, error };
  };
  if (!resend) return fail("No RESEND_API_KEY is set");
  try {
    const { error } = await resend.emails.send({
      from: msg.from ?? FROM_ACCOUNT, replyTo: REPLY_TO, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text,
    });
    if (error) return fail(error.message);
    lastSendOk = true;
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't reach Resend");
  }
}

// ── Layout ────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export const firstName = (full?: string | null) => (full ?? "").trim().split(/\s+/)[0] || "there";

const C = { cream: "#FFFBEB", brown: "#78350F", orange: "#F97316", ink: "#44403C", muted: "#78716C", line: "#F5E6D3" };
const FONT = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

type Block = { html: string; text: string };
export const p = (html: string, text?: string): Block => ({
  html: `<p style="margin:0 0 16px;font:16px/1.6 ${FONT};color:${C.ink}">${html}</p>`,
  text: text ?? html.replace(/<[^>]+>/g, ""),
});
/** A highlighted box, e.g. a reward or an OTP. */
export const callout = (html: string, text: string): Block => ({
  html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr><td style="background:${C.cream};border:1px solid ${C.line};border-radius:14px;padding:16px 18px;font:15px/1.6 ${FONT};color:${C.ink}">${html}</td></tr></table>`,
  text,
});
/** Rows of "icon + line", for how-it-works lists. */
export const list = (items: { icon: string; html: string }[]): Block => ({
  html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px">${items.map((i) =>
    `<tr><td width="36" valign="top" style="padding:6px 0;font:20px/1 ${FONT}">${i.icon}</td><td style="padding:6px 0;font:15px/1.55 ${FONT};color:${C.ink}">${i.html}</td></tr>`).join("")}</table>`,
  text: items.map((i) => `- ${i.html.replace(/<[^>]+>/g, "")}`).join("\n"),
});

/** An order summary: item lines, then the money lines, the last one bold. */
export const receipt = (items: { name: string; qty: number; amount: string }[], totals: { label: string; amount: string }[]): Block => {
  const row = (l: string, r: string, style = "") =>
    `<tr><td style="padding:5px 0;font:15px/1.4 ${FONT};color:${C.ink};${style}">${l}</td><td align="right" style="padding:5px 0;font:15px/1.4 ${FONT};color:${C.ink};white-space:nowrap;${style}">${r}</td></tr>`;
  const last = totals.length - 1;
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">
      <tr><td colspan="2" style="height:8px"></td></tr>
      ${items.map((i) => row(`${i.qty} × ${esc(i.name)}`, esc(i.amount))).join("")}
      <tr><td colspan="2" style="padding-top:8px;border-bottom:1px dashed ${C.line}"></td></tr><tr><td colspan="2" style="height:6px"></td></tr>
      ${totals.map((t, n) => row(esc(t.label), esc(t.amount), n === last ? `font-weight:bold;font-size:17px;color:${C.brown}` : `color:${C.muted}`)).join("")}
      <tr><td colspan="2" style="height:8px"></td></tr></table>`,
    text: [...items.map((i) => `${i.qty} x ${i.name}  ${i.amount}`), "", ...totals.map((t) => `${t.label}: ${t.amount}`)].join("\n"),
  };
};

export function renderEmail(o: {
  preheader: string; heading: string; name?: string | null; blocks: Block[];
  cta?: { label: string; url: string }; secondary?: { label: string; url: string }; reason: string;
}) {
  const year = new Date().getFullYear();
  const button = o.cta ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:999px;background:${C.orange}">
      <a href="${o.cta.url}" style="display:inline-block;padding:15px 34px;font:bold 16px ${FONT};color:#ffffff;text-decoration:none;border-radius:999px">${esc(o.cta.label)}</a>
    </td></tr></table>
    <p style="margin:0 0 18px;font:13px/1.5 ${FONT};color:${C.muted}">Button not working? Copy this link into your browser:<br><a href="${o.cta.url}" style="color:${C.orange};word-break:break-all">${esc(o.cta.url)}</a></p>` : "";
  const secondary = o.secondary ? `<p style="margin:0 0 8px;font:15px ${FONT}"><a href="${o.secondary.url}" style="color:${C.orange};font-weight:bold;text-decoration:none">${esc(o.secondary.label)} →</a></p>` : "";
  const greeting = o.name !== undefined ? `<p style="margin:0 0 16px;font:16px/1.6 ${FONT};color:${C.ink}">Hi ${esc(firstName(o.name))},</p>` : "";

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.heading)}</title></head>
<body style="margin:0;padding:0;background:${C.cream}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream}"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td align="center" style="padding:4px 0 22px">
      <a href="${EMAIL_SITE}" style="text-decoration:none"><img src="${EMAIL_SITE}/images/email/logo.png" width="220" height="60" alt="Thelawalaa — Where taste meets hygiene" style="display:block;border:0;width:220px;height:auto"></a>
    </td></tr>
    <tr><td style="background:#ffffff;border-radius:20px;border:1px solid ${C.line};padding:34px 30px 26px">
      <h1 style="margin:0 0 18px;font:bold 24px/1.3 ${FONT};color:${C.brown}">${esc(o.heading)}</h1>
      ${greeting}${o.blocks.map((b) => b.html).join("")}${button}${secondary}
      <p style="margin:18px 0 0;font:15px/1.6 ${FONT};color:${C.ink}">With love from the kitchen,<br><b style="color:${C.brown}">Team Thelawalaa</b></p>
    </td></tr>
    <tr><td align="center" style="padding:26px 16px 8px">
      <img src="${EMAIL_SITE}/images/email/mark.png" width="40" height="43" alt="Thelawalaa" style="display:block;border:0;width:40px;height:auto;margin:0 auto 10px">
      <p style="margin:0;font:bold 15px ${FONT};color:${C.brown}">Thelawalaa</p>
      <p style="margin:2px 0 10px;font:11px ${FONT};letter-spacing:2px;color:${C.orange}">WHERE TASTE MEETS HYGIENE</p>
      <p style="margin:0 0 10px;font:13px/1.6 ${FONT};color:${C.muted}">Godam Chowk, Banepa, Kavrepalanchok, Nepal</p>
      <p style="margin:0 0 14px;font:13px ${FONT}">
        <a href="${EMAIL_SITE}" style="color:${C.orange};text-decoration:none;font-weight:bold">Website</a> &nbsp;·&nbsp;
        <a href="${EMAIL_SITE}/order" style="color:${C.orange};text-decoration:none;font-weight:bold">Order</a> &nbsp;·&nbsp;
        <a href="${EMAIL_SITE}/account/rewards" style="color:${C.orange};text-decoration:none;font-weight:bold">Rewards</a> &nbsp;·&nbsp;
        <a href="${EMAIL_SITE}/whatsapp" style="color:${C.orange};text-decoration:none;font-weight:bold">WhatsApp us</a>
      </p>
      <p style="margin:0;font:12px/1.6 ${FONT};color:#A8A29E">${esc(o.reason)}<br>© ${year} Thelawalaa. All rights reserved.</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = [
    o.heading, "",
    o.name !== undefined ? `Hi ${firstName(o.name)},\n` : "",
    ...o.blocks.map((b) => b.text + "\n"),
    o.cta ? `${o.cta.label}: ${o.cta.url}\n` : "",
    o.secondary ? `${o.secondary.label}: ${o.secondary.url}\n` : "",
    "With love from the kitchen,", "Team Thelawalaa", "",
    "—", "Thelawalaa · Where taste meets hygiene", "Godam Chowk, Banepa, Kavrepalanchok, Nepal", EMAIL_SITE, "", o.reason,
  ].join("\n");
  return { html, text };
}
