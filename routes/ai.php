<?php

use App\Mcp\Servers\KeuanganServer;
use Illuminate\Support\Facades\Route;
use Laravel\Mcp\Facades\Mcp;

/*
| Koneksi Claude (MCP) — dimuat otomatis oleh laravel/mcp. Semua rute di sini PUSAT
| (di luar /c/{company}); perusahaan dipilih lewat argumen alat, bukan URL.
|
| Discovery OAuth + pendaftaran klien dinamis bersifat publik menurut spesifikasi MCP
| (setiap pendaftaran membuat baris oauth_clients), jadi dibatasi lajunya.
*/
Route::middleware('throttle:20,1')->group(function () {
    Mcp::oauthRoutes();
});

// Tanpa token Passport yang sah: 401 + WWW-Authenticate (dipasang Mcp::web) agar
// Claude memulai login OAuth. Izin per perusahaan dicek di setiap alat.
Mcp::web('/mcp/keuangan', KeuanganServer::class)->middleware(['auth:api', 'throttle:120,1']);
