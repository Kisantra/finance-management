<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Unique;

class UpdateBankAccountRequest extends StoreBankAccountRequest
{
    /** Sama dengan tambah akun, tetapi nomor milik akun ini sendiri boleh dipakai lagi. */
    protected function uniqueAccountNumber(): Unique
    {
        return Rule::unique('bank_accounts', 'account_number')->ignore($this->route('bankAccount'));
    }
}
