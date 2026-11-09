<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\MemeriksaKategoriTransaksi;
use App\Models\BankTransaction;
use App\Models\TransactionCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreBankTransactionRequest extends FormRequest
{
    use MemeriksaKategoriTransaksi;

    public function authorize(): bool
    {
        $type = $this->input('transaction_type');

        // Defer an invalid/missing type to validation (422) rather than a 403.
        if (! in_array($type, ['credit', 'debit'], true)) {
            return true;
        }

        return $this->user()?->can('create '.BankTransaction::featureForType($type)) ?? false;
    }

    public function rules(): array
    {
        return [
            'bank_account_id' => ['required', 'exists:bank_accounts,id'],
            'category_id' => ['required', 'exists:transaction_categories,id'],
            'amount' => ['required', 'integer', 'min:1'],
            'transaction_date' => ['required', 'date'],
            'transaction_type' => ['required', 'in:credit,debit'],
            'description' => ['required', 'string', 'max:255'],
            'reference_number' => ['nullable', 'string', 'max:255'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ];
    }

    /**
     * Kategori harus sah untuk arah transaksinya (lihat MemeriksaKategoriTransaksi).
     *
     * Tanpa pemeriksaan tipe, transaksi `credit` berkategori `expense` diterima lalu menjadi
     * hantu: ia tidak muncul di halaman Pemasukan maupun Pengeluaran, tetapi saldo rekening
     * tetap berubah. Pendanaan (`financing`) kini sah untuk kedua arah: tampil di daftar
     * berpenanda Pendanaan dan tidak masuk Laba Rugi.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $categoryId = $this->input('category_id');
            $type = $this->input('transaction_type');

            if (! $categoryId || ! in_array($type, ['credit', 'debit'], true)) {
                return;
            }

            $kategori = TransactionCategory::find($categoryId);

            if ($kategori && ($pesan = $this->pesanKategoriTidakSah($kategori, $type))) {
                $validator->errors()->add('category_id', $pesan);
            }
        });
    }
}
