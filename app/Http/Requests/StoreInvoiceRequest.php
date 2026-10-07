<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'client_id' => ['required', 'exists:clients,id'],
            'issue_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:issue_date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.client_id' => ['nullable', 'exists:clients,id'],
            'items.*.service_name' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'items.*.unit' => ['nullable', 'string', 'max:20'],
            'items.*.unit_price' => ['required', 'integer', 'min:0'],
            'items.*.cogs_amount' => ['nullable', 'integer', 'min:0'],
            'items.*.is_tax_deposit' => ['boolean'],
            'discount_type' => ['nullable', 'in:fixed,percentage'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'discount_reason' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'client_id.required' => 'Klien wajib dipilih.',
            'client_id.exists' => 'Klien tidak ditemukan.',
            'issue_date.required' => 'Tanggal invoice wajib diisi.',
            'due_date.required' => 'Jatuh tempo wajib diisi.',
            'due_date.after_or_equal' => 'Jatuh tempo tidak boleh sebelum tanggal invoice.',
            'items.required' => 'Tambahkan minimal satu item.',
            'items.min' => 'Tambahkan minimal satu item.',
            'items.*.service_name.required' => 'Nama layanan baris :position wajib diisi.',
            'items.*.quantity.required' => 'Qty baris :position wajib diisi.',
            'items.*.quantity.min' => 'Qty baris :position harus lebih dari 0.',
            'items.*.unit_price.required' => 'Harga satuan baris :position wajib diisi.',
            'items.*.unit_price.min' => 'Harga satuan baris :position tidak boleh negatif.',
            'discount_value.min' => 'Diskon tidak boleh negatif.',
        ];
    }
}
