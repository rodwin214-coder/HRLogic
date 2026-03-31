import React, { useState, useEffect, useRef } from 'react';
import * as api from '../../services/supabaseApi';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    created_at: string;
    data: Record<string, any>;
}

interface NotificationBellProps {
    userId: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ userId }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadNotifications();
        const interval = setInterval(loadNotifications, 30000);
        return () => clearInterval(interval);
    }, [userId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadNotifications = async () => {
        const data = await api.getNotifications(userId);
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
    };

    const handleMarkAsRead = async (notificationId: string) => {
        await api.markNotificationAsRead(notificationId);
        loadNotifications();
    };

    const handleMarkAllAsRead = async () => {
        await api.markAllNotificationsAsRead(userId);
        loadNotifications();
    };

    const handleDelete = async (notificationId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        await api.deleteNotification(notificationId);
        loadNotifications();
    };

    const formatTime = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'clock_in':
                return '🟢';
            case 'clock_out':
                return '🔴';
            case 'request_pending':
                return '📝';
            case 'missed_clock_out':
                return '⚠️';
            default:
                return '🔔';
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
                aria-label="Notifications"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50">
                    <div className="flex items-center justify-between p-4 border-b">
                        <h3 className="font-semibold text-slate-800">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <p className="text-sm">No notifications</p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 border-b hover:bg-slate-50 cursor-pointer ${
                                        !notification.is_read ? 'bg-blue-50' : ''
                                    }`}
                                    onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3 flex-1">
                                            <span className="text-2xl">
                                                {getNotificationIcon(notification.type)}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-800 text-sm">
                                                    {notification.title}
                                                </p>
                                                <p className="text-slate-600 text-sm mt-1">
                                                    {notification.message}
                                                </p>
                                                <p className="text-slate-400 text-xs mt-1">
                                                    {formatTime(notification.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => handleDelete(notification.id, e)}
                                            className="ml-2 p-1 text-slate-400 hover:text-red-600 transition-colors"
                                            aria-label="Delete notification"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
