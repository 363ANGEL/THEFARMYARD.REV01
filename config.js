// Public by design: the anon key only does what row-level security allows.
// Use the legacy "anon public" key (starts eyJ), not an sb_publishable_ key.
window.FY_CONFIG = {
  SUPABASE_URL: "https://REPLACE.supabase.co",
  SUPABASE_ANON_KEY: "REPLACE",
  LEAGUE_SLUG: "farmyard",
  SITE_URL: "https://the-farmyard.com"
};
