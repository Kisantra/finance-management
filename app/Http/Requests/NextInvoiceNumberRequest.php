<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Nomor invoice berikutnya untuk dialog "Simpan & terbitkan" di editor (belum ada id invoice). */
class NextInvoiceNumberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'issue_date' => ['required', 'date'],
            'document_type' => ['nullable', Rule::in(StoreInvoiceRequest::documentTypes())],
            'document_code' => StoreInvoiceRequest::documentCodeRules(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'client_id.required' => __('Pilih klien dulu.'),
            'client_id.exists' => __('Klien tidak ditemukan.'),
            'issue_date.required' => __('Isi tanggal invoice dulu.'),
            'document_type.in' => __('Jenis dokumen tidak tersedia untuk perusahaan ini.'),
            'document_code.regex' => __('Kode jenis hanya boleh huruf, angka, dan tanda hubung, mis. FINAL atau PNBP.'),
            'document_code.max' => __('Kode jenis maksimal 20 karakter.'),
        ];
    }
}
