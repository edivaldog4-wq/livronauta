
-- Fix: PostgREST embed profiles(...) on loans/reservations queries fails silently
-- because loans.user_id/reservations.user_id FK to auth.users, not profiles.
-- Add an additional FK to profiles(id) so admin views show membro data.

ALTER TABLE public.loans
  ADD CONSTRAINT loans_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
