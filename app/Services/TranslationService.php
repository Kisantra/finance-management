<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Stichoza\GoogleTranslate\GoogleTranslate;

class TranslationService
{
    /**
     * Translate text using Stichoza Google Translate PHP package
     *
     * @param string $text
     * @param string $targetLang 'id' or 'zh'
     * @param string $sourceLang source language code, or 'auto' for auto-detection
     * @return string
     */
    public function translate(string $text, string $targetLang, string $sourceLang = 'id'): string
    {
        // Don't translate if target is same as source
        if ($targetLang === $sourceLang) {
            return $text;
        }

        // Test tidak boleh bergantung pada jaringan. Tanpa penjaga ini satu test yang
        // menyentuh teks belum ter-cache akan memanggil API terjemahan sungguhan dan
        // menggantung sampai batas waktu eksekusi PHP.
        if (app()->runningUnitTests()) {
            return $text;
        }

        // Cache key to avoid repeated API calls
        $cacheKey = "translation.{$sourceLang}.{$targetLang}." . md5($text);

        return Cache::remember($cacheKey, now()->addMonths(6), function () use ($text, $targetLang, $sourceLang) {
            try {
                // Timeout WAJIB. Tanpa ini request yang menggantung tidak melempar
                // exception apa pun — `catch` di bawah tidak kena — dan request web
                // ikut menggantung sampai max_execution_time PHP. Lebih baik teks
                // asli tampil dalam 3 detik daripada halaman mati dalam 300.
                $tr = (new GoogleTranslate($targetLang, $sourceLang))
                    ->setOptions(['timeout' => 3, 'connect_timeout' => 2]);

                return $tr->translate($text) ?? $text;
            } catch (\Exception $e) {
                \Log::warning("Translation failed for '{$text}': " . $e->getMessage());
                return $text;
            }
        });
    }

    /**
     * Translate category name based on current locale
     *
     * @param string $categoryName
     * @return string
     */
    public function translateCategory(string $categoryName): string
    {
        $currentLocale = app()->getLocale();

        // If locale is Indonesian, no translation needed
        if ($currentLocale === 'id') {
            return $categoryName;
        }

        // Translate to current locale
        return $this->translate($categoryName, $currentLocale, 'id');
    }

    /**
     * Batch translate multiple texts
     *
     * @param array $texts
     * @param string $targetLang
     * @param string $sourceLang
     * @return array
     */
    public function batchTranslate(array $texts, string $targetLang, string $sourceLang = 'id'): array
    {
        $results = [];

        foreach ($texts as $key => $text) {
            $results[$key] = $this->translate($text, $targetLang, $sourceLang);
        }

        return $results;
    }

    /**
     * Clear translation cache for specific text
     *
     * @param string $text
     * @param string $targetLang
     * @param string $sourceLang
     * @return void
     */
    public function clearCache(string $text, string $targetLang, string $sourceLang = 'id'): void
    {
        $cacheKey = "translation.{$sourceLang}.{$targetLang}." . md5($text);
        Cache::forget($cacheKey);
    }

    /**
     * Clear all translation cache
     *
     * @return void
     */
    public function clearAllCache(): void
    {
        Cache::flush();
    }
}
