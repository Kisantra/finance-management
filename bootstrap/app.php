<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SetLocale;
use App\Services\ErrorReportService;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);

        // Add SetLocale and HandleInertiaRequests to web group
        $middleware->web(append: [
            SetLocale::class,
            HandleInertiaRequests::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->context(fn () => ['error_id' => ErrorReportService::referenceId(request())]);

        // respond(), bukan render(): Handler mengubah TokenMismatchException menjadi
        // HttpException(419) SEBELUM callback render dicocokkan, sehingga callback
        // bertipe TokenMismatchException tidak pernah terpicu (penyebab layar
        // "419 PAGE EXPIRED" saat logout di produksi).
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            // Logout dengan sesi yang sudah habis: pengguna memang sudah keluar.
            if ($response->getStatusCode() === 419 && $request->routeIs('logout')) {
                return redirect()->route('login');
            }

            return app(ErrorReportService::class)->respond($response, $e, $request);
        });
    })->create();
