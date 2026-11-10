<?php

namespace App\Http\Requests;

use App\Models\BankAccount;
use App\Models\User;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Unique;

class StoreBankAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Klien lama (dan formulir sebelum ada jenis akun) tidak mengirim `type`: anggap rekening
     * bank, persis perilaku sebelumnya.
     */
    protected function prepareForValidation(): void
    {
        if (blank($this->input('type'))) {
            $this->merge(['type' => BankAccount::TYPE_BANK]);
        }
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $kas = $this->input('type') === BankAccount::TYPE_CASH;

        return [
            'type' => ['required', Rule::in([BankAccount::TYPE_BANK, BankAccount::TYPE_CASH])],
            'account_name' => ['required', 'string', 'max:255'],
            // Kas boleh tanpa nomor & bank: model mengisi kode KAS-0001 dan "Tunai".
            'account_number' => [$kas ? 'nullable' : 'required', 'string', 'max:255', $this->uniqueAccountNumber()],
            'bank_name' => [$kas ? 'nullable' : 'required', 'string', 'max:255'],
            'branch' => ['nullable', 'string', 'max:255'],
            'initial_balance' => ['required', 'integer', 'min:0'],
            // Penanggung jawab & plafon hanya bermakna untuk kas; untuk rekening bank dibuang.
            'custodian_id' => ['exclude_unless:type,'.BankAccount::TYPE_CASH, 'bail', 'nullable', 'integer', $this->companyMember()],
            'cash_limit' => ['exclude_unless:type,'.BankAccount::TYPE_CASH, 'nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.required' => __('Pilih jenis akun: Bank atau Kas.'),
            'type.in' => __('Jenis akun harus Bank atau Kas.'),
            'account_name.required' => __('Nama akun wajib diisi.'),
            'account_name.string' => __('Nama akun harus berupa teks.'),
            'account_name.max' => __('Nama akun maksimal 255 karakter.'),
            'account_number.required' => __('Nomor rekening wajib diisi untuk rekening bank.'),
            'account_number.string' => __('Nomor rekening harus berupa teks.'),
            'account_number.max' => __('Nomor rekening maksimal 255 karakter.'),
            'account_number.unique' => __('Nomor rekening ini sudah dipakai akun lain.'),
            'bank_name.required' => __('Nama bank wajib diisi untuk rekening bank.'),
            'bank_name.string' => __('Nama bank harus berupa teks.'),
            'bank_name.max' => __('Nama bank maksimal 255 karakter.'),
            'branch.string' => __('Cabang harus berupa teks.'),
            'branch.max' => __('Cabang maksimal 255 karakter.'),
            'initial_balance.required' => __('Saldo awal wajib diisi (boleh 0).'),
            'initial_balance.integer' => __('Saldo awal harus berupa angka rupiah tanpa desimal.'),
            'initial_balance.min' => __('Saldo awal tidak boleh negatif.'),
            'custodian_id.integer' => __('Penanggung jawab tidak dikenal.'),
            'cash_limit.integer' => __('Plafon harus berupa angka rupiah tanpa desimal.'),
            'cash_limit.min' => __('Plafon tidak boleh negatif.'),
        ];
    }

    /** Nomor rekening unik di semua akun (kode KAS- milik akun kas ikut dihitung). */
    protected function uniqueAccountNumber(): Unique
    {
        return Rule::unique('bank_accounts', 'account_number');
    }

    /**
     * Penanggung jawab harus anggota perusahaan yang sedang dibuka. Pengguna & keanggotaan
     * hidup di database PUSAT, jadi dicek lewat scope User::memberOfCurrentCompany(), bukan
     * rule `exists` (yang membaca database perusahaan).
     */
    private function companyMember(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! User::query()->memberOfCurrentCompany()->whereKey($value)->exists()) {
                $fail(__('Penanggung jawab harus anggota perusahaan ini.'));
            }
        };
    }
}
