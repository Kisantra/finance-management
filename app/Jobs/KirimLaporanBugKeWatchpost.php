<?php

namespace App\Jobs;

use App\Models\Company;
use App\Models\Feedback;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Kisantra\Watchpost\BugReport;
use Kisantra\Watchpost\Facades\Watchpost;
use Throwable;

/**
 * Meneruskan satu laporan bug ke Watchpost, tempat tim IT bekerja: menjadi
 * tiket baru, atau menempel ke tiket error yang sama bila dikirim dari halaman
 * error (trace_id). Feedback-nya sendiri sudah tersimpan sebelum job ini jalan,
 * jadi Watchpost yang mati tidak pernah menggagalkan laporan pengguna.
 *
 * Di-dispatch dari konteks perusahaan; QueueTenancyBootstrapper memulihkannya
 * di worker, sehingga disk `public` menunjuk storage perusahaan pemilik lampiran.
 */
class KirimLaporanBugKeWatchpost implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    /** Jeda sebelum percobaan berikutnya bila Watchpost belum menerima, dalam detik. */
    private const JEDA = [60, 300, 900, 3600];

    /**
     * Istilah prioritas Finance → istilah Watchpost.
     *
     * @var array<string, string>
     */
    private const PRIORITAS = [
        'low' => 'low',
        'medium' => 'normal',
        'high' => 'high',
        'critical' => 'urgent',
    ];

    public function __construct(public int $feedbackId) {}

    public function handle(): void
    {
        if (! Watchpost::reportsBugs()) {
            return;
        }

        $feedback = Feedback::with('user')->find($this->feedbackId);

        // Terhapus sebelum sempat terkirim, atau sudah punya tiket dari percobaan sebelumnya.
        if ($feedback === null || $feedback->type !== 'bug' || $feedback->watchpost_ticket_id !== null) {
            return;
        }

        $receipt = Watchpost::reportBug($this->laporan($feedback));

        if ($receipt === null) {
            $this->release(self::JEDA[min($this->attempts(), count(self::JEDA)) - 1]);

            return;
        }

        $feedback->update([
            'watchpost_ticket_id' => $receipt->id,
            'watchpost_ticket_number' => $receipt->number,
            'watchpost_ticket_url' => $receipt->url,
        ]);
    }

    public function failed(?Throwable $exception): void
    {
        // Feedback tetap ada di aplikasi; hanya salinannya di Watchpost yang tidak terbentuk.
        Log::warning('Laporan bug tidak terkirim ke Watchpost setelah semua percobaan.', [
            'feedback_id' => $this->feedbackId,
            'alasan' => $exception?->getMessage(),
        ]);
    }

    private function laporan(Feedback $feedback): BugReport
    {
        $lampiran = $feedback->attachment_path !== null && Storage::disk('public')->exists($feedback->attachment_path)
            ? Storage::disk('public')->path($feedback->attachment_path)
            : null;

        return new BugReport(
            // ID feedback unik di seluruh instalasi (tabelnya di database pusat).
            reference: 'feedback-'.$feedback->id,
            title: $feedback->title,
            description: $feedback->description,
            reporterName: $feedback->user->name ?? 'Pengguna #'.$feedback->user_id,
            reporterEmail: $feedback->user?->email,
            priority: self::PRIORITAS[$feedback->priority] ?? 'normal',
            company: $this->namaPerusahaan($feedback),
            pageUrl: $feedback->page_url,
            traceId: $feedback->trace_id,
            errorId: $feedback->error_id,
            breadcrumbs: $feedback->breadcrumbs ?? [],
            userAgent: $feedback->user_agent,
            attachmentPath: $lampiran,
            attachmentName: $lampiran !== null ? $feedback->attachment_name : null,
        );
    }

    private function namaPerusahaan(Feedback $feedback): ?string
    {
        if ($feedback->company_id === null) {
            return null;
        }

        $nama = Company::query()->whereKey($feedback->company_id)->value('name');

        return $nama !== null ? "{$nama} ({$feedback->company_id})" : $feedback->company_id;
    }
}
