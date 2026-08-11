<?php

use App\Providers\AppServiceProvider;
use App\Providers\TenancyServiceProvider;
use App\Providers\ViewServiceProvider;
use Laravel\Wayfinder\WayfinderServiceProvider;

return [
    AppServiceProvider::class,
    TenancyServiceProvider::class,
    ViewServiceProvider::class,
    WayfinderServiceProvider::class,
];
