CREATE TABLE public.etfs (
  ticker text PRIMARY KEY,
  etf_name text NOT NULL,
  category text NOT NULL,
  amc text,
  benchmark text,
  inception_date date,
  ltp_nav numeric,
  day_change_pct numeric,
  aum_cr numeric,
  volume numeric,
  w52_high numeric,
  w52_low numeric,
  ret_1m_pct numeric,
  ret_3m_pct numeric,
  ret_1yr_pct numeric,
  ret_3yr_pct numeric,
  ret_5yr_pct numeric,
  expense_ratio_pct numeric,
  tracking_error_pct numeric,
  inav numeric,
  price_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.etfs TO anon;
GRANT SELECT ON public.etfs TO authenticated;
GRANT ALL ON public.etfs TO service_role;

ALTER TABLE public.etfs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ETFs" ON public.etfs FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.etf_aum_snapshots (
  id bigserial PRIMARY KEY,
  ticker text NOT NULL REFERENCES public.etfs(ticker) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  aum_cr numeric,
  UNIQUE (ticker, snapshot_date)
);

GRANT SELECT ON public.etf_aum_snapshots TO anon;
GRANT SELECT ON public.etf_aum_snapshots TO authenticated;
GRANT ALL ON public.etf_aum_snapshots TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.etf_aum_snapshots_id_seq TO service_role;

ALTER TABLE public.etf_aum_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ETF AUM history" ON public.etf_aum_snapshots FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.etfs (ticker, etf_name, category, amc, benchmark, ltp_nav, day_change_pct, aum_cr, ret_1m_pct, ret_3m_pct, ret_1yr_pct, ret_3yr_pct, ret_5yr_pct, expense_ratio_pct) VALUES
('SETFNIF50','SBI Nifty 50 ETF','Equity - Broad Index','SBI Mutual Fund','Nifty 50',260.5,0.69,213844.54,1.47,0.58,-2.9,27.24,60.71,0.04),
('UTINIFTETF','UTI Nifty 50 ETF','Equity - Broad Index','UTI Mutual Fund','Nifty 50',268.53,0.74,72382.33,1.51,0.65,-2.89,27.57,60.8,0.05),
('NIFTYBEES','Nippon Nifty 50 ETF (NIFTYBEES)','Equity - Broad Index','Nippon India MF','Nifty 50',275.69,0.62,65811.79,1.48,0.64,-2.8,27.32,60.84,0.04),
('UTISENSETF','UTI Sensex ETF','Equity - Broad Index','UTI Mutual Fund','BSE Sensex',862.09,0.91,56469.92,2.17,0.03,-5.05,21.39,55.98,0.05),
('GOLDBEES','Nippon Gold ETF (GOLDBEES)','Commodity - Gold','Nippon India MF','Domestic Gold Price',115.31,-1.0,52677.71,-7.11,-8.2,41.75,128.38,175.53,0.81),
('ICICINIFTY','ICICI Pru Nifty 50 ETF','Equity - Broad Index','ICICI Prudential MF','Nifty 50',274.37,0.69,43093.04,1.49,0.62,-2.84,27.44,60.9,0.03),
('ICICISENSX','ICICI Pru Sensex ETF','Equity - Broad Index','ICICI Prudential MF','BSE Sensex',893.88,1.0,31537.05,1.67,0.23,-4.96,21.27,54.99,0.03),
('SILVERBEES','Nippon Silver ETF (SILVERBEES)','Commodity - Silver','Nippon India MF','Domestic Silver Price',203.85,-1.45,28641.47,-13.67,-14.34,89.12,176.18,230.01,0.58),
('EBBETF0430','Edelweiss Bharat Bond April 2030 ETF','Debt - Target Maturity','Edelweiss MF','Nifty BHARAT Bond Index',1606.98,0.13,25287.72,0.83,2.12,5.11,24.84,38.49,0.01),
('GOLDIETF','ICICI Pru Gold ETF','Commodity - Gold','ICICI Prudential MF','Domestic Gold Price',119.38,-1.08,25118.74,-7.16,-8.25,42.05,129.71,179.06,0.49),
('SETFGOLD','SBI Gold ETF','Commodity - Gold','SBI Mutual Fund','Domestic Gold Price',118.96,-1.03,23819.51,-7.06,-8.1,41.97,128.95,177.1,0.65),
('HDFCGOLD','HDFC Gold ETF','Commodity - Gold','HDFC Mutual Fund','Domestic Gold Price',119.2,-1.03,20617.1,-7.08,-8.05,42.14,129.36,177.86,0.59),
('CPSEETF','CPSE ETF','Equity - Thematic (PSU)','Nippon India MF','Nifty CPSE',95.91,0.4,19726.3,-1.55,-9.03,2.65,116.4,267.05,0.07),
('MON100','Motilal Oswal Nasdaq 100 ETF','International','Motilal Oswal MF','Nasdaq 100 (TRI, INR)',332.9,-0.21,16782.65,0.86,19.96,72.92,168.29,205.36,0.59),
('EBBETF0431','Edelweiss Bharat Bond April 2031 ETF','Debt - Target Maturity','Edelweiss MF','Nifty BHARAT Bond Index',1437.0,0.11,13422.66,1.1,2.56,5.19,24.85,38.07,0.01),
('KOTAKGOLD','Kotak Gold ETF','Commodity - Gold','Kotak Mahindra MF','Domestic Gold Price',116.42,-0.95,13348.68,-7.11,-8.02,42.13,129.76,176.86,0.52),
('SILVERIETF','ICICI Pru Silver ETF','Commodity - Silver','ICICI Prudential MF','Domestic Silver Price',212.81,-1.44,13256.35,-13.72,-14.26,89.5,178.51,236.3,0.4),
('LIQUIDBEES','Nippon India Nifty Liquid ETF','Debt - Liquid','Nippon India MF','Nifty 1D Rate Index',999.99,0.0,11259.59,NULL,NULL,NULL,NULL,NULL,0.71),
('EBBETF0432','Edelweiss Bharat Bond April 2032 ETF','Debt - Target Maturity','Edelweiss MF','Nifty BHARAT Bond Index',1351.0,0.46,10541.62,1.44,2.7,5.38,25.34,34.76,0.01),
('ICICIB22','ICICI Pru Bharat 22 ETF','Equity - Thematic (PSU)','ICICI Prudential MF','S&P BSE Bharat 22',115.91,0.35,10170.9,-3.51,-6.43,5.14,70.93,185.07,0.07),
('LIQUIDCASE','Zerodha Liquid ETF (LIQUIDCASE)','Debt - Liquid','Zerodha Fund House','Nifty 1D Rate Index',115.08,0.06,10057.13,0.46,1.28,5.1,14.83,14.83,0.28),
('JUNIORBEES','Nippon Nifty Next 50 Junior BeES','Equity - Broad Index','Nippon India MF','Nifty Next 50',776.09,-0.11,8437.43,0.17,4.01,5.25,64.92,89.4,0.19),
('BANKBEES','Nippon Nifty Bank ETF (BANKBEES)','Equity - Sectoral (Banking)','Nippon India MF','Nifty Bank',600.24,0.53,8416.52,1.63,3.92,2.01,29.87,66.71,0.19),
('HDFCSILVER','HDFC Silver ETF','Commodity - Silver','HDFC Mutual Fund','Domestic Silver Price',203.85,-1.51,6967.62,-13.66,-14.33,88.56,176.44,285.42,0.5),
('EBBETF0433','Edelweiss Bharat Bond April 2033 ETF','Debt - Target Maturity','Edelweiss MF','Nifty BHARAT Bond Index',1314.0,0.12,6356.37,1.71,2.68,5.3,24.98,31.07,0.01),
('TATAGOLD','Tata Gold ETF','Commodity - Gold','Tata Mutual Fund','Domestic Gold Price',13.56,-0.95,5636.32,-6.93,-8.01,41.99,90.99,90.99,0.35),
('SBISILVER','SBI Silver ETF','Commodity - Silver','SBI Mutual Fund','Domestic Silver Price',208.84,-1.53,5539.09,-13.65,-14.24,89.1,128.12,128.12,0.41),
('NIFTYETF','Mirae Asset Nifty 50 ETF','Equity - Broad Index','Mirae Asset MF','Nifty 50',263.3,0.55,5288.93,1.48,0.73,-2.73,27.33,60.63,0.07),
('HDFCNIFBAN','HDFC Nifty Bank ETF','Equity - Sectoral (Banking)','HDFC Mutual Fund','Nifty Bank',59.66,0.52,5181.4,1.6,3.88,2.07,30.12,67.58,0.17),
('TATSILV','TATA Silver ETF','Commodity - Silver','Tata Mutual Fund','Domestic Silver Price',20.71,-1.43,5098.91,-13.56,-14.28,89.48,156.31,156.31,0.39),
('HDFCNIFETF','HDFC Nifty 50 ETF','Equity - Broad Index','HDFC Mutual Fund','Nifty 50',272.9,0.66,5026.67,1.54,0.62,-2.93,27.46,60.46,0.05),
('AXISGOLD','Axis Gold ETF','Commodity - Gold','Axis Mutual Fund','Domestic Gold Price',116.09,-1.1,5003.56,-7.31,-8.35,41.94,128.79,178.13,0.58),
('MAFANG','Mirae Asset NYSE FANG+ ETF','International','Mirae Asset MF','NYSE FANG+ (INR)',201.85,1.22,4991.82,6.37,20.96,33.68,208.92,270.78,0.71),
('KOTAKBKETF','Kotak Nifty Bank ETF','Equity - Sectoral (Banking)','Kotak Mahindra MF','Nifty Bank',60.15,0.5,4726.25,1.59,3.92,2.23,29.94,66.57,0.15),
('PVTBANIETF','ICICI Pru Nifty Private Bank ETF','Equity - Sectoral (Banking)','ICICI Prudential MF','Nifty Private Bank',28.48,1.06,4121.95,1.28,5.05,0.96,23.13,54.45,0.15),
('PSUBNKBEES','Nippon Nifty PSU Bank ETF (PSUBNKBEES)','Equity - Sectoral (Banking)','Nippon India MF','Nifty PSU Bank',93.49,0.27,4034.1,-2.51,-4.34,15.23,87.62,246.9,0.51),
('GOLDSHARE','UTI Gold ETF','Commodity - Gold','UTI Mutual Fund','Domestic Gold Price',117.45,-1.05,4005.84,-6.97,-7.99,42.45,132.57,180.31,0.52),
('ITBEES','Nippon Nifty IT ETF (ITBEES)','Equity - Sectoral (IT)','Nippon India MF','Nifty IT',32.21,1.07,3995.7,1.54,-8.13,-21.44,-1.14,8.16,0.23),
('SETFNIFBK','SBI Nifty Bank ETF','Equity - Sectoral (Banking)','SBI Mutual Fund','Nifty Bank',594.97,0.44,3688.21,1.53,3.61,1.87,29.99,66.47,0.19),
('MID150BEES','Nippon Nifty MC 150 ETF (MID150BEES)','Equity - Midcap','Nippon India MF','Nifty Midcap 150',237.78,-0.34,3680.01,1.4,5.82,4.95,69.79,122.81,0.22),
('KOTAKNIFTY','Kotak Nifty 50 ETF','Equity - Broad Index','Kotak Mahindra MF','Nifty 50',268.55,0.43,3501.61,1.16,0.75,-2.78,27.48,60.44,0.03),
('LOWVOLIETF','ICICI Pru Nifty 100 Low Vol 30 ETF','Equity - Factor/Smart Beta','ICICI Prudential MF','Nifty 100 Low Volatility 30',22.11,0.36,3447.25,2.08,2.6,-0.09,37.76,68.65,0.43),
('KOTAKSILVE','Kotak Silver ETF','Commodity - Silver','Kotak Mahindra MF','Domestic Silver Price',20.69,-1.43,3306.5,-13.58,-14.18,89.47,177.35,204.26,0.35),
('ABSLNN50ET','Aditya Birla Nifty 50 ETF','Equity - Broad Index','Aditya Birla Sun Life MF','Nifty 50',28.4,0.6,3302.75,1.61,0.67,-2.81,27.41,61.18,0.04),
('SETF10GILT','SBI Nifty 10 Year G-Sec ETF','Debt - Gilt','SBI Mutual Fund','Nifty 10 yr Benchmark G-Sec',264.38,-0.33,3294.41,1.04,2.06,2.32,21.28,29.5,0.15),
('UTIBANKETF','UTI Nifty Bank ETF','Equity - Sectoral (Banking)','UTI Mutual Fund','Nifty Bank',59.91,0.54,3176.43,1.58,3.74,2.13,30.15,66.79,0.18),
('GOLDETFADD','Mirae Asset Gold ETF','Commodity - Gold','Mirae Asset MF','Domestic Gold Price',135.76,-0.93,3096.72,-6.95,-7.93,42.02,128.94,142.0,0.39),
('BANKIETF','ICICI Prudential Bank ETF','Equity - Sectoral (Banking)','ICICI Prudential MF','Nifty Bank',59.54,0.54,3077.57,1.69,3.95,2.16,29.94,67.11,0.15),
('SETFNN50','SBI Nifty Next 50 ETF','Equity - Broad Index','SBI Mutual Fund','Nifty Next 50',769.23,-0.15,2972.88,0.1,4.06,5.46,65.27,89.39,0.12),
('SILVERBSL','Aditya Birla Silver ETF','Commodity - Silver','Aditya Birla Sun Life MF','Domestic Silver Price',213.02,-1.42,2790.19,-13.59,-14.16,89.45,178.6,235.89,0.35)
ON CONFLICT (ticker) DO NOTHING;

INSERT INTO public.etf_aum_snapshots (ticker, aum_cr)
SELECT ticker, aum_cr FROM public.etfs
ON CONFLICT (ticker, snapshot_date) DO NOTHING;