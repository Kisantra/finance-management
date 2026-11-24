{{--
    Kerangka dokumen PT Abdi Ocean Energy (AOE) — dipakai bersama invoice.blade.php dan debit-note.blade.php,
    karena dokumen Word AOE (INVOICE FINAL … (DENGAN PPN DAN PPH).docx, DEBIT NOTE … (TANPA PPN DAN PPH).docx)
    hanya berbeda judul dan tabel itemnya. Dokumen AOE turunan dokumen Word PT MKB (tabel Excel, kotak alamat &
    rekening, dan tanda tangan sama), tetapi tanpa kop surat: header Word hanya berisi logo, dan judul ada di
    kotak bergaris di kanannya seperti dokumen PT BAS. Di sini: logo (diulang di setiap halaman), kotak judul,
    blok nomor/perihal/klien, kotak alamat & rekening, kota-tanggal, dan penanda tangan. Data perusahaan dibaca
    dari Pengaturan › Profil perusahaan ($company: nama, alamat, telepon, rekening, kota & penanda tangan; baris
    baru di Alamat ikut tercetak).
    Dokumen pengisi menyediakan bagian:
      nama-dokumen  judul tab PDF ("Invoice", "Debit Note")
      judul         teks di kotak judul
      gaya          CSS tabel item & baris total
      tabel         tabel item & baris total ($baris_total, InvoiceTotalRows)
    dan boleh menyetel $lebarTabel (cm, bawaan selebar area cetak 16,86 cm) bila tabel itemnya lebih sempit:
    kotak alamat & rekening mengikuti lebar itu supaya tepi kanannya sejajar dengan tabel.
    Logo: logo.png di folder ini ($aset('logo.png'), diambil dari dokumen Word, 287×275 px). Font di fonts/:
    Tinos (pengganti Times New Roman, teks dokumen), Carlito (pengganti Calibri, judul), Caladea (pengganti
    Cambria, kedua kotak info), dan Arimo (pengganti Arial, alamat di kotak alamat), semuanya berukuran identik
    dengan aslinya.
    Gambar tanda tangan & stempel dari upload Profil perusahaan ($tanda_tangan, $stempel); tidak disimpan
    di repo (repo publik). Kosong = ruang tanda tangan basah.
--}}
@php
    // Nama perusahaan di kotak alamat selalu huruf kapital, apa pun penulisan di profil.
    $namaPerusahaan = mb_strtoupper((string) $company['name']);
    $penandaTangan = $company['signature'];
    $tanggal = $invoice->issue_date?->copy()->locale('id')->translatedFormat('j F Y');
    $font = fn (string $file) => \App\Services\CompanyInvoiceTemplate::path('fonts/'.$file);
    $fontUtama = $font('Tinos-Regular.ttf');
    $fontUtamaTebal = $font('Tinos-Bold.ttf');
    $fontJudul = $font('Carlito-Bold.ttf');
    $fontKotak = $font('Caladea-Regular.ttf');
    $fontKotakTebal = $font('Caladea-Bold.ttf');
    $fontAlamat = $font('Arimo-Regular.ttf');
    // Kotak alamat & rekening selebar tabel item, dibagi seperti dokumen Word (alamat 7,6 : rekening 8,96,
    // sela 0,17 cm). DomPDF tidak menghitung padding (0,25 cm kiri-kanan) maupun garis kotak (0,5 pt kiri-kanan)
    // dalam lebar sel, jadi lebar sel = lebar kotak − 0,54 cm; tanpa itu tepi kanan kotak menjorok ±0,08 cm.
    $lebarInfo = (float) ($lebarTabel ?? 16.86);
    $lebarAlamat = round(($lebarInfo - 0.17) * 7.6 / 16.56 - 0.54, 2);
    $lebarRekening = round(($lebarInfo - 0.17) * 8.96 / 16.56 - 0.54, 2);
@endphp
<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <title>@yield('nama-dokumen') {{ $invoice->invoice_number }}</title>
    <style>
        /* Font mengikuti dokumen Word asli: Times New Roman → Tinos untuk nomor, klien, tabel, tanggal &
           penanda tangan; Calibri → Carlito untuk judul; Cambria → Caladea untuk kedua kotak info; Arial →
           Arimo untuk alamat di kotak alamat. Isi 11pt. Times New Roman, Calibri & Arial sendiri tidak boleh
           disertakan di repo (lisensi), dan core font DomPDF tidak tertanam sehingga tampilannya bergantung
           pada penampil PDF. */
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

        /* Margin Word 2,54 cm di keempat sisi. Teks Word mulai 2,54 cm dari atas, lalu dua baris kosong di
           samping kotak judul sebelum "Nomor" (3,43 cm); di sini halaman langsung mulai di 3,43 cm agar teks
           halaman berikutnya tidak menimpa logo header (sampai 3,2 cm). Kanan 1,6 cm karena tabel Excel invoice
           di dokumen asli selebar 16,86 cm dan melewati margin kanan Word; blok nomor/klien tetap selebar teks
           Word (15,92 cm). */
        @page {
            margin: 3.43cm 1.6cm 2.54cm 2.54cm;
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

        /* Logo = header Word (mulai 1 cm dari atas), diulang di setiap halaman: 2,39 × 2,29 cm, 0,28 cm keluar
           margin kiri dan 0,09 cm di atas paragraf header. */
        .logo {
            position: fixed;
            top: -2.52cm;
            left: -0.28cm;
            width: 2.39cm;
            height: 2.29cm;
        }

        /* Judul dalam kotak bergaris (tabel melayang di Word, 9,42 cm dari tepi kertas dan 1,94 cm dari atas),
           hanya di halaman pertama. */
        .kepala-judul {
            position: absolute;
            top: -1.49cm;
            left: 6.88cm;
        }

        table.judul {
            width: 5.58cm;
            border-collapse: collapse;
        }

        /* Teks rata atas seperti sel Word; line-height 0,7 menaruh garis dasar 0,59 cm di bawah tepi atas
           kotak (sama dengan kotak judul PT BAS, gaya Word yang sama). */
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

        /* Titik dua di tab 5,25 cm seperti di Word, alamat klien di kolom nilai. Di dokumen asli titik dua
           Nomor & TO tidak tebal, sedangkan seluruh baris Perihal tebal. */
        table.meta {
            width: 15.92cm;
            border-collapse: collapse;
        }

        table.meta td {
            padding: 0;
            vertical-align: top;
        }

        table.meta td.label {
            width: 5.25cm;
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

        /* Dua kotak teks Word setinggi 2,75 cm berdampingan (alamat di kiri, rekening di kanan, sela 0,17 cm),
           mulai 1,37 cm di bawah baris total terakhir (baris kosong tabel Excel + satu baris). Lebarnya mengikuti
           tabel item ($lebarInfo; di dokumen Word 16,73 cm sehingga kotak rekening menjorok melewati tabel Debit
           Note yang 15,54 cm). Sel di baris yang sama, jadi keduanya tetap sama tinggi bila isinya lebih panjang.
           DomPDF menghitung lebar & tinggi sel tanpa padding (0,25 cm kiri-kanan, 0,13 cm atas-bawah), jadi
           ukuran sel = ukuran kotak dikurangi padding. */
        table.info {
            width: {{ $lebarInfo }}cm;
            margin-top: 1.37cm;
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
            width: 0.17cm;
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

        /* Kota-tanggal tiga baris kosong di bawah kotak (yang menutup baris-baris sisa di dokumen asli). */
        .tanda-tangan {
            margin-top: 0.8cm;
            page-break-inside: avoid;
        }

        /* Ruang tanda tangan = enam baris kosong di dokumen asli. Gambar (tanda tangan + stempel + meterai
           seperti dokumen asli) 4,79 × 2,15 cm, 0,26 cm di bawah tanggal. Stempel yang diunggah terpisah
           ditumpuk di atas tanda tangan. */
        .tanda-tangan .ttd {
            position: relative;
            height: 2.68cm;
        }

        .tanda-tangan .ttd img {
            position: absolute;
            left: 0;
            top: 0.26cm;
            height: 2.15cm;
            max-width: 4.79cm;
        }

        .tanda-tangan .ttd img.stempel {
            left: 1.2cm;
        }

        .tanda-tangan .nama {
            font-weight: bold;
            text-decoration: underline;
        }
    </style>
</head>

<body>
    @if ($logo = $aset('logo.png'))
        <img class="logo" src="{{ $logo }}" alt="Logo PT Abdi Ocean Energy">
    @endif

    <div class="kepala-judul">
        <table class="judul">
            <tr>
                <td>@yield('judul')</td>
            </tr>
        </table>
    </div>

    <table class="meta">
        <tr>
            <td class="label tebal">Nomor</td>
            <td class="titik">:</td>
            <td class="tebal">{{ $invoice->invoice_number ?? '-' }}</td>
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
            <td class="titik">:</td>
            <td class="tebal">{{ $client->name }}</td>
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
    </table>

    @yield('tabel')

    <table class="info">
        <tr>
            <td class="kotak" style="width: {{ $lebarAlamat }}cm;">
                <div class="tebal">{{ $namaPerusahaan }}</div>
                @if (filled($company['address']))
                    <div class="arial">{!! nl2br(e($company['address'])) !!}</div>
                @endif
                @if (filled($company['phone']))
                    <div class="tebal">Telepon: {{ $company['phone'] }}</div>
                @endif
            </td>
            <td class="sela"></td>
            <td class="kotak" style="width: {{ $lebarRekening }}cm;">
                @foreach ($company['bank_accounts'] ?? [] as $rekening)
                    <div class="bank{{ $loop->first ? '' : ' rekening-lain' }}">{{ $rekening['bank'] }}</div>
                    <div><span class="tebal">An</span>. <span class="tebal">{{ $rekening['account_name'] }}</span></div>
                    @if (($rekening['currency'] ?? 'IDR') !== 'IDR')
                        {{-- Rekening valas: nomor bermata uang, cabang, dan Swift untuk transfer luar negeri. --}}
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
