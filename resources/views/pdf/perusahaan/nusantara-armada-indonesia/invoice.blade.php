{{--
    Template invoice PT Nusantara Armada Indonesia (NAI) — desain STATIS, ditiru dari invoice Word NAI terbaru
    (176 … FINAL FLOATING CRANE …). Logo, kotak judul, blok klien, kotak alamat & rekening, dan tanda tangan
    ada di kerangka.blade.php; di sini judul dan tabel item, yang di dokumen asli berupa tabel Excel tersemat:
    judul kolom Arial 12pt di atas kuning, item Arial, baris total Calibri, potongan PPh 23 merah, baris akhir
    "Total Invoice". Baris total disusun sistem ($baris_total, InvoiceTotalRows) dan di sini hanya ditata per
    jenisnya.
--}}
@extends('pdf.perusahaan.nusantara-armada-indonesia.kerangka')

@php
    $qty = fn ($value) => rtrim(rtrim(number_format((float) $value, 3, ',', '.'), '0'), ',');
    // Angka tanpa "Rp" seperti tabel asli; nominal USD (tagihan USD) diberi kode mata uangnya.
    $uang = fn ($value, $mataUang = 'IDR') => ($mataUang === \App\Models\Invoice::CURRENCY_IDR ? '' : $mataUang.' ').\App\Services\InvoiceTotalRows::format($value, $mataUang, 4);

    $units = $items->pluck('unit')->filter()->unique()->values();
    $sharedUnit = $units->count() === 1 ? $units->first() : null;
    // Harga per unit bertarif USD: USD di tagihan USD, Rupiah hasil kurs ("21.670,80") di tagihan Rupiah.
    $harga = fn ($item) => match (true) {
        $item->foreign_unit_price === null => $uang($item->unit_price),
        $invoice->isForeign() => $uang($item->foreign_unit_price, 'USD'),
        default => $uang(round((float) $item->foreign_unit_price * (float) $invoice->exchange_rate, 2)),
    };
    $hargaUsd = $invoice->isForeign() && $items->isNotEmpty() && $items->every(fn ($item) => $item->foreign_unit_price !== null);
    // Dokumen asli menulis potongan "PPH 23 2%" dan menutup tabel dengan "Total Invoice", bukan GRAND TOTAL;
    // tagihan USD menyebut totalnya dalam Rupiah sebelum TOTAL OUTSTANDING (USD).
    $label = fn (array $baris) => match (true) {
        $baris['jenis'] === 'pph' => str_replace(['PPh', '(', ')'], ['PPH', '', ''], $baris['label']),
        $baris['label'] === 'GRAND TOTAL' && $invoice->isForeign() => 'Total Invoice (IDR)',
        $baris['label'] === 'GRAND TOTAL' => 'Total Invoice',
        default => $baris['label'],
    };
@endphp

@section('nama-dokumen', 'Invoice')

@section('judul', 'I N V O I C E')

@section('gaya')
        .items-table,
        .totals-table {
            width: 100%;
            border-collapse: collapse;
        }

        /* Satu baris kosong Calibri 11pt antara blok klien dan tabel. */
        .items-table {
            margin-top: 15pt;
        }

        /* Judul kolom seperti tabel Excel asli: Arial 12pt, hitam di atas kuning, garis bawah ganda. */
        .items-table th {
            height: 1.19cm;
            background-color: #ffff00;
            color: #000;
            font-family: 'Arimo', helvetica, sans-serif;
            font-weight: normal;
            text-align: center;
            vertical-align: middle;
            padding: 0 0.08cm;
            border: 1px solid #000;
            border-bottom: 3px double #000;
        }

        .items-table td,
        .totals-table td {
            border: 1px solid #000;
            padding: 0 0.08cm;
            vertical-align: middle;
        }

        /* Item: Arial 11pt, setiap baris keterangan satu baris Excel (±15pt); harga & total 12pt. */
        .items-table td {
            font-family: 'Arimo', helvetica, sans-serif;
            font-size: 11pt;
        }

        .items-table td.keterangan {
            line-height: 1.07;
        }

        .items-table td.c-no {
            font-family: 'Carlito', helvetica, sans-serif;
        }

        .items-table td.besar {
            font-size: 12pt;
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

        /* Baris total Calibri 11pt setinggi satu baris Excel (15,3pt). Potongan PPh 23 merah; baris akhir
           bergaris bawah ganda. */
        .totals-table td {
            height: 0.51cm;
            font-size: 11pt;
        }

        .totals-table tr.baris-tagihan td,
        .totals-table tr.baris-tagihan_usd td {
            border-bottom: 3px double #000;
        }

        .totals-table tr.baris-tagihan_usd td {
            font-weight: bold;
        }

        .totals-table tr.baris-pph td.c-total,
        .totals-table tr.baris-diterima td.c-total {
            color: #ff0000;
        }

        /* Lebar kolom tabel Excel asli (16,06 cm). */
        .c-no {
            width: 5.9%;
            text-align: center;
        }

        .c-ket {
            width: 38%;
        }

        .c-qty {
            width: 14.9%;
            text-align: center;
        }

        .c-price {
            width: 15.5%;
            text-align: right;
        }

        .c-total {
            width: 25.7%;
            text-align: right;
        }
@endsection

@section('tabel')
    <table class="items-table">
        <thead>
            <tr>
                <th class="c-no">NO</th>
                <th class="c-ket">Keterangan</th>
                <th class="c-qty">Quantity{{ $sharedUnit ? ' ('.strtoupper($sharedUnit).')' : '' }}</th>
                <th class="c-price">PRICE{{ $hargaUsd ? ' (USD)' : '' }}</th>
                <th class="c-total">TOTAL (Rp)</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($items as $index => $item)
                <tr>
                    <td class="c-no">{{ $index + 1 }}.</td>
                    <td class="c-ket keterangan">
                        {{ $item->service_name }}
                        @if (filled($item->description))
                            <br>{!! nl2br(e($item->description)) !!}
                        @endif
                    </td>
                    <td class="c-qty">{{ $qty($item->quantity) }}{{ $sharedUnit ? '' : ' '.$item->unit }}</td>
                    <td class="c-price besar">{{ $harga($item) }}</td>
                    <td class="c-total besar">{{ $uang($item->amount) }}</td>
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
                    <td class="c-no">{{ $baris['nomor'] }}.</td>
                    <td colspan="3" class="label">{{ $label($baris) }}</td>
                @else
                    <td colspan="4" class="label">{{ $label($baris) }}</td>
                @endif
                <td class="c-total">{{ $uang($baris['jumlah'], $baris['mata_uang']) }}</td>
            </tr>
        @endforeach
    </table>
@endsection
