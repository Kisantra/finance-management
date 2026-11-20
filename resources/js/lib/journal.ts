import { t, tk } from '@/i18n';

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

/**
 * Nama akun sistem di JournalService (PHP) — teks Indonesianya harus sama persis. Sekaligus kunci
 * terjemahan: baris pratinjau memakai t(...) saat dibentuk, sama dengan server yang menerjemahkan nama
 * akun sistem di batas keluaran. Nama rekening & kategori adalah data dan tidak diterjemahkan.
 */
export const JOURNAL_ACCOUNTS = {
    ppnOutput: tk('PPN Keluaran'),
    taxDeposit: tk('Titipan Pajak Klien'),
    /** Bagian titipan pembayaran Debit Note (itemnya talangan) — JournalService::TALANGAN. */
    talangan: tk('Talangan Biaya Klien'),
    invoiceRevenue: tk('Pendapatan dari Invoice'),
    /** Bagian PPh 23 yang dipotong klien (kredit pajak) — JournalService::PPH_PREPAID. */
    pphPrepaid: tk('PPh 23 Dibayar di Muka'),
    /** Selisih Rupiah pembayaran tagihan USD vs kurs invoice (kredit laba, debit rugi) — JournalService::EXCHANGE_DIFFERENCE. */
    exchangeDifference: tk('Selisih Kurs'),
    transferFee: tk('Biaya Admin Transfer'),
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
    if (adminFee > 0) lines.push({ account: t(JOURNAL_ACCOUNTS.transferFee), side: 'debit', amount: known ? adminFee : null });
    lines.push({ account: from, side: 'credit', amount: known ? amount + Math.max(0, adminFee) : null });
    return lines;
}

/**
 * Invoice::allocatePayments — "titipan dulu": titipan pajak, lalu PPN, sisanya pendapatan. Invoice yang
 * dipotong PPh 23 (`pph`, `total` = total_amount): setiap rupiah yang dibayar ikut melunasi bagian
 * potongannya secara proporsional (`pph`), sehingga saat lunas pendapatan = DPP penuh.
 */
export function allocatePayments(
    paid: number,
    taxDeposit: number,
    ppn: number,
    pph = 0,
    total = 0,
): { taxDeposit: number; ppn: number; revenue: number; pph: number } {
    const p = Math.max(0, paid);
    // Math.round PHP membulatkan .5 menjauhi nol; untuk bilangan positif sama dengan Math.round JS.
    const pphSettled = pph > 0 && total > 0 ? Math.min(pph, Math.round((pph * Math.min(p, total)) / total)) : 0;
    const settled = p + pphSettled;
    return {
        taxDeposit: Math.min(settled, taxDeposit),
        ppn: Math.min(Math.max(0, settled - taxDeposit), ppn),
        revenue: Math.max(0, settled - taxDeposit - ppn),
        pph: pphSettled,
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

/** Invoice::cents — sen dari nominal USD, untuk membandingkan tanpa galat pecahan. */
export function cents(amount: number | null | undefined): number {
    return Math.round((amount ?? 0) * 100);
}

/**
 * Invoice::settledAtInvoiceRate — Rupiah tagihan USD yang sudah tertutup, dinilai dengan kurs INVOICE dari USD
 * yang diterima; lunas = total penuh. Dasar alokasi "titipan dulu" tagihan USD.
 */
export function settledAtInvoiceRate(foreignPaid: number, totalForeign: number, exchangeRate: number, total: number): number {
    if (cents(foreignPaid) >= cents(totalForeign)) return total;
    return Math.min(total, Math.round(foreignPaid * exchangeRate));
}

/** USD yang sudah diterima SEBELUM sebuah pembayaran — urutan sama dengan paidBefore. */
export function foreignPaidBefore(
    payments: Array<{ id: number; foreign_amount: number | null; payment_date: string }>,
    date: string,
    excludeId: number | null = null,
): number {
    return payments
        .filter((p) => p.id !== excludeId)
        .filter((p) => p.payment_date < date || (p.payment_date === date && (excludeId === null || p.id < excludeId)))
        .reduce((sum, p) => sum + (p.foreign_amount ?? 0), 0);
}

/** JournalService::depositAccountFor — bagian titipan Debit Note dikredit ke talangan, invoice ke titipan pajak. */
export function depositAccountFor(documentType: string | null | undefined): string {
    return documentType === 'debit_note' ? JOURNAL_ACCOUNTS.talangan : JOURNAL_ACCOUNTS.taxDeposit;
}

/**
 * JournalService::paymentLines — Debit rekening penuh (+ Debit PPh 23 Dibayar di Muka bila klien memotong
 * PPh) / Kredit selisih alokasi kumulatif sesudah − sebelum pembayaran ini. Tanpa jumlah: kredit ke akun
 * yang akan diisi rupiah berikutnya. `depositAccount` = kunci akun bagian titipan (depositAccountFor).
 * Tagihan USD: `settled` = Rupiah pembayaran ini dinilai dengan kurs invoice (`before` juga); selisihnya dengan
 * `amount` (kurs saat diterima) dikredit (laba) / didebit (rugi) ke Selisih Kurs.
 */
export function paymentJournal(
    account: string,
    amount: number,
    before: number,
    taxDeposit: number,
    ppn: number,
    depositAccount: string = JOURNAL_ACCOUNTS.taxDeposit,
    pph = 0,
    total = 0,
    settled: number | null = null,
): JournalLine[] {
    if (amount <= 0) {
        const next = before < taxDeposit ? depositAccount : before < taxDeposit + ppn ? JOURNAL_ACCOUNTS.ppnOutput : JOURNAL_ACCOUNTS.invoiceRevenue;
        return [
            { account, side: 'debit', amount: null },
            { account: t(next), side: 'credit', amount: null },
        ];
    }

    const allocated = settled ?? amount;
    const difference = amount - allocated;
    const a = allocatePayments(before, taxDeposit, ppn, pph, total);
    const b = allocatePayments(before + allocated, taxDeposit, ppn, pph, total);
    const debits: JournalLine[] = [
        { account, side: 'debit', amount },
        { account: t(JOURNAL_ACCOUNTS.pphPrepaid), side: 'debit', amount: b.pph - a.pph },
        { account: t(JOURNAL_ACCOUNTS.exchangeDifference), side: 'debit', amount: Math.max(0, -difference) },
    ];
    const credits: JournalLine[] = [
        { account: t(depositAccount), side: 'credit', amount: b.taxDeposit - a.taxDeposit },
        { account: t(JOURNAL_ACCOUNTS.ppnOutput), side: 'credit', amount: b.ppn - a.ppn },
        { account: t(JOURNAL_ACCOUNTS.invoiceRevenue), side: 'credit', amount: b.revenue - a.revenue },
        { account: t(JOURNAL_ACCOUNTS.exchangeDifference), side: 'credit', amount: Math.max(0, difference) },
    ];
    return [...debits, ...credits].filter((l) => (l.amount ?? 0) > 0);
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
