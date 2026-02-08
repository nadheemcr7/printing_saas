"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import {
    TrendingUp,
    DollarSign,
    FileStack,
    ShoppingBag,
    Calendar,
    Loader2,
    ChevronLeft
} from "lucide-react";
import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { OwnerSidebar } from "@/components/OwnerSidebar";

export default function AnalyticsPage() {
    const { supabase, user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [velocity, setVelocity] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;

        const fetchAnalytics = async () => {
            const { data: statsData } = await supabase.rpc('get_owner_analytics');
            if (statsData && statsData[0]) {
                setStats(statsData[0]);
            }

            const { data: velocityData } = await supabase.rpc('get_print_velocity');
            if (velocityData) {
                setVelocity(velocityData);
            }

            setLoading(false);
        };

        fetchAnalytics();
    }, [supabase, user]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    const mainStats = [
        {
            label: "Today's Revenue",
            value: formatCurrency(stats?.today_revenue || 0),
            icon: <DollarSign className="text-emerald-500" />,
            desc: "Money in bank today"
        },
        {
            label: "Total Orders",
            value: stats?.today_orders || 0,
            icon: <ShoppingBag className="text-blue-500" />,
            desc: "Total customers today"
        },
        {
            label: "Pages Printed",
            value: stats?.today_pages || 0,
            icon: <FileStack className="text-orange-500" />,
            desc: "Total volume today"
        },
        {
            label: "Weekly Total",
            value: formatCurrency(stats?.weekly_revenue || 0),
            icon: <Calendar className="text-purple-500" />,
            desc: "Last 7 days revenue"
        },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex">
            <OwnerSidebar />

            <main className="flex-1 flex flex-col min-w-0">
                <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-8 sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/owner" className="lg:hidden p-2 hover:bg-slate-50 rounded-xl transition-colors">
                            <ChevronLeft size={20} className="text-slate-400" />
                        </Link>
                        <h2 className="text-lg font-bold">Business Insights</h2>
                    </div>
                </header>

                <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Revenue Overview</h1>
                        <p className="text-slate-500 font-medium">Tracking performance for Ridha Printers</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {mainStats.map((stat, i) => (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                key={stat.label}
                                className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4"
                            >
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                                    {stat.icon}
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase text-slate-400 tracking-widest">{stat.label}</p>
                                    <p className="text-2xl font-black text-slate-900 mt-1">{stat.value}</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-2">{stat.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 bg-slate-900 rounded-[40px] p-8 text-white relative overflow-hidden h-[300px] flex flex-col justify-between">
                            <div className="relative z-10 space-y-1">
                                <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Efficiency</p>
                                <h3 className="text-2xl font-bold">Print Velocity</h3>
                            </div>
                            <div className="relative z-10 flex items-end gap-2 h-32">
                                {velocity.length > 0 ? velocity.map((v, i) => {
                                    const maxOrders = Math.max(...velocity.map(item => Number(item.order_count)), 5);
                                    const h = (Number(v.order_count) / maxOrders) * 100;
                                    return (
                                        <div key={i} className="flex-1 bg-blue-500/20 rounded-t-lg relative group">
                                            <div
                                                style={{ height: `${Math.max(h, 5)}%` }}
                                                className="absolute bottom-0 w-full bg-blue-500 rounded-t-lg group-hover:bg-blue-400 transition-all cursor-pointer"
                                            />
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-slate-900 text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl">
                                                {v.order_count} Orders @ {new Date(v.hour_timestamp).getHours()}:00
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="flex-1 flex items-center justify-center text-slate-500 text-xs font-bold">
                                        No recent print activity
                                    </div>
                                )}
                            </div>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 blur-[100px] opacity-20" />
                        </div>

                        <div className="bg-white border border-slate-100 rounded-[40px] p-8 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                                    <TrendingUp size={20} />
                                </div>
                                <h3 className="font-bold text-lg">In progress</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Queue Value</p>
                                    <p className="text-3xl font-black text-slate-900">{formatCurrency(stats?.pending_revenue || 0)}</p>
                                </div>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                    Total value of orders currently in your queue.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
