<?php

namespace Tests\Tenancy;

use App\Models\Client;
use App\Services\InvoiceNumberService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Symfony\Component\Console\Output\BufferedOutput;
use Tests\TenancyTestCase;

/**
 * Adopsi = memasukkan database perusahaan yang SUDAH berjalan ke dalam sistem
 * multi-tenant (lihat app/Console/Commands/CentralAdoptDatabase.php). Database
 * itu berisi invoice warisan yang bernomor tetapi `invoice_sequence`-nya kosong,
 * sementara InvoiceNumberService::nextSequence() membaca MAX(invoice_sequence).
 *
 * Kalau backfill tidak jalan, urutan dimulai ulang dari 1 sementara nomor lama
 * sudah terbit - nomor invoice bertabrakan di mata klien dan di mata pajak.
 *
 * Diuji di sini, bukan di suite Feature, karena backfill berjalan PER DATABASE
 * TENANT: perintahnya harus dieksekusi di dalam konteks tenant, dan hasilnya
 * tidak boleh menyentuh perusahaan lain.
 */
class AdopsiInvoiceSequenceTest extends TenancyTestCase
{
    public function test_setiap_invoice_warisan_mendapat_invoice_sequence(): void
    {
        $this->useTenant(0);
        $this->tanamInvoiceWarisan(0, ['001', '002', '003']);

        // Perusahaan lain juga punya nomor warisan - backfill tidak boleh melintas.
        $this->useTenant(1);
        $this->tanamInvoiceWarisan(1, ['001']);

        $this->useTenant(0);
        $buffer = new BufferedOutput;
        $this->artisanDiTenant($buffer);

        $kosong = $this->tenantConnection(0)
            ->table('invoices')
            ->whereNull('invoice_sequence')
            ->count();

        $this->assertSame(0, $kosong, "Masih ada invoice tanpa invoice_sequence setelah backfill:\n".$buffer->fetch());

        $this->assertSame(
            [1, 2, 3],
            $this->tenantConnection(0)->table('invoices')->orderBy('id')->pluck('invoice_sequence')->map(fn ($n) => (int) $n)->all(),
            'Urutan hasil backfill tidak mengikuti nomor invoice warisan.'
        );

        $this->assertNull(
            $this->tenantConnection(1)->table('invoices')->value('invoice_sequence'),
            'Backfill di perusahaan A ikut mengisi invoice perusahaan B.'
        );
    }

    public function test_nomor_berikutnya_tidak_bertabrakan_dengan_nomor_warisan(): void
    {
        $this->useTenant(0);
        $nomorWarisan = $this->tanamInvoiceWarisan(0, ['001', '002', '003']);

        $this->artisanDiTenant(new BufferedOutput);

        $layanan = app(InvoiceNumberService::class);
        $tanggal = Carbon::parse('2026-01-20');

        $this->assertSame(
            4,
            $layanan->nextSequence($tanggal),
            'nextSequence() tidak melanjutkan dari urutan warisan - nomor invoice akan terbit ulang dari 1.'
        );

        $berikutnya = $layanan->next($tanggal, (int) $this->tenantConnection(0)->table('clients')->value('id'));

        $this->assertNotContains(
            $berikutnya,
            $nomorWarisan,
            "Nomor invoice berikutnya ({$berikutnya}) bertabrakan dengan nomor warisan."
        );
        $this->assertStringStartsWith('004/INV/', $berikutnya);
    }

    /**
     * Invoice bernomor mengikuti pola aktif tetapi tanpa invoice_sequence -
     * persis bentuk data pada database yang baru diadopsi.
     *
     * @param  list<string>  $urutan
     * @return list<string> nomor invoice yang ditanam
     */
    private function tanamInvoiceWarisan(int $tenant, array $urutan): array
    {
        $client = Client::factory()->create();
        $nomor = [];

        foreach ($urutan as $i => $no) {
            $nomor[] = $angka = "{$no}/INV/TST-KLN/I/2026";

            $this->tenantConnection($tenant)->table('invoices')->insert([
                'invoice_number' => $angka,
                'invoice_sequence' => null,
                'billed_to_id' => $client->id,
                'subtotal' => 1000000,
                'total_amount' => 1000000,
                'issue_date' => '2026-01-'.str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT),
                'due_date' => '2026-02-01',
                'status' => 'sent',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $nomor;
    }

    /** Jalankan backfill di dalam konteks tenant yang sedang aktif. */
    private function artisanDiTenant(BufferedOutput $buffer): void
    {
        $this->assertTrue(tenancy()->initialized, 'Backfill dijalankan tanpa konteks tenant.');

        Artisan::call('invoice:backfill-sequence', [], $buffer);
    }
}
