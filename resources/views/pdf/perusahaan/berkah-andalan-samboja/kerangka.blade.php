{{--
    Kerangka dokumen PT Berkah Andalan Samboja (BAS) — dipakai bersama invoice.blade.php dan
    debit-note.blade.php, karena dokumen Word BAS (INVOICE FINAL … .docx, DEBIT NOTE … .docx) hanya berbeda
    judul dan tabel itemnya. Di sini: logo & judul berkotak, blok nomor/perihal/klien, kotak alamat &
    rekening, kota-tanggal, dan penanda tangan. Data perusahaan dibaca dari Pengaturan › Profil perusahaan
    ($company: nama, alamat, telepon, rekening, kota & penanda tangan; baris baru di Alamat ikut tercetak).
    Dokumen pengisi menyediakan bagian:
      nama-dokumen  judul tab PDF ("Invoice", "Debit Note")
      judul         teks di kotak judul
      gaya          CSS tabel item & baris total
      tabel         tabel item & baris total ($baris_total, InvoiceTotalRows)
    dan boleh menyetel $lebarTabel (cm, bawaan selebar area cetak 16,86 cm) bila tabel itemnya lebih sempit:
    kotak alamat & rekening mengikuti lebar itu supaya tepi kanannya sejajar dengan tabel.
    Logo: logo.jpg di folder ini ($aset('logo.jpg')). Font di fonts/: Tinos (pengganti Times New Roman, teks
    utama), Carlito (pengganti Calibri, judul), dan Caladea (pengganti Cambria, alamat klien & kotak info),
    semuanya berukuran identik dengan aslinya.
    Gambar tanda tangan & stempel dari upload Profil perusahaan ($tanda_tangan, $stempel); tidak disimpan
    di repo (repo publik). Kosong = ruang tanda tangan basah.
--}}
@php
    // Kotak alamat di desain ini selalu huruf kapital, apa pun penulisan di profil.
    $namaPerusahaan = mb_strtoupper((string) $company['name']);
    $alamatPerusahaan = mb_strtoupper((string) $company['address']);
    $penandaTangan = $company['signature'];
    $tanggal = $invoice->issue_date?->copy()->locale('id')->translatedFormat('j F Y');
    $font = fn (string $file) => \App\Services\CompanyInvoiceTemplate::path('fonts/'.$file);
    $fontUtama = $font('Tinos-Regular.ttf');
    $fontUtamaTebal = $font('Tinos-Bold.ttf');
    $fontJudul = $font('Carlito-Bold.ttf');
    $fontIsi = $font('Caladea-Regular.ttf');
    $fontIsiTebal = $font('Caladea-Bold.ttf');
    // Kotak alamat & rekening selebar tabel item, dibagi seperti dokumen Word (alamat 8,45 : rekening 8,17,
    // sela 0,19 cm). Garis & padding ada di div.kotak di dalam sel, jadi lebar sel = lebar kotak.
    $lebarInfo = (float) ($lebarTabel ?? 16.86);
    $lebarAlamat = round(($lebarInfo - 0.19) * 8.45 / 16.62, 2);
    $lebarRekening = round(($lebarInfo - 0.19) * 8.17 / 16.62, 2);
@endphp
<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <title>@yield('nama-dokumen') {{ $invoice->invoice_number }}</title>
    <style>
        /* Font mengikuti dokumen Word asli: Times New Roman → Tinos untuk nomor, perihal, klien, tabel,
           tanggal & penanda tangan; Calibri → Carlito untuk judul; Cambria → Caladea untuk alamat klien,
           ATTENTION, TERM PAYMENT, dan kedua kotak info. Isi 11pt. Times New Roman sendiri tidak boleh
           disertakan di repo (lisensi), dan core font "times" DomPDF tidak tertanam sehingga tampilannya
           bergantung pada penampil PDF. */
        @if ($fontUtama)
            @font-face {
                font-family: 'Tinos';
                src: url('{{ $fontUtama }}') format('truetype');
                font-weight: normal;
                font-style: normal;
            }
        @endif
        @if ($fontUtamaTebal)
            @font-face {
                font-family: 'Tinos';
                src: url('{{ $fontUtamaTebal }}') format('truetype');
                font-weight: bold;
                font-style: normal;
            }
        @endif
        @if ($fontJudul)
            @font-face {
                font-family: 'Carlito';
                src: url('{{ $fontJudul }}') format('truetype');
                font-weight: bold;
                font-style: normal;
            }
        @endif
        @if ($fontIsi)
            @font-face {
                font-family: 'Caladea';
                src: url('{{ $fontIsi }}') format('truetype');
                font-weight: normal;
                font-style: normal;
            }
        @endif
        @if ($fontIsiTebal)
            @font-face {
                font-family: 'Caladea';
                src: url('{{ $fontIsiTebal }}') format('truetype');
                font-weight: bold;
                font-style: normal;
            }
        @endif

        /* Margin Word: atas 1 cm, kiri 2,36 cm. Kanan 1,78 cm (Word 2,4 cm) karena tabel Excel di dokumen
           asli selebar 16,86 cm dan melewati margin kanan Word (begitu juga kotak rekening); blok
           nomor/klien tetap selebar teks Word (16,24 cm). Bawah 1 cm (Word 0,49 cm, terlalu mepet untuk
           printer). */
        @page {
            margin: 1cm 1.78cm 1cm 2.36cm;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: 'Tinos', times, serif;
            font-size: 11pt;
            line-height: 0.9;
            color: #000;
        }

        /* Tinggi baris DomPDF = line-height × (ascender − descender) × font_height_ratio 1,1. Spasi
           tunggal Word: Cambria/Caladea 1,172 em → line-height 0,91; Times New Roman/Tinos (terukur 1,15 em)
           → 0,9 (di body; sama dengan 1,15 untuk core font "times" 0,9 em yang dipakai sebelumnya). */
        .cambria {
            font-family: 'Caladea', 'Tinos', serif;
            line-height: 0.91;
        }

        .tebal {
            font-weight: bold;
        }

        /* Logo di kiri atas; judul dalam kotak bergaris di kanannya (tabel melayang di Word, 9,42 cm dari
           tepi kertas). Hanya di halaman pertama, seperti dokumen asli (bukan header Word). */
        table.kepala {
            width: 100%;
            border-collapse: collapse;
        }

        table.kepala td {
            padding: 0;
            vertical-align: top;
        }

        table.kepala td.sel-logo {
            width: 7.06cm;
        }

        .logo {
            width: 2.79cm;
            height: 2.08cm;
            margin: 0.1cm 0 0 0.18cm;
        }

        table.kepala td.sel-judul {
            padding-top: 0.82cm;
        }

        table.judul {
            width: 5.58cm;
            border-collapse: collapse;
        }

        /* Teks rata atas seperti sel Word; line-height 0,7 menaruh garis dasar 0,59 cm di bawah tepi atas
           kotak, sama dengan dokumen asli. */
        table.judul td {
            height: 0.98cm;
            border: 0.5pt solid #000;
            padding: 0 0.19cm;
            text-align: center;
            vertical-align: top;
            font-family: 'Carlito', helvetica, sans-serif;
            font-size: 22pt;
            font-weight: bold;
            line-height: 0.7;
            letter-spacing: 0.2pt;
        }

        /* Titik dua di tab 5,5 cm seperti di Word; alamat klien menggantung di kolom nilai. */
        table.meta {
            width: 16.24cm;
            margin-top: 0.55cm;
            border-collapse: collapse;
        }

        table.meta td {
            padding: 0;
            vertical-align: top;
        }

        table.meta td.label {
            width: 5.47cm;
        }

        table.meta td.titik {
            width: 0.23cm;
        }

        @yield('gaya')

        table.uang {
            width: 100%;
            border-collapse: collapse;
        }

        .items-table table.uang td,
        .totals-table table.uang td {
            border: none;
            padding: 0;
        }

        table.uang td.angka {
            text-align: right;
        }

        /* Dua kotak terpisah dengan tinggi masing-masing (kotak rekening lebih pendek), rata atas. Lebarnya
           mengikuti tabel item ($lebarInfo; di dokumen Word 16,81 cm, 0,05 cm lebih sempit dari tabel). */
        table.info {
            width: {{ $lebarInfo }}cm;
            margin-top: 1.3cm;
            border-collapse: collapse;
            page-break-inside: avoid;
        }

        table.info td {
            padding: 0;
            vertical-align: top;
        }

        table.info td.sela {
            width: 0.19cm;
        }

        .kotak {
            border: 0.5pt solid #000;
            padding: 0.13cm 0.25cm 0.2cm;
            font-family: 'Caladea', 'Tinos', serif;
            line-height: 0.91;
        }

        /* Setinggi kotak rekening dokumen asli; memanjang bila profil berisi lebih dari satu rekening. */
        .kotak.rekening {
            min-height: 2.44cm;
        }

        .tanda-tangan {
            margin-top: 1.5cm;
            page-break-inside: avoid;
        }

        /* Tanda tangan (boleh sudah termasuk meterai & stempel) dengan stempel terpisah ditumpuk di
           atasnya bila diunggah sendiri. Tingginya = tujuh baris kosong di dokumen asli. */
        .tanda-tangan .ttd {
            position: relative;
            height: 3.12cm;
        }

        .tanda-tangan .ttd img {
            height: 2.7cm;
            max-width: 6cm;
            margin-top: 0.2cm;
        }

        .tanda-tangan .ttd img.stempel {
            position: absolute;
            left: 1.2cm;
            top: 0;
        }

        .tanda-tangan .nama {
            font-weight: bold;
            text-decoration: underline;
        }
    </style>
</head>

<body>
    <table class="kepala">
        <tr>
            <td class="sel-logo">
                @if ($logo = $aset('logo.jpg'))
                    <img class="logo" src="{{ $logo }}" alt="Logo PT Berkah Andalan Samboja">
                @endif
            </td>
            <td class="sel-judul">
                <table class="judul">
                    <tr>
                        <td>@yield('judul')</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <table class="meta">
        <tr class="tebal">
            <td class="label">Nomor</td>
            <td class="titik">:</td>
            <td>{{ $invoice->invoice_number ?? '-' }}</td>
        </tr>
        @if (filled($invoice->subject))
            <tr class="tebal">
                <td class="label">Perihal</td>
                <td class="titik">:</td>
                <td>{{ $invoice->subject }}</td>
            </tr>
        @endif
        <tr class="tebal">
            <td class="label">TO</td>
            <td class="titik">:</td>
            <td>{{ $client->name }}</td>
        </tr>
        @if (filled($client->address))
            <tr class="cambria">
                <td class="label"></td>
                <td class="titik"></td>
                <td>{!! nl2br(e($client->address)) !!}</td>
            </tr>
        @endif
        @if (filled($perhatian))
            <tr class="cambria">
                <td class="label">ATTENTION</td>
                <td class="titik">:</td>
                <td>{{ $perhatian }}</td>
            </tr>
        @endif
        <tr class="cambria">
            <td class="label">TERM PAYMENT</td>
            <td class="titik">:</td>
            <td>Telegraphic Transfer (T/T)</td>
        </tr>
    </table>

    @yield('tabel')

    <table class="info">
        <tr>
            <td style="width: {{ $lebarAlamat }}cm;">
                <div class="kotak">
                    <span class="tebal">{{ $namaPerusahaan }}</span><br>
                    {!! nl2br(e($alamatPerusahaan)) !!}<br>
                    <span class="tebal">Telepon : {{ $company['phone'] }}</span>
                </div>
            </td>
            <td class="sela"></td>
            <td style="width: {{ $lebarRekening }}cm;">
                <div class="kotak rekening">
                    @foreach ($company['bank_accounts'] ?? [] as $rekening)
                        @if (! $loop->first)
                            <br><br>
                        @endif
                        <span class="tebal">{{ $rekening['bank'] }}</span><br>
                        An. <span class="tebal">{{ $rekening['account_name'] }}</span><br>
                        No Rekening Bank: <span class="tebal">{{ $rekening['account_number'] }}</span>
                    @endforeach
                </div>
            </td>
        </tr>
    </table>

    <div class="tanda-tangan">
        <div>{{ filled($penandaTangan['city'] ?? null) ? $penandaTangan['city'].', ' : '' }}{{ $tanggal }}</div>
        <div class="ttd">
            @if ($tanda_tangan)
                <img src="{{ $tanda_tangan }}" alt="Tanda tangan">
            @endif
            @if ($stempel)
                <img class="stempel" src="{{ $stempel }}" alt="Stempel">
            @endif
        </div>
        <div class="nama">{{ $penandaTangan['name'] }}</div>
        <div>{{ $penandaTangan['position'] }}</div>
    </div>
</body>

</html>
