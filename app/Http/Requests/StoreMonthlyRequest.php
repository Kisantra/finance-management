<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreMonthlyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'template_id' => ['required', 'exists:recurring_templates,id'],
            'scheduled_date' => ['required', 'date'],
            'issue_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.client_id' => ['required', 'exists:clients,id'],
            'items.*.service_name' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            // `unit` dikirim form tetapi tidak pernah divalidasi, sehingga
            // nilai sepanjang apa pun lolos ke kolom yang dibatasi 20 karakter.
            'items.*.unit' => ['nullable', 'string', 'max:20'],
            'items.*.unit_price' => ['required', 'integer', 'min:0'],
            'items.*.cogs_amount' => ['nullable', 'integer', 'min:0'],
            'items.*.is_tax_deposit' => ['nullable', 'boolean'],
            'discount_type' => ['nullable', 'in:fixed,percentage'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'discount_reason' => ['nullable', 'string', 'max:500'],
        ];
    }
}
