-- RPC for Print Velocity
CREATE OR REPLACE FUNCTION public.get_print_velocity()
RETURNS TABLE (hour_timestamp TIMESTAMPTZ, order_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        date_trunc('hour', created_at) as hour_timestamp,
        count(*) as order_count
    FROM public.orders
    WHERE created_at >= (NOW() - INTERVAL '12 hours')
    GROUP BY 1
    ORDER BY 1 ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
