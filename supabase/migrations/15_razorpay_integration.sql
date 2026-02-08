-- Razorpay Payment Integration
-- Adds columns and functions for Razorpay payment processing

-- Add Razorpay fields to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
ADD COLUMN IF NOT EXISTS payment_verified BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id ON orders(razorpay_payment_id);

-- Create verification function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.verify_razorpay_payment(
    p_order_id UUID,
    p_razorpay_order_id TEXT,
    p_razorpay_payment_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE orders 
    SET 
        status = 'queued',
        payment_status = 'paid',
        payment_verified = TRUE,
        razorpay_order_id = p_razorpay_order_id,
        razorpay_payment_id = p_razorpay_payment_id
    WHERE id = p_order_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.verify_razorpay_payment TO anon, authenticated;

COMMENT ON COLUMN orders.razorpay_order_id IS 'Razorpay order ID (order_xxx format)';
COMMENT ON COLUMN orders.razorpay_payment_id IS 'Razorpay payment ID (pay_xxx format) - unique per successful payment';
COMMENT ON FUNCTION public.verify_razorpay_payment IS 'Verifies Razorpay payment and updates order status to queued with payment_status=paid';
