import { NextRequest, NextResponse } from 'next/server';
import { verifyRazorpaySignature } from '@/lib/razorpay';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for server-side operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            order_id,
        } = body;

        console.log('Verifying payment:', { razorpay_order_id, razorpay_payment_id, order_id });

        // Verify the payment signature
        const isValid = verifyRazorpaySignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!isValid) {
            console.error('Invalid payment signature');
            return NextResponse.json(
                { success: false, error: 'Invalid payment signature' },
                { status: 400 }
            );
        }

        console.log('Signature verified, updating order...');

        // Use RPC function to update order (bypasses RLS)
        const { data, error } = await supabase.rpc('verify_razorpay_payment', {
            p_order_id: order_id,
            p_razorpay_order_id: razorpay_order_id,
            p_razorpay_payment_id: razorpay_payment_id,
        });

        if (error) {
            console.error('RPC error:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to update order: ' + error.message },
                { status: 500 }
            );
        }

        if (!data) {
            console.error('Order not found');
            return NextResponse.json(
                { success: false, error: 'Order not found' },
                { status: 404 }
            );
        }

        console.log('Order updated successfully');

        return NextResponse.json({
            success: true,
            message: 'Payment verified and order queued',
        });
    } catch (error: any) {
        console.error('Payment verification failed:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Verification failed' },
            { status: 500 }
        );
    }
}
