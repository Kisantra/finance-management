<?php

use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Services\InvoiceNumberService;
use Illuminate\Database\Migrations\Migration;

/**
 * Nomor invoice PT NAI (template `nusantara-armada-indonesia/`), sama seperti langkah nomor di
 * `2026_11_20_141222_siapkan_debit_note_aoe`. Hanya untuk NAI; perusahaan lain tidak tersentuh. NAI belum
 * menerbitkan Debit Note (talangan), jadi kategori Talangan Klien tidak dibuat.
 *
 * 1. Format nomor: segmen tetap `INV` menjadi token {KODE}, sehingga kode jenis ikut otomatis
 *    (`176/NAI-IDT/INV-FINAL/X/2026`, `173/NAI-AOE/INV-DEM/X/2026`, seperti dokumen asli). Hanya bila
 *    format masih persis format lama.
 * 2. Nomor lama berkode (`…/INV-FINAL/…`) tidak cocok dengan format lama sehingga urutannya kosong dan
 *    nomor otomatis berikutnya mundur ke 001. Dengan format baru nomor itu cocok: urutannya diisi, dan
 *    kodenya (FINAL, DEM, …) disimpan sebagai kode jenis agar muncul sebagai saran di editor.
 */
return new class extends Migration
{
    private const SLUG = 'nusantara-armada-indonesia';

    private const FORMAT_LAMA = '{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}';

    private const FORMAT_BARU = '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}';

    public function up(): void
    {
        if (tenant()?->getTenantKey() !== self::SLUG) {
            return;
        }

        $profile = CompanyProfile::current();

        if ($profile === null || $profile->invoice_number_format !== self::FORMAT_LAMA) {
            return;
        }

        $profile->update(['invoice_number_format' => self::FORMAT_BARU]);

        $numbers = app(InvoiceNumberService::class);
        $numbers->backfillSequences(true);

        Invoice::query()
            ->whereNotNull('invoice_number')
            ->whereNull('document_code')
            ->where('document_type', Invoice::TYPE_INVOICE)
            ->each(function (Invoice $invoice) use ($numbers): void {
                $kode = (string) $numbers->kodeOf($invoice->invoice_number);

                if (str_starts_with($kode, 'INV-')) {
                    Invoice::whereKey($invoice->id)->update(['document_code' => Invoice::normalizeDocumentCode($kode)]);
                }
            });
    }

    public function down(): void
    {
        // Format, urutan, dan kode tetap; tidak ada yang perlu dikembalikan.
    }
};
