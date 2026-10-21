-- ============================================================
-- 007 — Transport logistics platform (production-ready)
-- ============================================================
-- Additive only. Extends route_requests, adds status events,
-- transport reviews, transport notifications, and transporter profile fields.

-- ── Extend transporters with richer profile fields ──
ALTER TABLE public.transporters
  ADD COLUMN IF NOT EXISTS company_name      TEXT,
  ADD COLUMN IF NOT EXISTS logo_url          TEXT,
  ADD COLUMN IF NOT EXISTS service_areas     TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cargo_types       TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vehicles          TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS years_experience  INT     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS insured           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS adr_certified     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_seed           BOOLEAN DEFAULT FALSE; -- marks optional seed rows

-- ── Extend route_requests into full transport requests ──
ALTER TABLE public.route_requests
  ADD COLUMN IF NOT EXISTS unit                    TEXT DEFAULT 'ton',
  ADD COLUMN IF NOT EXISTS cargo_type              TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_mode          TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS preferred_time          TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS max_cost                NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS special_requirements    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS photos                  TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assigned_transporter_id UUID REFERENCES public.transporters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agreed_cost             NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS completed_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Widen the status lifecycle. Drop the old CHECK and add the full set.
DO $$ BEGIN
  ALTER TABLE public.route_requests DROP CONSTRAINT IF EXISTS route_requests_status_check;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE public.route_requests
  ADD CONSTRAINT route_requests_status_check
  CHECK (status IN ('pending','accepted','scheduled','picked_up','in_transit','delivered','cancelled','open','matched','closed'));

-- ── Transport status timeline events (real data for tracking) ──
CREATE TABLE IF NOT EXISTS public.transport_status_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID REFERENCES public.route_requests(id) ON DELETE CASCADE NOT NULL,
  status      TEXT NOT NULL,
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tse_request ON public.transport_status_events (request_id, created_at);

-- ── Transport reviews (4 criteria, 1–5 each) ──
CREATE TABLE IF NOT EXISTS public.transport_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES public.route_requests(id) ON DELETE CASCADE NOT NULL,
  transporter_id  UUID REFERENCES public.transporters(id) ON DELETE CASCADE NOT NULL,
  reviewer_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reliability     INT NOT NULL CHECK (reliability    BETWEEN 1 AND 5),
  speed           INT NOT NULL CHECK (speed          BETWEEN 1 AND 5),
  communication   INT NOT NULL CHECK (communication  BETWEEN 1 AND 5),
  cargo_condition INT NOT NULL CHECK (cargo_condition BETWEEN 1 AND 5),
  comment         TEXT DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_tr_transporter ON public.transport_reviews (transporter_id);

-- ── Transport notifications ──
CREATE TABLE IF NOT EXISTS public.transport_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  request_id  UUID REFERENCES public.route_requests(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,           -- accepted | scheduled | started | completed | review_prompt
  message     TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tn_user ON public.transport_notifications (user_id, read, created_at DESC);

-- ── RLS ──
ALTER TABLE public.transport_status_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_notifications  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transport_status_events' AND policyname='tse_public_read') THEN
    CREATE POLICY tse_public_read ON public.transport_status_events FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transport_status_events' AND policyname='tse_auth_write') THEN
    CREATE POLICY tse_auth_write ON public.transport_status_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transport_reviews' AND policyname='tr_public_read') THEN
    CREATE POLICY tr_public_read ON public.transport_reviews FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transport_reviews' AND policyname='tr_owner_write') THEN
    CREATE POLICY tr_owner_write ON public.transport_reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transport_notifications' AND policyname='tn_owner_read') THEN
    CREATE POLICY tn_owner_read ON public.transport_notifications FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transport_notifications' AND policyname='tn_owner_update') THEN
    CREATE POLICY tn_owner_update ON public.transport_notifications FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transport_notifications' AND policyname='tn_auth_insert') THEN
    CREATE POLICY tn_auth_insert ON public.transport_notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ── Trigger: keep transporter rating in sync with transport_reviews ──
CREATE OR REPLACE FUNCTION public.sync_transporter_rating() RETURNS TRIGGER AS $$
DECLARE avg_rating NUMERIC; cnt INT;
BEGIN
  SELECT
    AVG((reliability + speed + communication + cargo_condition) / 4.0),
    COUNT(*)
  INTO avg_rating, cnt
  FROM public.transport_reviews
  WHERE transporter_id = COALESCE(NEW.transporter_id, OLD.transporter_id);

  UPDATE public.transporters
  SET rating = COALESCE(ROUND(avg_rating, 2), 0), rating_count = COALESCE(cnt, 0)
  WHERE id = COALESCE(NEW.transporter_id, OLD.transporter_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_transporter_rating ON public.transport_reviews;
CREATE TRIGGER trg_sync_transporter_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.transport_reviews
  FOR EACH ROW EXECUTE FUNCTION public.sync_transporter_rating();
