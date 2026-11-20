{{--
    Tagihan USD di template bawaan (Kisantra, Generik, Semesta): kurs invoice dan utang klien dalam USD, di bawah
    terbilang. Angka di atasnya tetap Rupiah (pembukuan). Template perusahaan memakai baris `kurs` & `tagihan_usd`
    dari InvoiceTotalRows. Kosong untuk tagihan Rupiah.
--}}
@if ($invoice->isForeign())
    <div style="margin-top: 8px; padding: 8px 10px; border: 1px solid #999; font-size: 9pt; line-height: 1.5;">
        Kurs: 1 USD = Rp {{ \App\Services\InvoiceTotalRows::format($invoice->exchange_rate) }}<br>
        <strong>TOTAL OUTSTANDING (USD): USD {{ \App\Services\InvoiceTotalRows::format($invoice->total_foreign, 'USD') }}</strong>
    </div>
@endif
