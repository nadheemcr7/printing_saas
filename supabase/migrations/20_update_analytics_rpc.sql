-- Update Analytics RPC to be more inclusive of revenue
-- Matches the new logic in the Owner Dashboard

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
        -- Today's Revenue: Count orders from today that are paid, verified, or actively in the workflow
        COALESCE(SUM(estimated_cost) FILTER (
            WHERE created_at >= CURRENT_DATE 
            AND (payment_status = 'paid' OR payment_verified = TRUE OR status IN ('queued', 'printing', 'ready', 'completed'))
        ), 0),
        
        -- Today's Orders
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE),
        
        -- Today's Pages
        COALESCE(SUM(total_pages) FILTER (WHERE created_at >= CURRENT_DATE), 0),
        
        -- Weekly Revenue: Count orders from last 7 days that are paid/verified/in-workflow
        COALESCE(SUM(estimated_cost) FILTER (
            WHERE created_at >= (CURRENT_DATE - INTERVAL '7 days') 
            AND (payment_status = 'paid' OR payment_verified = TRUE OR status IN ('queued', 'printing', 'ready', 'completed'))
        ), 0),
        
        -- Pending Value: Orders not yet completed that have money attached
        COALESCE(SUM(estimated_cost) FILTER (
            WHERE status != 'completed' 
            AND (payment_status = 'paid' OR payment_verified = TRUE OR status IN ('queued', 'printing', 'ready'))
        ), 0)
    FROM public.orders;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_owner_analytics TO authenticated;
