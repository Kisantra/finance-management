{{--
    Template invoice PT Samboja Laju Utama (SLU) — desain STATIS, ditiru dari invoice Word perusahaan.
    Di sini hanya desainnya (kop, warna, susunan, font). Data perusahaan dibaca dari Pengaturan › Profil
    perusahaan ($company: nama, alamat, email, telepon, rekening, kota & penanda tangan); baris total
    disusun sistem ($baris_total, InvoiceTotalRows) dan di sini hanya ditata per jenisnya.
    Logo: logo.jpg di folder ini ($aset('logo.jpg')); font judul: fonts/Carlito-Bold.ttf (OFL).
    Gambar tanda tangan & stempel dari upload Profil perusahaan ($tanda_tangan, $stempel); tidak
    disimpan di repo (repo publik). Kosong = ruang tanda tangan basah.
--}}
@php
    $rp = fn ($value) => number_format((float) $value, 0, ',', '.');
    $qty = fn ($value) => rtrim(rtrim(number_format((float) $value, 3, ',', '.'), '0'), ',');
    // "Rp" rata kiri, angka rata kanan dalam satu baris (gaya akuntansi seperti di Excel asli).
    $uang = fn ($value) => '<table class="uang"><tr><td class="rp">Rp</td><td class="angka">'.$rp($value).'</td></tr></table>';

    $units = $items->pluck('unit')->filter()->unique()->values();
    $sharedUnit = $units->count() === 1 ? $units->first() : null;

    // Nama perusahaan selalu huruf kapital di desain ini, apa pun penulisan di profil.
    $namaPerusahaan = mb_strtoupper((string) $company['name']);
    $penandaTangan = $company['signature'];
    $tanggal = $invoice->issue_date?->copy()->locale('id')->translatedFormat('j F Y');
    $fontJudul = \App\Services\CompanyInvoiceTemplate::path('fonts/Carlito-Bold.ttf');
@endphp
<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <title>Invoice {{ $invoice->invoice_number }}</title>
    <style>
        /* Font mengikuti dokumen Word asli: Times New Roman di semua teks (core font "times" DomPDF
           sama ukurannya), judul memakai Calibri → Carlito (OFL, ukuran identik; fonts/). Ukuran:
           kop 26/10pt, isi 11pt, judul kolom tabel 12pt tebal, rincian item 10pt. */
        @if ($fontJudul)
            @font-face {
                font-family: 'Carlito';
                src: url('{{ $fontJudul }}') format('truetype');
                font-weight: bold;
                font-style: normal;
            }
        @endif

        @page {
            margin: 3.45cm 2.3cm 1.5cm 2.3cm;
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

        /* Kop — diulang di setiap halaman, seperti header Word. */
        .kop {
            position: fixed;
            top: -3cm;
            left: 0;
            right: 0;
            height: 2.55cm;
            border-bottom: 4px double #000;
        }

        .kop table {
            width: 100%;
            border-collapse: collapse;
        }

        .kop td {
            vertical-align: top;
            padding: 0;
        }

        .kop .logo {
            width: 2.82cm;
            height: 2.06cm;
        }

        /* Seperti header Word: nama rata tengah di kanan logo; alamat & email menggantung
           (label di 3,25 cm, baris lanjutan di 4,5 cm dari tepi kiri). */
        .kop .nama {
            font-size: 26pt;
            font-weight: bold;
            line-height: 1;
            text-align: center;
        }

        .kop .alamat {
            font-size: 10pt;
            line-height: 1.15;
            padding-left: 1.55cm;
            text-indent: -1.25cm;
        }

        .kop .alamat.pertama {
            margin-top: 0.12cm;
        }

        /* Judul dalam kotak bergaris, di tengah halaman (tabel melayang "center" di Word). */
        table.judul {
            width: 5.58cm;
            margin: 0 auto 0.45cm;
            border-collapse: collapse;
        }

        table.judul td {
            border: 0.5pt solid #000;
            padding: 0.02cm 0.1cm;
            text-align: center;
            font-family: 'Carlito', helvetica, sans-serif;
            font-size: 18pt;
            font-weight: bold;
            line-height: 1.1;
        }

        .meta {
            border-collapse: collapse;
            margin-bottom: 0.2cm;
        }

        .meta td {
            padding: 0 0 0.1cm;
            vertical-align: top;
        }

        .meta .label {
            width: 3.6cm;
        }

        .meta .titik {
            width: 0.45cm;
        }

        .meta .tebal {
            font-weight: bold;
        }

        .items-table,
        .totals-table {
            width: 100%;
            border-collapse: collapse;
        }

        /* Judul kolom seperti Excel asli: Times New Roman 12pt tebal, teks hitam di atas merah. */
        .items-table th {
            background-color: #c00000;
            color: #000;
            font-size: 12pt;
            font-weight: bold;
            line-height: 1.1;
            text-align: center;
            vertical-align: middle;
            padding: 0.06cm 0.08cm;
            border: 1px solid #000;
        }

        .items-table td,
        .totals-table td {
            border: 1px solid #000;
            padding: 0.05cm 0.1cm;
            vertical-align: middle;
        }

        .items-table td.keterangan {
            vertical-align: top;
            padding: 0.06cm 0.1cm;
        }

        /* Kedua tabel bergaris penuh; -1px menumpuk garis pertemuannya bila satu halaman, dan
           tetap ada garis di bawah item / di atas total bila total pindah ke halaman berikutnya. */
        .totals-table {
            margin-top: -1px;
            page-break-inside: avoid;
        }

        .totals-table tr.ukur td {
            border: none;
            padding: 0;
            height: 0;
        }

        .c-no {
            width: 7%;
            text-align: center;
        }

        .c-ket {
            width: 42%;
        }

        .c-qty {
            width: 13%;
            text-align: center;
        }

        .c-price {
            width: 18%;
        }

        .c-total {
            width: 20%;
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

        .items-table td.keterangan .rincian {
            font-size: 10pt;
            line-height: 1.1;
        }

        .tebal {
            font-weight: bold;
        }

        .info {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin-top: 0.3cm;
            page-break-inside: avoid;
        }

        .info td {
            vertical-align: top;
        }

        /* Kedua kotak sel di baris yang sama, jadi tingginya selalu sama. */
        .info td.sela {
            width: 4%;
        }

        .info .kotak {
            border: 0.5px solid #000;
            padding: 0.06cm 0.12cm 0.1cm;
            font-size: 10pt;
            line-height: 1.15;
        }

        .info .kotak .besar {
            font-size: 11pt;
            font-weight: bold;
        }

        .tanda-tangan {
            margin-top: 0.6cm;
            page-break-inside: avoid;
        }

        /* Tanda tangan (boleh sudah termasuk meterai & stempel, seperti dokumen asli) dengan stempel
           terpisah ditumpuk di atasnya bila diunggah sendiri. */
        .tanda-tangan .ttd {
            position: relative;
            height: 2.15cm;
            margin: 0.1cm 0 0.05cm;
        }

        .tanda-tangan .ttd img {
            height: 2.15cm;
            max-width: 6cm;
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

        /* Gaya baris total per jenis (InvoiceTotalRows). */
        .totals-table tr.baris-dpp td,
        .totals-table tr.baris-tagihan td,
        .totals-table tr.baris-total td.label {
            font-weight: bold;
        }

        .totals-table tr.baris-tagihan td.label {
            text-align: center;
        }

        .totals-table tr.baris-diterima td.c-total {
            color: #ff0000;
        }
    </style>
</head>

<body>
    <div class="kop">
        <table>
            <tr>
                <td style="width: 2.95cm;">
                    @if ($logo = $aset('logo.jpg'))
                        <img class="logo" src="{{ $logo }}" alt="Logo PT Samboja Laju Utama">
                    @endif
                </td>
                <td>
                    <div class="nama">{{ $namaPerusahaan }}</div>
                    <div class="alamat pertama">Alamat : {!! nl2br(e($company['address'])) !!}</div>
                    @if (filled($company['email']))
                        <div class="alamat">Email &nbsp;&nbsp;: {{ $company['email'] }}</div>
                    @endif
                </td>
            </tr>
        </table>
    </div>

    <table class="judul">
        <tr>
            <td>I N V O I C E</td>
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
        <tr>
            <td class="label tebal">TO</td>
            <td class="titik tebal">:</td>
            <td>
                <span class="tebal">{{ $client->name }}</span>
                @if (filled($client->address))
                    <br>{!! nl2br(e($client->address)) !!}
                @endif
            </td>
        </tr>
        @if (filled($client->person_in_charge))
            <tr>
                <td class="label">ATTENTION</td>
                <td class="titik">:</td>
                <td>{{ $client->person_in_charge }}</td>
            </tr>
        @endif
        <tr>
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
                            <div class="rincian">{!! nl2br(e($item->description)) !!}</div>
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
            <td class="kotak" style="width: 52%;">
                <div class="besar">{{ $namaPerusahaan }}</div>
                {!! nl2br(e($company['address'])) !!}<br>
                <span class="besar">Telepon: {{ $company['phone'] }}</span>
            </td>
            <td class="sela"></td>
            <td class="kotak" style="width: 44%;">
                @foreach ($company['bank_accounts'] ?? [] as $rekening)
                    <div class="besar">{{ $rekening['bank'] }}</div>
                    <div class="besar">An. {{ $rekening['account_name'] }}</div>
                    Nomor rekening bank: {{ $rekening['account_number'] }}@if (! $loop->last)<br><br>@endif
                @endforeach
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
