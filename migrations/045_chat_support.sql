-- ============================================================
-- Chat Support (AI-powered floating chat widget)
-- Pro feature: site owners add a ChatSupport block to enable
-- a floating AI assistant on their published site.
-- ============================================================

-- Settings per site (agent name, allowed question types, etc.)
create table if not exists chat_support_settings (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  agent_name    text not null default 'Archie',
  welcome_message text not null default 'Hi there! I''m here to help. Ask me anything about our business.',
  contact_email text,                         -- fallback email shown after rate limit
  enabled       boolean not null default true,
  -- Which question categories the agent is allowed to answer
  allow_general     boolean not null default true,   -- general site/page content
  allow_booking     boolean not null default false,  -- booking availability & services
  allow_ecommerce   boolean not null default false,  -- product info, pricing, stock
  allow_faq         boolean not null default true,   -- FAQ answers
  -- Appearance
  accent_color  text,                         -- optional hex override for chat bubble
  position      text not null default 'bottom-right' check (position in ('bottom-right','bottom-left')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(site_id)
);

-- Per-IP message log for rate-limiting public visitors
create table if not exists chat_support_messages (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references sites(id) on delete cascade,
  ip_hash     text not null,                  -- SHA-256 of IP (never store raw IPs)
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  is_ai       boolean not null default false,  -- true if this consumed an AI token call
  created_at  timestamptz not null default now()
);

-- Index for efficient rate-limit lookups (recent messages from same IP on same site)
create index if not exists idx_chat_support_messages_rate
  on chat_support_messages (site_id, ip_hash, created_at desc);

-- RLS policies
alter table chat_support_settings enable row level security;
alter table chat_support_messages enable row level security;

-- Site owners can manage their own settings
create policy "Owners manage chat_support_settings"
  on chat_support_settings for all
  using (site_id in (select id from sites where user_id = auth.uid()))
  with check (site_id in (select id from sites where user_id = auth.uid()));

-- Messages are inserted via service role (API route), so only select for owners
create policy "Owners read chat_support_messages"
  on chat_support_messages for select
  using (site_id in (select id from sites where user_id = auth.uid()));
