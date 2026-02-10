"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useCallback } from "react";
import {
    Printer,
    Clock,
    CheckCircle2,
    MoreVertical,
    Users,
    TrendingUp,
    Settings,
    Bell,
    Search,
    CheckSquare,
    Square,
    Hourglass,
    Eye,
    Download,
    Trash2,
    X,
    LogOut
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { HandoverModal } from "@/components/HandoverModal";
import { Handshake } from "lucide-react";
import { OwnerSidebar } from "@/components/OwnerSidebar";

export const dynamic = 'force-dynamic';

export default function OwnerDashboard() {
    const { user, profile, loading: authLoading, signOut, supabase } = useAuth();
    const [orders, setOrders] = useState<any[]>([]);
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Protect client side
    useEffect(() => {
        if (!authLoading && !user) {
            window.location.replace("/login");
        }
    }, [user, authLoading]);

    const [isHandoverOpen, setIsHandoverOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [shopSettings, setShopSettings] = useState({ id: null, is_open: true, shop_name: "RIDHA PRINTERS" });
    const [notifications, setNotifications] = useState(0);
    const [notificationEvents, setNotificationEvents] = useState<any[]>([]);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);


    // Calculate today's revenue
    const todayRevenue = orders
        .filter(o => {
            const orderDate = new Date(o.created_at);
            const today = new Date();
            const isToday = orderDate.toDateString() === today.toDateString();
            // Count as revenue if it's paid, verified, or actively in the workflow
            const isRevenue = o.payment_status === 'paid' || o.payment_verified || ['queued', 'printing', 'ready', 'completed'].includes(o.status);
            return isToday && isRevenue;
        })
        .reduce((sum, o) => sum + Number(o.estimated_cost || 0), 0);

    // Stats
    const stats = [
        { label: "Shop Status", value: shopSettings.is_open ? "OPEN" : "CLOSED", icon: <TrendingUp className={shopSettings.is_open ? "text-emerald-500" : "text-red-500"} />, isStatus: true },
        { label: "Today's Revenue", value: `₹${todayRevenue.toFixed(0)}`, icon: <TrendingUp className="text-emerald-500" /> },
        { label: "Queued", value: orders.filter(o => o.status === 'queued').length, icon: <Clock className="text-orange-500" /> },
        { label: "Printing", value: orders.filter(o => o.status === 'printing').length, icon: <Printer className="text-blue-500" /> },
        { label: "Ready", value: orders.filter(o => o.status === 'ready').length, icon: <CheckCircle2 className="text-emerald-500" /> },
    ];

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("orders")
                .select(`
                    *,
                    profiles:customer_id (full_name)
                `)
                .neq('status', 'pending_payment')
                .order("created_at", { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (err) {
            console.error("Failed to fetch orders:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchShopSettings = async () => {
        try {
            const { data, error } = await supabase.from("shop_settings").select("*").limit(1).single();
            if (error) throw error;
            if (data) setShopSettings(data);
        } catch (err) {
            console.error("Failed to fetch shop settings:", err);
        }
    };

    const toggleShopStatus = async () => {
        const newStatus = !shopSettings.is_open;
        // Optimistic update
        setShopSettings(prev => ({ ...prev, is_open: newStatus }));

        const { error } = await supabase
            .from("shop_settings")
            .update({ is_open: newStatus })
            .eq("owner_id", profile?.id);

        if (error) {
            console.error("Failed to update shop status:", error);
            fetchShopSettings(); // Rollback
        }
    };

    useEffect(() => {
        if (!supabase || !user) return;

        fetchOrders();
        fetchShopSettings();

        // Realtime subscription with error recovery
        const channelName = `owner_dashboard_${user.id}_${Date.now()}`;
        const channel = supabase
            .channel(channelName)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async (payload) => {
                const newOrder = payload.new as any;

                // Fetch the customer name separately
                const { data: profileData } = await supabase
                    .from("profiles")
                    .select("full_name")
                    .eq("id", newOrder.customer_id)
                    .single();

                const orderWithProfile = { ...newOrder, profiles: profileData };

                if (newOrder.status !== 'pending_payment') {
                    setOrders(prev => [orderWithProfile, ...prev]);
                    setNotifications(prev => prev + 1);
                    setNotificationEvents(prev => [{
                        id: newOrder.id,
                        type: 'new_order',
                        message: `New order #${newOrder.pickup_code} ready`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        status: newOrder.status
                    }, ...prev].slice(0, 10));
                }
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
                const updatedOrder = payload.new as any;
                const oldOrder = payload.old as any;

                const wasPending = oldOrder && oldOrder.status === 'pending_payment';
                const isNowQueued = updatedOrder.status === 'queued';

                if (wasPending && isNowQueued) {
                    fetchOrders();
                    setNotifications(prev => prev + 1);
                    setNotificationEvents(prev => [{
                        id: updatedOrder.id,
                        type: 'payment_received',
                        message: `💰 Payment received for #${updatedOrder.pickup_code}`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        status: updatedOrder.status
                    }, ...prev].slice(0, 10));
                } else {
                    setOrders(prev => prev.map(o =>
                        o.id === updatedOrder.id
                            ? { ...o, ...updatedOrder, profiles: o.profiles }
                            : o
                    ));
                }

                if (updatedOrder.status === 'pending_verification' && (!oldOrder || oldOrder.status !== 'pending_verification')) {
                    setNotifications(prev => prev + 1);
                    setNotificationEvents(prev => [{
                        id: updatedOrder.id,
                        type: 'payment_uploaded',
                        message: `Order #${updatedOrder.pickup_code} needs verification`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        status: updatedOrder.status
                    }, ...prev].slice(0, 10));
                }
            })
            .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, (payload) => {
                setOrders(prev => prev.filter(o => o.id !== payload.old.id));
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shop_settings" }, (payload) => {
                setShopSettings(prev => ({ ...prev, ...payload.new }));
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') console.log('✅ Realtime connected');
                if (status === 'CHANNEL_ERROR') {
                    console.warn('⚠️ Realtime channel error - will use polling fallback');
                }
            });

        // Polling fallback - refresh every 30s in case realtime fails
        const pollInterval = setInterval(() => {
            fetchOrders();
        }, 30000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(pollInterval);
        };
    }, [supabase, user?.id]);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user) return null;


    const toggleSelect = (id: string) => {
        setSelectedOrders(prev =>
            prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]
        );
    };

    const handleBatchUpdate = async (status: string) => {
        if (selectedOrders.length === 0) return;

        // Save current selection for processing
        const idsToUpdate = [...selectedOrders];

        // Optimistic UI Update
        setOrders(prev => prev.map(o =>
            idsToUpdate.includes(o.id) ? { ...o, status: status as any } : o
        ));
        setSelectedOrders([]);

        const { error } = await supabase.rpc("batch_update_order_status", {
            order_ids: idsToUpdate,
            new_status: status
        });

        if (error) {
            alert("Error: " + error.message);
            fetchOrders(); // Rollback on error
        }
        // No fetchOrders() on success - optimistic update handles it
    };

    const handleDeleteOrder = async (id: string) => {
        if (!confirm("Are you sure you want to remove this order from history?")) return;

        const orderToDelete = orders.find(o => o.id === id);

        // 1. Delete from storage first (if file exists)
        if (orderToDelete?.file_path) {
            await supabase.storage.from('documents').remove([orderToDelete.file_path]);
        }

        // 2. Delete the record
        const { error } = await supabase.from('orders').delete().eq('id', id);

        if (error) {
            alert("Error: " + error.message);
        } else {
            setOrders(prev => prev.filter(o => o.id !== id));
        }
    };

    const handleBatchDelete = async () => {
        const completedSelected = orders.filter(o => selectedOrders.includes(o.id) && o.status === 'completed');
        if (completedSelected.length === 0) {
            alert("Only completed (handed over) orders can be manually deleted.");
            return;
        }

        if (!confirm(`Are you sure you want to remove ${completedSelected.length} completed orders?`)) return;

        const idsToDelete = completedSelected.map(o => o.id);
        const filePathsToDelete = completedSelected.map(o => o.file_path).filter(Boolean);

        // 1. Delete from storage (batch)
        if (filePathsToDelete.length > 0) {
            await supabase.storage.from('documents').remove(filePathsToDelete);
        }

        // 2. Delete records
        const { error } = await supabase.from('orders').delete().in('id', idsToDelete);

        if (error) {
            alert("Error: " + error.message);
        } else {
            setOrders(prev => prev.filter(o => !idsToDelete.includes(o.id)));
            setSelectedOrders(prev => prev.filter(id => !idsToDelete.includes(id)));
        }
    };

    const handleDirectPrint = async (order: any) => {
        if (!order.file_path) {
            alert("No file found for this order.");
            return;
        }

        try {
            // 1. Get signed URL
            const { data, error } = await supabase.storage
                .from('documents')
                .createSignedUrl(order.file_path, 300); // 5 mins

            if (error || !data?.signedUrl) throw new Error("Could not get file access");

            // 2. Open in a new tab and trigger print
            // We use window.open because browsers block cross-origin iframe.print()
            const printWindow = window.open(data.signedUrl, '_blank');

            if (printWindow) {
                // Focus the new window
                printWindow.focus();

                // Note: Standard browsers handles PDFs with their own viewer which usually has a print button.
                // For a more automated feel, many browsers support #toolbar=0&navpanes=0&scrollbar=0
                // but window.print() on a direct PDF URL is restricted in some browsers for security.
                // The most reliable way is letting the user use the PDF viewer's print action.
            } else {
                alert("Please allow popups to use the direct print feature.");
            }

            // 3. Update Status to 'printing' (if not already)
            if (order.status === 'queued') {
                setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'printing' } : o));
                await supabase.from('orders').update({ status: 'printing' }).eq('id', order.id);
                // No fetchOrders() - optimistic update is sufficient
            }
        } catch (err: any) {
            alert("Print failed: " + err.message);
        }
    };
    const filteredOrders = orders.filter(order => {
        if (!searchQuery) return true;

        const term = searchQuery.toLowerCase();
        const customerName = (order.profiles as any)?.full_name?.toLowerCase() || "guest";
        const code = (order.pickup_code || "").toLowerCase();
        const status = (order.status || "").toLowerCase();

        return customerName.includes(term) || code.includes(term) || status.includes(term);
    });

    return (
        <div className="min-h-screen bg-slate-50 flex">
            <OwnerSidebar />

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0">
                <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-8 sticky top-0 z-20">
                    <div className="flex items-center gap-2">
                        <div className="lg:hidden w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                            <Printer size={18} />
                        </div>
                        <h2 className="text-sm md:text-lg font-bold truncate">Shop Queue</h2>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        {/* Shop Status Toggle */}
                        <button
                            onClick={toggleShopStatus}
                            className={cn(
                                "flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm border",
                                shopSettings.is_open
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                    : "bg-red-50 text-red-600 border-red-100"
                            )}
                        >
                            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", shopSettings.is_open ? "bg-emerald-500" : "bg-red-500")} />
                            <span className="hidden xs:inline">{shopSettings.is_open ? "Open" : "Closed"}</span>
                        </button>

                        <button
                            onClick={() => setIsHandoverOpen(true)}
                            className="bg-blue-600 text-white px-3 md:px-4 py-1.5 rounded-full text-[10px] md:text-sm font-bold flex items-center gap-2 hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-100"
                        >
                            <Handshake size={16} />
                            <span className="hidden sm:inline">Verify Code</span>
                        </button>

                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                placeholder="Search orders..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>

                        <div className="relative flex items-center">
                            <button
                                onClick={() => {
                                    setIsNotificationOpen(!isNotificationOpen);
                                    if (!isNotificationOpen) setNotifications(0);
                                }}
                                className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors"
                            >
                                <Bell size={20} />
                                {notifications > 0 && (
                                    <span className="absolute top-1 right-1 flex h-4 w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 items-center justify-center text-[10px] text-white font-bold">{notifications}</span>
                                    </span>
                                )}
                            </button>

                            {/* Notification Panel */}
                            <AnimatePresence>
                                {isNotificationOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                        className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50"
                                    >
                                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                                            <h4 className="font-bold text-sm">Notifications</h4>
                                            <button
                                                onClick={() => setIsNotificationOpen(false)}
                                                className="p-1 hover:bg-slate-100 rounded-full"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto">
                                            {notificationEvents.length === 0 ? (
                                                <div className="p-6 text-center text-slate-400">
                                                    <Bell size={24} className="mx-auto mb-2 opacity-50" />
                                                    <p className="text-sm font-medium">No new notifications</p>
                                                </div>
                                            ) : (
                                                notificationEvents.map((event, idx) => (
                                                    <div key={idx} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                                        <div className="flex items-start gap-3">
                                                            <div className={cn(
                                                                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                                                event.type === 'new_order' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                                                            )}>
                                                                {event.type === 'new_order' ? <Printer size={14} /> : <Eye size={14} />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-slate-800 truncate">{event.message}</p>
                                                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{event.time}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        {notificationEvents.length > 0 && (
                                            <div className="p-3 border-t border-slate-100">
                                                <button
                                                    onClick={() => { setNotificationEvents([]); setIsNotificationOpen(false); }}
                                                    className="w-full text-xs font-bold text-blue-600 hover:underline"
                                                >
                                                    Mark all as read
                                                </button>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <button
                            onClick={signOut}
                            className="lg:hidden p-2 text-slate-400 hover:text-red-500 transition-colors ml-2"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>

                <HandoverModal
                    isOpen={isHandoverOpen}
                    onClose={() => setIsHandoverOpen(false)}
                    onSuccess={fetchOrders}
                />

                {/* Dashboard Content */}
                <div className="p-8 space-y-8">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {stats.map((stat: any, i) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                key={stat.label}
                                onClick={() => stat.isStatus && toggleShopStatus()}
                                className={cn(
                                    "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all",
                                    stat.isStatus && "cursor-pointer hover:border-blue-400 active:scale-95"
                                )}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-2 bg-slate-50 rounded-lg">{stat.icon}</div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</span>
                                </div>
                                <div className={cn(
                                    "text-2xl font-black",
                                    stat.isStatus && (shopSettings.is_open ? "text-emerald-600" : "text-red-600")
                                )}>
                                    {stat.value}
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Batch Actions Float */}
                    <AnimatePresence>
                        {selectedOrders.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full flex items-center gap-6 shadow-2xl z-50 border border-white/10 backdrop-blur-md"
                            >
                                <span className="text-sm font-bold border-r border-white/20 pr-6">
                                    {selectedOrders.length} Selected
                                </span>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => handleBatchUpdate('printing')}
                                        className="text-sm font-bold hover:text-blue-400 transition-colors"
                                    >
                                        Start Printing
                                    </button>
                                    <button
                                        onClick={() => handleBatchUpdate('ready')}
                                        className="text-sm font-bold hover:text-emerald-400 transition-colors"
                                    >
                                        Mark Ready
                                    </button>
                                    <button
                                        onClick={() => handleBatchUpdate('completed')}
                                        className="text-sm font-bold hover:text-blue-400 transition-colors"
                                    >
                                        Handover
                                    </button>
                                    <button
                                        onClick={handleBatchDelete}
                                        className="text-sm font-bold text-red-400 hover:text-red-500 transition-colors"
                                    >
                                        Delete Selected
                                    </button>
                                    <button
                                        onClick={() => setSelectedOrders([])}
                                        className="text-sm font-bold text-slate-400 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Orders Table */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-6 py-4 w-10">
                                            <button
                                                onClick={() => setSelectedOrders(selectedOrders.length === orders.length ? [] : orders.map(o => o.id))}
                                                className="text-slate-400"
                                            >
                                                {selectedOrders.length === orders.length && orders.length > 0 ? <CheckSquare size={20} /> : <Square size={20} />}
                                            </button>
                                        </th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Pickup Code</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Pages</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cost</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {loading ? (
                                        <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">Loading queue...</td></tr>
                                    ) : filteredOrders.length === 0 ? (
                                        <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">No orders matching your search.</td></tr>
                                    ) : filteredOrders.map((order) => (
                                        <tr
                                            key={order.id}
                                            className={cn(
                                                "hover:bg-slate-50 transition-colors group",
                                                selectedOrders.includes(order.id) && "bg-blue-50/50 hover:bg-blue-50"
                                            )}
                                        >
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => toggleSelect(order.id)}
                                                    className={cn("transition-colors", selectedOrders.includes(order.id) ? "text-blue-600" : "text-slate-300 group-hover:text-slate-400")}
                                                >
                                                    {selectedOrders.includes(order.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded text-sm tracking-widest">
                                                    #{order.pickup_code}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900">{(order.profiles as any)?.full_name || "Guest"}</div>
                                                <div className="text-[10px] font-bold text-slate-500 flex flex-col uppercase tracking-tighter leading-tight mt-0.5">
                                                    <span>{new Date(order.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}</span>
                                                    <span className="text-slate-400">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900">{order.total_pages} Pages</div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    <span className={cn(
                                                        "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter",
                                                        order.print_type === 'COLOR' ? "bg-orange-100 text-orange-600 border border-orange-200" : "bg-slate-100 text-slate-600 border border-slate-200"
                                                    )}>
                                                        {order.print_type === 'COLOR' ? 'Color' : 'B&W'}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter bg-blue-100 text-blue-600 border border-blue-200">
                                                        {order.side_type === 'DOUBLE' ? 'Double' : 'Single'}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter bg-purple-100 text-purple-600 border border-purple-200">
                                                        PGS: {order.page_range || 'All'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-slate-900 leading-none">₹{Number(order.estimated_cost).toFixed(2)}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-tighter">
                                                    {(order.payment_status === 'paid' || order.payment_verified) ? '✓ Paid' : 'Unpaid'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={order.status} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-100">
                                                    {order.status === 'pending_verification' && (
                                                        <>
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    if (!order.payment_screenshot) {
                                                                        alert("No screenshot available.");
                                                                        return;
                                                                    }
                                                                    const { data, error } = await supabase.storage.from('payments').createSignedUrl(order.payment_screenshot, 60);
                                                                    if (error) {
                                                                        alert("Error: " + error.message);
                                                                        return;
                                                                    }
                                                                    if (data?.signedUrl) window.open(data.signedUrl);
                                                                }}
                                                                title="View Proof"
                                                                className="p-2.5 text-purple-600 hover:bg-purple-100 rounded-xl transition-all border border-purple-200 bg-purple-50 shadow-sm"
                                                            >
                                                                <Eye size={18} />
                                                            </button>
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    // Optimistic Update only - realtime will sync
                                                                    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, payment_status: 'paid', status: 'queued' } : o));

                                                                    const { error } = await supabase.from('orders')
                                                                        .update({ payment_status: 'paid', status: 'queued' })
                                                                        .eq('id', order.id);

                                                                    if (error) {
                                                                        alert("Failed to confirm: " + error.message);
                                                                        fetchOrders(); // Rollback on error only
                                                                    }
                                                                }}
                                                                title="Confirm Payment"
                                                                className="p-2.5 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-200 bg-emerald-50 shadow-sm"
                                                            >
                                                                <CheckCircle2 size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {order.status === 'queued' && (
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                handleDirectPrint(order);
                                                            }}
                                                            title="Start Printing"
                                                            className="p-2.5 text-blue-600 hover:bg-blue-100 rounded-xl transition-all border border-blue-200 bg-blue-50 shadow-sm"
                                                        >
                                                            <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                                                                <Printer size={18} />
                                                            </motion.div>
                                                        </button>
                                                    )}
                                                    {order.status === 'printing' && (
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                // Optimistic Update only
                                                                setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'ready' } : o));

                                                                const { error } = await supabase.from('orders').update({ status: 'ready' }).eq('id', order.id);
                                                                if (error) {
                                                                    alert("Error: " + error.message);
                                                                    fetchOrders(); // Rollback on error only
                                                                }
                                                            }}
                                                            title="Mark Ready"
                                                            className="p-2.5 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-200 bg-emerald-50 shadow-sm"
                                                        >
                                                            <CheckCircle2 size={18} />
                                                        </button>
                                                    )}
                                                    {order.status === 'completed' && (
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                handleDeleteOrder(order.id);
                                                            }}
                                                            title="Delete Order"
                                                            className="p-2.5 text-red-600 hover:bg-red-100 rounded-xl transition-all border border-red-200 bg-red-50 shadow-sm"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (!order.file_path) {
                                                                alert("No document file linked.");
                                                                return;
                                                            }
                                                            const { data, error } = await supabase.storage.from('documents').createSignedUrl(order.file_path, 60);
                                                            if (error) {
                                                                alert("Error: " + error.message);
                                                                return;
                                                            }
                                                            if (data?.signedUrl) window.open(data.signedUrl);
                                                        }}
                                                        title="Download Document"
                                                        className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 bg-slate-50 shadow-sm"
                                                    >
                                                        <Download size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div >
    );
}

function NavItem({ icon, label, active = false }: any) {
    return (
        <div className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer",
            active ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
        )}>
            {icon}
            {label}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: any = {
        pending_payment: "bg-slate-50 text-slate-400 border-slate-100",
        pending_verification: "bg-purple-50 text-purple-600 border-purple-100",
        queued: "bg-orange-50 text-orange-600 border-orange-100",
        printing: "bg-blue-50 text-blue-600 border-blue-100",
        ready: "bg-emerald-50 text-emerald-600 border-emerald-100",
        completed: "bg-slate-100 text-slate-500 border-slate-200",
    };

    const labels: any = {
        pending_payment: "Pending Pay",
        pending_verification: "Verifying",
        queued: "In Queue",
        printing: "Printing",
        ready: "Ready",
        completed: "Handed Over",
    };

    return (
        <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border", styles[status])}>
            {labels[status] || status}
        </span>
    );
}
