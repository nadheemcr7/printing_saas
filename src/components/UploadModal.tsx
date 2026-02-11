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
import { cn, generatePickupCode, calculatePrintCost, getDocumentPageCount, formatCurrency, parsePageRange } from "@/lib/utils";
import { PaymentView } from "./PaymentView";

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    profile?: any;
    resumeOrder?: any;
}

export function UploadModal({ isOpen, onClose, userId, profile, resumeOrder }: UploadModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'analyzing' | 'uploading' | 'payment' | 'success' | 'error'>('idle');
    const [analysis, setAnalysis] = useState<any>(null);
    const [order, setOrder] = useState<any>(null);
    const [vpa, setVpa] = useState<string>("shop@upi");
    const [pricingRules, setPricingRules] = useState<any>(null);
    const [printType, setPrintType] = useState<'BW' | 'COLOR'>('BW');
    const [sideType, setSideType] = useState<'SINGLE' | 'DOUBLE'>('SINGLE');
    const [error, setError] = useState<string | null>(null);
    const [localPages, setLocalPages] = useState<number>(0);
    const [pageRange, setPageRange] = useState<string>("All");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        // Only fetch and subscribe when modal is open
        if (!isOpen) return;

        // Fetch Owner's UPI VPA and Rates
        const fetchSettings = async () => {
            const { data: shopData } = await supabase
                .from("shop_settings")
                .select("*")
                .limit(1)
                .single();

            if (shopData) {
                const s = shopData;
                const activeVpa = s.active_vpa_type === 'primary' ? s.primary_vpa : s.backup_vpa;
                if (activeVpa) setVpa(activeVpa);
            } else {
                // Fallback to any owner's VPA from profiles
                const { data: profileData } = await supabase
                    .from("profiles")
                    .select("vpa")
                    .eq("role", "owner")
                    .limit(1);

                if (profileData && profileData[0]?.vpa) setVpa(profileData[0].vpa);
            }

            // Fetch pricing from pricing_config
            const { data: pConfig } = await supabase
                .from("pricing_config")
                .select("*")
                .order('priority', { ascending: true });

            if (pConfig && pConfig.length > 0) {
                const rules: any = { bw: { single: {}, double: {} }, color: { single: {}, double: {} } };
                pConfig.forEach((row: any) => {
                    const type = row.print_type.toLowerCase();
                    const side = row.side_type.toLowerCase();
                    if (!rules[type]) rules[type] = {};
                    if (!rules[type][side]) rules[type][side] = {};

                    if (row.priority === 1) {
                        rules[type][side].basePrice = Number(row.rate);
                        rules[type][side].baseLimit = row.tier_limit || 0;
                    } else if (row.priority === 2) {
                        rules[type][side].extraPrice = Number(row.rate);
                    }
                });
                setPricingRules(rules);
            }
        };

        fetchSettings();

        // Realtime sync for shop info (only when modal is open)
        const channel = supabase
            .channel("modal_settings_sync")
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shop_settings" }, (payload) => {
                const s = payload.new as any;
                const activeVpa = s.active_vpa_type === 'primary' ? s.primary_vpa : s.backup_vpa;
                if (activeVpa) setVpa(activeVpa);
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "pricing_config" }, () => {
                fetchSettings(); // Refresh all pricing on any change
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, isOpen]);

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

            // Early server-side scan for instant feedback
            const formData = new FormData();
            formData.append('file', selectedFile);

            try {
                const res = await fetch('/api/analyze-pdf', {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) throw new Error('Analysis failed');

                const data = await res.json();
                console.log("Analysis Result:", data);
                if (data.pages) {
                    setLocalPages(data.pages);
                    setPageRange("All"); // Reset to 'All' to show correct total initially
                }
            } catch (err) {
                console.error("Server analysis failed", err);
                setLocalPages(1);
            }

            // Create preview URL
            const url = URL.createObjectURL(selectedFile);
            setPreviewUrl(url);
        }
    }, []);

    const activePageCount = parsePageRange(pageRange, localPages);
    const estimatedCost = calculatePrintCost(activePageCount, printType, sideType, pricingRules);

    // Cleanup preview URL
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        },
        maxSize: 25 * 1024 * 1024,
        multiple: false
    });

    const handleProcess = async () => {
        if (!file) return;
        if (!userId) {
            setError("You must be logged in to upload documents.");
            setStatus('error');
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout

        try {
            setStatus('analyzing');
            console.log("Step 1: Analyzing document...", file.name, file.size);

            let finalLocalPageCount = localPages || 1;

            if (!localPages) {
                try {
                    finalLocalPageCount = await getDocumentPageCount(file);
                } catch (pe) {
                    console.warn("Fallback page count failure:", pe);
                    finalLocalPageCount = 1;
                }
            }
            console.log("Step 1 Success: Pages =", finalLocalPageCount);

            const finalPageCount = parsePageRange(pageRange, finalLocalPageCount);
            const totalCost = calculatePrintCost(finalPageCount, printType, sideType, pricingRules);
            console.log("Step 2: Calculated Cost =", totalCost);

            setStatus('uploading');
            console.log("Step 3: Uploading to Storage...", file.size, "bytes");

            const blob = new Blob([file], { type: file.type || 'application/octet-stream' });
            const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            const filePath = `${userId}/${Date.now()}_${cleanFileName}`;

            console.log("Uploading to path:", filePath, "Type:", file.type);

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, blob, {
                    contentType: file.type || 'application/octet-stream',
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error("Storage Error:", uploadError);
                throw new Error(uploadError.message || "Failed to save file to cloud.");
            }
            console.log("Step 3 Success: File Path =", filePath);

            console.log("Step 4: Creating database record...");
            const pickupCode = generatePickupCode();
            const { data: newOrder, error: orderError } = await supabase
                .from('orders')
                .insert({
                    customer_id: userId,
                    pickup_code: pickupCode,
                    status: 'pending_payment',
                    total_pages: finalPageCount,
                    estimated_cost: totalCost,
                    payment_status: 'unpaid',
                    file_path: filePath,
                    print_type: printType,
                    side_type: sideType,
                    page_range: pageRange
                })
                .select()
                .single();

            if (orderError) {
                console.error("Database Error:", orderError);
                throw new Error(orderError.message || "Failed to create order record.");
            }

            console.log("Step 4 Success: Order ID =", newOrder.id);
            clearTimeout(timeoutId);
            setOrder(newOrder);
            setStatus('payment');

        } catch (err: any) {
            clearTimeout(timeoutId);
            console.error("Submission failed:", err);
            if (err.name === 'AbortError') {
                setError("Upload timed out. Please check your internet connection and try again.");
            } else {
                setError(err.message || "An unexpected error occurred. Please try again.");
            }
            setStatus('error');
        }
    };

    const reset = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setFile(null);
        setAnalysis(null);
        setOrder(null);
        setStatus('idle');
        setError(null);
        setPageRange("All");
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
                                            <p className="font-bold text-slate-900">Tap to upload PDF or Word document</p>
                                            <p className="text-sm text-slate-500 mt-1">Maximum file size: 25MB</p>
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
                                                        <p className="text-xs text-blue-600 font-bold">{activePageCount} of {localPages} Pages</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-slate-900">{formatCurrency(estimatedCost)}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Est. Cost</p>
                                                </div>
                                                <button onClick={() => { setFile(null); setPreviewUrl(null); }} className="text-slate-400 hover:text-red-500">
                                                    <X size={20} />
                                                </button>
                                            </div>

                                            {previewUrl && (
                                                <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden h-40 relative group">
                                                    {file.name.toLowerCase().endsWith('.pdf') ? (
                                                        <iframe
                                                            src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                                            className="w-full h-full border-none"
                                                            title="PDF Preview"
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                                            <FileText size={48} className="mb-2" />
                                                            <p className="text-sm font-bold">Word Preview Not Available</p>
                                                            <p className="text-[10px]">Document will be printed as uploaded.</p>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent flex items-end p-4">
                                                        <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-slate-900/40 backdrop-blur-md px-2 py-1 rounded">Quick Preview</span>
                                                    </div>
                                                </div>
                                            )}

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

                                            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Select Pages to Print</label>
                                                    <span className="text-[10px] font-bold text-blue-400">Example: 1-5 or 1,3,7</span>
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={pageRange}
                                                        onChange={(e) => setPageRange(e.target.value)}
                                                        placeholder="Enter pages (e.g. 5-10) or 'All'"
                                                        className="w-full bg-white border border-blue-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-300"
                                                    />
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
                                    <button
                                        onClick={() => { reset(); setStatus('idle'); }}
                                        className="text-sm text-slate-400 hover:text-red-500 font-bold mt-4 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : status === 'payment' ? (
                                <PaymentView
                                    orderId={order.id}
                                    amount={order.estimated_cost}
                                    vpa={vpa}
                                    customerName={profile?.full_name || 'Guest'}
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
