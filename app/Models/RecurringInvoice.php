<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecurringInvoice extends Model
{
    use HasFactory;

    protected $fillable = [
        'template_id',
        'client_id',
        'scheduled_date',
        'issue_date',
        'due_date',
        'invoice_data',
        'status',
        'published_invoice_id',
    ];

    protected $casts = [
        'scheduled_date' => 'date',
        'issue_date' => 'date',
        'due_date' => 'date',
        'invoice_data' => 'array',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(RecurringTemplate::class, 'template_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function publishedInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'published_invoice_id');
    }

    // Get total amount from invoice data
    public function getTotalAmountAttribute(): int
    {
        return $this->invoice_data['total_amount'] ?? 0;
    }

    public function getFormattedTotalAmountAttribute(): string
    {
        return 'Rp '.number_format($this->total_amount, 0, ',', '.');
    }

    // Get items from invoice data
    public function getItemsAttribute(): array
    {
        return $this->invoice_data['items'] ?? [];
    }

    // Publish to invoices table
    public function publish(): Invoice
    {
        if ($this->status === 'published') {
            return $this->publishedInvoice;
        }

        // PPN mengikuti status PKP saat publish.
        $company = CompanyProfile::current();
        $ppnRate = $company?->is_pkp && (float) $company->ppn_rate > 0 ? (float) $company->ppn_rate : 0.0;
        $discountAmount = (int) ($this->invoice_data['discount_amount'] ?? 0);

        /*
         * Nilai tagihan dihitung ULANG dari itemnya, BUKAN diambil dari
         * invoice_data['subtotal'] / ['total_amount'].
         *
         * Kedua angka tersimpan itu adalah basis OMZET: buildInvoiceData() di
         * RecurringInvoiceController sengaja TIDAK menjumlahkan item titipan
         * pajak ke subtotal, dan halaman analitik memang menolak item titipan
         * saat menghitung pendapatan. Itu benar untuk pelaporan — titipan pajak
         * uang klien yang dititipkan, bukan pendapatan perusahaan.
         *
         * Memakainya sebagai nilai TAGIHAN adalah hal lain: invoice jadi menagih
         * kurang persis sebesar titipannya, satu-satunya invoice di aplikasi ini
         * yang totalnya tidak sama dengan jumlah barisnya. PDF-nya bahkan
         * mencetak "Termasuk titipan pajak Rp X" yang dibantah totalnya sendiri,
         * dan perusahaan menyetor pajak lebih besar daripada yang ia tagih.
         *
         * Rumusnya kini sama persis dengan invoice biasa
         * (InvoiceController::buildInvoiceData): subtotal mencakup SEMUA item,
         * titipan hanya dikeluarkan dari dasar pengenaan PPN.
         *
         * Dihitung dari item, bukan dari kolom tersimpan, supaya draft lama yang
         * sudah terlanjur memakai bentuk data sebelumnya ikut terbit dengan benar.
         */
        $itemsUntukTagihan = $this->items;

        $subtotal = array_sum(array_map(
            fn (array $i): int => (int) ($i['amount'] ?? 0),
            $itemsUntukTagihan
        ));

        $titipanPajak = array_sum(array_map(
            fn (array $i): int => ($i['is_tax_deposit'] ?? false) ? (int) ($i['amount'] ?? 0) : 0,
            $itemsUntukTagihan
        ));

        $ppnAmount = Invoice::ppnFor($subtotal - $titipanPajak - $discountAmount, $ppnRate);

        // Draft tanpa nomor, sama seperti invoice biasa: nomor resmi diberikan saat "Kirim".
        $invoice = Invoice::create([
            'billed_to_id' => $this->client_id,
            'subtotal' => $subtotal,
            'discount_amount' => $discountAmount,
            'discount_type' => $this->invoice_data['discount_type'] ?? 'fixed',
            'discount_value' => $this->invoice_data['discount_value'] ?? 0,
            'discount_reason' => $this->invoice_data['discount_reason'] ?? null,
            'ppn_rate' => $ppnRate,
            'ppn_amount' => $ppnAmount,
            'total_amount' => max(0, $subtotal - $discountAmount) + $ppnAmount,
            'issue_date' => $this->issue_date ?? $this->scheduled_date,
            'due_date' => $this->due_date ?? ($this->issue_date ?? $this->scheduled_date)->copy()->addDays(30),
            'status' => 'draft',
        ]);

        // Create invoice items
        foreach ($this->items as $itemData) {
            // `unit` dan `is_tax_deposit` WAJIB ikut tersalin. Tanpa keduanya,
            // invoice hasil publish memakai satuan bawaan, dan item titipan pajak
            // kehilangan penandanya — padahal item titipan dikecualikan dari omzet.
            // Akibatnya titipan pajak terhitung sebagai pendapatan dan basis PPh
            // final 0,5% ikut salah. Hilang sekali saat merge rekonsiliasi; dikunci
            // RecurringInvoiceHardeningTest.
            $invoice->items()->create([
                'client_id' => $this->client_id,
                'service_name' => $itemData['service_name'],
                'quantity' => $itemData['quantity'],
                'unit' => $itemData['unit'] ?? 'pcs',
                'unit_price' => $itemData['unit_price'],
                'amount' => $itemData['amount'],
                'cogs_amount' => $itemData['cogs_amount'] ?? 0,
                'is_tax_deposit' => (bool) ($itemData['is_tax_deposit'] ?? false),
            ]);
        }

        // Update recurring invoice status
        $this->update([
            'status' => 'published',
            'published_invoice_id' => $invoice->id,
        ]);

        return $invoice;
    }

    // Scope for monthly filtering
    public function scopeForMonth($query, int $month, ?int $year = null)
    {
        $year = $year ?: now()->year;

        return $query->whereYear('scheduled_date', $year)
            ->whereMonth('scheduled_date', $month);
    }

    // Scope for year filtering
    public function scopeForYear($query, int $year)
    {
        return $query->whereYear('scheduled_date', $year);
    }
}
