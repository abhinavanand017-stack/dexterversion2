
-- 1. Table
CREATE TABLE public.live_quotes (
  symbol text PRIMARY KEY,
  ltp numeric,
  day_change numeric,
  day_change_pct numeric,
  volume numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Grants (anon may read; only service_role writes)
GRANT SELECT ON public.live_quotes TO anon, authenticated;
GRANT ALL ON public.live_quotes TO service_role;

-- 3. RLS
ALTER TABLE public.live_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read live quotes"
  ON public.live_quotes FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_quotes;
ALTER TABLE public.live_quotes REPLICA IDENTITY FULL;

-- 5. Vault-stored sync secret (matches SYNC_QUOTES_SECRET env var)
SELECT vault.create_secret(
  '9244dc2703344ad7ba9e66c46c48d5e686b14d744db210b0ff080eae6e020f97',
  'sync_quotes_secret',
  'Shared secret for /api/public/sync-quotes cron caller'
);

-- 6. Extensions for cron scheduling and http calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 7. Schedule quote sync every 2 minutes
SELECT cron.schedule(
  'sync-live-quotes-every-2-min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--9d6846b2-3071-4e9b-b676-475b6012e5b5.lovable.app/api/public/sync-quotes',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-sync-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sync_quotes_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  );
  $$
);
