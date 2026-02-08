"use client";

import { motion } from "framer-motion";
import {
    CheckCircle2,
    Copy,
    Image as ImageIcon,
    Loader2,
    Smartphone,
    AlertCircle,
    Hourglass,
    ShieldCheck,
    CreditCard
} from "lucide-react";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { cn, compressImage } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";

interface PaymentViewProps {
    orderId: string;
    amount: number;
    vpa: string;
    onSuccess: () => void;
    customerName?: string;
    customerEmail?: string;
}

declare global {
    interface Window {
        Razorpay: any;
    }
}

export function PaymentView({ orderId, amount, vpa, onSuccess, customerName, customerEmail }: PaymentViewProps) {
    const [status, setStatus] = useState<'pay' | 'processing' | 'verifying' | 'success' | 'error'>('pay');
    const [error, setError] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'manual'>('razorpay');

    const isVpaValid = vpa && vpa !== "shop@upi" && vpa !== "";
    const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Load Razorpay script
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        return () => {
            document.body.removeChild(script);
        };
    }, []);

    // Dynamic UPI Link for QR/Mobile Apps (manual mode)
    const upiLink = isVpaValid
        ? `upi://pay?pa=${vpa}&pn=SolvePrint&am=${amount}&tr=${orderId}&cu=INR&tn=Order_${orderId.slice(0, 5)}`
        : null;

    const handleRazorpayPayment = async () => {
        setError(null);
        setStatus('processing');

        try {
            // 1. Create Razorpay order
            const response = await fetch('/api/payments/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    orderId,
                    customerName: customerName || 'Guest',
                    customerEmail: customerEmail || '',
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to create payment order');
            }

            // 2. Open Razorpay checkout
            const options = {
                key: razorpayKeyId,
                amount: data.order.amount,
                currency: data.order.currency,
                name: 'Ridha Printers',
                description: `Print Order #${orderId.slice(0, 8)}`,
                order_id: data.order.id,
                prefill: {
                    name: customerName || '',
                    email: customerEmail || '',
                },
                theme: {
                    color: '#2563eb',
                },
                modal: {
                    ondismiss: () => {
                        setStatus('pay');
                    },
                },
                handler: async function (response: any) {
                    setStatus('verifying');

                    // 3. Verify payment on backend
                    try {
                        const verifyResponse = await fetch('/api/payments/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                order_id: orderId,
                            }),
                        });

                        const verifyData = await verifyResponse.json();

                        if (verifyData.success) {
                            setStatus('success');
                            setTimeout(onSuccess, 2000);
                        } else {
                            throw new Error(verifyData.error || 'Payment verification failed');
                        }
                    } catch (err: any) {
                        setError(err.message);
                        setStatus('error');
                    }
                },
            };

            const razorpay = new window.Razorpay(options);
            razorpay.open();
            setStatus('pay');

        } catch (err: any) {
            console.error('Razorpay error:', err);
            setError(err.message || 'Payment initialization failed');
            setStatus('pay');
        }
    };

    const handleCopyVpa = () => {
        if (!isVpaValid) {
            alert("Shop UPI not configured yet!");
            return;
        }
        navigator.clipboard.writeText(vpa);
        alert("VPA Copied!");
    };

    const handleScreenshotUpload = async (file: File) => {
        setError(null);
        try {
            setStatus('verifying');

            const compressedBlob = await compressImage(file, 0.6);
            const fileName = `${orderId}_${Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('payments')
                .upload(fileName, compressedBlob, {
                    contentType: 'image/jpeg',
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    payment_status: 'waiting',
                    status: 'pending_verification',
                    payment_screenshot: fileName
                })
                .eq('id', orderId);

            if (updateError) throw new Error(`Order update failed: ${updateError.message}`);

            setStatus('success');
            setTimeout(onSuccess, 2000);

        } catch (err: any) {
            console.error("Screenshot upload error:", err);
            setError(err.message || "Something went wrong. Please try again.");
            setStatus('pay');
        }
    };

    if (status === 'success') {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <CheckCircle2 size={48} />
                </div>
                <h3 className="font-display text-2xl font-bold text-slate-900">Payment Successful!</h3>
                <p className="text-slate-500 font-medium px-6">
                    Your document is now in the print queue. You'll be notified when it's ready!
                </p>
            </div>
        );
    }

    if (status === 'processing' || status === 'verifying') {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                <Loader2 className="animate-spin text-blue-600" size={48} />
                <h3 className="font-display text-xl font-bold text-slate-900">
                    {status === 'processing' ? 'Initializing Payment...' : 'Verifying Payment...'}
                </h3>
                <p className="text-slate-500 font-medium px-6">
                    Please wait, do not close this window.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Amount Display */}
            <div className="bg-blue-600 text-white p-8 rounded-[32px] text-center shadow-xl shadow-blue-200">
                <p className="text-xs font-bold uppercase tracking-widest mb-1 text-blue-100">Total Amount</p>
                <p className="text-4xl font-black tracking-tight">₹{amount.toFixed(2)}</p>
            </div>

            {/* Payment Method Toggle */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                <button
                    onClick={() => setPaymentMethod('razorpay')}
                    className={cn(
                        "flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                        paymentMethod === 'razorpay'
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <CreditCard size={16} />
                    Pay Now (Auto)
                </button>
                <button
                    onClick={() => setPaymentMethod('manual')}
                    className={cn(
                        "flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                        paymentMethod === 'manual'
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <ShieldCheck size={16} />
                    Manual Upload
                </button>
            </div>

            {paymentMethod === 'razorpay' ? (
                /* Razorpay Payment */
                <div className="space-y-4">
                    <button
                        onClick={handleRazorpayPayment}
                        disabled={status === 'processing'}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all text-sm disabled:opacity-50"
                    >
                        <Smartphone size={20} />
                        Pay ₹{amount.toFixed(2)} via UPI
                    </button>
                    <p className="text-[10px] text-slate-400 font-medium text-center">
                        Pay securely with GPay, PhonePe, Paytm, or any UPI app. <br />
                        Auto-verified – no screenshot needed!
                    </p>
                </div>
            ) : (
                /* Manual Payment */
                <div className="space-y-4">
                    {isVpaValid && (
                        <>
                            <div className="flex flex-col items-center gap-4 py-4">
                                <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
                                    <QRCodeSVG value={upiLink || ""} size={160} level="H" />
                                </div>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                    Scan with GPay, PhonePe, or Paytm
                                </p>
                            </div>

                            <div className="space-y-3">
                                <a
                                    href={upiLink || "#"}
                                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all text-sm"
                                >
                                    <Smartphone size={20} />
                                    Pay via UPI App
                                </a>

                                <button
                                    onClick={handleCopyVpa}
                                    className="text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center justify-center gap-1 mx-auto"
                                >
                                    <Copy size={12} />
                                    Copy VPA: {vpa}
                                </button>
                            </div>
                        </>
                    )}

                    <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                        <ShieldCheck className="text-blue-600" size={24} />
                        <div className="flex-1 text-left">
                            <p className="text-sm font-bold">Manual Verification</p>
                            <p className="text-[10px] text-slate-500 font-medium leading-tight">Pay, take a screenshot, and upload it below for approval.</p>
                        </div>
                    </div>

                    <div className="relative">
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            id="payment-upload"
                            onChange={(e) => e.target.files?.[0] && handleScreenshotUpload(e.target.files[0])}
                        />
                        <label
                            htmlFor="payment-upload"
                            className="w-full p-4 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 cursor-pointer transition-all bg-white border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 font-bold text-sm shadow-sm"
                        >
                            <ImageIcon size={20} />
                            Upload Payment Screenshot
                        </label>
                    </div>
                </div>
            )}

            {error && (
                <p className="text-xs text-red-500 font-bold text-center bg-red-50 p-3 rounded-xl border border-red-100 italic">
                    "{error}"
                </p>
            )}
        </div>
    );
}
