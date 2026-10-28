ALTER TABLE public.support_messages ADD COLUMN assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX support_messages_assigned_idx ON public.support_messages(assigned_to, created_at DESC);

CREATE OR REPLACE FUNCTION public.inbox_crew_members()
RETURNS TABLE(id uuid, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT p.id, coalesce(nullif(p.display_name,''), 'Crew member') FROM public.profiles p
 WHERE p.id <> auth.uid() AND EXISTS (
 SELECT 1 FROM public.cars c
 WHERE (c.user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.car_shares s WHERE s.car_id=c.id AND s.shared_with_user_id=auth.uid()))
 AND (c.user_id=p.id OR EXISTS (SELECT 1 FROM public.car_shares s WHERE s.car_id=c.id AND s.shared_with_user_id=p.id))
 )
$$;
REVOKE ALL ON FUNCTION public.inbox_crew_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inbox_crew_members() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_support_assignee()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL AND NOT public.has_role(NEW.assigned_to,'admin') THEN
 RAISE EXCEPTION 'Support requests can only be assigned to support team members';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER support_assignee_valid BEFORE UPDATE ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.validate_support_assignee();

CREATE TABLE public.team_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 CHECK (sender_id <> recipient_id)
);
GRANT SELECT, INSERT ON public.team_messages TO authenticated;
GRANT UPDATE(read_at) ON public.team_messages TO authenticated;
GRANT ALL ON public.team_messages TO service_role;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_messages_participants_read ON public.team_messages FOR SELECT TO authenticated USING (auth.uid() IN (sender_id,recipient_id));
CREATE POLICY team_messages_crew_send ON public.team_messages FOR INSERT TO authenticated WITH CHECK (sender_id=auth.uid() AND read_at IS NULL AND recipient_id IN (SELECT id FROM public.inbox_crew_members()));
CREATE POLICY team_messages_recipient_read_receipt ON public.team_messages FOR UPDATE TO authenticated USING (recipient_id=auth.uid()) WITH CHECK (recipient_id=auth.uid());
CREATE INDEX team_messages_recipient_idx ON public.team_messages(recipient_id,created_at DESC);
CREATE INDEX team_messages_sender_idx ON public.team_messages(sender_id,created_at DESC);

CREATE TABLE public.support_replies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 support_id uuid NOT NULL REFERENCES public.support_messages(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_replies TO authenticated;
GRANT ALL ON public.support_replies TO service_role;
ALTER TABLE public.support_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_replies_conversation_read ON public.support_replies FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.support_messages m WHERE m.id=support_id AND (m.user_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY support_replies_conversation_send ON public.support_replies FOR INSERT TO authenticated WITH CHECK (sender_id=auth.uid() AND EXISTS (SELECT 1 FROM public.support_messages m WHERE m.id=support_id AND (m.user_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE INDEX support_replies_thread_idx ON public.support_replies(support_id,created_at);

CREATE TABLE public.support_inbox_reads (
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 support_id uuid NOT NULL REFERENCES public.support_messages(id) ON DELETE CASCADE,
 seen_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,support_id)
);
GRANT SELECT, INSERT, UPDATE ON public.support_inbox_reads TO authenticated;
GRANT ALL ON public.support_inbox_reads TO service_role;
ALTER TABLE public.support_inbox_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_inbox_reads_own ON public.support_inbox_reads FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.support_messages m WHERE m.id=support_id AND (m.user_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));