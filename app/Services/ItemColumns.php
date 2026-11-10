<?php

namespace App\Services;

use App\Models\InvoiceItem;
use Illuminate\Support\Collection;

/**
 * Single source of truth for the item-column catalog used by the table element.
 *
 * Each entry defines:
 *   - key:      unique identifier stored in the layout JSON
 *   - label:    Indonesian column header shown by default
 *   - align:    default text alignment ('left' | 'center' | 'right')
 *   - format:   how the cell value is formatted ('text' | 'number' | 'rupiah')
 *   - default:  whether this column is included in the "Standar" preset
 *   - resolve:  callable(InvoiceItem $item, int $rowIndex): string
 *
 * The "Standar" preset = No · Deskripsi · Qty · Harga Satuan · Jumlah
 */
class ItemColumns
{
    /**
     * Full catalog — ordered as they appear in the default table.
     *
     * @return array<int, array{key: string, label: string, align: string, format: string, default: bool, resolve: callable(InvoiceItem, int): string}>
     */
    public static function catalog(): array
    {
        return [
            [
                'key' => 'no',
                'label' => 'No',
                'align' => 'center',
                'format' => 'number',
                'default' => true,
                'resolve' => fn (InvoiceItem $item, int $idx): string => (string) $idx,
            ],
            [
                'key' => 'description',
                'label' => 'Deskripsi',
                'align' => 'left',
                'format' => 'text',
                'default' => true,
                'resolve' => fn (InvoiceItem $item, int $idx): string => (string) ($item->service_name ?? ''),
            ],
            [
                'key' => 'quantity',
                'label' => 'Qty',
                'align' => 'center',
                'format' => 'number',
                'default' => true,
                'resolve' => fn (InvoiceItem $item, int $idx): string => rtrim(rtrim(number_format((float) $item->quantity, 3, ',', '.'), '0'), ','),
            ],
            [
                'key' => 'unit',
                'label' => 'Satuan',
                'align' => 'center',
                'format' => 'text',
                'default' => false,
                'resolve' => fn (InvoiceItem $item, int $idx): string => (string) ($item->unit ?? ''),
            ],
            [
                'key' => 'unit_price',
                'label' => 'Harga Satuan',
                'align' => 'right',
                'format' => 'rupiah',
                'default' => true,
                'resolve' => fn (InvoiceItem $item, int $idx): string => TemplateTokens::formatRupiah((int) $item->unit_price),
            ],
            [
                'key' => 'amount',
                'label' => 'Jumlah',
                'align' => 'right',
                'format' => 'rupiah',
                'default' => true,
                'resolve' => fn (InvoiceItem $item, int $idx): string => TemplateTokens::formatRupiah((int) $item->amount),
            ],
            [
                'key' => 'cogs_amount',
                'label' => 'HPP',
                'align' => 'right',
                'format' => 'rupiah',
                'default' => false,
                'resolve' => fn (InvoiceItem $item, int $idx): string => TemplateTokens::formatRupiah((int) $item->cogs_amount),
            ],
            [
                'key' => 'is_tax_deposit',
                'label' => 'Deposit Pajak',
                'align' => 'center',
                'format' => 'text',
                'default' => false,
                'resolve' => fn (InvoiceItem $item, int $idx): string => $item->is_tax_deposit ? 'Ya' : 'Tidak',
            ],
        ];
    }

    /**
     * Return the frontend-safe catalog (no resolve callable).
     *
     * @return array<int, array{key: string, label: string, align: string, format: string, default: bool}>
     */
    public static function catalogForFrontend(): array
    {
        return array_map(
            fn (array $col): array => [
                'key' => $col['key'],
                'label' => self::labelTampil($col['key'], $col['label']),
                'align' => $col['align'],
                'format' => $col['format'],
                'default' => $col['default'],
            ],
            self::catalog(),
        );
    }

    /**
     * Label kolom untuk layar (bahasa pengguna). Label yang disimpan ke tata letak & dicetak
     * ke dokumen tetap Bahasa Indonesia (`label` di catalog()).
     */
    private static function labelTampil(string $key, string $label): string
    {
        return match ($key) {
            'no' => __('No'),
            'description' => __('Deskripsi'),
            'quantity' => __('Qty'),
            'unit' => __('Satuan'),
            'unit_price' => __('Harga Satuan'),
            'amount' => __('Jumlah'),
            'cogs_amount' => __('HPP'),
            'is_tax_deposit' => __('Deposit Pajak'),
            default => $label,
        };
    }

    /**
     * Return the default column set (the "Standar" preset) as column configs
     * ready to be stored in the layout JSON.
     *
     * Each column config:  { key, label, width, align, format }
     *
     * Default widths are proportional out of 714px (A4 794 - 40px left/right padding).
     *
     * @return array<int, array{key: string, label: string, width: int, align: string, format: string}>
     */
    public static function defaultColumns(): array
    {
        $defaults = array_filter(self::catalog(), fn (array $col) => $col['default']);

        $widths = [
            'no' => 36,
            'description' => 290,
            'quantity' => 72,
            'unit' => 80,
            'unit_price' => 130,
            'amount' => 130,
            'cogs_amount' => 130,
            'is_tax_deposit' => 100,
        ];

        return array_values(array_map(
            fn (array $col): array => [
                'key' => $col['key'],
                'label' => $col['label'],
                'width' => $widths[$col['key']] ?? 100,
                'align' => $col['align'],
                'format' => $col['format'],
            ],
            $defaults,
        ));
    }

    /**
     * Resolve a single InvoiceItem to a cell-value map.
     *
     * @param  array<int, array{key: string, ...}>  $columns  Column configs from the layout JSON.
     * @return array<string, string> key → formatted cell value
     */
    public static function resolveItem(array $columns, InvoiceItem $item, int $rowIndex): array
    {
        $catalogMap = [];
        foreach (self::catalog() as $col) {
            $catalogMap[$col['key']] = $col['resolve'];
        }

        $row = [];
        foreach ($columns as $col) {
            $key = $col['key'];
            $row[$key] = isset($catalogMap[$key])
                ? ($catalogMap[$key])($item, $rowIndex)
                : '';
        }

        return $row;
    }

    /**
     * Resolve all items for a table element and return a ready-to-render structure.
     *
     * @param  array<int, array{key: string, ...}>  $columns
     * @param  Collection<int, InvoiceItem>  $items
     * @return array<int, array<string, string>>
     */
    public static function resolveItems(array $columns, iterable $items): array
    {
        $rows = [];
        $idx = 1;
        foreach ($items as $item) {
            $rows[] = self::resolveItem($columns, $item, $idx++);
        }

        return $rows;
    }
}
