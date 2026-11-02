<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Invoice recap (rekap) export — a single polished sheet: a title block,
 * the filtered invoice rows, and a totals footer. Money is stored as real
 * numbers with an accounting format so the user can sort/sum natively.
 * Mirrors the on-screen listing so the export matches the active filters.
 */
class InvoiceRecapExport implements FromArray, WithColumnWidths, WithEvents, WithTitle
{
    private const STATUS_LABELS = [
        'draft' => 'Draft',
        'sent' => 'Terkirim',
        'partially_paid' => 'Sebagian',
        'paid' => 'Lunas',
    ];

    /** Accounting-style Rupiah format: right-aligned, negatives in parentheses, zero as dash. */
    private const RP_FORMAT = '_("Rp"* #,##0_);_("Rp"* \(#,##0\);_("Rp"* "-"_);_(@_)';

    private const LAST_COL = 'L';

    /** Columns that hold money (accounting format + right aligned). */
    private const MONEY_RANGE = 'F:L';

    /** 1-based sheet row where the table header sits (after the title block). */
    private int $headerRow = 5;

    /** First and last data rows (1-based), filled in array(). */
    private int $firstDataRow = 6;

    private int $lastDataRow = 6;

    private int $totalRow = 7;

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @param  array<string, mixed>  $summary
     */
    public function __construct(
        private Collection $rows,
        private array $summary,
        private string $period,
    ) {}

    public function title(): string
    {
        return 'Rekap Invoice';
    }

    public function array(): array
    {
        $blank = array_fill(0, 12, '');
        $grid = [];
        $grid[] = ['REKAP INVOICE'] + $blank;
        $grid[] = ['Periode: '.$this->period] + $blank;
        $grid[] = ['Dicetak: '.now()->isoFormat('D MMMM Y HH:mm').' WIB'] + $blank;
        $grid[] = $blank;
        $grid[] = ['No. Invoice', 'Klien', 'Tgl Invoice', 'Jatuh Tempo', 'Status', 'Omzet', 'PPN', 'HPP', 'Profit', 'PPh Final 0,5%', 'Terbayar', 'Sisa'];

        $this->firstDataRow = count($grid) + 1;

        foreach ($this->rows as $row) {
            $grid[] = [
                $row['invoice_number'] ?? '(draft)',
                $row['client_name'],
                $row['issue_date'],
                $row['due_date'],
                self::STATUS_LABELS[$row['status']] ?? $row['status'],
                (int) $row['total_amount'],
                (int) $row['ppn'],
                (int) $row['hpp'],
                (int) $row['profit'],
                (int) $row['pph_final'],
                (int) $row['amount_paid'],
                (int) $row['amount_remaining'],
            ];
        }

        $this->lastDataRow = max($this->firstDataRow, count($grid));

        $grid[] = [
            'TOTAL ('.$this->summary['count'].' invoice)', '', '', '', '',
            (int) $this->summary['total_amount'],
            (int) $this->summary['total_ppn'],
            (int) $this->summary['total_hpp'],
            (int) $this->summary['total_profit'],
            (int) $this->summary['total_pph_final'],
            (int) $this->summary['total_paid'],
            (int) $this->summary['total_outstanding'],
        ];
        $this->totalRow = count($grid);

        return $grid;
    }

    public function columnWidths(): array
    {
        return [
            'A' => 20, 'B' => 28, 'C' => 13, 'D' => 13, 'E' => 11, 'F' => 16,
            'G' => 15, 'H' => 15, 'I' => 16, 'J' => 16, 'K' => 16, 'L' => 16,
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $this->styleSheet($sheet);
            },
        ];
    }

    private function styleSheet(Worksheet $sheet): void
    {
        $last = self::LAST_COL;
        $header = $this->headerRow;
        $first = $this->firstDataRow;
        $lastData = $this->lastDataRow;
        $total = $this->totalRow;
        $hasRows = $this->rows->isNotEmpty();

        // ── Title block ──
        $sheet->mergeCells("A1:{$last}1");
        $sheet->mergeCells("A2:{$last}2");
        $sheet->mergeCells("A3:{$last}3");
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(16);
        $sheet->getStyle('A2')->getFont()->setSize(10);
        $sheet->getStyle('A3')->getFont()->setSize(9)->getColor()->setRGB('64748B');
        $sheet->getRowDimension(1)->setRowHeight(24);

        // ── Header row ──
        $headerRange = "A{$header}:{$last}{$header}";
        $sheet->getStyle($headerRange)->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $sheet->getStyle($headerRange)->getFill()
            ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('0F172A');
        $sheet->getStyle($headerRange)->getAlignment()
            ->setVertical(Alignment::VERTICAL_CENTER)->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getRowDimension($header)->setRowHeight(20);
        // Left-align the two text columns in the header for readability.
        $sheet->getStyle("A{$header}:B{$header}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

        // ── Data body ──
        if ($hasRows) {
            $bodyRange = "A{$first}:{$last}{$lastData}";

            // Money columns as accounting numbers.
            [$mFrom, $mTo] = explode(':', self::MONEY_RANGE);
            $sheet->getStyle("{$mFrom}{$first}:{$mTo}{$lastData}")->getNumberFormat()->setFormatCode(self::RP_FORMAT);
            // Center dates + status.
            $sheet->getStyle("C{$first}:E{$lastData}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

            // Zebra striping on even data rows.
            for ($r = $first; $r <= $lastData; $r++) {
                if (($r - $first) % 2 === 1) {
                    $sheet->getStyle("A{$r}:{$last}{$r}")->getFill()
                        ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F1F5F9');
                }
            }

            // Thin borders around the whole body.
            $sheet->getStyle($bodyRange)->getBorders()->getAllBorders()
                ->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('CBD5E1');
        }

        // ── Totals row ──
        $totalRange = "A{$total}:{$last}{$total}";
        $sheet->getStyle($totalRange)->getFont()->setBold(true);
        $sheet->getStyle($totalRange)->getFill()
            ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('E2E8F0');
        [$mFromT, $mToT] = explode(':', self::MONEY_RANGE);
        $sheet->getStyle("{$mFromT}{$total}:{$mToT}{$total}")->getNumberFormat()->setFormatCode(self::RP_FORMAT);
        $sheet->mergeCells("A{$total}:E{$total}");
        $sheet->getStyle("A{$total}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        $sheet->getStyle($totalRange)->getBorders()->getTop()
            ->setBorderStyle(Border::BORDER_DOUBLE)->getColor()->setRGB('0F172A');

        // ── Sheet-level niceties ──
        $sheet->freezePane("A{$first}");                 // keep title + header visible while scrolling
        $sheet->setAutoFilter("A{$header}:{$last}{$lastData}");
        $sheet->setSelectedCell('A1');
    }
}
