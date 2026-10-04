import "server-only";
import { renderEmail, p, callout, list, receipt, EMAIL_SITE, firstName, esc } from "@/lib/email";
import { describeRewards, fmtPoints, type RewardSettings } from "@/lib/rewards";

// The customer account emails, all in the branded layout (lib/email.ts).

export function verifyEmail(name: string, url: string, welcomePoints: number) {
  return {
    subject: "Confirm your email — welcome to Thelawalaa",
    ...renderEmail({
      preheader: "One tap to confirm your email and activate your Thelawalaa account.",
      heading: "Confirm your email",
      name,
      blocks: [
        p("Thanks for joining Thelawalaa! Please confirm this is your email address so we can keep your account safe and send you order updates."),
        ...(welcomePoints > 0 ? [callout(`<b>${fmtPoints(welcomePoints)} welcome points</b> are waiting in your account.`, `${fmtPoints(welcomePoints)} welcome points are waiting in your account.`)] : []),
      ],
      cta: { label: "Confirm my email", url },
      reason: "You're getting this because someone signed up at thelawalaa.com with this address. If it wasn't you, just ignore this email — no account will be activated.",
    }),
  };
}

export function welcomeEmail(name: string, rewards: RewardSettings, freeItemName: string | null, points: number) {
  const r = describeRewards(rewards, freeItemName);
  return {
    subject: `Welcome to Thelawalaa, ${firstName(name)}!`,
    ...renderEmail({
      preheader: "Your account is ready — here's how your rewards work.",
      heading: "You're in! Welcome to Thelawalaa",
      name,
      blocks: [
        p("Your email is confirmed and your account is ready. Chatpate in four signature styles, juicy momo and ice-cold drinks — made fresh in our clean Godam Chowk kitchen."),
        ...(points > 0 ? [callout(`You already have <b>${fmtPoints(points)} points</b> to start you off.`, `You already have ${fmtPoints(points)} points.`)] : []),
        ...(rewards.enabled ? [
          p("<b style=\"color:#78350F\">How your rewards work</b>", "How your rewards work"),
          list([
            { html: r.earn },
            { html: r.value },
            ...(r.free ? [{ html: r.free }] : []),
          ]),
        ] : []),
        p("Order online for pickup, track it live, and your points add up automatically."),
      ],
      cta: { label: "Order now", url: `${EMAIL_SITE}/order` },
      secondary: { label: "See your rewards", url: `${EMAIL_SITE}/account/rewards` },
      reason: "You're getting this because you created a Thelawalaa account.",
    }),
  };
}

export function resetEmail(name: string, url: string) {
  return {
    subject: "Reset your Thelawalaa password",
    ...renderEmail({
      preheader: "Tap the button to choose a new password.",
      heading: "Reset your password",
      name,
      blocks: [
        p("We got a request to reset the password for your Thelawalaa account. Tap the button below to choose a new one."),
        p("For your security the link expires soon. If you didn't ask for this, you can safely ignore this email — your password won't change."),
      ],
      cta: { label: "Choose a new password", url },
      reason: "You're getting this because a password reset was requested for this address at thelawalaa.com.",
    }),
  };
}

export function alreadyRegisteredEmail(name: string) {
  return {
    subject: "You already have a Thelawalaa account",
    ...renderEmail({
      preheader: "Someone tried to sign up with this email — it already has an account.",
      heading: "You already have an account",
      name,
      blocks: [
        p("Someone (hopefully you!) just tried to create a new Thelawalaa account with this email address — but you already have one."),
        p("Just sign in. Forgot your password? You can reset it from the sign-in page in a few seconds."),
      ],
      cta: { label: "Sign in", url: `${EMAIL_SITE}/auth/login` },
      secondary: { label: "Reset my password", url: `${EMAIL_SITE}/auth/forgot-password` },
      reason: "You're getting this because a sign-up was attempted with this address at thelawalaa.com. If it wasn't you, no action is needed.",
    }),
  };
}

export function testEmail(name: string) {
  return {
    subject: "Thelawalaa email test",
    ...renderEmail({
      preheader: "If you can read this, customer emails are working.",
      heading: "Emails are working",
      name,
      blocks: [p("This is a test from Admin → Settings. Customers will get their verification, welcome, password-reset and order emails in this same style.")],
      cta: { label: "Open the website", url: EMAIL_SITE },
      reason: "You're getting this because an admin sent a test email from the Thelawalaa admin panel.",
    }),
  };
}

export function orderConfirmedEmail(o: {
  name: string; orderId: string; orderNumber: string; dailyNumber: number | null;
  type: string; paymentMethod: string;
  items: { name: string; qty: number; lineTotal: number }[];
  subtotal: number; deliveryFee: number; promoDiscount: number; pointsDiscount: number; pointsUsed: number; total: number;
  pointsToEarn: number; otp: string | null;
}) {
  const rs = (n: number) => `Rs ${n.toLocaleString("en-IN")}`;
  const no = o.dailyNumber != null ? `#${String(o.dailyNumber).padStart(2, "0")}` : o.orderNumber;
  const pay = o.paymentMethod === "esewa"
    ? "You're paying with eSewa — we'll confirm it as soon as eSewa does."
    : o.paymentMethod === "qr"
      ? `Pay <b>${rs(o.total)}</b> by scanning our QR code when you ${o.type === "delivery" ? "receive your order" : "collect it"} — our team will confirm it.`
      : `Please keep <b>${rs(o.total)}</b> in cash ready when you ${o.type === "delivery" ? "receive your order" : "collect it"}.`;
  return {
    subject: `Order ${no} confirmed — Thelawalaa`,
    ...renderEmail({
      preheader: `We've got your order ${no} (${rs(o.total)}). Track it live from your phone.`,
      heading: `Thanks — we've got your order ${no}`,
      name: o.name,
      blocks: [
        p(o.type === "delivery"
          ? "Your order is in. We'll cook it fresh and bring it to your door — you can follow every step live."
          : "Your order is in. We'll cook it fresh at Godam Chowk — you can follow every step live and we'll tell you when it's ready to collect."),
        receipt(
          o.items.map((i) => ({ name: i.name, qty: i.qty, amount: i.lineTotal ? rs(i.lineTotal) : "FREE" })),
          [
            { label: "Subtotal", amount: rs(o.subtotal) },
            ...(o.deliveryFee ? [{ label: "Delivery", amount: rs(o.deliveryFee) }] : []),
            ...(o.promoDiscount ? [{ label: "Promo", amount: `− ${rs(o.promoDiscount)}` }] : []),
            ...(o.pointsDiscount ? [{ label: `${fmtPoints(o.pointsUsed)} points`, amount: `− ${rs(o.pointsDiscount)}` }] : []),
            { label: "Total", amount: rs(o.total) },
          ],
        ),
        p(pay, pay.replace(/<[^>]+>/g, "")),
        ...(o.otp ? [callout(
          `Your delivery code<br><span style="font-size:30px;letter-spacing:8px;font-weight:bold;color:#78350F">${o.otp}</span><br><span style="font-size:13px;color:#78716C">Tell it to the driver when your food arrives — never before.</span>`,
          `Your delivery code: ${o.otp} — tell it to the driver when your food arrives.`,
        )] : []),
        ...(o.pointsToEarn > 0 ? [p(`You'll earn <b>${fmtPoints(o.pointsToEarn)} points</b> once this order is paid.`, `You'll earn ${fmtPoints(o.pointsToEarn)} points once this order is paid.`)] : []),
      ],
      cta: { label: "Track my order", url: `${EMAIL_SITE}/track/${o.orderId}` },
      secondary: { label: "See all my orders", url: `${EMAIL_SITE}/account/orders` },
      reason: `You're getting this because you placed order ${o.orderNumber} with your Thelawalaa account.`,
    }),
  };
}

export function staffInviteEmail(name: string, roleLabel: string, url: string, fresh = false) {
  return {
    subject: fresh ? "Your Thelawalaa team invite" : "You're invited to the Thelawalaa team",
    ...renderEmail({
      preheader: `Join Thelawalaa as ${roleLabel} — accept your invite and choose a password.`,
      heading: fresh ? "Here's a fresh invite link" : "Welcome to the team",
      name,
      blocks: [
        p(`You've been invited to join Thelawalaa as <b>${roleLabel}</b>.`, `You've been invited to join Thelawalaa as ${roleLabel}.`),
        p("Open this on the phone or tablet you'll actually work on, tap the button and choose your password."),
      ],
      cta: { label: "Accept invite", url },
      reason: "You're getting this because a Thelawalaa manager invited this address to the team. If you weren't expecting it, just ignore this email.",
    }),
  };
}

// ── Supabase's own emails (the backup when ours can't be sent) ──────────
// Same design, in Supabase's template language. Pasted into Supabase →
// Authentication → Email Templates (Admin → Settings → Email setup has
// copy buttons). Links go through /auth/confirm like ours, so a link never
// signs anyone in and inbox scanners can't use it up.
const NAME_SLOT = "XNAMEX";
const goName = "{{ if .Data.full_name }}{{ .Data.full_name }}{{ else }}there{{ end }}";
const confirmLink = (type: "email" | "recovery") => `${EMAIL_SITE}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}`;

export function supabaseTemplates(welcomePoints: number) {
  const fill = (html: string) => html.split(NAME_SLOT).join(goName);
  const confirm = verifyEmail(NAME_SLOT, confirmLink("email"), welcomePoints);
  const reset = resetEmail(NAME_SLOT, confirmLink("recovery"));
  return [
    { key: "confirmation", label: "Confirm signup", subject: confirm.subject, html: fill(confirm.html) },
    { key: "recovery", label: "Reset password", subject: reset.subject, html: fill(reset.html) },
  ];
}

/** An offer / news message from Admin → Notifications — only to customers who joined offers. */
export function offerNoticeEmail(o: { name: string; title: string; body: string; url: string | null; unsubscribeUrl: string }) {
  const paragraphs = o.body.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);
  return {
    subject: o.title,
    ...renderEmail({
      preheader: o.body.slice(0, 120),
      heading: o.title,
      name: o.name,
      blocks: [
        ...paragraphs.map((t) => p(esc(t).replace(/\n/g, "<br>"), t)),
        p(`<span style="font-size:13px;color:#78716C">Offers can change or end at any time without notice — see our <a href="${EMAIL_SITE}/terms#offers" style="color:#F97316">terms</a>. Don't want these emails? <a href="${o.unsubscribeUrl}" style="color:#F97316">Unsubscribe</a>.</span>`,
          `Offers can change or end at any time without notice (${EMAIL_SITE}/terms#offers). Unsubscribe: ${o.unsubscribeUrl}`),
      ],
      cta: o.url ? { label: "See the offer", url: o.url } : { label: "Order now", url: `${EMAIL_SITE}/order` },
      reason: "You're getting this because you joined Thelawalaa offers and competitions. You can leave any time from your profile.",
    }),
  };
}
