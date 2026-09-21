-- Run after enabling Neon Auth and the Neon Data API.
CREATE TABLE IF NOT EXISTS public.trips (
  id text PRIMARY KEY,
  user_id text NOT NULL DEFAULT auth.user_id(),
  name text NOT NULL,
  destination text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  purpose text,
  client_or_event text,
  notes text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS public.expenses (
  id text PRIMARY KEY,
  user_id text NOT NULL DEFAULT auth.user_id(),
  trip_id text NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  date date NOT NULL,
  merchant text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL,
  payment_method text NOT NULL,
  reimbursable_amount numeric(12,2) NOT NULL,
  personal_amount numeric(12,2) NOT NULL,
  reimbursement_status text NOT NULL,
  notes text,
  receipt jsonb,
  source text NOT NULL,
  calculation jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS public.categories (
  name text NOT NULL,
  user_id text NOT NULL DEFAULT auth.user_id(),
  PRIMARY KEY (user_id, name)
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trips owner select" ON public.trips;
DROP POLICY IF EXISTS "trips owner insert" ON public.trips;
DROP POLICY IF EXISTS "trips owner update" ON public.trips;
DROP POLICY IF EXISTS "trips owner delete" ON public.trips;
DROP POLICY IF EXISTS "expenses owner select" ON public.expenses;
DROP POLICY IF EXISTS "expenses owner insert" ON public.expenses;
DROP POLICY IF EXISTS "expenses owner update" ON public.expenses;
DROP POLICY IF EXISTS "expenses owner delete" ON public.expenses;
DROP POLICY IF EXISTS "categories owner select" ON public.categories;
DROP POLICY IF EXISTS "categories owner insert" ON public.categories;
DROP POLICY IF EXISTS "categories owner update" ON public.categories;
DROP POLICY IF EXISTS "categories owner delete" ON public.categories;

CREATE POLICY "trips owner select" ON public.trips FOR SELECT TO authenticated USING ((select auth.user_id()) = user_id);
CREATE POLICY "trips owner insert" ON public.trips FOR INSERT TO authenticated WITH CHECK ((select auth.user_id()) = user_id);
CREATE POLICY "trips owner update" ON public.trips FOR UPDATE TO authenticated USING ((select auth.user_id()) = user_id) WITH CHECK ((select auth.user_id()) = user_id);
CREATE POLICY "trips owner delete" ON public.trips FOR DELETE TO authenticated USING ((select auth.user_id()) = user_id);
CREATE POLICY "expenses owner select" ON public.expenses FOR SELECT TO authenticated USING ((select auth.user_id()) = user_id);
CREATE POLICY "expenses owner insert" ON public.expenses FOR INSERT TO authenticated WITH CHECK ((select auth.user_id()) = user_id AND EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_id AND trips.user_id = (select auth.user_id())));
CREATE POLICY "expenses owner update" ON public.expenses FOR UPDATE TO authenticated USING ((select auth.user_id()) = user_id) WITH CHECK ((select auth.user_id()) = user_id AND EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_id AND trips.user_id = (select auth.user_id())));
CREATE POLICY "expenses owner delete" ON public.expenses FOR DELETE TO authenticated USING ((select auth.user_id()) = user_id);
CREATE POLICY "categories owner select" ON public.categories FOR SELECT TO authenticated USING ((select auth.user_id()) = user_id);
CREATE POLICY "categories owner insert" ON public.categories FOR INSERT TO authenticated WITH CHECK ((select auth.user_id()) = user_id);
CREATE POLICY "categories owner update" ON public.categories FOR UPDATE TO authenticated USING ((select auth.user_id()) = user_id) WITH CHECK ((select auth.user_id()) = user_id);
CREATE POLICY "categories owner delete" ON public.categories FOR DELETE TO authenticated USING ((select auth.user_id()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips, public.expenses, public.categories TO authenticated;
