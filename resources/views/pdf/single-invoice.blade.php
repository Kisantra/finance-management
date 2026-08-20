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
            font-size: 15px;
            line-height: 1.4;
            color: #333;
        }

        .container {
            max-width: 100%;
            margin: 0;
            padding: 15px;
        }

        /* Header dengan logo JKB */
        .header {
            @if (!empty($company['logo_base64']))
                background: url('{{ $company['logo_base64'] }}') no-repeat center;
                background-size: cover;
            @else
                background: linear-gradient(90deg, #ff6b35 0%, #1e3a8a 100%);
            @endif
            height: 200px;
            margin: -15px -20px 0px -15px;
            border: none;
        }

        .logo-section {
            display: table;
            width: 100%;
        }

        .logo {
            display: table-cell;
            width: 80px;
            vertical-align: middle;
        }

        .logo-text {
            font-size: 48px;
            font-weight: bold;
            color: white;
            line-height: 0.8;
        }

        .company-info {
            display: table-cell;
            vertical-align: middle;
            padding-left: 15px;
        }

        .company-name {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .company-address {
            font-size: 15px;
            line-height: 1.3;
            margin-bottom: 8px;
        }

        .company-contact {
            font-size: 15px;
        }

        .contact-item {
            display: inline-block;
            margin-right: 20px;
        }

        /* Invoice Title */
        .invoice-title {
            background: #1F4E78;
            color: white;
            text-align: center;
            padding: 0px;
            margin: 0px -20px 20px -15px;
            font-size: 20px;
            font-weight: bold;
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
            color: #1e3a8a;
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
            background: #e9ecef;
            border: 1px solid #dee2e6;
            width: 40%;
        }

        .info-value {
            display: table-cell;
            padding: 8px;
            border: 1px solid #dee2e6;
        }

        /* Items Table */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }

        .items-table th {
            background: #DD7711;
            color: white;
            border: 2px solid #000000;
            padding: 10px 8px;
            text-align: center;
            font-weight: bold;
            font-size: 15px;
        }

        .items-table td {
            border: 1px solid #000000;
            padding: 10px 8px;
            text-align: center;
            font-size: 15px;
        }

        .items-table .text-left {
            text-align: left;
        }

        .items-table .text-right {
            text-align: right;
        }

        /* Currency formatting with justify space-between for table cells */
        .currency-cell {
            display: table;
            width: 100%;
        }

        .currency-left {
            display: table-cell;
            text-align: left;
            width: 30%;
        }

        .currency-right {
            display: table-cell;
            text-align: right;
            width: 70%;
        }

        /* Total Section */
        .total-section {
            width: 100%;
            margin-bottom: 20px;
        }

        .total-row {
            display: table;
            width: 100%;
            margin-bottom: 5px;
        }

        .total-label {
            display: table-cell;
            font-weight: bold;
            padding: 8px;
            color: black;
            border-top: 1px solid #000000;
            border-bottom: 3px double #000000;
            font-style: italic;
        }

        .total-value {
            display: table-cell;
            font-weight: bold;
            padding: 8px;
            background: #2F75B5;
            color: white;
            border: 1px solid #2F75B5;
            font-style: italic;
        }

        .total-value-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
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
            background: #BFBFBF;
            color: black;
            border: 1px solid #BFBFBF;
            font-size: 16px;
        }

        .grand-total-value {
            display: table-cell;
            font-weight: bold;
            padding: 3px;
            background: #BFBFBF;
            color: black;
            border: 1px solid #BFBFBF;
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
        }

        .payment-title {
            font-weight: bold;
            margin-bottom: 5px;
            color: #1e3a8a;
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
            border-left: 3px solid #ff6b35;
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
            top: -15px;
            width: 40px;
            height: auto;
        }
    </style>
</head>

<body>
    <div class="container">
        <!-- Header dengan Logo -->
        <div class="header"></div>

        <!-- Invoice Title -->
        <div class="invoice-title">INVOICE</div>

        <!-- Main Content -->
        <div class="main-content">
            <div class="left-section">
                <div class="section-title">TAGIHAN KEPADA :</div>
                <div class="client-name">{{ strtoupper($client->name) }}</div>
            </div>

            <div class="right-section">
                <div class="info-grid">
                    <div class="info-row">
                        <div class="info-label">TANGGAL</div>
                        <div class="info-value">{{ $invoice->issue_date->format('d M Y') }}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">No. INVOICE</div>
                        <div class="info-value">{{ $invoice->invoice_number }}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">TERMIN</div>
                        <div class="info-value">-</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">DUE DATE</div>
                        <div class="info-value">{{ $invoice->due_date->format('d M Y') }}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 8%;">NO</th>
                    <th style="width: 52%;">DESKRIPSI PEKERJAAN</th>
                    <th style="width: 10%;">QTY</th>
                    <th style="width: 15%;">BIAYA SATUAN</th>
                    <th style="width: 15%;">JUMLAH</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($items as $index => $item)
                    <tr>
                        <td>{{ $index + 1 }}</td>
                        <td class="text-left">{{ $item->service_name }}</td>
                        <td>{{ rtrim(rtrim(number_format($item->quantity, 3, ',', '.'), '0'), ',') }} {{ $item->unit ?? 'pcs' }}</td>
                        <td>
                            <div class="currency-cell">
                                <div class="currency-left">IDR</div>
                                <div class="currency-right">{{ number_format($item->unit_price, 0, ',', '.') }}</div>
                            </div>
                        </td>
                        <td>
                            <div class="currency-cell">
                                <div class="currency-left">IDR</div>
                                <div class="currency-right">{{ number_format($item->amount, 0, ',', '.') }}</div>
                            </div>
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <!-- Footer Section Grid -->
        <div class="footer-section">
            <!-- Kolom Kiri: Payment Methods, Terbilang, Jumlah Ditagih -->
            <div class="footer-left">
                <!-- Payment Methods -->
                @foreach (($company['bank_accounts'] ?? []) as $index => $bank)
                    <div class="payment-method">
                        <div class="payment-title">Metode Pembayaran #{{ $index + 1 }}</div>
                        <div class="bank-info">
                            <strong>Bank:</strong> {{ $bank['bank'] }}<br>
                            <strong>No. Rek:</strong> {{ $bank['account_number'] }}<br>
                            <strong>Atas Nama:</strong> {{ $bank['account_name'] }}
                        </div>
                    </div>
                @endforeach

                <!-- Terbilang -->
                <div class="terbilang">
                    Terbilang:<br>
                    <strong>{{ $terbilang }} Rupiah</strong>
                </div>
            </div>

            <!-- Kolom Kanan: Grand Total dan Signature -->
            <div class="footer-right">
                <!-- Discount Section (if applicable) -->
                @if ($invoice->discount_amount > 0)
                    <div class="grand-total-section">
                        <div class="grand-total-row">
                            <div class="grand-total-label">DISKON</div>
                            <div class="grand-total-value">IDR
                                -{{ number_format($invoice->discount_amount, 0, ',', '.') }}</div>
                        </div>
                    </div>
                @endif

                <!-- Grand Total -->
                <div class="grand-total-section">
                    <div class="grand-total-row">
                        <div class="grand-total-label">GRAND TOTAL</div>
                        <div class="grand-total-value">IDR {{ number_format($invoice->total_amount, 0, ',', '.') }}
                        </div>
                    </div>
                </div>

                <!-- Jumlah Ditagih -->
                <div class="total-section">
                    <div class="total-row">
                        <div class="total-label">JUMLAH DITAGIH</div>
                        <div class="total-value">
                            <div class="total-value-content">
                                <span>IDR</span>
                                <span>{{ number_format($invoice->total_amount, 0, ',', '.') }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Signature Section -->
                <div class="signature-section">
                    <div style="font-weight: bold; margin-bottom: 10px;">{{ $company['name'] }}</div>

                    <div class="signature-box">
                        @if (!empty($company['signature_base64']))
                            <img src="{{ $company['signature_base64'] }}" class="signature-image" alt="Signature">
                        @endif

                        @if (!empty($company['stamp_base64']))
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
