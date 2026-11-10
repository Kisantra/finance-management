<?php

namespace App\Listeners;

use App\Models\AppNotification;
use App\Models\Feedback;
use Kisantra\Watchpost\Events\TicketUpdated;

/**
 * Status tiket Watchpost kembali ke laporan bug pelapornya. Dipicu
 * `watchpost:sync-tickets` (scheduler, tiap menit) di luar konteks perusahaan:
 * feedbacks dan notifikasi ada di database pusat, dan perusahaan notifikasi
 * diambil dari feedback-nya sendiri.
 *
 * Tiket yang sama bisa datang berulang dengan status sama (komentar baru,
 * tiket di detik kursor), jadi pelapor hanya diberi tahu saat statusnya berubah.
 */
class PerbaruiFeedbackDariWatchpost
{
    /**
     * Status tiket Watchpost → status feedback.
     *
     * @var array<string, string>
     */
    private const STATUS = [
        'open' => 'open',
        'in_progress' => 'in_progress',
        'resolved' => 'resolved',
        'ignored' => 'closed',
    ];

    /**
     * Teks pesan per status (kunci terjemahan = teks Indonesia persis).
     */
    private function kunciPesan(string $status): string
    {
        return match ($status) {
            'open' => __('Laporan ":judul" dibuka kembali oleh tim IT.', [], 'id'),
            'in_progress' => __('Laporan ":judul" sedang dikerjakan tim IT.', [], 'id'),
            'resolved' => __('Laporan ":judul" sudah diselesaikan tim IT.', [], 'id'),
            default => __('Laporan ":judul" ditutup oleh tim IT.', [], 'id'),
        };
    }

    public function handle(TicketUpdated $event): void
    {
        $status = self::STATUS[$event->status] ?? null;
        $ids = collect($event->references)
            ->map(fn (string $reference) => preg_match('/^feedback-(\d+)$/', $reference, $cocok) ? (int) $cocok[1] : null)
            ->filter()
            ->values();

        if ($status === null || $ids->isEmpty()) {
            return;
        }

        Feedback::query()
            ->whereIn('id', $ids)
            ->where('type', 'bug')
            // Tiket lain hanya bila job pengirim belum sempat mencatat tiketnya.
            ->where(fn ($query) => $query->whereNull('watchpost_ticket_id')->orWhere('watchpost_ticket_id', $event->ticketId))
            ->get()
            ->each(fn (Feedback $feedback) => $this->perbarui($feedback, $status, $event));
    }

    private function perbarui(Feedback $feedback, string $status, TicketUpdated $event): void
    {
        $berubah = $feedback->status !== $status;

        $feedback->update([
            'status' => $status,
            'watchpost_ticket_id' => $event->ticketId,
            'watchpost_ticket_number' => $event->number,
            'watchpost_ticket_url' => $event->url,
        ]);

        if (! $berubah) {
            return;
        }

        AppNotification::notifyTerjemahan(
            $feedback->user_id,
            'feedback_responded',
            __('Laporan Bug Diperbarui', [], 'id'),
            $this->kunciPesan($status),
            ['judul' => $feedback->title],
            [
                'feedback_id' => $feedback->id,
                'url' => $feedback->company_id !== null
                    ? route('feedbacks.index', ['company' => $feedback->company_id, 'show' => $feedback->id])
                    : null,
            ],
            $feedback->company_id,
        );
    }
}
