import { Link } from '@inertiajs/react';
import * as React from 'react';
import { companyUrl, isCentralPath } from '@/lib/company';

type LinkProps = React.ComponentProps<typeof Link>;

/**
 * `<Link>` Inertia yang memberi prefix `/c/{slug}` pada `href`.
 *
 * Sengaja EKSPLISIT, bukan lewat interceptor router: atribut `href` yang terrender
 * dipakai browser untuk klik-tengah, "buka di tab baru", dan salin tautan. Kalau
 * prefix hanya ditambahkan saat kunjungan diproses, tautan yang terlihat salah.
 *
 * Path central (login, panduan, …) dibiarkan apa adanya.
 */
export function AppLink({ href, ...rest }: Omit<LinkProps, 'href'> & { href: string }) {
    return <Link href={isCentralPath(href) ? href : companyUrl(href)} {...rest} />;
}
