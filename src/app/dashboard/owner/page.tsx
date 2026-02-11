"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import {
    Printer,
    Clock,
    CheckCircle2,
    Bell,
    Search,
    CheckSquare,
    Square,
    Download,
    Trash2,
    X,
    Handshake,
    TrendingUp,
    Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import { HandoverModal } from "@/components/HandoverModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const dynamic = 'force-dynamic';

export default function OwnerDashboard() {
    const { user, loading: authLoading, supabase } = useAuth();
    const queryClient = useQueryClient();

    // UI State
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const [isHandoverOpen, setIsHandoverOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);

    // 1. Fetch Orders
    const { data: orders = [], isLoading: ordersLoading } = useQuery({
        queryKey: ['owner_orders'],
        enabled: !!user?.id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("orders")
                .select(`
                    *,
                    profiles:customer_id (full_name)
                `)
                .neq('status', 'pending_payment')
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data || [];
        }
    });

    // 2. Fetch Shop Settings
    const { data: shopSettings = { is_open: true, shop_name: "RIDHA PRINTERS" } } = useQuery({
        queryKey: ['shop_settings'],
        queryFn: async () => {
            const { data } = await supabase.from("shop_settings").select("*").limit(1).single();
            return data || { is_open: true, shop_name: "RIDHA PRINTERS" };
        }
    });

    // 3. Fetch Analytics (Today's Revenue)
    const { data: analytics = { archivedRevenue: 0 } } = useQuery({
        queryKey: ['owner_analytics'],
        queryFn: async () => {
            // Calculate strictly from today's orders in DB + archived if needed
            // For now, let's compute from the fetched orders to match previous logic safely
            // or perform a lightweight RPC/query
            const today = new Date().toDateString();
            const { data: archived } = await supabase.from('analytics_daily')
                .select('total_revenue')
                .eq('date', new Date().toISOString().split('T')[0])
                .single();

            return {
                archivedRevenue: Number(archived?.total_revenue || 0)
            };
        }
    });

    // Computed Revenue (Live + Archived)
    const todayRevenue = (orders
        .filter(o => {
            const orderDate = new Date(o.created_at);
            const today = new Date();
            return orderDate.toDateString() === today.toDateString() &&
                (o.payment_status === 'paid' || ['queued', 'printing', 'ready', 'completed'].includes(o.status));
        })
        .reduce((sum, o) => sum + Number(o.estimated_cost || 0), 0)) + (analytics.archivedRevenue || 0);

    // Mutations
    const updateStatusMutation = useMutation({
        mutationFn: async ({ ids, status }: { ids: string[], status: string }) => {
            const { error } = await supabase.rpc("batch_update_order_status", { order_ids: ids, new_status: status });
            if (error) throw error;
        },
        onMutate: async ({ ids, status }) => {
            await queryClient.cancelQueries({ queryKey: ['owner_orders'] });
            const previousOrders = queryClient.getQueryData(['owner_orders']);

            queryClient.setQueryData(['owner_orders'], (old: any[]) =>
                old?.map(o => ids.includes(o.id) ? { ...o, status } : o)
            );
            setSelectedOrders([]); // Clear selection on optimistic update

            return { previousOrders };
        },
        onError: (err, newTodo, context) => {
            queryClient.setQueryData(['owner_orders'], context?.previousOrders);
            alert("Failed to update status");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['owner_orders'] });
        }
    });

    const toggleShopMutation = useMutation({
        mutationFn: async () => {
            const newStatus = !shopSettings.is_open;
            await supabase.from("shop_settings").update({ is_open: newStatus }).eq("owner_id", user?.id);
            return newStatus;
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['shop_settings'] });
            const prev = queryClient.getQueryData(['shop_settings']);
            queryClient.setQueryData(['shop_settings'], (old: any) => ({ ...old, is_open: !old.is_open }));
            return { prev };
        },
        onError: (err, vars, context) => {
            queryClient.setQueryData(['shop_settings'], context?.prev);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['shop_settings'] });
        }
    });

    const deleteOrderMutation = useMutation({
        mutationFn: async (id: string) => {
            const order = orders.find(o => o.id === id);
            if (order?.file_path) await supabase.storage.from('documents').remove([order.file_path]);
            await supabase.from('orders').delete().eq('id', id);
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['owner_orders'] });
            const prev = queryClient.getQueryData(['owner_orders']);
            queryClient.setQueryData(['owner_orders'], (old: any[]) => old.filter(o => o.id !== id));
            return { prev };
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['owner_orders'] });
        }
    });

    // Realtime
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`owner_updates_${user.id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
                // Invalidate to refetch fresh data
                queryClient.invalidateQueries({ queryKey: ['owner_orders'] });

                // Notifications
                if (payload.eventType === 'INSERT' && payload.new.status !== 'pending_payment') {
                    setNotifications(prev => [{
                        id: payload.new.id,
                        message: `New Order #${payload.new.pickup_code}`,
                        time: "Just now"
                    }, ...prev]);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [supabase, user, queryClient]);


    const handleDirectPrint = async (order: any) => {
        const { data } = await supabase.storage.from('documents').createSignedUrl(order.file_path, 300);
        if (data?.signedUrl) {
            window.open(data.signedUrl, '_blank');
            if (order.status === 'queued') {
                updateStatusMutation.mutate({ ids: [order.id], status: 'printing' });
            }
        }
    };

    const stats = [
        { label: "Shop Status", value: shopSettings.is_open ? "OPEN" : "CLOSED", icon: <TrendingUp className={shopSettings.is_open ? "text-emerald-500" : "text-red-500"} />, isStatus: true },
        { label: "Today's Revenue", value: formatCurrency(todayRevenue), icon: <TrendingUp className="text-emerald-500" /> },
        { label: "Queued", value: orders.filter(o => o.status === 'queued').length, icon: <Clock className="text-orange-500" /> },
        { label: "Printing", value: orders.filter(o => o.status === 'printing').length, icon: <Printer className="text-blue-500" /> },
        { label: "Ready", value: orders.filter(o => o.status === 'ready').length, icon: <CheckCircle2 className="text-emerald-500" /> },
    ];

    const filteredOrders = orders.filter(o => {
        const term = searchQuery.toLowerCase();
        return o.pickup_code?.toLowerCase().includes(term) || (o.profiles as any)?.full_name?.toLowerCase().includes(term);
    });

    if (authLoading) return null;

    return (
        <div className="flex flex-col flex-1 min-w-0">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-800">Shop Queue</h2>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative hidden md:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            placeholder="Search orders..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-slate-50 border-none rounded-full pl-10 pr-4 py-2 text-sm w-64 outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                        />
                    </div>
                    <button
                        onClick={() => toggleShopMutation.mutate()}
                        className={cn(
                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2",
                            shopSettings.is_open ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                        )}
                    >
                        <div className={cn("w-2 h-2 rounded-full", shopSettings.is_open ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                        {shopSettings.is_open ? "Open" : "Closed"}
                    </button>
                    <button onClick={() => setIsHandoverOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200">
                        <Handshake size={14} /> Verify Code
                    </button>
                    <div className="relative">
                        <button onClick={() => { setIsNotificationOpen(!isNotificationOpen); }} className="p-2 hover:bg-slate-50 rounded-full relative">
                            <Bell size={20} className="text-slate-500" />
                            {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white text-[8px] flex items-center justify-center text-white font-bold">{notifications.length}</span>}
                        </button>
                        <AnimatePresence>
                            {isNotificationOpen && (
                                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                                        <span className="font-bold text-sm">Notifications</span>
                                        <X size={16} className="text-slate-400 cursor-pointer" onClick={() => { setIsNotificationOpen(false); setNotifications([]); }} />
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {notifications.length > 0 ? notifications.map((ev, i) => (
                                            <div key={i} className="p-4 border-b border-slate-50 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Check size={14} /></div>
                                                <div><p className="text-xs font-bold text-slate-800">{ev.message}</p><p className="text-[10px] text-slate-400 font-medium">{ev.time}</p></div>
                                            </div>
                                        )) : <div className="p-8 text-center text-slate-400 text-xs font-medium">All cleared!</div>}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header>

            <div className="p-6 md:p-8 space-y-8">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {stats.map((stat, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => stat.isStatus && toggleShopMutation.mutate()} className={cn("bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm transition-all", stat.isStatus && "cursor-pointer hover:border-blue-400 active:scale-95")}>
                            <div className="flex items-center justify-between mb-4"><div className="p-2.5 bg-slate-50 rounded-2xl">{stat.icon}</div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span></div>
                            <div className={cn("text-2xl font-black", stat.isStatus && (shopSettings.is_open ? "text-emerald-600" : "text-red-600"))}>{stat.value}</div>
                        </motion.div>
                    ))}
                </div>

                {/* Batch Actions */}
                <AnimatePresence>
                    {selectedOrders.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-xl text-white px-8 py-4 rounded-full flex items-center gap-8 shadow-2xl z-50 border border-white/10">
                            <span className="text-sm font-black border-r border-white/20 pr-8">{selectedOrders.length} SELECTED</span>
                            <div className="flex items-center gap-6">
                                <button onClick={() => updateStatusMutation.mutate({ ids: selectedOrders, status: 'printing' })} className="text-xs font-black hover:text-blue-400 transition-colors uppercase tracking-widest">Print</button>
                                <button onClick={() => updateStatusMutation.mutate({ ids: selectedOrders, status: 'ready' })} className="text-xs font-black hover:text-emerald-400 transition-colors uppercase tracking-widest">Ready</button>
                                <button onClick={() => updateStatusMutation.mutate({ ids: selectedOrders, status: 'completed' })} className="text-xs font-black hover:text-blue-400 transition-colors uppercase tracking-widest">Finish</button>
                                <button onClick={() => setSelectedOrders([])} className="text-xs font-black text-slate-400 hover:text-white uppercase tracking-widest">Cancel</button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Table */}
                <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-5 w-10"><button onClick={() => setSelectedOrders(selectedOrders.length === orders.length ? [] : orders.map(o => o.id))} className="text-slate-300">{selectedOrders.length === orders.length && orders.length > 0 ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}</button></th>
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Pickup Code</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Customer</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Pages</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Income</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Status</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {ordersLoading ? <tr><td colSpan={7} className="px-6 py-20 text-center"><div className="animate-spin w-8 h-8 border-bg-2 border-blue-600 rounded-full mx-auto" /></td></tr> : filteredOrders.length === 0 ? <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-400 font-bold">No orders found.</td></tr> : filteredOrders.map((order) => (
                                    <tr key={order.id} className={cn("hover:bg-slate-50/80 transition-all group", selectedOrders.includes(order.id) && "bg-blue-50/40")}>
                                        <td className="px-6 py-4"><button onClick={() => setSelectedOrders(prev => prev.includes(order.id) ? prev.filter(x => x !== order.id) : [...prev, order.id])} className={cn("transition-all", selectedOrders.includes(order.id) ? "text-blue-600" : "text-slate-200 group-hover:text-slate-300")}>{selectedOrders.includes(order.id) ? <CheckSquare size={20} /> : <Square size={20} />}</button></td>
                                        <td className="px-6 py-4"><div className="bg-slate-900 text-white text-[11px] font-black px-2.5 py-1.5 rounded-lg w-fit tracking-[0.2em] shadow-lg shadow-slate-200">#{order.pickup_code}</div></td>
                                        <td className="px-6 py-4"><div className="font-black text-slate-900">{(order.profiles as any)?.full_name || "Guest User"}</div><div className="text-[10px] font-bold text-slate-400 flex items-center gap-2 mt-0.5"><Clock size={10} />{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></td>
                                        <td className="px-6 py-4"><div className="text-sm font-black text-slate-700">{order.total_pages} PGS</div><div className="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-1">{order.print_type} • {order.side_type}</div></td>
                                        <td className="px-6 py-4 font-black text-slate-900">{formatCurrency(order.estimated_cost)}</td>
                                        <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {order.status === 'queued' && <button onClick={() => handleDirectPrint(order)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all border border-blue-100"><Printer size={18} /></button>}
                                                {order.status === 'printing' && <button onClick={() => updateStatusMutation.mutate({ ids: [order.id], status: 'ready' })} className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100"><Check size={18} /></button>}
                                                {order.status === 'completed' && <button onClick={() => deleteOrderMutation.mutate(order.id)} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all border border-red-100"><Trash2 size={18} /></button>}
                                                <button onClick={async () => { const { data } = await supabase.storage.from('documents').createSignedUrl(order.file_path, 60); if (data?.signedUrl) window.open(data.signedUrl); }} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all border border-slate-100"><Download size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <HandoverModal isOpen={isHandoverOpen} onClose={() => setIsHandoverOpen(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['owner_orders'] })} />
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const maps: any = { queued: "bg-orange-50 text-orange-600 border-orange-100", printing: "bg-blue-50 text-blue-600 border-blue-100", ready: "bg-emerald-50 text-emerald-600 border-emerald-100", completed: "bg-slate-50 text-slate-400 border-slate-100", pending_verification: "bg-purple-50 text-purple-600 border-purple-100" };
    return <span className={cn("px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm", maps[status])}>{status.replace('_', ' ')}</span>;
}
