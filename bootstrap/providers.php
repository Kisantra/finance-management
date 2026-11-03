<?php

use App\Providers\AppServiceProvider;
use App\Providers\TenancyServiceProvider;
use Laravel\Wayfinder\WayfinderServiceProvider;

return [
    AppServiceProvider::class,
    TenancyServiceProvider::class,
    WayfinderServiceProvider::class,
];
