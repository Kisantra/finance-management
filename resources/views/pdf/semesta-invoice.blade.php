<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>Invoice {{ $invoice->invoice_number }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            font-size: 20px;
            line-height: 1.4;
            color: #000;
        }

        .container {
            max-width: 100%;
            margin: 0;
            padding: 30px;
        }

        /* Header */
        .header {
            width: 100%;
            margin-bottom: 10px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
        }

        .header-container {
            width: 100%;
            display: table;
        }

        .header-left {
            display: table-cell;
            width: 25%;
            vertical-align: middle;
            text-align: center;
        }

        .header-center {
            display: table-cell;
            width: 50%;
            vertical-align: middle;
            text-align: center;
            padding: 0 10px;
        }

        .header-right {
            display: table-cell;
            width: 25%;
            vertical-align: middle;
        }

        .company-logo {
            width: 100px;
            height: 100px;
            margin: 0 auto;
        }

        .company-logo img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .company-name {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 3px;
            line-height: 1.3;
        }

        .company-address {
            font-size: 20px;
            line-height: 1.5;
        }

        /* Invoice Title */
        .invoice-title {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            text-decoration: underline;
            margin: 20px 0 30px 0;
            letter-spacing: 2px;
        }

        /* Info Boxes */
        .info-section {
            width: 100%;
            margin-bottom: 30px;
            display: table;
            table-layout: fixed;
        }

        .info-box {
            display: table-cell;
            border: 2px solid #000;
            padding: 12px;
            vertical-align: top;
            font-size: 20px;
        }

        .info-box-left {
            width: 55%;
        }

        .info-box-right {
            width: 45%;
        }

        .info-row {
            margin-bottom: 8px;
            line-height: 1.5;
        }

        .info-label {
            display: inline-block;
            width: 75px;
        }

        .info-value {
            display: inline-block;
        }

        /* Items Table */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 20px;
        }

        .items-table th,
        .items-table td {
            border: 2px solid #000;
            padding: 10px;
            text-align: center;
            vertical-align: middle;
        }

        .items-table th {
            font-weight: bold;
            background-color: #e0e0e0;
        }

        .items-table td.number {
            width: 5%;
        }

        .items-table td.description {
            width: 30%;
            text-align: left;
        }

        .items-table td.qty {
            width: 12%;
            text-align: center;
        }

        .items-table td.unit {
            width: 8%;
            text-align: center;
        }

        .items-table td.price {
            width: 20%;
            text-align: right;
            padding: 10px 15px;
        }

        .items-table td.amount {
            width: 25%;
            text-align: right;
            padding: 10px 15px;
        }

        .items-table .price-content,
        .items-table .amount-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
        }

        .items-table .currency {
            margin-right: auto;
        }

        .items-table .value {
            margin-left: auto;
        }

        .items-table .ppn-row {
            font-size: 10px;
            padding: 2px 10px;
            border-top: none;
        }

        /* Summary Section */
        .summary-section {
            width: 100%;
            margin-top: 0;
        }

        .summary-table {
            float: right;
            width: 35%;
            border-collapse: collapse;
            font-size: 20px;
        }

        .summary-table td {
            padding: 8px 10px;
            border: 2px solid #000;
        }

        .summary-table .label {
            font-weight: bold;
            text-align: center;
            background-color: #e0e0e0;
        }

        .summary-table .amount {
            text-align: right;
        }

        .summary-table .total-row .label {
            font-weight: bold;
            background-color: #e0e0e0;
        }

        .summary-table .total-row .amount {
            font-weight: bold;
        }

        .clear {
            clear: both;
        }

        /* Terbilang Box */
        .terbilang-box {
            width: 50%;
            border: 2px solid #000;
            padding: 15px;
            margin: 30px 0;
            font-size: 20px;
        }

        .terbilang-box .title {
            text-align: center;
            font-weight: bold;
            margin-bottom: 10px;
        }

        .terbilang-box .content {
            text-align: center;
            font-style: italic;
            line-height: 1.6;
        }

        /* Payment Detail Box */
        .payment-box {
            width: 75%;
            border: 2px solid #000;
            padding: 15px 20px;
            margin: 30px 0;
            font-size: 20px;
            line-height: 1.8;
        }

        .payment-box .title {
            font-weight: bold;
            margin-bottom: 5px;
        }

        .payment-box .bank-section {
            margin-top: 10px;
        }

        .payment-box .detail-row {
            margin: 3px 0;
            display: table;
            width: 100%;
        }

        .payment-box .detail-label {
            display: table-cell;
            width: 130px;
        }

        .payment-box .detail-colon {
            display: table-cell;
            width: 20px;
        }

        .payment-box .detail-value {
            display: table-cell;
        }

        /* Signature Section */
        .signature-section {
            width: 100%;
            margin-top: 50px;
            page-break-inside: avoid;
        }

        .signature-box {
            float: right;
            width: 400px;
            text-align: center;
            font-size: 20px;
        }

        .signature-box .behalf-text {
            margin-bottom: 10px;
            font-size: 20px;
        }

        .signature-box .company-name-sig {
            font-weight: bold;
            font-style: italic;
            margin-bottom: 20px;
        }

        .signature-box .signature-image {
            margin: 20px 0;
            position: relative;
            height: 80px;
        }

        .signature-box .director-name {
            font-weight: bold;
            text-decoration: underline;
            margin-top: 10px;
        }

        .signature-box .director-title {
            font-style: italic;
            margin-top: 5px;
        }
    </style>
</head>

<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-container">
                <div class="header-left">
                    <div class="company-logo">
                        @if (!empty($company['logo_base64']))
                            <img src="{{ $company['logo_base64'] }}" alt="Logo">
                        @endif
                    </div>
                </div>
                <div class="header-center">
                    <div class="company-name">{{ strtoupper($company['name']) }}</div>
                    <div class="company-address">
                        {{ $company['address'] }}<br>
                        Samarinda - Kalimantan Timur - Indonesia<br>
                        Email : {{ $company['email'] }}
                    </div>
                </div>
                <div class="header-right">
                    <!-- Empty column for future use -->
                </div>
            </div>
        </div>

        <!-- Invoice Title -->
        <div class="invoice-title">
            <u>INVOICE</u>
        </div>

        <!-- Invoice Info -->
        <div class="info-section">
            <div class="info-box info-box-left">
                <div class="info-row">
                    <span class="info-label">To :</span>
                    <span class="info-value">{{ strtoupper($client->type === 'company' ? $client->company_name : $client->name) }}</span>
                </div>
                <div class="info-row" style="margin-left: 80px;">
                    {{ $client->address ?? '-' }}
                </div>
            </div>
            <div class="info-box info-box-right">
                <div class="info-row">
                    <span class="info-label">Invoice No</span>
                    <span>:</span>
                    <span class="info-value">{{ $invoice->invoice_number }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Date</span>
                    <span>:</span>
                    <span class="info-value">{{ $invoice->issue_date->format('d F Y') }}</span>
                </div>
                @if ($invoice->faktur)
                <div class="info-row">
                    <span class="info-label">Faktur</span>
                    <span>:</span>
                    <span class="info-value">{{ $invoice->faktur }}</span>
                </div>
                @endif
            </div>
        </div>

        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th>NO</th>
                    <th>DESCRIPTION</th>
                    <th>CARGO QTY</th>
                    <th>M<sup>3</sup></th>
                    <th>UNIT PRICE</th>
                    <th>AMOUNT</th>
                </tr>
            </thead>
            <tbody>
                @foreach($items as $index => $item)
                <tr>
                    <td class="number">{{ $index + 1 }}.</td>
                    <td class="description">{{ $item->service_name }}</td>
                    <td class="qty">{{ rtrim(rtrim(number_format($item->quantity, 2, ',', '.'), '0'), ',') }}</td>
                    <td class="unit">{{ strtoupper($item->unit ?? 'M³') }}</td>
                    <td class="price">
                        <div style="display: table; width: 100%;">
                            <span style="display: table-cell; text-align: left;">Rp</span>
                            <span style="display: table-cell; text-align: right;">{{ number_format($item->unit_price, 0, ',', '.') }}</span>
                        </div>
                    </td>
                    <td class="amount">
                        <div style="display: table; width: 100%;">
                            <span style="display: table-cell; text-align: left;">Rp</span>
                            <span style="display: table-cell; text-align: right;">{{ number_format($item->amount, 0, ',', '.') }}</span>
                        </div>
                    </td>
                </tr>
                @endforeach
            </tbody>
        </table>

        <!-- Summary Section -->
        <div class="summary-section">
            <table class="summary-table">
                @php
                    $subtotal_without_ppn = 0;
                    $total_ppn = 0;
                    $hasPpnData = $invoice->ppn_rate !== null;
                    // Invoice sejak fitur PPN memakai PPN tersimpannya; invoice lama tetap rumus lama (tarif perusahaan).
                    $ppn_rate_shown = $hasPpnData ? (float) $invoice->ppn_rate : (float) ($company['ppn_rate'] ?? 0);
                    $show_ppn = $ppn_rate_shown > 0;

                    foreach($items as $item) {
                        $subtotal_without_ppn += $item->amount;
                        if($show_ppn && ! $hasPpnData) {
                            $total_ppn += ($item->amount * $company['ppn_rate']) / 100;
                        }
                    }
                    if ($hasPpnData) {
                        $total_ppn = (int) $invoice->ppn_amount;
                    }
                @endphp
                <tr>
                    <td class="label">SUBTOTAL</td>
                    <td class="amount">Rp {{ number_format($subtotal_without_ppn, 0, ',', '.') }}</td>
                </tr>
                @if($hasPpnData && $invoice->discount_amount > 0)
                <tr>
                    <td class="label">DISCOUNT</td>
                    <td class="amount">- Rp {{ number_format($invoice->discount_amount, 0, ',', '.') }}</td>
                </tr>
                @endif
                @if($show_ppn && $total_ppn > 0)
                <tr>
                    <td class="label">PPN {{ rtrim(rtrim(number_format($ppn_rate_shown, 2, ',', '.'), '0'), ',') }}%</td>
                    <td class="amount">Rp {{ number_format($total_ppn, 0, ',', '.') }}</td>
                </tr>
                @endif
                <tr class="total-row">
                    <td class="label">TOTAL</td>
                    <td class="amount">Rp {{ number_format($hasPpnData ? $invoice->total_amount : ($show_ppn ? ($subtotal_without_ppn + $total_ppn) : $subtotal_without_ppn), 0, ',', '.') }}</td>
                </tr>
            </table>
            <div class="clear"></div>
        </div>

        <!-- Terbilang -->
        <div class="terbilang-box">
            <div class="title">Terbilang :</div>
            <div class="content">
                {{ $terbilang }} Rupiah
            </div>
        </div>

        <!-- Payment Detail -->
        <div class="payment-box">
            <div class="title">Payment Detail :</div>
            <div>Please pay the invoice in FULL AMOUNT</div>
            <div>( without bank charge )</div>
            <div class="bank-section">
                <strong>Bank Account</strong>
                @if(isset($company['bank_accounts']) && count($company['bank_accounts']) > 0)
                    @foreach($company['bank_accounts'] as $bank)
                    <div class="detail-row">
                        <span class="detail-label">Name</span>
                        <span class="detail-colon">:</span>
                        <span class="detail-value">{{ strtoupper($bank['account_name'] ?? $company['name']) }}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">A/C No.</span>
                        <span class="detail-colon">:</span>
                        <span class="detail-value">{{ $bank['account_number'] ?? '' }}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Bank</span>
                        <span class="detail-colon">:</span>
                        <span class="detail-value">{{ $bank['bank'] ?? '' }}</span>
                    </div>
                    @break
                    @endforeach
                @endif
            </div>
        </div>

        <!-- Signature -->
        <div class="signature-section">
            <div class="signature-box">
                <div class="behalf-text">For and on behalf of</div>
                <div class="company-name-sig">{{ strtoupper($company['name']) }}</div>
                <div class="signature-image">
                    @if(!empty($company['signature_base64']))
                        <img src="{{ $company['signature_base64'] }}" alt="Signature" style="max-width: 200px; max-height: 100px;">
                    @endif
                    @if(!empty($company['stamp_base64']))
                        <img src="{{ $company['stamp_base64'] }}" alt="Stamp" style="position: absolute; left: 120px; top: -20px; max-width: 180px; max-height: 150px; opacity: 0.6;">
                    @endif
                </div>
                <div class="director-name">{{ $company['signature']['name'] ?? 'Director Name' }}</div>
                <div class="director-title">{{ $company['signature']['position'] ?? 'Direktur' }}</div>
            </div>
            <div class="clear"></div>
        </div>
    </div>
</body>

</html>
