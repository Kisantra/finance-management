<?php

namespace App\Http\Requests;

use App\Models\Invoice;
use Illuminate\Foundation\Http\FormRequest;

class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Tagihan USD: yang diisi USD diterima + kurs saat diterima; Rupiahnya dihitung PaymentController.
        if ($this->invoice()?->isForeign()) {
            return [
                'foreign_amount' => array_filter([
                    'required', 'numeric', 'min:0.01',
                    ($maks = $this->sisaTagihanUsd()) !== null ? 'max:'.$maks : null,
                ]),
                'exchange_rate' => ['required', 'numeric', 'min:0.01', 'max:9999999999'],
                ...$this->commonRules(),
            ];
        }

        return [
            'amount' => array_filter([
                'required', 'integer', 'min:1',
                // Pembayaran tidak boleh melampaui sisa tagihan. Tanpa batas ini
                // saldo bank naik penuh sementara amount_remaining jadi negatif.
                ($maks = $this->sisaTagihan()) !== null ? 'max:'.$maks : null,
            ]),
            ...$this->commonRules(),
        ];
    }

    /**
     * @return array<string, list<string>>
     */
    private function commonRules(): array
    {
        return [
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
            'bank_account_id.required' => __('Rekening tujuan wajib dipilih.'),
            'bank_account_id.exists' => __('Rekening yang dipilih tidak valid.'),
            // Sebutkan sisanya dan apa yang harus dilakukan. Pesan generik memaksa
            // user menebak berapa yang boleh dibayar, lalu mencoba berkali-kali.
            // Kalimat ini sama dengan yang dipakai PaymentController::exceedsRemaining()
            // pada jalur update, supaya user melihat kalimat yang sama di dua tempat.
            'amount.max' => __('Melebihi sisa tagihan Rp :sisa. Catat kelebihan sebagai transaksi terpisah.', [
                'sisa' => number_format((int) $this->sisaTagihan(), 0, ',', '.'),
            ]),
            'foreign_amount.required' => __('USD yang diterima wajib diisi.'),
            'foreign_amount.numeric' => __('USD yang diterima harus berupa angka.'),
            'foreign_amount.min' => __('USD yang diterima harus lebih dari 0.'),
            'foreign_amount.max' => __('Melebihi sisa tagihan USD :sisa. Catat kelebihan sebagai transaksi terpisah.', [
                'sisa' => number_format((float) $this->sisaTagihanUsd(), 2, ',', '.'),
            ]),
            'exchange_rate.required' => __('Kurs saat diterima wajib diisi.'),
            'exchange_rate.numeric' => __('Kurs harus berupa angka.'),
            'exchange_rate.min' => __('Kurs harus lebih dari 0.'),
            'exchange_rate.max' => __('Kurs terlalu besar.'),
        ];
    }

    /** Invoice pembayaran ini: dari rute pembayaran (ubah) atau rute invoice (catat). */
    protected function invoice(): ?Invoice
    {
        return $this->route('payment')?->invoice ?? $this->route('invoice');
    }

    /** Sisa tagihan USD (sudah termasuk pembayaran yang sedang diubah); null bila bukan tagihan USD. */
    protected function sisaTagihanUsd(): ?float
    {
        $invoice = $this->invoice();

        if (! $invoice?->isForeign()) {
            return null;
        }

        return (Invoice::cents($invoice->foreign_remaining) + Invoice::cents($this->route('payment')?->foreign_amount)) / 100;
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
