<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreServiceRequest;
use App\Http\Requests\UpdateServiceRequest;
use App\Models\Service;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ServiceController extends Controller
{
    /**
     * Kolom yang boleh dipakai mengurutkan.
     *
     * Nilai `sort` dari URL dulu diteruskan langsung ke orderBy(), sehingga
     * `?sort=kolom_ngawur` menjatuhkan halaman dengan 500 — input pengguna yang
     * menjadi SQL. ClientController sudah memakai daftar putih seperti ini sejak
     * awal; ServiceController tertinggal. Ditemukan QC 2026-11-03.
     *
     * @var list<string>
     */
    private const KOLOM_URUT = ['name', 'type', 'price', 'created_at'];

    public const TYPES = [
        'Perizinan',
        'Administrasi Perpajakan',
        'Digital Marketing',
        'Sistem Digital',
    ];

    public function index(Request $request): Response
    {
        $search = $request->input('search');
        $type = $request->input('type');
        $perPage = (int) $request->input('per_page', 10);
        $sort = in_array($request->input('sort'), self::KOLOM_URUT, true)
            ? $request->input('sort')
            : 'created_at';
        $direction = $request->input('direction') === 'asc' ? 'asc' : 'desc';

        $services = Service::query()
            ->select(['id', 'name', 'type', 'price', 'created_at'])
            ->when($search, fn ($q) => $q->where('name', 'like', "%{$search}%"))
            ->when($type, fn ($q) => $q->where('type', $type))
            ->orderBy($sort, $direction)
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (Service $s) => [
                'id' => $s->id,
                'name' => $s->name,
                'type' => $s->type,
                'price' => $s->price,
                'created_at' => $s->created_at?->toDateString(),
            ]);

        $aggregate = Service::selectRaw('COUNT(*) as total, AVG(price) as avg_price, MAX(price) as highest_price')
            ->toBase()->first();

        $stats = [
            'total' => (int) ($aggregate->total ?? 0),
            'avg_price' => (int) ($aggregate->avg_price ?? 0),
            'highest_price' => (int) ($aggregate->highest_price ?? 0),
            'by_type' => Service::selectRaw('type, COUNT(*) as count')
                ->groupBy('type')
                ->orderByDesc('count')
                ->pluck('count', 'type'),
        ];

        return Inertia::render('services/index', [
            'services' => $services,
            'stats' => $stats,
            'types' => self::TYPES,
            'filters' => [
                'search' => $search,
                'type' => $type,
                'per_page' => $perPage,
                'sort' => $sort,
                'direction' => $direction,
            ],
        ]);
    }

    public function store(StoreServiceRequest $request): RedirectResponse
    {
        Service::create($request->validated());

        return redirect()->back()->with('success', 'Layanan berhasil ditambahkan.');
    }

    public function update(UpdateServiceRequest $request, Service $service): RedirectResponse
    {
        $service->update($request->validated());

        return redirect()->back()->with('success', 'Layanan berhasil diperbarui.');
    }

    public function destroy(Service $service): RedirectResponse
    {
        $service->delete();

        return redirect()->back()->with('success', 'Layanan berhasil dihapus.');
    }
}
