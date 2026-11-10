<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice - {{ $invoice->invoice_number }}</title>
    <style>
        @page {
            margin: 10mm 10mm 10mm 10mm;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #000;
            padding: 80px 80px 30px 80px;
        }

        .container {
            width: 100%;
            max-width: 210mm;
            margin: 0 auto;
        }

        /* Header Grid: 2 Columns */
        .header-grid {
            width: 100%;
            margin-bottom: 20px;
            display: table;
        }

        .header-grid-left {
            display: table-cell;
            width: 50%;
            vertical-align: top;
            padding-right: 15px;
        }

        .header-grid-right {
            display: table-cell;
            width: 50%;
            vertical-align: top;
            padding-left: 15px;
            text-align: right;
        }

        .logo {
            width: 350px;
            height: auto;
        }

        .company-info {
            font-size: 8pt;
            line-height: 1.5;
            text-align: right;
        }

        .client-name {
            font-weight: bold;
            font-size: 8pt;
            margin-bottom: 5px;
        }

        .invoice-meta {
            font-weight: bold;
            font-size: 8pt;
            text-align: right;
        }

        .periode {
            padding: 0;
            font-size: 8pt;
            font-weight: normal;
            text-align: left;
            margin-top: 10px;
        }

        /* Items Table */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            margin-bottom: 0;
            border: 2px solid #000;
        }

        .items-table thead th {
            background-color: #ffc000;
            color: #000;
            padding: 0;
            text-align: left;
            font-size: 10pt;
            font-weight: bold;
            border: 2px solid #000;
        }

        .items-table tbody td {
            padding: 1px 3px;
            border: 1px solid #000;
            font-size: 10pt;
            vertical-align: top;
        }

        .items-table tbody tr:last-child td {
            border-bottom: none;
        }

        .text-left {
            text-align: left;
        }

        .text-center {
            text-align: center;
        }

        .text-right {
            text-align: right;
        }

        /* Summary Box */
        .summary-box {
            width: 100%;
            margin-bottom: 20px;
        }

        .summary-row {
            width: 100%;
            display: table;
            margin-bottom: 3px;
        }

        .summary-label {
            display: table-cell;
            width: 70%;
            text-align: right;
            padding-right: 15px;
            font-size: 11pt;
        }

        .summary-value {
            display: table-cell;
            width: 30%;
            text-align: right;
            font-size: 11pt;
        }

        .summary-row.bold .summary-label,
        .summary-row.bold .summary-value {
            font-weight: bold;
        }

        .summary-row.total {
            border-top: 2px solid #1e3a8a;
            padding-top: 5px;
            margin-top: 5px;
        }

        .summary-row.total .summary-label,
        .summary-row.total .summary-value {
            font-size: 12pt;
            font-weight: bold;
        }

        /* Bank Section */
        .bank-section {
            margin-top: 60px;
            margin-bottom: 30px;
        }

        .bank-title {
            font-weight: bold;
            font-size: 8pt;
            margin-bottom: 10px;
        }

        .bank-table {
            width: 75%;
            margin-left: auto;
            border-collapse: collapse;
            border: 2px solid #000;
            margin-top: 10px;
        }

        .bank-table thead th {
            background-color: #fff;
            color: #000;
            padding: 4px 8px;
            text-align: center;
            font-size: 8pt;
            font-weight: bold;
            border: 1px solid #000;
        }

        .bank-table tbody td {
            padding: 4px 8px;
            border: 1px solid #000;
            font-size: 8pt;
        }

        /* Signature */
        .signature-section {
            margin-top: 40px;
            width: 75%;
            margin-left: auto;
        }

        .signature-location {
            font-size: 7pt;
            margin-bottom: 5px;
            margin-right: 80px;
            text-align: right;
        }

        .signature-box {
            width: 280px;
            border: 2px solid #000;
            text-align: center;
            margin-left: auto;
            padding: 15px;
            position: relative;
        }

        .signature-content {
            min-height: 100px;
            margin-bottom: 15px;
        }

        .signature-image {
            max-width: 150px;
            height: auto;
        }

        .stamp-image {
            position: absolute;
            right: 20px;
            top: 20px;
            max-width: 80px;
            height: auto;
        }

        .signature-name {
            font-size: 7pt;
            padding: 8px 0;
            border-bottom: 1px solid #000;
        }

        .signature-position {
            font-size: 7pt;
            font-weight: bold;
            padding-top: 8px;
        }
    </style>
</head>

<body>
    <div class="container">
        <!-- Header Grid: 2 Columns -->
        <div class="header-grid">
            <!-- Left Column: Logo + Client + Periode -->
            <div class="header-grid-left">
                <!-- Logo -->
                <div style="margin-bottom: 50px;">
                    @if (!empty($company['logo_base64']))
                        <img src="{{ $company['logo_base64'] }}" class="logo" alt="Logo">
                    @else
                        {{-- Placeholder for design review --}}
                        <div
                            style="width: 350px; height: 80px; background: #e5e7eb; display: flex; align-items: center; justify-content: center; border: 1px solid #ccc;">
                            <span style="color: #666; font-size: 18pt; font-weight: bold;">AGSA LOGO</span>
                        </div>
                    @endif
                </div>

                <!-- Client Info -->
                <div style="margin-bottom: 90px;">
                    <div style="display: table; width: 100%;">
                        <div style="display: table-row;">
                            <div
                                style="display: table-cell; width: 30px; vertical-align: top; padding-right: 5px; font-size: 8pt;">
                                {{ __('invoice.bill_to') }}:</div>
                            <div style="display: table-cell; vertical-align: top;">
                                <div class="client-name">PT. GANDA ALAM MAKMUR</div>
                            </div>
                        </div>
                        <div style="display: table-row;">
                            <div style="display: table-cell;"></div>
                            <div style="display: table-cell; vertical-align: top;">
                                <div style="font-size: 8pt;">DI SEMPAYAU</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Periode -->
                <div class="periode">{{ __('invoice.period') }} 21 SEPTEMBER 2025 - 20 OKTOBER 2025</div>
            </div>

            <!-- Right Column: Company Info + Invoice Meta -->
            <div class="header-grid-right">
                <!-- Company Info -->
                <div class="company-info" style="margin-bottom: 30px; margin-top: 30px;">
                    Jalan AW Syahranie Perum Villa Tamara Blok L No. 9<br>
                    Samarinda, Kalimantan Timur - Indonesia<br>
                    0813 1177 1117<br>
                    <a href="/cdn-cgi/l/email-protection" class="__cf_email__"
                        data-cfemail="5d3c3a2f3c2d3c333c2e3c29243c3c3f3c3934732d291d3a303c3431733e3230">[email&#160;protected]</a>
                </div>

                <!-- Invoice Meta -->
                <div class="invoice-meta" style="text-align: right; margin-top: 30px;">
                    <table style="width: auto; border-collapse: collapse; margin-left: auto;">
                        <tr>
                            <td style="padding: 2px 5px 2px 0; font-size: 8pt; white-space: nowrap;">{{ strtoupper(__('invoice.invoice_number')) }}</td>
                            <td style="padding: 2px 5px; font-size: 8pt;">:</td>
                            <td style="padding: 2px 0 2px 5px; font-size: 8pt;">075/AGSA-GAM/INVOICE/X/2025</td>
                        </tr>
                        <tr>
                            <td style="padding: 2px 5px 2px 0; font-size: 8pt; white-space: nowrap;">{{ strtoupper('Tanggal') }}</td>
                            <td style="padding: 2px 5px; font-size: 8pt;">:</td>
                            <td style="padding: 2px 0 2px 5px; font-size: 8pt;">21 Oktober 2025</td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>

        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 5%; text-align: center;">{{ strtoupper(__('invoice.no')) }}</th>
                    <th style="width: 70%; text-align: center;">{{ strtoupper(__('invoice.description')) }}</th>
                    <th style="width: 25%; text-align: center;">{{ strtoupper(__('invoice.amount')) }}</th>
                </tr>
            </thead>
            <tbody>
                <!-- Empty row separator for double line effect -->
                <tr>
                    <td colspan="3"
                        style="padding: 2px; border: none; border-left: 2px solid #000; border-right: 2px solid #000;">
                    </td>
                </tr>
                @foreach ($items as $index => $item)
                    <tr>
                        <td class="text-center">{{ $index + 1 }}</td>
                        <td class="text-left">{{ $item->service_name }}</td>
                        <td class="text-right">Rp {{ number_format($item->amount, 0, ',', '.') }}</td>
                    </tr>
                @endforeach
                <!-- Empty row separator after last item -->
                <tr>
                    <td colspan="3"
                        style="padding: 2px; border: none; border-left: 2px solid #000; border-right: 2px solid #000;">
                    </td>
                </tr>
            </tbody>
        </table>

        <!-- Summary Box -->
        @php
            $subtotalI = $invoice->subtotal;
            $dpp = $subtotalI * 0.029;
            $ppn = $dpp * 0.12;
            $subtotalII = $subtotalI + $dpp + $ppn;
            $pph23 = $subtotalI * 0.02;
            $grandTotal = $subtotalII - $pph23;

            // Fungsi Terbilang untuk konversi angka ke kata
            function terbilang($angka)
            {
                $angka = abs($angka);
                $huruf = [
                    '',
                    'Satu',
                    'Dua',
                    'Tiga',
                    'Empat',
                    'Lima',
                    'Enam',
                    'Tujuh',
                    'Delapan',
                    'Sembilan',
                    'Sepuluh',
                    'Sebelas',
                ];
                $hasil = '';

                if ($angka < 12) {
                    $hasil = ' ' . $huruf[$angka];
                } elseif ($angka < 20) {
                    $hasil = terbilang($angka - 10) . ' Belas';
                } elseif ($angka < 100) {
                    $hasil = terbilang($angka / 10) . ' Puluh' . terbilang($angka % 10);
                } elseif ($angka < 200) {
                    $hasil = ' Seratus' . terbilang($angka - 100);
                } elseif ($angka < 1000) {
                    $hasil = terbilang($angka / 100) . ' Ratus' . terbilang($angka % 100);
                } elseif ($angka < 2000) {
                    $hasil = ' Seribu' . terbilang($angka - 1000);
                } elseif ($angka < 1000000) {
                    $hasil = terbilang($angka / 1000) . ' Ribu' . terbilang($angka % 1000);
                } elseif ($angka < 1000000000) {
                    $hasil = terbilang($angka / 1000000) . ' Juta' . terbilang($angka % 1000000);
                } elseif ($angka < 1000000000000) {
                    $hasil = terbilang($angka / 1000000000) . ' Milyar' . terbilang($angka % 1000000000);
                } elseif ($angka < 1000000000000000) {
                    $hasil = terbilang($angka / 1000000000000) . ' Triliun' . terbilang($angka % 1000000000000);
                }

                return trim($hasil);
            }

            $terbilang = terbilang($grandTotal) . ' Rupiah';
        @endphp

        <table
            style="width: 100%; border-left: 2px solid #000; border-right: 2px solid #000; border-bottom: 2px solid #000; border-top: none; border-collapse: collapse; margin-top: 0;">
            <tbody>
                <tr>
                    <td
                        style="border-left: 2px solid #000; border-right: 0; padding: 4px 8px; width: 50%; font-size: 10pt;">
                    </td>
                    <td
                        style="border-left: 0; border-right: 0; padding: 4px 8px; width: 3%; text-align: center; font-size: 10pt;">
                        I</td>
                    <td style="border-left: 0; border-right: 0; padding: 4px 8px; width: 22%; font-size: 10pt;">{{ __('invoice.subtotal') }} I :</td>
                    <td
                        style="border-left: 0; border-right: 0; padding: 4px 8px; width: 5%; text-align: left; font-size: 10pt;">
                        Rp</td>
                    <td
                        style="border-left: 0; border-right: 2px solid #000; padding: 4px 8px; width: 20%; text-align: right; font-size: 10pt;">
                        {{ number_format($subtotalI, 0, ',', '.') }}</td>
                </tr>
                <tr>
                    <td style="border-left: 2px solid #000; border-right: 0; padding: 4px 8px;"></td>
                    <td style="border-left: 0; border-right: 0; padding: 4px 8px; text-align: center; font-size: 10pt;">
                        II</td>
                    <td style="border-left: 0; border-right: 0; padding: 4px 8px; font-size: 10pt;">DPP</td>
                    <td style="border-left: 0; border-right: 0; padding: 4px 8px; text-align: left; font-size: 10pt;">Rp
                    </td>
                    <td
                        style="border-left: 0; border-right: 2px solid #000; padding: 4px 8px; text-align: right; font-size: 10pt;">
                        {{ number_format($dpp, 0, ',', '.') }}</td>
                </tr>
                <tr>
                    <td style="border-left: 2px solid #000; border-right: 0; padding: 4px 8px;"></td>
                    <td style="border-left: 0; border-right: 0; padding: 4px 8px; text-align: center; font-size: 10pt;">
                        III</td>
                    <td style="border-left: 0; border-right: 0; padding: 4px 8px; font-size: 10pt;">PPN</td>
                    <td style="border-left: 0; border-right: 0; padding: 4px 8px; text-align: left; font-size: 10pt;">Rp
                    </td>
                    <td
                        style="border-left: 0; border-right: 2px solid #000; padding: 4px 8px; text-align: right; font-size: 10pt;">
                        {{ number_format($ppn, 0, ',', '.') }}</td>
                </tr>
                <tr>
                    <td style="border-left: 2px solid #000; border-right: 0; padding: 4px 8px;"></td>
                    <td style="border-left: 0; border-right: 0; padding: 4px 8px; text-align: center; font-size: 10pt;">
                        IV</td>
                    <td style="border-left: 0; border-right: 0; padding: 4px 8px; font-size: 10pt;">{{ __('invoice.subtotal') }} II :</td>
                    <td style="border-left: 0; border-right: 0; padding: 4px 8px; text-align: left; font-size: 10pt;">Rp
                    </td>
                    <td
                        style="border-left: 0; border-right: 2px solid #000; padding: 4px 8px; text-align: right; font-size: 10pt;">
                        {{ number_format($subtotalII, 0, ',', '.') }}</td>
                </tr>
                <tr>
                    <td style="border-left: 2px solid #000; border-right: 0; padding: 4px 8px;"></td>
                    <td style="border-left: 0; border-right: 0; padding: 4px 8px; text-align: center; font-size: 10pt;">
                        V</td>
                    <td style="border-left: 0; border-right: 0; padding: 4px 8px; font-size: 10pt; color: #800080;">PPh
                        ps 23 (2%) :</td>
                    <td
                        style="border-left: 0; border-right: 0; padding: 4px 8px; text-align: left; font-size: 10pt; color: #800080;">
                        Rp</td>
                    <td
                        style="border-left: 0; border-right: 2px solid #000; padding: 4px 8px; text-align: right; font-size: 10pt; color: #800080;">
                        ({{ number_format($pph23, 0, ',', '.') }})</td>
                </tr>
                <tr>
                    <td style="border: 2px solid #000; border-top: 2px solid #000; border-bottom: 0; padding: 4px 8px;">
                    </td>
                    <td colspan="2"
                        style="border-top: 2px solid #000; border-bottom: 0; border-left: 0; border-right: 0; padding: 4px 8px; text-align: right; font-size: 10pt; font-weight: bold;">
                        {{ __('invoice.grand_total') }} :</td>
                    <td
                        style="border-top: 2px solid #000; border-bottom: 0; border-left: 0; border-right: 0; padding: 4px 8px; text-align: left; font-size: 10pt; font-weight: bold;">
                        Rp</td>
                    <td
                        style="border: 2px solid #000; border-top: 2px solid #000; border-bottom: 0; border-left: 0; padding: 4px 8px; text-align: right; font-size: 10pt; font-weight: bold;">
                        {{ number_format($grandTotal, 0, ',', '.') }}</td>
                </tr>
                <tr>
                    <td colspan="5"
                        style="border: 2px solid #000; border-top: 2px solid #000; padding: 6px 8px; font-size: 9pt; font-style: italic; text-align: center;">
                        {{ __('invoice.say') }} : <i>{{ $terbilang }}</i>
                    </td>
                </tr>
            </tbody>
        </table>

        <!-- Bank Details -->
        <div class="bank-section">
            <div class="bank-title">{{ __('invoice.please_remit_to') }} :</div>
            <table class="bank-table">
                <thead>
                    <tr>
                        <th style="width: 5%;">{{ __('invoice.no') }}</th>
                        <th style="width: 28%;">{{ __('invoice.company_name') }}</th>
                        <th style="width: 22%;">{{ __('invoice.bank_account') }}</th>
                        <th style="width: 25%;">{{ __('invoice.description') }}</th>
                        <th style="width: 20%;">{{ __('invoice.amount') }}</th>
                    </tr>
                </thead>
                <tbody>
                    @php
                        $biayaTenagaKerja = $subtotalI + $dpp + $ppn - $pph23;
                        $biayaOperasional = 0;
                    @endphp
                    <tr>
                        <td class="text-center">1</td>
                        <td>Agrapana Satya Abadi PT</td>
                        <td>1444569995</td>
                        <td>{{ __('invoice.labor_cost') }}</td>
                        <td class="text-right">Rp {{ number_format($biayaTenagaKerja, 0, ',', '.') }}</td>
                    </tr>
                    <tr>
                        <td class="text-center">2</td>
                        <td>Agrapana Satya Abadi PT</td>
                        <td>2997898888</td>
                        <td>{{ __('invoice.operational_cost') }}</td>
                        <td class="text-right">Rp {{ number_format($biayaOperasional, 0, ',', '.') }}</td>
                    </tr>
                    <tr>
                        <td colspan="4" style="text-align: center; font-weight: bold;">{{ strtoupper(__('invoice.total')) }}</td>
                        <td class="text-right" style="font-weight: bold;">Rp
                            {{ number_format($grandTotal, 0, ',', '.') }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Signature -->
        <div class="signature-section">
            <div class="signature-location">
                SEMPAWAU, {{ now()->format('d-M-y') }}
            </div>

            <div class="signature-box">
                <div class="signature-content">
                    @if (!empty($company['signature_base64']))
                        <img src="{{ $company['signature_base64'] }}" class="signature-image" alt="Signature">
                    @endif

                    @if (!empty($company['stamp_base64']))
                        <img src="{{ $company['stamp_base64'] }}" class="stamp-image" alt="Stamp">
                    @endif
                </div>

                <div class="signature-name">Nurmaisa Hamzah</div>
                <div class="signature-position">HR Foreman</div>
            </div>
        </div>
    </div>
</body>

</html>
