<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Server Side Rendering
    |--------------------------------------------------------------------------
    |
    | Aplikasi ini TIDAK memakai SSR: tidak ada resources/js/ssr.tsx, tidak ada
    | bundle bootstrap/ssr, tidak ada entri ssr di vite.config.js, dan tidak ada
    | skrip npm yang menjalankan servernya.
    |
    | Tetapi default paket adalah `env('INERTIA_SSR_ENABLED', true)`. Tanpa
    | berkas ini, SETIAP render halaman Inertia mengirim POST HTTP ke
    | http://127.0.0.1:13714 yang tidak pernah dijawab siapa pun — pekerjaan
    | terbuang di tiap request, dan di lingkungan yang MEN-DROP paket alih-alih
    | menolaknya, request-nya MENGGANTUNG. Itu persis yang terjadi saat suite
    | test dijalankan: satu render halaman error menggantung 300 detik sampai
    | batas eksekusi PHP.
    |
    | Default dibalik menjadi `false` di sini, bukan hanya di .env, supaya ia
    | ikut bersama kode ke setiap site baru yang dibuat untuk perusahaan lain.
    | Nyalakan lewat INERTIA_SSR_ENABLED=true bila suatu saat SSR benar-benar
    | dipasang — dan saat itu, pasang juga server SSR-nya.
    |
    */

    'ssr' => [

        'enabled' => (bool) env('INERTIA_SSR_ENABLED', false),

        'url' => env('INERTIA_SSR_URL', 'http://127.0.0.1:13714'),

    ],

    /*
    |--------------------------------------------------------------------------
    | Testing
    |--------------------------------------------------------------------------
    |
    | Dibiarkan sesuai bawaan paket.
    |
    */

    'testing' => [

        'ensure_pages_exist' => true,

        'page_paths' => [
            resource_path('js/pages'),
        ],

        'page_extensions' => [
            'js',
            'jsx',
            'svelte',
            'ts',
            'tsx',
            'vue',
        ],

    ],

];
