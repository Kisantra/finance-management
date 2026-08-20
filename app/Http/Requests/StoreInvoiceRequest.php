<?php

namespace App\Http\Requests;

use App\Models\Client;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Klien nonaktif hanya disaring saat menyusun opsi Combobox. Aturan
            // yang cuma ada di frontend bukan aturan — panggilan langsung ke
            // endpoint ini tetap menerbitkan invoice atas nama klien nonaktif.
            'client_id' => ['required', Rule::exists('clients', 'id')->where('status', Client::STATUS_ACTIVE)],
            'issue_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:issue_date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.client_id' => ['nullable', Rule::exists('clients', 'id')->where('status', Client::STATUS_ACTIVE)],
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
}
