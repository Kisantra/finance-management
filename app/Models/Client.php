<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Client extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'type',
        'email',
        'NPWP',
        'KPP',
        'logo',
        'status',
        'EFIN',
        'account_representative',
        'ar_phone_number',
        'person_in_charge',
        'address',
    ];

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'billed_to_id');
    }

    public function invoiceItems(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function receivables(): MorphMany
    {
        return $this->morphMany(Receivable::class, 'debtor');
    }

    /**
     * Nilai `status` yang sah. Kolomnya bercollation case-insensitive, sehingga
     * campur-aduk `Active`/`active` selama ini tidak menimbulkan gejala — dan
     * akan langsung rusak begitu collation atau mesin DB berganti.
     */
    public const STATUS_ACTIVE = 'Active';

    public const STATUS_INACTIVE = 'Inactive';

    /**
     * Penghapusan klien TIDAK lagi meng-cascade.
     *
     * Override lama memanggil `invoiceItems()->delete()` — relasi lewat
     * `invoice_items.client_id`, bukan item milik invoice klien ini. Akibatnya
     * item atas nama klien yang menempel di invoice ORANG LAIN ikut terhapus,
     * merusak invoice bernomor resmi. `invoices()->delete()` juga mass-delete,
     * sehingga pembayaran lenyap lewat FK cascade tanpa event model dan saldo
     * bank — yang terhitung dari pembayaran — turun diam-diam.
     *
     * ClientController::destroy() kini menolak penghapusan selama masih ada
     * data terkait, jadi cascade tidak lagi punya alasan untuk ada.
     */
    public function isDeletable(): bool
    {
        return $this->invoices()->doesntExist()
            && $this->invoiceItems()->doesntExist()
            && $this->receivables()->doesntExist();
    }
}
