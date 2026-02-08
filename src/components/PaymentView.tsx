"use client";

import { motion } from "framer-motion";
import {
    CheckCircle2,
    Copy,
    ExternalLink,
    Image as ImageIcon,
    Loader2,
    QrCode,
    ShieldCheck,
    Smartphone,
    AlertCircle,
    Hourglass,
    Zap
} from "lucide-react";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { load } from "@cashfreepayments/cashfree-js";

interface PaymentViewProps {
    orderId: string;
    amount: number;
    vpa: string;
    onSuccess: () => void;
    customerProfile?: any;
}

export function PaymentView({ orderId, amount, vpa, onSuccess, customerProfile }: PaymentViewProps) {
    const [status, setStatus] = useState<'pay' | 'verifying' | 'success' | 'error' | 'gateway_loading'>('pay');
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cashfree, setCashfree] = useState<any>(null);

    const isVpaValid = vpa && vpa !== "shop@upi" && vpa !== "";

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Initialize Cashfree SDK
    useEffect(() => {
        const initCashfree = async () => {
            const cf = await load({
                mode: (process.env.NEXT_PUBLIC_CASHFREE_MODE as "sandbox" | "production") || "sandbox"
            });
            setCashfree(cf);
        };
        initCashfree();
    }, []);

    // Dynamic UPI Link for QR/Mobile Apps
    const upiLink = isVpaValid
        ? `upi://pay?pa=${vpa}&pn=SolvePrint&am=${amount}&tr=${orderId}&cu=INR&tn=PrintOrder_${orderId.slice(0, 5)}`
        : null;

    const handleCopyVpa = () => {
        if (!isVpaValid) {
            alert("Shop UPI not configured yet!");
            return;
        }
        navigator.clipboard.writeText(vpa);
        alert("UPI ID Copied!");
    };

    const handleGatewayPayment = async () => {
        try {
            setStatus('gateway_loading');
            setError(null);

            // 1. Create Order on our Server
            const res = await fetch("/api/payment/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId,
                    amount,
                    customerName: customerProfile?.full_name,
                    customerPhone: customerProfile?.phone || "9999999999",
                    customerEmail: customerProfile?.email || "customer@example.com"
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to initiate payment");

            // 2. Open Cashfree Checkout
            if (cashfree) {
                await cashfree.checkout({
                    paymentSessionId: data.payment_session_id,
                    returnUrl: window.location.href,
                });
            }
        } catch (err: any) {
            console.error("Gateway Error:", err);
            setError(err.message || "Something went wrong. Please try manual upload.");
            setStatus('pay');
        }
    };

    const handleScreenshotUpload = async (file: File) => {
        console.log("Starting screenshot upload...", { orderId, fileName: file.name, fileSize: file.size });
        setError(null);

        try {
            setStatus('verifying');

            // 1. Upload Screenshot to Storage
            const filePath = `${orderId}_${Date.now()}.png`;
            console.log("Uploading to path:", filePath);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('screenshots')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            console.log("Upload result:", { uploadData, uploadError });

            if (uploadError) {
                console.error("Upload failed:", uploadError);
                throw new Error(`Upload failed: ${uploadError.message}`);
            }

            // 2. Update Order Status (Manual Verification)
            console.log("Updating order status...");
            const { data: updateData, error: updateError } = await supabase
                .from('orders')
                .update({
                    payment_status: 'waiting',
                    status: 'awaiting_verification',
                    payment_screenshot_url: filePath
                })
                .eq('id', orderId)
                .select();

            console.log("Update result:", { updateData, updateError });

            if (updateError) {
                console.error("Order update failed:", updateError);
                throw new Error(`Order update failed: ${updateError.message}`);
            }

            console.log("Success! Setting status to success");
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
                    <Hourglass className="animate-pulse" size={48} />
                </div>
                <h3 className="font-display text-2xl font-bold">Screenshot Uploaded!</h3>
                <p className="text-slate-500 font-medium px-6">
                    Waiting for the Shop Owner to verify your payment. Your document will join the queue once confirmed.
                </p>
            </div>
        );
    }

    if (status === 'verifying' || status === 'gateway_loading') {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                <Loader2 className="animate-spin text-blue-600" size={48} />
                <h3 className="font-display text-xl font-bold">
                    {status === 'verifying' ? "Uploading Screenshot..." : "Connecting to Gateway..."}
                </h3>
                <p className="text-slate-500 font-medium px-6">
                    Please wait while we process your payment.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Automated Payment Button (Recommended) */}
            <button
                onClick={handleGatewayPayment}
                className="w-full bg-slate-900 text-white p-5 rounded-3xl flex items-center justify-between group hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
                        <Zap size={24} className="text-white fill-white" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-lg">Instant Approval</p>
                        <p className="text-xs text-slate-400">Pay using UPI/Cards for zero wait time</p>
                    </div>
                </div>
                <div className="bg-emerald-500 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">Fastest</div>
            </button>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-100" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-4 text-slate-400 font-bold tracking-widest">or pay manually</span>
                </div>
            </div>

            <div className={cn(
                "p-8 rounded-[32px] text-center space-y-6 shadow-xl transition-all",
                isVpaValid ? "bg-blue-600 text-white shadow-blue-200" : "bg-slate-100 text-slate-400 shadow-none border border-slate-200"
            )}>
                <div>
                    <p className={cn("text-xs font-bold uppercase tracking-widest mb-1", isVpaValid ? "text-blue-100" : "text-slate-400")}>Total Amount</p>
                    <p className={cn("text-4xl font-black tracking-tight", isVpaValid ? "text-white" : "text-slate-300")}>₹{amount.toFixed(2)}</p>
                </div>

                {/* Mobile Pay Button */}
                <div className="space-y-3">
                    {isVpaValid ? (
                        <>
                            <a
                                href={upiLink || "#"}
                                className="w-full bg-white text-blue-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all text-sm"
                            >
                                <Smartphone size={20} />
                                Pay via UPI App
                            </a>

                            <button
                                onClick={handleCopyVpa}
                                className="text-xs font-bold text-blue-100 hover:text-white flex items-center justify-center gap-1 mx-auto"
                            >
                                <Copy size={12} />
                                Copy UPI ID: {vpa}
                            </button>
                        </>
                    ) : (
                        <div className="py-4 space-y-2">
                            <AlertCircle className="mx-auto text-slate-300" size={32} />
                            <p className="text-sm font-bold text-slate-400 italic">Payments not set up by Shop Owner</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Desktop Fallback (QR) */}
            {isVpaValid && (
                <div className="flex flex-col items-center gap-4 py-4">
                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
                        <QRCodeSVG value={upiLink || ""} size={160} level="H" />
                    </div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        Scan QR with any UPI App
                    </p>
                </div>
            )}

            <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <ShieldCheck className="text-blue-600" size={24} />
                    <div className="flex-1">
                        <p className="text-sm font-bold">Manual Verification</p>
                        <p className="text-[10px] text-slate-500 font-medium">Pay & upload screenshot. Owner will confirm in seconds.</p>
                    </div>
                </div>

                <div className="relative">
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="screenshot-upload"
                        onChange={(e) => e.target.files?.[0] && handleScreenshotUpload(e.target.files[0])}
                    />
                    <label
                        htmlFor="screenshot-upload"
                        className="w-full p-4 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 cursor-pointer transition-all bg-white border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 font-bold text-sm"
                    >
                        <ImageIcon size={20} />
                        Upload Payment Screenshot
                    </label>
                </div>

                {error && (
                    <p className="text-xs text-red-500 font-bold text-center bg-red-50 p-3 rounded-xl border border-red-100 italic">
                        "{error}"
                    </p>
                )}
            </div>
        </div>
    );
}
