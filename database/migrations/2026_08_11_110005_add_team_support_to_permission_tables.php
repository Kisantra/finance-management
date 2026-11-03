<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Patch Spatie teams (team_foreign_key = company_id, tipe STRING mengikuti
     * companies.id). Migration create_permission_tables sudah terlanjur jalan
     * dengan teams=false, jadi tabel existing harus ditambal — sesuai instruksi
     * resmi di komentar config/permission.php.
     *
     * PERHATIAN: baris model_has_roles/model_has_permissions lama DIHAPUS —
     * assignment pre-teams tidak punya konteks perusahaan. Dev: jalankan ulang
     * seeder. Produksi: assignment dibuat ulang oleh central:import-users.
     */
    public function up(): void
    {
        // Fresh install: create_permission_tables sudah membuat kolom team
        // (teams=true saat migrate jalan) — patch ini menjadi no-op.
        if (Schema::hasColumn('roles', 'company_id')) {
            return;
        }

        Schema::table('roles', function (Blueprint $table) {
            $table->string('company_id')->nullable()->after('id');
            $table->index('company_id', 'roles_team_foreign_key_index');
            $table->dropUnique(['name', 'guard_name']);
            $table->unique(['company_id', 'name', 'guard_name']);
        });

        DB::table('model_has_roles')->delete();
        Schema::table('model_has_roles', function (Blueprint $table) {
            $table->index('role_id', 'model_has_roles_role_id_index');
        });
        Schema::table('model_has_roles', function (Blueprint $table) {
            $table->dropPrimary('model_has_roles_role_model_type_primary');
            $table->string('company_id');
            $table->index('company_id', 'model_has_roles_team_foreign_key_index');
            $table->primary(['company_id', 'role_id', 'model_id', 'model_type'],
                'model_has_roles_role_model_type_primary');
        });

        DB::table('model_has_permissions')->delete();
        Schema::table('model_has_permissions', function (Blueprint $table) {
            $table->index('permission_id', 'model_has_permissions_permission_id_index');
        });
        Schema::table('model_has_permissions', function (Blueprint $table) {
            $table->dropPrimary('model_has_permissions_permission_model_type_primary');
            $table->string('company_id');
            $table->index('company_id', 'model_has_permissions_team_foreign_key_index');
            $table->primary(['company_id', 'permission_id', 'model_id', 'model_type'],
                'model_has_permissions_permission_model_type_primary');
        });
    }

    public function down(): void
    {
        Schema::table('model_has_permissions', function (Blueprint $table) {
            $table->dropPrimary('model_has_permissions_permission_model_type_primary');
            $table->dropIndex('model_has_permissions_team_foreign_key_index');
            $table->dropColumn('company_id');
            $table->primary(['permission_id', 'model_id', 'model_type'],
                'model_has_permissions_permission_model_type_primary');
            $table->dropIndex('model_has_permissions_permission_id_index');
        });

        Schema::table('model_has_roles', function (Blueprint $table) {
            $table->dropPrimary('model_has_roles_role_model_type_primary');
            $table->dropIndex('model_has_roles_team_foreign_key_index');
            $table->dropColumn('company_id');
            $table->primary(['role_id', 'model_id', 'model_type'],
                'model_has_roles_role_model_type_primary');
            $table->dropIndex('model_has_roles_role_id_index');
        });

        Schema::table('roles', function (Blueprint $table) {
            $table->dropUnique(['company_id', 'name', 'guard_name']);
            $table->dropIndex('roles_team_foreign_key_index');
            $table->dropColumn('company_id');
            $table->unique(['name', 'guard_name']);
        });
    }
};
