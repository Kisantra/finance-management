<?php

namespace App\Mcp\Tools;

use App\Models\Company;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;

/**
 * Rincian satu invoice, isinya mengikuti InvoiceController::data() (drawer detail invoice).
 * Dibayar, sisa, dan DPP memakai accessor Invoice dengan relasi yang sudah dimuat (tanpa query
 * tambahan). Laba kotor dihitung seperti drawer (invoice-drawer.tsx): titipan pajak bukan
 * pendapatan dan HPP-nya tidak ikut.
 */
class DetailInvoice extends AlatKeuangan
{
    private const LABEL_METODE = [
        'bank_transfer' => 'Transfer bank',
        'cash' => 'Tunai',
    ];

    protected string $name = 'detail-invoice';

    protected string $description = 'Rincian satu invoice (nomor atau id): klien, item (qty, harga satuan — boleh bersen —, HPP, titipan pajak), diskon, DPP, PPN, PPh 23 yang dipotong klien, faktur, total (= yang ditransfer klien, sudah dikurangi PPh 23), pembayaran (tanggal, nominal, rekening), dibayar & sisa, serta HPP dan laba kotor (pendapatan tanpa PPN & titipan pajak dikurangi HPP, sama dengan drawer invoice di aplikasi). Jenis "Debit Note" punya sifat_debit_note: "talangan" (biaya yang dibayar dulu atas nama klien: semua itemnya titipan, tanpa PPN/PPh, bukan pendapatan) atau "tagihan jasa" (dihitung persis seperti invoice, hanya judul & nomornya Debit Note). Draft belum bernomor: pakai id dari daftar-invoice.';

    protected function izin(): string
    {
        return 'view invoices';
    }

    protected function skemaTambahan(JsonSchema $schema): array
    {
        return [
            'nomor' => $schema->string()
                ->description('Nomor invoice persis, mis. 001/INV/KSN-ABC/XI/2026. Isi nomor ATAU id.'),
            'id' => $schema->integer()->min(1)
                ->description('ID invoice dari daftar-invoice (wajib untuk draft yang belum bernomor).'),
        ];
    }

    protected function jalankan(Request $request, Company $perusahaan): array
    {
        $data = $request->validate([
            'nomor' => ['nullable', 'string', 'max:100', 'required_without:id', 'prohibits:id'],
            'id' => ['nullable', 'integer', 'min:1'],
        ], [
            'nomor.required_without' => 'Isi nomor (nomor invoice) atau id (dari daftar-invoice).',
            'nomor.prohibits' => 'Isi salah satu saja: nomor atau id.',
            'nomor' => 'nomor harus teks nomor invoice, maksimal 100 karakter.',
            'id' => 'id harus bilangan bulat mulai 1 (id invoice dari daftar-invoice).',
        ]);

        $nomor = trim((string) ($data['nomor'] ?? ''));

        $invoice = Invoice::query()
            ->with([
                'client:id,name,type,email,NPWP,address',
                'items' => fn ($q) => $q->orderBy('id'),
                'items.client:id,name',
                'payments' => fn ($q) => $q->orderBy('payment_date')->orderBy('id'),
                'payments.bankAccount:id,account_name,bank_name',
            ])
            ->when(isset($data['id']),
                fn (Builder $q) => $q->whereKey((int) $data['id']),
                fn (Builder $q) => $q->where('invoice_number', $nomor))
            ->first();

        if (! $invoice) {
            throw ValidationException::withMessages(isset($data['id'])
                ? ['id' => "Invoice dengan id {$data['id']} tidak ada di perusahaan ini. Lihat id yang tersedia lewat daftar-invoice."]
                : ['nomor' => "Invoice bernomor \"{$nomor}\" tidak ada di perusahaan ini. Cari nomornya lewat daftar-invoice (kata_kunci); invoice draft belum bernomor, pakai id."]);
        }

        $layanan = $invoice->items->reject(fn (InvoiceItem $item) => $item->is_tax_deposit);
        $titipanPajak = (int) $invoice->items->where('is_tax_deposit', true)->sum('amount');
        $hpp = (int) $layanan->sum('cogs_amount');
        // Potongan PPh 23 tidak ditransfer klien tetapi tetap pendapatan (kredit pajak).
        $pendapatan = (int) $invoice->total_amount + (int) $invoice->pph_amount - (int) $invoice->ppn_amount - $titipanPajak;

        return [
            'invoice' => [
                'id' => $invoice->id,
                'nomor' => $invoice->invoice_number,
                'jenis' => DaftarInvoice::labelJenis($invoice->document_type),
                'kode_jenis' => $invoice->document_code,
                // Debit Note talangan = penggantian biaya, bukan pendapatan; tagihan jasa = dihitung seperti invoice.
                ...($invoice->isDebitNote() ? ['sifat_debit_note' => $invoice->isPassThrough() ? 'talangan' : 'tagihan jasa'] : []),
                'status' => $invoice->status,
                'status_label' => DaftarInvoice::labelStatus($invoice->status),
                'terbit' => $invoice->issue_date?->format('Y-m-d'),
                'jatuh_tempo' => $invoice->due_date?->format('Y-m-d'),
                'hari_lewat_tempo' => DaftarInvoice::hariLewatTempo($invoice->status, $invoice->due_date),
                'faktur_pajak' => $invoice->faktur,
            ],
            'klien' => $invoice->client ? [
                'id' => $invoice->client->id,
                'nama' => $invoice->client->name,
                'jenis' => $invoice->client->type,
                'npwp' => $invoice->client->NPWP,
                'email' => $invoice->client->email,
                'alamat' => $invoice->client->address,
            ] : null,
            'item' => $invoice->items->map(fn (InvoiceItem $item) => array_filter([
                'layanan' => $item->service_name,
                // Satu invoice bisa menagih beberapa klien; nama hanya disebut bila berbeda.
                'atas_nama' => $item->client_id !== null && (int) $item->client_id !== (int) $invoice->billed_to_id
                    ? $item->client?->name
                    : null,
                'qty' => (float) $item->quantity,
                'satuan' => $item->unit,
                // Harga satuan boleh bersen (mis. 9459.46); nominal lain tetap rupiah penuh.
                'harga_satuan' => fmod((float) $item->unit_price, 1.0) !== 0.0 ? round((float) $item->unit_price, 2) : (int) $item->unit_price,
                'jumlah' => (int) $item->amount,
                'hpp' => (int) $item->cogs_amount,
                'titipan_pajak' => (bool) $item->is_tax_deposit,
            ], fn ($nilai) => $nilai !== null))->values()->all(),
            'nilai' => [
                'subtotal' => (int) $invoice->subtotal,
                'diskon' => (int) $invoice->discount_amount > 0 ? [
                    'jenis' => $invoice->discount_type,
                    'nilai' => (int) $invoice->discount_value,
                    'jumlah' => (int) $invoice->discount_amount,
                    'alasan' => $invoice->discount_reason,
                ] : null,
                'titipan_pajak' => $titipanPajak,
                'dpp' => $invoice->dpp_amount,
                // null = invoice dari sebelum fitur PPN (tanpa data PPN); 0 = sengaja tanpa PPN.
                'ppn_tarif' => $invoice->ppn_rate !== null ? (float) $invoice->ppn_rate : null,
                'ppn' => (int) $invoice->ppn_amount,
                'pph23_tarif' => (float) $invoice->pph_rate > 0 ? (float) $invoice->pph_rate : null,
                'pph23_dipotong_klien' => (int) $invoice->pph_amount,
                'total' => (int) $invoice->total_amount,
                'dibayar' => $invoice->amount_paid,
                'sisa' => $invoice->amount_remaining,
                // Tagihan USD: utang klien dalam USD dengan kurs invoice; Rupiah di atas = pembukuan.
                ...($invoice->isForeign() ? [
                    'mata_uang' => $invoice->currency,
                    'kurs' => (float) $invoice->exchange_rate,
                    'total_usd' => (float) $invoice->total_foreign,
                    'dibayar_usd' => $invoice->foreign_paid,
                    'sisa_usd' => $invoice->foreign_remaining,
                ] : []),
            ],
            'laba' => [
                'pendapatan' => $pendapatan,
                'hpp' => $hpp,
                'laba_kotor' => $pendapatan - $hpp,
            ],
            'pembayaran' => $invoice->payments->map(fn (Payment $pembayaran) => [
                'tanggal' => $pembayaran->payment_date?->format('Y-m-d'),
                'jumlah' => (int) $pembayaran->amount,
                ...($pembayaran->foreign_amount !== null ? [
                    'jumlah_usd' => (float) $pembayaran->foreign_amount,
                    'kurs' => (float) $pembayaran->exchange_rate,
                ] : []),
                'rekening' => $pembayaran->bankAccount
                    ? $pembayaran->bankAccount->account_name.' ('.$pembayaran->bankAccount->bank_name.')'
                    : null,
                'metode' => self::LABEL_METODE[$pembayaran->payment_method] ?? $pembayaran->payment_method,
                'referensi' => $pembayaran->reference_number,
                // Hanya nama berkas; path & URL lampiran tidak pernah dikirim.
                'lampiran' => $pembayaran->attachment_name,
            ])->values()->all(),
        ];
    }
}
