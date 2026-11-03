<?php

namespace Tests\Tenancy;

use App\Models\AppNotification;
use App\Models\Feedback;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Tests\TenancyTestCase;

/**
 * ==========================================================================
 * KEBOCORAN TABEL CENTRAL — kelas bug yang isolasi koneksi TIDAK tangkap.
 * ==========================================================================
 *
 * Database-per-perusahaan melindungi tabel yang hidup di database TENANT:
 * developer yang lupa memasang filter tidak bisa membocorkan data PT lain,
 * karena koneksinya memang tidak sampai ke sana.
 *
 * Perlindungan itu berhenti tepat di batas tabel CENTRAL. `users`,
 * `company_user`, `feedbacks`, dan `app_notifications` hidup di satu database
 * yang dibagi SEMUA perusahaan, dan model-modelnya memakai trait
 * CentralConnection. Untuk tabel-tabel itu, satu-satunya pelindung adalah
 * cakupan query yang ditulis tangan — dan cakupan yang ditulis tangan bisa
 * lupa ditulis.
 *
 * Ketiga kebocoran di bawah ini BUKAN hipotesis. Ketiganya ditemukan pada QA
 * dua perusahaan lewat HTTP sungguhan, bukan lewat pembacaan kode:
 *
 *   1. /admin/users melisting SELURUH pengguna semua perusahaan, dan PUT ke id
 *      pengguna perusahaan lain menjawab 422 (validasi berjalan), bukan 404 —
 *      artinya barisnya ditemukan dan hampir diproses.
 *   2. Daftar feedback membocorkan ISI feedback perusahaan lain kepada pemegang
 *      izin `manage feedbacks`.
 *   3. Drawer notifikasi tidak disaring per perusahaan padahal prop loncengnya
 *      sudah — lonceng menampilkan 1, drawer menampilkan 2.
 *
 * Test di berkas ini menjaga ketiganya di tingkat query/model. Yang menjaga di
 * tingkat HTTP adalah berkas test Feature terkait; yang di sini sengaja dekat
 * ke sumbernya supaya pesan gagalnya menunjuk langsung ke cakupan yang hilang.
 */
class KebocoranTabelCentralTest extends TenancyTestCase
{
    /**
     * Pengguna PT A tidak boleh terlihat dari konteks PT B, dan sebaliknya.
     *
     * Ini test paling penting di berkas ini: kebocoran yang sama juga jalur
     * TULIS (update/destroy/bulkDestroy memakai tabel yang sama lewat
     * route-model binding).
     */
    public function test_daftar_pengguna_hanya_berisi_anggota_perusahaan_aktif(): void
    {
        $alpha = $this->member($this->slug(0));
        $beta = $this->member($this->slug(1));
        $keduanya = $this->member($this->slug(0), $this->slug(1));

        $this->useTenant(0);
        $terlihatDiA = User::query()->memberOfCurrentCompany()->pluck('id');

        $this->assertTrue($terlihatDiA->contains($alpha->id), 'Anggota PT A tidak terlihat di PT A sendiri.');
        $this->assertTrue($terlihatDiA->contains($keduanya->id), 'Anggota dua perusahaan tidak terlihat di PT A.');
        $this->assertFalse(
            $terlihatDiA->contains($beta->id),
            'BOCOR: pengguna milik PT B terlihat dari konteks PT A. Tabel `users` central — '
            .'cakupan memberOfCurrentCompany() hilang di salah satu pemanggil.'
        );

        $this->useTenant(1);
        $terlihatDiB = User::query()->memberOfCurrentCompany()->pluck('id');

        $this->assertTrue($terlihatDiB->contains($beta->id), 'Anggota PT B tidak terlihat di PT B sendiri.');
        $this->assertFalse(
            $terlihatDiB->contains($alpha->id),
            'BOCOR: pengguna milik PT A terlihat dari konteks PT B.'
        );
    }

    /**
     * KONTROL POSITIF. Tanpa cakupannya, kebocoran HARUS terjadi.
     *
     * Kalau test ini mulai gagal — yaitu `User::query()` yang terbuka ternyata
     * TIDAK membocorkan apa pun — maka test di atas hijau tanpa mengukur apa
     * pun, dan yang perlu diperiksa adalah apakah datanya benar-benar terbentuk.
     */
    public function test_kontrol_positif_query_terbuka_memang_membocorkan_pengguna(): void
    {
        $this->member($this->slug(0));
        $beta = $this->member($this->slug(1));

        $this->useTenant(0);

        $this->assertTrue(
            User::query()->whereKey($beta->id)->exists(),
            'KONTROL POSITIF RUSAK: User::query() yang TANPA cakupan tidak menemukan pengguna PT lain. '
            .'Artinya test kebocoran pengguna di berkas ini tidak lagi membuktikan adanya pelindung — '
            .'periksa apakah `users` masih benar-benar tabel central yang dibagi bersama.'
        );
    }

    /**
     * Gagal-tertutup: di luar konteks perusahaan, cakupan ini tidak boleh
     * mengembalikan siapa pun. Mengembalikan query terbuka akan membuat
     * kebocoran yang sama muncul lagi di setiap pemanggil yang lupa konteks.
     */
    public function test_cakupan_pengguna_gagal_tertutup_tanpa_perusahaan(): void
    {
        $this->member($this->slug(0));
        $this->endTenancy();

        $this->assertNull(tenant(), 'Skenario tidak terbentuk: tenancy masih aktif.');
        $this->assertSame(
            0,
            User::query()->memberOfCurrentCompany()->count(),
            'memberOfCurrentCompany() mengembalikan pengguna padahal tidak ada perusahaan aktif — '
            .'cakupan ini harus gagal-tertutup, bukan terbuka.'
        );
    }

    public function test_feedback_perusahaan_lain_tidak_terbaca(): void
    {
        $penulisA = $this->member($this->slug(0));
        $penulisB = $this->member($this->slug(1));

        $milikA = Feedback::create([
            'user_id' => $penulisA->id,
            'company_id' => $this->slug(0),
            'title' => 'ALPHA-rahasia-feedback',
            'description' => 'isi milik alpha',
            'type' => 'bug',
            'priority' => 'low',
            'status' => 'open',
        ]);

        $milikB = Feedback::create([
            'user_id' => $penulisB->id,
            'company_id' => $this->slug(1),
            'title' => 'BETA-rahasia-feedback',
            'description' => 'isi milik beta',
            'type' => 'bug',
            'priority' => 'low',
            'status' => 'open',
        ]);

        $warisan = Feedback::create([
            'user_id' => $penulisA->id,
            'company_id' => null,
            'title' => 'WARISAN-sebelum-multi-perusahaan',
            'description' => 'baris lama tanpa penanda perusahaan',
            'type' => 'feedback',
            'priority' => 'low',
            'status' => 'open',
        ]);

        $this->useTenant(0);
        $terlihat = Feedback::query()->forCurrentCompany()->pluck('id');

        $this->assertTrue($terlihat->contains($milikA->id), 'Feedback PT A tidak terlihat di PT A sendiri.');
        $this->assertFalse(
            $terlihat->contains($milikB->id),
            'BOCOR: feedback PT B terbaca dari konteks PT A. Judul dan isinya ikut terkirim ke frontend.'
        );
        $this->assertTrue(
            $terlihat->contains($warisan->id),
            'Feedback warisan (company_id NULL) ikut tersaring habis — deployment hasil adopsi akan '
            .'kehilangan seluruh feedback lamanya.'
        );
    }

    public function test_notifikasi_perusahaan_lain_tidak_terbaca(): void
    {
        $pengguna = $this->member($this->slug(0), $this->slug(1));

        // notify() menandai baris dengan perusahaan yang AKTIF saat dipanggil.
        $this->useTenant(0);
        $diA = AppNotification::notify($pengguna->id, 'uji', 'ALPHA-notif', 'pesan alpha');

        $this->useTenant(1);
        $diB = AppNotification::notify($pengguna->id, 'uji', 'BETA-notif', 'pesan beta');

        $this->assertSame($this->slug(0), $diA->company_id, 'notify() tidak menandai company_id di PT A.');
        $this->assertSame($this->slug(1), $diB->company_id, 'notify() tidak menandai company_id di PT B.');

        $this->useTenant(0);
        $terlihatDiA = AppNotification::forUser($pengguna->id)->forCurrentCompany()->pluck('id');

        $this->assertTrue($terlihatDiA->contains($diA->id), 'Notifikasi PT A tidak terlihat di PT A sendiri.');
        $this->assertFalse(
            $terlihatDiA->contains($diB->id),
            'BOCOR: notifikasi PT B terbaca dari konteks PT A. Inilah sebabnya lonceng pernah '
            .'menampilkan 1 sementara drawer menampilkan 2.'
        );
    }

    /**
     * Lonceng (HandleInertiaRequests) dan drawer (NotificationController) WAJIB
     * memakai satu cakupan yang sama. Dulu logikanya ditulis dua kali — closure
     * di middleware, dan tidak ada di controller — sehingga keduanya menyimpang.
     */
    public function test_lonceng_dan_drawer_menghitung_notifikasi_yang_sama(): void
    {
        $pengguna = $this->member($this->slug(0), $this->slug(1));
        $this->berikanRole($pengguna);

        $this->useTenant(0);
        AppNotification::notify($pengguna->id, 'uji', 'ALPHA-notif', 'pesan alpha');

        $this->useTenant(1);
        AppNotification::notify($pengguna->id, 'uji', 'BETA-notif', 'pesan beta');
        AppNotification::notify($pengguna->id, 'uji', 'BETA-notif-2', 'pesan beta lagi');

        $this->endTenancy();

        $drawer = $this->actingAs($pengguna)
            ->getJson('/c/'.$this->slug(0).'/notifications')
            ->assertOk()
            ->json();

        $this->assertSame(
            1,
            $drawer['total'],
            'Drawer notifikasi menampilkan '.$drawer['total'].' notifikasi padahal PT ini hanya punya 1 — '
            .'NotificationController kehilangan cakupan forCurrentCompany().'
        );
        $this->assertSame(1, $drawer['unread_count'], 'unread_count drawer tidak ikut tersaring per perusahaan.');

        foreach ($drawer['items'] as $item) {
            $this->assertStringNotContainsString(
                'BETA-',
                (string) $item['title'],
                'BOCOR: judul notifikasi PT lain muncul di drawer PT ini.'
            );
        }
    }

    private function berikanRole(User $pengguna): void
    {
        $sebelumnya = getPermissionsTeamId();
        setPermissionsTeamId(null);

        $role = Role::firstOrCreate(['name' => 'staff']);
        $role->givePermissionTo(Permission::firstOrCreate(['name' => 'view dashboard']));

        setPermissionsTeamId($sebelumnya);

        foreach ($pengguna->companies()->pluck('companies.id') as $slug) {
            $this->giveRole($pengguna, (string) $slug, 'staff');
        }
    }
}
