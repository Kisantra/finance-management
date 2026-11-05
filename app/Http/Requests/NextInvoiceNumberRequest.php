<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Nomor invoice berikutnya untuk dialog "Simpan & terbitkan" di editor (belum ada id invoice). */
class NextInvoiceNumberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'issue_date' => ['required', 'date'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'client_id.required' => 'Pilih klien dulu.',
            'client_id.exists' => 'Klien tidak ditemukan.',
            'issue_date.required' => 'Isi tanggal invoice dulu.',
        ];
    }
}
