-- ANALYTICS RPC: Daily & Weekly Stats for Owner

CREATE OR REPLACE FUNCTION public.get_owner_analytics()
RETURNS TABLE (
    today_revenue DECIMAL,
    today_orders BIGINT,
    today_pages BIGINT,
    weekly_revenue DECIMAL,
    pending_revenue DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(estimated_cost) FILTER (WHERE created_at >= CURRENT_DATE AND payment_status = 'paid'), 0),
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE),
        COALESCE(SUM(total_pages) FILTER (WHERE created_at >= CURRENT_DATE), 0),
        COALESCE(SUM(estimated_cost) FILTER (WHERE created_at >= (CURRENT_DATE - INTERVAL '7 days') AND payment_status = 'paid'), 0),
        COALESCE(SUM(estimated_cost) FILTER (WHERE status != 'completed' AND payment_status = 'paid'), 0)
    FROM public.orders;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
