<?php
/**
 * Siapkan data uji untuk tabel yang hidup di database CENTRAL:
 * feedbacks + app_notifications (keduanya pakai trait CentralConnection).
 */
require __DIR__.'/../../vendor/autoload.php';
$app = require_once __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\AppNotification;
use App\Models\Company;
use App\Models\Feedback;
use App\Models\User;
use Illuminate\Support\Facades\DB;

if (! str_starts_with(DB::connection()->getDatabaseName(), 'qa_')) {
    fwrite(STDERR, "PENJAGA: bukan database qa_*\n");
    exit(1);
}

echo 'Koneksi model Feedback      : '.(new Feedback)->getConnectionName()."\n";
echo 'Koneksi model AppNotification: '.(new AppNotification)->getConnectionName()."\n";
echo 'Nama DB koneksi Feedback     : '.(new Feedback)->getConnection()->getDatabaseName()."\n";

$manager = User::where('email', 'both-manager@qa.test')->first();
$alphaStaff = User::where('email', 'alpha-staff@qa.test')->first();
$betaAdmin = User::where('email', 'beta-admin@qa.test')->first();

foreach ([['qaalpha', 'ALPHA', $alphaStaff], ['qabeta', 'BETA', $betaAdmin]] as [$slug, $tag, $pemilik]) {
    Company::find($slug)->run(function () use ($slug, $tag, $pemilik, $manager) {
        Feedback::firstOrCreate(['title' => "$tag-FEEDBACK-01"], [
            'user_id' => $pemilik->id,
            'description' => "$tag isi umpan balik rahasia",
            'type' => 'bug',
            'priority' => 'medium',
            'status' => 'open',
            'company_id' => $slug,
        ]);
        AppNotification::notify(
            userId: $manager->id,
            type: 'invoice_due',
            title: "$tag-NOTIF-01",
            message: "$tag notifikasi rahasia",
        );
        echo "dibuat: $tag-FEEDBACK-01 + $tag-NOTIF-01 (tenant aktif: ".(tenant()?->getTenantKey() ?? 'TIDAK ADA').")\n";
    });
}

echo "\n--- di mana barisnya mendarat ---\n";
foreach (['qa_central', 'tenant_qaalpha', 'tenant_qabeta'] as $db) {
    foreach (['feedbacks', 'app_notifications'] as $tabel) {
        $n = DB::selectOne('select count(*) c from information_schema.tables where table_schema = ? and table_name = ?', [$db, $tabel])->c;
        if ($n == 0) {
            echo str_pad("$db.$tabel", 34)."tabel TIDAK ADA\n";

            continue;
        }
        $baris = DB::selectOne("select count(*) c from `$db`.`$tabel`")->c;
        echo str_pad("$db.$tabel", 34)."$baris baris\n";
    }
}

echo "\n--- feedbacks di central (company_id per baris) ---\n";
foreach (DB::table('qa_central.feedbacks')->get(['id', 'title', 'company_id']) as $f) {
    echo "  id={$f->id} company_id=".($f->company_id ?? 'NULL')." title={$f->title}\n";
}
echo "--- app_notifications di central ---\n";
foreach (DB::table('qa_central.app_notifications')->get(['id', 'title', 'company_id', 'user_id']) as $f) {
    echo "  id={$f->id} company_id=".($f->company_id ?? 'NULL')." user_id={$f->user_id} title={$f->title}\n";
}
