import { NextRequest, NextResponse } from "next/server";
import { Cashfree, CFEnvironment } from "cashfree-pg";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin (needed to bypass RLS for automated updates)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Ensure this is in .env
);

// Initialize Cashfree Instance (v5 SDK)
const cashfree = new Cashfree(
    process.env.CASHFREE_MODE === "production" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
    process.env.CASHFREE_APP_ID || "",
    process.env.CASHFREE_SECRET_KEY || ""
);

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();
        const signature = req.headers.get("x-webhook-signature");
        const timestamp = req.headers.get("x-webhook-timestamp");

        if (!signature || !timestamp) {
            return NextResponse.json({ error: "Missing signature" }, { status: 400 });
        }

        // 1. Verify Webhook Signature (v5 SDK instance method)
        try {
            cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
        } catch (err) {
            console.error("Webhook Verification Failed:", err);
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        const payload = JSON.parse(rawBody);
        const { data } = payload;

        // Ensure it's an order success event
        if (payload.type === "PAYMENT_SUCCESS_WEBHOOK") {
            const orderIdWithTimestamp = data.order.order_id;
            // Extract our original UUID: ORDER_uuid_timestamp
            const internalOrderId = orderIdWithTimestamp.split('_')[1];

            console.log(`Webhook received for Order: ${internalOrderId}, Status: PAID`);

            const { error: updateError } = await supabaseAdmin
                .from("orders")
                .update({
                    payment_status: "paid",
                    status: "queued",
                    transaction_id: data.payment.cf_payment_id.toString(),
                    payment_method: "gateway"
                })
                .eq("id", internalOrderId);

            if (updateError) {
                console.error("Database Update Failed:", updateError);
                return NextResponse.json({ error: "DB Update Failed" }, { status: 500 });
            }
        }

        return NextResponse.json({ status: "success" });

    } catch (err: any) {
        console.error("Webhook Error:", err.message);
        return NextResponse.json({ error: "Webhook Processing Failed" }, { status: 500 });
    }
}
