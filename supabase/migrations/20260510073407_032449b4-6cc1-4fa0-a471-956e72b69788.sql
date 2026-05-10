REVOKE EXECUTE ON FUNCTION public.is_car_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_car_access(uuid, uuid, public.share_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_car_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_car_access(uuid, uuid, public.share_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;