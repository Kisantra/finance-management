<?php

namespace App\Console\Commands;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Console\Command;
use Spatie\Permission\PermissionRegistrar;

class AddFeedbackPermissions extends Command
{
    protected $signature = 'permissions:add-feedback';

    protected $description = 'Add feedback permissions to existing roles (safe for production)';

    public function handle(): int
    {
        $this->info('🚀 Adding Feedback Permissions...');
        $this->newLine();

        // Clear cache
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Step 1: Create permissions if not exists
        $this->info('📋 Creating permissions...');
        $feedbackPermissions = [
            'view feedbacks',
            'create feedbacks',
            'edit feedbacks',
            'delete feedbacks',
            'respond feedbacks',
            'manage feedbacks',
        ];

        $newCount = 0;
        foreach ($feedbackPermissions as $permissionName) {
            $permission = Permission::firstOrCreate(['name' => $permissionName]);
            if ($permission->wasRecentlyCreated) {
                $this->line("  + Created: {$permissionName}");
                $newCount++;
            } else {
                $this->line("  ✓ Exists: {$permissionName}");
            }
        }

        $this->info("  Total: {$newCount} new permissions created");
        $this->newLine();

        // Step 2: Give permissions to roles (additive, not replacing)
        $this->info('📋 Adding permissions to roles...');

        // Admin - give all permissions
        $admin = Role::findByName('admin');
        $admin->givePermissionTo($feedbackPermissions);
        $this->line('  ✓ Admin: All feedback permissions added');

        // Finance Manager - give all permissions
        $financeManager = Role::findByName('finance manager');
        $financeManager->givePermissionTo($feedbackPermissions);
        $this->line('  ✓ Finance Manager: All feedback permissions added');

        // Staff - only basic permissions (no respond/manage)
        $staff = Role::findByName('staff');
        $staff->givePermissionTo([
            'view feedbacks',
            'create feedbacks',
            'edit feedbacks',
            'delete feedbacks',
        ]);
        $this->line('  ✓ Staff: Basic feedback permissions added');

        $this->newLine();
        $this->info('✅ Feedback permissions added successfully!');
        $this->newLine();

        // Show summary
        $this->table(
            ['Role', 'Total Permissions'],
            [
                ['Admin', $admin->permissions->count()],
                ['Finance Manager', $financeManager->permissions->count()],
                ['Staff', $staff->permissions->count()],
            ]
        );

        return Command::SUCCESS;
    }
}
