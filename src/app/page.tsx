"use client";

import { motion } from "framer-motion";
import { Printer, Zap, Shield, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function LandingPage() {
  const { user, profile, signOut, loading } = useAuth();

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Printer size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight">Solve Print</span>
          </div>

          {!loading && (
            <div className="flex items-center gap-6">
              {user ? (
                <>
                  <Link
                    href={profile?.role === 'owner' ? '/dashboard/owner' : profile?.role === 'developer' ? '/dashboard/developer' : '/dashboard/customer'}
                    className="text-sm font-bold text-blue-600 hover:text-blue-700 underline decoration-blue-200 underline-offset-4"
                  >
                    Go to Dashboard
                  </Link>
                  <button
                    onClick={signOut}
                    className="bg-red-50 text-red-600 px-5 py-2 rounded-full text-sm font-bold hover:bg-red-100 hover:shadow-lg hover:shadow-red-100 transition-all duration-200 active:scale-95 flex items-center gap-2"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="bg-slate-950 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-slate-800 transition-all shadow-md active:scale-95"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-sm font-bold mb-6"
            >
              <Sparkles size={16} />
              <span>Smart Digital Printing for Colleges</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-6xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]"
            >
              Skip the queue. <br />
              <span className="text-blue-600">Print with ease.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-slate-500 mb-10 leading-relaxed"
            >
              Upload your documents, pay instantly via UPI, and collect your prints with a 3-digit code. No more waiting at the counter.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              {user ? (
                <Link
                  href={profile?.role === 'owner' ? '/dashboard/owner' : profile?.role === 'developer' ? '/dashboard/developer' : '/dashboard/customer'}
                  className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 flex items-center justify-center gap-2 group active:scale-95"
                >
                  Return to Dashboard
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 flex items-center justify-center gap-2 group active:scale-95"
                  >
                    Start Printing Now
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    href="/login"
                    className="bg-white text-slate-900 border-2 border-slate-100 px-8 py-4 rounded-2xl font-bold text-lg hover:border-slate-300 transition-all flex items-center justify-center active:scale-95"
                  >
                    Owner Login
                  </Link>
                </>
              )}
            </motion.div>
          </div>
        </div>

        {/* Background Decor */}
        <div className="absolute top-0 right-[-10%] w-[60%] h-full pointer-events-none opacity-10">
          <div className="w-full h-full bg-blue-600 blur-[120px] rounded-full translate-x-1/2" />
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Zap className="text-orange-500" />}
              title="Hyper-Fast Batching"
              description="One-click status updates for shop owners to handle peak hour crowds with zero stress."
              delay={0.1}
            />
            <FeatureCard
              icon={<Shield className="text-emerald-500" />}
              title="Secure UPI Payments"
              description="0% transaction fee direct bank transfers. Safe, secure, and university-standard."
              delay={0.2}
            />
            <FeatureCard
              icon={<Sparkles className="text-purple-500" />}
              title="Fair Price Guarantee"
              description="System counts pages automatically for accurate bill calculation."
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* Social Proof/Workflow */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold tracking-tight mb-4">How it works</h2>
            <p className="text-lg text-slate-500">From PDF to Print in 4 simple steps.</p>
          </div>

          <div className="relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 hidden md:block" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative z-10">
              <Step number="01" title="Upload" description="Drag and drop your PDF or Doc files." />
              <Step number="02" title="Price Preview" description="System scans pages and calculates ₹ cost." />
              <Step number="03" title="Scan & Pay" description="Instant UPI payment from any app." />
              <Step number="04" title="Collect" description="Pick up with your 3-digit pickup code." />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <Printer size={18} />
            </div>
            <span className="font-bold tracking-tight">Solve Print</span>
          </div>
          <p className="text-sm text-slate-400 font-medium">Built for college efficiency. ⚡</p>
          <div className="flex gap-10 text-sm font-bold text-slate-500">
            <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Terms</a>
            <a href="https://github.com/nadheemcr7/printing_saas" className="hover:text-blue-600 transition-colors underline decoration-blue-200">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-shadow group"
    >
      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-slate-500 leading-relaxed">{description}</p>
    </motion.div>
  );
}

function Step({ number, title, description }: any) {
  return (
    <div className="text-center group">
      <div className="w-12 h-12 bg-white border-2 border-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 relative z-20 group-hover:border-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all font-bold text-slate-400">
        {number}
      </div>
      <h4 className="text-lg font-bold mb-2">{title}</h4>
      <p className="text-sm text-slate-500 px-4">{description}</p>
    </div>
  );
}
