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
 * Dasar seeder contoh untuk perusahaan Mitra Group yang punya template invoice sendiri
 * (resources/views/pdf/perusahaan/{slug}): perusahaan itu saja (bukan 10 perusahaan Mitra Group), akun
 * khusus perusahaan itu, profil + format nomor invoice, satu klien, dan beberapa invoice contoh.
 * Subkelas hanya berisi datanya.
 *
 * Repo ini publik: klien, kapal, dan nominal di subkelas FIKTIF, dan tanda tangan/stempel yang dipasang
 * adalah gambar "CONTOH" buatan seeder. Tanda tangan asli diunggah di Pengaturan › Profil perusahaan.
 *
 * Idempoten dan cocok dengan MitraGroupSeeder: perusahaan/akun/invoice yang sudah ada tidak dibuat ulang.
 */
abstract class ContohInvoicePerusahaanSeeder extends Seeder
{
    /**
     * @return array{slug: string, name: string, abbreviation: string}
     */
    abstract protected function company(): array;

    /**
     * Akun khusus perusahaan ini (password: password); yang pertama disebut di pesan selesai.
     *
     * @return array<string, string> email => peran
     */
    abstract protected function accounts(): array;

    /**
     * Isian Profil perusahaan, termasuk format nomor invoice.
     *
     * @return array<string, mixed>
     */
    abstract protected function profile(): array;

    /**
     * @return array{name: string, attributes: array<string, mixed>}
     */
    abstract protected function client(): array;

    /**
     * Invoice contoh; `number` null = draft.
     *
     * @return list<array{number: ?string, date: string, subject: string, discount: int, items: list<array<string, mixed>>}>
     */
    abstract protected function invoices(): array;

    public function run(): void
    {
        $this->call(MasterPermissionSeeder::class);

        $data = $this->company();

        $organization = Organization::firstOrCreate(
            ['slug' => 'mitra-group'],
            ['name' => 'Mitra Group', 'company_quota' => 10],
        );

        // Membuat perusahaan baru memicu pipeline provisioning: CREATE DATABASE tenant_{slug}
        // → migrate → seed master → status active.
        $company = Company::find($data['slug']) ?? Company::create([
            'id' => $data['slug'],
            'organization_id' => $organization->id,
            'name' => $data['name'],
            'abbreviation' => $data['abbreviation'],
        ]);

        foreach ($this->accounts() as $email => $role) {
            $this->ensureMember($email, $role, $company, $organization);
        }
        setPermissionsTeamId(null);

        $company->run(function (): void {
            $this->seedProfile();
            $client = $this->seedClient();

            foreach ($this->invoices() as $invoice) {
                $this->seedInvoice($client, $invoice);
            }
        });

        $login = array_key_first($this->accounts());
        $this->command?->info("✓ Contoh PT {$data['abbreviation']} siap — login {$login} / password › Invoice › tab \"Perlu ditagih\" › Cetak.");
    }

    private function ensureMember(string $email, string $role, Company $company, Organization $organization): void
    {
        $user = User::firstOrCreate(['email' => $email], [
            'name' => ucfirst(strtok($email, '.')).' '.$this->company()['abbreviation'],
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

        $profile->fill($this->profile());
        // Nomor contoh memakai kode per dokumen (INV-FINAL, INV-DEM, ...) yang belum dikenal
        // pola penomoran; tandai sudah ditinjau supaya admin tidak dialihkan ke halaman peninjauan.
        $profile->invoice_legacy_reviewed_at = now();
        // Jangan pernah menimpa tanda tangan yang sudah diunggah.
        $profile->signature_path ??= $this->sampleSignature();
        $profile->save();
    }

    /**
     * Gambar tanda tangan + stempel bertuliskan CONTOH, digambar saat seeding (bukan berkas di repo)
     * dan disimpan di disk public perusahaan seperti hasil upload Profil perusahaan. Font dari folder
     * template perusahaan aktif.
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
        $client = $this->client();

        return Client::updateOrCreate(['name' => $client['name']], $client['attributes']);
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

        $ppnRate = (float) $this->profile()['ppn_rate'];
        $subtotal = (int) $items->sum('amount');
        $ppnAmount = Invoice::ppnFor($subtotal - $data['discount'], $ppnRate);
        $issueDate = Carbon::parse($data['date']);

        $invoice = Invoice::create([
            'billed_to_id' => $client->id,
            'subject' => $data['subject'],
            'subtotal' => $subtotal,
            'discount_type' => 'fixed',
            'discount_value' => $data['discount'],
            'discount_amount' => $data['discount'],
            'ppn_rate' => $ppnRate,
            'ppn_amount' => $ppnAmount,
            'total_amount' => max(0, $subtotal - $data['discount']) + $ppnAmount,
            'issue_date' => $issueDate,
            'due_date' => $issueDate->copy()->addDays(14),
            'status' => $data['number'] ? 'sent' : 'draft',
            'invoice_number' => $data['number'],
        ]);

        $invoice->items()->createMany($items->all());
    }
}
