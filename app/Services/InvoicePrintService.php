<?php

namespace App\Services;

use App\Models\CompanyProfile;
use App\Models\Invoice;
use Barryvdh\DomPDF\Facade\Pdf;

class InvoicePrintService
{
    /** Template Blade bawaan yang boleh dirender. */
    public const BLADE_TEMPLATES = ['kisantra-invoice', 'semesta-invoice', 'agsa-invoice', 'invoice'];

    public function generateSingleInvoicePdf(Invoice $invoice, ?int $dpAmount = null, ?int $pelunasanAmount = null, string $template = 'kisantra-invoice')
    {
        $invoice->load(['client', 'items.client', 'payments.bankAccount']);

        return $this->renderPdf($invoice, $dpAmount, $pelunasanAmount, $template);
    }

    /**
     * Satu-satunya jalur render PDF invoice (template Blade). Unduhan dan pratinjau langsung di
     * editor sama-sama lewat sini, sehingga pratinjau adalah PDF yang sama persis dengan hasil ekspor.
     * Relasi client, items.client, dan payments harus sudah terpasang (boleh model yang belum disimpan).
     *
     * $highlightRow (0-based) hanya untuk pratinjau editor: mewarnai baris item yang sedang diedit.
     */
    public function renderPdf(Invoice $invoice, ?int $dpAmount = null, ?int $pelunasanAmount = null, string $template = 'kisantra-invoice', ?int $highlightRow = null): \Barryvdh\DomPDF\PDF
    {
        $html = view('pdf.'.$template, $this->buildViewData($invoice, $dpAmount, $pelunasanAmount, $template))->render();

        if ($highlightRow !== null) {
            $style = '<style>.items-table tbody tr:nth-child('.($highlightRow + 1).') td{background-color:#dbeafe !important;}</style>';
            $html = str_replace('</head>', $style.'</head>', $html);
        }

        return Pdf::loadHTML($html)
            ->setPaper('A4', 'portrait')
            ->setOptions([
                'dpi' => 150,
                'defaultFont' => 'DejaVu Sans',
                'isHtml5ParserEnabled' => true,
                'isRemoteEnabled' => true,
            ]);
    }

    /**
     * Data view template invoice. Satu sumber untuk unduhan dan pratinjau.
     *
     * @return array<string, mixed>
     */
    public function buildViewData(Invoice $invoice, ?int $dpAmount = null, ?int $pelunasanAmount = null, string $template = 'kisantra-invoice'): array
    {
        $company = CompanyProfile::current();

        $isDownPayment = ! is_null($dpAmount) && $dpAmount > 0;
        $isPelunasan = ! is_null($pelunasanAmount) && $pelunasanAmount > 0;

        $regularItems = $invoice->items->where('is_tax_deposit', false);
        $taxDepositItems = $invoice->items->where('is_tax_deposit', true);

        $netRevenue = $regularItems->sum('amount');
        $totalCogs = $regularItems->sum('cogs_amount');
        $itemsTotal = $invoice->subtotal; // Base DPP
        $discountAmount = $invoice->discount_amount ?? 0;

        // Template-specific calculations
        if ($template === 'semesta-invoice') {
            // SEMESTA: PPN 11% + PPH 22 1.5%
            $ppnRate = $company?->ppn_rate ?? 11;
            $ppnAmount = ($itemsTotal * $ppnRate / 100);
            $subtotalWithPpn = $itemsTotal + $ppnAmount;
            $pph22Amount = $itemsTotal * 1.5 / 100;
            $displayAmount = $isDownPayment ? $dpAmount : ($isPelunasan ? $pelunasanAmount : $subtotalWithPpn);
            $grandTotal = $subtotalWithPpn - $pph22Amount - $discountAmount - ($isDownPayment ? 0 : ($dpAmount ?? 0));
        } else {
            // KISANTRA (default): existing calculation
            $displayAmount = $isDownPayment ? $dpAmount : ($isPelunasan ? $pelunasanAmount : $invoice->total_amount);
            $ppnAmount = $company?->is_pkp ? ($displayAmount * $company->ppn_rate / 100) : 0;
            $pph22Amount = 0;
            $grandTotal = $displayAmount + $ppnAmount;
        }

        // DP percentage
        $dpPercentage = null;
        if ($dpAmount && $itemsTotal > 0) {
            $dpPercentage = round(($dpAmount / $itemsTotal) * 100).'%';
        }

        $grossProfit = $netRevenue - $totalCogs - $discountAmount;

        return [
            'invoice' => $invoice,
            'client' => $invoice->client,
            'items' => $invoice->items,
            'regular_items' => $regularItems,
            'tax_deposit_items' => $taxDepositItems,
            'payments' => $invoice->payments,
            'company' => $this->getCompanyInfo($company),
            'terbilang' => $this->numberToWords($grandTotal),
            'is_down_payment' => $isDownPayment,
            'is_pelunasan' => $isPelunasan,
            'dp_amount' => $dpAmount,
            'dp_percentage' => $dpPercentage,
            'pelunasan_amount' => $pelunasanAmount,
            'display_amount' => $displayAmount,
            'ppn_amount' => $ppnAmount,
            'pph22_amount' => $pph22Amount,
            'grand_total' => $grandTotal,
            'total_paid' => $invoice->payments->sum('amount'),
            'financial_summary' => [
                'net_revenue' => $netRevenue,
                'total_cogs' => $totalCogs,
                'gross_profit' => $grossProfit,
                'tax_deposits_total' => $taxDepositItems->sum('amount'),
                'has_tax_deposits' => $taxDepositItems->isNotEmpty(),
                'profit_margin' => $netRevenue > 0 ? ($grossProfit / $netRevenue) * 100 : 0,
            ],
        ];
    }

    public function downloadSingleInvoice(Invoice $invoice, string $template = 'kisantra-invoice')
    {
        $filename = 'Invoice-'.str_replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], '-', $invoice->invoice_number).'.pdf';

        return $this->generateSingleInvoicePdf($invoice, null, null, $template)->download($filename);
    }

    private function getCompanyInfo(?CompanyProfile $company): array
    {
        if (! $company) {
            return $this->getFallbackCompanyInfo();
        }

        return [
            'name' => $company->name,
            'address' => $company->address,
            'email' => $company->email,
            'phone' => $company->phone,
            'logo_base64' => $this->getImageBase64($company?->letter_head_path ?? 'images/letter-head.png'),
            'signature_base64' => $company?->signature_path ? $this->getImageBase64($company->signature_path) : '',
            'stamp_base64' => $company?->stamp_path ? $this->getImageBase64($company->stamp_path) : '',
            'bank_accounts' => $company->bank_accounts,
            'signature' => [
                'name' => $company->finance_manager_name,
                'position' => $company->finance_manager_position,
            ],
            'is_pkp' => $company->is_pkp,
            'npwp' => $company->npwp,
            'ppn_rate' => $company->ppn_rate,
            'pph22_rate' => 1.5, // Fixed for semesta template
        ];
    }

    private function getFallbackCompanyInfo(): array
    {
        return [
            'name' => 'PT. KINARA SADAYATRA NUSANTARA',
            'address' => 'Jl. A. Wahab Syahranie Perum Pondok Alam Indah, Nomor 3D, Kel. Sempaja Barat, Kota Samarinda - Kalimantan Timur',
            'email' => 'kisantra.official@gmail.com',
            'phone' => '0852-8888-2600',
            'logo_base64' => $this->getImageBase64('images/letter-head.png'),
            'signature_base64' => $this->getImageBase64('images/pdf-signature.png'),
            'stamp_base64' => $this->getImageBase64('images/kisantra-stamp.png'),
            'bank_accounts' => [
                ['bank' => 'MANDIRI', 'account_number' => '1480045452425', 'account_name' => 'PT. KINARA SADAYATRA NUSANTARA'],
            ],
            'signature' => ['name' => 'Mohammad Denny Jodysetiawan', 'position' => 'Manajer Keuangan'],
            'is_pkp' => false,
            'npwp' => null,
            'ppn_rate' => 11.00,
        ];
    }

    private function getImageBase64(string $path): string
    {
        $fullPath = public_path('storage/'.$path);

        return file_exists($fullPath) ? 'data:image/png;base64,'.base64_encode(file_get_contents($fullPath)) : '';
    }

    private function numberToWords($number): string
    {
        if ($number == 0) {
            return 'Nol';
        }

        $words = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan'];

        // Milyar
        if ($number >= 1000000000) {
            $milyar = intval($number / 1000000000);
            $sisa = $number % 1000000000;
            $result = ($milyar == 1 ? 'Satu' : $this->numberToWords($milyar)).' Milyar';

            return $sisa > 0 ? $result.' '.$this->numberToWords($sisa) : $result;
        }

        // Juta
        if ($number >= 1000000) {
            $juta = intval($number / 1000000);
            $sisa = $number % 1000000;
            $result = ($juta == 1 ? 'Satu' : $this->numberToWords($juta)).' Juta';

            return $sisa > 0 ? $result.' '.$this->numberToWords($sisa) : $result;
        }

        // Ribu
        if ($number >= 1000) {
            $ribu = intval($number / 1000);
            $sisa = $number % 1000;
            $result = ($ribu == 1 ? 'Seribu' : $this->numberToWords($ribu).' Ribu');

            return $sisa > 0 ? $result.' '.$this->numberToWords($sisa) : $result;
        }

        // Ratus
        if ($number >= 100) {
            $ratus = intval($number / 100);
            $sisa = $number % 100;
            $result = ($ratus == 1 ? 'Seratus' : $words[$ratus].' Ratus');

            return $sisa > 0 ? $result.' '.$this->numberToWords($sisa) : $result;
        }

        // Puluh
        if ($number >= 20) {
            $puluh = intval($number / 10);
            $sisa = $number % 10;
            $result = $words[$puluh].' Puluh';

            return $sisa > 0 ? $result.' '.$words[$sisa] : $result;
        }

        // 11-19
        if ($number >= 11) {
            return $words[$number - 10].' Belas';
        }

        // 10
        if ($number == 10) {
            return 'Sepuluh';
        }

        // 1-9
        return $words[$number];
    }
}
