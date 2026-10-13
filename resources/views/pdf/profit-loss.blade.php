@php
    /** @var array $report */
    /** @var \App\Models\CompanyProfile|null $company */
    /** @var \Carbon\Carbon $start */
    /** @var \Carbon\Carbon $end */

    $rp = fn ($v) => 'Rp '.number_format((int) $v, 0, ',', '.');
    $periodText = $start->isoFormat('D MMMM Y').' — '.$end->isoFormat('D MMMM Y');
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Laporan Laba Rugi — {{ $periodText }}</title>
    <style>
        @page { margin: 18mm 16mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Helvetica', Arial, sans-serif;
            font-size: 10pt;
            color: #111;
            line-height: 1.45;
        }

        .doc-header { text-align: center; padding-bottom: 14px; border-bottom: 2px solid #111; margin-bottom: 22px; }
        .doc-header .company { font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .doc-header .meta { font-size: 9pt; color: #444; margin-top: 4px; }

        .title-block { text-align: center; margin: 6px 0 18px; }
        .title-block h1 { font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; }
        .title-block .period { font-size: 10pt; color: #444; margin-top: 6px; font-style: italic; }

        .section-title {
            font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px;
            color: #444; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #ddd;
        }

        table.report { width: 100%; border-collapse: collapse; }
        table.report td { padding: 4px 0; vertical-align: top; }
        table.report td.label { width: 60%; }
        table.report td.label.indent { padding-left: 14px; color: #333; }
        table.report td.amount { width: 40%; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }

        tr.subtotal td { border-top: 1px solid #999; padding-top: 6px; font-weight: bold; }
        tr.total td { border-top: 2px solid #111; border-bottom: 2px double #111; padding: 8px 0; font-weight: bold; font-size: 11pt; text-transform: uppercase; letter-spacing: 0.5px; }
        tr.negative td.amount { color: #b91c1c; }

        .footer-meta { margin-top: 30px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 8pt; color: #666; display: flex; justify-content: space-between; }

        .unclassified-block { margin-top: 24px; padding: 12px; border: 1px solid #f59e0b; background: #fffbeb; border-radius: 4px; }
        .unclassified-block h3 { font-size: 10pt; color: #92400e; margin-bottom: 6px; }
        .unclassified-block p { font-size: 9pt; color: #78350f; margin-bottom: 8px; }
        .unclassified-block table td { padding: 2px 0; font-size: 9pt; color: #78350f; }
    </style>
</head>
<body>

    <div class="doc-header">
        <div class="company">{{ $company->name ?? 'Perusahaan' }}</div>
        @if ($company)
            <div class="meta">
                @if ($company->address) {{ $company->address }} @endif
                @if ($company->npwp) &nbsp;·&nbsp; NPWP: {{ $company->npwp }} @endif
            </div>
        @endif
    </div>

    <div class="title-block">
        <h1>Laporan Laba Rugi</h1>
        <div class="period">Periode: {{ $periodText }}</div>
    </div>

    <table class="report">
        {{-- PENDAPATAN --}}
        <tr><td colspan="2"><div class="section-title">Pendapatan</div></td></tr>
        <tr>
            <td class="label indent">Pendapatan dari Invoice (kas)</td>
            <td class="amount">{{ $rp($report['revenue']['invoice']) }}</td>
        </tr>
        @foreach ($report['revenue']['non_invoice_by_category'] as $row)
            <tr>
                <td class="label indent">{{ $row['category_label'] }}</td>
                <td class="amount">{{ $rp($row['amount']) }}</td>
            </tr>
        @endforeach
        <tr class="subtotal">
            <td class="label">Total Pendapatan</td>
            <td class="amount">{{ $rp($report['revenue']['total']) }}</td>
        </tr>

        {{-- HPP --}}
        <tr><td colspan="2"><div class="section-title">Harga Pokok Penjualan (HPP)</div></td></tr>
        <tr>
            <td class="label indent">HPP Invoice (cost-recovery)</td>
            <td class="amount">{{ $rp($report['cogs']['invoice']) }}</td>
        </tr>
        @foreach ($report['cogs']['manual_by_category'] as $row)
            <tr>
                <td class="label indent">{{ $row['category_label'] }}</td>
                <td class="amount">{{ $rp($row['amount']) }}</td>
            </tr>
        @endforeach
        <tr class="subtotal">
            <td class="label">Total HPP</td>
            <td class="amount">{{ $rp($report['cogs']['total']) }}</td>
        </tr>

        <tr class="total {{ $report['gross_profit'] < 0 ? 'negative' : '' }}">
            <td class="label">Laba Kotor</td>
            <td class="amount">{{ $rp($report['gross_profit']) }}</td>
        </tr>

        {{-- BEBAN OPERASIONAL --}}
        <tr><td colspan="2"><div class="section-title">Beban Operasional</div></td></tr>
        @forelse ($report['opex']['by_category'] as $row)
            <tr>
                <td class="label indent">{{ $row['category_label'] }}</td>
                <td class="amount">{{ $rp($row['amount']) }}</td>
            </tr>
        @empty
            <tr><td class="label indent" style="color:#888;font-style:italic;">(tidak ada)</td><td class="amount">{{ $rp(0) }}</td></tr>
        @endforelse
        <tr class="subtotal">
            <td class="label">Total Beban Operasional</td>
            <td class="amount">{{ $rp($report['opex']['total']) }}</td>
        </tr>

        <tr class="total {{ $report['operating_profit'] < 0 ? 'negative' : '' }}">
            <td class="label">Laba Usaha</td>
            <td class="amount">{{ $rp($report['operating_profit']) }}</td>
        </tr>

        {{-- PENDAPATAN / BEBAN LAIN --}}
        @if ($report['other_income']['total'] > 0 || $report['other_expense']['total'] > 0)
            <tr><td colspan="2"><div class="section-title">Pendapatan &amp; Beban Lain</div></td></tr>
            @foreach ($report['other_income']['by_category'] as $row)
                <tr>
                    <td class="label indent">{{ $row['category_label'] }}</td>
                    <td class="amount">{{ $rp($row['amount']) }}</td>
                </tr>
            @endforeach
            @foreach ($report['other_expense']['by_category'] as $row)
                <tr>
                    <td class="label indent">{{ $row['category_label'] }}</td>
                    <td class="amount">({{ $rp($row['amount']) }})</td>
                </tr>
            @endforeach
            <tr class="subtotal">
                <td class="label">Total Pendapatan/Beban Lain (netto)</td>
                <td class="amount">{{ $rp($report['other_income']['total'] - $report['other_expense']['total']) }}</td>
            </tr>
        @endif

        <tr class="total {{ $report['pre_tax_profit'] < 0 ? 'negative' : '' }}">
            <td class="label">Laba Sebelum Pajak</td>
            <td class="amount">{{ $rp($report['pre_tax_profit']) }}</td>
        </tr>

        {{-- PAJAK PERUSAHAAN --}}
        @if ($report['tax']['total'] > 0)
            <tr><td colspan="2"><div class="section-title">Pajak Perusahaan</div></td></tr>
            @foreach ($report['tax']['by_category'] as $row)
                <tr>
                    <td class="label indent">{{ $row['category_label'] }}</td>
                    <td class="amount">{{ $rp($row['amount']) }}</td>
                </tr>
            @endforeach
            <tr class="subtotal">
                <td class="label">Total Pajak Perusahaan</td>
                <td class="amount">{{ $rp($report['tax']['total']) }}</td>
            </tr>
        @endif

        <tr class="total {{ $report['net_profit'] < 0 ? 'negative' : '' }}">
            <td class="label">Laba Bersih</td>
            <td class="amount">{{ $rp($report['net_profit']) }}</td>
        </tr>

        @if (($report['ppn_output'] ?? 0) > 0)
            <tr>
                <td class="label indent">Catatan: PPN Keluaran diterima (titipan negara, tidak termasuk pendapatan)</td>
                <td class="amount">{{ $rp($report['ppn_output']) }}</td>
            </tr>
        @endif
    </table>

    @php
        $hasUnclassified = ($report['unclassified']['income']['total'] ?? 0) > 0
            || ($report['unclassified']['expense']['total'] ?? 0) > 0;
    @endphp

    @if ($hasUnclassified)
        <div class="unclassified-block">
            <h3>⚠ Catatan: Ada Transaksi Belum Diklasifikasi</h3>
            <p>Transaksi di bawah ini <strong>belum dihitung</strong> dalam laporan di atas karena kategorinya belum dipetakan ke grup Laba Rugi.</p>
            <table style="width:100%;">
                @foreach ($report['unclassified']['income']['by_category'] as $row)
                    <tr>
                        <td style="width:70%;">[Pemasukan] {{ $row['category_label'] }}</td>
                        <td style="text-align:right;">{{ $rp($row['amount']) }}</td>
                    </tr>
                @endforeach
                @foreach ($report['unclassified']['expense']['by_category'] as $row)
                    <tr>
                        <td style="width:70%;">[Pengeluaran] {{ $row['category_label'] }}</td>
                        <td style="text-align:right;">{{ $rp($row['amount']) }}</td>
                    </tr>
                @endforeach
            </table>
        </div>
    @endif

    <div class="footer-meta">
        <span>Dicetak: {{ now()->isoFormat('D MMMM Y HH:mm') }} WIB</span>
        <span>Basis: Kas · Cost-Recovery HPP</span>
    </div>

</body>
</html>
