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

    public static function notify(int $userId, string $type, string $title, string $message, array $data = []): self
    {
        return self::create([
            'user_id' => $userId,
            'company_id' => tenant()?->getTenantKey(),
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => $data,
        ]);
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
