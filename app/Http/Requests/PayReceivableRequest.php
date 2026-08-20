<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PayReceivableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Tanpa `required_if`, pembayaran bermetode transfer tanpa rekening
            // tersimpan diam-diam TANPA mutasi bank: piutang berkurang tetapi
            // uangnya tidak pernah tercatat masuk ke mana pun.
            'bank_account_id' => ['nullable', 'required_if:payment_method,bank_transfer', 'exists:bank_accounts,id'],
            'payment_date' => ['required', 'date', 'before_or_equal:today'],
            'principal_paid' => ['nullable', 'integer', 'min:0'],
            'interest_paid' => ['nullable', 'integer', 'min:0'],
            'payment_method' => ['required', 'in:cash,payroll_deduction,bank_transfer'],
            'reference_number' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'bank_account_id.required_if' => 'Rekening tujuan wajib dipilih untuk pembayaran via transfer bank.',
        ];
    }
}
