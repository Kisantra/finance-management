import { type ReactNode } from 'react'

interface AuthLayoutProps {
    children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <div className="flex h-screen w-screen overflow-hidden">
            {/* Left panel — brand / hero */}
            <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative flex-col overflow-hidden"
                 style={{
                     backgroundColor: '#0f172a',
                     backgroundImage: [
                         'radial-gradient(ellipse 80% 60% at 20% 40%, rgba(37,99,235,0.18) 0%, transparent 60%)',
                         'radial-gradient(ellipse 60% 80% at 80% 80%, rgba(99,102,241,0.12) 0%, transparent 60%)',
                         'radial-gradient(ellipse 40% 40% at 60% 10%, rgba(14,165,233,0.10) 0%, transparent 50%)',
                     ].join(', '),
                 }}>

                {/* Grid overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: [
                        'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
                        'linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                    ].join(', '),
                    backgroundSize: '48px 48px',
                }} />

                {/* Ambient orbs */}
                <div className="absolute pointer-events-none" style={{ width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 70%)', filter: 'blur(40px)', top: -80, left: -80 }} />
                <div className="absolute pointer-events-none" style={{ width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)', filter: 'blur(32px)', bottom: 80, right: -60 }} />
                <div className="absolute pointer-events-none" style={{ width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.15) 0%, transparent 70%)', filter: 'blur(24px)', bottom: '30%', left: '30%' }} />

                {/* Geometric corner accents */}
                <div className="absolute top-0 left-0 w-28 h-28" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', borderLeft: '1px solid rgba(255,255,255,0.08)' }} />
                <div className="absolute bottom-0 right-0 w-28 h-28" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }} />

                {/* Dot accent top-right */}
                <div className="absolute top-8 right-8 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400 opacity-60" />
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 opacity-40" />
                    <div className="w-1 h-1 rounded-full bg-sky-400 opacity-30" />
                </div>

                {/* Main content */}
                <div className="relative z-10 flex flex-col justify-between h-full p-12 xl:p-16">

                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center">
                            <svg className="w-7 h-7 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75" />
                            </svg>
                        </div>
                        <span className="text-white font-semibold text-lg tracking-wide">Kisantra Finance</span>
                    </div>

                    {/* Hero */}
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                <span className="text-blue-300 text-xs font-medium tracking-wider uppercase">Finance Management</span>
                            </div>

                            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-[1.15] tracking-tight">
                                Kendali Penuh<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-sky-300">
                                    Atas Keuangan
                                </span><br />
                                Bisnis Anda
                            </h1>

                            <p className="text-slate-400 text-base xl:text-lg leading-relaxed max-w-sm">
                                Platform terintegrasi untuk invoice, pembayaran, arus kas, dan laporan keuangan dalam satu tempat.
                            </p>
                        </div>

                        <div className="h-px w-48" style={{ background: 'linear-gradient(to right, transparent, rgba(37,99,235,0.3), transparent)' }} />

                        <div className="grid grid-cols-2 gap-5">
                            {[
                                // Livewire sudah sepenuhnya dilepas; angka lama menyesatkan
                                // siapa pun yang menilai tumpukan teknologi dari layar login.
                                { value: 'Multi', label: 'Perusahaan & Database' },
                                { value: 'Multi', label: 'Role & Permission' },
                                { value: 'Real-time', label: 'Notifikasi & Laporan' },
                                { value: 'PDF', label: 'Invoice & Export' },
                            ].map(({ value, label }) => (
                                <div key={label} className="space-y-0.5" style={{ borderLeft: '2px solid rgba(37,99,235,0.6)', paddingLeft: 14 }}>
                                    <div className="text-white font-bold text-2xl">{value}</div>
                                    <div className="text-slate-500 text-xs">{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Trust badge */}
                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            {['from-blue-500 to-indigo-600', 'from-emerald-500 to-teal-600', 'from-violet-500 to-purple-600'].map((gradient, i) => (
                                <div key={i} className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradient} border-2 flex items-center justify-center`} style={{ borderColor: '#0f172a' }}>
                                    <span className="text-white text-[9px] font-bold">{String.fromCharCode(65 + i)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="text-slate-500 text-xs">Dipercaya oleh tim keuangan profesional</div>
                    </div>
                </div>
            </div>

            {/* Right panel — form */}
            <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto relative bg-white dark:bg-[#1e1e2e]">

                {/* Mobile logo */}
                <div className="lg:hidden absolute top-6 left-6 flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75" />
                        </svg>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Kisantra Finance</span>
                </div>

                {/* Form slot */}
                <div className="w-full max-w-[400px] px-8 py-10 xl:px-12">
                    {children}
                </div>

                {/* Copyright */}
                <div className="absolute bottom-5 text-xs text-slate-400 dark:text-slate-600 select-none">
                    &copy; {new Date().getFullYear()} Kisantra Finance. All rights reserved.
                </div>
            </div>
        </div>
    )
}
