<?php

/**
 * Perusahaan KEDUA untuk demo lokal, dibuat dari nol (bukan hasil adopsi), plus
 * pengaturan akses supaya fitur multi-perusahaan langsung terasa saat dibuka.
 *
 * Dipanggil oleh docs/demo/siapkan-demo-lokal.sh. Idempoten: aman dijalankan
 * ulang. JANGAN dijalankan dengan DB_DATABASE menunjuk database Anda sendiri —
 * penjaga di bawah menolaknya.
 */
require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\BankAccount;
use App\Models\Client;
use App\Models\Company;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Role;
use App\Models\Service;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Support\Facades\DB;

// ------------------------------------------------------------------ PENJAGA -
$pusat = config('database.connections.mysql.database');
if ($pusat !== 'demo_central') {
    fwrite(STDERR, "TOLAK: DB_DATABASE='{$pusat}', bukan 'demo_central'. Dihentikan sebelum menulis apa pun.\n");
    exit(1);
}

$ORG = 'grup-demo';
$SLUG_B = 'cabang';
$ADMIN = 'admin@demo.test';

$org = Organization::where('slug', $ORG)->firstOrFail();

// ------------------------------------------------- perusahaan kedua: cabang -
$cabang = Company::find($SLUG_B);

if (! $cabang) {
    // Company::create() memicu pipeline provisioning lengkap:
    // CreateDatabase -> MigrateDatabase -> SeedDatabase -> MarkCompanyActive.
    $cabang = Company::create([
        'id' => $SLUG_B,
        'organization_id' => $org->id,
        'name' => 'PT Cabang Demo',
        'abbreviation' => 'CBG',
    ]);
    echo "Perusahaan kedua dibuat: {$SLUG_B} (status {$cabang->fresh()->status}, database tenant_{$SLUG_B})\n";
} else {
    echo "Perusahaan kedua sudah ada: {$SLUG_B}\n";
}

// --------------------------------------------------------- isi data contoh -
$cabang->run(function () {
    // id mulai 501 supaya TIDAK bertabrakan dengan id milik perusahaan pertama.
    // Dengan begitu, kalau Anda iseng menukar id di URL, hasilnya 404 yang jujur
    // — bukan "kebetulan ketemu baris lain yang nomornya sama".
    foreach (['clients', 'services', 'bank_accounts', 'invoices', 'invoice_items', 'payments'] as $t) {
        if (DB::table($t)->count() === 0) {
            DB::statement("ALTER TABLE `$t` AUTO_INCREMENT = 501");
        }
    }

    $klien = Client::firstOrCreate(['name' => 'PT Mitra Cabang'], [
        'type' => 'company',
        'email' => 'kontak@mitracabang.test',
        'address' => 'Jl. Cabang Raya No. 2, Jakarta',
        'status' => 'Active',
        'person_in_charge' => 'Rina Wijaya',
    ]);

    // `type` adalah enum ketat: Perizinan | Administrasi Perpajakan |
    // Digital Marketing | Sistem Digital. Nilai di luar daftar itu ditolak MySQL
    // dengan "Data truncated", bukan disimpan apa adanya.
    Service::firstOrCreate(['name' => 'Jasa Konsultasi Pajak'], [
        'price' => 7_500_000,
        'type' => 'Administrasi Perpajakan',
    ]);

    $bank = BankAccount::firstOrCreate(['account_number' => '9900112233'], [
        'account_name' => 'PT Cabang Demo - Operasional',
        'bank_name' => 'Bank Mandiri',
        'branch' => 'Sudirman',
        'initial_balance' => 75_000_000,
    ]);

    TransactionCategory::firstOrCreate(['label' => 'Sewa Kantor Cabang'], ['type' => 'expense']);

    $inv = Invoice::firstOrCreate(['invoice_number' => '001/INV/CBG-PMC/XI/2026'], [
        'billed_to_id' => $klien->id,
        'subtotal' => 7_500_000,
        'discount_amount' => 0,
        'ppn_rate' => 0,
        'ppn_amount' => 0,
        'total_amount' => 7_500_000,
        'issue_date' => now()->toDateString(),
        'due_date' => now()->addDays(30)->toDateString(),
        'status' => 'sent',
    ]);

    InvoiceItem::firstOrCreate(['invoice_id' => $inv->id, 'service_name' => 'Jasa Konsultasi Pajak'], [
        'client_id' => $klien->id,
        'quantity' => 1,
        'unit' => 'paket',
        'unit_price' => 7_500_000,
        'amount' => 7_500_000,
        'cogs_amount' => 2_000_000,
    ]);

    Payment::firstOrCreate(['invoice_id' => $inv->id, 'reference_number' => 'CBG-BAYAR-01'], [
        'bank_account_id' => $bank->id,
        'amount' => 3_000_000,
        'payment_date' => now()->toDateString(),
        'payment_method' => 'bank_transfer',
    ]);

    $inv->updateStatus();

    echo "  data PT Cabang Demo: klien=".Client::count()
        .' invoice='.Invoice::count()
        .' rekening='.BankAccount::count()."\n";
});

// ------------------------------------------- admin demo: anggota KEDUA PT ----
// Tanpa ini, admin hanya punya satu perusahaan dan langsung dilempar ke
// dashboard — pemilih perusahaan dan tombol pindah PT tidak akan pernah muncul,
// padahal itu justru fitur yang ingin dicoba.
$admin = User::where('email', $ADMIN)->firstOrFail();
$semua = Company::pluck('id')->all();
$admin->companies()->syncWithoutDetaching($semua);

Role::firstOrCreate(['name' => 'admin']);

foreach ($semua as $slug) {
    setPermissionsTeamId($slug);
    $admin->unsetRelation('roles')->unsetRelation('permissions');
    if (! $admin->hasRole('admin')) {
        $admin->assignRole('admin');
    }
}
setPermissionsTeamId(null);
$admin->unsetRelation('roles')->unsetRelation('permissions');

app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();

echo "Admin {$ADMIN} kini anggota: ".implode(', ', $semua)."\n";
echo "Perusahaan terdaftar: ".Company::count()."\n";
