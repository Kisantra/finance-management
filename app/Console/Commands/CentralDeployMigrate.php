<?php

namespace App\Console\Commands;

use App\Models\Company;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;
use Throwable;

class CentralDeployMigrate extends Command
{
    protected $signature = 'central:deploy-migrate
        {--canary= : Slug perusahaan canary — dimigrasi lebih dulu; bila gagal, tenant lain tidak disentuh}
        {--skip-central : Lewati migrasi database central}
        {--force : Lanjut ke seluruh tenant tanpa konfirmasi setelah canary sukses}';

    protected $description = 'Deploy migration terkontrol: central → canary → seluruh tenant aktif satu per satu, dengan laporan per perusahaan';

    /**
     * Hasil per perusahaan untuk laporan akhir.
     *
     * @var list<array{slug: string, status: string, message: string}>
     */
    private array $results = [];

    public function handle(): int
    {
        if (! $this->migrateCentral()) {
            return self::FAILURE;
        }

        $companies = Company::orderBy('id')->get();

        if ($companies->isEmpty()) {
            $this->info('Tidak ada perusahaan terdaftar — selesai setelah migrasi central.');

            return self::SUCCESS;
        }

        $canarySlug = $this->option('canary');

        if ($canarySlug !== null) {
            /** @var Company|null $canary */
            $canary = $companies->firstWhere('id', $canarySlug);

            if (! $canary) {
                $this->error("Canary \"{$canarySlug}\" tidak terdaftar sebagai company.");

                return self::FAILURE;
            }

            if (! $canary->isActive()) {
                $this->error("Canary \"{$canarySlug}\" berstatus \"{$canary->status}\" — canary harus company aktif.");

                return self::FAILURE;
            }

            $this->info("Canary: migrasi tenant {$canarySlug} lebih dulu...");
            $error = $this->migrateTenant($canary);

            if ($error !== null) {
                $this->record($canarySlug, 'FAILED', $error);
                $this->skipRemaining($companies, $canarySlug, 'canary gagal — tidak disentuh');
                $this->error("Canary {$canarySlug} GAGAL — berhenti total, tenant lain tidak disentuh.");
                $this->report();

                return self::FAILURE;
            }

            $this->record($canarySlug, 'OK', 'canary');
            $this->info("✓ Canary {$canarySlug} sukses.");

            if ($this->shouldAbortAfterCanary()) {
                $this->skipRemaining($companies, $canarySlug, 'dibatalkan operator setelah canary sukses');
                $this->report();

                return self::SUCCESS;
            }
        }

        foreach ($companies as $company) {
            $slug = (string) $company->getTenantKey();

            if ($slug === $canarySlug) {
                continue;
            }

            if (! $company->isActive()) {
                $this->record($slug, 'SKIPPED', "status: {$company->status}");

                continue;
            }

            $error = $this->migrateTenant($company);
            $this->record($slug, $error === null ? 'OK' : 'FAILED', $error ?? '');
        }

        return $this->report() === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function migrateCentral(): bool
    {
        if ($this->option('skip-central')) {
            $this->warn('Migrasi central dilewati (--skip-central).');

            return true;
        }

        $this->info('Migrasi database central...');

        try {
            $exitCode = Artisan::call('migrate', ['--force' => true], $this->output);
        } catch (Throwable $e) {
            $this->error('Migrasi central GAGAL: '.Str::limit($e->getMessage(), 150));

            return false;
        }

        if ($exitCode !== self::SUCCESS) {
            $this->error("Migrasi central GAGAL (exit code {$exitCode}).");

            return false;
        }

        $this->info('✓ Migrasi central selesai.');

        return true;
    }

    /**
     * Jalankan tenants:migrate untuk satu tenant. Mengembalikan null bila
     * sukses, atau pesan error singkat bila gagal.
     *
     * Keberadaan database tenant diperiksa lebih dulu: `migrate --force`
     * bawaan Laravel otomatis MEMBUAT database MySQL yang hilang (rescue
     * error 1049) — deploy wrapper tidak boleh diam-diam membuat database
     * tenant kosong, melainkan melaporkannya sebagai kegagalan.
     */
    private function migrateTenant(Company $company): ?string
    {
        $slug = (string) $company->getTenantKey();
        $this->line("→ tenants:migrate --tenants={$slug}");

        try {
            $database = $company->database()->getName();

            if (! $company->database()->manager()->databaseExists($database)) {
                return "database {$database} tidak ditemukan";
            }

            $exitCode = Artisan::call('tenants:migrate', ['--tenants' => [$slug], '--force' => true], $this->output);
        } catch (Throwable $e) {
            $this->endTenancyQuietly();

            return Str::limit($e->getMessage(), 150);
        }

        return $exitCode === self::SUCCESS ? null : "exit code {$exitCode}";
    }

    /**
     * Setelah kegagalan di tengah tenants:migrate, tenancy bisa tertinggal
     * terinisialisasi (koneksi default masih menunjuk database tenant yang
     * gagal) — kembalikan ke koneksi central agar tenant berikutnya dan
     * laporan akhir tetap berjalan normal.
     */
    private function endTenancyQuietly(): void
    {
        try {
            if (tenancy()->initialized) {
                tenancy()->end();
            }
        } catch (Throwable) {
        }
    }

    private function shouldAbortAfterCanary(): bool
    {
        if ($this->option('force') || ! $this->input->isInteractive()) {
            return false;
        }

        return ! $this->confirm('Canary sukses. Lanjutkan migrasi ke seluruh perusahaan lainnya?', true);
    }

    /**
     * @param  Collection<int, Company>  $companies
     */
    private function skipRemaining(Collection $companies, string $canarySlug, string $reason): void
    {
        foreach ($companies as $company) {
            $slug = (string) $company->getTenantKey();

            if ($slug !== $canarySlug) {
                $this->record($slug, 'SKIPPED', $reason);
            }
        }
    }

    private function record(string $slug, string $status, string $message = ''): void
    {
        $this->results[] = ['slug' => $slug, 'status' => $status, 'message' => $message];
    }

    /**
     * Cetak laporan per perusahaan (slug | status | keterangan) dan
     * kembalikan jumlah perusahaan yang gagal.
     */
    private function report(): int
    {
        $this->newLine();
        $this->table(
            ['Perusahaan', 'Status', 'Keterangan'],
            array_map(fn (array $row): array => array_values($row), $this->results)
        );

        $counts = collect($this->results)->countBy('status');
        $failed = (int) $counts->get('FAILED', 0);

        $this->info(sprintf(
            'Ringkasan: %d OK, %d FAILED, %d SKIPPED dari %d perusahaan.',
            (int) $counts->get('OK', 0),
            $failed,
            (int) $counts->get('SKIPPED', 0),
            count($this->results),
        ));

        if ($failed > 0) {
            $this->error('Ada tenant yang gagal — perbaiki penyebabnya lalu jalankan ulang (migration yang sudah tercatat tidak diulang).');
        }

        return $failed;
    }
}
