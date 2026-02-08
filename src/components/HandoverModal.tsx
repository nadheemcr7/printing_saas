"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    CheckCircle2,
    AlertCircle,
    Handshake,
    Loader2,
    SearchCode
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { cn } from "@/lib/utils";

interface HandoverModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function HandoverModal({ isOpen, onClose }: HandoverModalProps) {
    const [code, setCode] = useState("");
    const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState("");

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length < 3) return;

        setStatus('verifying');
        setMessage("");

        try {
            const { data, error } = await supabase.rpc('verify_pickup_code', {
                p_pickup_code: code
            });

            if (error) throw error;

            // Handle both array and single object based on PostgREST version
            const result = Array.isArray(data) ? data[0] : data;

            if (result && result.success) {
                setStatus('success');
                setTimeout(() => {
                    handleClose();
                }, 2000);
            } else {
                setStatus('error');
                setMessage(result.message);
            }
        } catch (err: any) {
            setStatus('error');
            setMessage(err.message || "Verification failed");
        }
    };

    const handleClose = () => {
        setCode("");
        setStatus('idle');
        setMessage("");
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl relative z-10"
                    >
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold font-display flex items-center gap-2">
                                    <Handshake className="text-blue-600" size={24} />
                                    Order Handover
                                </h2>
                                <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors font-bold">
                                    <X size={20} />
                                </button>
                            </div>

                            {status === 'success' ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                                        <CheckCircle2 size={48} />
                                    </div>
                                    <h3 className="text-2xl font-bold">Success!</h3>
                                    <p className="text-slate-500 font-medium">Order marked as completed.</p>
                                </div>
                            ) : (
                                <form onSubmit={handleVerify} className="space-y-6">
                                    <p className="text-sm text-slate-500">
                                        Ask the student for their 3-digit pickup code to confirm the handover.
                                    </p>

                                    <div className="relative">
                                        <input
                                            type="text"
                                            maxLength={3}
                                            placeholder="Enter 3-digit Code"
                                            autoFocus
                                            value={code}
                                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                            className={cn(
                                                "w-full text-4xl font-black text-center tracking-[1em] pl-[0.5em] py-6 rounded-2xl border-2 outline-none transition-all",
                                                status === 'error' ? "border-red-200 bg-red-50 text-red-600" : "border-slate-100 bg-slate-50 focus:border-blue-600 focus:bg-white"
                                            )}
                                        />
                                        {status === 'verifying' && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-2xl">
                                                <Loader2 className="animate-spin text-blue-600" size={32} />
                                            </div>
                                        )}
                                    </div>

                                    {status === 'error' && (
                                        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl text-xs font-bold ring-1 ring-red-100">
                                            <AlertCircle size={14} />
                                            {message}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={code.length < 3 || status === 'verifying'}
                                        className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all"
                                    >
                                        <SearchCode size={20} />
                                        Verify & Complete
                                    </button>
                                </form>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
