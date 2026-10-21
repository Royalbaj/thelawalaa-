// Admin → Email: starting points for the emails the company writes by hand.
// Plain text — the message box's rules: a blank line starts a new paragraph,
// lines starting "- " become a bulleted list, links become clickable.
// No server-only imports: the composer (browser) uses these.

export type Signoff = "team" | "personal";
export type EmailDraft = {
  subject: string; heading: string; body: string; note: string;
  buttonLabel: string; buttonUrl: string; greeting: boolean; signoff: Signoff;
};

export const BLANK: EmailDraft = { subject: "", heading: "", body: "", note: "", buttonLabel: "", buttonUrl: "", greeting: true, signoff: "team" };

export const STARTERS: { id: string; label: string; draft: EmailDraft }[] = [
  { id: "blank", label: "Blank", draft: BLANK },
  {
    id: "thanks", label: "Thank you",
    draft: {
      ...BLANK, subject: "Thank you from Thelawalaa", heading: "Thank you!",
      body: "Thank you for choosing Thelawalaa — it means a lot to our small kitchen at Godam Chowk.\n\nWe hope to see you again soon. Your next plate of momo is waiting!",
      buttonLabel: "Order again", buttonUrl: "https://www.thelawalaa.com/order",
    },
  },
  {
    id: "sorry", label: "Reply to feedback",
    draft: {
      ...BLANK, subject: "About your visit to Thelawalaa", heading: "Thank you for telling us",
      body: "Thank you for your feedback. We're sorry your order wasn't up to our usual standard.\n\nWe've shared it with the kitchen team so it doesn't happen again.",
      note: "Next time you visit, show this email at the counter and we'll make it right.",
    },
  },
  {
    id: "interview", label: "Interview invitation",
    draft: {
      ...BLANK, subject: "Interview at Thelawalaa", heading: "We'd like to meet you", signoff: "personal",
      body: "Thank you for applying to work with us. We'd like to invite you for a short chat at our kitchen in Godam Chowk, Banepa.\n\n- Date: \n- Time: \n- Please bring: a copy of your citizenship card\n\nPlease reply to this email or call us to confirm the time.",
      buttonLabel: "Get directions", buttonUrl: "https://www.thelawalaa.com/#location",
    },
  },
  {
    id: "supplier", label: "Business enquiry",
    draft: {
      ...BLANK, subject: "Enquiry from Thelawalaa", heading: "Hello from Thelawalaa", signoff: "personal",
      body: "We're Thelawalaa, a street-food kitchen at Godam Chowk, Banepa, serving chatpate and momo.\n\nWe'd like to know more about your products and prices for regular supply. Could you send us your price list and delivery terms?",
      buttonLabel: "Visit our website", buttonUrl: "https://www.thelawalaa.com",
    },
  },
  {
    // Oct 2026: thelawalaa.com couldn't receive mail, so replies to our emails bounced.
    id: "again", label: "Ask to reply again",
    draft: {
      ...BLANK, subject: "Did you reply to us? Please send it again", heading: "We missed your reply",
      body: "Thank you for getting back to us. Our email had a problem over the last few days, so replies sent to us didn't arrive — your email app may have said \"not delivered\".\n\nIt's fixed now. If you replied to our earlier email, please send your reply again — you can simply answer this email.\n\nSorry for the trouble, and thank you for your patience.",
    },
  },
  {
    id: "news", label: "Announcement",
    draft: {
      ...BLANK, subject: "News from Thelawalaa", heading: "Something new at Thelawalaa",
      body: "We've got some news to share.\n\n",
      buttonLabel: "See what's new", buttonUrl: "https://www.thelawalaa.com",
    },
  },
];

export const MAX_RECIPIENTS = 100;
