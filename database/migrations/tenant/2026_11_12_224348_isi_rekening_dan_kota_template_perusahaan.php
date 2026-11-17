<?php

use App\Models\CompanyProfile;
use Illuminate\Database\Migrations\Migration;

/**
 * Template invoice PT SLU & PT BAS dulu menulis rekening dan kota tanda tangan langsung di Blade;
 * sekarang keduanya dibaca dari Profil perusahaan. Agar invoice yang sudah tercetak dengan template itu
 * tidak kehilangan rekening saat deploy, isian lama dipindahkan ke profil — HANYA bila isian profil
 * masih kosong (rekening belum pernah bisa diisi lewat layar). Perusahaan lain tidak tersentuh.
 * Selanjutnya admin mengubahnya di Pengaturan › Profil perusahaan.
 */
return new class extends Migration
{
    /** @var array<string, array{bank_accounts: list<array{bank: string, account_number: string, account_name: string}>, signature_city: string}> */
    private const DATA = [
        'samboja-laju-utama' => [
            'bank_accounts' => [['bank' => 'Bank Mandiri', 'account_number' => '148-00-2346343-6', 'account_name' => 'PT. SAMBOJA LAJU UTAMA']],
            'signature_city' => 'Samarinda',
        ],
        'berkah-andalan-samboja' => [
            'bank_accounts' => [['bank' => 'Bank Mandiri', 'account_number' => '148-00-23719878', 'account_name' => 'PT. BERKAH ANDALAN SAMBOJA']],
            'signature_city' => 'Samarinda',
        ],
    ];

    public function up(): void
    {
        $data = self::DATA[tenant()?->getTenantKey()] ?? null;
        $profile = $data ? CompanyProfile::current() : null;

        if ($profile === null) {
            return;
        }

        if (empty($profile->bank_accounts)) {
            $profile->bank_accounts = $data['bank_accounts'];
        }

        if (blank($profile->signature_city)) {
            $profile->signature_city = $data['signature_city'];
        }

        $profile->save();
    }

    public function down(): void
    {
        // Isian profil tetap; tidak ada yang perlu dikembalikan.
    }
};
