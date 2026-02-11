"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import {
    Store,
    CreditCard,
    Tag,
    Smartphone,
    ShieldCheck,
    Save,
    Loader2,
    AlertCircle,
    ChevronLeft,
    Power,
    DollarSign
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function OwnerSettingsPage() {
    const { supabase, user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [settings, setSettings] = useState({
        shop_name: "RIDHA PRINTERS",
        is_open: true,
        primary_vpa: "",
        backup_vpa: "",
        active_vpa_type: "primary"
    });

    useEffect(() => {
        if (!user) return;

        const loadSettings = async () => {
            const { data } = await supabase
                .from("shop_settings")
                .select("*")
                .eq("owner_id", user.id)
                .single();

            if (data) {
                setSettings({
                    shop_name: data.shop_name,
                    is_open: data.is_open,
                    primary_vpa: data.primary_vpa || "",
                    backup_vpa: data.backup_vpa || "",
                    active_vpa_type: data.active_vpa_type
                });
            } else {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("vpa")
                    .eq("id", user.id)
                    .single();

                if (profile?.vpa) {
                    setSettings(prev => ({ ...prev, primary_vpa: profile.vpa }));
                }
            }
            setLoading(false);
        };

        loadSettings();
    }, [supabase, user]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        setError(null);
        setSuccess(false);

        try {
            const { error: upsertError } = await supabase
                .from("shop_settings")
                .upsert({
                    owner_id: user.id,
                    ...settings,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'owner_id' });

            if (upsertError) throw upsertError;

            await supabase
                .from("profiles")
                .update({ vpa: settings.active_vpa_type === 'primary' ? settings.primary_vpa : settings.backup_vpa })
                .eq("id", user.id);

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-2xl mx-auto w-full p-8">
            <header className="bg-white border border-slate-200 rounded-[32px] h-20 flex items-center justify-between px-8 mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/owner" className="lg:hidden p-2 hover:bg-slate-50 rounded-xl transition-colors">
                        <ChevronLeft size={20} className="text-slate-400" />
                    </Link>
                    <h2 className="text-xl font-bold">Shop Settings</h2>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50 transition-all active:scale-95"
                >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Save Changes
                </button>
            </header>

            <div className={cn(
                "p-6 rounded-[32px] border-2 flex items-center justify-between transition-all",
                settings.is_open ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-red-50 border-red-100 text-red-900"
            )}>
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center",
                        settings.is_open ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                    )}>
                        <Power size={24} />
                    </div>
                    <div>
                        <p className="font-bold text-lg">{settings.is_open ? "Shop is Open" : "Shop is Closed"}</p>
                        <p className="text-xs font-medium opacity-70">Students can {settings.is_open ? "upload documents now" : "no longer upload for now"}</p>
                    </div>
                </div>
                <button
                    onClick={() => setSettings(p => ({ ...p, is_open: !p.is_open }))}
                    className={cn(
                        "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                        settings.is_open ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                    )}
                >
                    Toggle Status
                </button>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <Store size={18} className="text-blue-600" />
                    <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest">General Info</h3>
                </div>
                <div className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-sm">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-700 ml-1">Shop Name</label>
                        <input
                            type="text"
                            value={settings.shop_name}
                            onChange={(e) => setSettings(p => ({ ...p, shop_name: e.target.value }))}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold focus:ring-2 focus:ring-blue-600 transition-all outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <DollarSign size={18} className="text-blue-600" />
                    <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest">Rate Card</h3>
                </div>
                <Link href="/dashboard/owner/pricing">
                    <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all group cursor-pointer flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900">Pricing Configuration</h4>
                                <p className="text-xs text-slate-500 font-bold mt-0.5">Set Custom Rates for B/W & Color</p>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 group-hover:border-blue-200 group-hover:text-blue-600 transition-all">
                            <ChevronLeft size={20} className="rotate-180" />
                        </div>
                    </div>
                </Link>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <CreditCard size={18} className="text-blue-600" />
                    <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest">UPI & Finance</h3>
                </div>
                <div className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-sm space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <label className="text-sm font-bold text-slate-700 ml-1">Primary UPI ID</label>
                            <input
                                type="text"
                                placeholder="e.g. name@okicici"
                                value={settings.primary_vpa}
                                onChange={(e) => setSettings(p => ({ ...p, primary_vpa: e.target.value }))}
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                            />
                            <button
                                onClick={() => setSettings(p => ({ ...p, active_vpa_type: 'primary' }))}
                                className={cn(
                                    "w-full py-3 rounded-xl text-xs font-bold transition-all",
                                    settings.active_vpa_type === 'primary' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                                )}
                            >
                                {settings.active_vpa_type === 'primary' ? "Currently Active" : "Set Active"}
                            </button>
                        </div>
                        <div className="space-y-4">
                            <label className="text-sm font-bold text-slate-700 ml-1">Backup UPI ID</label>
                            <input
                                type="text"
                                placeholder="Emergency backup"
                                value={settings.backup_vpa}
                                onChange={(e) => setSettings(p => ({ ...p, backup_vpa: e.target.value }))}
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                            />
                            <button
                                onClick={() => setSettings(p => ({ ...p, active_vpa_type: 'backup' }))}
                                className={cn(
                                    "w-full py-3 rounded-xl text-xs font-bold transition-all",
                                    settings.active_vpa_type === 'backup' ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-500"
                                )}
                            >
                                {settings.active_vpa_type === 'backup' ? "Currently Active" : "Set Active"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {success && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed bottom-10 left-1/2 -translate-x-1/2 lg:left-[calc(50%+128px)] bg-emerald-600 text-white px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-2 z-50"
                >
                    <ShieldCheck size={20} />
                    Settings Saved Successfully!
                </motion.div>
            )}

            {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}
        </div>
    );
}
