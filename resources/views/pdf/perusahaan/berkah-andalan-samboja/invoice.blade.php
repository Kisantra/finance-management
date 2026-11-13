{{--
    Template invoice PT Berkah Andalan Samboja (BAS) — desain STATIS, ditiru dari invoice Word perusahaan
    (INVOICE FINAL … .docx). Di sini hanya desainnya (logo, judul, susunan, warna, font). Data perusahaan
    dibaca dari Pengaturan › Profil perusahaan ($company: nama, alamat, telepon, rekening, kota & penanda
    tangan; baris baru di Alamat ikut tercetak); baris total disusun sistem ($baris_total,
    InvoiceTotalRows) dan di sini hanya ditata per jenisnya.
    Logo: logo.jpg di folder ini ($aset('logo.jpg')). Font di fonts/: Carlito (pengganti Calibri, judul)
    dan Caladea (pengganti Cambria, alamat klien & kotak info), keduanya berukuran identik dengan aslinya.
    Gambar tanda tangan & stempel dari upload Profil perusahaan ($tanda_tangan, $stempel); tidak disimpan
    di repo (repo publik). Kosong = ruang tanda tangan basah.
--}}
@php
    $rp = fn ($value) => number_format((float) $value, 0, ',', '.');
    $qty = fn ($value) => rtrim(rtrim(number_format((float) $value, 3, ',', '.'), '0'), ',');
    // "Rp" rata kiri, angka rata kanan dalam satu baris (format akuntansi tabel Excel di dokumen asli).
    $uang = fn ($value) => '<table class="uang"><tr><td class="rp">Rp</td><td class="angka">'.$rp($value).'</td></tr></table>';

    $units = $items->pluck('unit')->filter()->unique()->values();
    $sharedUnit = $units->count() === 1 ? $units->first() : null;

    // Kotak alamat di desain ini selalu huruf kapital, apa pun penulisan di profil.
    $namaPerusahaan = mb_strtoupper((string) $company['name']);
    $alamatPerusahaan = mb_strtoupper((string) $company['address']);
    $penandaTangan = $company['signature'];
    $tanggal = $invoice->issue_date?->copy()->locale('id')->translatedFormat('j F Y');
    $font = fn (string $file) => \App\Services\CompanyInvoiceTemplate::path('fonts/'.$file);
    $fontJudul = $font('Carlito-Bold.ttf');
    $fontIsi = $font('Caladea-Regular.ttf');
    $fontIsiTebal = $font('Caladea-Bold.ttf');
@endphp
<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <title>Invoice {{ $invoice->invoice_number }}</title>
    <style>
        /* Font mengikuti dokumen Word asli: Times New Roman (core font "times" DomPDF) untuk nomor,
           perihal, klien, tabel, tanggal & penanda tangan; Calibri → Carlito untuk judul; Cambria →
           Caladea untuk alamat klien, ATTENTION, TERM PAYMENT, dan kedua kotak info. Isi 11pt. */
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
            font-family: times, serif;
            font-size: 11pt;
            line-height: 1.15;
            color: #000;
        }

        /* Tinggi baris DomPDF = line-height × (ascender − descender) × font_height_ratio 1,1. Spasi
           tunggal Word: Cambria/Caladea 1,172 em → line-height 0,91; Times 0,9 em → 1,15 (di body). */
        .cambria {
            font-family: 'Caladea', times, serif;
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

        .items-table,
        .totals-table {
            width: 100%;
            border-collapse: collapse;
        }

        .items-table {
            margin-top: 0.85cm;
        }

        /* Judul kolom seperti tabel Excel asli: Times New Roman 11pt tebal, hitam di atas merah,
           garis bawah ganda. */
        .items-table th {
            height: 0.99cm;
            background-color: #da5a5a;
            color: #000;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            padding: 0 0.08cm;
            border: 1px solid #000;
            border-bottom: 3px double #000;
        }

        .items-table td,
        .totals-table td {
            border: 1px solid #000;
            padding: 0.03cm 0.08cm;
            vertical-align: middle;
        }

        /* Satu baris kosong di atas dan di bawah keterangan, seperti blok item di dokumen asli. */
        .items-table td.keterangan {
            padding: 0.5cm 0.08cm;
            line-height: 1.2;
        }

        /* Kedua tabel bergaris penuh; -1px menumpuk garis pertemuannya bila satu halaman, dan tetap ada
           garis di bawah item / di atas total bila total pindah ke halaman berikutnya. */
        .totals-table {
            margin-top: -1px;
            page-break-inside: avoid;
        }

        .totals-table tr.ukur td {
            border: none;
            padding: 0;
            height: 0;
        }

        /* Gaya baris total per jenis (InvoiceTotalRows). Baris tagihan = GRAND TOTAL dokumen asli:
           tebal, label di tengah, nominal 12pt, garis bawah ganda. */
        .totals-table tr.baris-dpp td.label,
        .totals-table tr.baris-total td.label,
        .totals-table tr.baris-tagihan td {
            font-weight: bold;
        }

        .totals-table tr.baris-tagihan td {
            border-bottom: 3px double #000;
        }

        .totals-table tr.baris-tagihan td.label {
            text-align: center;
        }

        .totals-table tr.baris-tagihan td.c-total {
            font-size: 12pt;
        }

        .totals-table tr.baris-diterima td.c-total {
            color: #ff0000;
        }

        .c-no {
            width: 10.2%;
            text-align: center;
        }

        .c-ket {
            width: 37.3%;
        }

        .c-qty {
            width: 12%;
            text-align: center;
        }

        .c-price {
            width: 20.4%;
        }

        .c-total {
            width: 20.1%;
        }

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

        /* Dua kotak terpisah dengan tinggi masing-masing (kotak rekening lebih pendek), rata atas. */
        table.info {
            width: 16.81cm;
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
            font-family: 'Caladea', times, serif;
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
                        <td>I N V O I C E</td>
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
        @if (filled($client->person_in_charge))
            <tr class="cambria">
                <td class="label">ATTENTION</td>
                <td class="titik">:</td>
                <td>{{ $client->person_in_charge }}</td>
            </tr>
        @endif
        <tr class="cambria">
            <td class="label">TERM PAYMENT</td>
            <td class="titik">:</td>
            <td>Telegraphic Transfer (T/T)</td>
        </tr>
    </table>

    <table class="items-table">
        <thead>
            <tr>
                <th class="c-no">No</th>
                <th class="c-ket">Keterangan</th>
                <th class="c-qty">Quantity{{ $sharedUnit ? ' ('.strtoupper($sharedUnit).')' : '' }}</th>
                <th class="c-price">PRICE</th>
                <th class="c-total">TOTAL (Rp)</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($items as $index => $item)
                <tr>
                    <td class="c-no">{{ $index + 1 }}</td>
                    <td class="c-ket keterangan">
                        {{ $item->service_name }}
                        @if (filled($item->description))
                            <br>{!! nl2br(e($item->description)) !!}
                        @endif
                    </td>
                    <td class="c-qty">{{ $qty($item->quantity) }}{{ $sharedUnit ? '' : ' '.$item->unit }}</td>
                    <td class="c-price">{!! $uang($item->unit_price) !!}</td>
                    <td class="c-total">{!! $uang($item->amount) !!}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="totals-table">
        {{-- Baris ukur tanpa garis: lebar kolom sama persis dengan tabel item di atasnya. --}}
        <tr class="ukur">
            <td class="c-no"></td>
            <td class="c-ket"></td>
            <td class="c-qty"></td>
            <td class="c-price"></td>
            <td class="c-total"></td>
        </tr>
        @foreach ($baris_total as $baris)
            <tr class="baris-{{ $baris['jenis'] }}">
                @if ($baris['nomor'])
                    <td class="c-no">{{ $baris['nomor'] }}</td>
                    <td colspan="3" class="label">{{ $baris['label'] }}</td>
                @else
                    <td colspan="4" class="label">{{ $baris['label'] }}</td>
                @endif
                <td class="c-total">{!! $uang($baris['jumlah']) !!}</td>
            </tr>
        @endforeach
    </table>

    <table class="info">
        <tr>
            <td style="width: 8.45cm;">
                <div class="kotak">
                    <span class="tebal">{{ $namaPerusahaan }}</span><br>
                    {!! nl2br(e($alamatPerusahaan)) !!}<br>
                    <span class="tebal">Telepon : {{ $company['phone'] }}</span>
                </div>
            </td>
            <td class="sela"></td>
            <td style="width: 8.17cm;">
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
