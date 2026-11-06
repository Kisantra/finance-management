<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Feedback;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Kisantra\Watchpost\Events\TicketUpdated;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Fase 2: status tiket di Watchpost kembali ke laporan bug pelapornya
 * (watchpost:sync-tickets → TicketUpdated → PerbaruiFeedbackDariWatchpost),
 * dan status bug yang sudah diteruskan tidak lagi diubah dari aplikasi.
 */
class StatusTiketWatchpostTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $semua = ['view feedbacks', 'create feedbacks', 'respond feedbacks', 'manage feedbacks'];
        foreach ($semua as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        Role::firstOrCreate(['name' => 'admin'])->syncPermissions($semua);
        Role::firstOrCreate(['name' => 'finance manager']);
        Role::firstOrCreate(['name' => 'staff'])->syncPermissions(['view feedbacks', 'create feedbacks']);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        $this->staff = User::factory()->create();
        $this->staff->assignRole('staff');
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function bugTerkirim(array $attributes = []): Feedback
    {
        return Feedback::create([
            'user_id' => $this->staff->id,
            'company_id' => 'test-company',
            'title' => 'Saldo BCA tidak sama',
            'description' => 'Selisih Rp 250.000.',
            'type' => 'bug',
            'priority' => 'high',
            'status' => 'open',
            'watchpost_ticket_id' => 12,
            'watchpost_ticket_number' => '#12',
            'watchpost_ticket_url' => 'https://watchpost.test/tickets/12',
            ...$attributes,
        ]);
    }

    private function tiket(string $status, array $references, int $ticketId = 12): TicketUpdated
    {
        return new TicketUpdated($ticketId, "#{$ticketId}", "https://watchpost.test/tickets/{$ticketId}", $status, $references);
    }

    public function test_tiket_selesai_menyelesaikan_laporannya_dan_memberi_tahu_pelapor_di_perusahaannya(): void
    {
        $feedback = $this->bugTerkirim();

        event($this->tiket('resolved', ['feedback-'.$feedback->id]));

        $this->assertSame('resolved', $feedback->fresh()->status);

        $notifikasi = AppNotification::where('user_id', $this->staff->id)->sole();
        $this->assertSame('test-company', $notifikasi->company_id, 'Tanpa perusahaan, notifikasi muncul di semua perusahaan pelapor.');
        $this->assertSame('Laporan "Saldo BCA tidak sama" sudah diselesaikan tim IT.', $notifikasi->message);
        $this->assertStringEndsWith('/c/test-company/feedbacks?show='.$feedback->id, $notifikasi->data['url']);
    }

    public function test_status_yang_sama_tidak_memberi_tahu_lagi(): void
    {
        $feedback = $this->bugTerkirim();

        event($this->tiket('in_progress', ['feedback-'.$feedback->id]));
        event($this->tiket('in_progress', ['feedback-'.$feedback->id]));

        $this->assertSame('in_progress', $feedback->fresh()->status);
        $this->assertSame(1, AppNotification::count());
    }

    public function test_tiket_diabaikan_menutup_laporannya(): void
    {
        $feedback = $this->bugTerkirim();

        event($this->tiket('ignored', ['feedback-'.$feedback->id]));

        $this->assertSame('closed', $feedback->fresh()->status);
    }

    public function test_hanya_laporan_bug_milik_tiket_itu_yang_disentuh(): void
    {
        $tiketLain = $this->bugTerkirim(['watchpost_ticket_id' => 99, 'watchpost_ticket_number' => '#99']);
        $fitur = $this->bugTerkirim(['type' => 'feature']);

        event($this->tiket('resolved', ['feedback-'.$tiketLain->id, 'feedback-'.$fitur->id, 'feedback-999999', 'laporan-lain-5']));

        $this->assertSame('open', $tiketLain->fresh()->status);
        $this->assertSame('open', $fitur->fresh()->status);
        $this->assertSame(0, AppNotification::count());
    }

    public function test_tiket_dicatat_bila_job_pengirim_belum_sempat(): void
    {
        $feedback = $this->bugTerkirim(['watchpost_ticket_id' => null, 'watchpost_ticket_number' => null, 'watchpost_ticket_url' => null]);

        event($this->tiket('in_progress', ['feedback-'.$feedback->id], 7));

        $feedback->refresh();
        $this->assertSame(7, $feedback->watchpost_ticket_id);
        $this->assertSame('#7', $feedback->watchpost_ticket_number);
        $this->assertSame('in_progress', $feedback->status);
    }

    public function test_sinkronisasi_dari_scheduler_sampai_ke_laporan(): void
    {
        config([
            'watchpost.url' => 'https://watchpost.test',
            'watchpost.token' => 'wp_uji',
            'watchpost.environments' => ['testing'],
        ]);
        $feedback = $this->bugTerkirim();
        Http::fake(['watchpost.test/api/ingest/tickets/updates*' => Http::response([
            'tickets' => [[
                'ticket' => 12,
                'number' => '#12',
                'url' => 'https://watchpost.test/tickets/12',
                'status' => 'resolved',
                'resolved_at' => '2026-11-06T10:30:00+00:00',
                'updated_at' => '2026-11-06T10:30:00+00:00',
                'references' => ['feedback-'.$feedback->id],
            ]],
            'next_since' => '2026-11-06T10:31:00+00:00',
        ])]);

        $this->artisan('watchpost:sync-tickets')->expectsOutputToContain('1 tiket diperbarui.')->assertSuccessful();

        $this->assertSame('resolved', $feedback->fresh()->status);
        $this->assertSame(1, AppNotification::where('user_id', $this->staff->id)->count());
    }

    public function test_ubah_status_bug_yang_sudah_diteruskan_ditolak(): void
    {
        $feedback = $this->bugTerkirim();

        $this->actingAs($this->admin)
            ->post("/feedbacks/{$feedback->id}/status", ['status' => 'resolved'])
            ->assertRedirect()
            ->assertSessionHas('error', 'Status laporan ini mengikuti tiket Watchpost #12 dan diatur tim IT di sana.');

        $this->assertSame('open', $feedback->fresh()->status);
    }

    public function test_tanggapan_tetap_bisa_dikirim_tanpa_mengubah_status(): void
    {
        $feedback = $this->bugTerkirim();

        $this->actingAs($this->admin)
            ->post("/feedbacks/{$feedback->id}/respond", ['response' => 'Sudah kami teruskan ke tim IT.', 'status' => 'closed'])
            ->assertRedirect();

        $feedback->refresh();
        $this->assertSame('Sudah kami teruskan ke tim IT.', $feedback->admin_response);
        $this->assertSame('open', $feedback->status, 'Status mengikuti Watchpost, bukan dialog Tanggapi.');
    }

    public function test_detail_memberi_tahu_bahwa_status_mengikuti_watchpost(): void
    {
        $diteruskan = $this->bugTerkirim();
        $belum = $this->bugTerkirim(['watchpost_ticket_id' => null, 'watchpost_ticket_number' => null]);

        $this->actingAs($this->admin)->get('/feedbacks?show='.$diteruskan->id)
            ->assertInertia(fn ($page) => $page->where('showFeedback.status_ikut_watchpost', true));
        $this->actingAs($this->admin)->get('/feedbacks?show='.$belum->id)
            ->assertInertia(fn ($page) => $page->where('showFeedback.status_ikut_watchpost', false));
    }

    public function test_bug_yang_belum_diteruskan_tetap_wajib_memilih_status(): void
    {
        $feedback = $this->bugTerkirim(['watchpost_ticket_id' => null, 'watchpost_ticket_number' => null]);

        $this->actingAs($this->admin)
            ->post("/feedbacks/{$feedback->id}/respond", ['response' => 'Kami cek.'])
            ->assertSessionHasErrors('status');
    }
}
