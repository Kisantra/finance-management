import * as React from 'react';
import { AppLayout } from '@/layouts/app-layout';
import { PageHeader } from '@/components/shared/page-header';
import { StatsCard } from '@/components/shared/stats-card';
import { LayoutDashboard } from 'lucide-react';

export default function Welcome() {
    return (
        <div className="space-y-6">
            {/* i18n-abaikan: halaman uji lama, tidak dirender rute mana pun */}
            <PageHeader
                title="Finance Management" // i18n-abaikan: halaman uji tak dirender
                description="React + Inertia migration in progress" // i18n-abaikan: halaman uji tak dirender
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* i18n-abaikan: halaman uji tak dirender */}
                <StatsCard label="Phase" value="1 ✅" icon={<LayoutDashboard />} color="blue" />
                {/* i18n-abaikan: halaman uji tak dirender */}
                <StatsCard label="Status" value="Migrating" icon={<LayoutDashboard />} color="green" />
            </div>
        </div>
    );
}

Welcome.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;
