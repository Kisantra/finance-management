import * as React from 'react';
import { bankLogoUrl, findBank } from '@/lib/banks';
import { cn } from '@/lib/utils';

interface BankLogoProps {
    /** Nama bank yang diketik bebas (`bank_accounts.bank_name`). */
    bankName: string | null | undefined;
    /** Ukuran & radius tile, mis. `h-9 w-9 rounded-xl`. */
    className?: string;
    /** Ditampilkan bila nama bank tidak dikenali katalog atau logonya gagal dimuat. */
    fallback?: React.ReactNode;
}

/**
 * Logo bank di atas tile putih (logo resmi dirancang untuk latar terang, jadi putih di kedua tema).
 * Dekoratif: nama bank selalu tertulis di sebelahnya, jadi gambar tidak dibacakan pembaca layar.
 */
export function BankLogo({ bankName, className, fallback = null }: BankLogoProps) {
    const bank = findBank(bankName);
    const [failedSlug, setFailedSlug] = React.useState<string | null>(null);

    if (!bank || failedSlug === bank.slug) return <>{fallback}</>;

    return (
        <span
            aria-hidden="true"
            className={cn('flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-inset ring-black/10', className)}
        >
            <img
                src={bankLogoUrl(bank)}
                alt=""
                draggable={false}
                onError={() => setFailedSlug(bank.slug)}
                className="h-full w-full object-contain p-[8%]"
            />
        </span>
    );
}
