<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Notifikasi invoice jatuh tempo — per PERUSAHAAN (tabel invoices ada di DB tenant),
// dibungkus tenants:run supaya berjalan dalam konteks setiap tenant
Schedule::command('tenants:run invoices:notify-due-dates')->dailyAt('08:00');
