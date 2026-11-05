<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Passport\Contracts\OAuthenticatable;
use Laravel\Passport\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class User extends Authenticatable implements OAuthenticatable
{
    use CentralConnection, HasApiTokens, HasFactory, HasRoles, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'phone_number',
        'status',
        'locale',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function companies(): BelongsToMany
    {
        return $this->belongsToMany(Company::class, 'company_user')->withTimestamps();
    }

    /**
     * Pengguna yang menjadi anggota perusahaan aktif.
     *
     * `users` dan `company_user` hidup di database CENTRAL, jadi isolasi
     * tingkat koneksi TIDAK melindunginya: tanpa cakupan ini `User::query()`
     * mengembalikan seluruh pengguna semua perusahaan. Itu bukan sekadar
     * kebocoran baca — route-model binding memakai tabel yang sama, sehingga
     * admin PT A dapat mengubah dan MENGHAPUS pengguna PT B.
     *
     * GAGAL-TERTUTUP di luar konteks perusahaan. Mengembalikan query terbuka
     * saat `tenant()` null akan membuat kebocoran yang sama muncul kembali di
     * setiap pemanggil baru yang lupa konteksnya; lebih baik tidak
     * mengembalikan siapa pun dan ketahuan segera.
     */
    public function scopeMemberOfCurrentCompany($query)
    {
        $slug = tenant()?->getTenantKey();

        if ($slug === null) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereHas('companies', fn ($q) => $q->whereKey($slug));
    }

    public function receivables(): MorphMany
    {
        return $this->morphMany(Receivable::class, 'debtor');
    }

    public function initials(): string
    {
        return Str::of($this->name)
            ->explode(' ')
            ->map(fn (string $name) => Str::of($name)->substr(0, 1))
            ->implode('');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
