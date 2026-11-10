<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class AppNotification extends Model
{
    use CentralConnection, HasFactory;

    protected $fillable = [
        'user_id',
        'company_id',
        'type',
        'title',
        'message',
        'data',
        'read_at',
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
    ];

    // =====================================
    // RELATIONSHIPS
    // =====================================

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // =====================================
    // SCOPES
    // =====================================

    public function scopeUnread($query)
    {
        return $query->whereNull('read_at');
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Notifikasi milik perusahaan aktif, plus baris tanpa konteks perusahaan.
     *
     * Tabel `app_notifications` hidup di database CENTRAL, jadi isolasi tingkat
     * koneksi TIDAK melindunginya. `notify()` sudah menandai setiap baris baru
     * dengan `company_id`, tetapi penandanya tidak berguna kalau pembacanya
     * tidak menyaring.
     *
     * Logika ini sebelumnya ditulis sebagai closure DI DALAM
     * HandleInertiaRequests::getNotifications() dan TIDAK ADA di
     * NotificationController — itulah sebabnya lonceng menampilkan 1 notifikasi
     * sementara drawer-nya menampilkan 2, yang kedua milik perusahaan lain.
     * Satu definisi di sini, dipakai kedua pembaca, supaya tidak bisa menyimpang
     * lagi.
     */
    public function scopeForCurrentCompany($query)
    {
        return $query->when(tenant(), fn ($q) => $q->where(
            fn ($sub) => $sub->whereNull('company_id')->orWhere('company_id', tenant()->getTenantKey())
        ));
    }

    public function scopeRecent($query, int $days = 30)
    {
        return $query->where('created_at', '>=', now()->subDays($days));
    }

    // =====================================
    // HELPERS
    // =====================================

    public function isUnread(): bool
    {
        return is_null($this->read_at);
    }

    public function isRead(): bool
    {
        return ! is_null($this->read_at);
    }

    public function markAsRead(): bool
    {
        if ($this->isRead()) {
            return true;
        }

        return $this->update(['read_at' => now()]);
    }

    public function getIconAttribute(): string
    {
        return match ($this->type) {
            'feedback_submitted' => 'chat-bubble-left-right',
            'feedback_responded' => 'chat-bubble-left-ellipsis',
            'feedback_status_changed' => 'arrow-path',
            'invoice_created' => 'document-plus',
            'invoice_payment_received' => 'banknotes',
            'invoice_due_soon' => 'clock',
            'invoice_deleted' => 'trash',
            'payment_deleted' => 'trash',
            default => 'bell',
        };
    }

    public function getColorAttribute(): string
    {
        return match ($this->type) {
            'feedback_submitted' => 'blue',
            'feedback_responded' => 'green',
            'feedback_status_changed' => 'yellow',
            'invoice_created' => 'blue',
            'invoice_payment_received' => 'green',
            'invoice_due_soon' => 'yellow',
            'invoice_deleted' => 'red',
            'payment_deleted' => 'red',
            default => 'gray',
        };
    }

    public function getIconBgColorAttribute(): string
    {
        return match ($this->getColorAttribute()) {
            'blue' => 'bg-blue-100 dark:bg-blue-900/30',
            'green' => 'bg-green-100 dark:bg-green-900/30',
            'yellow' => 'bg-yellow-100 dark:bg-yellow-900/30',
            'red' => 'bg-red-100 dark:bg-red-900/30',
            default => 'bg-gray-100 dark:bg-gray-900/30',
        };
    }

    public function getIconColorAttribute(): string
    {
        return match ($this->getColorAttribute()) {
            'blue' => 'text-blue-600 dark:text-blue-400',
            'green' => 'text-green-600 dark:text-green-400',
            'yellow' => 'text-yellow-600 dark:text-yellow-400',
            'red' => 'text-red-600 dark:text-red-400',
            default => 'text-gray-600 dark:text-gray-400',
        };
    }

    // =====================================
    // FACTORY METHODS
    // =====================================

    /**
     * `$companyId` wajib diisi bila dipanggil di luar konteks perusahaan (scheduler,
     * listener event): tanpa itu `company_id` NULL dan notifikasi muncul di setiap
     * perusahaan tempat penerimanya menjadi anggota.
     */
    public static function notify(int $userId, string $type, string $title, string $message, array $data = [], ?string $companyId = null): self
    {
        return self::create([
            'user_id' => $userId,
            'company_id' => $companyId ?? tenant()?->getTenantKey(),
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => $data,
        ]);
    }

    /**
     * Notifikasi yang teksnya diterjemahkan saat DIBACA (aturan emas: teks tersimpan tetap Bahasa
     * Indonesia, D7). `title`/`message` disimpan dalam Bahasa Indonesia; kunci & parameternya ikut
     * disimpan di `data.i18n` supaya pembaca melihat bahasanya sendiri. Nilai parameter berbentuk
     * `['trans' => 'grup.kunci']` diterjemahkan saat dibaca (mis. label jenis Masukan).
     *
     * @param  string  $titleKey  teks Indonesia persis (kunci terjemahan), tanpa nilai
     * @param  string  $messageKey  teks Indonesia persis dengan placeholder `:nama`
     * @param  array<string, mixed>  $params
     * @param  array<string, mixed>  $data
     */
    public static function notifyTerjemahan(int $userId, string $type, string $titleKey, string $messageKey, array $params, array $data = [], ?string $companyId = null): self
    {
        $data['i18n'] = ['title' => $titleKey, 'message' => $messageKey, 'params' => $params];

        return self::notify(
            $userId,
            $type,
            __($titleKey, [], 'id'),
            __($messageKey, self::paramTerselesaikan($params, 'id'), 'id'),
            $data,
            $companyId,
        );
    }

    /**
     * Judul & pesan dalam bahasa pembaca; notifikasi tanpa `data.i18n` (lama, atau dari modul lain)
     * memakai teks tersimpan apa adanya.
     *
     * @return array{title: string, message: string}
     */
    public function teksTampil(): array
    {
        $i18n = $this->data['i18n'] ?? null;

        if (! is_array($i18n) || ! isset($i18n['title'], $i18n['message'])) {
            return ['title' => $this->title, 'message' => $this->message];
        }

        return [
            'title' => __($i18n['title']),
            'message' => __($i18n['message'], self::paramTerselesaikan((array) ($i18n['params'] ?? []), app()->getLocale())),
        ];
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private static function paramTerselesaikan(array $params, string $locale): array
    {
        return array_map(
            fn (mixed $nilai): mixed => is_array($nilai) && isset($nilai['trans']) ? __($nilai['trans'], [], $locale) : $nilai,
            $params,
        );
    }

    public static function notifyMany(array $userIds, string $type, string $title, string $message, array $data = []): void
    {
        foreach ($userIds as $userId) {
            self::notify($userId, $type, $title, $message, $data);
        }
    }

    // =====================================
    // CLEANUP
    // =====================================

    public static function cleanupOld(int $days = 90): int
    {
        return self::where('created_at', '<', now()->subDays($days))
            ->whereNotNull('read_at')
            ->delete();
    }
}
