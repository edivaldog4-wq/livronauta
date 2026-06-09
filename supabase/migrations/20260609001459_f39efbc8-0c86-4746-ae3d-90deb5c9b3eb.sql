DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.loans; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.books; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
ALTER TABLE public.loans REPLICA IDENTITY FULL;
ALTER TABLE public.loan_requests REPLICA IDENTITY FULL;
ALTER TABLE public.books REPLICA IDENTITY FULL;