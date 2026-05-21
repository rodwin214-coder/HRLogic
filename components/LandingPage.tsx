import React, { useState, useEffect } from 'react';
import { WORKLOGIX_LOGO_BASE64 } from '../services/supabaseApi';

interface LandingPageProps {
    onGetStarted: () => void;
    onLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeFeature, setActiveFeature] = useState(0);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => setActiveFeature(f => (f + 1) % features.length), 4000);
        return () => clearInterval(interval);
    }, []);

    const scrollTo = (id: string) => {
        setMobileMenuOpen(false);
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

            {/* ── Navbar ─────────────────────────────────────────── */}
            <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <img src={WORKLOGIX_LOGO_BASE64} alt="WorkLogix" className="h-10 w-auto" />
                    <nav className="hidden md:flex items-center gap-8">
                        {[['Features', 'features'], ['How It Works', 'how-it-works'], ['Modules', 'modules'], ['For Teams', 'for-teams']].map(([label, id]) => (
                            <button key={id} onClick={() => scrollTo(id)}
                                className={`text-sm font-medium transition-colors ${scrolled ? 'text-gray-600 hover:text-gray-900' : 'text-white/80 hover:text-white'}`}>
                                {label}
                            </button>
                        ))}
                    </nav>
                    <div className="hidden md:flex items-center gap-3">
                        <button onClick={onLogin}
                            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white/90 hover:text-white'}`}>
                            Sign In
                        </button>
                        <button onClick={onGetStarted}
                            className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all shadow-md hover:shadow-lg"
                            style={{ background: 'rgb(15,44,82)' }}>
                            Get Started Free
                        </button>
                    </div>
                    {/* Mobile menu button */}
                    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={`md:hidden p-2 rounded-lg ${scrolled ? 'text-gray-700' : 'text-white'}`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {mobileMenuOpen
                                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                        </svg>
                    </button>
                </div>
                {/* Mobile menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3 shadow-lg">
                        {[['Features', 'features'], ['How It Works', 'how-it-works'], ['Modules', 'modules'], ['For Teams', 'for-teams']].map(([label, id]) => (
                            <button key={id} onClick={() => scrollTo(id)} className="block w-full text-left text-sm font-medium text-gray-700 py-1">{label}</button>
                        ))}
                        <hr className="border-gray-100" />
                        <button onClick={onLogin} className="block w-full text-left text-sm font-medium text-gray-700 py-1">Sign In</button>
                        <button onClick={onGetStarted} className="w-full py-2 text-sm font-semibold text-white rounded-lg" style={{ background: 'rgb(15,44,82)' }}>Get Started Free</button>
                    </div>
                )}
            </header>

            {/* ── Hero ────────────────────────────────────────────── */}
            <section className="relative min-h-screen flex items-center overflow-hidden" style={{ background: 'linear-gradient(135deg, rgb(15,44,82) 0%, rgb(10,30,58) 50%, rgb(13,148,136) 100%)' }}>
                {/* Decorative circles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10" style={{ background: 'rgb(13,148,136)' }} />
                    <div className="absolute top-1/2 -left-24 w-64 h-64 rounded-full opacity-5 bg-white" />
                    <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-5 bg-white" />
                    {/* Grid lines */}
                    <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/>
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                </div>

                <div className="relative max-w-7xl mx-auto px-6 py-32 grid lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 border border-white/20" style={{ background: 'rgba(255,255,255,0.1)', color: '#7dd3fc' }}>
                            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                            Built for Philippine businesses
                        </div>
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                            Modern HR &amp;<br />
                            <span style={{ color: 'rgb(45,212,191)' }}>Payroll</span> built<br />
                            for your team
                        </h1>
                        <p className="text-lg text-white/70 leading-relaxed mb-10 max-w-lg">
                            WorkLogix streamlines attendance tracking, leave management, and full payroll computation — including SSS, PhilHealth, Pag-IBIG, and BIR compliance — all in one platform.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <button onClick={onGetStarted}
                                className="px-8 py-3.5 text-base font-bold rounded-xl text-white shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
                                style={{ background: 'rgb(13,148,136)' }}>
                                Start for Free
                            </button>
                            <button onClick={onLogin}
                                className="px-8 py-3.5 text-base font-semibold rounded-xl border border-white/30 text-white hover:bg-white/10 transition-all">
                                Sign In
                            </button>
                        </div>
                        <div className="mt-10 flex items-center gap-6">
                            {[['Multi-company', ''], ['SSS / PhilHealth / BIR', ''], ['PDF Payslips', '']].map(([label]) => (
                                <div key={label} className="flex items-center gap-1.5 text-sm text-white/60">
                                    <svg className="w-4 h-4 text-teal-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    {label}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Hero card mockup */}
                    <div className="hidden lg:block">
                        <div className="relative">
                            <div className="rounded-2xl shadow-2xl overflow-hidden border border-white/10" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)' }}>
                                {/* Header bar */}
                                <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
                                    <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400/60" /><div className="w-3 h-3 rounded-full bg-yellow-400/60" /><div className="w-3 h-3 rounded-full bg-green-400/60" /></div>
                                    <span className="text-xs text-white/50 font-mono">WorkLogix Dashboard</span>
                                </div>
                                <div className="p-6 space-y-4">
                                    {/* Stats row */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {[['Employees', '24', 'text-blue-300'], ['On Leave', '3', 'text-amber-300'], ['Payroll', '₱218K', 'text-teal-300']].map(([l, v, c]) => (
                                            <div key={l} className="rounded-xl p-3 text-center border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                <p className={`text-xl font-bold ${c}`}>{v}</p>
                                                <p className="text-xs text-white/50 mt-0.5">{l}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Attendance bars */}
                                    <div className="rounded-xl p-4 border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                        <p className="text-xs text-white/50 mb-3 font-medium uppercase tracking-wide">This Week's Attendance</p>
                                        <div className="space-y-2.5">
                                            {[['Mon', 95, 'bg-teal-400'], ['Tue', 88, 'bg-teal-400'], ['Wed', 100, 'bg-teal-400'], ['Thu', 92, 'bg-blue-400'], ['Fri', 78, 'bg-blue-400']].map(([d, pct, color]) => (
                                                <div key={d} className="flex items-center gap-3">
                                                    <span className="text-xs text-white/40 w-6">{d}</span>
                                                    <div className="flex-1 h-2 rounded-full bg-white/10">
                                                        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span className="text-xs text-white/50 w-8 text-right">{pct}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Recent payslip row */}
                                    <div className="flex items-center justify-between rounded-xl p-3 border border-white/10" style={{ background: 'rgba(13,148,136,0.15)' }}>
                                        <div>
                                            <p className="text-xs text-white/60">Latest Payroll Period</p>
                                            <p className="text-sm font-semibold text-white">May 1–15, 2026</p>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300">Paid</span>
                                    </div>
                                </div>
                            </div>
                            {/* Floating badge */}
                            <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: 'rgb(15,44,82)' }}>
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Payslip generated</p>
                                    <p className="text-sm font-semibold text-gray-800">Juan dela Cruz</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Wave divider */}
                <div className="absolute bottom-0 left-0 right-0">
                    <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="w-full h-16" fill="white">
                        <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" />
                    </svg>
                </div>
            </section>

            {/* ── Trust bar ────────────────────────────────────────── */}
            <section className="py-10 border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6">
                    <p className="text-center text-sm text-gray-400 font-medium mb-6 uppercase tracking-widest">Compliant with Philippine government regulations</p>
                    <div className="flex flex-wrap justify-center gap-8 items-center">
                        {[
                            { name: 'SSS', color: 'text-blue-700', bg: 'bg-blue-50', desc: 'Social Security System' },
                            { name: 'PhilHealth', color: 'text-green-700', bg: 'bg-green-50', desc: 'Health Insurance' },
                            { name: 'Pag-IBIG', color: 'text-red-700', bg: 'bg-red-50', desc: 'Housing Fund' },
                            { name: 'BIR', color: 'text-amber-700', bg: 'bg-amber-50', desc: 'Withholding Tax' },
                            { name: 'P.D. 851', color: 'text-teal-700', bg: 'bg-teal-50', desc: '13th Month Pay' },
                        ].map(item => (
                            <div key={item.name} className={`flex items-center gap-2 px-4 py-2 rounded-full ${item.bg}`}>
                                <span className={`text-sm font-bold ${item.color}`}>{item.name}</span>
                                <span className="text-xs text-gray-500">{item.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Features highlights ─────────────────────────────── */}
            <section id="features" className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'rgb(13,148,136)' }}>Everything in one place</span>
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-3 mb-4">HR and Payroll, simplified</h2>
                        <p className="text-lg text-gray-500 max-w-2xl mx-auto">From the moment an employee clocks in to when their payslip is generated — WorkLogix handles it all.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
                                title: 'Real-Time Attendance',
                                desc: 'Employees clock in and out from any device. Track late, absent, overtime, and undertime with configurable grace periods and shift schedules.',
                                color: 'text-blue-600', bg: 'bg-blue-50',
                            },
                            {
                                icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
                                title: 'Automated Payroll',
                                desc: 'Generate payroll with a single click. Automatically computes basic pay, overtime, holiday pay, night differential, contributions, and withholding tax.',
                                color: 'text-teal-600', bg: 'bg-teal-50',
                            },
                            {
                                icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
                                title: 'Leave Management',
                                desc: 'Employees file leave requests; managers approve or reject. Track vacation, sick, and custom leave types with automatic balance computation.',
                                color: 'text-amber-600', bg: 'bg-amber-50',
                            },
                            {
                                icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
                                title: 'PDF Payslips',
                                desc: 'Professionally designed payslips generated as PDF for every employee — including a full earnings and deductions breakdown per period.',
                                color: 'text-green-600', bg: 'bg-green-50',
                            },
                            {
                                icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
                                title: 'Employee Management',
                                desc: 'Manage employee profiles, departments, custom fields, files and documents. Bulk invite employees via email and assign them to shifts.',
                                color: 'text-rose-600', bg: 'bg-rose-50',
                            },
                            {
                                icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
                                title: 'Reports & Analytics',
                                desc: 'Payroll register, government contribution reports, attendance cost analysis, 13th month accrual — all printable and export-ready.',
                                color: 'text-sky-600', bg: 'bg-sky-50',
                            },
                        ].map(f => (
                            <div key={f.title} className="group p-6 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 bg-white">
                                <div className={`w-12 h-12 rounded-xl ${f.bg} ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                    {f.icon}
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How It Works ─────────────────────────────────────── */}
            <section id="how-it-works" className="py-24" style={{ background: 'rgb(248,250,252)' }}>
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'rgb(13,148,136)' }}>Simple setup</span>
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-3 mb-4">Up and running in minutes</h2>
                        <p className="text-lg text-gray-500">No IT team required. Just create your company, invite your team, and go.</p>
                    </div>
                    <div className="grid md:grid-cols-4 gap-6 relative">
                        {/* connector line */}
                        <div className="hidden md:block absolute top-10 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-blue-200 via-teal-200 to-blue-200 z-0" />
                        {[
                            { step: '01', title: 'Create your company', desc: 'Register with a company code and set up your profile, work schedule, and pay policies.' },
                            { step: '02', title: 'Invite employees', desc: 'Send bulk email invitations. Employees register using your company code and complete their profiles.' },
                            { step: '03', title: 'Track attendance', desc: 'Employees clock in and out. Manage requests for leave, overtime, and undertime.' },
                            { step: '04', title: 'Run payroll', desc: 'Click "Generate" to compute payroll for the period. Review, adjust, and mark as paid.' },
                        ].map((s, i) => (
                            <div key={s.step} className="relative z-10 text-center">
                                <div className={`w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-md text-white font-bold text-lg`}
                                    style={{ background: i % 2 === 0 ? 'rgb(15,44,82)' : 'rgb(13,148,136)' }}>
                                    {s.step}
                                </div>
                                <h3 className="text-base font-bold text-gray-900 mb-2">{s.title}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Feature deep-dive tabs ───────────────────────────── */}
            <section id="modules" className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'rgb(13,148,136)' }}>Modules</span>
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-3 mb-4">Every tool your HR team needs</h2>
                    </div>

                    <div className="grid lg:grid-cols-5 gap-4 mb-8">
                        {features.map((f, i) => (
                            <button key={f.id}
                                onClick={() => setActiveFeature(i)}
                                className={`text-left p-4 rounded-xl border transition-all ${activeFeature === i ? 'border-transparent text-white shadow-lg' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                style={activeFeature === i ? { background: 'linear-gradient(135deg, rgb(15,44,82), rgb(13,90,130))' } : {}}>
                                <div className={`mb-2 ${activeFeature === i ? 'text-teal-300' : 'text-gray-400'}`}>{f.icon}</div>
                                <p className={`text-sm font-semibold ${activeFeature === i ? 'text-white' : 'text-gray-800'}`}>{f.title}</p>
                            </button>
                        ))}
                    </div>

                    <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                        <div className="grid lg:grid-cols-2">
                            <div className="p-10 flex flex-col justify-center">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-white`} style={{ background: 'rgb(15,44,82)' }}>
                                    {features[activeFeature].icon}
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-4">{features[activeFeature].title}</h3>
                                <p className="text-gray-500 leading-relaxed mb-6">{features[activeFeature].longDesc}</p>
                                <ul className="space-y-2.5">
                                    {features[activeFeature].bullets.map(b => (
                                        <li key={b} className="flex items-start gap-2.5 text-sm text-gray-700">
                                            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'rgb(13,148,136)' }} fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            {b}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="flex items-center justify-center p-10 border-t lg:border-t-0 lg:border-l border-gray-100"
                                style={{ background: 'linear-gradient(135deg, rgb(248,250,252), rgb(239,246,255))' }}>
                                {features[activeFeature].visual}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── For Teams ────────────────────────────────────────── */}
            <section id="for-teams" className="py-24" style={{ background: 'rgb(248,250,252)' }}>
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'rgb(13,148,136)' }}>Two dashboards, one platform</span>
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-3 mb-4">Built for both sides of the team</h2>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Employer */}
                        <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-white">
                            <div className="px-8 pt-8 pb-6" style={{ background: 'linear-gradient(135deg, rgb(15,44,82), rgb(10,30,58))' }}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-lg">For Employers</p>
                                        <p className="text-white/60 text-xs">Full HR administration</p>
                                    </div>
                                </div>
                                <p className="text-white/70 text-sm leading-relaxed">Complete visibility and control over your entire workforce — from hiring to payroll.</p>
                            </div>
                            <div className="p-8">
                                <ul className="space-y-3">
                                    {['Employee directory with custom fields', 'Attendance monitoring & manual corrections', 'Approve/reject leave, OT, and undertime requests', 'Run and process payroll for all employees', 'Generate government contribution reports', 'Holiday calendar and shift scheduling', 'Company profile and leave policy setup', 'Bulk employee invitations via email'].map(item => (
                                        <li key={item} className="flex items-center gap-2.5 text-sm text-gray-700">
                                            <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'rgb(15,44,82)' }} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        {/* Employee */}
                        <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-white">
                            <div className="px-8 pt-8 pb-6" style={{ background: 'linear-gradient(135deg, rgb(13,148,136), rgb(6,95,70))' }}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-lg">For Employees</p>
                                        <p className="text-white/60 text-xs">Self-service portal</p>
                                    </div>
                                </div>
                                <p className="text-white/70 text-sm leading-relaxed">Everything employees need to manage their work life, without bothering HR for every request.</p>
                            </div>
                            <div className="p-8">
                                <ul className="space-y-3">
                                    {['Clock in and out from any device', 'File leave, overtime, and undertime requests', 'View leave balance and attendance history', 'Download payslips as PDF', 'View personal payroll records', 'Complete and update personal profile', 'Receive notifications on request status', 'Change password securely'].map(item => (
                                        <li key={item} className="flex items-center gap-2.5 text-sm text-gray-700">
                                            <svg className="w-4 h-4 flex-shrink-0 text-teal-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── PH Compliance callout ─────────────────────────────── */}
            <section className="py-20 bg-white">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="rounded-3xl overflow-hidden shadow-lg" style={{ background: 'linear-gradient(135deg, rgb(15,44,82) 0%, rgb(13,148,136) 100%)' }}>
                        <div className="grid md:grid-cols-2 gap-0">
                            <div className="p-10 lg:p-14">
                                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">100% Philippine labor law compliant</h2>
                                <p className="text-white/70 mb-8 text-sm leading-relaxed">WorkLogix is built specifically for the Philippines — using the latest 2025 SSS, PhilHealth, and Pag-IBIG contribution brackets, TRAIN Law tax tables, and P.D. 851 for 13th month pay.</p>
                                <button onClick={onGetStarted} className="px-7 py-3 bg-white font-bold text-sm rounded-xl hover:bg-gray-50 transition-all shadow-md"
                                    style={{ color: 'rgb(15,44,82)' }}>
                                    Get Started Free
                                </button>
                            </div>
                            <div className="p-10 lg:p-14 border-t md:border-t-0 md:border-l border-white/10">
                                <div className="space-y-4">
                                    {[
                                        ['SSS 2025', 'Updated contribution brackets and employer matching'],
                                        ['PhilHealth 5%', 'Employee and employer 2.5% / 2.5% split'],
                                        ['Pag-IBIG 2%', 'Both employee and employer contributions tracked'],
                                        ['BIR TRAIN Law', 'Withholding tax computed using current tables'],
                                        ['13th Month Pay', 'Accrued each period per P.D. 851'],
                                        ['Overtime Rates', 'Regular (125%), Holiday (200%), Rest Day (130%)'],
                                    ].map(([title, desc]) => (
                                        <div key={title} className="flex items-start gap-3">
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-teal-400/20">
                                                <svg className="w-3 h-3 text-teal-300" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-white">{title}</p>
                                                <p className="text-xs text-white/55">{desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── CTA ──────────────────────────────────────────────── */}
            <section className="py-24" style={{ background: 'rgb(248,250,252)' }}>
                <div className="max-w-3xl mx-auto px-6 text-center">
                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Ready to simplify your HR?</h2>
                    <p className="text-lg text-gray-500 mb-10">Join companies already using WorkLogix to manage their workforce smarter. Setup takes less than 5 minutes.</p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <button onClick={onGetStarted}
                            className="px-10 py-4 text-base font-bold text-white rounded-xl shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
                            style={{ background: 'rgb(15,44,82)' }}>
                            Create Your Company — Free
                        </button>
                        <button onClick={onLogin}
                            className="px-10 py-4 text-base font-semibold rounded-xl border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
                            Sign In to Existing Account
                        </button>
                    </div>
                </div>
            </section>

            {/* ── Footer ───────────────────────────────────────────── */}
            <footer className="py-10 border-t border-gray-100 bg-white">
                <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <img src={WORKLOGIX_LOGO_BASE64} alt="WorkLogix" className="h-8 w-auto" />
                    <p className="text-sm text-gray-400">Built for Philippine businesses · SSS · PhilHealth · Pag-IBIG · BIR compliant</p>
                    <div className="flex gap-4">
                        <button onClick={onLogin} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Sign In</button>
                        <button onClick={onGetStarted} className="text-sm font-semibold hover:opacity-80 transition-colors" style={{ color: 'rgb(15,44,82)' }}>Get Started</button>
                    </div>
                </div>
            </footer>
        </div>
    );
};

// ── Feature module data ────────────────────────────────────────────────────

const iconStyle = "w-6 h-6";

const features = [
    {
        id: 'payroll',
        title: 'Payroll',
        icon: <svg className={iconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
        longDesc: 'Generate accurate payroll for your entire workforce with one click. WorkLogix handles all earnings and deductions, produces PDF payslips, and tracks each period from draft to paid.',
        bullets: [
            'Automatic basic pay, daily rate, and hourly rate computation',
            'Overtime, holiday, night differential, and rest day pay',
            'SSS, PhilHealth, Pag-IBIG, and BIR withholding tax deductions',
            '13th month pay accrual per period (P.D. 851)',
            'De minimis benefits and employer-shouldered contributions',
            'Other adjustments: bonuses, loans, cash advances',
            'PDF payslips per employee, printable bulk export',
        ],
        visual: <PayrollVisual />,
    },
    {
        id: 'attendance',
        title: 'Attendance',
        icon: <svg className={iconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
        longDesc: 'Track employee attendance in real time. Employees clock in and out from any device. The system automatically detects late arrivals, absences, and undertime based on their assigned shift.',
        bullets: [
            'One-tap clock in and clock out from mobile or desktop',
            'Configurable grace period per company',
            'Late and undertime deduction computed automatically',
            'Manual attendance entry by employer for corrections',
            'Daily, weekly, and period-level attendance summaries',
            'Shift-based scheduling (Mon–Fri, Mon–Sat, custom)',
        ],
        visual: <AttendanceVisual />,
    },
    {
        id: 'leave',
        title: 'Leave',
        icon: <svg className={iconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
        longDesc: 'Employees submit leave requests from their dashboard. Managers receive instant notifications and can approve or reject with a single click. Leave balances update automatically.',
        bullets: [
            'Vacation leave, sick leave, and custom leave types',
            'Leave balance tracked and accrued automatically',
            'Employer can manually adjust leave balances',
            'Notification on every request status change',
            'Half-day and multi-day leave requests supported',
            'Leave history and audit trail per employee',
        ],
        visual: <LeaveVisual />,
    },
    {
        id: 'requests',
        title: 'Requests',
        icon: <svg className={iconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
        longDesc: 'A unified inbox for all employee requests. Approve or reject leave, overtime, and undertime requests from a single view. All changes flow automatically into payroll computation.',
        bullets: [
            'Approve or reject leave, OT, and undertime requests',
            'Notifications for pending requests',
            'Overtime: regular, holiday, rest day with correct rates',
            'Approved OT hours automatically included in payroll',
            'Bulk approve pending requests',
            'Full request history with status and timestamps',
        ],
        visual: <RequestsVisual />,
    },
    {
        id: 'reports',
        title: 'Reports',
        icon: <svg className={iconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
        longDesc: 'Get a complete picture of your payroll and workforce. Generate and print reports for government compliance, cost analysis, and management review.',
        bullets: [
            'Payroll Register — full earnings and deductions per employee',
            'Government Contributions — SSS, PhilHealth, Pag-IBIG, BIR',
            'Attendance Cost Analysis — absences, tardiness, OT',
            '13th Month Accrual report per pay period',
            'Other Adjustments — bonuses, loans, deductions',
            'All reports printable / exportable as PDF',
        ],
        visual: <ReportsVisual />,
    },
];

// ── Inline visual components ────────────────────────────────────────────────

function PayrollVisual() {
    return (
        <div className="w-full max-w-xs space-y-3">
            {[['Basic Pay', '₱15,000', 'text-gray-800'], ['Overtime Pay', '+₱1,875', 'text-blue-600'], ['SSS', '-₱750', 'text-red-500'], ['PhilHealth', '-₱375', 'text-red-500'], ['W/Tax', '-₱933', 'text-red-500']].map(([l, v, c]) => (
                <div key={l} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-500">{l}</span>
                    <span className={`text-sm font-semibold ${c}`}>{v}</span>
                </div>
            ))}
            <div className="flex justify-between items-center py-2.5 px-3 rounded-lg mt-1" style={{ background: 'rgb(15,44,82)' }}>
                <span className="text-sm font-bold text-white">Net Pay</span>
                <span className="text-sm font-bold text-teal-300">₱14,817</span>
            </div>
        </div>
    );
}

function AttendanceVisual() {
    const days = [
        { d: 'Mon', status: 'present', time: '8:02 AM' },
        { d: 'Tue', status: 'late', time: '8:27 AM' },
        { d: 'Wed', status: 'present', time: '7:58 AM' },
        { d: 'Thu', status: 'absent', time: '—' },
        { d: 'Fri', status: 'present', time: '8:01 AM' },
    ];
    const colors: Record<string, string> = { present: 'bg-green-100 text-green-700', late: 'bg-amber-100 text-amber-700', absent: 'bg-red-100 text-red-600' };
    return (
        <div className="w-full max-w-xs space-y-2">
            {days.map(d => (
                <div key={d.d} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white border border-gray-100">
                    <span className="text-sm font-medium text-gray-700 w-10">{d.d}</span>
                    <span className="text-xs text-gray-400">{d.time}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${colors[d.status]}`}>{d.status}</span>
                </div>
            ))}
        </div>
    );
}

function LeaveVisual() {
    return (
        <div className="w-full max-w-xs space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <p className="text-2xl font-bold text-blue-700">12</p>
                    <p className="text-xs text-blue-500 mt-0.5">Vacation days</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-green-50 border border-green-100">
                    <p className="text-2xl font-bold text-green-700">8</p>
                    <p className="text-xs text-green-500 mt-0.5">Sick days</p>
                </div>
            </div>
            {[{ label: 'Vacation Leave · May 20–22', status: 'Approved', color: 'text-green-700 bg-green-50' },
              { label: 'Sick Leave · May 15', status: 'Approved', color: 'text-green-700 bg-green-50' },
              { label: 'Vacation Leave · Jun 2–4', status: 'Pending', color: 'text-amber-700 bg-amber-50' }].map(r => (
                <div key={r.label} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white border border-gray-100">
                    <span className="text-xs text-gray-600 flex-1 mr-2">{r.label}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.color}`}>{r.status}</span>
                </div>
            ))}
        </div>
    );
}

function RequestsVisual() {
    return (
        <div className="w-full max-w-xs space-y-2">
            {[
                { name: 'Juan dela Cruz', type: 'Overtime', detail: 'May 20 · 2hrs', status: 'Pending', statusColor: 'bg-amber-100 text-amber-700' },
                { name: 'Maria Santos', type: 'Sick Leave', detail: 'May 21–22', status: 'Pending', statusColor: 'bg-amber-100 text-amber-700' },
                { name: 'Jose Reyes', type: 'Vacation Leave', detail: 'May 26–30', status: 'Approved', statusColor: 'bg-green-100 text-green-700' },
            ].map(r => (
                <div key={r.name} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-800">{r.name}</p>
                            <p className="text-xs text-gray-500">{r.type} · {r.detail}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.statusColor}`}>{r.status}</span>
                    </div>
                    {r.status === 'Pending' && (
                        <div className="flex gap-2 mt-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-green-600 text-white font-medium cursor-pointer">Approve</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 font-medium cursor-pointer">Reject</span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function ReportsVisual() {
    const bars = [['Payroll Register', 100], ['Gov\'t Contributions', 82], ['Attendance Cost', 65], ['13th Month', 48], ['Adjustments', 35]];
    return (
        <div className="w-full max-w-xs space-y-3">
            {bars.map(([label, pct]) => (
                <div key={label as string}>
                    <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-600">{label as string}</span>
                        <span className="text-xs font-semibold" style={{ color: 'rgb(15,44,82)' }}>PDF</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(to right, rgb(15,44,82), rgb(13,148,136))' }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

export default LandingPage;
