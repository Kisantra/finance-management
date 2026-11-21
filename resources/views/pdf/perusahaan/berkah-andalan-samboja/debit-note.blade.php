{{--
    Debit Note PT Berkah Andalan Samboja (BAS): menagih kembali biaya yang BAS bayar lebih dulu atas nama
    klien (talangan: PNBP, demurrage, biaya operasional). Ditiru dari DEBIT NOTE … .docx BAS: kop, blok
    klien, kotak alamat & rekening, dan tanda tangan sama dengan invoice (kerangka.blade.php); judulnya
    DEBIT NOTE dan tabelnya bergaya tabel Excel tersemat di dokumen asli — judul kolom kapital hitam di atas
    merah terang, isi 12pt, GRAND TOTAL bergaris bawah ganda.
    Kolom DAY & PRICE hanya muncul bila ada item ber-qty selain 1 (mis. demurrage 3 hari × tarif harian);
    tagihan sekali bayar (PNBP, operasional) cukup NO · KETERANGAN · TOTAL, seperti dokumen asli. Nomor nota
    tagihan, NTPN, atau rincian hari ditulis di keterangan item.
    Debit Note talangan tanpa PPN/PPh, jadi baris totalnya hanya GRAND TOTAL (atau tagihan uang
    muka/pelunasan); Debit Note tagihan jasa bisa ber-PPN/PPh 23, barisnya ditata seperti invoice BAS.
    Adanya berkas ini membuat BAS bisa memilih jenis dokumen Debit Note di editor
    (CompanyInvoiceTemplate::supportsDebitNote()).
--}}
@extends('pdf.perusahaan.berkah-andalan-samboja.kerangka')

@php
    $qty = fn ($value) => rtrim(rtrim(number_format((float) $value, 3, ',', '.'), '0'), ',');
    // "Rp" rata kiri, angka rata kanan dalam satu baris (format akuntansi tabel Excel di dokumen asli).
    $uang = fn ($value, $mataUang = 'IDR') => '<table class="uang"><tr><td class="rp">'.\App\Services\InvoiceTotalRows::symbol($mataUang).'</td><td class="angka">'.\App\Services\InvoiceTotalRows::format($value, $mataUang, 4).'</td></tr></table>';

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
            width: 100%;
            border-collapse: collapse;
        }

        .items-table {
            margin-top: 0.85cm;
        }

        /* Judul kolom seperti tabel Excel Debit Note asli: Times New Roman 11pt tebal, hitam di atas
           merah terang, setinggi satu baris Excel, garis tunggal. */
        .items-table th {
            height: 0.51cm;
            background-color: #ff0000;
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
            padding: 0.03cm 0.08cm;
            vertical-align: middle;
            font-size: 12pt;
        }

        /* Baris Excel 12pt (1,29 em per baris di dokumen asli) tanpa baris kosong di atas/bawahnya. */
        .items-table td.keterangan {
            padding: 0.08cm;
            line-height: 1.02;
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
           tebal, label di tengah, garis bawah ganda. */
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

        .totals-table tr.baris-diterima td.c-total {
            color: #ff0000;
        }

        /* Lebar kolom dokumen asli (tabel 16,86 cm): NO 0,95 cm dan TOTAL 4,4 cm tetap; KETERANGAN
           mengisi sisanya, atau berbagi dengan DAY 2,04 cm & PRICE 2,92 cm bila kolom itu tampil. */
        .c-no {
            width: 5.6%;
            text-align: center;
        }

        .c-ket {
            width: 68.5%;
        }

        .rinci .c-ket {
            width: 39.3%;
        }

        .c-qty {
            width: 12%;
            text-align: center;
        }

        .c-price {
            width: 17.2%;
        }

        .c-total {
            width: 25.9%;
        }
@endsection

@section('tabel')
    <table class="items-table{{ $rinci ? ' rinci' : '' }}">
        <thead>
            <tr>
                <th class="c-no">NO</th>
                <th class="c-ket">KETERANGAN</th>
                @if ($rinci)
                    <th class="c-qty">{{ $sharedUnit ? mb_strtoupper($sharedUnit) : 'QTY' }}</th>
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
                <td class="c-total">{!! $uang($baris['jumlah'], $baris['mata_uang']) !!}</td>
            </tr>
        @endforeach
    </table>
@endsection
