<?php

namespace App\Http\Requests;

use App\Models\Client;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreReceivableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', 'in:employee_loan,company_loan'],
            // Hanya `integer` sebelumnya: id apa pun diterima, termasuk id yang
            // tidak ada dan id yang tipenya tidak cocok dengan jenis piutang.
            // `debtor_type` ditentukan semata dari `type`, jadi ketidakcocokan
            // itu langsung menghasilkan relasi polimorfik yang menunjuk entah
            // ke mana.
            'debtor_id' => ['required', 'integer'],
            'principal_amount' => ['required', 'integer', 'min:1'],
            'interest_type' => ['required', 'in:fixed,percentage'],
            'interest_amount' => ['nullable', 'integer', 'min:0'],
            'interest_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'installment_months' => ['required', 'integer', 'min:1'],
            'loan_date' => ['required', 'date'],
            'purpose' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'disbursement_account' => ['required', 'string', 'max:255'],
            'contract_attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ];
    }

    /**
     * Debitur harus benar-benar ada dan sesuai jenis piutangnya.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $id = $this->input('debtor_id');
            $type = $this->input('type');

            if (! $id || ! $type) {
                return;
            }

            $ada = $type === 'employee_loan'
                ? User::whereKey($id)->exists()
                : Client::whereKey($id)->exists();

            if (! $ada) {
                $validator->errors()->add('debtor_id', $type === 'employee_loan'
                    ? __('Karyawan yang dipilih tidak ditemukan.')
                    : __('Klien yang dipilih tidak ditemukan.'));
            }
        });
    }
}
