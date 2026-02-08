import { NextRequest, NextResponse } from "next/server";
import { Cashfree, CFEnvironment } from "cashfree-pg";

// Initialize Cashfree Instance (v5 SDK)
const cashfree = new Cashfree(
    process.env.CASHFREE_MODE === "production" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
    process.env.CASHFREE_APP_ID || "",
    process.env.CASHFREE_SECRET_KEY || ""
);

export async function POST(req: NextRequest) {
    try {
        const { orderId, amount, customerName, customerEmail, customerPhone } = await req.json();

        if (!orderId || !amount) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const request = {
            order_amount: amount,
            order_currency: "INR",
            order_id: `ORDER_${orderId}_${Date.now()}`,
            customer_details: {
                customer_id: orderId, // Using order internal ID as customer ID for tracking
                customer_name: customerName || "Guest Customer",
                customer_email: customerEmail || "customer@example.com",
                customer_phone: customerPhone || "9999999999",
            },
            order_meta: {
                // Return URL for fallback if redirect is used, but we use SDK
                return_url: `${req.nextUrl.origin}/dashboard/customer?order_id={order_id}`,
                notify_url: `${req.nextUrl.origin}/api/webhook/cashfree`,
            },
        };

        // Note: PGCreateOrder in v5 takes the request as the first argument
        const response = await cashfree.PGCreateOrder(request);

        return NextResponse.json(response.data);

    } catch (err: any) {
        console.error("Cashfree Order Creation Error:", err.response?.data || err.message);
        return NextResponse.json(
            { error: err.response?.data?.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
