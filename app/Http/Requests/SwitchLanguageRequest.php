<?php

namespace App\Http\Requests;

use App\Http\Middleware\SetLocale;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Pemilih bahasa (header & halaman tamu): hanya bahasa di `config('app.available_locales')`. */
class SwitchLanguageRequest extends FormRequest
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
            'locale' => ['required', 'string', Rule::in(SetLocale::available())],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'locale' => __('bahasa'),
        ];
    }
}
