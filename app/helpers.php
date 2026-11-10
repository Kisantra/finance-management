<?php

use App\Http\Middleware\SetDocumentLocale;

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
