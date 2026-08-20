<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFundRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'request_number' => ['required', 'string', 'max:50', 'unique:fund_requests,request_number'],
            'title' => ['required', 'string', 'max:255'],
            'purpose' => ['required', 'string'],
            'priority' => ['required', 'in:low,medium,high,urgent'],
            'needed_by_date' => ['required', 'date', 'after_or_equal:today'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.description' => ['required', 'string', 'max:255'],
            // Pencairan membentuk transaksi PENGELUARAN. Kategori bertipe lain
            // membuat transaksi itu tak terlihat di halaman Cash Flow mana pun,
            // padahal saldo bank tetap berkurang. Pembatasan yang selama ini
            // hanya ada di opsi Combobox kini ditegakkan di server.
            'items.*.category_id' => [
                'required',
                Rule::exists('transaction_categories', 'id')->where('type', 'expense'),
            ],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'integer', 'min:1'],
            'items.*.notes' => ['nullable', 'string'],
            'action' => ['required', 'in:draft,submit'],
        ];
    }
}
