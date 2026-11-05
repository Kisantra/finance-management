import { Link } from '@inertiajs/react';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/*
 * Potongan yang dipakai bersama oleh halaman autentikasi (layouts/auth-layout.tsx).
 * Semuanya menyusun komponen katalog; tidak ada kontrol buatan sendiri.
 */

/** `Input` katalog untuk kata sandi, dengan tombol tampil/sembunyi di slot kanan. */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'iconRight'>>((props, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
        <Input
            ref={ref}
            {...props}
            type={visible ? 'text' : 'password'}
            iconRight={
                /* Slot kanan Input selebar 16 px; -m-2 memusatkan tombol 32 px di atasnya, `flex`
                   (bukan inline-flex) agar tidak duduk di garis dasar teks lalu turun 2 px. */
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    className="-m-2 flex"
                >
                    {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
            }
        />
    );
});
PasswordInput.displayName = 'PasswordInput';

/** Pesan status dari server (tautan terkirim, kata sandi diganti, ...). */
export function AuthStatus({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            role="status"
            className={cn(
                'flex items-start gap-2.5 rounded-2xl border border-ob-pos/35 bg-ob-pos/10 px-4 py-3 text-[13px] leading-relaxed text-ob-ink',
                className,
            )}
        >
            <CheckCircle2 aria-hidden="true" className="mt-0.75 h-4 w-4 shrink-0 text-ob-pos" />
            <p>{children}</p>
        </div>
    );
}

/** Ikon bulat di atas judul untuk halaman tanpa formulir panjang (verifikasi, konfirmasi). */
export function AuthIcon({ children }: { children: React.ReactNode }) {
    return (
        <span
            aria-hidden="true"
            className="mb-6 flex h-11 w-11 items-center justify-center rounded-full border border-ob-line bg-ob-inner text-ob-ink-2"
        >
            {children}
        </span>
    );
}

/** Tautan teks di halaman autentikasi: biru aksi, garis bawah saat hover, cincin fokus Obsidian. */
export function AuthLink({ className, ...props }: React.ComponentProps<typeof Link>) {
    return (
        <Link
            {...props}
            className={cn(
                'rounded-sm font-semibold text-ob-act underline-offset-4 transition-colors duration-150 ease-out hover:underline',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill focus-visible:ring-offset-2 focus-visible:ring-offset-ob-card',
                className,
            )}
        />
    );
}
