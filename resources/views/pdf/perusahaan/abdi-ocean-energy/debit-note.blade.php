{{--
    Debit Note PT Abdi Ocean Energy (AOE): menagih kembali biaya yang AOE bayar lebih dulu atas nama klien
    (talangan, mis. PNBP jasa/alat). Ditiru dari DEBIT NOTE … (TANPA PPN DAN PPH).docx AOE: logo, kotak judul,
    blok klien, kotak alamat & rekening, dan tanda tangan sama dengan invoice (kerangka.blade.php); judulnya
    DEBIT NOTE dan tabelnya bergaya tabel Excel tersemat di dokumen asli — judul kolom kapital (NO · KETERANGAN ·
    TOTAL (Rp)) tebal hitam di atas biru tua, tabel selebar 15,54 cm, setiap baris keterangan satu baris Excel,
    nominal ber-",00", dan baris akhir "Total Debit Note" (bukan GRAND TOTAL).
    Kolom QUANTITY & PRICE hanya muncul bila ada item ber-qty selain 1 (mis. 3 hari × tarif harian); tagihan
    sekali bayar cukup NO · KETERANGAN · TOTAL, seperti dokumen asli. Rincian (kode billing, NTPN, kapal) ditulis
    di keterangan item, satu per baris.
    Item Debit Note selalu talangan (tanpa PPN/PPh), jadi baris total hanya Total Debit Note (atau tagihan uang
    muka/pelunasan). Adanya berkas ini membuat AOE bisa memilih jenis dokumen Debit Note di editor
    (CompanyInvoiceTemplate::supportsDebitNote()).
--}}
@extends('pdf.perusahaan.abdi-ocean-energy.kerangka')

@php
    $qty = fn ($value) => rtrim(rtrim(number_format((float) $value, 3, ',', '.'), '0'), ',');
    // Format akuntansi tabel Excel Debit Note asli: "Rp" rata kiri, angka rata kanan, Rupiah selalu dua desimal.
    $angka = fn ($value, $mataUang) => $mataUang === \App\Models\Invoice::CURRENCY_IDR
        ? number_format((float) $value, 2, ',', '.')
        : \App\Services\InvoiceTotalRows::format($value, $mataUang, 4);
    $uang = fn ($value, $mataUang = 'IDR') => '<table class="uang"><tr><td class="rp">'.\App\Services\InvoiceTotalRows::symbol($mataUang).'</td><td class="angka">'.$angka($value, $mataUang).'</td></tr></table>';

    $units = $items->pluck('unit')->filter()->unique()->values();
    $sharedUnit = $units->count() === 1 ? $units->first() : null;
    $rinci = $items->contains(fn ($item) => (float) $item->quantity !== 1.0);
    $kolom = $rinci ? 5 : 3;
    // Harga per unit bertarif USD: USD di tagihan USD, Rupiah hasil kurs di tagihan Rupiah.
    $harga = fn ($item) => match (true) {
        $item->foreign_unit_price === null => $uang($item->unit_price),
        $invoice->isForeign() => $uang($item->foreign_unit_price, 'USD'),
        default => $uang(round((float) $item->foreign_unit_price * (float) $invoice->exchange_rate, 2)),
    };
    $hargaUsd = $invoice->isForeign() && $items->isNotEmpty() && $items->every(fn ($item) => $item->foreign_unit_price !== null);
    // Dokumen asli menutup tabel dengan "Total Debit Note", bukan GRAND TOTAL; tagihan USD menyebut totalnya
    // dalam Rupiah sebelum TOTAL OUTSTANDING (USD).
    $labelTotal = fn (array $baris) => match (true) {
        $baris['jenis'] === 'total' => 'Total Debit Note',
        $baris['label'] === 'GRAND TOTAL' && $invoice->isForeign() => 'Total Debit Note (IDR)',
        $baris['label'] === 'GRAND TOTAL' => 'Total Debit Note',
        default => $baris['label'],
    };
@endphp

@section('nama-dokumen', 'Debit Note')

@section('judul', 'DEBIT NOTE')

@section('gaya')
        /* Judul Debit Note di dokumen asli tanpa jarak huruf tambahan. */
        table.judul td {
            letter-spacing: 0;
        }

        .items-table,
        .totals-table {
            width: 15.54cm;
            border-collapse: collapse;
        }

        /* Tiga baris kosong antara TERM PAYMENT dan tabel. */
        .items-table {
            margin-top: 37.95pt;
        }

        /* Baris tabel Excel setinggi 14,7pt; judul kolom Times New Roman 11pt tebal, hitam di atas biru tua
           (Text 2 tema Office 2023, 25% lebih terang), bergaris tunggal. */
        .items-table th {
            height: 0.46cm;
            background-color: #215f9a;
            color: #000;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            padding: 0 0.08cm;
            border: 1px solid #000;
        }

        .items-table td,
        .totals-table td {
            border: 1px solid #000;
            padding: 0.02cm 0.08cm;
            vertical-align: middle;
        }

        /* Nama item dan setiap baris keterangan = satu baris Excel 14,7pt (line-height 1,06 untuk Tinos 11pt). */
        .items-table td.keterangan {
            padding: 0 0.08cm;
            line-height: 1.06;
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

        /* Gaya baris total per jenis (InvoiceTotalRows). Total Debit Note (baris tagihan) tebal, label rata
           kiri, bergaris tunggal seperti dokumen asli. */
        .totals-table tr.baris-total td,
        .totals-table tr.baris-tagihan td {
            font-weight: bold;
        }

        /* Tagihan USD: TOTAL OUTSTANDING (USD) — utang klien — tebal, di tengah, garis bawah ganda. */
        .totals-table tr.baris-tagihan_usd td {
            font-weight: bold;
            border-bottom: 3px double #000;
        }

        .totals-table tr.baris-tagihan_usd td.label {
            text-align: center;
        }

        .totals-table tr.baris-diterima td.c-total {
            color: #ff0000;
        }

        /* Lebar kolom tabel Excel asli: NO 11,8% dan TOTAL 23% tetap; KETERANGAN mengisi sisanya, atau berbagi
           dengan QUANTITY & PRICE bila kolom itu tampil. QUANTITY selebar judul kapitalnya (2,25 cm); bila lebih
           sempit, DomPDF melebarkan kolom tabel item saja dan baris total tidak lagi sejajar. */
        .c-no {
            width: 11.8%;
            text-align: center;
        }

        .c-ket {
            width: 65.2%;
        }

        .rinci .c-ket {
            width: 30.2%;
        }

        .c-qty {
            width: 15%;
            text-align: center;
        }

        .c-price {
            width: 20%;
        }

        .c-total {
            width: 23%;
        }
@endsection

@section('tabel')
    <table class="items-table{{ $rinci ? ' rinci' : '' }}">
        <thead>
            <tr>
                <th class="c-no">NO</th>
                <th class="c-ket">KETERANGAN</th>
                @if ($rinci)
                    <th class="c-qty">QUANTITY{{ $sharedUnit ? ' ('.mb_strtoupper($sharedUnit).')' : '' }}</th>
                    <th class="c-price">PRICE{{ $hargaUsd ? ' (USD)' : '' }}</th>
                @endif
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
                    @if ($rinci)
                        <td class="c-qty">{{ $qty($item->quantity) }}{{ $sharedUnit ? '' : ' '.$item->unit }}</td>
                        <td class="c-price">{!! $harga($item) !!}</td>
                    @endif
                    <td class="c-total">{!! $uang($item->amount) !!}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="totals-table{{ $rinci ? ' rinci' : '' }}">
        {{-- Baris ukur tanpa garis: lebar kolom sama persis dengan tabel item di atasnya. --}}
        <tr class="ukur">
            <td class="c-no"></td>
            <td class="c-ket"></td>
            @if ($rinci)
                <td class="c-qty"></td>
                <td class="c-price"></td>
            @endif
            <td class="c-total"></td>
        </tr>
        @foreach ($baris_total as $baris)
            <tr class="baris-{{ $baris['jenis'] }}">
                @if ($baris['nomor'])
                    <td class="c-no">{{ $baris['nomor'] }}</td>
                    <td colspan="{{ $kolom - 2 }}" class="label">{{ $labelTotal($baris) }}</td>
                @else
                    <td colspan="{{ $kolom - 1 }}" class="label">{{ $labelTotal($baris) }}</td>
                @endif
                <td class="c-total">{!! $uang($baris['jumlah'], $baris['mata_uang']) !!}</td>
            </tr>
        @endforeach
    </table>
@endsection
