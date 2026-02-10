-- Drop the trigger that was causing "Direct deletion from storage tables is not allowed"
-- We will handle file cleanup via the Application Code or a dedicated Edge Function instead
DROP TRIGGER IF EXISTS trigger_cleanup_storage_on_delete ON public.orders;
DROP FUNCTION IF EXISTS public.on_order_deleted_cleanup_storage();

-- Keep the pg_cron cleanup for the database records only
-- The storage bucket policies (if set with expires) or manual cleanup will handle the physical files
