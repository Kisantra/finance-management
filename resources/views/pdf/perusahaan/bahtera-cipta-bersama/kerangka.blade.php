{{--
    Kerangka dokumen PT Bahtera Cipta Bersama (BCB) — dipakai bersama invoice.blade.php dan
    debit-note.blade.php, karena dokumen Word BCB (INVOICE FINAL/MOORING/FENDER … .docx, DEBIT NOTE … .docx)
    hanya berbeda judul dan tabel itemnya. Susunannya sama dengan template PT MKB (satu keluarga dokumen Word);
    bedanya logo, letak baris kontak di kop, ukuran tanda tangan, dan warna tabel. Di sini: kop surat (header Word, diulang di setiap halaman), blok
    nomor/perihal/klien, kotak alamat & rekening, kota-tanggal, dan penanda tangan. Data perusahaan dibaca dari
    Pengaturan › Profil perusahaan ($company: nama, alamat, telepon, email, rekening, kota & penanda tangan;
    baris baru di Alamat ikut tercetak). "Stevedoring Company" di kop adalah bagian desain.
    Dokumen pengisi menyediakan bagian:
      nama-dokumen  judul tab PDF ("Invoice", "Debit Note")
      judul         judul di bawah kop
      gaya          CSS tabel item & baris total
      tabel         tabel item & baris total ($baris_total, InvoiceTotalRows)
    Logo: logo.png di folder ini ($aset('logo.png'), diambil dari dokumen Word, 274×331 px). Font di fonts/:
    Tinos (pengganti Times New Roman, semua teks dokumen), Caladea (pengganti Cambria, kedua kotak info), dan
    Arimo (pengganti Arial, alamat di kotak alamat), semuanya berukuran identik dengan aslinya.
    Gambar tanda tangan & stempel dari upload Profil perusahaan ($tanda_tangan, $stempel); tidak disimpan
    di repo (repo publik). Kosong = ruang tanda tangan basah.
--}}
@php
    // Nama perusahaan di kop dan kotak alamat selalu huruf kapital, apa pun penulisan di profil.
    $namaPerusahaan = mb_strtoupper((string) $company['name']);
    $kontak = array_filter([
        filled($company['phone']) ? 'Tlp.Kantor/WA : '.$company['phone'] : null,
        filled($company['email']) ? 'Email : '.$company['email'] : null,
    ]);
    $penandaTangan = $company['signature'];
    $tanggal = $invoice->issue_date?->copy()->locale('id')->translatedFormat('j F Y');
    // Tagihan Rupiah bertarif USD (invoice FINAL): kurs & tarif tercetak di blok klien seperti dokumen asli.
    // Tagihan USD mencetak kursnya di baris total (InvoiceTotalRows).
    $angka = fn ($nilai, $mataUang = 'IDR') => \App\Services\InvoiceTotalRows::format($nilai, $mataUang, 4);
    $tarifUsd = $items->pluck('foreign_unit_price')->filter(fn ($tarif) => $tarif !== null)->map(fn ($tarif) => (float) $tarif)->unique()->values();
    $kursDiBlokKlien = $invoice->exchange_rate !== null && ! $invoice->isForeign() && $tarifUsd->isNotEmpty();
    $font = fn (string $file) => \App\Services\CompanyInvoiceTemplate::path('fonts/'.$file);
    $fontUtama = $font('Tinos-Regular.ttf');
    $fontUtamaTebal = $font('Tinos-Bold.ttf');
    $fontKotak = $font('Caladea-Regular.ttf');
    $fontKotakTebal = $font('Caladea-Bold.ttf');
    $fontAlamat = $font('Arimo-Regular.ttf');
@endphp
<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <title>@yield('nama-dokumen') {{ $invoice->invoice_number }}</title>
    <style>
        /* Font mengikuti dokumen Word asli: Times New Roman → Tinos untuk kop, judul, nomor, klien, tabel,
           tanggal & penanda tangan; Cambria → Caladea untuk kedua kotak info; Arial → Arimo untuk alamat
           di kotak alamat. Isi 11pt. Times New Roman & Arial sendiri tidak boleh disertakan di repo
           (lisensi), dan core font DomPDF tidak tertanam sehingga tampilannya bergantung pada penampil PDF. */
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
        @if ($fontKotak)
            @font-face {
                font-family: 'Caladea';
                src: url('{{ $fontKotak }}') format('truetype');
                font-weight: normal;
                font-style: normal;
            }
        @endif
        @if ($fontKotakTebal)
            @font-face {
                font-family: 'Caladea';
                src: url('{{ $fontKotakTebal }}') format('truetype');
                font-weight: bold;
                font-style: normal;
            }
        @endif
        @if ($fontAlamat)
            @font-face {
                font-family: 'Arimo';
                src: url('{{ $fontAlamat }}') format('truetype');
                font-weight: normal;
                font-style: normal;
            }
        @endif

        /* Margin Word 2,54 cm di keempat sisi; header mulai 1 cm dari atas dan setinggi 3,84 cm, sehingga
           teks halaman mulai 4,84 cm dari atas. Kanan 1,6 cm karena tabel Excel invoice di dokumen asli
           selebar 16,86 cm dan melewati margin kanan Word; kop, judul, dan blok nomor/klien tetap selebar
           teks Word (15,92 cm). */
        @page {
            margin: 4.84cm 1.6cm 2.54cm 2.54cm;
        }

        * {
            box-sizing: border-box;
        }

        /* Tinggi baris DomPDF = line-height × (ascender − descender) × font_height_ratio 1,1. Spasi tunggal
           Word (Times New Roman, Cambria, Arial ±1,15 em) = line-height 0,91 untuk Tinos, Caladea, dan
           Arimo (terukur 1,264–1,289 em pada line-height 1). */
        body {
            margin: 0;
            font-family: 'Tinos', times, serif;
            font-size: 11pt;
            line-height: 0.91;
            color: #000;
        }

        .tebal {
            font-weight: bold;
        }

        /* Kop = header Word, diulang di setiap halaman. Logo 1,99 × 2,41 cm di belakang teks; nama, bidang
           usaha, dan alamat rata tengah di kanan logo (teks Word mengalir di samping logo, jarak 0,32 cm),
           baris kontak sudah di bawah logo sehingga rata tengah selebar teks, lalu satu garis ganda selebar
           teks di bawah baris kosong. */
        .kop {
            position: fixed;
            top: -3.84cm;
            left: 0;
            width: 15.92cm;
            height: 3.84cm;
        }

        .kop .logo {
            position: absolute;
            left: 0;
            top: -0.09cm;
            width: 1.99cm;
            height: 2.41cm;
        }

        .kop .teks {
            margin-left: 2.33cm;
            text-align: center;
        }

        .kop .nama {
            padding-top: 2.05pt;
            font-size: 20pt;
            font-weight: bold;
        }

        .kop .bidang {
            padding-top: 2.05pt;
            font-weight: bold;
        }

        .kop .alamat,
        .kop .kontak {
            padding-top: 2.4pt;
            font-size: 10pt;
        }

        .kop .kontak {
            text-align: center;
        }

        /* Baris kosong 10pt + 1pt jarak, lalu garis ganda (2 × 0,75pt). */
        .kop .garis {
            height: 14.9pt;
            border-bottom: 3px double #000;
        }

        /* Judul 14pt tebal dengan spasi 1,15 baris, di tengah lebar teks Word. */
        .judul {
            width: 15.92cm;
            text-align: center;
            font-size: 14pt;
            font-weight: bold;
            line-height: 1.045;
        }

        /* Satu baris kosong di bawah judul; titik dua di tab 5,08 cm seperti di Word, alamat klien di kolom
           nilai. */
        table.meta {
            width: 15.92cm;
            margin-top: 12.65pt;
            border-collapse: collapse;
        }

        table.meta td {
            padding: 0;
            vertical-align: top;
        }

        table.meta td.label {
            width: 5.08cm;
        }

        table.meta td.titik {
            width: 0.22cm;
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

        /* Dua kotak teks Word setinggi 2,75 cm berdampingan: alamat 7,6 cm di kiri, rekening 8,66 cm di
           kanannya. Sel di baris yang sama, jadi keduanya tetap sama tinggi bila isinya lebih panjang. DomPDF
           menghitung lebar & tinggi sel tanpa padding (0,25 cm kiri-kanan, 0,13 cm atas-bawah), jadi ukuran
           di sini = ukuran kotak dikurangi padding. */
        table.info {
            width: 16.42cm;
            margin-top: 0.9cm;
            border-collapse: collapse;
            page-break-inside: avoid;
        }

        table.info td.kotak {
            height: 2.49cm;
            border: 0.5pt solid #000;
            padding: 0.13cm 0.25cm;
            vertical-align: top;
            font-family: 'Caladea', 'Tinos', serif;
        }

        table.info td.sela {
            width: 0.16cm;
        }

        table.info .arial {
            font-family: 'Arimo', helvetica, sans-serif;
            font-size: 10pt;
        }

        /* Nama bank berspasi 1,1 baris (gaya "Amount" di dokumen asli); nomor rekening 10pt. */
        table.info .bank {
            font-weight: bold;
            line-height: 1;
        }

        table.info .rekening-lain {
            margin-top: 12.9pt;
        }

        table.info .nomor-rekening {
            font-size: 10pt;
            color: #171518;
        }

        .tanda-tangan {
            margin-top: 0.82cm;
            page-break-inside: avoid;
        }

        /* Ruang tanda tangan = tujuh baris kosong di dokumen asli. Gambar tanda tangan (dokumen asli: tanda
           tangan + cap logo 4,59 × 3,76 cm, 0,46 cm dari kiri) mulai di samping tanggal dan sedikit menimpa
           nama; nama & jabatan tetap tercetak di atasnya. Stempel yang diunggah terpisah ditumpuk di atas
           tanda tangan. */
        .tanda-tangan .ttd {
            position: relative;
            height: 3.12cm;
        }

        .tanda-tangan .ttd img {
            position: absolute;
            left: 0.46cm;
            top: -0.31cm;
            height: 3.76cm;
            max-width: 4.59cm;
        }

        .tanda-tangan .ttd img.stempel {
            left: 1.2cm;
            top: 0;
            height: 3.3cm;
        }

        .tanda-tangan .nama,
        .tanda-tangan .jabatan {
            position: relative;
        }

        .tanda-tangan .nama {
            font-weight: bold;
            text-decoration: underline;
        }
    </style>
</head>

<body>
    <div class="kop">
        @if ($logo = $aset('logo.png'))
            <img class="logo" src="{{ $logo }}" alt="Logo PT Bahtera Cipta Bersama">
        @endif
        <div class="teks">
            <div class="nama">{{ $namaPerusahaan }}</div>
            <div class="bidang">Stevedoring Company</div>
            @if (filled($company['address']))
                <div class="alamat">{!! nl2br(e($company['address'])) !!}</div>
            @endif
        </div>
        @if ($kontak)
            <div class="kontak">{{ implode(' ', $kontak) }}</div>
        @endif
        <div class="garis"></div>
    </div>

    <div class="judul">@yield('judul')</div>

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
            <tr>
                <td class="label"></td>
                <td class="titik"></td>
                <td>{!! nl2br(e($client->address)) !!}</td>
            </tr>
        @endif
        @if (filled($perhatian))
            <tr>
                <td class="label">ATTENTION</td>
                <td class="titik">:</td>
                <td>{{ $perhatian }}</td>
            </tr>
        @endif
        <tr>
            <td class="label">TERM PAYMENT</td>
            <td class="titik">:</td>
            <td>Telegraphic Transfer (T/T)</td>
        </tr>
        @if ($kursDiBlokKlien)
            <tr>
                <td class="label">Exchange Rate</td>
                <td class="titik">:</td>
                <td>Rp {{ $angka($invoice->exchange_rate) }},-</td>
            </tr>
            @if ($tarifUsd->count() === 1)
                <tr>
                    <td class="label">Rate Stevedoring $</td>
                    <td class="titik">:</td>
                    <td>{{ $angka($tarifUsd->first(), 'USD') }} $</td>
                </tr>
                <tr>
                    <td class="label">Rate Stevedoring Rp</td>
                    <td class="titik">:</td>
                    <td>{{ $angka($invoice->exchange_rate) }} x {{ $angka($tarifUsd->first(), 'USD') }} $ = Rp {{ $angka(round($tarifUsd->first() * (float) $invoice->exchange_rate, 2)) }}</td>
                </tr>
            @endif
        @endif
    </table>

    @yield('tabel')

    <table class="info">
        <tr>
            <td class="kotak" style="width: 7.1cm;">
                <div class="tebal">{{ $namaPerusahaan }}</div>
                @if (filled($company['address']))
                    <div class="arial">{!! nl2br(e($company['address'])) !!}</div>
                @endif
                @if (filled($company['phone']))
                    <div class="tebal">Telepon: {{ $company['phone'] }}</div>
                @endif
            </td>
            <td class="sela"></td>
            <td class="kotak" style="width: 8.16cm;">
                @foreach ($company['bank_accounts'] ?? [] as $rekening)
                    <div class="bank{{ $loop->first ? '' : ' rekening-lain' }}">{{ $rekening['bank'] }}</div>
                    <div><span class="tebal">An</span>. <span class="tebal">{{ $rekening['account_name'] }}</span></div>
                    @if (($rekening['currency'] ?? 'IDR') !== 'IDR')
                        {{-- Rekening valas seperti dokumen AVRA: nomor bermata uang, cabang, dan Swift untuk transfer luar negeri. --}}
                        <div>Bank Account No: {{ $rekening['account_number'] }} ({{ $rekening['currency'] }})</div>
                    @else
                        <div>Nomor rekening bank: <span class="nomor-rekening">{{ $rekening['account_number'] }}</span></div>
                    @endif
                    @if (filled($rekening['branch'] ?? null))
                        <div>Bank Branch Name: {{ $rekening['branch'] }}</div>
                    @endif
                    @if (filled($rekening['swift'] ?? null))
                        <div>Swift Code: {{ $rekening['swift'] }}</div>
                    @endif
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
        <div class="jabatan">{{ $penandaTangan['position'] }}</div>
    </div>
</body>

</html>
