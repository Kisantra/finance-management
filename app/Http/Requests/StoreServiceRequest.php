<?php

namespace App\Http\Requests;

use App\Http\Controllers\ServiceController;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            // Dulu daftar tipe ditulis ulang sebagai string literal di sini,
            // terpisah dari ServiceController::TYPES yang mengisi Combobox.
            // Menambah satu tipe di satu sisi saja menghasilkan opsi yang muncul
            // di layar tetapi ditolak 422 saat disimpan.
            'type' => ['required', Rule::in(ServiceController::TYPES)],
            'price' => ['required', 'integer', 'min:0'],
        ];
    }
}
