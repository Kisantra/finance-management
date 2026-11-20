{{--
    Debit Note PT Mitra Kellian Baruna (MKB): menagih kembali biaya yang MKB bayar lebih dulu atas nama klien
    (talangan, mis. overtime hari libur). Ditiru dari DEBIT NOTE … .docx MKB: kop, blok klien, kotak alamat &
    rekening, dan tanda tangan sama dengan invoice (kerangka.blade.php); judulnya DEBIT NOTE dan tabelnya
    bergaya tabel Excel tersemat di dokumen asli — judul kolom hijau seperti invoice, NO · KETERANGAN · TOTAL,
    tabel selebar 16,45 cm.
    Kolom Quantity & PRICE hanya muncul bila ada item ber-qty selain 1 (mis. 3 hari × tarif harian); tagihan
    sekali bayar cukup No · Keterangan · TOTAL, seperti dokumen asli. Rincian (nomor nota, tanggal, kapal)
    ditulis di keterangan item.
    Item Debit Note selalu talangan (tanpa PPN/PPh), jadi baris total hanya GRAND TOTAL (atau tagihan uang
    muka/pelunasan). Adanya berkas ini membuat MKB bisa memilih jenis dokumen Debit Note di editor
    (CompanyInvoiceTemplate::supportsDebitNote()).
--}}
@extends('pdf.perusahaan.mitra-kellian-baruna.kerangka')

@php
    $rp = fn ($value) => number_format((float) $value, 0, ',', '.');
    $qty = fn ($value) => rtrim(rtrim(number_format((float) $value, 3, ',', '.'), '0'), ',');
    // "Rp" rata kiri, angka rata kanan dalam satu baris (format akuntansi tabel Excel di dokumen asli).
    $uang = fn ($value) => '<table class="uang"><tr><td class="rp">Rp</td><td class="angka">'.$rp($value).'</td></tr></table>';

    $units = $items->pluck('unit')->filter()->unique()->values();
    $sharedUnit = $units->count() === 1 ? $units->first() : null;
    $rinci = $items->contains(fn ($item) => (float) $item->quantity !== 1.0);
    $kolom = $rinci ? 5 : 3;
    // Baris total memakai kata "Debit Note", bukan "Invoice".
    $labelTotal = fn (array $baris) => $baris['jenis'] === 'total' ? 'Total Debit Note' : $baris['label'];
@endphp

@section('nama-dokumen', 'Debit Note')

@section('judul', 'DEBIT NOTE')

@section('gaya')
        .items-table,
        .totals-table {
            width: 16.45cm;
            border-collapse: collapse;
        }

        /* Satu baris kosong antara TERM PAYMENT dan tabel. */
        .items-table {
            margin-top: 12.65pt;
        }

        /* Judul kolom seperti tabel Excel Debit Note asli: sama dengan invoice — Times New Roman 11pt
           tebal, hitam di atas hijau, garis bawah ganda. */
        .items-table th {
            height: 0.99cm;
            background-color: #92d050;
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

        /* Baris Excel 11pt setinggi ±14pt, tanpa baris kosong di atas/bawahnya. */
        .items-table td.keterangan {
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

        /* Gaya baris total per jenis (InvoiceTotalRows). Baris tagihan = GRAND TOTAL dokumen asli:
           tebal, label di tengah, nominal 12pt, garis bawah ganda. */
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

        /* Lebar kolom dokumen asli: NO 1,13 cm dan TOTAL 4,43 cm tetap; KETERANGAN mengisi sisanya, atau
           berbagi dengan Quantity & PRICE bila kolom itu tampil. */
        .c-no {
            width: 6.9%;
            text-align: center;
        }

        .c-ket {
            width: 66.2%;
        }

        .rinci .c-ket {
            width: 34.5%;
        }

        .c-qty {
            width: 12%;
            text-align: center;
        }

        .c-price {
            width: 19.7%;
        }

        .c-total {
            width: 26.9%;
        }
@endsection

@section('tabel')
    <table class="items-table{{ $rinci ? ' rinci' : '' }}">
        <thead>
            <tr>
                <th class="c-no">No</th>
                <th class="c-ket">Keterangan</th>
                @if ($rinci)
                    <th class="c-qty">Quantity{{ $sharedUnit ? ' ('.mb_strtoupper($sharedUnit).')' : '' }}</th>
                    <th class="c-price">PRICE</th>
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
                        <td class="c-price">{!! $uang($item->unit_price) !!}</td>
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
                <td class="c-total">{!! $uang($baris['jumlah']) !!}</td>
            </tr>
        @endforeach
    </table>
@endsection
