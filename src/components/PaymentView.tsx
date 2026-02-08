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
    ShieldCheck
} from "lucide-react";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { cn, compressImage } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";

interface PaymentViewProps {
    orderId: string;
    amount: number;
    vpa: string;
    onSuccess: () => void;
}

export function PaymentView({ orderId, amount, vpa, onSuccess }: PaymentViewProps) {
    const [status, setStatus] = useState<'pay' | 'verifying' | 'success' | 'error'>('pay');
    const [error, setError] = useState<string | null>(null);

    const isVpaValid = vpa && vpa !== "shop@upi" && vpa !== "";

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Dynamic UPI Link for QR/Mobile Apps
    const upiLink = isVpaValid
        ? `upi://pay?pa=${vpa}&pn=SolvePrint&am=${amount}&tr=${orderId}&cu=INR&tn=Order_${orderId.slice(0, 5)}`
        : null;

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

            // 1. Compress Image (Reduces 5MB -> ~200KB)
            const compressedBlob = await compressImage(file, 0.6);
            const fileName = `${orderId}_${Date.now()}.jpg`;

            // 2. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('screenshots')
                .upload(fileName, compressedBlob, {
                    contentType: 'image/jpeg',
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

            // 3. Update Order Status
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
                    <Hourglass className="animate-pulse" size={48} />
                </div>
                <h3 className="font-display text-2xl font-bold text-slate-900">Screenshot Uploaded!</h3>
                <p className="text-slate-500 font-medium px-6">
                    Waiting for Shop Owner to verify. Your document will join the queue once confirmed.
                </p>
            </div>
        );
    }

    if (status === 'verifying') {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                <Loader2 className="animate-spin text-blue-600" size={48} />
                <h3 className="font-display text-xl font-bold text-slate-900">Uploading Payment Proof...</h3>
                <p className="text-slate-500 font-medium px-6">
                    Please wait while we process your screenshot.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className={cn(
                "p-8 rounded-[32px] text-center space-y-6 shadow-xl transition-all",
                isVpaValid ? "bg-blue-600 text-white shadow-blue-200" : "bg-slate-100 text-slate-400 shadow-none border border-slate-200"
            )}>
                <div>
                    <p className={cn("text-xs font-bold uppercase tracking-widest mb-1", isVpaValid ? "text-blue-100" : "text-slate-400")}>Total Amount</p>
                    <p className={cn("text-4xl font-black tracking-tight", isVpaValid ? "text-white" : "text-slate-300")}>₹{amount.toFixed(2)}</p>
                </div>

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
                                Copy VPA: {vpa}
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

            {isVpaValid && (
                <div className="flex flex-col items-center gap-4 py-4">
                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
                        <QRCodeSVG value={upiLink || ""} size={160} level="H" />
                    </div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                        Scan with GPay, PhonePe, or Paytm
                    </p>
                </div>
            )}

            <div className="space-y-4">
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

                {error && (
                    <p className="text-xs text-red-500 font-bold text-center bg-red-50 p-3 rounded-xl border border-red-100 italic">
                        "{error}"
                    </p>
                )}
            </div>
        </div>
    );
}
