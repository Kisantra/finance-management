<?php

namespace App\Http\Controllers;

use App\Http\Requests\ChangeStatusFeedbackRequest;
use App\Http\Requests\RespondFeedbackRequest;
use App\Http\Requests\StoreFeedbackRequest;
use App\Http\Requests\UpdateFeedbackRequest;
use App\Models\AppNotification;
use App\Models\Feedback;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class FeedbackController extends Controller
{
    public function index(Request $request): Response
    {
        $user = auth()->user();
        $canManage = $user->can('manage feedbacks');

        $tab = $request->input('tab', $canManage ? 'all' : 'mine');
        $search = $request->input('search');
        $status = $request->input('status');
        $type = $request->input('type');
        $priority = $request->input('priority');
        $perPage = (int) $request->input('per_page', 10);
        $sort = $request->input('sort', 'created_at');
        $direction = $request->input('direction', 'desc');

        $baseQuery = ($canManage && $tab === 'all')
            ? Feedback::query()
            : Feedback::forUser($user->id);

        $rows = $baseQuery
            ->with(['user', 'responder'])
            ->when($search, fn (Builder $q) => $q->where(function ($qq) use ($search) {
                $qq->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhereHas('user', fn ($qu) => $qu->where('name', 'like', "%{$search}%"));
            }))
            ->when($status, fn (Builder $q) => $q->byStatus($status))
            ->when($type, fn (Builder $q) => $q->byType($type))
            ->when($priority, fn (Builder $q) => $q->byPriority($priority))
            ->orderBy($sort, $direction)
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (Feedback $f) => $this->mapFeedback($f));

        // Stats are scoped to user view
        $statsQuery = $canManage && $tab === 'all'
            ? Feedback::query()
            : Feedback::forUser($user->id);

        $stats = $this->computeStats($statsQuery);

        return Inertia::render('feedbacks/index', [
            'rows' => $rows,
            'stats' => $stats,
            'filters' => [
                'tab' => $tab,
                'search' => $search,
                'status' => $status,
                'type' => $type,
                'priority' => $priority,
                'per_page' => $perPage,
                'sort' => $sort,
                'direction' => $direction,
            ],
            'canManage' => $canManage,
            'canRespond' => $user->can('respond feedbacks'),
            'showFeedback' => $request->has('show')
                ? $this->loadFeedback((int) $request->input('show'), $user, $canManage)
                : null,
        ]);
    }

    public function store(StoreFeedbackRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        DB::transaction(function () use ($validated, $request) {
            $attachmentPath = null;
            $attachmentName = null;

            if ($request->hasFile('attachment')) {
                $file = $request->file('attachment');
                $attachmentPath = $file->store('feedbacks', 'public');
                $attachmentName = $file->getClientOriginalName();
            }

            $feedback = Feedback::create([
                'user_id' => auth()->id(),
                'company_id' => tenant()?->getTenantKey(),
                'title' => $validated['title'],
                'description' => $validated['description'],
                'type' => $validated['type'],
                'priority' => $validated['priority'],
                'page_url' => $validated['page_url'] ?? null,
                'attachment_path' => $attachmentPath,
                'attachment_name' => $attachmentName,
                'status' => 'open',
            ]);

            $this->notifyAdmins($feedback);
        });

        return redirect()->back()->with('success', 'Feedback berhasil dikirim. Terima kasih atas masukannya.');
    }

    public function update(UpdateFeedbackRequest $request, Feedback $feedback): RedirectResponse
    {
        abort_unless($feedback->user_id === auth()->id() && $feedback->canEdit(), 403);

        $validated = $request->validated();

        $feedback->update($validated);

        return redirect()->back()->with('success', 'Feedback berhasil diperbarui.');
    }

    public function destroy(Feedback $feedback): RedirectResponse
    {
        abort_unless($feedback->user_id === auth()->id() || auth()->user()->can('manage feedbacks'), 403);

        if ($feedback->user_id === auth()->id() && ! $feedback->canDelete()) {
            return redirect()->back()->with('error', 'Feedback yang sudah diproses tidak dapat dihapus.');
        }

        $feedback->delete();

        return redirect()->back()->with('success', 'Feedback berhasil dihapus.');
    }

    public function respond(RespondFeedbackRequest $request, Feedback $feedback): RedirectResponse
    {
        abort_unless(auth()->user()->can('respond feedbacks'), 403);
        abort_unless($feedback->canRespond(), 403);

        $validated = $request->validated();

        $feedback->respond(auth()->id(), $validated['response'], $validated['status']);

        AppNotification::notify(
            $feedback->user_id,
            'feedback_responded',
            'Tanggapan Feedback',
            'Feedback "'.$feedback->title.'" telah ditanggapi oleh '.auth()->user()->name,
            ['feedback_id' => $feedback->id, 'url' => route('feedbacks.index')]
        );

        return redirect()->back()->with('success', 'Tanggapan berhasil dikirim.');
    }

    public function changeStatus(ChangeStatusFeedbackRequest $request, Feedback $feedback): RedirectResponse
    {
        abort_unless(auth()->user()->can('manage feedbacks'), 403);

        $validated = $request->validated();

        $feedback->changeStatus($validated['status']);

        return redirect()->back()->with('success', 'Status feedback diperbarui.');
    }

    private function notifyAdmins(Feedback $feedback): void
    {
        $admins = User::role(['admin', 'finance manager'])->get();

        foreach ($admins as $admin) {
            AppNotification::notify(
                $admin->id,
                'feedback_submitted',
                'Feedback Baru',
                $feedback->user->name.' mengirim '.$feedback->type_label.': '.$feedback->title,
                ['feedback_id' => $feedback->id, 'url' => route('feedbacks.index')]
            );
        }
    }

    private function computeStats(Builder $query): array
    {
        $result = $query->selectRaw("
            COUNT(*) as total,
            SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
            SUM(CASE WHEN type = 'bug' THEN 1 ELSE 0 END) as bugs,
            SUM(CASE WHEN type = 'feature' THEN 1 ELSE 0 END) as features,
            SUM(CASE WHEN type = 'feedback' THEN 1 ELSE 0 END) as feedbacks
        ")->first();

        return [
            'total' => (int) ($result->total ?? 0),
            'open' => (int) ($result->open ?? 0),
            'in_progress' => (int) ($result->in_progress ?? 0),
            'resolved' => (int) ($result->resolved ?? 0),
            'bugs' => (int) ($result->bugs ?? 0),
            'features' => (int) ($result->features ?? 0),
            'feedbacks' => (int) ($result->feedbacks ?? 0),
        ];
    }

    private function loadFeedback(int $id, $user, bool $canManage): ?array
    {
        $query = $canManage ? Feedback::query() : Feedback::forUser($user->id);
        $feedback = $query->with(['user', 'responder'])->find($id);

        return $feedback ? $this->mapFeedback($feedback, true) : null;
    }

    private function mapFeedback(Feedback $f, bool $includeFull = false): array
    {
        $base = [
            'id' => $f->id,
            'title' => $f->title,
            'description' => $includeFull ? $f->safe_description : str()->limit($f->description, 120),
            'type' => $f->type,
            'priority' => $f->priority,
            'status' => $f->status,
            'page_url' => $f->page_url,
            'attachment_url' => $f->attachment_url,
            'attachment_name' => $f->attachment_name,
            'created_at' => $f->created_at?->toIso8601String(),
            'user' => $f->user ? [
                'id' => $f->user->id,
                'name' => $f->user->name,
                'initials' => $f->user->initials(),
            ] : null,
            'can_edit' => $f->user_id === auth()->id() && $f->canEdit(),
            'can_delete' => $f->user_id === auth()->id() && $f->canDelete(),
            'can_respond' => $f->canRespond(),
        ];

        if ($includeFull) {
            $base['admin_response'] = $f->safe_admin_response;
            $base['responded_at'] = $f->responded_at?->toIso8601String();
            $base['responder'] = $f->responder ? [
                'id' => $f->responder->id,
                'name' => $f->responder->name,
            ] : null;
        }

        return $base;
    }
}
