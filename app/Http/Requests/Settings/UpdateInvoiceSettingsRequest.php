<?php

namespace App\Http\Requests\Settings;

use App\Models\CompanyProfile;
use App\Services\InvoiceNumberService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateInvoiceSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'format' => ['required', 'string', 'max:100'],
            'padding' => ['required', 'integer', Rule::in(InvoiceNumberService::PADDINGS)],
            'reset' => ['required', 'string', Rule::in(InvoiceNumberService::RESETS)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'format.required' => 'Pola nomor wajib diisi.',
            'format.max' => 'Pola nomor maksimal 100 karakter.',
            'padding.in' => 'Jumlah digit harus antara 1 dan 5.',
            'reset.in' => 'Pilih kapan nomor kembali ke 1.',
        ];
    }

    /**
     * @return array<int, \Closure>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                if (! CompanyProfile::current()) {
                    $validator->errors()->add('format', 'Lengkapi Profil Perusahaan terlebih dahulu; pengaturan penomoran disimpan di sana.');

                    return;
                }

                $error = app(InvoiceNumberService::class)->formatError($this->input('format'), $this->input('reset'));
                if ($error) {
                    $validator->errors()->add('format', $error);
                }
            },
        ];
    }
}
