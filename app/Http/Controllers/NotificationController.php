<?php

namespace App\Http\Controllers;

use App\Models\AppNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->input('per_page', 20);
        $page = (int) $request->input('page', 1);

        $userId = auth()->id();

        $query = AppNotification::forUser($userId)->forCurrentCompany()->orderByDesc('created_at');
        $total = (clone $query)->count();
        $items = $query->limit($perPage * $page)->get()->map(fn (AppNotification $n) => [
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

        return response()->json([
            'items' => $items,
            'total' => $total,
            'unread_count' => AppNotification::forUser($userId)->forCurrentCompany()->unread()->count(),
            'has_more' => $items->count() < $total,
        ]);
    }

    public function markAsRead(AppNotification $notification): RedirectResponse
    {
        abort_unless($notification->user_id === auth()->id(), 403);
        $notification->markAsRead();

        return redirect()->back();
    }

    public function markAllAsRead(): RedirectResponse
    {
        AppNotification::forUser(auth()->id())
            ->forCurrentCompany()
            ->unread()
            ->update(['read_at' => now()]);

        return redirect()->back();
    }
}
