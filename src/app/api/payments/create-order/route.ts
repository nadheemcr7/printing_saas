import { NextRequest, NextResponse } from 'next/server';
import { razorpay } from '@/lib/razorpay';

export async function POST(request: NextRequest) {
    try {
        const { amount, orderId, customerName, customerEmail } = await request.json();

        // Amount should be in paise (1 INR = 100 paise)
        const amountInPaise = Math.round(amount * 100);

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: orderId,
            notes: {
                order_id: orderId,
                customer_name: customerName || 'Guest',
            },
        };

        const razorpayOrder = await razorpay.orders.create(options);

        return NextResponse.json({
            success: true,
            order: {
                id: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
            },
        });
    } catch (error: any) {
        console.error('Razorpay order creation failed:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
