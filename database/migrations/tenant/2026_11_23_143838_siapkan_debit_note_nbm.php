<?php

use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\TransactionCategory;
use App\Services\CategoryTemplateService;
use App\Services\InvoiceNumberService;
use Illuminate\Database\Migrations\Migration;

/**
 * Template invoice & Debit Note PT NBM (`namora-berlian-mahakam/`), sama seperti
 * `2026_11_20_141222_siapkan_debit_note_aoe` untuk AOE. Hanya untuk NBM; perusahaan lain tidak tersentuh.
 *
 * 1. Format nomor: segmen tetap `INV` menjadi token {KODE}, sehingga kode jenis ikut otomatis
 *    (`008/NBM-PTB/INV-FINAL/IX/2026`, `004/NBM-KE/DN-OT/VIII/2026`, seperti dokumen asli). Hanya bila
 *    format masih persis format lama.
 * 2. Nomor lama berkode (`…/INV-FINAL/…`) tidak cocok dengan format lama sehingga urutannya kosong dan
 *    nomor otomatis berikutnya mundur ke 001. Dengan format baru nomor itu cocok: urutannya diisi, dan
 *    kodenya (FINAL, MOORING, FENDER, …) disimpan sebagai kode jenis agar muncul sebagai saran di editor.
 *    Nomor berawalan DN tidak diubah jenisnya: itemnya tercatat sebagai pendapatan dan harus ditinjau manual.
 * 3. Kategori Pendanaan "Talangan Klien › Bayar Talangan Klien" (template kategori) untuk mencatat
 *    biaya yang dibayar atas nama klien tanpa menyentuh Laba Rugi.
 * 4. Sakelar Debit Note di Profil perusahaan dinyalakan: template Debit Note ini dibuat atas permintaan NBM,
 *    jadi editor langsung menawarkan jenis dokumen Debit Note (bisa dimatikan lagi di Profil perusahaan).
 */
return new class extends Migration
{
    private const SLUG = 'namora-berlian-mahakam';

    private const FORMAT_LAMA = '{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}';

    private const FORMAT_BARU = '{NO}/{PT}-{KLIEN}/{KODE}/{BLN_ROMAWI}/{THN}';

    public function up(): void
    {
        if (tenant()?->getTenantKey() !== self::SLUG) {
            return;
        }

        $profile = CompanyProfile::current();

        if ($profile !== null && $profile->invoice_number_format === self::FORMAT_LAMA) {
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

        if ($profile !== null && ! $profile->debit_note_enabled) {
            $profile->update(['debit_note_enabled' => true]);
        }

        $this->pastikanKategoriTalangan();
    }

    public function down(): void
    {
        // Format, urutan, kode, sakelar, dan kategori tetap; tidak ada yang perlu dikembalikan.
    }

    /** Grup template "Talangan Klien" beserta subnya, bila belum ada (nama ternormalisasi). */
    private function pastikanKategoriTalangan(): void
    {
        $grup = collect(CategoryTemplateService::TEMPLATE)->firstWhere('label', 'Talangan Klien');
        $sama = fn (string $label) => fn (TransactionCategory $c): bool => CategoryTemplateService::normalize($c->label) === CategoryTemplateService::normalize($label);

        $pendanaan = TransactionCategory::query()->where('type', 'financing')->get();
        $induk = $pendanaan->whereNull('parent_id')->first($sama($grup['label']))
            ?? TransactionCategory::create(['type' => 'financing', 'label' => $grup['label'], 'pl_group' => null, 'parent_id' => null]);

        foreach ($grup['children'] as $label) {
            if ($pendanaan->whereNotNull('parent_id')->first($sama($label)) === null) {
                TransactionCategory::create(['type' => 'financing', 'label' => $label, 'pl_group' => null, 'parent_id' => $induk->id]);
            }
        }
    }
};
