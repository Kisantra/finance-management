<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreClientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('alias'))) {
            $this->merge(['alias' => strtoupper(trim($this->input('alias')))]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            // Dibaca ulang oleh pola penomoran ([A-Za-z0-9]+), jadi tanpa spasi/tanda baca.
            'alias' => ['nullable', 'string', 'max:10', 'regex:/^[A-Z0-9]+$/'],
            'type' => ['required', 'in:individual,company'],
            'email' => ['nullable', 'email', 'unique:clients,email'],
            'NPWP' => ['nullable', 'string', 'max:20'],
            'KPP' => ['nullable', 'string', 'max:20'],
            'EFIN' => ['nullable', 'string', 'max:20'],
            'status' => ['required', 'in:Active,Inactive'],
            'account_representative' => ['nullable', 'string', 'max:255'],
            'ar_phone_number' => ['nullable', 'string', 'max:20'],
            'person_in_charge' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'alias.max' => __('Alias maksimal 10 karakter.'),
            'alias.regex' => __('Alias hanya boleh huruf dan angka, tanpa spasi atau tanda baca.'),
        ];
    }
}
