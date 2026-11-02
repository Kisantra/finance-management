{{--
    Halaman error cadangan — lapisan TERAKHIR.

    Dipakai ketika halaman Inertia `error` (App\Services\ErrorReportService) tidak
    bisa dirender, mis. database mati atau view composer gagal. Karena itu berkas ini
    HARAM menyentuh database, session, auth, atau Vite: semuanya bisa jadi penyebab
    error yang sedang ditampilkan. CSS ditulis inline, font memakai stack sistem.
--}}
@php
    $referenceId = \App\Services\ErrorReportService::referenceId(request());
    $waktu = now()->format('Y-m-d H:i:s T');
    $halaman = request()->method().' '.request()->getPathInfo();
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('code') — @yield('title') — Finance Management</title>
    <script>
        (function () {
            try {
                var stored = localStorage.getItem('theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (stored === 'dark' || (!stored && prefersDark)) {
                    document.documentElement.classList.add('gelap');
                }
            } catch (e) {}
        })();
    </script>
    <style>
        :root {
            --bg: #f9fafb; --kartu: #ffffff; --garis: #e4e4e7; --garis-kuat: #d4d4d8;
            --teks: #111827; --redup: #4b5563; --samar: #6b7280;
            --biru: #2563eb; --biru-hover: #1d4ed8; --isi-lembut: #f4f4f5;
        }
        html.gelap {
            --bg: #09090a; --kartu: #1a1a1d; --garis: rgba(255,255,255,.08); --garis-kuat: #3f3f46;
            --teks: #f4f4f5; --redup: #a1a1aa; --samar: #71717a;
            --biru: #3b82f6; --biru-hover: #2563eb; --isi-lembut: #141414;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
            padding: 48px 16px; background: var(--bg); color: var(--teks);
            font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 16px; line-height: 1.6;
        }
        .bungkus { width: 100%; max-width: 576px; }
        .kartu {
            background: var(--kartu); border: 1px solid var(--garis); border-radius: 12px;
            box-shadow: 0 1px 2px rgba(0,0,0,.05); overflow: hidden;
        }
        .isi { padding: 32px 32px 28px; }
        .lencana {
            display: inline-block; padding: 2px 10px; border-radius: 6px; background: var(--isi-lembut);
            border: 1px solid var(--garis); font-size: 12px; font-weight: 700; color: var(--redup);
        }
        h1 { margin: 12px 0 8px; font-size: 28px; font-weight: 700; letter-spacing: -.02em; }
        p.keterangan { margin: 0; color: var(--redup); }
        .rujukan {
            display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
            margin-top: 24px; padding: 10px 14px; border: 1px solid var(--garis);
            border-radius: 6px; background: var(--isi-lembut);
        }
        .rujukan span { font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--samar); }
        .rujukan code { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 14px; user-select: all; }
        .aksi { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
        .tombol {
            appearance: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
            height: 42px; padding: 0 16px; border-radius: 6px; border: 1px solid transparent;
            font: inherit; font-size: 14px; font-weight: 600; text-decoration: none;
            transition: background-color .2s cubic-bezier(.4,0,.2,1), color .2s;
        }
        .tombol-utama { background: var(--biru); color: #fff; }
        .tombol-utama:hover { background: var(--biru-hover); }
        .tombol-kedua { background: transparent; color: var(--teks); border-color: var(--garis-kuat); }
        .tombol-kedua:hover { background: var(--isi-lembut); }
        .tombol:focus-visible { outline: 3px solid var(--biru); outline-offset: 2px; }
        .bantuan {
            padding: 20px 32px 28px; border-top: 1px solid var(--garis);
            background: var(--isi-lembut);
        }
        .bantuan h2 { margin: 0 0 4px; font-size: 14px; font-weight: 700; }
        .bantuan p { margin: 0 0 14px; font-size: 14px; color: var(--redup); }
        details { margin-top: 14px; }
        summary { cursor: pointer; font-size: 13px; font-weight: 600; color: var(--redup); }
        pre {
            margin: 10px 0 0; padding: 12px; overflow-x: auto; border-radius: 6px;
            border: 1px solid var(--garis); background: var(--kartu);
            font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 12px;
            color: var(--teks); white-space: pre-wrap; word-break: break-word;
        }
        .jejak { margin-top: 16px; text-align: center; font-size: 12px; color: var(--samar); }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
    </style>
</head>
<body>
    <div class="bungkus">
        <div class="kartu">
            <div class="isi">
                <span class="lencana">Kode @yield('code')</span>
                <h1>@yield('title')</h1>
                <p class="keterangan">@yield('message')</p>

                <div class="rujukan">
                    <span>ID referensi</span>
                    <code id="id-referensi">{{ $referenceId }}</code>
                </div>

                <div class="aksi">
                    <a class="tombol tombol-utama" href="{{ url('/') }}">Ke Beranda</a>
                    <button class="tombol tombol-kedua" type="button" onclick="history.back()">Kembali</button>
                </div>
            </div>

            <div class="bantuan">
                <h2>Butuh bantuan tim IT?</h2>
                <p>Salin detail di bawah, lalu kirim ke tim IT atau tempel ke asisten AI beserta ID referensi.</p>

                <button class="tombol tombol-kedua" type="button" id="tombol-salin" data-salin>Salin Markdown</button>

                <details>
                    <summary>Lihat detail</summary>
                    <pre id="detail-laporan">## Laporan Error — Finance Management

- **Kode**: `@yield('code') — @yield('title')`
- **ID referensi**: `{{ $referenceId }}`
- **Waktu**: `{{ $waktu }}`
- **Halaman**: `{{ $halaman }}`
- **Tampilan**: `halaman cadangan (halaman error utama gagal dirender)`

### Cara menelusuri
Cari `{{ $referenceId }}` di `storage/logs/laravel.log`. Halaman cadangan ini tampil ketika
halaman error utama gagal dirender — biasanya karena database atau view bermasalah, jadi
periksa juga koneksi database dan migration yang tertunda.</pre>
                </details>
            </div>
        </div>

        <p class="jejak">Kisantra Finance</p>
    </div>

    <script>
        (function () {
            var tombol = document.getElementById('tombol-salin');
            var sumber = document.getElementById('detail-laporan');

            tombol.addEventListener('click', function () {
                var teks = sumber.textContent + '\n- **Browser**: `' + navigator.userAgent + '`';

                function selesai(berhasil) {
                    tombol.textContent = berhasil ? 'Tersalin' : 'Gagal menyalin — salin manual dari Lihat detail';
                    setTimeout(function () { tombol.textContent = 'Salin Markdown'; }, 2500);
                }

                // Clipboard API hanya tersedia di konteks aman (HTTPS/localhost).
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(teks).then(function () { selesai(true); }, function () { selesai(false); });
                    return;
                }

                var area = document.createElement('textarea');
                area.value = teks;
                area.setAttribute('readonly', '');
                area.style.position = 'fixed';
                area.style.opacity = '0';
                document.body.appendChild(area);
                area.select();
                var berhasil = false;
                try { berhasil = document.execCommand('copy'); } catch (e) {}
                area.remove();
                selesai(berhasil);
            });
        })();
    </script>
</body>
</html>
