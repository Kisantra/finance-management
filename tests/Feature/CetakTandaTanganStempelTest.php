<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\User;
use App\Services\InvoicePrintService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Pilihan "Sertakan di PDF" di dialog cetak: tanda tangan & stempel dari Profil perusahaan boleh tidak
 * dicetak (`signature=0` / `stamp=0` di rute download & preview), untuk ditandatangani/distempel basah.
 */
class CetakTandaTanganStempelTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Invoice $invoice;

    private string $ttd;

    private string $stempel;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['view invoices', 'create invoices', 'edit invoices'] as $name) {
            Permission::findOrCreate($name, 'web');
        }

        $this->admin = User::factory()->create();
        $this->admin->companies()->syncWithoutDetaching([self::TEST_COMPANY]);
        setPermissionsTeamId(self::TEST_COMPANY);
        $this->admin->givePermissionTo(Permission::all());

        // Unggahan Profil perusahaan ada di disk `public` milik perusahaan, bukan di public/storage.
        $this->ttd = $this->png(255, 0, 0);
        $this->stempel = $this->png(0, 0, 255);
        Storage::fake('public');
        Storage::disk('public')->put('images/pdf-signature-1.png', $this->ttd);
        Storage::disk('public')->put('images/stamp-1.png', $this->stempel);
        CompanyProfile::factory()->create([
            'signature_path' => 'images/pdf-signature-1.png',
            'stamp_path' => 'images/stamp-1.png',
        ]);

        $klien = Client::factory()->create();
        $this->invoice = Invoice::create([
            'billed_to_id' => $klien->id,
            'invoice_number' => '001/INV/SPI-KC/XI/2026',
            'issue_date' => '2026-11-10',
            'due_date' => '2026-11-24',
            'subtotal' => 1_000_000,
            'total_amount' => 1_000_000,
            'status' => 'sent',
        ]);
        InvoiceItem::create([
            'invoice_id' => $this->invoice->id,
            'client_id' => $klien->id,
            'service_name' => 'Jasa konsultasi',
            'quantity' => 1,
            'unit_price' => 1_000_000,
            'amount' => 1_000_000,
        ]);
    }

    private function png(int $red, int $green, int $blue): string
    {
        $image = imagecreatetruecolor(24, 12);
        imagefill($image, 0, 0, imagecolorallocate($image, $red, $green, $blue));
        ob_start();
        imagepng($image);

        return (string) ob_get_clean();
    }

    private function dataUri(string $png): string
    {
        return 'data:image/png;base64,'.base64_encode($png);
    }

    /**
     * @return array<string, mixed>
     */
    private function viewData(string $template, bool $withSignature = true, bool $withStamp = true): array
    {
        return (new InvoicePrintService)->buildViewData(
            $this->invoice->load(['client', 'items.client', 'payments']),
            null,
            null,
            $template,
            $withSignature,
            $withStamp,
        );
    }

    public function test_tanpa_pilihan_tanda_tangan_dan_stempel_ikut_tercetak(): void
    {
        $data = $this->viewData('kisantra-invoice');

        // Template bawaan kini membaca unggahan dari disk perusahaan (dulu hanya public/storage pusat).
        $this->assertSame($this->dataUri($this->ttd), $data['company']['signature_base64']);
        $this->assertSame($this->dataUri($this->stempel), $data['company']['stamp_base64']);
        // Template perusahaan.
        $this->assertSame($this->dataUri($this->ttd), $data['tanda_tangan']);
        $this->assertSame($this->dataUri($this->stempel), $data['stempel']);

        $html = view('pdf.kisantra-invoice', $data)->render();
        $this->assertStringContainsString('src="'.$this->dataUri($this->ttd).'" class="signature-image"', $html);
        $this->assertStringContainsString('src="'.$this->dataUri($this->stempel).'" class="company-stamp"', $html);
    }

    public function test_tanda_tangan_bisa_tidak_dicetak_stempel_tetap(): void
    {
        $data = $this->viewData('kisantra-invoice', withSignature: false);

        $this->assertSame('', $data['company']['signature_base64']);
        $this->assertSame('', $data['tanda_tangan']);
        $this->assertSame($this->dataUri($this->stempel), $data['company']['stamp_base64']);
        $this->assertSame($this->dataUri($this->stempel), $data['stempel']);

        $html = view('pdf.kisantra-invoice', $data)->render();
        $this->assertStringNotContainsString('class="signature-image"', $html);
        $this->assertStringContainsString('class="company-stamp"', $html);
        // Ruang tanda tangan (nama & jabatan penanda tangan) tetap ada untuk tanda tangan basah.
        $this->assertStringContainsString('class="signature-name"', $html);
    }

    public function test_stempel_bisa_tidak_dicetak_tanda_tangan_tetap(): void
    {
        $data = $this->viewData('semesta-invoice', withStamp: false);

        $this->assertSame('', $data['company']['stamp_base64']);
        $this->assertSame('', $data['stempel']);
        $this->assertSame($this->dataUri($this->ttd), $data['company']['signature_base64']);
        $this->assertSame($this->dataUri($this->ttd), $data['tanda_tangan']);

        $html = view('pdf.semesta-invoice', $data)->render();
        $this->assertStringContainsString('alt="Signature"', $html);
        $this->assertStringNotContainsString('alt="Stamp"', $html);
    }

    public function test_rute_pdf_meneruskan_pilihan_cetak(): void
    {
        $url = "/invoice/{$this->invoice->id}";

        $lengkap = $this->actingAs($this->admin)->get("{$url}/preview")->assertOk()->getContent();
        $tanpaTtd = $this->actingAs($this->admin)->get("{$url}/preview?signature=0")->assertOk()->getContent();
        $tanpaKeduanya = $this->actingAs($this->admin)->get("{$url}/preview?signature=0&stamp=0")->assertOk()->getContent();
        $unduhTanpaKeduanya = $this->actingAs($this->admin)->get("{$url}/download?signature=0&stamp=0")->assertOk()->streamedContent();

        // Setiap gambar yang ditanam = satu objek /Image di PDF (kop surat, bila ada, ikut di semua varian).
        $gambar = fn (string $pdf): int => substr_count($pdf, '/Subtype /Image');
        $this->assertGreaterThanOrEqual(2, $gambar($lengkap));
        $this->assertSame($gambar($lengkap) - 1, $gambar($tanpaTtd));
        $this->assertSame($gambar($lengkap) - 2, $gambar($tanpaKeduanya));
        $this->assertSame($gambar($tanpaKeduanya), $gambar($unduhTanpaKeduanya));
    }

    public function test_detail_invoice_memberi_tahu_gambar_yang_sudah_diunggah(): void
    {
        $this->actingAs($this->admin)
            ->getJson("/invoices/{$this->invoice->id}/data")
            ->assertOk()
            ->assertJsonPath('print_images', ['signature' => true, 'stamp' => true]);

        CompanyProfile::current()->update(['stamp_path' => null]);

        $this->actingAs($this->admin)
            ->getJson("/invoices/{$this->invoice->id}/data")
            ->assertJsonPath('print_images', ['signature' => true, 'stamp' => false]);
    }
}
