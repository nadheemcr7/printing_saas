-- Queue Status and Realtime Fixes
-- Enables global queue visibility for customers and fixes realtime updates

-- Function to get global queue status (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_queue_status()
RETURNS TABLE (
    orders_in_queue INT,
    total_pages INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INT as orders_in_queue,
        COALESCE(SUM(o.total_pages), 0)::INT as total_pages
    FROM orders o
    WHERE o.status IN ('queued', 'printing');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_queue_status TO anon, authenticated;

-- Set replica identity to FULL for proper realtime updates
-- This ensures UPDATE events include all columns including customer_id
ALTER TABLE orders REPLICA IDENTITY FULL;

COMMENT ON FUNCTION public.get_queue_status IS 'Returns global queue status visible to all customers, bypasses RLS';
