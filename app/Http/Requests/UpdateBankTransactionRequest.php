<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\MemeriksaKategoriTransaksi;
use App\Models\BankTransaction;
use App\Models\TransactionCategory;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateBankTransactionRequest extends FormRequest
{
    use MemeriksaKategoriTransaksi;

    public function authorize(): bool
    {
        $transaction = $this->route('bankTransaction');

        if (! $transaction instanceof BankTransaction) {
            return false;
        }

        // Pokok utang/piutang dicatat & dikelola modul Utang/Piutang: hanya-lihat di sini.
        if ($transaction->moduleLockMessage() !== null) {
            return false;
        }

        return $this->user()?->can($transaction->abilityFor('edit')) ?? false;
    }

    /** 403 dengan alasan yang terbaca bila transaksinya dikelola modul Utang/Piutang. */
    protected function failedAuthorization(): void
    {
        $transaction = $this->route('bankTransaction');
        $pesan = $transaction instanceof BankTransaction ? $transaction->moduleLockMessage() : null;

        throw new AuthorizationException($pesan ?? __('Tindakan ini tidak diizinkan.'));
    }

    public function rules(): array
    {
        return [
            'transaction_date' => ['required', 'date'],
            'description' => ['required', 'string', 'max:255'],
            'amount' => ['nullable', 'integer', 'min:1'],
            'category_id' => ['nullable', 'exists:transaction_categories,id'],
            'reference_number' => ['nullable', 'string', 'max:255'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'remove_attachment' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Kategori BARU diperiksa dengan aturan yang sama dengan pencatatan (MemeriksaKategoriTransaksi).
     * Kategori yang tidak berganti tidak diperiksa ulang, supaya transaksi lama (mis. bunga utang
     * berkategori sistem, atau data sebelum aturan ini) tetap bisa diubah tanggal/deskripsinya.
     * Kaki transfer dilewati: kategorinya memang tidak diubah lewat endpoint ini.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $transaction = $this->route('bankTransaction');
            $categoryId = $this->input('category_id');

            if (! $transaction instanceof BankTransaction || ! $categoryId
                || (int) $categoryId === (int) $transaction->category_id
                || $transaction->permissionFeature() === 'transfer') {
                return;
            }

            $kategori = TransactionCategory::find($categoryId);

            if ($kategori && ($pesan = $this->pesanKategoriTidakSah($kategori, $transaction->transaction_type))) {
                $validator->errors()->add('category_id', $pesan);
            }
        });
    }
}
