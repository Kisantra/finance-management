<?php

namespace Tests\Tenancy;

use App\Models\AppNotification;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Testing\TestResponse;
use RuntimeException;
use Tests\TenancyTestCase;

/**
 * Feedback dan notifikasinya tinggal di database PUSAT, sedangkan di dalam
 * /c/{company} koneksi default adalah database perusahaan. Transaksi
 * FeedbackController::store harus dibuka di koneksi pusat; kalau tidak, feedback
 * tetap tersimpan walau notifikasinya gagal. Di suite Unit/Feature pusat dan
 * perusahaan satu database, jadi kesalahan itu tidak pernah terlihat di sana.
 */
class FeedbackTransaksiPusatTest extends TenancyTestCase
{
    private User $pelapor;

    protected function setUp(): void
    {
        parent::setUp();

        $sebelumnya = getPermissionsTeamId();
        setPermissionsTeamId(null);

        $staff = Role::firstOrCreate(['name' => 'staff']);
        foreach (['view feedbacks', 'create feedbacks'] as $izin) {
            $staff->givePermissionTo(Permission::firstOrCreate(['name' => $izin]));
        }
        Role::firstOrCreate(['name' => 'admin']);
        Role::firstOrCreate(['name' => 'finance manager']);

        setPermissionsTeamId($sebelumnya);

        $this->pelapor = $this->member($this->slug(0));
        $this->giveRole($this->pelapor, $this->slug(0), 'staff');

        // Penerima notifikasi "Feedback Baru".
        $admin = $this->member($this->slug(0));
        $this->giveRole($admin, $this->slug(0), 'admin');
    }

    private function kirim(string $judul): TestResponse
    {
        return $this->actingAs($this->pelapor)->post('/c/'.$this->slug(0).'/feedbacks', [
            'title' => $judul,
            'description' => 'Selisih Rp 250.000.',
            'type' => 'feature',
            'priority' => 'medium',
        ]);
    }

    public function test_kontrol_feedback_dan_notifikasinya_tersimpan_di_pusat(): void
    {
        $this->kirim('Laporan kontrol')->assertRedirect();

        $feedback = $this->centralConnection()->table('feedbacks')->where('title', 'Laporan kontrol')->first();

        $this->assertNotNull($feedback, 'Feedback tidak tersimpan di database pusat.');
        $this->assertSame($this->slug(0), $feedback->company_id);
        $this->assertSame(1, $this->centralConnection()->table('app_notifications')->where('company_id', $this->slug(0))->count());
    }

    public function test_feedback_batal_bila_notifikasinya_gagal(): void
    {
        AppNotification::creating(fn () => throw new RuntimeException('Notifikasi gagal dibuat'));

        $this->kirim('Laporan yang harus batal')->assertServerError();

        $this->assertSame(
            0,
            $this->centralConnection()->table('feedbacks')->where('title', 'Laporan yang harus batal')->count(),
            'Feedback tetap tersimpan walau notifikasinya gagal - transaksi dibuka di database perusahaan, bukan pusat.'
        );
    }
}
