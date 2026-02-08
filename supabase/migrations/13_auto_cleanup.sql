-- Enable pg_cron for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Cleanup Function
CREATE OR REPLACE FUNCTION public.cleanup_old_orders()
RETURNS void AS $$
BEGIN
    -- 1. Delete completed orders older than 7 days
    DELETE FROM public.orders
    WHERE status = 'completed'
    AND updated_at < (NOW() - INTERVAL '7 days');

    -- 2. Delete abandoned (pending_payment) orders older than 24 hours
    DELETE FROM public.orders
    WHERE status = 'pending_payment'
    AND created_at < (NOW() - INTERVAL '24 hours');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule daily at midnight
SELECT cron.schedule('daily-cleanup', '0 0 * * *', 'SELECT public.cleanup_old_orders()');

-- Trigger to delete files from storage when order record is deleted
-- Note: This requires the database user to have permissions on storage.objects
CREATE OR REPLACE FUNCTION public.on_order_deleted_cleanup_storage()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete from storage.objects
    -- Files are in 'documents' bucket
    DELETE FROM storage.objects
    WHERE bucket_id = 'documents'
    AND name = OLD.file_path;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_cleanup_storage_on_delete
AFTER DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.on_order_deleted_cleanup_storage();
