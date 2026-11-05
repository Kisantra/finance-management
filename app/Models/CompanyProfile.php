<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class CompanyProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'abbreviation',
        'address',
        'email',
        'phone',
        'logo_path',
        'letter_head_path',
        'signature_path',
        'stamp_path',
        'is_pkp',
        'npwp',
        'ppn_rate',
        'bank_accounts',
        'finance_manager_name',
        'finance_manager_position',
        'invoice_number_format',
        'invoice_number_padding',
        'invoice_number_reset',
        'default_due_days',
    ];

    protected $casts = [
        'bank_accounts' => 'array',
        'is_pkp' => 'boolean',
        'ppn_rate' => 'decimal:2',
        'invoice_legacy_reviewed_at' => 'datetime',
        'default_due_days' => 'integer',
    ];

    /**
     * Aset dibaca dari Storage disk 'public' (konvensi upload saat ini);
     * fallback ke public_path() untuk file lama di public/images/.
     */
    private function assetBase64(?string $path): string
    {
        if (! $path) {
            return '';
        }

        if (Storage::disk('public')->exists($path)) {
            return 'data:image/png;base64,'.base64_encode(Storage::disk('public')->get($path));
        }

        $legacyPath = public_path($path);

        return file_exists($legacyPath)
            ? 'data:image/png;base64,'.base64_encode(file_get_contents($legacyPath))
            : '';
    }

    public function getLogoBase64Attribute(): string
    {
        return $this->assetBase64($this->logo_path);
    }

    public function getSignatureBase64Attribute(): string
    {
        return $this->assetBase64($this->signature_path);
    }

    public function getLetterHeadBase64Attribute(): string
    {
        return $this->assetBase64($this->letter_head_path);
    }

    public function getStampBase64Attribute(): string
    {
        return $this->assetBase64($this->stamp_path);
    }

    /**
     * Generate abbreviation from the initials of each meaningful word in the company name.
     * Common legal entity prefixes/suffixes are ignored.
     * e.g. "PT. Semesta Pertambangan Indonesia" → "SPI"
     * e.g. "CV Maju Bersama" → "MB"
     * Falls back to stored abbreviation column if set, otherwise auto-generates.
     */
    public function getComputedAbbreviationAttribute(): string
    {
        if (! empty($this->abbreviation)) {
            return strtoupper($this->abbreviation);
        }

        if (empty($this->name)) {
            return 'CO';
        }

        $skipWords = ['PT', 'PT.', 'CV', 'CV.', 'UD', 'UD.', 'TB', 'TB.', 'FA', 'FA.',
            'NV', 'NV.', 'PP', 'PP.', 'PD', 'PD.', 'PERSERO', 'TBK', 'TBK.'];

        $words = preg_split('/\s+/', trim($this->name));
        $filtered = array_filter($words, fn ($word) => ! in_array(strtoupper($word), $skipWords));
        $initials = array_map(fn ($word) => strtoupper(substr($word, 0, 1)), $filtered);

        return implode('', $initials) ?: 'CO';
    }

    /** Termin jatuh tempo bawaan dalam hari (invoice baru & invoice berulang tanpa jatuh tempo). */
    public static function defaultDueDays(): int
    {
        return static::current()?->default_due_days ?? 14;
    }

    public static function current(): ?self
    {
        return static::first();
    }

    /**
     * Nomor invoice lama (bernomor tetapi urutannya kosong) belum ditinjau admin. Tanpa
     * urutan, invoice berikutnya bisa mengulang nomor yang sudah terkirim ke klien.
     */
    public function needsInvoiceReview(): bool
    {
        return $this->invoice_legacy_reviewed_at === null
            && Invoice::query()->whereNotNull('invoice_number')->whereNull('invoice_sequence')->exists();
    }

    /**
     * Isian wajib profil yang belum diisi; kosong = profil lengkap. Perusahaan baru
     * diprovisioning dengan '-' di kolom NOT NULL (TenantDatabaseSeeder), jadi '-'
     * dihitung kosong. Dipakai gerbang EnsureCompanyProfileComplete.
     *
     * @return list<string>
     */
    public function missingFields(): array
    {
        return array_values(array_filter(
            ['name', 'abbreviation', 'address', 'email', 'phone', 'finance_manager_name', 'finance_manager_position'],
            fn (string $field): bool => blank($this->{$field}) || trim((string) $this->{$field}) === '-',
        ));
    }
}
