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
        return [
            'bank_account_id' => ['required', 'exists:bank_accounts,id'],
            'payment_date' => ['required', 'date', 'before_or_equal:today'],
            // Tidak boleh melebihi sisa: kelebihan akan keluar dari kas tanpa dasar (amount_paid > amount).
            'payment_amount' => ['required', 'integer', 'min:1', 'max:'.$this->remaining()],
            'reference_notes' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'payment_amount.max' => 'Jumlah pembayaran melebihi sisa reimbursement (Rp '.number_format($this->remaining(), 0, ',', '.').').',
            'payment_date.before_or_equal' => 'Tanggal pembayaran tidak boleh setelah hari ini.',
        ];
    }

    private function remaining(): int
    {
        return max(0, (int) $this->route('reimbursement')?->amount_remaining);
    }
}
