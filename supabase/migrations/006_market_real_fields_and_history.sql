-- ============================================================
-- 006 — Market prices: real EU fields + 30-day price history
-- ============================================================
-- Additive only. Does not change existing routes/architecture.

-- ── Extend market_prices with the real fields the EU API returns ──
ALTER TABLE public.market_prices
  ADD COLUMN IF NOT EXISTS member_state_code TEXT,
  ADD COLUMN IF NOT EXISTS member_state_name TEXT,
  ADD COLUMN IF NOT EXISTS market_name       TEXT,
  ADD COLUMN IF NOT EXISTS begin_date        DATE,
  ADD COLUMN IF NOT EXISTS end_date          DATE,
  ADD COLUMN IF NOT EXISTS category          TEXT;

-- ── Real price history (for sparklines / charts) ──
-- One row per (symbol, end_date) so each weekly EU observation is stored once.
-- Charts read ONLY from this table — never fabricated data.
CREATE TABLE IF NOT EXISTS public.market_price_history (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  symbol       TEXT NOT NULL,
  commodity    TEXT,
  price        NUMERIC(12,4) NOT NULL,
  end_date     DATE,                              -- the EU reference week end (real)
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (symbol, end_date)
);

CREATE INDEX IF NOT EXISTS idx_mph_symbol_date
  ON public.market_price_history (symbol, end_date DESC);

-- RLS: history is public-readable (same as market_prices), writes via service role only.
ALTER TABLE public.market_price_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'market_price_history' AND policyname = 'mph_public_read'
  ) THEN
    CREATE POLICY mph_public_read ON public.market_price_history
      FOR SELECT USING (true);
  END IF;
END $$;
