ALTER TABLE public.etfs
  ADD COLUMN IF NOT EXISTS etf_ticker text,
  ADD COLUMN IF NOT EXISTS forecast_unavailable boolean NOT NULL DEFAULT false;

UPDATE public.etfs SET etf_ticker = COALESCE(etf_ticker, ticker);

UPDATE public.etfs SET etf_ticker = m.yh FROM (VALUES
  ('ICICINIFTY','NIFTYIETF'),
  ('ICICISENSX','SENSEXIETF'),
  ('HDFCNIFETF','HDFCNIFTY'),
  ('KOTAKGOLD','GOLD1'),
  ('KOTAKSILVE','SILVER1'),
  ('KOTAKNIFTY','NIFTY1'),
  ('KOTAKBKETF','BANKNIFTY1'),
  ('GOLDETFADD','BSLGOLDETF')
) AS m(tk, yh) WHERE public.etfs.ticker = m.tk;

UPDATE public.etfs SET forecast_unavailable = true
WHERE ticker IN ('UTINIFTETF','UTISENSETF','GOLDSHARE','UTIBANKETF','SILVERBSL','EBBETF0432');

UPDATE public.etfs SET forecast_unavailable = false
WHERE ticker NOT IN ('UTINIFTETF','UTISENSETF','GOLDSHARE','UTIBANKETF','SILVERBSL','EBBETF0432');