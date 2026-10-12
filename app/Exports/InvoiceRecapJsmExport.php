<?php

namespace App\Exports;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Rekap invoice template "JSM" — meniru "Rekap Invoice JSM 2026 (Nisa).xlsx": judul berbingkai,
 * header biru, invoice dikelompokkan per bulan terbit (baris bulan emas, baris Total per bulan),
 * lalu Grand Total. PPN, Grand Total, dan semua total memakai rumus Excel agar file tetap bisa
 * disunting (mis. menghapus PPN pada baris "As Per Nota") dan totalnya ikut menyesuaikan.
 */
class InvoiceRecapJsmExport implements FromArray, WithColumnWidths, WithEvents, WithTitle
{
    private const RP_FORMAT = '_-[$Rp-421]* #,##0_-;\-[$Rp-421]* #,##0_-;_-[$Rp-421]* "-"_-;_-@_-';

    private const DATE_FORMAT = '[$-421]dd\ mmmm\ yyyy;@';

    private const HEADER_ROW = 4;

    /**
     * Posisi baris untuk styling, diisi saat array() menyusun grid.
     *
     * @var array<int, array{type: 'month'|'row'|'total'|'grand'}>
     */
    private array $layout = [];

    /**
     * @param  Collection<int, array<string, mixed>>  $rows  baris dari InvoiceController::buildRecapData()
     */
    public function __construct(
        private Collection $rows,
        private string $title,
        private string $period,
        private float $ppnRate,
    ) {}

    public function title(): string
    {
        return 'Rekap Invoice';
    }

    public function array(): array
    {
        $rate = rtrim(rtrim(number_format($this->ppnRate, 2, '.', ''), '0'), '.');
        $blank = array_fill(0, 10, '');

        $grid = [
            $blank,
            ['', $this->title] + $blank,
            ['', 'Periode '.$this->period] + $blank,
            ['', 'No.', 'No. Invoice', 'Date Invoice', 'Company', 'Total Invoice', "PPN {$rate}%", 'Grand Total', 'Payment', 'Keterangan'],
        ];

        $monthTotals = [];
        $number = 0;
        $sorted = $this->rows->sortBy([
            fn (array $a, array $b) => strcmp((string) $a['issue_date'], (string) $b['issue_date']),
            fn (array $a, array $b) => ($a['invoice_sequence'] ?? 0) <=> ($b['invoice_sequence'] ?? 0),
        ]);

        foreach ($sorted->groupBy(fn (array $row) => substr((string) $row['issue_date'], 0, 7)) as $month => $rows) {
            $grid[] = ['', Carbon::parse($month.'-01')->locale('id')->isoFormat('MMMM Y')] + $blank;
            $this->layout[count($grid)] = ['type' => 'month'];
            $first = count($grid) + 1;

            foreach ($rows as $row) {
                $r = count($grid) + 1;
                $grid[] = [
                    '',
                    (string) ++$number,
                    $row['invoice_number'],
                    $row['issue_date'] ? ExcelDate::PHPToExcel(Carbon::parse($row['issue_date'])) : '',
                    $row['client_name'],
                    (int) $row['total_amount'],
                    "=F{$r}*{$rate}%",
                    "=SUM(F{$r}:G{$r})",
                    $row['last_payment_date'] ? ExcelDate::PHPToExcel(Carbon::parse($row['last_payment_date'])) : '',
                    $row['items_description'] ?? '',
                ];
                $this->layout[$r] = ['type' => 'row'];
            }

            $last = count($grid);
            $t = $last + 1;
            $grid[] = ['', 'Total', '', '', '', "=SUM(F{$first}:F{$last})", "=SUM(G{$first}:G{$last})", "=SUM(H{$first}:H{$last})", '', ''];
            $this->layout[$t] = ['type' => 'total'];
            $monthTotals[] = $t;
        }

        $g = count($grid) + 1;
        $sum = fn (string $col) => $monthTotals ? '=SUM('.implode('+', array_map(fn (int $t) => "{$col}{$t}", $monthTotals)).')' : 0;
        $grid[] = ['', 'Grand Total', '', '', '', $sum('F'), $sum('G'), $sum('H'), '', ''];
        $this->layout[$g] = ['type' => 'grand'];

        return $grid;
    }

    public function columnWidths(): array
    {
        return ['A' => 8.83, 'B' => 5.66, 'C' => 29, 'D' => 21.5, 'E' => 38.66, 'F' => 30.33, 'G' => 30.33, 'H' => 30.33, 'I' => 16.66, 'J' => 71.5];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => fn (AfterSheet $event) => $this->styleSheet($event->sheet->getDelegate()),
        ];
    }

    private function styleSheet(Worksheet $sheet): void
    {
        $sheet->getRowDimension(1)->setRowHeight(24.5);

        // ── Judul berbingkai (B2:J3) ──
        foreach ([2 => 29, 3 => 30] as $row => $height) {
            $sheet->mergeCells("B{$row}:J{$row}");
            $sheet->getRowDimension($row)->setRowHeight($height);
        }
        $sheet->getStyle('B2:J3')->applyFromArray([
            'font' => ['name' => 'Raleway', 'size' => 25, 'bold' => true, 'color' => ['rgb' => '2F5597']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
            'borders' => ['outline' => ['borderStyle' => Border::BORDER_MEDIUM]],
        ]);

        // ── Header ──
        $h = self::HEADER_ROW;
        $sheet->getRowDimension($h)->setRowHeight(35.25);
        $sheet->getStyle("B{$h}:J{$h}")->applyFromArray([
            'font' => ['name' => 'Raleway', 'size' => 14, 'bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '4472C4']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_MEDIUM]],
        ]);

        $thin = ['allBorders' => ['borderStyle' => Border::BORDER_THIN]];
        foreach ($this->layout as $row => $info) {
            match ($info['type']) {
                'month' => $this->styleMonth($sheet, $row),
                'row' => $this->styleRow($sheet, $row, $thin),
                'total' => $this->styleTotal($sheet, $row, $thin, 'Total', 15, 25, true),
                'grand' => $this->styleTotal($sheet, $row, $thin, 'Grand Total', 20, 30, false),
            };
        }

        $sheet->freezePane('A5');
        $sheet->setSelectedCell('A1');
    }

    private function styleMonth(Worksheet $sheet, int $row): void
    {
        $sheet->mergeCells("B{$row}:J{$row}");
        $sheet->getRowDimension($row)->setRowHeight(35.25);
        $sheet->getStyle("B{$row}:J{$row}")->applyFromArray([
            'font' => ['name' => 'Raleway', 'size' => 14, 'bold' => true, 'color' => ['rgb' => '000000']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FFC000']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['top' => ['borderStyle' => Border::BORDER_MEDIUM], 'bottom' => ['borderStyle' => Border::BORDER_THIN]],
        ]);
    }

    /** @param  array<string, mixed>  $thin */
    private function styleRow(Worksheet $sheet, int $row, array $thin): void
    {
        $sheet->getRowDimension($row)->setRowHeight(19.5);
        $sheet->getStyle("B{$row}:J{$row}")->applyFromArray([
            'font' => ['name' => 'Calisto MT', 'size' => 13],
            'alignment' => ['vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
            'borders' => $thin,
        ]);
        $sheet->getStyle("B{$row}")->getFont()->setSize(12);
        $sheet->getStyle("B{$row}:D{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("I{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("E{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
        $sheet->getStyle("J{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
        $sheet->getStyle("F{$row}:H{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        $sheet->getStyle("F{$row}:H{$row}")->getNumberFormat()->setFormatCode(self::RP_FORMAT);
        $sheet->getStyle("D{$row}")->getNumberFormat()->setFormatCode(self::DATE_FORMAT);
        $sheet->getStyle("I{$row}")->getNumberFormat()->setFormatCode(self::DATE_FORMAT);
    }

    /** @param  array<string, mixed>  $thin */
    private function styleTotal(Worksheet $sheet, int $row, array $thin, string $label, int $size, float $height, bool $highlight): void
    {
        $sheet->mergeCells("B{$row}:E{$row}");
        $sheet->setCellValue("B{$row}", $label);
        $sheet->getRowDimension($row)->setRowHeight($height);
        $sheet->getStyle("B{$row}:J{$row}")->applyFromArray([
            'font' => ['name' => 'Calisto MT', 'size' => $size, 'bold' => true],
            'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
            'borders' => $thin,
        ]);
        $sheet->getStyle("B{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        $sheet->getStyle("F{$row}:H{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        $sheet->getStyle("F{$row}:H{$row}")->getNumberFormat()->setFormatCode(self::RP_FORMAT);
        if ($highlight) {
            $sheet->getStyle("H{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('FFFF00');
        }
    }
}
