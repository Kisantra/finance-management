<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => array_filter([
                'required', 'integer', 'min:1',
                // Pembayaran tidak boleh melampaui sisa tagihan. Tanpa batas ini
                // saldo bank naik penuh sementara amount_remaining jadi negatif.
                ($maks = $this->sisaTagihan()) !== null ? 'max:'.$maks : null,
            ]),
            'payment_date' => ['required', 'date'],
            'payment_method' => ['required', 'in:cash,bank_transfer'],
            'bank_account_id' => ['required', 'exists:bank_accounts,id'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'attachment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'bank_account_id.required' => 'Rekening tujuan wajib dipilih.',
            'bank_account_id.exists' => 'Rekening yang dipilih tidak valid.',
            // Sebutkan sisanya dan apa yang harus dilakukan. Pesan generik memaksa
            // user menebak berapa yang boleh dibayar, lalu mencoba berkali-kali.
            // Kalimat ini sama dengan yang dipakai PaymentController::exceedsRemaining()
            // pada jalur update, supaya user melihat kalimat yang sama di dua tempat.
            'amount.max' => 'Melebihi sisa tagihan Rp '.number_format((int) $this->sisaTagihan(), 0, ',', '.')
                .'. Catat kelebihan sebagai transaksi terpisah.',
        ];
    }

    /**
     * Sisa tagihan invoice terkait; null bila invoice tidak dapat ditentukan
     * (biarkan validasi lain yang menolak).
     *
     * Saat MENGUBAH pembayaran, nominal pembayaran itu sendiri dikembalikan
     * lebih dulu ke sisa — kalau tidak, mengedit satu-satunya pembayaran lunas
     * akan selalu ditolak karena sisanya sudah nol.
     */
    protected function sisaTagihan(): ?int
    {
        $payment = $this->route('payment');
        $invoice = $payment?->invoice ?? $this->route('invoice');

        if (! $invoice) {
            return null;
        }

        return (int) $invoice->amount_remaining + (int) ($payment->amount ?? 0);
    }
}
