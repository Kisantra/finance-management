import { router } from '@inertiajs/react';
import { Languages, Loader2 } from 'lucide-react';
import * as React from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { bahasaAktif, t, type Bahasa } from '@/i18n';
import { cn } from '@/lib/utils';

/*
 * Pemilih bahasa — SATU komponen untuk header aplikasi dan halaman tamu (masuk, lupa/atur ulang kata
 * sandi, verifikasi email). POST /language dibalas muat ulang penuh: kamus bahasa baru dimuat sebelum
 * render, jadi tidak ada sisa bahasa lama di layar. Tamu: pilihannya ikut tersimpan ke akun saat masuk.
 */

/** Nama bahasa ditulis dalam bahasanya sendiri (endonim) dan tidak diterjemahkan. */
const PILIHAN: { kode: Bahasa; singkat: string; nama: string; lang: string }[] = [
    { kode: 'id', singkat: 'ID', nama: 'Indonesia', lang: 'id' },
    { kode: 'en', singkat: 'EN', nama: 'English', lang: 'en' },
    { kode: 'zh', singkat: 'ZH', nama: '中文', lang: 'zh-CN' },
];

interface LanguageSwitcherProps {
    /** Ukuran & latar pil pemicu (header: rel, halaman tamu: kartu). */
    className?: string;
    align?: 'start' | 'end';
    /** Sembunyikan ikon di bawah `sm` (header ponsel sudah padat; kode bahasa tetap tampil). */
    compact?: boolean;
}

export function LanguageSwitcher({ className, align = 'end', compact = false }: LanguageSwitcherProps) {
    const aktif = bahasaAktif();
    const sekarang = PILIHAN.find((p) => p.kode === aktif) ?? PILIHAN[0];
    const [mengganti, setMengganti] = React.useState(false);

    const ganti = (kode: string) => {
        if (kode === aktif || mengganti) {
            return;
        }
        setMengganti(true);
        // Sukses = 409 + X-Inertia-Location → halaman dimuat ulang penuh; state ini ikut hilang.
        router.post('/language', { locale: kode }, { preserveScroll: true, onError: () => setMengganti(false) });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    disabled={mengganti}
                    aria-label={t('Bahasa: {{language}}', { language: sekarang.nama })}
                    className={cn(
                        'flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-ob-line text-xs font-semibold text-ob-ink transition-colors duration-150 ease-out hover:bg-ob-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-act-fill data-[state=open]:bg-ob-hover disabled:opacity-60',
                        className,
                    )}
                >
                    {mengganti ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                        <Languages className={cn('h-3.5 w-3.5 text-ob-ink-2', compact && 'hidden sm:block')} aria-hidden="true" />
                    )}
                    {sekarang.singkat}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} sideOffset={6} className="w-44">
                <DropdownMenuLabel>{t('Bahasa')}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={aktif} onValueChange={ganti}>
                    {PILIHAN.map((p) => (
                        <DropdownMenuRadioItem key={p.kode} value={p.kode} lang={p.lang} className="justify-between text-[13px]">
                            <span className={cn(p.kode === aktif ? 'font-semibold' : 'font-medium')}>{p.nama}</span>
                            <span className="text-xs text-ob-ink-3">{p.singkat}</span>
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
