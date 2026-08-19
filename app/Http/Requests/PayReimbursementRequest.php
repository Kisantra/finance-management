<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PayReimbursementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $reimbursement = $this->route('reimbursement');
        $sisa = $reimbursement?->amount_remaining;

        return [
            'bank_account_id' => ['required', 'exists:bank_accounts,id'],
            'payment_date' => ['required', 'date', 'before_or_equal:today'],
            // Pembayaran tidak boleh melampaui sisa: sebelumnya kelebihan bayar
            // diterima penuh, memotong kas melebihi kewajiban dan membuat
            // amount_paid > amount (sisa negatif).
            'payment_amount' => array_filter([
                'required', 'integer', 'min:1',
                $sisa !== null ? 'max:'.$sisa : null,
            ]),
            'reference_notes' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'payment_amount.max' => 'Nominal pembayaran melebihi sisa yang harus dibayar.',
        ];
    }
}
