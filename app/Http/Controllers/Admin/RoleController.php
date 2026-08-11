<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    public const AVAILABLE_ICONS = [
        'shield-check', 'shield-alert', 'user', 'user-cog', 'users',
        'banknote', 'dollar-sign', 'file-text', 'folder', 'briefcase',
        'bar-chart-3', 'settings', 'key-round', 'lock', 'lock-open',
        'eye', 'eye-off', 'pencil', 'trash-2', 'check-circle',
        'x-circle', 'circle-alert', 'info', 'star', 'heart',
        'bell', 'clipboard', 'copy', 'archive', 'inbox',
        'wrench', 'beaker', 'calculator', 'calendar', 'clock',
        'tag', 'bookmark',
    ];

    public function store(Request $request): RedirectResponse
    {
        abort_unless(auth()->user()->can('manage permissions'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('roles', 'name')],
            'icon' => ['required', 'string', Rule::in(self::AVAILABLE_ICONS)],
        ]);

        Role::create([
            'name' => strtolower($validated['name']),
            'icon' => $validated['icon'],
            'guard_name' => 'web',
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return redirect()->back()->with('success', 'Peran berhasil ditambahkan.');
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        abort_unless(auth()->user()->can('manage permissions'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('roles', 'name')->ignore($role->id)],
            'icon' => ['required', 'string', Rule::in(self::AVAILABLE_ICONS)],
        ]);

        $role->update([
            'name' => strtolower($validated['name']),
            'icon' => $validated['icon'],
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return redirect()->back()->with('success', 'Peran berhasil diperbarui.');
    }

    public function destroy(Role $role): RedirectResponse
    {
        abort_unless(auth()->user()->can('manage permissions'), 403);

        if (in_array($role->name, ['admin', 'staff'], true)) {
            return redirect()->back()->with('error', "Peran default '{$role->name}' tidak dapat dihapus.");
        }

        $currentUserRole = auth()->user()->roles->first();
        if ($currentUserRole && $currentUserRole->id === $role->id) {
            return redirect()->back()->with('error', 'Anda tidak dapat menghapus peran Anda sendiri.');
        }

        try {
            DB::transaction(function () use ($role) {
                $usersWithRole = $role->users;

                if ($usersWithRole->count() > 0) {
                    $fallbackRole = Role::withCount('permissions')
                        ->where('name', '!=', $role->name)
                        ->orderBy('permissions_count', 'asc')
                        ->first();

                    if (! $fallbackRole) {
                        $fallbackRole = Role::firstOrCreate(
                            ['name' => 'staff'],
                            ['guard_name' => 'web', 'icon' => 'user']
                        );
                    }

                    foreach ($usersWithRole as $user) {
                        $user->syncRoles([$fallbackRole->name]);
                    }
                }

                $role->delete();
            });

            app(PermissionRegistrar::class)->forgetCachedPermissions();

            return redirect()->back()->with('success', 'Peran berhasil dihapus.');
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Gagal menghapus peran: '.$e->getMessage());
        }
    }
}
