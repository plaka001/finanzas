-- Panorama — hardening: las funciones de trigger no deben ser invocables vía /rest/v1/rpc
-- (advisor de Supabase: anon/authenticated_security_definer_function_executable)
revoke execute on function public.apply_debt_payment() from anon, authenticated, public;
revoke execute on function public.revert_debt_payment() from anon, authenticated, public;
revoke execute on function public.apply_goal_contribution() from anon, authenticated, public;
revoke execute on function public.revert_goal_contribution() from anon, authenticated, public;
revoke execute on function public.feed_debt_free_goal() from anon, authenticated, public;
revoke execute on function public.unfeed_debt_free_goal() from anon, authenticated, public;
revoke execute on function public.apply_card_expense() from anon, authenticated, public;
