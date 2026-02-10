"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState, useMemo } from "react";

export const useAuth = () => {
    const supabase = useMemo(() => createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ), []);

    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    setUser(session.user);
                    // Fetch profile without blocking loading state
                    supabase.from("profiles").select("*").eq("id", session.user.id).single()
                        .then(({ data }) => data && setProfile(data));
                }
            } catch (err) {
                console.error("Auth error:", err);
            } finally {
                setLoading(false);
            }
        };

        initAuth();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session) {
                    setUser(session.user);
                    supabase.from("profiles").select("*").eq("id", session.user.id).single()
                        .then(({ data }) => data && setProfile(data));
                } else {
                    setUser(null);
                    setProfile(null);
                }

                if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                    setLoading(false);
                }
            }
        );

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [supabase]);

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            window.location.replace("/login");
        } catch (error) {
            console.error("Sign out error:", error);
            window.location.replace("/login");
        }
    };

    return { user, profile, loading, signOut, supabase };
};
