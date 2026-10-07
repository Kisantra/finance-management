<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SendInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $invoice = $this->route('invoice');

        return [
            'invoice_number' => ['required', 'string', 'max:100', "unique:invoices,invoice_number,{$invoice->id}"],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'invoice_number.required' => 'Nomor invoice wajib diisi.',
            'invoice_number.unique' => 'Nomor ini sudah dipakai invoice lain.',
        ];
    }
}
