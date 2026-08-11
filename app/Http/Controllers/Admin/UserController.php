<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BulkDestroyUserRequest;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->input('search');
        $role = $request->input('role');
        $status = $request->input('status');
        $perPage = (int) $request->input('per_page', 10);
        $sort = $request->input('sort', 'created_at');
        $direction = $request->input('direction', 'desc');

        $users = User::query()
            ->with('roles')
            ->when($search, fn (Builder $q) => $q->whereAny(
                ['name', 'email', 'phone_number'],
                'like',
                '%'.trim($search).'%'
            ))
            ->when($role, fn (Builder $q) => $q->whereHas('roles', fn ($qr) => $qr->where('name', $role)))
            ->when($status, fn (Builder $q) => $q->where('status', $status))
            ->orderBy($sort, $direction)
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone_number' => $user->phone_number,
                'status' => $user->status,
                'role' => $user->roles->first()?->name,
                'role_icon' => $user->roles->first()?->icon,
                'initials' => $user->initials(),
                'created_at' => $user->created_at?->toIso8601String(),
                'is_current' => $user->id === auth()->id(),
            ]);

        $total = User::count();
        $active = User::where('status', 'active')->count();

        $stats = [
            'total' => $total,
            'active' => $active,
            'inactive' => $total - $active,
            'admins' => User::role('admin')->count(),
            'finance_managers' => User::role('finance manager')->count(),
        ];

        $roleOptions = Role::orderBy('name')->get()->map(fn ($r) => [
            'label' => ucfirst($r->name),
            'value' => $r->name,
        ])->toArray();

        return Inertia::render('users/index', [
            'users' => $users,
            'stats' => $stats,
            'roleOptions' => $roleOptions,
            'filters' => [
                'search' => $search,
                'role' => $role,
                'status' => $status,
                'per_page' => $perPage,
                'sort' => $sort,
                'direction' => $direction,
            ],
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        $this->authorize('manage users');

        $validated = $request->validated();

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone_number' => $validated['phone_number'] ?? null,
            'status' => $validated['status'],
            'password' => Hash::make($validated['password']),
            'email_verified_at' => now(),
        ]);

        // User baru masuk ke organization & perusahaan aktif admin yang membuatnya
        $user->organization()->associate(auth()->user()->organization_id)->save();
        if ($companyId = getPermissionsTeamId()) {
            $user->companies()->syncWithoutDetaching([$companyId]);
        }

        $user->assignRole($validated['role']);

        return redirect()->back()->with('success', 'Pengguna berhasil ditambahkan.');
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $this->authorize('manage users');

        $validated = $request->validated();

        $user->update([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone_number' => $validated['phone_number'] ?? null,
            'status' => $validated['status'],
        ]);

        if (! empty($validated['password'])) {
            $user->update(['password' => Hash::make($validated['password'])]);
        }

        $user->syncRoles([$validated['role']]);

        return redirect()->back()->with('success', 'Pengguna berhasil diperbarui.');
    }

    public function destroy(User $user): RedirectResponse
    {
        $this->authorize('manage users');

        if ($user->id === auth()->id()) {
            return redirect()->back()->with('error', 'Anda tidak dapat menghapus akun sendiri.');
        }

        $user->delete();

        return redirect()->back()->with('success', 'Pengguna berhasil dihapus.');
    }

    public function bulkDestroy(BulkDestroyUserRequest $request): RedirectResponse
    {
        $this->authorize('manage users');

        $validated = $request->validated();

        $ids = array_diff($validated['ids'], [auth()->id()]);
        $count = count($ids);

        if ($count === 0) {
            return redirect()->back()->with('error', 'Tidak ada pengguna yang dapat dihapus.');
        }

        User::whereIn('id', $ids)->delete();

        return redirect()->back()->with('success', "Berhasil menghapus {$count} pengguna.");
    }
}
