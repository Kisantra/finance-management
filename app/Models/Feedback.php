<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class Feedback extends Model
{
    use CentralConnection, HasFactory;

    protected $table = 'feedbacks';

    protected $fillable = [
        'user_id',
        'company_id',
        'title',
        'description',
        'type',
        'priority',
        'status',
        'page_url',
        'attachment_path',
        'attachment_name',
        'admin_response',
        'responded_by',
        'responded_at',
    ];

    protected $casts = [
        'responded_at' => 'datetime',
    ];

    // =====================================
    // RELATIONSHIPS
    // =====================================

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function responder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responded_by');
    }

    // =====================================
    // SCOPES
    // =====================================

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    public function scopeByType($query, string $type)
    {
        return $query->where('type', $type);
    }

    public function scopeByPriority($query, string $priority)
    {
        return $query->where('priority', $priority);
    }

    public function scopeOpen($query)
    {
        return $query->where('status', 'open');
    }

    public function scopePending($query)
    {
        return $query->whereIn('status', ['open', 'in_progress']);
    }

    // =====================================
    // STATUS CHECKERS
    // =====================================

    public function isOpen(): bool
    {
        return $this->status === 'open';
    }

    public function isInProgress(): bool
    {
        return $this->status === 'in_progress';
    }

    public function isResolved(): bool
    {
        return $this->status === 'resolved';
    }

    public function isClosed(): bool
    {
        return $this->status === 'closed';
    }

    public function canEdit(): bool
    {
        return $this->status === 'open';
    }

    public function canDelete(): bool
    {
        return $this->status === 'open';
    }

    public function canRespond(): bool
    {
        return in_array($this->status, ['open', 'in_progress']);
    }

    // =====================================
    // ACTIONS
    // =====================================

    public function respond(int $responderId, string $response, ?string $newStatus = null): bool
    {
        $data = [
            'admin_response' => $response,
            'responded_by' => $responderId,
            'responded_at' => now(),
        ];

        if ($newStatus) {
            $data['status'] = $newStatus;
        }

        return $this->update($data);
    }

    public function changeStatus(string $status): bool
    {
        return $this->update(['status' => $status]);
    }

    // =====================================
    // ATTACHMENT HELPERS
    // =====================================

    public function hasAttachment(): bool
    {
        return ! empty($this->attachment_path);
    }

    public function getAttachmentUrlAttribute(): ?string
    {
        return $this->attachment_path ? Storage::url($this->attachment_path) : null;
    }

    public function getAttachmentTypeAttribute(): ?string
    {
        if (! $this->hasAttachment()) {
            return null;
        }
        $extension = pathinfo($this->attachment_name, PATHINFO_EXTENSION);

        return strtolower($extension);
    }

    public function isImageAttachment(): bool
    {
        return in_array($this->attachment_type, ['jpg', 'jpeg', 'png', 'gif']);
    }

    public function isPdfAttachment(): bool
    {
        return $this->attachment_type === 'pdf';
    }

    // =====================================
    // SAFE HTML ACCESSORS
    // =====================================

    public function getSafeDescriptionAttribute(): string
    {
        return $this->sanitizeHtml($this->description ?? '');
    }

    public function getSafeAdminResponseAttribute(): string
    {
        return $this->sanitizeHtml($this->admin_response ?? '');
    }

    private function sanitizeHtml(string $html): string
    {
        $allowed = '<p><br><strong><em><u><ol><ul><li><a><blockquote><pre><code>';

        return strip_tags($html, $allowed);
    }

    // =====================================
    // FORMATTERS
    // =====================================

    public function getTypeBadgeColorAttribute(): string
    {
        return match ($this->type) {
            'bug' => 'red',
            'feature' => 'blue',
            'feedback' => 'gray',
            default => 'gray',
        };
    }

    public function getTypeIconAttribute(): string
    {
        return match ($this->type) {
            'bug' => 'bug-ant',
            'feature' => 'light-bulb',
            'feedback' => 'chat-bubble-left-right',
            default => 'chat-bubble-left-right',
        };
    }

    public function getTypeLabelAttribute(): string
    {
        return match ($this->type) {
            'bug' => __('feedback.type_bug'),
            'feature' => __('feedback.type_feature'),
            'feedback' => __('feedback.type_feedback'),
            default => ucfirst($this->type),
        };
    }

    public function getPriorityBadgeColorAttribute(): string
    {
        return match ($this->priority) {
            'low' => 'gray',
            'medium' => 'blue',
            'high' => 'yellow',
            'critical' => 'red',
            default => 'gray',
        };
    }

    public function getPriorityLabelAttribute(): string
    {
        return match ($this->priority) {
            'low' => __('feedback.priority_low'),
            'medium' => __('feedback.priority_medium'),
            'high' => __('feedback.priority_high'),
            'critical' => __('feedback.priority_critical'),
            default => ucfirst($this->priority),
        };
    }

    public function getStatusBadgeColorAttribute(): string
    {
        return match ($this->status) {
            'open' => 'yellow',
            'in_progress' => 'blue',
            'resolved' => 'green',
            'closed' => 'gray',
            default => 'gray',
        };
    }

    public function getStatusLabelAttribute(): string
    {
        return match ($this->status) {
            'open' => __('feedback.status_open'),
            'in_progress' => __('feedback.status_in_progress'),
            'resolved' => __('feedback.status_resolved'),
            'closed' => __('feedback.status_closed'),
            default => ucfirst($this->status),
        };
    }

    // =====================================
    // STATIC HELPERS
    // =====================================

    public static function types(): array
    {
        return [
            ['label' => __('feedback.type_bug'), 'value' => 'bug'],
            ['label' => __('feedback.type_feature'), 'value' => 'feature'],
            ['label' => __('feedback.type_feedback'), 'value' => 'feedback'],
        ];
    }

    public static function priorities(): array
    {
        return [
            ['label' => __('feedback.priority_low'), 'value' => 'low'],
            ['label' => __('feedback.priority_medium'), 'value' => 'medium'],
            ['label' => __('feedback.priority_high'), 'value' => 'high'],
            ['label' => __('feedback.priority_critical'), 'value' => 'critical'],
        ];
    }

    public static function statuses(): array
    {
        return [
            ['label' => __('feedback.status_open'), 'value' => 'open'],
            ['label' => __('feedback.status_in_progress'), 'value' => 'in_progress'],
            ['label' => __('feedback.status_resolved'), 'value' => 'resolved'],
            ['label' => __('feedback.status_closed'), 'value' => 'closed'],
        ];
    }

    // =====================================
    // BOOT
    // =====================================

    protected static function boot()
    {
        parent::boot();

        static::deleting(function ($feedback) {
            if ($feedback->attachment_path && Storage::exists($feedback->attachment_path)) {
                Storage::delete($feedback->attachment_path);
            }
        });
    }
}
