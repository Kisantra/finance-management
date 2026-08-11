<?php

namespace Tests\Feature;

use App\Console\Commands\CentralBackup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\ExecutableFinder;
use Tests\TestCase;

class CentralBackupCommandTest extends TestCase
{
    use RefreshDatabase;

    protected string $backupRoot;

    protected function setUp(): void
    {
        parent::setUp();

        $this->backupRoot = storage_path('app/testing-backups-'.uniqid());
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->backupRoot);

        parent::tearDown();
    }

    public function test_command_terdaftar(): void
    {
        $this->assertArrayHasKey('central:backup', Artisan::all());
    }

    public function test_gagal_rapi_bila_mysqldump_tidak_ada(): void
    {
        if ((new ExecutableFinder)->find('mysqldump') !== null) {
            $this->markTestSkipped('mysqldump tersedia — skenario binary hilang tidak relevan di mesin ini.');
        }

        $this->artisan('central:backup', ['--dir' => $this->backupRoot.'/'.now()->format('Y-m-d_His')])
            ->expectsOutputToContain('mysqldump')
            ->assertExitCode(1);
    }

    public function test_sukses_dump_database_central_bila_mysqldump_ada(): void
    {
        if ((new ExecutableFinder)->find('mysqldump') === null) {
            $this->markTestSkipped('mysqldump tidak tersedia di mesin ini.');
        }

        $dir = $this->backupRoot.'/'.now()->format('Y-m-d_His');

        $this->artisan('central:backup', ['--dir' => $dir])->assertExitCode(0);

        $centralDatabase = config('database.connections.'.config('tenancy.database.central_connection', 'mysql').'.database');
        $dump = $dir.'/'.$centralDatabase.'.sql.gz';

        $this->assertFileExists($dump);
        $this->assertGreaterThan(0, filesize($dump));

        $contents = (string) gzdecode((string) file_get_contents($dump));
        $this->assertStringContainsString('companies', $contents);
    }

    public function test_prune_menghapus_folder_lama_via_command(): void
    {
        if ((new ExecutableFinder)->find('mysqldump') === null) {
            $this->markTestSkipped('mysqldump tidak tersedia di mesin ini.');
        }

        [$old, $recent, $foreign] = $this->buatFolderDummy();

        $dir = $this->backupRoot.'/'.now()->format('Y-m-d_His');

        $this->artisan('central:backup', ['--dir' => $dir, '--keep-days' => 14])->assertExitCode(0);

        $this->assertDirectoryDoesNotExist($old);
        $this->assertDirectoryExists($recent);
        $this->assertDirectoryExists($foreign);
        $this->assertDirectoryExists($dir);
    }

    public function test_prune_logic_langsung_tanpa_bergantung_mysqldump(): void
    {
        [$old, $recent, $foreign] = $this->buatFolderDummy();

        $deleted = (new CentralBackup)->pruneOldBackups($this->backupRoot, 14);

        $this->assertSame([$old], $deleted);
        $this->assertDirectoryDoesNotExist($old);
        $this->assertDirectoryExists($recent);
        $this->assertDirectoryExists($foreign);
    }

    public function test_prune_tidak_menghapus_folder_bernama_lama_tapi_baru_disentuh(): void
    {
        $namedOldButFresh = $this->backupRoot.'/'.now()->subDays(30)->format('Y-m-d_His');
        File::ensureDirectoryExists($namedOldButFresh);

        $deleted = (new CentralBackup)->pruneOldBackups($this->backupRoot, 14);

        $this->assertSame([], $deleted);
        $this->assertDirectoryExists($namedOldButFresh);
    }

    /**
     * Menyiapkan tiga folder dummy di backup root: folder backup tua (nama
     * timestamp 30 hari lalu + mtime tua), folder backup baru (2 hari lalu),
     * dan folder non-backup (nama bebas, mtime tua) yang tidak boleh disentuh.
     *
     * @return array{0: string, 1: string, 2: string} [folder tua, folder baru, folder non-backup]
     */
    protected function buatFolderDummy(): array
    {
        $old = $this->backupRoot.'/'.now()->subDays(30)->format('Y-m-d_His');
        $recent = $this->backupRoot.'/'.now()->subDays(2)->format('Y-m-d_His');
        $foreign = $this->backupRoot.'/bukan-backup';

        foreach ([$old, $recent, $foreign] as $folder) {
            File::ensureDirectoryExists($folder);
        }

        touch($old, now()->subDays(30)->getTimestamp());
        touch($foreign, now()->subDays(30)->getTimestamp());

        return [$old, $recent, $foreign];
    }
}
