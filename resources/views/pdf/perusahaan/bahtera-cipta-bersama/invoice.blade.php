{{--
    Template invoice PT Bahtera Cipta Bersama (BCB) — desain STATIS, ditiru dari invoice Word perusahaan
    (INVOICE FINAL/MOORING/FENDER … .docx); tabelnya sama dengan invoice PT MKB kecuali warna judul kolom. Kop, blok klien, kotak alamat & rekening, dan tanda tangan ada di
    kerangka.blade.php (dipakai bersama Debit Note); di sini judul dan tabel item bergaya tabel Excel tersemat
    di dokumen asli. Baris total disusun sistem ($baris_total, InvoiceTotalRows) dan di sini hanya ditata per
    jenisnya.
--}}
@extends('pdf.perusahaan.bahtera-cipta-bersama.kerangka')

@php
    $rp = fn ($value) => number_format((float) $value, 0, ',', '.');
    $qty = fn ($value) => rtrim(rtrim(number_format((float) $value, 3, ',', '.'), '0'), ',');
    // "Rp" rata kiri, angka rata kanan dalam satu baris (format akuntansi tabel Excel di dokumen asli).
    $uang = fn ($value) => '<table class="uang"><tr><td class="rp">Rp</td><td class="angka">'.$rp($value).'</td></tr></table>';

    $units = $items->pluck('unit')->filter()->unique()->values();
    $sharedUnit = $units->count() === 1 ? $units->first() : null;
    // Dokumen asli menulis baris potongan "PPH 23 (2%)" kapital, tetapi "belum dipotong PPh" di subtotal.
    $label = fn (array $baris) => $baris['jenis'] === 'pph' ? str_replace('PPh', 'PPH', $baris['label']) : $baris['label'];
@endphp

@section('nama-dokumen', 'Invoice')

@section('judul', 'I N V O I C E')

@section('gaya')
        .items-table,
        .totals-table {
            width: 100%;
            border-collapse: collapse;
        }

        /* Satu baris kosong antara TERM PAYMENT dan tabel. */
        .items-table {
            margin-top: 12.65pt;
        }

        /* Judul kolom seperti tabel Excel asli: Times New Roman 11pt tebal, hitam di atas biru (Accent 1
           tema Office), garis bawah ganda. */
        .items-table th {
            height: 0.99cm;
            background-color: #4472c4;
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

        /* Satu baris kosong di atas dan di bawah keterangan, seperti blok item di dokumen asli; baris
           Excel 11pt setinggi ±14pt. */
        .items-table td.keterangan {
            padding: 0.5cm 0.08cm;
            line-height: 1;
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

        /* Gaya baris total per jenis (InvoiceTotalRows), seperti dokumen asli: label subtotal tebal,
           nominalnya biasa; potongan PPh 23 merah; GRAND TOTAL tebal, label di tengah, nominal 12pt,
           garis bawah ganda. */
        .totals-table tr.baris-dpp td.label,
        .totals-table tr.baris-bruto td.label,
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

        .totals-table tr.baris-pph td.c-total,
        .totals-table tr.baris-diterima td.c-total {
            color: #ff0000;
        }

        /* Lebar kolom tabel Excel asli (16,86 cm). */
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
@endsection

@section('tabel')
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
                    <td colspan="3" class="label">{{ $label($baris) }}</td>
                @else
                    <td colspan="4" class="label">{{ $label($baris) }}</td>
                @endif
                <td class="c-total">{!! $uang($baris['jumlah']) !!}</td>
            </tr>
        @endforeach
    </table>
@endsection
