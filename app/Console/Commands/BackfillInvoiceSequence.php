<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use App\Services\InvoiceNumberService;
use Illuminate\Console\Command;

/**
 * Mengisi `invoices.invoice_sequence` untuk invoice yang sudah bernomor tetapi urutannya
 * kosong, dengan membaca POLA YANG SEDANG BERLAKU di Pengaturan › Penomoran invoice.
 *
 * Migrasi `2026_10_08_004959` sudah mencoba ini, tapi memakai regex `^(\d+)\/INV\/` yang
 * dipatok ke satu format. Instalasi yang memakai format lain — mis. `INV/01/KSN/01.26` —
 * tidak cocok satu pun, backfill diam-diam tidak mengisi apa-apa, dan akibatnya
 * `nextSequence()` mengulang dari 1 sementara nomor lama sudah terbit.
 */
class BackfillInvoiceSequence extends Command
{
    protected $signature = 'invoice:backfill-sequence {--dry-run : Tampilkan hasilnya tanpa menyimpan}';

    protected $description = 'Isi invoice_sequence dari nomor invoice yang sudah ada, mengikuti pola penomoran aktif';

    public function handle(InvoiceNumberService $numbers): int
    {
        $settings = $numbers->settings();
        $kering = $this->option('dry-run');

        $this->line('Pola aktif : '.$settings['format']);
        $this->line('Padding    : '.$settings['padding'].'   Reset: '.$settings['reset']);
        $this->newLine();

        $hasil = $numbers->backfillSequences(! $kering);
        $terisi = $hasil['filled'];
        $tidakCocok = $hasil['unmatched'];

        $this->info($kering
            ? "{$terisi} invoice AKAN diisi urutannya."
            : "{$terisi} invoice diisi urutannya.");

        if ($tidakCocok !== []) {
            $this->newLine();
            $this->warn(count($tidakCocok).' nomor tidak cocok dengan pola aktif dan dibiarkan kosong:');
            foreach (array_slice($tidakCocok, 0, 20) as $nomor) {
                $this->line('  '.$nomor);
            }
            if (count($tidakCocok) > 20) {
                $this->line('  ... dan '.(count($tidakCocok) - 20).' lainnya');
            }
            $this->newLine();
            $this->line('Periksa apakah pola di Pengaturan › Penomoran invoice sudah sesuai riwayat Anda,');
            $this->line('lalu jalankan ulang. Nomor yang tetap tidak cocok aman dibiarkan kosong.');
        }

        return self::SUCCESS;
    }
}
