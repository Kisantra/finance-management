<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\Company;
use App\Models\CompanyProfile;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\User;
use App\Services\CompanyInvoiceTemplate;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

/**
 * Contoh lokal PT Samboja Laju Utama (SLU) lengkap dengan template invoicenya
 * (resources/views/pdf/perusahaan/samboja-laju-utama): perusahaan SLU saja (bukan 10 perusahaan
 * Mitra Group), akun khusus SLU, profil + format nomor invoice SLU, satu klien, dan tiga invoice yang
 * meniru susunan invoice Word asli (FINAL, DEMMURAGE, WAITING TKBM) ditambah satu draft untuk editor.
 *
 * Repo ini publik: klien, kapal, dan nominal di sini FIKTIF, dan tanda tangan/stempel yang dipasang
 * adalah gambar "CONTOH" buatan seeder. Tanda tangan asli diunggah di Pengaturan › Profil perusahaan.
 *
 *   php artisan db:seed --class=ContohInvoiceSluSeeder
 *
 * Akun (password: password) — keduanya hanya anggota SLU, jadi login langsung masuk ke SLU:
 *   admin.slu@mitragroup.id  admin SLU (cetak, terbitkan, ubah nomor)
 *   staff.slu@mitragroup.id  staff SLU (nama sama dengan akun staff MitraGroupSeeder)
 *
 * Idempoten dan cocok dengan MitraGroupSeeder: perusahaan/akun/invoice yang sudah ada tidak dibuat ulang.
 */
class ContohInvoiceSluSeeder extends Seeder
{
    private const SLUG = 'samboja-laju-utama';

    /** @var array<string, string> email => peran di SLU */
    private const ACCOUNTS = [
        'admin.slu@mitragroup.id' => 'admin',
        'staff.slu@mitragroup.id' => 'staff',
    ];

    public function run(): void
    {
        $this->call(MasterPermissionSeeder::class);

        $organization = Organization::firstOrCreate(
            ['slug' => 'mitra-group'],
            ['name' => 'Mitra Group', 'company_quota' => 10],
        );

        // Membuat perusahaan baru memicu pipeline provisioning: CREATE DATABASE tenant_{slug}
        // → migrate → seed master → status active.
        $company = Company::find(self::SLUG) ?? Company::create([
            'id' => self::SLUG,
            'organization_id' => $organization->id,
            'name' => 'PT Samboja Laju Utama',
            'abbreviation' => 'SLU',
        ]);

        foreach (self::ACCOUNTS as $email => $role) {
            $this->ensureMember($email, $role, $company, $organization);
        }
        setPermissionsTeamId(null);

        $company->run(function (): void {
            $this->seedProfile();
            $client = $this->seedClient();

            foreach ($this->invoices() as $data) {
                $this->seedInvoice($client, $data);
            }
        });

        $this->command?->info('✓ Contoh PT SLU siap — login admin.slu@mitragroup.id / password › Invoice › tab "Perlu ditagih" › Cetak.');
    }

    private function ensureMember(string $email, string $role, Company $company, Organization $organization): void
    {
        $user = User::firstOrCreate(['email' => $email], [
            'name' => ucfirst(strtok($email, '.')).' SLU',
            'email_verified_at' => now(),
            'password' => Hash::make('password'),
        ]);

        if ($user->organization_id === null) {
            $user->organization()->associate($organization->id)->save();
        }

        $user->companies()->syncWithoutDetaching([$company->getTenantKey()]);

        setPermissionsTeamId($company->getTenantKey());
        $user->unsetRelation('roles');

        if (! $user->hasRole($role)) {
            $user->assignRole($role);
        }
    }

    private function seedProfile(): void
    {
        $profile = CompanyProfile::current() ?? new CompanyProfile;

        $profile->fill([
            'name' => 'PT. SAMBOJA LAJU UTAMA',
            'abbreviation' => 'SLU',
            'address' => 'Jalan Raya Balikpapan – Handil II, Desa/Kelurahan Samboja Kuala, Kec. Samboja, Kab. Kutai Kartanegara, Provinsi Kalimantan Timur.',
            'email' => 'sambojalajuutama@gmail.com',
            'phone' => '0811-5513-232',
            'is_pkp' => true,
            'ppn_rate' => 11,
            'finance_manager_name' => 'Salam Ilham',
            'finance_manager_position' => 'Direktur Utama',
            'invoice_number_format' => '{NO}/{PT}-{KLIEN}/INV/{BLN_ROMAWI}/{THN}',
            'invoice_number_padding' => 3,
            'invoice_number_reset' => 'yearly',
            'default_due_days' => 14,
        ]);
        // Nomor contoh memakai kode per dokumen (INV-FINAL, INV-DEM, ...) yang belum dikenal
        // pola penomoran; tandai sudah ditinjau supaya admin tidak dialihkan ke halaman peninjauan.
        $profile->invoice_legacy_reviewed_at = now();
        // Jangan pernah menimpa tanda tangan yang sudah diunggah.
        $profile->signature_path ??= $this->sampleSignature();
        $profile->save();
    }

    /**
     * Gambar tanda tangan + stempel bertuliskan CONTOH, digambar saat seeding (bukan berkas di repo)
     * dan disimpan di disk public perusahaan seperti hasil upload Profil perusahaan.
     */
    private function sampleSignature(): ?string
    {
        $font = CompanyInvoiceTemplate::path('fonts/Carlito-Bold.ttf');

        if ($font === '' || ! function_exists('imagettftext')) {
            return null;
        }

        $image = imagecreatetruecolor(480, 216);
        imagesavealpha($image, true);
        imagefill($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127));
        $blue = imagecolorallocatealpha($image, 30, 64, 175, 25);
        $ink = imagecolorallocate($image, 25, 25, 25);

        foreach ([200, 198, 196, 172, 170] as $diameter) {
            imageellipse($image, 108, 108, $diameter, $diameter, $blue);
        }
        $this->centeredText($image, 22, 108, 112, $blue, $font, 'CONTOH');
        $this->centeredText($image, 12, 108, 138, $blue, $font, 'BUKAN ASLI');

        imagesetthickness($image, 3);
        $previous = null;
        for ($x = 170; $x <= 470; $x += 4) {
            $y = 100 + (int) round(30 * sin($x / 19) * (1 - ($x - 170) / 520));
            if ($previous) {
                imageline($image, $previous[0], $previous[1], $x, $y, $ink);
            }
            $previous = [$x, $y];
        }

        ob_start();
        imagepng($image);
        $png = (string) ob_get_clean();
        imagedestroy($image);

        $path = 'images/contoh-ttd-stempel.png';
        Storage::disk('public')->put($path, $png);

        return $path;
    }

    private function centeredText(\GdImage $image, int $size, int $centerX, int $baseline, int $color, string $font, string $text): void
    {
        $box = imagettfbbox($size, 0, $font, $text);
        imagettftext($image, $size, 0, $centerX - (int) (($box[2] - $box[0]) / 2), $baseline, $color, $font, $text);
    }

    private function seedClient(): Client
    {
        return Client::updateOrCreate(
            ['name' => 'PT. CONTOH BATUBARA NUSANTARA'],
            [
                'alias' => 'CBN',
                'type' => 'company',
                'status' => Client::STATUS_ACTIVE,
                'address' => 'GEDUNG CONTOH LANTAI 3, JL. CONTOH RAYA NO. 10, KEBAYORAN BARU, KOTA ADM. JAKARTA SELATAN, DKI JAKARTA 12190',
                'person_in_charge' => 'Direktur Finance & Accounting',
            ],
        );
    }

    /**
     * @param  array{number: ?string, date: string, subject: string, discount: int, items: list<array<string, mixed>>}  $data
     */
    private function seedInvoice(Client $client, array $data): void
    {
        if ($data['number'] !== null && Invoice::where('invoice_number', $data['number'])->exists()) {
            return;
        }

        if ($data['number'] === null && Invoice::where('subject', $data['subject'])->exists()) {
            return;
        }

        $items = collect($data['items'])->map(fn (array $item): array => [
            ...$item,
            'client_id' => $client->id,
            'amount' => (int) round($item['unit_price'] * $item['quantity']),
            'cogs_amount' => 0,
            'is_tax_deposit' => false,
        ]);

        $subtotal = (int) $items->sum('amount');
        $ppnAmount = Invoice::ppnFor($subtotal - $data['discount'], 11.0);
        $issueDate = Carbon::parse($data['date']);

        $invoice = Invoice::create([
            'billed_to_id' => $client->id,
            'subject' => $data['subject'],
            'subtotal' => $subtotal,
            'discount_type' => 'fixed',
            'discount_value' => $data['discount'],
            'discount_amount' => $data['discount'],
            'ppn_rate' => 11,
            'ppn_amount' => $ppnAmount,
            'total_amount' => max(0, $subtotal - $data['discount']) + $ppnAmount,
            'issue_date' => $issueDate,
            'due_date' => $issueDate->copy()->addDays(14),
            'status' => $data['number'] ? 'sent' : 'draft',
            'invoice_number' => $data['number'],
        ]);

        $invoice->items()->createMany($items->all());
    }

    /**
     * @return list<array{number: ?string, date: string, subject: string, discount: int, items: list<array<string, mixed>>}>
     */
    private function invoices(): array
    {
        return [
            [
                'number' => '037/SLU-CBN/INV-FINAL/X/2026',
                'date' => '2026-10-10',
                'subject' => 'Invoice FINAL MV. CONTOH JAYA',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH JAYA',
                    'description' => "Loading Port : Muara Jawa\nAnchorage ( Stevedoring )",
                    'quantity' => 40000,
                    'unit' => 'MT',
                    'unit_price' => 12000,
                ]],
            ],
            [
                'number' => '038/SLU-CBN/INV-DEM/X/2026',
                'date' => '2026-10-10',
                'subject' => 'Invoice DEMMURAGE MV. CONTOH JAYA',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH JAYA',
                    'description' => "Kontrak Kerja 8 Hari\nCommenced : 20 September 2026\nCompleted : 2 Oktober 2026\nDemmurage : 4 Hari",
                    'quantity' => 4,
                    'unit' => 'Day',
                    'unit_price' => 5000000,
                ]],
            ],
            [
                'number' => '039/SLU-CBN/INV-TKBM/X/2026',
                'date' => '2026-10-10',
                'subject' => 'Invoice WAITING TKBM MV. CONTOH JAYA',
                'discount' => 5000000,
                'items' => [[
                    'service_name' => 'Waiting TKBM Unit 7 MV. CONTOH JAYA',
                    'description' => implode("\n", [
                        '25-Sep-26',
                        '08.00 - 20.00 = 12 Jam',
                        '26-Sep-26',
                        '06.00 - 24.00 = 18 Jam',
                        '27-Sep-26',
                        '00.00 - 24.00 = 24 Jam',
                        '28-Sep-26',
                        '00.00 - 09.30 = 9 Jam 30 Menit',
                        '18.00 - 24.00 = 6 Jam',
                        '29-Sep-26',
                        '07.00 - 24.00 = 17 Jam',
                        '30-Sep-26',
                        '00.00 - 24.00 = 24 Jam',
                        '01-Oct-26',
                        '00.00 - 10.00 = 10 Jam',
                    ]),
                    'quantity' => 120.5,
                    'unit' => 'Hour',
                    'unit_price' => 100000,
                ]],
            ],
            [
                'number' => null,
                'date' => '2026-11-11',
                'subject' => 'Invoice FINAL MV. CONTOH BAHARI',
                'discount' => 0,
                'items' => [[
                    'service_name' => 'MV. CONTOH BAHARI',
                    'description' => "Loading Port : Muara Jawa\nAnchorage ( Stevedoring )",
                    'quantity' => 50000,
                    'unit' => 'MT',
                    'unit_price' => 12000,
                ]],
            ],
        ];
    }
}
