{{--
    Kerangka dokumen PT Nusantara Armada Indonesia (NAI), dipakai invoice.blade.php. Ditiru dari invoice Word
    NAI terbaru (176 … FINAL FLOATING CRANE …, dokumen Word salinan dokumen PT AOE/PT MKB: sisa teks alamat
    MKB masih ada di balik kotak alamatnya). Seperti AOE tanpa kop surat: logo di header Word (diulang di
    setiap halaman) dan judul di kotak bergaris di kanannya; bedanya logo NAI lebih besar sehingga teks mulai
    lebih rendah, blok klien bercampur Times New Roman & Calibri, kotak alamat & rekening ber-Calibri, dan
    gambar tanda tangan asli sudah memuat nama & jabatan. Di sini: logo, kotak judul, blok nomor/perihal/klien
    (+ kurs & tarif USD), kotak alamat & rekening, kota-tanggal, dan penanda tangan. Data perusahaan dibaca
    dari Pengaturan › Profil perusahaan ($company: nama, alamat, telepon, rekening, kota & penanda tangan;
    baris baru di Alamat ikut tercetak).
    Dokumen pengisi menyediakan bagian:
      nama-dokumen  judul tab PDF ("Invoice")
      judul         teks di kotak judul
      gaya          CSS tabel item & baris total
      tabel         tabel item & baris total ($baris_total, InvoiceTotalRows)
    Logo: logo.jpg di folder ini ($aset('logo.jpg'), dari dokumen Word, 222×195 px). Font di fonts/: Tinos
    (pengganti Times New Roman, nomor, perihal & alamat klien), Carlito (pengganti Calibri, judul, blok klien
    lainnya, baris total, kotak info, tanda tangan), dan Arimo (pengganti Arial, tabel item), semuanya
    berukuran identik dengan aslinya.
    Gambar tanda tangan & stempel dari upload Profil perusahaan ($tanda_tangan, $stempel); tidak disimpan
    di repo (repo publik). Kosong = ruang tanda tangan basah.
--}}
@php
    // Nama perusahaan di kotak alamat selalu huruf kapital, apa pun penulisan di profil.
    $namaPerusahaan = mb_strtoupper((string) $company['name']);
    $penandaTangan = $company['signature'];
    $tanggal = $invoice->issue_date?->copy()->locale('id')->translatedFormat('j F Y');
    // Tagihan Rupiah bertarif USD (invoice FINAL): kurs & tarif tercetak di blok klien seperti dokumen asli
    // ("RATE DOLLAR : Rp. 18.059,00", "PRICE : 1,20 USD x Rp. 18.059,00 = Rp. 21.670,80"). Tagihan USD
    // mencetak kursnya di baris total (InvoiceTotalRows).
    $rupiah = fn ($nilai) => 'Rp. '.number_format((float) $nilai, 2, ',', '.');
    $tarifUsd = $items->pluck('foreign_unit_price')->filter(fn ($tarif) => $tarif !== null)->map(fn ($tarif) => (float) $tarif)->unique()->values();
    $kursDiBlokKlien = $invoice->exchange_rate !== null && ! $invoice->isForeign() && $tarifUsd->isNotEmpty();
    $font = fn (string $file) => \App\Services\CompanyInvoiceTemplate::path('fonts/'.$file);
    $fontTimes = $font('Tinos-Regular.ttf');
    $fontTimesTebal = $font('Tinos-Bold.ttf');
    $fontCalibri = $font('Carlito-Regular.ttf');
    $fontCalibriTebal = $font('Carlito-Bold.ttf');
    $fontArial = $font('Arimo-Regular.ttf');
@endphp
<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <title>@yield('nama-dokumen') {{ $invoice->invoice_number }}</title>
    <style>
        /* Font mengikuti dokumen Word asli: Times New Roman → Tinos untuk nomor, perihal & alamat klien;
           Calibri → Carlito untuk judul, baris TO/ATTENTION/TERM PAYMENT, baris total, kedua kotak info,
           tanggal & penanda tangan (Calibri Light di dokumen asli juga Carlito: tidak ada padanan bebasnya);
           Arial → Arimo untuk tabel item. Times New Roman, Calibri & Arial sendiri tidak boleh disertakan di
           repo (lisensi), dan core font DomPDF tidak tertanam sehingga tampilannya bergantung pada penampil
           PDF. */
        @if ($fontTimes)
            @font-face {
                font-family: 'Tinos';
                src: url('{{ $fontTimes }}') format('truetype');
                font-weight: normal;
                font-style: normal;
            }
        @endif
        @if ($fontTimesTebal)
            @font-face {
                font-family: 'Tinos';
                src: url('{{ $fontTimesTebal }}') format('truetype');
                font-weight: bold;
                font-style: normal;
            }
        @endif
        @if ($fontCalibri)
            @font-face {
                font-family: 'Carlito';
                src: url('{{ $fontCalibri }}') format('truetype');
                font-weight: normal;
                font-style: normal;
            }
        @endif
        @if ($fontCalibriTebal)
            @font-face {
                font-family: 'Carlito';
                src: url('{{ $fontCalibriTebal }}') format('truetype');
                font-weight: bold;
                font-style: normal;
            }
        @endif
        @if ($fontArial)
            @font-face {
                font-family: 'Arimo';
                src: url('{{ $fontArial }}') format('truetype');
                font-weight: normal;
                font-style: normal;
            }
        @endif

        /* Margin Word 2,54 cm. Logo header NAI (sampai 3,72 cm) mendorong teks halaman turun: "Nomor" mulai
           4,62 cm dari atas, jadi halaman langsung mulai di situ (logo & kotak judul ditaruh di atasnya).
           Kanan 2,4 cm karena tabel Excel di dokumen asli selebar 16,06 cm dan sedikit melewati margin kanan
           Word; blok nomor/klien tetap selebar teks Word (15,92 cm). */
        @page {
            margin: 4.62cm 2.4cm 2.54cm 2.54cm;
        }

        * {
            box-sizing: border-box;
        }

        /* Tinggi baris DomPDF = line-height × (ascender − descender + line gap) × font_height_ratio 1,1. Spasi
           tunggal Word (Times New Roman & Arial 1,15 em, Calibri 1,22 em) = line-height 0,91 untuk Tinos,
           Arimo, dan Carlito. */
        body {
            margin: 0;
            font-family: 'Carlito', helvetica, sans-serif;
            font-size: 12pt;
            line-height: 0.91;
            color: #000;
        }

        .tebal {
            font-weight: bold;
        }

        /* Logo = header Word, diulang di setiap halaman: 3,29 × 2,89 cm, 0,83 cm dari atas dan 0,79 cm di
           kanan margin kiri. */
        .logo {
            position: fixed;
            top: -3.79cm;
            left: 0.79cm;
            width: 3.29cm;
            height: 2.89cm;
        }

        /* Judul dalam kotak bergaris (tabel melayang di Word, 9,42 cm dari tepi kertas dan 1,94 cm dari atas,
           sama dengan AOE), hanya di halaman pertama. */
        .kepala-judul {
            position: absolute;
            top: -2.68cm;
            left: 6.88cm;
        }

        table.judul {
            width: 5.58cm;
            border-collapse: collapse;
        }

        /* Kotak 1,08 cm; garis dasar judul 0,76 cm di bawah tepi atas kotak (0,17 cm lebih rendah dari AOE). */
        table.judul td {
            height: 0.88cm;
            border: 0.5pt solid #000;
            padding: 0.17cm 0.19cm 0;
            text-align: center;
            vertical-align: top;
            font-family: 'Carlito', helvetica, sans-serif;
            font-size: 22pt;
            font-weight: bold;
            line-height: 0.7;
            letter-spacing: 0.2pt;
        }

        /* Titik dua di tab 5,5 cm seperti di Word, alamat klien di kolom nilai. Nomor & Perihal Times New Roman
           12pt (nilai Nomor dan seluruh baris Perihal tebal), TO Calibri 12pt, alamat klien Times New Roman
           tebal, ATTENTION dan baris di bawahnya Calibri 11pt. */
        table.meta {
            width: 15.92cm;
            border-collapse: collapse;
        }

        table.meta td {
            padding: 0;
            vertical-align: top;
        }

        table.meta td.label {
            width: 5.5cm;
        }

        table.meta td.titik {
            width: 0.22cm;
        }

        table.meta tr.times td {
            font-family: 'Tinos', times, serif;
        }

        table.meta tr.kecil td {
            font-size: 11pt;
        }

        @yield('gaya')

        /* Dua kotak teks Word setinggi 2,75 cm berdampingan: alamat 7,6 cm (0,09 cm keluar margin kiri),
           rekening 8,01 cm 0,25 cm di kanannya, mulai 1,1 cm di bawah baris total terakhir. Sel di baris yang
           sama, jadi keduanya tetap sama tinggi bila isinya lebih panjang. DomPDF menghitung lebar & tinggi sel
           tanpa padding (0,25 cm kiri-kanan; 0,13 cm atas-bawah ditambah jarak baris Calibri yang Word taruh
           di atas teks), jadi ukuran di sini = ukuran kotak dikurangi padding; sela & lebar tabel diukur ulang
           dari render agar tepi kotak jatuh di posisi dokumen asli. */
        table.info {
            width: 15.8cm;
            margin-top: 1.1cm;
            margin-left: -0.09cm;
            border-collapse: collapse;
            page-break-inside: avoid;
        }

        table.info td.kotak {
            height: 2.45cm;
            border: 0.5pt solid #000;
            padding: 0.17cm 0.25cm 0.13cm;
            vertical-align: top;
        }

        table.info td.sela {
            width: 0.19cm;
        }

        table.info .bank {
            font-size: 11pt;
        }

        table.info .rekening-lain {
            margin-top: 12pt;
        }

        /* Garis dasar kota-tanggal 1,6 cm di bawah kotak info. */
        .tanda-tangan {
            position: relative;
            margin-top: 1.13cm;
            page-break-inside: avoid;
        }

        /* Gambar tanda tangan dokumen asli (tanda tangan + cap logo + meterai + nama & jabatan) 5,74 × 3,55 cm,
           0,48 cm keluar margin kiri dan tepat di bawah tanggal. Nama & jabatan dari profil dicetak di posisi
           nama pada gambar itu dan gambar ditumpuk di atasnya: gambar yang sama = persis dokumen asli, gambar
           transparan tanpa nama tetap memperlihatkan nama, tanpa gambar = ruang tanda tangan basah. Stempel
           yang diunggah terpisah ditumpuk di atas tanda tangan. */
        .tanda-tangan .penanda {
            width: 5cm;
            margin-top: 2.3cm;
            margin-left: -0.71cm;
            text-align: center;
        }

        .tanda-tangan .nama {
            font-weight: bold;
            text-decoration: underline;
        }

        .tanda-tangan img {
            position: absolute;
            left: -0.48cm;
            top: 0.66cm;
            height: 3.55cm;
            max-width: 5.74cm;
        }

        .tanda-tangan img.stempel {
            left: 0.72cm;
        }
    </style>
</head>

<body>
    @if ($logo = $aset('logo.jpg'))
        <img class="logo" src="{{ $logo }}" alt="Logo PT Nusantara Armada Indonesia">
    @endif

    <div class="kepala-judul">
        <table class="judul">
            <tr>
                <td>@yield('judul')</td>
            </tr>
        </table>
    </div>

    <table class="meta">
        <tr class="times">
            <td class="label">Nomor</td>
            <td class="titik">:</td>
            <td class="tebal">{{ $invoice->invoice_number ?? '-' }}</td>
        </tr>
        @if (filled($invoice->subject))
            <tr class="times tebal">
                <td class="label">Perihal</td>
                <td class="titik">:</td>
                <td>{{ $invoice->subject }}</td>
            </tr>
        @endif
        <tr>
            <td class="label">TO</td>
            <td class="titik">:</td>
            <td>{{ $client->name }}</td>
        </tr>
        @if (filled($client->address))
            <tr class="times tebal">
                <td class="label"></td>
                <td class="titik"></td>
                <td>{!! nl2br(e($client->address)) !!}</td>
            </tr>
        @endif
        @if (filled($perhatian))
            <tr class="kecil">
                <td class="label">ATTENTION</td>
                <td class="titik">:</td>
                <td>{{ $perhatian }}</td>
            </tr>
        @endif
        <tr class="kecil">
            <td class="label">TERM PAYMENT</td>
            <td class="titik">:</td>
            <td>Telegraphic Transfer (T/T)</td>
        </tr>
        @if ($kursDiBlokKlien)
            <tr class="kecil">
                <td class="label">RATE DOLLAR</td>
                <td class="titik">:</td>
                <td>{{ $rupiah($invoice->exchange_rate) }}</td>
            </tr>
            @if ($tarifUsd->count() === 1)
                <tr class="kecil">
                    <td class="label">PRICE</td>
                    <td class="titik">:</td>
                    <td>{{ \App\Services\InvoiceTotalRows::format($tarifUsd->first(), 'USD', 4) }} USD x {{ $rupiah($invoice->exchange_rate) }} = {{ $rupiah(round($tarifUsd->first() * (float) $invoice->exchange_rate, 2)) }}</td>
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
                    <div>{!! nl2br(e($company['address'])) !!}</div>
                @endif
                @if (filled($company['phone']))
                    <div>Telepon: {{ $company['phone'] }}</div>
                @endif
            </td>
            <td class="sela"></td>
            <td class="kotak" style="width: 7.51cm;">
                @foreach ($company['bank_accounts'] ?? [] as $rekening)
                    <div class="bank{{ $loop->first ? '' : ' rekening-lain' }}">{{ $rekening['bank'] }}</div>
                    <div>An. <span class="tebal">{{ $rekening['account_name'] }}</span></div>
                    @if (($rekening['currency'] ?? 'IDR') !== 'IDR')
                        {{-- Rekening valas: nomor bermata uang, cabang, dan Swift untuk transfer luar negeri. --}}
                        <div>Bank Account No: {{ $rekening['account_number'] }} ({{ $rekening['currency'] }})</div>
                    @else
                        <div>Nomor rekening bank: {{ $rekening['account_number'] }}</div>
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
        <div class="penanda">
            <div><span class="nama">{{ $penandaTangan['name'] }}</span></div>
            <div class="jabatan">{{ $penandaTangan['position'] }}</div>
        </div>
        @if ($tanda_tangan)
            <img src="{{ $tanda_tangan }}" alt="Tanda tangan">
        @endif
        @if ($stempel)
            <img class="stempel" src="{{ $stempel }}" alt="Stempel">
        @endif
    </div>
</body>

</html>
