<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

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
    ];

    protected $casts = [
        'bank_accounts' => 'array',
        'is_pkp' => 'boolean',
        'ppn_rate' => 'decimal:2',
    ];

    // Model CompanyProfile.php
    public function getLogoBase64Attribute(): string
    {
        if (! $this->logo_path) {
            return '';
        }

        $fullPath = public_path($this->logo_path);

        return file_exists($fullPath)
            ? 'data:image/png;base64,'.base64_encode(file_get_contents($fullPath))
            : '';
    }

    public function getSignatureBase64Attribute(): string
    {
        if (! $this->signature_path) {
            return '';
        }

        $fullPath = public_path($this->signature_path);

        return file_exists($fullPath)
            ? 'data:image/png;base64,'.base64_encode(file_get_contents($fullPath))
            : '';
    }

    public function getLetterHeadBase64Attribute(): string
    {
        if (! $this->letter_head_path) {
            return '';
        }

        $fullPath = public_path($this->letter_head_path);

        return file_exists($fullPath)
            ? 'data:image/png;base64,'.base64_encode(file_get_contents($fullPath))
            : '';
    }

    public function getStampBase64Attribute(): string
    {
        if (! $this->stamp_path) {
            return '';
        }

        $fullPath = public_path($this->stamp_path);

        return file_exists($fullPath)
            ? 'data:image/png;base64,'.base64_encode(file_get_contents($fullPath))
            : '';
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

    public static function current(): ?self
    {
        return static::first();
    }
}
