CREATE TABLE public.stock_universe (
  ticker text PRIMARY KEY,
  exchange text NOT NULL DEFAULT 'NSE',
  isin text,
  company_name text NOT NULL,
  nse_industry text,
  sector text,
  sub_sector text,
  market_cap_cr numeric,
  free_float_pct numeric,
  universe_rank integer,
  index_membership text[] NOT NULL DEFAULT '{}',
  inclusion_date date NOT NULL DEFAULT current_date,
  source_tier smallint NOT NULL DEFAULT 1,
  as_of timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stock_universe TO anon, authenticated;
GRANT ALL ON public.stock_universe TO service_role;
ALTER TABLE public.stock_universe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read stock universe" ON public.stock_universe FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.stock_prices_eod (
  ticker text NOT NULL REFERENCES public.stock_universe(ticker) ON DELETE CASCADE,
  date date NOT NULL,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume bigint,
  delivery_pct numeric,
  w52_high numeric,
  w52_low numeric,
  source_tier smallint NOT NULL DEFAULT 1,
  as_of timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, date)
);
CREATE INDEX stock_prices_eod_date_idx ON public.stock_prices_eod (date DESC);
GRANT SELECT ON public.stock_prices_eod TO anon, authenticated;
GRANT ALL ON public.stock_prices_eod TO service_role;
ALTER TABLE public.stock_prices_eod ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read eod prices" ON public.stock_prices_eod FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.stock_technicals (
  ticker text NOT NULL REFERENCES public.stock_universe(ticker) ON DELETE CASCADE,
  date date NOT NULL,
  rsi14 numeric,
  dma50 numeric,
  dma200 numeric,
  beta numeric,
  volume_vs_20d_avg numeric,
  pct_from_52w_high numeric,
  pct_from_52w_low numeric,
  ret_1m_pct numeric,
  ret_3m_pct numeric,
  ret_1y_pct numeric,
  source_tier smallint NOT NULL DEFAULT 1,
  as_of timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, date)
);
CREATE INDEX stock_technicals_date_idx ON public.stock_technicals (date DESC);
GRANT SELECT ON public.stock_technicals TO anon, authenticated;
GRANT ALL ON public.stock_technicals TO service_role;
ALTER TABLE public.stock_technicals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read technicals" ON public.stock_technicals FOR SELECT TO anon, authenticated USING (true);

CREATE VIEW public.stock_screener_rows
WITH (security_invoker = true) AS
SELECT
  u.ticker, u.exchange, u.isin, u.company_name, u.sector, u.sub_sector,
  u.market_cap_cr, u.free_float_pct, u.universe_rank, u.index_membership,
  u.as_of AS universe_as_of,
  p.date AS price_date, p.open, p.high, p.low, p.close, p.volume,
  p.delivery_pct, p.w52_high, p.w52_low, p.as_of AS price_as_of,
  t.rsi14, t.dma50, t.dma200, t.beta, t.volume_vs_20d_avg,
  t.pct_from_52w_high, t.pct_from_52w_low,
  t.ret_1m_pct, t.ret_3m_pct, t.ret_1y_pct, t.as_of AS technicals_as_of
FROM public.stock_universe u
LEFT JOIN LATERAL (
  SELECT * FROM public.stock_prices_eod pe WHERE pe.ticker = u.ticker ORDER BY pe.date DESC LIMIT 1
) p ON true
LEFT JOIN LATERAL (
  SELECT * FROM public.stock_technicals te WHERE te.ticker = u.ticker ORDER BY te.date DESC LIMIT 1
) t ON true;
GRANT SELECT ON public.stock_screener_rows TO anon, authenticated;
GRANT ALL ON public.stock_screener_rows TO service_role;