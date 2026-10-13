<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <link rel="icon" href="{{ asset('images/kisantra.png') }}" type="image/png">
    <title>Invoice {{ $invoice->invoice_number }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            font-size: 15px;
            line-height: 1.4;
            color: #333;
        }

        .container {
            max-width: 100%;
            margin: 0;
            padding: 15px;
        }

        /* Header dengan letterhead image */
        .header {
            background: white;
            margin: -15px -20px 10px -15px;
            padding: 0;
            text-align: center;
            width: 100%;
        }

        .letterhead-container {
            width: 100%;
            text-align: center;
            padding-left: 10px;
            padding-top: 10px;
        }

        .letterhead-image {
            width: 100%;
            max-width: 100%;
            height: auto;
            object-fit: contain;
            display: block;
            margin: 0 auto;
        }

        /* Invoice Title */
        .invoice-title {
            background: #42b2cc;
            color: white;
            text-align: center;
            padding: 0 12px;
            margin: 0px -20px 20px -15px;
            font-size: 20px;
            font-weight: bold;
            letter-spacing: 2px;
        }

        /* Main Content */
        .main-content {
            display: table;
            width: 100%;
            margin-bottom: 20px;
        }

        .left-section {
            display: table-cell;
            width: 50%;
            vertical-align: top;
            padding-right: 20px;
        }

        .right-section {
            display: table-cell;
            width: 50%;
            vertical-align: top;
        }

        .section-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: #42b2cc;
        }

        .client-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .info-grid {
            display: table;
            width: 100%;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
        }

        .info-row {
            display: table-row;
        }

        .info-label {
            display: table-cell;
            padding: 8px;
            font-weight: bold;
            background: #e5e7eb;
            border: 1px solid #d1d5db;
            width: 40%;
        }

        .info-value {
            display: table-cell;
            padding: 8px;
            border: 1px solid #d1d5db;
        }

        /* Items Table - Default spacing */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }

        .items-table th {
            background: #42b2cc;
            color: white;
            border: 2px solid #36a3bd;
            padding: 10px 8px;
            text-align: center;
            font-weight: bold;
            font-size: 15px;
            line-height: 1.2;
        }

        .items-table td {
            border: 1px solid #374151;
            padding: 10px 8px;
            text-align: center;
            font-size: 15px;
            line-height: 1.3;
            vertical-align: middle;
        }

        /* Compact spacing only for multiple clients */
        .compact-table th {
            padding: 6px 4px;
            font-size: 13px;
        }

        .compact-table td {
            padding: 5px 4px;
            font-size: 13px;
        }

        .items-table .text-left {
            text-align: left;
        }

        .items-table .text-right {
            text-align: right;
        }

        /* Client cell styling */
        .client-cell {
            font-size: 11px;
            font-weight: bold;
            color: #42b2cc;
            text-align: left;
            padding: 3px 4px;
        }

        /* Tax deposit styling */
        .tax-deposit-row {
            background: #fef3cd !important;
        }

        .tax-deposit-label {
            background: #f59e0b;
            color: white;
            font-size: 9px;
            padding: 1px 4px;
            border-radius: 2px;
            font-weight: bold;
            margin-left: 5px;
        }

        /* Currency formatting */
        .currency-cell {
            display: table;
            width: 100%;
        }

        .currency-left {
            display: table-cell;
            text-align: left;
            width: 30%;
            font-size: 13px;
        }

        .currency-right {
            display: table-cell;
            text-align: right;
            width: 70%;
            font-size: 13px;
        }

        .compact-table .currency-left {
            font-size: 11px;
        }

        .compact-table .currency-right {
            font-size: 11px;
        }

        /* Total Section - ENHANCED */
        .total-section {
            width: 100%;
            margin: 30px 0;
            /* Increased margin */
        }

        .total-row {
            display: table;
            width: 100%;
            margin-bottom: 5px;
        }

        .total-label {
            display: table-cell;
            font-weight: bold;
            padding: 15px 12px;
            /* Increased padding */
            color: black;
            background: #f3f4f6;
            /* Keep original light background */
            border-top: 3px solid #374151;
            border-bottom: 4px double #374151;
            font-style: italic;
            font-size: 22px;
            /* Increased font size */
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .total-value {
            display: table-cell;
            font-weight: bold;
            padding: 15px 12px;
            /* Increased padding */
            background: #42b2cc;
            /* Keep original blue background */
            color: white;
            border: 3px solid #42b2cc;
            font-style: italic;
            font-size: 22px;
            /* Increased font size */
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            /* Added shadow */
        }

        .total-value-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            font-weight: 900;
            /* Extra bold */
        }

        /* Footer Section Grid */
        .footer-section {
            display: table;
            width: 100%;
            margin-top: 30px;
        }

        .footer-left {
            display: table-cell;
            width: 50%;
            vertical-align: top;
            padding-right: 20px;
        }

        .footer-right {
            display: table-cell;
            width: 50%;
            vertical-align: top;
        }

        .grand-total-section {
            margin-bottom: 20px;
        }

        .grand-total-row {
            display: table;
            width: 100%;
            margin-bottom: 5px;
        }

        .grand-total-label {
            display: table-cell;
            font-weight: bold;
            padding: 3px;
            background: #d1d5db;
            color: black;
            border: 1px solid #d1d5db;
            font-size: 16px;
        }

        .grand-total-value {
            display: table-cell;
            font-weight: bold;
            padding: 3px;
            background: #d1d5db;
            color: black;
            border: 1px solid #d1d5db;
            text-align: right;
            font-size: 16px;
        }

        .signature-section {
            text-align: center;
        }

        .payment-method {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            padding: 10px;
            margin-bottom: 10px;
            border-left: 3px solid #42b2cc;
        }

        .payment-title {
            font-weight: bold;
            margin-bottom: 5px;
            color: #42b2cc;
        }

        .bank-info {
            font-size: 15px;
            line-height: 1.4;
        }

        .terbilang {
            font-style: italic;
            margin: 10px 0;
            padding: 8px;
            background: #f8f9fa;
            border-left: 3px solid #42b2cc;
        }

        .signature-box {
            padding: 60px 20px 20px 20px;
            margin-top: 20px;
            position: relative;
        }

        .signature-name {
            font-weight: bold;
            border-bottom: 1px solid #333;
            padding-bottom: 5px;
            margin-bottom: 5px;
        }

        .signature-position {
            font-size: 15px;
            color: #666;
        }

        .signature-image {
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            width: 120px;
            height: auto;
        }

        .company-stamp {
            position: absolute;
            left: 210px;
            top: -25px;
            width: 120px;
            height: auto;
            opacity: 0.6;
        }

        /* Tax info note */
        .tax-info {
            background: #fef3cd;
            border: 1px solid #f59e0b;
            border-left: 4px solid #f59e0b;
            padding: 8px;
            margin-top: 10px;
            font-size: 12px;
            color: #92400e;
        }
    </style>
</head>

<body>
    <div class="container">
        <!-- Header dengan Letterhead -->
        <div class="header">
            <div class="letterhead-container">
                @if ($company['logo_base64'])
                    <img src="{{ $company['logo_base64'] }}" class="letterhead-image"
                        alt="{{ $company['name'] }}">
                @else
                    <div style="padding: 20px; text-align: center; border: 2px dashed #42b2cc; color: #42b2cc;">
                        {{ $company['name'] }}<br>
                        LETTERHEAD PLACEHOLDER
                    </div>
                @endif
            </div>
        </div>

        <!-- Invoice Title -->
        <div class="invoice-title">
            {{ __('invoice.invoice') }}
            @if ($is_down_payment)
                <span
                    style="background: #f59e0b; padding: 3px 12px; margin-left: 15px; border-radius: 4px; font-size: 14px; letter-spacing: 1px;">{{ strtoupper(__('invoice.down_payment')) }}</span>
            @elseif($is_pelunasan)
                <span
                    style="background: #10b981; padding: 3px 12px; margin-left: 15px; border-radius: 4px; font-size: 14px; letter-spacing: 1px;">{{ strtoupper(__('invoice.settlement')) }}</span>
            @endif
        </div>

        <!-- Main Content -->
        <div class="main-content">
            <div class="left-section">
                <div class="section-title">{{ __('invoice.bill_to') }} :</div>
                <div class="client-name">{{ strtoupper($client->name) }}</div>

                @php
                    $uniqueClients = $items->pluck('client.name')->unique();
                    $hasMultipleClients = $uniqueClients->count() > 1;
                @endphp

                @if ($hasMultipleClients)
                    <div style="margin-top: 10px; font-size: 12px; color: #666; font-style: italic;">
                        * {{ __('invoice.multiple_clients_note', ['count' => $uniqueClients->count()]) }}
                    </div>
                @endif

                @if ($financial_summary['has_tax_deposits'])
                    <div style="margin-top: 10px; font-size: 12px; color: #f59e0b; font-style: italic;">
                        * {{ __('invoice.includes_tax_deposit') }} Rp
                        {{ number_format($financial_summary['tax_deposits_total'], 0, ',', '.') }}
                    </div>
                @endif
            </div>

            <div class="right-section">
                <div class="info-grid">
                    <div class="info-row">
                        <div class="info-label">{{ __('invoice.invoice_date') }}</div>
                        <div class="info-value">{{ $invoice->issue_date->format('d M Y') }}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">{{ __('invoice.invoice_number') }}</div>
                        <div class="info-value">{{ $invoice->invoice_number }}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">{{ __('invoice.payment_terms') }}</div>
                        <div class="info-value">-</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">{{ __('invoice.due_date') }}</div>
                        <div class="info-value">{{ $invoice->due_date->format('d M Y') }}</div>
                    </div>
                    @if ($invoice->faktur)
                        <div class="info-row">
                            <div class="info-label">{{ __('invoice.faktur') }}</div>
                            <div class="info-value">{{ $invoice->faktur }}</div>
                        </div>
                    @endif
                </div>
            </div>
        </div>

        <!-- Items Table -->
        <table class="items-table {{ $hasMultipleClients ? 'compact-table' : '' }}">
            <thead>
                <tr>
                    <th style="width: 6%;">{{ __('invoice.no') }}</th>
                    @if ($hasMultipleClients)
                        <th style="width: 18%;">{{ __('invoice.client') }}</th>
                        <th style="width: 38%;">{{ __('invoice.description') }}</th>
                    @else
                        <th style="width: 56%;">{{ __('invoice.description') }}</th>
                    @endif
                    <th style="width: 8%;">{{ __('invoice.qty') }}</th>
                    <th style="width: 15%;">{{ __('invoice.unit_price') }}</th>
                    <th style="width: 15%;">{{ __('invoice.amount') }}</th>
                </tr>
            </thead>
            <tbody>
                @php
                    $groupedItems = [];
                    $currentClient = null;
                    $currentGroup = [];

                    foreach ($items as $item) {
                        $clientName = $item->client->name ?? 'N/A';

                        if ($currentClient === null || $currentClient === $clientName) {
                            $currentClient = $clientName;
                            $currentGroup[] = $item;
                        } else {
                            $groupedItems[] = [
                                'client' => $currentClient,
                                'items' => $currentGroup,
                                'count' => count($currentGroup),
                            ];
                            $currentClient = $clientName;
                            $currentGroup = [$item];
                        }
                    }

                    if (!empty($currentGroup)) {
                        $groupedItems[] = [
                            'client' => $currentClient,
                            'items' => $currentGroup,
                            'count' => count($currentGroup),
                        ];
                    }

                    $rowIndex = 1;
                @endphp

                @foreach ($groupedItems as $group)
                    @foreach ($group['items'] as $itemIndex => $item)
                        <tr class="{{ $item->is_tax_deposit ? 'tax-deposit-row' : '' }}">
                            <td>{{ $rowIndex }}</td>
                            @if ($hasMultipleClients)
                                @if ($itemIndex === 0)
                                    <td class="client-cell" rowspan="{{ $group['count'] }}"
                                        style="vertical-align: middle; border-right: 2px solid #42b2cc; font-weight: bold; color: #42b2cc;">
                                        {{ $group['client'] }}
                                    </td>
                                @endif
                            @endif
                            <td class="text-left">
                                {{ $item->service_name }}
                                @if ($item->is_tax_deposit)
                                    <span class="tax-deposit-label">{{ strtoupper(__('invoice.tax_deposit')) }}</span>
                                @endif
                            </td>
                            <td>{{ rtrim(rtrim(number_format($item->quantity, 3, ',', '.'), '0'), ',') }} {{ $item->unit ?? 'pcs' }}</td>
                            <td>
                                <div class="currency-cell">
                                    <div class="currency-left">IDR</div>
                                    <div class="currency-right">{{ number_format($item->unit_price, 0, ',', '.') }}
                                    </div>
                                </div>
                            </td>
                            <td>
                                <div class="currency-cell">
                                    <div class="currency-left">IDR</div>
                                    <div class="currency-right">{{ number_format($item->amount, 0, ',', '.') }}</div>
                                </div>
                            </td>
                        </tr>
                        @php $rowIndex++; @endphp
                    @endforeach
                @endforeach
            </tbody>
        </table>

        <!-- Footer Section Grid -->
        <div class="footer-section">
            <div class="footer-left">
                <!-- Payment Methods -->
                @foreach ($company['bank_accounts'] as $index => $bank)
                    <div class="payment-method">
                        <div class="payment-title">{{ __('invoice.payment_method') }} #{{ $index + 1 }}</div>
                        <div class="bank-info">
                            <strong>{{ __('invoice.bank_name') }}:</strong> {{ $bank['bank'] }}<br>
                            <strong>{{ __('invoice.account_number') }}:</strong> {{ $bank['account_number'] }}<br>
                            <strong>{{ __('invoice.account_holder') }}:</strong> {{ $bank['account_name'] }}
                        </div>
                    </div>
                @endforeach

                <!-- Terbilang -->
                <div
                    style="font-style: italic; margin-top: 10px; padding: 10px; background: #f8f9fa; border-left: 3px solid #42b2cc;">
                    <strong style="color: #42b2cc;">{{ __('invoice.say') }}:</strong> {{ $terbilang }} {{ __('invoice.rupiah') }}
                </div>

                <!-- DP Information Box -->
                @if ($is_down_payment)
                    <div
                        style="margin-top: 20px; padding: 15px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 6px;">
                        <div style="font-weight: bold; color: #856404; margin-bottom: 8px; font-size: 14px;">
                            📋 {{ strtoupper(__('invoice.down_payment_info')) }}
                        </div>
                        <table style="width: 100%; font-size: 13px; color: #856404;">
                            <tr>
                                <td style="padding: 3px 0; width: 40%;">{{ __('invoice.invoice_total') }}:</td>
                                <td style="padding: 3px 0; font-weight: bold; text-align: right;">
                                    Rp {{ number_format($invoice->total_amount, 0, ',', '.') }}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 3px 0;">{{ __('invoice.down_payment_paid') }}:</td>
                                <td style="padding: 3px 0; font-weight: bold; text-align: right; color: #28a745;">
                                    Rp {{ number_format($dp_amount, 0, ',', '.') }}
                                </td>
                            </tr>
                            <tr style="border-top: 2px dashed #ffc107;">
                                <td style="padding: 8px 0 3px 0; font-weight: bold;">{{ __('invoice.remaining_payment') }}:</td>
                                <td
                                    style="padding: 8px 0 3px 0; font-weight: bold; text-align: right; color: #dc3545; font-size: 15px;">
                                    Rp {{ number_format($invoice->total_amount - $dp_amount, 0, ',', '.') }}
                                </td>
                            </tr>
                        </table>
                    </div>
                @elseif ($is_pelunasan)
                    <div
                        style="margin-top: 20px; padding: 15px; background: #d1fae5; border: 2px solid #10b981; border-radius: 6px;">
                        <div style="font-weight: bold; color: #065f46; margin-bottom: 8px; font-size: 14px;">
                            ✅ {{ strtoupper(__('invoice.settlement_info')) }}
                        </div>
                        <table style="width: 100%; font-size: 13px; color: #065f46;">
                            <tr>
                                <td style="padding: 3px 0; width: 40%;">{{ __('invoice.invoice_total') }}:</td>
                                <td style="padding: 3px 0; font-weight: bold; text-align: right;">
                                    Rp {{ number_format($invoice->total_amount, 0, ',', '.') }}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 3px 0;">{{ __('invoice.already_paid') }}:</td>
                                <td style="padding: 3px 0; font-weight: bold; text-align: right; color: #059669;">
                                    Rp {{ number_format($total_paid, 0, ',', '.') }}
                                </td>
                            </tr>
                            <tr style="border-top: 2px dashed #10b981;">
                                <td style="padding: 8px 0 3px 0; font-weight: bold;">{{ __('invoice.settlement_amount') }}:</td>
                                <td
                                    style="padding: 8px 0 3px 0; font-weight: bold; text-align: right; color: #10b981; font-size: 15px;">
                                    Rp {{ number_format($pelunasan_amount, 0, ',', '.') }}
                                </td>
                            </tr>
                        </table>
                        <div
                            style="margin-top: 10px; padding: 8px; background: white; border-radius: 4px; font-size: 12px; text-align: center; color: #059669;">
                            <strong>{{ __('invoice.final_settlement_note') }}</strong>
                        </div>
                    </div>
                @endif

                <!-- Tax Information -->
                <div class="tax-info">
                    <strong>{{ __('invoice.notes') }}:</strong> {{ __('invoice.pph_final_note') }}
                    @if ($financial_summary['has_tax_deposits'])
                        <br><strong>*</strong> {{ __('invoice.tax_deposit_excluded_note') }}
                    @endif
                </div>
            </div>

            <div class="footer-right">
                @php
                    // Use net revenue (excluding tax deposits) for tax calculations
                    $netRevenue = $financial_summary['net_revenue'];
                    $netRevenueAfterDiscount = $netRevenue - ($invoice->discount_amount ?? 0);
                    $pph05Percent = $netRevenueAfterDiscount * 0.005;
                    $dpp = $netRevenueAfterDiscount - $pph05Percent;
                @endphp

                <!-- Subtotal Breakdown -->
                @if ($financial_summary['has_tax_deposits'])
                    <div class="grand-total-section">
                        <div class="grand-total-row">
                            <div class="grand-total-label">{{ __('invoice.service_subtotal') }}</div>
                            <div class="grand-total-value">IDR {{ number_format($netRevenue, 0, ',', '.') }}</div>
                        </div>
                    </div>

                    <div class="grand-total-section">
                        <div class="grand-total-row">
                            <div class="grand-total-label">{{ __('invoice.tax_deposit') }}</div>
                            <div class="grand-total-value">IDR
                                {{ number_format($financial_summary['tax_deposits_total'], 0, ',', '.') }}</div>
                        </div>
                    </div>
                @endif

                <!-- Discount Section -->
                @if ($invoice->discount_amount > 0)
                    <div class="grand-total-section">
                        <div class="grand-total-row">
                            <div class="grand-total-label">{{ __('invoice.discount') }}</div>
                            <div class="grand-total-value">IDR
                                -{{ number_format($invoice->discount_amount, 0, ',', '.') }}</div>
                        </div>
                    </div>
                @endif

                @if ($ppn_amount > 0 && $invoice->ppn_rate !== null)
                    <!-- PKP: DPP (layanan − diskon) + PPN = total ditagih (di luar titipan pajak) -->
                    <div class="grand-total-section">
                        <div class="grand-total-row">
                            <div class="grand-total-label">{{ __('invoice.dpp') }}</div>
                            <div class="grand-total-value">IDR {{ number_format($netRevenueAfterDiscount, 0, ',', '.') }}</div>
                        </div>
                    </div>

                    <div class="grand-total-section">
                        <div class="grand-total-row">
                            <div class="grand-total-label">{{ __('invoice.ppn') }} {{ rtrim(rtrim(number_format($invoice->ppn_rate, 2, ',', '.'), '0'), ',') }}%</div>
                            <div class="grand-total-value">IDR {{ number_format($ppn_amount, 0, ',', '.') }}</div>
                        </div>
                    </div>
                @else
                    <!-- DPP (based on net revenue after discount) -->
                    <div class="grand-total-section">
                        <div class="grand-total-row">
                            <div class="grand-total-label">{{ __('invoice.dpp') }}</div>
                            <div class="grand-total-value">IDR {{ number_format($dpp, 0, ',', '.') }}</div>
                        </div>
                    </div>

                    <!-- PP 55 (0.5% from net revenue) -->
                    <div class="grand-total-section">
                        <div class="grand-total-row">
                            <div class="grand-total-label">{{ __('invoice.pp_55') }}</div>
                            <div class="grand-total-value">IDR {{ number_format($pph05Percent, 0, ',', '.') }}</div>
                        </div>
                    </div>

                    <!-- Grand Total -->
                    <div class="grand-total-section">
                        <div class="grand-total-row">
                            <div class="grand-total-label">{{ __('invoice.grand_total') }}</div>
                            <div class="grand-total-value">IDR {{ number_format($netRevenueAfterDiscount, 0, ',', '.') }}
                            </div>
                        </div>
                    </div>
                @endif

                <!-- Jumlah Ditagih (ENHANCED - full invoice amount including tax deposits) -->
                <!-- Total Row -->
                <div class="total-section">
                    <div class="total-row">
                        <div class="total-label">
                            @if ($is_down_payment)
                                {{ strtoupper(__('invoice.total_down_payment')) }}
                            @elseif ($is_pelunasan)
                                {{ strtoupper(__('invoice.total_settlement')) }}
                            @else
                                {{ strtoupper(__('invoice.total')) }}
                            @endif
                        </div>
                        <div class="total-value">
                            <div class="total-value-content">
                                <span>IDR</span>
                                <span>{{ number_format($display_amount, 0, ',', '.') }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Signature Section -->
                <div class="signature-section">
                    <div style="font-weight: bold; margin-bottom: 10px;">{{ $company['name'] }}</div>

                    <div class="signature-box">
                        @if ($company['signature_base64'])
                            <img src="{{ $company['signature_base64'] }}" class="signature-image" alt="Signature">
                        @endif

                        @if ($company['stamp_base64'])
                            <img src="{{ $company['stamp_base64'] }}" class="company-stamp" alt="Company Stamp">
                        @endif

                        <div class="signature-name">{{ $company['signature']['name'] ?? 'Nama Penandatangan' }}</div>
                        <div class="signature-position">{{ $company['signature']['position'] ?? 'Direktur' }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
