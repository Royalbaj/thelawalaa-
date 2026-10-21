-- 050: Admin → Email → Inbox. thelawalaa.com had no MX record, so every reply
-- to our emails (admin@, hello@ …) bounced. Resend now receives mail for the
-- domain; each message is copied here (by the webhook, and by a sync whenever
-- the inbox is opened), so replies show up in the admin.

create table if not exists public.inbox_emails (
  id           uuid primary key default gen_random_uuid(),
  resend_id    text not null unique,            -- Resend's id for the received email
  from_email   text not null,
  from_name    text,
  to_emails    text[] not null default '{}',
  cc           text[] not null default '{}',
  reply_to     text,
  subject      text not null default '',
  snippet      text,                            -- first words, for the inbox list
  text_body    text,
  html_body    text,                            -- null when too big to keep: fetched from Resend when opened
  message_id   text,                            -- for "In-Reply-To" when we answer
  attachments  jsonb not null default '[]',     -- [{ id, filename, content_type, size }]
  received_at  timestamptz not null,
  read_at      timestamptz,
  replied_at   timestamptz,
  archived_at  timestamptz,
  forwarded_to text,
  created_at   timestamptz not null default now()
);
create index if not exists inbox_emails_received_idx on public.inbox_emails (received_at desc);
create index if not exists inbox_emails_unread_idx on public.inbox_emails (received_at desc) where read_at is null and archived_at is null;
alter table public.inbox_emails enable row level security;   -- service role only

-- One row: the Resend webhook we created (and its signing secret) and where
-- to forward a copy of every received email, if anywhere.
create table if not exists public.email_inbox_settings (
  id             int primary key default 1 check (id = 1),
  webhook_id     text,
  webhook_secret text,
  forward_to     text check (forward_to is null or length(forward_to) <= 200),
  updated_at     timestamptz not null default now()
);
insert into public.email_inbox_settings (id) values (1) on conflict do nothing;
alter table public.email_inbox_settings enable row level security;   -- service role only
