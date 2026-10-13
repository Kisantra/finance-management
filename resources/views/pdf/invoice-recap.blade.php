@php
    /** @var \Illuminate\Support\Collection $rows */
    /** @var array $summary */
    /** @var string $period */
    /** @var \App\Models\CompanyProfile|null $company */

    $rp = fn ($v) => 'Rp '.number_format((int) $v, 0, ',', '.');
    // Compact (no "Rp") for the dense 12-column table body.
    $n = fn ($v) => number_format((int) $v, 0, ',', '.');

    $status = [
        'draft' => ['label' => 'Draft', 'bg' => '#f1f5f9', 'fg' => '#475569'],
        'sent' => ['label' => 'Terkirim', 'bg' => '#dbeafe', 'fg' => '#1d4ed8'],
        'partially_paid' => ['label' => 'Sebagian', 'bg' => '#fef3c7', 'fg' => '#b45309'],
        'paid' => ['label' => 'Lunas', 'bg' => '#dcfce7', 'fg' => '#15803d'],
    ];
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Rekap Invoice — {{ $period }}</title>
    <style>
        @page { margin: 14mm 12mm 18mm 12mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Helvetica', Arial, sans-serif;
            font-size: 9pt;
            color: #1e293b;
            line-height: 1.4;
        }

        /* ── Header ── */
        .head-tbl { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .head-tbl td { vertical-align: middle; }
        .company { font-size: 13pt; font-weight: bold; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
        .company-meta { font-size: 8pt; color: #64748b; margin-top: 2px; }
        .doc-tag {
            text-align: right; font-size: 15pt; font-weight: bold; color: #0f172a;
            letter-spacing: 2px; text-transform: uppercase;
        }
        .doc-period { text-align: right; font-size: 8.5pt; color: #64748b; margin-top: 2px; font-style: italic; }
        .rule { height: 2px; background: #0f172a; margin-bottom: 14px; }

        /* ── Summary strip ── */
        .summary { width: 100%; border-collapse: separate; border-spacing: 5px 0; margin-bottom: 14px; }
        .summary td {
            width: 16.66%; border: 1px solid #e2e8f0; border-radius: 6px;
            padding: 7px 9px; background: #f8fafc;
        }
        .sum-label { font-size: 7pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
        .sum-value { font-size: 9.5pt; font-weight: bold; color: #0f172a; margin-top: 3px; }
        .sum-value.out { color: #b45309; }
        .sum-value.paid { color: #15803d; }
        .sum-value.profit { color: #15803d; }
        .sum-value.tax { color: #b45309; }

        /* ── Table ── */
        table.data { width: 100%; border-collapse: collapse; }
        table.data thead th {
            background: #0f172a; color: #fff; font-size: 7pt; font-weight: bold;
            text-transform: uppercase; letter-spacing: 0.2px;
            padding: 6px 5px; text-align: left; border: none;
        }
        table.data thead th.c { text-align: center; }
        table.data thead th.r { text-align: right; }
        table.data tbody td {
            padding: 5px 5px; font-size: 7.5pt; border-bottom: 1px solid #e2e8f0;
        }
        table.data tbody tr.even td { background: #f8fafc; }
        td.c { text-align: center; }
        td.r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        td.muted { color: #94a3b8; }
        .inv-no { font-weight: bold; color: #0f172a; }

        .badge {
            display: inline-block; padding: 2px 8px; border-radius: 10px;
            font-size: 7.5pt; font-weight: bold;
        }

        /* ── Totals ── */
        table.data tfoot td {
            padding: 7px 5px; font-size: 7.5pt; font-weight: bold;
            border-top: 2px solid #0f172a; background: #f1f5f9;
        }
        table.data tfoot td.r { text-align: right; white-space: nowrap; }

        .empty { text-align: center; padding: 24px; color: #94a3b8; font-style: italic; }

        /* ── Page footer ── */
        .pg-foot {
            position: fixed; bottom: -10mm; left: 0; right: 0;
            font-size: 7.5pt; color: #94a3b8;
        }
        .pg-foot .l { float: left; }
        .pg-foot .r { float: right; }
        .pg-foot:after { content: ""; display: block; clear: both; }
    </style>
</head>
<body>

    {{-- Repeating page footer --}}
    <div class="pg-foot">
        <span class="l">{{ $company->name ?? '' }} — Rekap Invoice</span>
        <span class="r">Dicetak {{ now()->isoFormat('D MMM Y HH:mm') }} WIB</span>
    </div>

    {{-- Header --}}
    <table class="head-tbl">
        <tr>
            <td style="width:55%;">
                <div class="company">{{ $company->name ?? 'Perusahaan' }}</div>
                @if ($company && ($company->address || $company->npwp))
                    <div class="company-meta">
                        @if ($company->address){{ $company->address }}@endif
                        @if ($company->npwp) &nbsp;·&nbsp; NPWP: {{ $company->npwp }}@endif
                    </div>
                @endif
            </td>
            <td style="width:45%;">
                <div class="doc-tag">Rekap Invoice</div>
                <div class="doc-period">{{ $period }}</div>
            </td>
        </tr>
    </table>
    <div class="rule"></div>

    {{-- Summary strip --}}
    @php $showPpn = ($summary['total_ppn'] ?? 0) > 0; @endphp
    <table class="summary">
        <tr>
            <td>
                <div class="sum-label">Jumlah Invoice</div>
                <div class="sum-value">{{ number_format($summary['count'], 0, ',', '.') }}</div>
            </td>
            <td>
                <div class="sum-label">Omzet</div>
                <div class="sum-value">{{ $rp($summary['total_amount']) }}</div>
            </td>
            @if ($showPpn)
                <td>
                    <div class="sum-label">PPN</div>
                    <div class="sum-value">{{ $rp($summary['total_ppn']) }}</div>
                </td>
            @endif
            <td>
                <div class="sum-label">HPP</div>
                <div class="sum-value">{{ $rp($summary['total_hpp']) }}</div>
            </td>
            <td>
                <div class="sum-label">Profit</div>
                <div class="sum-value profit">{{ $rp($summary['total_profit']) }}</div>
            </td>
            <td>
                <div class="sum-label">PPh Final 0,5%</div>
                <div class="sum-value tax">{{ $rp($summary['total_pph_final']) }}</div>
            </td>
            <td>
                <div class="sum-label">Outstanding</div>
                <div class="sum-value out">{{ $rp($summary['total_outstanding']) }}</div>
            </td>
        </tr>
    </table>

    <div style="font-size:7pt;color:#94a3b8;margin-bottom:6px;">Semua nilai dalam Rupiah. Omzet tanpa PPN &middot; Profit = Omzet - HPP &middot; PPh Final = 0,5% x Omzet (PP 55/2022).</div>

    {{-- Table --}}
    <table class="data">
        <thead>
            <tr>
                <th class="c" style="width:3%;">No</th>
                <th style="width:13%;">No. Invoice</th>
                <th style="width:15%;">Klien</th>
                <th class="c" style="width:8%;">Tgl Invoice</th>
                <th class="c" style="width:8%;">Jatuh Tempo</th>
                <th class="c" style="width:7%;">Status</th>
                <th class="r">Omzet</th>
                @if ($showPpn)<th class="r">PPN</th>@endif
                <th class="r">HPP</th>
                <th class="r">Profit</th>
                <th class="r">PPh 0,5%</th>
                <th class="r">Terbayar</th>
                <th class="r">Sisa</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($rows as $i => $row)
                @php $st = $status[$row['status']] ?? ['label' => $row['status'], 'bg' => '#f1f5f9', 'fg' => '#475569']; @endphp
                <tr class="{{ $i % 2 === 1 ? 'even' : '' }}">
                    <td class="c muted">{{ $i + 1 }}</td>
                    <td class="inv-no">{{ $row['invoice_number'] ?? '(draft)' }}</td>
                    <td>{{ $row['client_name'] }}</td>
                    <td class="c">{{ $row['issue_date'] }}</td>
                    <td class="c">{{ $row['due_date'] }}</td>
                    <td class="c">
                        <span class="badge" style="background:{{ $st['bg'] }};color:{{ $st['fg'] }};">{{ $st['label'] }}</span>
                    </td>
                    <td class="r">{{ $n($row['total_amount']) }}</td>
                    @if ($showPpn)<td class="r">{{ $n($row['ppn']) }}</td>@endif
                    <td class="r">{{ $n($row['hpp']) }}</td>
                    <td class="r" style="color:#15803d;">{{ $n($row['profit']) }}</td>
                    <td class="r" style="color:#b45309;">{{ $n($row['pph_final']) }}</td>
                    <td class="r">{{ $n($row['amount_paid']) }}</td>
                    <td class="r">{{ $n($row['amount_remaining']) }}</td>
                </tr>
            @empty
                <tr><td colspan="{{ $showPpn ? 13 : 12 }}" class="empty">Tidak ada invoice pada periode/filter ini.</td></tr>
            @endforelse
        </tbody>
        <tfoot>
            <tr>
                <td colspan="6" class="r">TOTAL ({{ $summary['count'] }} invoice)</td>
                <td class="r">{{ $n($summary['total_amount']) }}</td>
                @if ($showPpn)<td class="r">{{ $n($summary['total_ppn']) }}</td>@endif
                <td class="r">{{ $n($summary['total_hpp']) }}</td>
                <td class="r" style="color:#15803d;">{{ $n($summary['total_profit']) }}</td>
                <td class="r" style="color:#b45309;">{{ $n($summary['total_pph_final']) }}</td>
                <td class="r">{{ $n($summary['total_paid']) }}</td>
                <td class="r">{{ $n($summary['total_outstanding']) }}</td>
            </tr>
        </tfoot>
    </table>

</body>
</html>
