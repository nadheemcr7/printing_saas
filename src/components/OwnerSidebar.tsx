"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import {
    Printer,
    Users,
    TrendingUp,
    Settings,
    LogOut
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function OwnerSidebar() {
    const { profile, signOut, supabase } = useAuth();
    const pathname = usePathname();
    const [shopName, setShopName] = useState("Solve Print");

    useEffect(() => {
        const fetchName = async () => {
            const { data } = await supabase.from("shop_settings").select("shop_name").limit(1).single();
            if (data?.shop_name) setShopName(data.shop_name);
        };
        fetchName();

        const channel = supabase
            .channel("sidebar_name_sync")
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shop_settings" }, (payload) => {
                if (payload.new.shop_name) setShopName(payload.new.shop_name);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    const navItems = [
        { href: "/dashboard/owner", label: "Live Queue", icon: <Users size={20} /> },
        { href: "/dashboard/owner/analytics", label: "Analytics", icon: <TrendingUp size={20} /> },
        { href: "/dashboard/owner/settings", label: "Shop Settings", icon: <Settings size={20} /> },
    ];

    return (
        <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col hidden lg:flex h-screen sticky top-0">
            <div className="flex items-center gap-2 mb-10">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                    <Printer size={20} />
                </div>
                <span className="font-bold text-xl tracking-tight truncate">{shopName}</span>
            </div>

            <nav className="space-y-1 flex-1">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-all",
                            pathname === item.href
                                ? "bg-blue-50 text-blue-600 shadow-sm"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                        )}
                    >
                        {item.icon}
                        {item.label}
                    </Link>
                ))}
            </nav>

            <div className="pt-6 border-t border-slate-100">
                <div className="flex items-center gap-3 mb-4 px-2">
                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-400 font-bold text-xs">
                        {profile?.full_name?.charAt(0) || "O"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{profile?.full_name || "Owner"}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{profile?.role}</p>
                    </div>
                </div>
                <button
                    onClick={signOut}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 group active:scale-95"
                >
                    <LogOut size={18} className="group-hover:-translate-x-0.5 transition-transform duration-200" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
