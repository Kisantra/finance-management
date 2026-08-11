<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\PermissionRegistrar;

class PermissionController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless(auth()->user()->can('view permissions'), 403);

        $roles = Role::with('permissions')
            ->withCount(['users', 'permissions'])
            ->orderBy('name')
            ->get()
            ->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'icon' => $role->icon ?? 'shield-check',
                'permissions_count' => $role->permissions_count,
                'users_count' => $role->users_count,
                'permission_ids' => $role->permissions->pluck('id')->toArray(),
            ]);

        $permissions = Permission::orderBy('name')->get();

        $groupedPermissions = $permissions
            ->groupBy(function (Permission $p) {
                $parts = explode(' ', $p->name, 2);

                return count($parts) > 1 ? ucwords($parts[1]) : 'Other';
            })
            ->sortKeys()
            ->map(fn ($group) => $group->map(fn (Permission $p) => [
                'id' => $p->id,
                'name' => $p->name,
            ])->values())
            ->toArray();

        $selectedRoleId = (int) $request->input('role', $roles->first()['id'] ?? 0);

        return Inertia::render('permissions/index', [
            'roles' => $roles->values(),
            'groupedPermissions' => $groupedPermissions,
            'totalPermissions' => $permissions->count(),
            'selectedRoleId' => $selectedRoleId,
            'canManagePermissions' => auth()->user()->can('manage permissions'),
        ]);
    }

    public function togglePermission(Request $request): RedirectResponse
    {
        abort_unless(auth()->user()->can('manage permissions'), 403);

        $validated = $request->validate([
            'role_id' => ['required', 'integer', 'exists:roles,id'],
            'permission_id' => ['required', 'integer', 'exists:permissions,id'],
        ]);

        $role = Role::findOrFail($validated['role_id']);
        $permission = Permission::findOrFail($validated['permission_id']);

        if ($role->permissions->contains('id', $permission->id)) {
            $role->revokePermissionTo($permission);
        } else {
            $role->givePermissionTo($permission);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return redirect()->back();
    }

    public function syncModule(Request $request): RedirectResponse
    {
        abort_unless(auth()->user()->can('manage permissions'), 403);

        $validated = $request->validate([
            'role_id' => ['required', 'integer', 'exists:roles,id'],
            'module' => ['required', 'string'],
            'action' => ['required', 'in:grant,revoke'],
        ]);

        $role = Role::findOrFail($validated['role_id']);

        $modulePermissions = Permission::where('name', 'like', "% {$validated['module']}")
            ->orWhere('name', 'like', "% {$validated['module']} %")
            ->get()
            ->filter(function (Permission $p) use ($validated) {
                $parts = explode(' ', $p->name, 2);
                $mod = count($parts) > 1 ? ucwords($parts[1]) : 'Other';

                return $mod === $validated['module'];
            });

        if ($validated['action'] === 'grant') {
            foreach ($modulePermissions as $permission) {
                $role->givePermissionTo($permission);
            }
        } else {
            foreach ($modulePermissions as $permission) {
                $role->revokePermissionTo($permission);
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return redirect()->back();
    }

    public function syncAll(Request $request): RedirectResponse
    {
        abort_unless(auth()->user()->can('manage permissions'), 403);

        $validated = $request->validate([
            'role_id' => ['required', 'integer', 'exists:roles,id'],
            'action' => ['required', 'in:grant,revoke'],
        ]);

        $role = Role::findOrFail($validated['role_id']);

        if ($validated['action'] === 'grant') {
            $role->syncPermissions(Permission::all());
        } else {
            $role->syncPermissions([]);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return redirect()->back();
    }

    public function destroy(Permission $permission): RedirectResponse
    {
        abort_unless(auth()->user()->can('manage permissions'), 403);

        try {
            DB::transaction(function () use ($permission) {
                foreach ($permission->roles as $role) {
                    $role->revokePermissionTo($permission);
                }
                $permission->delete();
            });

            app(PermissionRegistrar::class)->forgetCachedPermissions();

            return redirect()->back()->with('success', 'Permission berhasil dihapus.');
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Gagal menghapus permission: '.$e->getMessage());
        }
    }
}
