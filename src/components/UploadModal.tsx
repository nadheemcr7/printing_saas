"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
    Upload,
    FileText,
    X,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Sparkles,
    ArrowRight
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { cn, generatePickupCode, calculatePrintCost, getPdfPageCount, formatCurrency } from "@/lib/utils";
import { PaymentView } from "./PaymentView";

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    resumeOrder?: any;
}

export function UploadModal({ isOpen, onClose, userId, resumeOrder }: UploadModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'analyzing' | 'uploading' | 'payment' | 'success' | 'error'>('idle');
    const [analysis, setAnalysis] = useState<any>(null);
    const [order, setOrder] = useState<any>(null);
    const [vpa, setVpa] = useState<string>("shop@upi"); // Default fallback
    const [rate, setRate] = useState<number>(2.00); // Default fallback ₹2
    const [printType, setPrintType] = useState<'BW' | 'COLOR'>('BW');
    const [sideType, setSideType] = useState<'SINGLE' | 'DOUBLE'>('SINGLE');
    const [error, setError] = useState<string | null>(null);
    const [localPages, setLocalPages] = useState<number>(0);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        // Fetch Owner's UPI VPA and Rates
        const fetchSettings = async () => {
            // 1. Try fetching from shop_settings first (Official Source)
            const { data: shopData } = await supabase
                .from("shop_settings")
                .select("primary_vpa, backup_vpa, active_vpa_type")
                .limit(1);

            if (shopData && shopData[0]) {
                const s = shopData[0];
                const activeVpa = s.active_vpa_type === 'primary' ? s.primary_vpa : s.backup_vpa;
                if (activeVpa) {
                    setVpa(activeVpa);
                }
            } else {
                // 2. Fallback to any owner's VPA from profiles
                const { data: profileData } = await supabase
                    .from("profiles")
                    .select("vpa")
                    .eq("role", "owner")
                    .limit(1);

                if (profileData && profileData[0]?.vpa) setVpa(profileData[0].vpa);
            }

            const { data: pricingData } = await supabase
                .from("pricing_config")
                .select("rate_per_page")
                .limit(1);

            if (pricingData && pricingData[0]?.rate_per_page) setRate(Number(pricingData[0].rate_per_page));
        };

        fetchSettings();
    }, [supabase]);

    useEffect(() => {
        if (isOpen && resumeOrder) {
            setOrder(resumeOrder);
            setStatus('payment');
        }
    }, [isOpen, resumeOrder]);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles[0]) {
            const selectedFile = acceptedFiles[0];
            setFile(selectedFile);
            setStatus('idle');
            setError(null);

            // Early local scan for instant feedback
            const pages = await getPdfPageCount(selectedFile);
            setLocalPages(pages);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: false
    });

    const handleProcess = async () => {
        if (!file) return;

        try {
            setStatus('uploading');

            // 1. LOCAL SCAN (Instant & Reliable)
            const localPageCount = await getPdfPageCount(file);
            console.log("Local Page Count:", localPageCount);

            // Calculate cost
            const totalCost = calculatePrintCost(localPageCount, printType, sideType);

            setStatus('uploading');

            // 2. Upload to Storage
            const filePath = `${userId}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 3. Create Order
            const pickupCode = generatePickupCode();
            const { data: newOrder, error: orderError } = await supabase
                .from('orders')
                .insert({
                    customer_id: userId,
                    pickup_code: pickupCode,
                    status: 'pending_payment',
                    total_pages: localPageCount,
                    estimated_cost: totalCost,
                    payment_status: 'unpaid',
                    file_path: filePath
                })
                .select()
                .single();

            if (orderError) throw orderError;
            setOrder(newOrder);
            setStatus('payment');

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Something went wrong");
            setStatus('error');
        }
    };

    const reset = () => {
        setFile(null);
        setAnalysis(null);
        setOrder(null);
        setStatus('idle');
        setError(null);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    <motion.div
                        layout
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl relative z-10"
                    >
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-bold font-display">
                                    {status === 'payment' ? "Final Step: Payment" : "Upload Document"}
                                </h2>
                                <button onClick={() => { onClose(); reset(); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {status === 'idle' || status === 'error' ? (
                                <div className="space-y-6">
                                    {!file ? (
                                        <div
                                            {...getRootProps()}
                                            className={cn(
                                                "border-4 border-dashed rounded-[24px] p-12 text-center transition-all cursor-pointer",
                                                isDragActive ? "border-blue-600 bg-blue-50" : "border-slate-100 bg-slate-50 hover:border-slate-200"
                                            )}
                                        >
                                            <input {...getInputProps()} />
                                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                                <Upload className="text-blue-600" size={32} />
                                            </div>
                                            <p className="font-bold text-slate-900">Tap to upload PDF</p>
                                            <p className="text-sm text-slate-500 mt-1">Maximum file size 10MB</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex items-center gap-4">
                                                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                                                    <FileText size={24} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-900 truncate">{file.name}</p>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs text-slate-500 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                        <span className="text-slate-300">•</span>
                                                        <p className="text-xs text-blue-600 font-bold">{localPages} Pages</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-slate-900">{formatCurrency(calculatePrintCost(localPages, printType, sideType))}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Est. Cost</p>
                                                </div>
                                                <button onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500">
                                                    <X size={20} />
                                                </button>
                                            </div>

                                            {/* Selection UI */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Print Color</label>
                                                    <div className="bg-slate-100 p-1 rounded-2xl flex gap-1">
                                                        <button
                                                            onClick={() => setPrintType('BW')}
                                                            className={cn("flex-1 py-2 rounded-xl text-xs font-bold transition-all", printType === 'BW' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                                                        >B/W</button>
                                                        <button
                                                            onClick={() => setPrintType('COLOR')}
                                                            className={cn("flex-1 py-2 rounded-xl text-xs font-bold transition-all", printType === 'COLOR' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                                                        >Color</button>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Side Type</label>
                                                    <div className="bg-slate-100 p-1 rounded-2xl flex gap-1">
                                                        <button
                                                            onClick={() => setSideType('SINGLE')}
                                                            className={cn("flex-1 py-2 rounded-xl text-xs font-bold transition-all", sideType === 'SINGLE' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                                                        >Single</button>
                                                        <button
                                                            onClick={() => setSideType('DOUBLE')}
                                                            className={cn("flex-1 py-2 rounded-xl text-xs font-bold transition-all", sideType === 'DOUBLE' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                                                        >Double</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {error && (
                                        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-2xl text-sm font-bold">
                                            <AlertCircle size={18} />
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        disabled={!file}
                                        onClick={handleProcess}
                                        className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2 mt-4 hover:bg-blue-700 transition-colors"
                                    >
                                        Continue <ArrowRight size={20} />
                                    </button>
                                </div>
                            ) : status === 'analyzing' || status === 'uploading' ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
                                    <div className="relative">
                                        <Loader2 className="animate-spin text-blue-600" size={64} />
                                        <motion.div
                                            animate={{ opacity: [0, 1, 0] }}
                                            transition={{ repeat: Infinity, duration: 2 }}
                                            className="absolute inset-0 flex items-center justify-center"
                                        >
                                            <Sparkles className="text-blue-400" size={24} />
                                        </motion.div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xl font-bold font-display text-slate-900">
                                            {status === 'analyzing' ? "Preparing document..." : "Saving to cloud..."}
                                        </p>
                                        <p className="text-slate-500 font-medium px-8">
                                            {status === 'analyzing'
                                                ? "Almost ready! Finalizing your print options."
                                                : "Uploading your file safely to the shop queue."}
                                        </p>
                                    </div>
                                </div>
                            ) : status === 'payment' ? (
                                <PaymentView
                                    orderId={order.id}
                                    amount={order.estimated_cost}
                                    vpa={vpa}
                                    onSuccess={() => {
                                        setStatus('success');
                                        setTimeout(() => { onClose(); reset(); }, 2000);
                                    }}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                                        <CheckCircle2 size={48} />
                                    </div>
                                    <h3 className="text-2xl font-bold">In the Queue!</h3>
                                    <p className="text-slate-500">Redirecting to your dashboard...</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
