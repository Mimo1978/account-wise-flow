DROP POLICY IF EXISTS "Contributors and above can create notes with demo isolation" ON public.notes;

DROP POLICY IF EXISTS "Contributors and above can create notes" ON public.notes;

CREATE POLICY "Authenticated users can create own notes"
ON public.notes
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());