<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TransferBankTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create transfer') ?? false;
    }

    public function rules(): array
    {
        return [
            'from_account_id' => ['required', 'exists:bank_accounts,id', 'different:to_account_id'],
            'to_account_id' => ['required', 'exists:bank_accounts,id'],
            // Harus kategori berjenis `transfer`, bukan sekadar kategori yang ada.
            // Pemilih di UI memang sudah menyaringnya, tetapi aturan yang hanya
            // ditegakkan di klien sama dengan tidak ditegakkan: QC 2026-11-03
            // membuktikan transfer berkategori `expense` bisa dikirim lewat HTTP,
            // lalu uang yang cuma berpindah antar rekening sendiri terhitung
            // sebagai BEBAN di Laporan Laba Rugi.
            'category_id' => [
                'required',
                Rule::exists('transaction_categories', 'id')->where('type', 'transfer'),
            ],
            'amount' => ['required', 'integer', 'min:1'],
            'admin_fee' => ['required', 'integer', 'min:0'],
            'description' => ['required', 'string', 'max:255'],
            'transfer_date' => ['required', 'date'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ];
    }
}
