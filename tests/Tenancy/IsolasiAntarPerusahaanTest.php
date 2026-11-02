<?php

namespace Tests\Tenancy;

use App\Models\Client;
use App\Models\Invoice;
use Tests\TenancyTestCase;

/**
 * Test yang membuktikan SELURUH alasan arsitektur database-per-perusahaan ada.
 *
 * Bila satu test di berkas ini merah, data satu klien terbaca oleh klien lain -
 * tidak ada fitur lain yang lebih penting dari ini.
 */
class IsolasiAntarPerusahaanTest extends TenancyTestCase
{
    public function test_invoice_yang_ditulis_di_tenant_a_tidak_ada_di_tenant_b(): void
    {
        $this->useTenant(0);
        $client = Client::factory()->create(['name' => 'Klien Rahasia A']);
        Invoice::factory()->create([
            'invoice_number' => 'RAHASIA/A/001',
            'billed_to_id' => $client->id,
        ]);

        $this->useTenant(1);

        $this->assertSame(
            0,
            Invoice::where('invoice_number', 'RAHASIA/A/001')->count(),
            'Invoice tenant A terbaca dari konteks tenant B - isolasi database bocor.'
        );
        $this->assertSame(
            0,
            Client::where('name', 'Klien Rahasia A')->count(),
            'Klien tenant A terbaca dari konteks tenant B - isolasi database bocor.'
        );
    }

    /**
     * Database central MEMILIKI tabel `invoices` (migration tenant ikut dimuat
     * di env testing), jadi "tidak ada di central" adalah pernyataan tentang
     * ISI tabel itu, bukan tentang keberadaannya.
     */
    public function test_invoice_tenant_tidak_pernah_mendarat_di_database_central(): void
    {
        $this->useTenant(0);
        $client = Client::factory()->create();
        Invoice::factory()->create([
            'invoice_number' => 'RAHASIA/CENTRAL/001',
            'billed_to_id' => $client->id,
        ]);

        $this->assertSame(
            1,
            $this->tenantConnection(0)->table('invoices')->where('invoice_number', 'RAHASIA/CENTRAL/001')->count(),
            'Invoice tidak tertulis di database tenant - tenancy tidak menukar koneksi.'
        );

        $this->endTenancy();

        $this->assertSame(
            0,
            $this->centralConnection()->table('invoices')->where('invoice_number', 'RAHASIA/CENTRAL/001')->count(),
            'Invoice tenant tertulis ke database CENTRAL - koneksi default tidak pernah berpindah.'
        );
    }

    /**
     * Konsekuensi langsung dari isolasi: urutan/nomor invoice tiap perusahaan
     * berdiri sendiri. Dengan satu database bersama, baris kedua akan ditolak
     * unique index invoice_number.
     */
    public function test_dua_perusahaan_boleh_memakai_nomor_invoice_yang_sama(): void
    {
        foreach ([0, 1] as $i) {
            $this->useTenant($i);
            $client = Client::factory()->create();
            Invoice::factory()->create([
                'invoice_number' => '001/INV/SAMA/I/2026',
                'billed_to_id' => $client->id,
            ]);
        }

        $this->assertSame(1, $this->tenantConnection(0)->table('invoices')->count());
        $this->assertSame(1, $this->tenantConnection(1)->table('invoices')->count());
    }
}
