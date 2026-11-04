<?php

namespace App\Http\Controllers;

use App\Enums\NotificationStatus;
use App\Http\Requests\UnreadNotificationsRequest;
use App\Models\NotificationLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class NotificationLogController extends Controller
{
    public function index(): Response
    {
        $notifications = NotificationLog::where('user_id', Auth::id())
            ->where('status', NotificationStatus::Unread)
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return Inertia::render('notifications', [
            'notifications' => $notifications,
            'vapidPublicKey' => config('webpush.vapid.public_key'),
        ]);
    }

    public function markAsRead(NotificationLog $notificationLog): RedirectResponse
    {
        return $this->updateStatus($notificationLog, NotificationStatus::Read);
    }

    public function markAllAsRead(): RedirectResponse
    {
        $ids = NotificationLog::where('user_id', Auth::id())
            ->where('status', NotificationStatus::Unread)
            ->orderBy('id')
            ->pluck('id');

        NotificationLog::whereIn('id', $ids)->update(['status' => NotificationStatus::Read]);

        Inertia::flash('readIds', $ids->all());

        return back();
    }

    public function markAsUnread(NotificationLog $notificationLog): RedirectResponse
    {
        return $this->updateStatus($notificationLog, NotificationStatus::Unread);
    }

    public function markManyAsUnread(UnreadNotificationsRequest $request): RedirectResponse
    {
        NotificationLog::where('user_id', Auth::id())
            ->whereIn('id', $request->validated('ids'))
            ->update(['status' => NotificationStatus::Unread]);

        return back();
    }

    private function updateStatus(NotificationLog $notificationLog, NotificationStatus $status): RedirectResponse
    {
        abort_if($notificationLog->user_id !== Auth::id(), 403);

        $notificationLog->update(['status' => $status]);

        return back();
    }
}
