DROP POLICY IF EXISTS notes_select_policy ON public.notes;

CREATE POLICY notes_select_policy
ON public.notes
FOR SELECT
TO authenticated
USING (public.can_view_note(auth.uid(), id));