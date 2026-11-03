<?php

namespace App\Console\Commands;

use App\Models\Company;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

class CentralBackup extends Command
{
    protected $signature = 'central:backup
        {--dir= : Folder tujuan backup (default: storage/app/backups/{Y-m-d_His})}
        {--keep-days=14 : Hapus folder backup lama di parent dir yang lebih tua dari N hari}';

    protected $description = 'Backup database central + seluruh database tenant (mysqldump → gzip), lalu prune folder backup lama';

    public function handle(): int
    {
        $binary = (new ExecutableFinder)->find('mysqldump');

        if ($binary === null) {
            $this->error('Binary mysqldump tidak ditemukan di PATH — install MySQL client tools lebih dulu.');

            return self::FAILURE;
        }

        $connection = config('tenancy.database.central_connection', 'mysql');

        /** @var array{host?: string, port?: int|string, database: string, username?: string, password?: string, unix_socket?: string} $config */
        $config = config("database.connections.{$connection}");

        $dir = $this->option('dir') ?: storage_path('app/backups/'.now()->format('Y-m-d_His'));
        File::ensureDirectoryExists($dir);

        [$databases, $missing, $orphans] = $this->collectDatabases($connection, $config['database']);

        foreach ($missing as $slug) {
            $this->warn("⚠ Company {$slug}: database tenant_{$slug} tidak ditemukan — dilewati.");
        }

        foreach ($orphans as $schema) {
            $this->warn("⚠ Database tenant yatim: {$schema} tidak punya baris company — tidak ikut di-backup, periksa manual.");
        }

        $failed = 0;

        foreach ($databases as $database) {
            $path = $dir.'/'.$database.'.sql.gz';
            $error = $this->dumpDatabase($binary, $config, $database, $path);

            if ($error === null) {
                $this->info(sprintf('✓ %s OK (%s)', $database, $this->formatBytes((int) filesize($path))));
            } else {
                $failed++;
                $this->error(sprintf('✗ %s FAILED — %s', $database, $error));
            }
        }

        $pruned = $this->pruneOldBackups(dirname($dir), (int) $this->option('keep-days'), $dir);

        foreach ($pruned as $oldDir) {
            $this->line("Prune: {$oldDir} dihapus.");
        }

        $this->newLine();
        $this->info(sprintf(
            'Selesai: %d OK, %d gagal, %d dilewati, %d DB yatim, %d folder lama dihapus → %s',
            count($databases) - $failed,
            $failed,
            count($missing),
            count($orphans),
            count($pruned),
            $dir
        ));

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Mengumpulkan database yang akan di-dump: central + tenant_{slug} untuk
     * setiap Company yang schemanya benar-benar ada. Company tanpa schema
     * dilaporkan "missing"; schema tenant_% tanpa baris company dilaporkan
     * "orphan" (hanya dilaporkan, tidak di-dump).
     *
     * @return array{0: list<string>, 1: list<string>, 2: list<string>} [databases, missing slugs, orphan schemas]
     */
    protected function collectDatabases(string $connection, string $centralDatabase): array
    {
        $schemas = collect(DB::connection($connection)
            ->select("SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE 'tenant\\_%'"))
            ->pluck('name');

        $slugs = Company::query()->pluck('id');

        $databases = [$centralDatabase];
        $missing = [];

        foreach ($slugs as $slug) {
            $tenantDatabase = 'tenant_'.$slug;

            if ($schemas->contains($tenantDatabase)) {
                $databases[] = $tenantDatabase;
            } else {
                $missing[] = $slug;
            }
        }

        $expected = $slugs->map(fn (string $slug): string => 'tenant_'.$slug);
        $orphans = $schemas->reject(fn (string $schema): bool => $expected->contains($schema))->values()->all();

        return [$databases, $missing, $orphans];
    }

    /**
     * Menjalankan mysqldump untuk satu database dan menulis hasilnya sebagai
     * gzip. Password lewat env MYSQL_PWD (tidak pernah di argumen proses).
     * Mengembalikan null bila sukses, atau pesan error singkat bila gagal.
     *
     * @param  array{host?: string, port?: int|string, username?: string, password?: string, unix_socket?: string}  $config
     */
    protected function dumpDatabase(string $binary, array $config, string $database, string $path): ?string
    {
        $command = [$binary, '--single-transaction', '--routines'];

        if (! empty($config['unix_socket'])) {
            $command[] = '--socket='.$config['unix_socket'];
        } else {
            $command[] = '--host='.($config['host'] ?? '127.0.0.1');
            $command[] = '--port='.($config['port'] ?? 3306);
        }

        $command[] = '--user='.($config['username'] ?? 'root');
        $command[] = $database;

        $process = new Process($command, null, ['MYSQL_PWD' => $config['password'] ?? ''], null, 3600.0);

        $handle = gzopen($path, 'wb9');

        if ($handle === false) {
            return "tidak bisa menulis {$path}";
        }

        $process->run(function (string $type, string $buffer) use ($handle): void {
            if ($type === Process::OUT) {
                gzwrite($handle, $buffer);
            }
        });

        gzclose($handle);

        if (! $process->isSuccessful()) {
            File::delete($path);

            return trim($process->getErrorOutput()) ?: 'exit code '.$process->getExitCode();
        }

        return null;
    }

    /**
     * Menghapus folder backup lama di parent dir. Hanya folder yang namanya
     * berpola timestamp Y-m-d_His DAN yang timestamp-nama serta mtime-nya
     * sama-sama lebih tua dari cutoff yang dihapus — folder lain (nama bebas,
     * atau baru disentuh) tidak pernah disentuh. Folder backup aktif dilewati.
     *
     * @return list<string> path folder yang dihapus
     */
    public function pruneOldBackups(string $parentDir, int $keepDays, ?string $currentDir = null): array
    {
        if ($keepDays < 0 || ! is_dir($parentDir)) {
            return [];
        }

        $cutoff = now()->subDays($keepDays);
        $deleted = [];

        foreach (File::directories($parentDir) as $directory) {
            if ($currentDir !== null && realpath($directory) === realpath($currentDir)) {
                continue;
            }

            $name = basename($directory);

            if (! preg_match('/^\d{4}-\d{2}-\d{2}_\d{6}$/', $name)) {
                continue;
            }

            $namedAt = Carbon::createFromFormat('Y-m-d_His', $name);

            if ($namedAt === null || $namedAt->isAfter($cutoff)) {
                continue;
            }

            $modifiedAt = Carbon::createFromTimestamp(File::lastModified($directory));

            if ($modifiedAt->isAfter($cutoff)) {
                continue;
            }

            File::deleteDirectory($directory);
            $deleted[] = $directory;
        }

        return $deleted;
    }

    protected function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $size = (float) $bytes;
        $index = 0;

        while ($size >= 1024 && $index < count($units) - 1) {
            $size /= 1024;
            $index++;
        }

        return sprintf('%.1f %s', $size, $units[$index]);
    }
}
