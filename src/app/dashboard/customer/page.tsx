"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import {
    Printer,
    Upload,
    FileText,
    CreditCard,
    CheckCircle2,
    Clock,
    AlertCircle,
    ChevronRight,
    Plus,
    Handshake,
    LogOut
} from "lucide-react";
import { motion } from "framer-motion";
import { UploadModal } from "@/components/UploadModal";
import { cn } from "@/lib/utils";

export default function CustomerDashboard() {
    const { profile, signOut, supabase, user } = useAuth();
    const [orders, setOrders] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [shopSettings, setShopSettings] = useState({ shop_name: "RIDHA PRINTERS", is_open: true });

    useEffect(() => {
        if (!user) return;

        const fetchMyOrders = async () => {
            const { data } = await supabase
                .from("orders")
                .select("*")
                .eq("customer_id", user.id)
                .order("created_at", { ascending: false });

            setOrders(data || []);
        };

        const fetchShopSettings = async () => {
            const { data } = await supabase
                .from("shop_settings")
                .select("shop_name, is_open")
                .limit(1);

            if (data && data[0]) setShopSettings(data[0]);
        };

        fetchMyOrders();
        fetchShopSettings();

        const orderChannel = supabase
            .channel("user_orders")
            .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `customer_id=eq.${user.id}` }, () => {
                fetchMyOrders();
            })
            .subscribe();

        const settingsChannel = supabase
            .channel("shop_settings")
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shop_settings" }, (payload) => {
                setShopSettings(payload.new as any);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(orderChannel);
            supabase.removeChannel(settingsChannel);
        };
    }, [supabase, user]);

    return (
        <div className="min-h-screen bg-white font-sans">
            <UploadModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedOrder(null);
                }}
                userId={user?.id || ""}
                profile={profile}
                resumeOrder={selectedOrder}
            />

            {/* Mobile-Friendly Nav */}
            <nav className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                        <Printer size={18} />
                    </div>
                    <span className="font-bold text-lg">{shopSettings.shop_name}</span>
                    {!shopSettings.is_open && (
                        <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Closed</span>
                    )}
                </div>
                <button
                    onClick={signOut}
                    className="text-sm font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-all duration-200 flex items-center gap-1.5 active:scale-95"
                >
                    <LogOut size={16} />
                    Logout
                </button>
            </nav>

            <main className="max-w-xl mx-auto p-6 space-y-10 pb-32">
                {/* Welcome */}
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold font-display">Hey, {profile?.full_name?.split(' ')[0] || "there"}!</h2>
                    <p className="text-slate-500 font-medium">Ready to print some documents?</p>
                </div>

                {/* Action Button */}
                <motion.button
                    whileTap={shopSettings.is_open ? { scale: 0.95 } : {}}
                    onClick={() => shopSettings.is_open && setIsModalOpen(true)}
                    className={cn(
                        "w-full p-6 rounded-3xl flex items-center justify-between group text-left transition-all",
                        shopSettings.is_open
                            ? "bg-blue-600 text-white shadow-2xl shadow-blue-200 cursor-pointer"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    )}
                >
                    <div>
                        <p className="font-bold text-xl mb-1">New Print Job</p>
                        <p className={cn("text-sm opacity-80", shopSettings.is_open ? "text-blue-100" : "text-slate-400")}>
                            {shopSettings.is_open ? "Upload PDF and get a code" : "Shop is currently closed"}
                        </p>
                    </div>
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-md transition-colors",
                        shopSettings.is_open ? "bg-white/20 group-hover:bg-white/30" : "bg-slate-200"
                    )}>
                        <Plus size={28} />
                    </div>
                </motion.button>

                {/* Summary Card */}
                <div className="bg-slate-900 text-white rounded-[32px] p-8 relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-2">Active Orders</p>
                        <div className="text-5xl font-bold font-display">{orders.filter(o => o.status !== 'completed').length}</div>
                    </div>
                    {/* Decor */}
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-600 blur-[60px] opacity-20" />
                </div>

                {/* My Orders Section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold font-display">Recent Prints</h3>
                        <button className="text-sm font-bold text-blue-600 hover:underline">View All</button>
                    </div>

                    <div className="space-y-4">
                        {orders.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                <FileText className="mx-auto text-slate-300 mb-2" size={32} />
                                <p className="text-sm text-slate-500 font-bold">No print jobs yet.</p>
                            </div>
                        ) : orders.map((order) => (
                            <motion.div
                                key={order.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onClick={() => {
                                    if (order.status === 'pending_payment') {
                                        setSelectedOrder(order);
                                        setIsModalOpen(true);
                                    }
                                }}
                                className={cn(
                                    "bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 cursor-pointer",
                                    order.status === 'pending_payment' && "border-blue-100 ring-2 ring-blue-50/50"
                                )}
                            >
                                <div className={cn(
                                    "w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl",
                                    order.status === 'ready' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                                )}>
                                    #{order.pickup_code}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-slate-900 truncate">Document_{order.pickup_code}.pdf</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge status={order.status} />
                                        <span className="text-[10px] text-slate-400 font-bold">• {order.total_pages} Pages</span>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-slate-300" />
                            </motion.div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Dock Area Navigation */}
            <div className="fixed bottom-0 w-full px-6 pb-6 pointer-events-none">
                <div className="max-w-md mx-auto h-16 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl pointer-events-auto flex items-center justify-around px-4">
                    <DockItem icon={<Printer size={20} />} label="Prints" active />
                    <DockItem
                        icon={<Plus size={20} />}
                        label="Add"
                        onClick={() => shopSettings.is_open && setIsModalOpen(true)}
                    />
                    <DockItem
                        icon={<FileText size={20} />}
                        label="Docs"
                        onClick={() => { }} // Could link to a documents page later
                    />
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: any = {
        pending_payment: "text-slate-400 bg-slate-50 border-slate-100",
        queued: "text-orange-600 bg-orange-50 border-orange-100",
        printing: "text-blue-600 bg-blue-50 border-blue-100",
        ready: "text-emerald-600 bg-emerald-50 border-emerald-100",
        completed: "text-slate-500 bg-slate-50 border-slate-100",
    };

    const icons: any = {
        pending_payment: <Clock size={12} />,
        queued: <Clock size={12} />,
        printing: <Printer size={12} />,
        ready: <CheckCircle2 size={12} />,
        completed: <Handshake size={12} />,
    };

    const labels: any = {
        pending_payment: 'Waiting for Pay',
        queued: 'In Queue',
        printing: 'Printing',
        ready: 'Ready for Pickup',
        completed: 'Handed Over',
    };

    return (
        <span className={cn("inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border", styles[status])}>
            {icons[status]}
            {labels[status] || status}
        </span>
    );
}

function DockItem({ icon, label, onClick, active = false }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-xl transition-all",
                active ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
            )}>
            {icon}
            <span className="text-[10px] font-bold tracking-tight">{label}</span>
            {active && <div className="w-1 h-1 bg-blue-600 rounded-full" />}
        </button>
    );
}
