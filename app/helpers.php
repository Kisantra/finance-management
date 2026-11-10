<?php

use App\Http\Middleware\SetDocumentLocale;
use App\Services\TranslationService;

if (! function_exists('withDocumentLocale')) {
    /**
     * Jalankan $callback dalam Bahasa Indonesia (bahasa dokumen, K2), lalu pulihkan bahasa tampilan —
     * juga bila $callback melempar. Untuk isi dokumen yang dibangun di dalam request tampilan, mis.
     * contoh kanvas template builder. Rute dokumen utuh cukup diberi middleware `locale.dokumen`.
     *
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    function withDocumentLocale(callable $callback): mixed
    {
        return SetDocumentLocale::run($callback);
    }
}

if (! function_exists('translate_text')) {
    /**
     * Auto-translate text to current locale
     */
    function translate_text(string $text, string $sourceLang = 'id'): string
    {
        $currentLocale = app()->getLocale();

        // If locale is Indonesian, no translation needed
        if ($currentLocale === 'id') {
            return $text;
        }

        $translationService = app(TranslationService::class);

        return $translationService->translate($text, $currentLocale, $sourceLang);
    }
}

if (! function_exists('translate_category')) {
    /**
     * Translate category name to current locale
     */
    function translate_category(string $categoryName): string
    {
        $translationService = app(TranslationService::class);

        return $translationService->translateCategory($categoryName);
    }
}
