
-- Tighten job_board_subscriptions RLS to workspace-scoped
DROP POLICY IF EXISTS "Authenticated users can manage subscriptions" ON public.job_board_subscriptions;

CREATE POLICY "Workspace members can read subscriptions"
  ON public.job_board_subscriptions
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Admins can manage subscriptions"
  ON public.job_board_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
