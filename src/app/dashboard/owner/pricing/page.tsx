"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import {
    DollarSign,
    Save,
    Loader2,
    ArrowLeft,
    CheckCircle2,
    AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const DEFAULT_TIERS = {
    bw: {
        single: { basePrice: 2, baseLimit: 10, extraPrice: 1 },
        double: { basePrice: 2, baseLimit: 10, extraPrice: 1.5 }
    },
    color: {
        single: { basePrice: 10, baseLimit: 0, extraPrice: 10 },
        double: { basePrice: 20, baseLimit: 0, extraPrice: 20 }
    }
};

export default function PricingPage() {
    const { supabase, user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tiers, setTiers] = useState<any>(DEFAULT_TIERS);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        const loadPricing = async () => {
            try {
                // Load from pricing_config table
                const { data, error } = await supabase
                    .from("pricing_config")
                    .select("*")
                    .or(`owner_id.eq.${user.id},owner_id.is.null`);

                if (data && data.length > 0) {
                    const newTiers = JSON.parse(JSON.stringify(DEFAULT_TIERS));

                    // Priority: Owner's config > System defaults
                    // We sort so system defaults (null owner_id) are processed first, 
                    // then owner's config overwrites them.
                    const sortedData = data.sort((a: any, b: any) => {
                        if (a.owner_id === b.owner_id) return 0;
                        return a.owner_id ? 1 : -1;
                    });

                    sortedData.forEach((row: any) => {
                        const type = row.print_type.toLowerCase() as 'bw' | 'color';
                        const side = row.side_type.toLowerCase() as 'single' | 'double';

                        if (row.priority === 1) {
                            newTiers[type][side].basePrice = Number(row.rate);
                            newTiers[type][side].baseLimit = row.tier_limit || 0;
                        } else if (row.priority === 2) {
                            newTiers[type][side].extraPrice = Number(row.rate);
                        }
                    });
                    setTiers(newTiers);
                }
            } catch (err) {
                console.error("Error loading pricing:", err);
            } finally {
                setLoading(false);
            }
        };

        loadPricing();
    }, [supabase, user]);

    const handleSave = async () => {
        if (!user) return;

        setSaving(true);
        setSuccess(false);
        setError(null);

        try {
            const rows: any[] = [];

            // Map our state back to database rows
            ['bw', 'color'].forEach((type: any) => {
                ['single', 'double'].forEach((side: any) => {
                    const config = tiers[type][side];

                    // Priority 1: Base Tier
                    rows.push({
                        owner_id: user.id,
                        print_type: type.toUpperCase(),
                        side_type: side.toUpperCase(),
                        tier_limit: config.baseLimit,
                        rate: config.basePrice,
                        priority: 1
                    });

                    // Priority 2: After Limit Tier
                    rows.push({
                        owner_id: user.id,
                        print_type: type.toUpperCase(),
                        side_type: side.toUpperCase(),
                        tier_limit: null,
                        rate: config.extraPrice,
                        priority: 2
                    });
                });
            });

            // Upsert rows based on (owner_id, print_type, side_type, priority)
            const { error: upsertError } = await supabase
                .from("pricing_config")
                .upsert(rows, { onConflict: 'owner_id,print_type,side_type,priority' });

            if (upsertError) throw upsertError;

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || "Failed to save pricing");
        } finally {
            setSaving(false);
        }
    };

    const updateTier = (type: 'bw' | 'color', side: 'single' | 'double', field: string, value: string | number) => {
        setTiers((prev: any) => ({
            ...prev,
            [type]: {
                ...prev[type],
                [side]: {
                    ...prev[type][side],
                    [field]: Number(value)
                }
            }
        }));
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-8">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/owner" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft size={20} className="text-slate-500" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Pricing Configuration</h1>
                        <p className="text-slate-500 text-sm">Set your rates for Black & White and Color prints.</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Save Changes
                </button>
            </header>

            {success && (
                <div className="bg-emerald-50 text-emerald-600 px-6 py-4 rounded-2xl flex items-center gap-3 font-bold border border-emerald-100">
                    <CheckCircle2 size={20} />
                    Pricing updated successfully!
                </div>
            )}

            {error && (
                <div className="bg-red-50 text-red-600 px-6 py-4 rounded-2xl flex items-center gap-3 font-bold border border-red-100">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="space-y-6">
                    <div className="flex items-center gap-2 text-slate-400 font-black text-xs uppercase tracking-widest px-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full" />
                        Black & White
                    </div>
                    <PricingCard
                        title="Single Side (B/W)"
                        tier={tiers.bw.single}
                        onChange={(field, val) => updateTier('bw', 'single', field, val)}
                    />
                    <PricingCard
                        title="Double Side (B/W)"
                        tier={tiers.bw.double}
                        onChange={(field, val) => updateTier('bw', 'double', field, val)}
                    />
                </section>

                <section className="space-y-6">
                    <div className="flex items-center gap-2 text-blue-500 font-black text-xs uppercase tracking-widest px-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        Color
                    </div>
                    <PricingCard
                        title="Single Side (Color)"
                        tier={tiers.color.single}
                        onChange={(field, val) => updateTier('color', 'single', field, val)}
                        isColor
                    />
                    <PricingCard
                        title="Double Side (Color)"
                        tier={tiers.color.double}
                        onChange={(field, val) => updateTier('color', 'double', field, val)}
                        isColor
                    />
                </section>
            </div>
        </div>
    );
}

interface PricingCardProps {
    title: string;
    tier: { baseLimit: number; basePrice: number; extraPrice: number };
    onChange: (field: string, value: string) => void;
    isColor?: boolean;
}

function PricingCard({ title, tier, onChange, isColor }: PricingCardProps) {
    return (
        <div className={cn("bg-white p-6 rounded-[32px] border shadow-sm space-y-6", isColor ? "border-blue-100" : "border-slate-200")}>
            <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                <h3 className="font-bold text-lg text-slate-800">{title}</h3>
                <DollarSign className={cn(isColor ? "text-blue-200" : "text-slate-200")} />
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">First (X) Pages</label>
                        <input
                            type="number"
                            min="0"
                            value={tier.baseLimit}
                            onChange={(e) => onChange('baseLimit', e.target.value)}
                            className="w-full bg-slate-50 rounded-xl p-3 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Base Price (₹)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={tier.basePrice}
                            onChange={(e) => onChange('basePrice', e.target.value)}
                            className="w-full bg-slate-50 rounded-xl p-3 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-50">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Price After Limit (₹)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={tier.extraPrice}
                            onChange={(e) => onChange('extraPrice', e.target.value)}
                            className="w-full bg-emerald-50 text-emerald-900 rounded-xl p-3 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <p className="text-[10px] text-emerald-600/60">Applied to pages after the first {tier.baseLimit}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
