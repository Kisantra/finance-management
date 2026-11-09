/*
 * Jurnal tampilan ("Cara A") — CERMIN klien dari app/Services/JournalService.php untuk PRATINJAU di
 * formulir (Catat Pemasukan/Pengeluaran, Transfer, Catat pembayaran invoice). Jurnal transaksi &
 * pembayaran yang SUDAH tersimpan selalu datang dari server (prop `journal`), tidak dihitung di sini.
 *
 * Fungsi di bawah hanya merangkai data yang dikirim server — nama rekening (`journal_name`,
 * BankAccount::journalNameFor), akun lawan kategori (`journal_account`, JournalService::counterAccount),
 * titipan pajak & PPN invoice — dan tidak boleh menebak aturan sendiri. Ubah PHP-nya dulu, lalu
 * samakan di sini. Debit dulu, lalu kredit; baris bernilai nol tidak ditampilkan.
 */

export interface JournalLine {
    account: string;
    side: 'debit' | 'credit';
    /** Rupiah penuh; null = belum diketahui (pratinjau tanpa jumlah → "—"). */
    amount: number | null;
}

/** Nama akun di JournalService (PHP) — harus sama persis. */
export const JOURNAL_ACCOUNTS = {
    ppnOutput: 'PPN Keluaran',
    taxDeposit: 'Titipan Pajak Klien',
    invoiceRevenue: 'Pendapatan dari Invoice',
    transferFee: 'Biaya Admin Transfer',
} as const;

function amountOrNull(amount: number): number | null {
    return amount > 0 ? amount : null;
}

/**
 * JournalService::cashLines — masuk (credit): Debit rekening / Kredit akun lawan; keluar (debit):
 * Debit akun lawan / Kredit rekening. Tanpa jumlah: akun tetap tampil dengan "—".
 */
export function cashJournal(direction: 'credit' | 'debit', account: string, amount: number, counter: string): JournalLine[] {
    const value = amountOrNull(amount);
    return direction === 'credit'
        ? [
              { account, side: 'debit', amount: value },
              { account: counter, side: 'credit', amount: value },
          ]
        : [
              { account: counter, side: 'debit', amount: value },
              { account, side: 'credit', amount: value },
          ];
}

/** JournalService::transferLines — Debit tujuan + Debit biaya admin / Kredit asal (jumlah + biaya admin). */
export function transferJournal(from: string, to: string, amount: number, adminFee: number): JournalLine[] {
    // Tanpa jumlah transfer semua nominal "—" (biaya admin saja tidak membentuk jurnal yang seimbang).
    const known = amount > 0;
    const lines: JournalLine[] = [{ account: to, side: 'debit', amount: known ? amount : null }];
    if (adminFee > 0) lines.push({ account: JOURNAL_ACCOUNTS.transferFee, side: 'debit', amount: known ? adminFee : null });
    lines.push({ account: from, side: 'credit', amount: known ? amount + Math.max(0, adminFee) : null });
    return lines;
}

/** Invoice::allocatePayments — "titipan dulu": titipan pajak, lalu PPN, sisanya pendapatan. */
export function allocatePayments(paid: number, taxDeposit: number, ppn: number): { taxDeposit: number; ppn: number; revenue: number } {
    const p = Math.max(0, paid);
    return {
        taxDeposit: Math.min(p, taxDeposit),
        ppn: Math.min(Math.max(0, p - taxDeposit), ppn),
        revenue: Math.max(0, p - taxDeposit - ppn),
    };
}

/**
 * Jumlah yang sudah dibayar SEBELUM sebuah pembayaran, urut (payment_date, id) — sama dengan
 * JournalService::forPayments. Pembayaran baru belum punya id: ia mendapat id terbesar, jadi semua
 * pembayaran bertanggal sama atau lebih awal dihitung sebelumnya. Pembayaran yang sedang diubah
 * (`excludeId`) tidak dihitung, dan dibandingkan dengan id-nya sendiri.
 */
export function paidBefore(payments: Array<{ id: number; amount: number; payment_date: string }>, date: string, excludeId: number | null = null): number {
    return payments
        .filter((p) => p.id !== excludeId)
        .filter((p) => p.payment_date < date || (p.payment_date === date && (excludeId === null || p.id < excludeId)))
        .reduce((sum, p) => sum + p.amount, 0);
}

/**
 * JournalService::paymentLines — Debit rekening penuh / Kredit selisih alokasi kumulatif sesudah −
 * sebelum pembayaran ini. Tanpa jumlah: kredit ke akun yang akan diisi rupiah berikutnya.
 */
export function paymentJournal(account: string, amount: number, before: number, taxDeposit: number, ppn: number): JournalLine[] {
    if (amount <= 0) {
        const next = before < taxDeposit ? JOURNAL_ACCOUNTS.taxDeposit : before < taxDeposit + ppn ? JOURNAL_ACCOUNTS.ppnOutput : JOURNAL_ACCOUNTS.invoiceRevenue;
        return [
            { account, side: 'debit', amount: null },
            { account: next, side: 'credit', amount: null },
        ];
    }

    const a = allocatePayments(before, taxDeposit, ppn);
    const b = allocatePayments(before + amount, taxDeposit, ppn);
    const credits: JournalLine[] = [
        { account: JOURNAL_ACCOUNTS.taxDeposit, side: 'credit', amount: b.taxDeposit - a.taxDeposit },
        { account: JOURNAL_ACCOUNTS.ppnOutput, side: 'credit', amount: b.ppn - a.ppn },
        { account: JOURNAL_ACCOUNTS.invoiceRevenue, side: 'credit', amount: b.revenue - a.revenue },
    ];
    return [{ account, side: 'debit', amount }, ...credits.filter((l) => (l.amount ?? 0) > 0)];
}

/**
 * Jurnal kas tersimpan (satu debit + satu kredit) → nama rekening & akun lawannya, untuk pratinjau
 * saat transaksi diubah di dialog rincian (rekening tidak bisa diganti di sana).
 */
export function splitCashJournal(lines: JournalLine[], direction: 'credit' | 'debit'): { account: string; counter: string } | null {
    const debit = lines.find((l) => l.side === 'debit');
    const credit = lines.find((l) => l.side === 'credit');
    if (!debit || !credit || lines.length !== 2) return null;
    return direction === 'credit' ? { account: debit.account, counter: credit.account } : { account: credit.account, counter: debit.account };
}
