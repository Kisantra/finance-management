<?php

namespace App\Http\Middleware;

use App\Models\AppNotification;
use App\Models\FundRequest;
use App\Models\Reimbursement;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'avatar' => $user->avatar ?? null,
                ] : null,
                // Closure (lazy): dievaluasi saat render — SETELAH middleware
                // tenancy + SetPermissionsTeam men-set konteks perusahaan aktif
                'permissions' => fn () => $user ? $user->getAllPermissions()->pluck('name')->toArray() : [],
                'roles' => fn () => $user ? $user->getRoleNames()->toArray() : [],
            ],
            'company' => fn () => tenant() ? [
                'slug' => tenant()->getTenantKey(),
                'name' => tenant('name'),
                'abbreviation' => tenant('abbreviation'),
            ] : null,
            'companies' => fn () => $user
                ? $user->companies()
                    ->where('status', 'active')
                    ->get(['companies.id', 'name', 'abbreviation'])
                    ->map(fn ($company) => [
                        'slug' => $company->getTenantKey(),
                        'name' => $company->name,
                        'abbreviation' => $company->abbreviation,
                    ])->values()->toArray()
                : [],
            'locale' => app()->getLocale(),
            'flash' => [
                'success' => session('success'),
                'error' => session('error'),
                'warning' => session('warning'),
                'info' => session('info'),
            ],
            'notifications' => fn () => $user ? $this->getNotifications($user->id) : null,
            // Query ke tabel TENANT — hanya dalam konteks perusahaan aktif
            'actionCounts' => fn () => $user && tenant() ? $this->getActionCounts($user) : null,
        ];
    }

    /**
     * Sidebar badge counts: how many items the current user still needs to act
     * on — review (pending) plus disburse/pay (approved). Permission-aware, so a
     * user who can't review/disburse never sees those counts.
     *
     * @return array{reimbursements: int, fund_requests: int}
     */
    private function getActionCounts(User $user): array
    {
        $reimbursements = 0;
        if ($user->can('approve reimbursements')) {
            $reimbursements += Reimbursement::where('status', 'pending')->count();
        }
        if ($user->can('pay reimbursements')) {
            $reimbursements += Reimbursement::where('status', 'approved')->count();
        }

        $fundRequests = 0;
        if ($user->can('approve fund requests')) {
            $fundRequests += FundRequest::where('status', 'pending')->count();
        }
        if ($user->can('disburse fund requests')) {
            $fundRequests += FundRequest::where('status', 'approved')->count();
        }

        return [
            'reimbursements' => $reimbursements,
            'fund_requests' => $fundRequests,
        ];
    }

    private function getNotifications(int $userId): array
    {
        // Notifikasi tersimpan central; tampilkan milik perusahaan aktif + yang
        // tanpa konteks perusahaan (company_id NULL)
        $companyScope = fn ($query) => $query->when(tenant(), fn ($q) => $q->where(
            fn ($sub) => $sub->whereNull('company_id')->orWhere('company_id', tenant()->getTenantKey())
        ));

        $recent = $companyScope(AppNotification::forUser($userId))
            ->recent()
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(fn (AppNotification $n) => [
                'id' => $n->id,
                'type' => $n->type,
                'title' => $n->title,
                'message' => $n->message,
                'data' => $n->data,
                'read_at' => $n->read_at?->toIso8601String(),
                'created_at' => $n->created_at?->toIso8601String(),
                'icon' => $n->icon,
                'color' => $n->color,
            ]);

        return [
            'recent' => $recent->values()->toArray(),
            'unread_count' => $companyScope(AppNotification::forUser($userId))->unread()->count(),
        ];
    }
}
