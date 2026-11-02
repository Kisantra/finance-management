<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice {{ $invoice->invoice_number }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
        }

        .container {
            max-width: 100%;
            margin: 0 auto;
            padding: 20px;
        }

        /* Header Styles */
        .header {
            display: table;
            width: 100%;
            margin-bottom: 30px;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 20px;
        }

        .header-left {
            display: table-cell;
            width: 60%;
            vertical-align: top;
        }

        .header-right {
            display: table-cell;
            width: 40%;
            vertical-align: top;
            text-align: right;
        }

        .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #3b82f6;
            margin-bottom: 5px;
        }

        .company-info {
            font-size: 11px;
            color: #666;
            line-height: 1.4;
        }

        .invoice-title {
            font-size: 28px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
        }

        .invoice-number {
            font-size: 14px;
            font-weight: bold;
            color: #3b82f6;
            font-family: monospace;
        }

        /* Invoice Info Section */
        .invoice-info {
            display: table;
            width: 100%;
            margin-bottom: 30px;
        }

        .invoice-info-left {
            display: table-cell;
            width: 50%;
            vertical-align: top;
        }

        .invoice-info-right {
            display: table-cell;
            width: 50%;
            vertical-align: top;
            padding-left: 20px;
        }

        .info-section {
            margin-bottom: 20px;
        }

        .info-title {
            font-size: 11px;
            font-weight: bold;
            color: #666;
            margin-bottom: 8px;
            text-transform: uppercase;
        }

        .info-content {
            font-size: 12px;
            line-height: 1.6;
        }

        .client-name {
            font-size: 14px;
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }

        /* Items Table */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }

        .items-table th {
            background: #3b82f6;
            color: white;
            padding: 10px 8px;
            text-align: left;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            border: 1px solid #2563eb;
        }

        .items-table td {
            padding: 10px 8px;
            border: 1px solid #e5e7eb;
            font-size: 11px;
        }

        .items-table tbody tr:nth-child(even) {
            background: #f9fafb;
        }

        .text-right {
            text-align: right;
        }

        .text-center {
            text-align: center;
        }

        /* Summary Section */
        .summary-section {
            width: 40%;
            margin-left: auto;
            margin-bottom: 30px;
        }

        .summary-row {
            display: table;
            width: 100%;
            margin-bottom: 5px;
        }

        .summary-label {
            display: table-cell;
            padding: 5px 10px;
            font-size: 11px;
            text-align: right;
        }

        .summary-value {
            display: table-cell;
            padding: 5px 10px;
            font-size: 11px;
            text-align: right;
            width: 40%;
        }

        .summary-row.total {
            border-top: 2px solid #3b82f6;
            border-bottom: 2px solid #3b82f6;
            font-weight: bold;
            background: #eff6ff;
        }

        .summary-row.total .summary-label,
        .summary-row.total .summary-value {
            padding: 10px;
            font-size: 13px;
            color: #1e40af;
        }

        /* Footer */
        .footer {
            display: table;
            width: 100%;
            margin-top: 40px;
        }

        .footer-left {
            display: table-cell;
            width: 50%;
            vertical-align: top;
        }

        .footer-right {
            display: table-cell;
            width: 50%;
            vertical-align: top;
            padding-left: 20px;
        }

        .payment-info {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 15px;
        }

        .payment-title {
            font-weight: bold;
            color: #3b82f6;
            margin-bottom: 8px;
            font-size: 11px;
        }

        .payment-details {
            font-size: 11px;
            line-height: 1.6;
        }

        .notes {
            font-size: 10px;
            color: #666;
            font-style: italic;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
        }

        .signature-box {
            text-align: center;
            padding-top: 60px;
            position: relative;
        }

        .signature-image {
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 100px;
            height: auto;
        }

        .signature-name {
            font-weight: bold;
            border-bottom: 1px solid #333;
            padding-bottom: 5px;
            margin-bottom: 5px;
            display: inline-block;
            min-width: 150px;
        }

        .signature-position {
            font-size: 11px;
            color: #666;
        }

        .terbilang {
            background: #fef3c7;
            border-left: 3px solid #f59e0b;
            padding: 10px;
            margin: 15px 0;
            font-style: italic;
            font-size: 11px;
        }
    </style>
</head>

<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-left">
                <div class="company-name">{{ $company['name'] }}</div>
                <div class="company-info">
                    {{ $company['address'] }}<br>
                    Telp: {{ $company['phone'] }} | Email: {{ $company['email'] }}
                </div>
            </div>
            <div class="header-right">
                <div class="invoice-title">{{ __('invoice.invoice') }}</div>
                <div class="invoice-number">{{ $invoice->invoice_number }}</div>
            </div>
        </div>

        <!-- Invoice Info -->
        <div class="invoice-info">
            <div class="invoice-info-left">
                <div class="info-section">
                    <div class="info-title">{{ __('invoice.bill_to') }}:</div>
                    <div class="info-content">
                        <div class="client-name">{{ strtoupper($client->name) }}</div>
                        @if ($client->address)
                            {{ $client->address }}
                        @endif
                    </div>
                </div>
            </div>
            <div class="invoice-info-right">
                <div class="info-section">
                    <div class="info-title">{{ __('invoice.invoice_details') }}:</div>
                    <div class="info-content">
                        <strong>{{ __('invoice.invoice_date') }}:</strong> {{ $invoice->issue_date->format('d M Y') }}<br>
                        <strong>{{ __('invoice.due_date') }}:</strong> {{ $invoice->due_date->format('d M Y') }}<br>
                        @if ($invoice->faktur)
                            <strong>{{ __('invoice.faktur') }}:</strong> {{ $invoice->faktur }}<br>
                        @endif
                        @if ($invoice->status)
                            <strong>{{ __('common.status') }}:</strong> {{ ucfirst($invoice->status) }}
                        @endif
                    </div>
                </div>
            </div>
        </div>

        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 5%;">{{ __('invoice.no') }}</th>
                    <th style="width: 50%;">{{ __('invoice.description') }}</th>
                    <th style="width: 10%;" class="text-center">{{ __('invoice.qty') }}</th>
                    <th style="width: 15%;" class="text-right">{{ __('invoice.unit_price') }}</th>
                    <th style="width: 20%;" class="text-right">{{ __('invoice.amount') }}</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($items as $index => $item)
                    <tr>
                        <td class="text-center">{{ $index + 1 }}</td>
                        <td>{{ $item->service_name }}</td>
                        <td class="text-center">{{ rtrim(rtrim(number_format($item->quantity, 3, ',', '.'), '0'), ',') }} {{ $item->unit ?? 'pcs' }}</td>
                        <td class="text-right">Rp {{ number_format($item->unit_price, 0, ',', '.') }}</td>
                        <td class="text-right">Rp {{ number_format($item->amount, 0, ',', '.') }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <!-- Summary -->
        <div class="summary-section">
            <div class="summary-row">
                <div class="summary-label">{{ __('invoice.subtotal') }}:</div>
                <div class="summary-value">Rp {{ number_format($invoice->subtotal, 0, ',', '.') }}</div>
            </div>

            @if ($invoice->discount_amount > 0)
                <div class="summary-row">
                    <div class="summary-label">{{ __('invoice.discount') }}:</div>
                    <div class="summary-value">-Rp {{ number_format($invoice->discount_amount, 0, ',', '.') }}</div>
                </div>
            @endif

            @if ($invoice->ppn_rate !== null && $invoice->ppn_amount > 0)
                <div class="summary-row">
                    <div class="summary-label">{{ __('invoice.ppn') }} {{ rtrim(rtrim(number_format($invoice->ppn_rate, 2, ',', '.'), '0'), ',') }}%:</div>
                    <div class="summary-value">Rp {{ number_format($invoice->ppn_amount, 0, ',', '.') }}</div>
                </div>
            @endif

            <div class="summary-row total">
                <div class="summary-label">{{ strtoupper(__('invoice.total')) }}:</div>
                <div class="summary-value">Rp {{ number_format($invoice->total_amount, 0, ',', '.') }}</div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <div class="footer-left">
                <!-- Payment Info -->
                @foreach ($company['bank_accounts'] as $index => $bank)
                    <div class="payment-info">
                        <div class="payment-title">{{ __('invoice.payment_to_account') }} #{{ $index + 1 }}</div>
                        <div class="payment-details">
                            <strong>{{ __('invoice.bank_name') }}:</strong> {{ $bank['bank'] }}<br>
                            <strong>{{ __('invoice.account_number') }}:</strong> {{ $bank['account_number'] }}<br>
                            <strong>{{ __('invoice.account_holder') }}:</strong> {{ $bank['account_name'] }}
                        </div>
                    </div>
                @endforeach

                <!-- Terbilang -->
                <div class="terbilang">
                    <strong>{{ __('invoice.say') }}:</strong> {{ $terbilang }} {{ __('invoice.rupiah') }}
                </div>

                <!-- Notes -->
                <div class="notes">
                    {{ __('invoice.payment_before_due_date') }}<br>
                    {{ __('invoice.thank_you') }}
                </div>
            </div>

            <div class="footer-right">
                <!-- Signature -->
                <div class="signature-box">
                    @if (!empty($company['signature_base64']))
                        <img src="{{ $company['signature_base64'] }}" class="signature-image" alt="Signature">
                    @endif

                    <div style="font-weight: bold; margin-bottom: 10px;">{{ $company['name'] }}</div>
                    <div class="signature-name">{{ $company['signature']['name'] ?? 'Nama Penandatangan' }}</div>
                    <div class="signature-position">{{ $company['signature']['position'] ?? 'Direktur' }}</div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
