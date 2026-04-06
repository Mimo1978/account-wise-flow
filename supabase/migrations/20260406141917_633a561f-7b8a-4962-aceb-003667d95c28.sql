DROP POLICY IF EXISTS "Admins can delete notes" ON public.notes;
DROP POLICY IF EXISTS "Admins can delete notes with demo isolation" ON public.notes;

CREATE POLICY "Owners and admins can delete notes"
ON public.notes
FOR DELETE
TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));