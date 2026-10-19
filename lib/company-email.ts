import "server-only";
import { callout, esc, list, p, renderEmail } from "@/lib/email";
import type { EmailDraft } from "@/lib/company-email-templates";

// Admin → Email: the typed message → the Thelawalaa email layout. The text is
// escaped first (it's plain text, never HTML); then a blank line starts a
// paragraph, "- " lines make a bulleted list and links become clickable.

const LINK = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
const linkify = (escaped: string) => escaped.replace(LINK, '<a href="$1" style="color:#F97316;word-break:break-all">$1</a>');

type Block = ReturnType<typeof p>;

function bodyBlocks(body: string) {
  const blocks: Block[] = [];
  for (const chunk of body.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean)) {
    const lines = chunk.split("\n");
    // A run of "- " lines is a list; anything else in the chunk is a paragraph around it.
    let para: string[] = [];
    let bullets: string[] = [];
    const flushPara = () => { if (para.length) blocks.push(p(linkify(esc(para.join("\n"))).replace(/\n/g, "<br>"), para.join("\n"))); para = []; };
    const flushList = () => { if (bullets.length) blocks.push(list(bullets.map((b) => ({ html: linkify(esc(b)) })))); bullets = []; };
    for (const line of lines) {
      const m = /^\s*[-•]\s+(.*)$/.exec(line);
      if (m) { flushPara(); bullets.push(m[1]); } else { flushList(); para.push(line); }
    }
    flushPara();
    flushList();
  }
  return blocks;
}

/** One person's copy: their first name in the greeting (when on), everything else as written. */
export function companyEmail(d: EmailDraft & { name: string | null; sender: string }) {
  const heading = d.heading.trim() || d.subject.trim();
  const blocks = bodyBlocks(d.body);
  if (d.note.trim()) blocks.push(callout(linkify(esc(d.note.trim())).replace(/\n/g, "<br>"), d.note.trim()));
  const button = d.buttonLabel.trim() && d.buttonUrl.trim() ? { label: d.buttonLabel.trim(), url: d.buttonUrl.trim() } : undefined;
  const mail = renderEmail({
    preheader: d.body.replace(/\s+/g, " ").trim().slice(0, 120),
    heading,
    name: d.greeting ? d.name : undefined,
    blocks,
    cta: button,
    signoff: d.signoff === "personal" ? { line: "Kind regards,", name: `${d.sender}, Thelawalaa` } : undefined,
    reason: "You're getting this email because you're in touch with Thelawalaa. Just reply to it to reach us.",
  });
  return { subject: d.subject.trim(), ...mail };
}
