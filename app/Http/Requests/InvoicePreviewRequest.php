<?php

namespace App\Http\Requests;

use App\Services\InvoicePrintService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Isian editor saat masih diketik: semua boleh kosong karena pratinjau PDF dirender setiap perubahan.
 */
class InvoicePreviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'invoice_id' => ['nullable', 'integer'],
            'highlight' => ['nullable', 'integer', 'min:0'],
            'template' => ['nullable', 'in:'.implode(',', InvoicePrintService::BLADE_TEMPLATES)],
            'client_id' => ['nullable', 'integer'],
            'issue_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'items' => ['nullable', 'array', 'max:200'],
            'items.*.client_id' => ['nullable', 'integer'],
            'items.*.service_name' => ['nullable', 'string', 'max:255'],
            'items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit' => ['nullable', 'string', 'max:20'],
            'items.*.unit_price' => ['nullable', 'integer', 'min:0'],
            'items.*.cogs_amount' => ['nullable', 'integer', 'min:0'],
            'items.*.is_tax_deposit' => ['nullable', 'boolean'],
            'discount_type' => ['nullable', 'in:fixed,percentage'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'discount_reason' => ['nullable', 'string', 'max:255'],
        ];
    }
}
