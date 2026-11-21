<?php

namespace App\Http\Requests;

use App\Models\Invoice;
use App\Services\CompanyInvoiceTemplate;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'template' => ['nullable', Rule::in(CompanyInvoiceTemplate::allowed())],
            'client_id' => ['nullable', 'integer'],
            'issue_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'subject' => ['nullable', 'string', 'max:255'],
            'attention' => ['nullable', 'string', 'max:255'],
            'document_type' => ['nullable', Rule::in(StoreInvoiceRequest::documentTypes(isset($this->invoice_id) ? Invoice::find($this->invoice_id) : null))],
            'document_code' => StoreInvoiceRequest::documentCodeRules(),
            'is_pass_through' => ['nullable', 'boolean'],
            'items' => ['nullable', 'array', 'max:200'],
            'items.*.client_id' => ['nullable', 'integer'],
            'items.*.service_name' => ['nullable', 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string', 'max:2000'],
            'items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit' => ['nullable', 'string', 'max:20'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0', 'max:9999999999999', 'decimal:0,2'],
            'items.*.foreign_unit_price' => ['nullable', 'numeric', 'min:0', 'max:999999999'],
            'items.*.cogs_amount' => ['nullable', 'integer', 'min:0'],
            'items.*.is_tax_deposit' => ['nullable', 'boolean'],
            'discount_type' => ['nullable', 'in:fixed,percentage'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'discount_reason' => ['nullable', 'string', 'max:255'],
            'apply_ppn' => ['nullable', 'boolean'],
            'faktur' => ['nullable', 'string', 'max:50'],
            'apply_pph' => ['nullable', 'boolean'],
            'pph_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'currency' => ['nullable', Rule::in(StoreInvoiceRequest::currencies(isset($this->invoice_id) ? Invoice::find($this->invoice_id) : null))],
            'exchange_rate' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
        ];
    }
}
