-- Maven Work Desk — drop orphaned dead code found during the live-drift
-- audit (2026-08-21, docs/WORK_DESK_BASELINE_SECURITY_MAP.md owner
-- decision item 3)
--
-- guard_task_update() is a leftover trigger function from a pre-work_items
-- schema (references columns like engagement_id that don't exist
-- anywhere in the current design -- work_items replaced whatever "tasks"
-- table this once guarded). Confirmed live: no trigger anywhere
-- references this function (checked information_schema.triggers), and no
-- table named "tasks" exists. It has zero live effect and was never
-- created by any migration in this repo -- pure cleanup, not a behavior
-- change. Using DROP FUNCTION rather than leaving it: an unused function
-- with a name this close to real trigger functions (prevent_self_role_
-- escalation, guard_profile_update) is exactly the kind of thing that
-- causes confusion during a future audit, the same way this one did.

drop function if exists public.guard_task_update();
