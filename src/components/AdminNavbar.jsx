import {
    FaBell,
    FaUserCircle,
    FaBars,
    FaSun,
    FaMoon,
    FaCheckDouble,
    FaCircle,
} from "react-icons/fa";

import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

import { toggleTheme } from "../redux/slices/themeSlice";
import authService from "../appwrite/authService";
import notificationService from "../appwrite/notificationService";

const ADMIN_NAVBAR_STYLES = `
/* TECHSTORE ADMIN NAVBAR — PREMIUM LIGHT + DARK THEME */
/* DESIGN TOKENS */

:root {
    color-scheme: light;

    --admin-bg: #f4f7fc;
    --admin-surface: #ffffff;
    --admin-surface-soft: #f8fafc;
    --admin-surface-hover: #f1f5f9;

    --admin-text: #0f172a;
    --admin-text-soft: #475569;
    --admin-muted: #64748b;

    --admin-border: #e2e8f0;
    --admin-border-soft: #eef2f7;

    --admin-primary: #2563eb;
    --admin-primary-2: #4f46e5;
    --admin-primary-soft: #eef4ff;

    --admin-success: #16a34a;
    --admin-danger: #dc2626;

    --admin-shadow: 0 10px 28px rgba(15, 23, 42, 0.07);
    --admin-shadow-lg: 0 18px 45px rgba(15, 23, 42, 0.12);

    --admin-radius: 14px;
    --admin-transition: 0.28s ease;
}

:is(
    body.dark,
    body.dark-mode,
    html.dark,
    html.dark-mode,
    html[data-theme="dark"]
) {
    color-scheme: dark;

    --admin-bg: #070b16;
    --admin-surface: #0f1727;
    --admin-surface-soft: #0b1220;
    --admin-surface-hover: #151f31;

    --admin-text: #f8fafc;
    --admin-text-soft: #cbd5e1;
    --admin-muted: #94a3b8;

    --admin-border: rgba(255, 255, 255, 0.09);
    --admin-border-soft: rgba(255, 255, 255, 0.06);

    --admin-primary: #3b82f6;
    --admin-primary-2: #6366f1;
    --admin-primary-soft: rgba(59, 130, 246, 0.14);

    --admin-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
    --admin-shadow-lg: 0 20px 55px rgba(0, 0, 0, 0.55);
}

/* GLOBAL ADMIN SHELL */

html,
body {
    min-height: 100%;
}

html {
    background: var(--admin-bg);
    transition: background-color var(--admin-transition),
                color var(--admin-transition);
}

body {
    margin: 0;
    background: var(--admin-bg);
    color: var(--admin-text);
    font-family: "Poppins", Arial, Helvetica, sans-serif;
    transition: background-color var(--admin-transition),
                color var(--admin-transition);
}

body.light,
html.light,
html[data-theme="light"] {
    color-scheme: light;
}

/* ADMIN LAYOUT */

.admin-layout {
    display: flex;
    min-height: 100vh;
    background: var(--admin-bg);
    color: var(--admin-text);
    transition: background-color var(--admin-transition),
                color var(--admin-transition);
}

.admin-main {
    margin-left: 260px;
    width: calc(100% - 260px);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--admin-bg);
    transition: background-color var(--admin-transition),
                color var(--admin-transition);
}

/* SIDEBAR */

.admin-sidebar {
    position: fixed;
    top: 0;
    left: 0;

    width: 260px;
    height: 100vh;

    display: flex;
    flex-direction: column;

    background: var(--admin-surface);
    color: var(--admin-text);

    border-right: 1px solid var(--admin-border);
    box-shadow: var(--admin-shadow);

    z-index: 1200;

    transition:
        background-color var(--admin-transition),
        color var(--admin-transition),
        border-color var(--admin-transition),
        left 0.35s ease,
        box-shadow var(--admin-transition);
}

.sidebar-logo {
    padding: 25px 20px;
    text-align: center;
    border-bottom: 1px solid var(--admin-border-soft);
}

.sidebar-logo h2 {
    margin: 0 0 6px;
    color: var(--admin-text);
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.5px;
}

.sidebar-logo span {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 50px;
    background: var(--admin-surface-soft);
    color: var(--admin-muted);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
}

.sidebar-nav {
    flex: 1;
    padding: 20px 14px;
    overflow-y: auto;
}

.sidebar-nav a {
    display: flex;
    align-items: center;
    gap: 14px;

    padding: 13px 16px;
    margin-bottom: 6px;

    border-radius: 12px;
    text-decoration: none;

    color: var(--admin-text-soft);
    font-size: 14.5px;
    font-weight: 600;

    transition:
        background-color var(--admin-transition),
        color var(--admin-transition),
        transform var(--admin-transition),
        box-shadow var(--admin-transition);
}

.sidebar-nav a svg {
    min-width: 20px;
    font-size: 18px;
    color: var(--admin-muted);
    transition: color var(--admin-transition);
}

.sidebar-nav a:hover {
    background: var(--admin-surface-hover);
    color: var(--admin-primary);
    transform: translateX(4px);
}

.sidebar-nav a:hover svg {
    color: var(--admin-primary);
}

.sidebar-nav a.active {
    background: linear-gradient(135deg, #2563eb, #4f46e5);
    color: #ffffff;
    box-shadow: 0 8px 22px rgba(37, 99, 235, 0.28);
    transform: translateX(2px);
}

.sidebar-nav a.active svg {
    color: #ffffff;
}

.logout-btn {
    padding: 20px;
    border-top: 1px solid var(--admin-border-soft);
}

.logout-btn button {
    width: 100%;
    border-radius: 12px;
    font-weight: 600;
}

.sidebar-close-btn {
    position: absolute;
    right: 15px;
    top: 15px;

    width: 40px;
    height: 40px;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    border: 0;
    border-radius: 10px;

    background: transparent;
    color: var(--admin-text);

    font-size: 20px;
    cursor: pointer;

    transition:
        background-color var(--admin-transition),
        color var(--admin-transition),
        transform var(--admin-transition);
}

.sidebar-close-btn:hover {
    background: var(--admin-surface-hover);
    transform: scale(1.05);
}

/* NAVBAR */

.admin-navbar {
    position: sticky;
    top: 0;
    z-index: 1050;

    min-height: 75px;
    width: 100%;

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 0 30px;

    background: rgba(255, 255, 255, 0.94);
    color: var(--admin-text);

    border-bottom: 1px solid var(--admin-border);
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);

    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);

    transition:
        background-color var(--admin-transition),
        color var(--admin-transition),
        border-color var(--admin-transition),
        box-shadow var(--admin-transition);
}

:is(
    body.dark .admin-navbar,
    body.dark-mode .admin-navbar,
    html.dark .admin-navbar,
    html.dark-mode .admin-navbar,
    html[data-theme="dark"] .admin-navbar
) {
    background: rgba(8, 14, 26, 0.88) !important;
    border-bottom-color: rgba(255, 255, 255, 0.08);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.38);
}

.admin-navbar-left {
    display: flex;
    align-items: center;
    gap: 18px;
    min-width: 0;
}

.admin-navbar-left > div:last-child {
    min-width: 0;
}

.admin-navbar h3 {
    margin: 0;
    color: var(--admin-text);
    font-size: 24px;
    font-weight: 750;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.admin-navbar small {
    display: block;
    margin-top: 4px;
    color: var(--admin-muted);
    font-size: 12px;
}

.menu-toggle {
    width: 42px;
    height: 42px;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    border: 0;
    border-radius: 11px;

    background: linear-gradient(135deg, #2563eb, #4f46e5);
    color: #ffffff;

    font-size: 18px;
    cursor: pointer;

    box-shadow: 0 7px 18px rgba(37, 99, 235, 0.26);

    transition:
        transform var(--admin-transition),
        box-shadow var(--admin-transition);
}

.menu-toggle:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 12px 25px rgba(37, 99, 235, 0.34);
}

.admin-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
}

.admin-icon-btn {
    position: relative;

    width: 44px;
    height: 44px;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    padding: 0;

    border: 1px solid var(--admin-border);
    border-radius: 50%;

    background: var(--admin-surface-soft);
    color: var(--admin-text-soft);

    cursor: pointer;

    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);

    transition:
        transform var(--admin-transition),
        background-color var(--admin-transition),
        border-color var(--admin-transition),
        color var(--admin-transition),
        box-shadow var(--admin-transition);
}

.admin-icon-btn:hover {
    transform: translateY(-2px);
    background: var(--admin-primary-soft);
    color: var(--admin-primary);
    border-color: rgba(37, 99, 235, 0.28);
    box-shadow: 0 9px 20px rgba(37, 99, 235, 0.14);
}

:is(
    body.dark .admin-icon-btn,
    body.dark-mode .admin-icon-btn,
    html.dark .admin-icon-btn,
    html.dark-mode .admin-icon-btn,
    html[data-theme="dark"] .admin-icon-btn
) {
    background: rgba(255, 255, 255, 0.055);
    border-color: rgba(255, 255, 255, 0.10);
    color: #cbd5e1;
    box-shadow: 0 7px 20px rgba(0, 0, 0, 0.24);
}

:is(
    body.dark .admin-icon-btn:hover,
    body.dark-mode .admin-icon-btn:hover,
    html.dark .admin-icon-btn:hover,
    html.dark-mode .admin-icon-btn:hover,
    html[data-theme="dark"] .admin-icon-btn:hover
) {
    background: rgba(59, 130, 246, 0.14);
    border-color: rgba(96, 165, 250, 0.34);
    color: #93c5fd;
}

.admin-theme-toggle {
    width: 44px;
    height: 44px;
}

:is(
    body.dark .admin-theme-toggle,
    body.dark-mode .admin-theme-toggle,
    html.dark .admin-theme-toggle,
    html.dark-mode .admin-theme-toggle,
    html[data-theme="dark"] .admin-theme-toggle
) {
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.08);
    border-color: rgba(251, 191, 36, 0.18);
}

:is(
    body.dark .admin-theme-toggle:hover,
    body.dark-mode .admin-theme-toggle:hover,
    html.dark .admin-theme-toggle:hover,
    html.dark-mode .admin-theme-toggle:hover,
    html[data-theme="dark"] .admin-theme-toggle:hover
) {
    background: rgba(251, 191, 36, 0.14);
    color: #fcd34d;
    border-color: rgba(251, 191, 36, 0.32);
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.18);
    transform: translateY(-2px) rotate(8deg);
}

.admin-icon {
    font-size: 19px;
}

/* NOTIFICATION BADGE */

.notification-dot {
    position: absolute;
    top: 8px;
    right: 9px;

    width: 8px;
    height: 8px;

    border: 2px solid var(--admin-surface);
    border-radius: 50%;

    background: #ef4444;
}

/* Inline badge used by current JSX */
.admin-right button span {
    box-sizing: border-box;
}

/* NOTIFICATION DROPDOWN */

.admin-right [style*="position: relative"] > div[style*="position: absolute"] {
    animation: adminNotificationIn 0.2s ease;
    transform-origin: top right;
}

@keyframes adminNotificationIn {
    from {
        opacity: 0;
        transform: translateY(-5px) scale(0.98);
    }

    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

:is(
    body.dark .admin-right [style*="position: relative"] > div[style*="position: absolute"],
    body.dark-mode .admin-right [style*="position: relative"] > div[style*="position: absolute"],
    html.dark .admin-right [style*="position: relative"] > div[style*="position: absolute"],
    html.dark-mode .admin-right [style*="position: relative"] > div[style*="position: absolute"],
    html[data-theme="dark"] .admin-right [style*="position: relative"] > div[style*="position: absolute"]
) {
    background: #0f1727 !important;
    border: 1px solid rgba(255, 255, 255, 0.09) !important;
    box-shadow: 0 24px 65px rgba(0, 0, 0, 0.52) !important;
}

/* ADMIN PROFILE */

.admin-profile {
    min-height: 46px;

    display: flex;
    align-items: center;
    gap: 10px;

    padding: 5px 8px;
    border-radius: 14px;

    color: var(--admin-text);

    transition:
        background-color var(--admin-transition),
        border-color var(--admin-transition);
}

.admin-profile:hover {
    background: var(--admin-surface-hover);
}

:is(
    body.dark .admin-profile,
    body.dark-mode .admin-profile,
    html.dark .admin-profile,
    html.dark-mode .admin-profile,
    html[data-theme="dark"] .admin-profile
) {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
}

.profile-icon {
    flex-shrink: 0;
    font-size: 38px;
    color: var(--admin-primary);
}

.admin-profile h6 {
    margin: 0;
    color: var(--admin-text);
    font-size: 14px;
    font-weight: 750;
}

.admin-profile small {
    display: block;
    margin-top: 2px;
    color: var(--admin-muted);
    font-size: 11px;
}

/* PAGE */

.admin-page {
    flex: 1;
    min-width: 0;
    padding: 30px;
    overflow-x: auto;
    background: var(--admin-bg);
    color: var(--admin-text);

    transition:
        background-color var(--admin-transition),
        color var(--admin-transition);
}

:is(
    body.dark .admin-page,
    body.dark-mode .admin-page,
    html.dark .admin-page,
    html.dark-mode .admin-page,
    html[data-theme="dark"] .admin-page
) {
    background:
        radial-gradient(
            circle at top right,
            rgba(59, 130, 246, 0.09),
            transparent 30%
        ),
        #070b16 !important;
}

/* BOOTSTRAP LIGHT/DARK HELPERS */

.users-page,
.settings-page,
.dashboard-page {
    color-scheme: inherit;
}

:is(
    body.dark .admin-page,
    body.dark-mode .admin-page,
    html.dark .admin-page,
    html.dark-mode .admin-page,
    html[data-theme="dark"] .admin-page
) .text-muted {
    color: #94a3b8 !important;
}

:is(
    body.dark .admin-page,
    body.dark-mode .admin-page,
    html.dark .admin-page,
    html.dark-mode .admin-page,
    html[data-theme="dark"] .admin-page
) .bg-white {
    background: #0f1727 !important;
    color: #f8fafc !important;
}

/* OVERLAY */

.sidebar-overlay {
    position: fixed;
    inset: 0;

    background: rgba(2, 6, 23, 0.44);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);

    z-index: 1100;
}

/* SCROLLBARS */

.sidebar-nav::-webkit-scrollbar,
.admin-page::-webkit-scrollbar {
    width: 7px;
    height: 7px;
}

.sidebar-nav::-webkit-scrollbar-track,
.admin-page::-webkit-scrollbar-track {
    background: transparent;
}

.sidebar-nav::-webkit-scrollbar-thumb,
.admin-page::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 50px;
}

.sidebar-nav::-webkit-scrollbar-thumb:hover,
.admin-page::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}

:is(
    body.dark,
    body.dark-mode,
    html.dark,
    html.dark-mode,
    html[data-theme="dark"]
) .sidebar-nav::-webkit-scrollbar-thumb,
:is(
    body.dark,
    body.dark-mode,
    html.dark,
    html.dark-mode,
    html[data-theme="dark"]
) .admin-page::-webkit-scrollbar-thumb {
    background: #334155;
}

:is(
    body.dark,
    body.dark-mode,
    html.dark,
    html.dark-mode,
    html[data-theme="dark"]
) .sidebar-nav::-webkit-scrollbar-thumb:hover,
:is(
    body.dark,
    body.dark-mode,
    html.dark,
    html.dark-mode,
    html[data-theme="dark"]
) .admin-page::-webkit-scrollbar-thumb:hover {
    background: #475569;
}

/* FOCUS */

.admin-navbar button:focus-visible,
.sidebar-nav a:focus-visible,
.sidebar-close-btn:focus-visible {
    outline: 2px solid #60a5fa;
    outline-offset: 3px;
}

/* RESPONSIVE */

@media (min-width: 1400px) {
    .admin-navbar {
        padding: 0 34px;
    }

    .admin-page {
        padding: 34px;
    }
}

@media (max-width: 1199px) {
    .admin-navbar {
        padding: 0 22px;
    }

    .admin-page {
        padding: 24px;
    }
}

@media (max-width: 991px) {
    .admin-sidebar {
        left: -260px;
        box-shadow: 12px 0 35px rgba(15, 23, 42, 0.16);
    }

    .admin-sidebar.show {
        left: 0;
    }

    .admin-main {
        margin-left: 0;
        width: 100%;
    }

    .sidebar-close-btn {
        display: inline-flex;
    }

    .admin-navbar {
        min-height: 72px;
    }
}

@media (min-width: 992px) {
    .sidebar-close-btn {
        display: none;
    }
}

@media (max-width: 768px) {
    .admin-navbar {
        min-height: 65px;
        padding: 10px 15px;
    }

    .admin-navbar-left {
        gap: 10px;
    }

    .admin-navbar h3 {
        max-width: 52vw;
        font-size: 20px;
    }

    .admin-navbar small {
        font-size: 10px;
    }

    .admin-right {
        gap: 7px;
    }

    .admin-icon-btn,
    .admin-theme-toggle {
        width: 40px;
        height: 40px;
    }

    .admin-icon {
        font-size: 17px;
    }

    .admin-profile {
        padding: 3px;
    }

    .profile-icon {
        font-size: 34px;
    }

    .admin-profile > div {
        display: none;
    }

    .admin-page {
        padding: 15px;
    }

    .admin-right [style*="position: relative"] > div[style*="position: absolute"] {
        right: -4px !important;
    }
}

@media (max-width: 576px) {
    .admin-navbar {
        min-height: 62px;
        padding: 9px 11px;
    }

    .admin-navbar h3 {
        max-width: 48vw;
        font-size: 18px;
    }

    .admin-navbar small {
        display: none;
    }

    .admin-right {
        gap: 5px;
    }

    .admin-icon-btn,
    .admin-theme-toggle {
        width: 37px;
        height: 37px;
    }

    .admin-icon {
        font-size: 16px;
    }

    .profile-icon {
        font-size: 31px;
    }

    .menu-toggle {
        width: 38px;
        height: 38px;
    }

    .admin-page {
        padding: 12px;
    }

    .admin-right [style*="position: relative"] > div[style*="position: absolute"] {
        width: min(370px, calc(100vw - 24px)) !important;
        max-width: calc(100vw - 24px) !important;
        right: -7px !important;
    }
}

@media (max-width: 380px) {
    .admin-navbar h3 {
        max-width: 43vw;
        font-size: 16px;
    }

    .admin-icon-btn,
    .admin-theme-toggle {
        width: 34px;
        height: 34px;
    }

    .profile-icon {
        font-size: 28px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .admin-layout,
    .admin-main,
    .admin-sidebar,
    .admin-navbar,
    .admin-page,
    .admin-icon-btn,
    .menu-toggle,
    .sidebar-nav a,
    .sidebar-close-btn {
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
    }
}
`;

function AdminNavbar({
    sidebarOpen,
    setSidebarOpen,
}) {
    const dispatch = useDispatch();
    const location = useLocation();

    const theme = useSelector(
        (state) => state.theme.mode
    );

    // =====================================================
    // GLOBAL THEME SYNC
    // Keeps Navbar, Sidebar, Pages and Settings in the same
    // light/dark theme without forcing a light flash.
    // =====================================================

    useEffect(() => {

        const isDark = theme === "dark";

        const body =
            document.body;

        const html =
            document.documentElement;

        body.classList.toggle(
            "dark",
            isDark
        );

        body.classList.toggle(
            "dark-mode",
            isDark
        );

        body.classList.toggle(
            "light",
            !isDark
        );

        html.classList.toggle(
            "dark",
            isDark
        );

        html.classList.toggle(
            "dark-mode",
            isDark
        );

        html.classList.toggle(
            "light",
            !isDark
        );

        html.setAttribute(
            "data-theme",
            isDark
                ? "dark"
                : "light"
        );

        html.style.colorScheme =
            isDark
                ? "dark"
                : "light";

    }, [theme]);

  // NOTIFICATION STATES

    const [notifications, setNotifications] =
        useState([]);

    const [unreadCount, setUnreadCount] =
        useState(0);

    const [notificationOpen, setNotificationOpen] =
        useState(false);

    const [notificationLoading, setNotificationLoading] =
        useState(false);

    const notificationRef = useRef(null);

  // PAGE TITLE

    const getPageTitle = (path) => {
        if (path.includes("analytics"))
            return "Analytics & Reports";

        if (path.includes("orders"))
            return "Orders Management";

        if (
            path.includes("product-list") ||
            path.includes("products")
        )
            return "Products Catalog";

        if (path.includes("add-product"))
            return "Add New Product";

        if (path.includes("edit-product"))
            return "Edit Product";

        if (path.includes("categories"))
            return "Categories";

        if (path.includes("coupons"))
            return "Discount Coupons";

        if (path.includes("inventory"))
            return "Stock & Inventory";

        if (path.includes("reviews"))
            return "Customer Reviews";

        if (path.includes("settings"))
            return "Store Settings";

        if (path.includes("users"))
            return "User Management";

        if (path.includes("profile"))
            return "Admin Profile";

        return "Dashboard Overview";
    };

  // LOAD ADMIN NOTIFICATIONS

    const loadNotifications = async () => {
        try {
            setNotificationLoading(true);

            const currentUser =
                await authService.getCurrentUser();

            if (!currentUser?.$id) {
                console.log(
                    "Admin notification: User not found."
                );

                return;
            }

  // GET ALL NOTIFICATIONS

            const response =
                await notificationService.getUserNotifications(
                    currentUser.$id
                );

            const documents =
                response?.documents || [];

            setNotifications(documents);

  // GET UNREAD NOTIFICATIONS

            const unreadResponse =
                await notificationService.getUnreadNotifications(
                    currentUser.$id
                );

            const unreadDocuments =
                unreadResponse?.documents || [];

            setUnreadCount(
                unreadDocuments.length
            );

        } catch (error) {
            console.error(
                "Admin notification loading error:",
                error
            );
        } finally {
            setNotificationLoading(false);
        }
    };

  // INITIAL LOAD

    useEffect(() => {
        loadNotifications();

        // Refresh notifications every 15 seconds
        const interval = setInterval(() => {
            loadNotifications();
        }, 15000);

        return () => {
            clearInterval(interval);
        };
    }, []);

  // CLOSE DROPDOWN WHEN CLICK OUTSIDE

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                notificationRef.current &&
                !notificationRef.current.contains(
                    event.target
                )
            ) {
                setNotificationOpen(false);
            }
        };

        document.addEventListener(
            "mousedown",
            handleClickOutside
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );
        };
    }, []);

  // OPEN NOTIFICATION

    const handleNotificationClick = async (
        notification
    ) => {
        try {
            if (!notification?.$id) {
                return;
            }

            // Already read
            if (notification.isRead === true) {
                return;
            }

            await notificationService.markAsRead(
                notification.$id
            );

            // Update local state
            setNotifications((previous) =>
                previous.map((item) =>
                    item.$id === notification.$id
                        ? {
                              ...item,
                              isRead: true,
                          }
                        : item
                )
            );

            setUnreadCount((previous) =>
                Math.max(0, previous - 1)
            );

        } catch (error) {
            console.error(
                "Mark notification as read error:",
                error
            );
        }
    };

  // MARK ALL AS READ

    const handleMarkAllAsRead = async () => {
        try {
            const currentUser =
                await authService.getCurrentUser();

            if (!currentUser?.$id) {
                return;
            }

            if (unreadCount === 0) {
                return;
            }

            await notificationService.markAllAsRead(
                currentUser.$id
            );

            setNotifications((previous) =>
                previous.map((item) => ({
                    ...item,
                    isRead: true,
                }))
            );

            setUnreadCount(0);

        } catch (error) {
            console.error(
                "Mark all notifications error:",
                error
            );
        }
    };

  // FORMAT DATE

    const formatNotificationDate = (
        date
    ) => {
        if (!date) {
            return "";
        }

        try {
            return new Date(date).toLocaleString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                }
            );
        } catch {
            return "";
        }
    };

  // RENDER

    return (
        <>
            <style>{ADMIN_NAVBAR_STYLES}</style>

            <header className="admin-navbar">

            {/* LEFT */}

            <div className="admin-navbar-left">

                <button
                    className="menu-toggle d-lg-none"
                    onClick={() =>
                        setSidebarOpen(
                            !sidebarOpen
                        )
                    }
                >
                    <FaBars />
                </button>

                <div>
                    <h3>
                        {getPageTitle(
                            location.pathname
                        )}
                    </h3>

                    <small>
                        Welcome Back Admin 👋
                    </small>
                </div>

            </div>

            {/* RIGHT */}

            <div className="admin-right">

                {/* THEME SWITCHER */}

                <button
                    className="admin-icon-btn admin-theme-toggle"
                    onClick={() =>
                        dispatch(
                            toggleTheme()
                        )
                    }
                    title={`Switch to ${
                        theme === "light"
                            ? "Dark"
                            : "Light"
                    } Mode`}
                    aria-label="Toggle Theme"
                >
                    {theme === "light" ? (
                        <FaMoon className="admin-icon" />
                    ) : (
                        <FaSun className="admin-icon text-warning" />
                    )}
                </button>

                {/* NOTIFICATION */}

                <div
                    ref={notificationRef}
                    style={{
                        position: "relative",
                    }}
                >

                    <button
                        className="admin-icon-btn"
                        onClick={() => {
                            setNotificationOpen(
                                (previous) =>
                                    !previous
                            );

                            if (
                                !notificationOpen
                            ) {
                                loadNotifications();
                            }
                        }}
                        title="Notifications"
                        aria-label="Notifications"
                        style={{
                            position: "relative",
                        }}
                    >

                        <FaBell className="admin-icon" />

                        {/* RED UNREAD BADGE */}

                        {unreadCount > 0 && (
                            <span
                                style={{
                                    position:
                                        "absolute",
                                    top: "4px",
                                    right: "4px",
                                    minWidth:
                                        "18px",
                                    height:
                                        "18px",
                                    padding:
                                        "0 4px",
                                    borderRadius:
                                        "50px",
                                    background:
                                        "#ff1f1f",
                                    color:
                                        "#fff",
                                    fontSize:
                                        "10px",
                                    fontWeight:
                                        "700",
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    justifyContent:
                                        "center",
                                    border:
                                        "2px solid #fff",
                                    lineHeight:
                                        "1",
                                }}
                            >
                                {unreadCount > 99
                                    ? "99+"
                                    : unreadCount}
                            </span>
                        )}

                    </button>

                    {/* NOTIFICATION DROPDOWN */}

                    {notificationOpen && (
                        <div
                            style={{
                                position:
                                    "absolute",
                                top:
                                    "calc(100% + 12px)",
                                right: "0",
                                width:
                                    "390px",
                                maxWidth:
                                    "calc(100vw - 30px)",
                                background:
                                    theme ===
                                    "dark"
                                        ? "#1e1e1e"
                                        : "#ffffff",
                                borderRadius:
                                    "16px",
                                boxShadow:
                                    "0 15px 45px rgba(0,0,0,0.18)",
                                border:
                                    theme ===
                                    "dark"
                                        ? "1px solid #333"
                                        : "1px solid #eee",
                                overflow:
                                    "hidden",
                                zIndex: 9999,
                            }}
                        >

                            {/* HEADER */}

                            <div
                                style={{
                                    padding:
                                        "16px 18px",
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    justifyContent:
                                        "space-between",
                                    borderBottom:
                                        theme ===
                                        "dark"
                                            ? "1px solid #333"
                                            : "1px solid #eee",
                                }}
                            >

                                <div>
                                    <h6
                                        style={{
                                            margin: 0,
                                            fontWeight:
                                                "700",
                                            color:
                                                theme ===
                                                "dark"
                                                    ? "#fff"
                                                    : "#111",
                                        }}
                                    >
                                        Notifications
                                    </h6>

                                    <small
                                        style={{
                                            color:
                                                "#888",
                                        }}
                                    >
                                        {unreadCount} unread
                                    </small>
                                </div>

                                {unreadCount >
                                    0 && (
                                    <button
                                        onClick={
                                            handleMarkAllAsRead
                                        }
                                        style={{
                                            border:
                                                "none",
                                            background:
                                                "transparent",
                                            color:
                                                "#0d6efd",
                                            fontSize:
                                                "12px",
                                            fontWeight:
                                                "600",
                                            cursor:
                                                "pointer",
                                        }}
                                    >
                                        <FaCheckDouble
                                            className="me-1"
                                        />
                                        Mark all read
                                    </button>
                                )}

                            </div>

                            {/* NOTIFICATION BODY */}

                            <div
                                style={{
                                    maxHeight:
                                        "420px",
                                    overflowY:
                                        "auto",
                                }}
                            >

                                {notificationLoading ? (
                                    <div
                                        style={{
                                            padding:
                                                "35px 20px",
                                            textAlign:
                                                "center",
                                            color:
                                                "#888",
                                        }}
                                    >
                                        <div
                                            className="spinner-border spinner-border-sm text-primary mb-2"
                                            role="status"
                                        />

                                        <div>
                                            Loading notifications...
                                        </div>
                                    </div>
                                ) : notifications.length ===
                                  0 ? (
                                    <div
                                        style={{
                                            padding:
                                                "45px 20px",
                                            textAlign:
                                                "center",
                                            color:
                                                "#888",
                                        }}
                                    >

                                        <FaBell
                                            style={{
                                                fontSize:
                                                    "30px",
                                                opacity:
                                                    "0.25",
                                                marginBottom:
                                                    "10px",
                                            }}
                                        />

                                        <div
                                            style={{
                                                fontWeight:
                                                    "600",
                                            }}
                                        >
                                            No notifications
                                        </div>

                                        <small>
                                            You're all caught up.
                                        </small>

                                    </div>
                                ) : (
                                    notifications.map(
                                        (
                                            notification
                                        ) => (
                                            <div
                                                key={
                                                    notification.$id
                                                }
                                                onClick={() =>
                                                    handleNotificationClick(
                                                        notification
                                                    )
                                                }
                                                style={{
                                                    padding:
                                                        "14px 16px",
                                                    display:
                                                        "flex",
                                                    gap:
                                                        "12px",
                                                    cursor:
                                                        "pointer",
                                                    background:
                                                        notification.isRead
                                                            ? "transparent"
                                                            : theme ===
                                                              "dark"
                                                            ? "#292929"
                                                            : "#f0f6ff",
                                                    borderBottom:
                                                        theme ===
                                                        "dark"
                                                            ? "1px solid #333"
                                                            : "1px solid #f0f0f0",
                                                    transition:
                                                        "0.2s",
                                                }}
                                            >

                                                {/* ICON */}

                                                <div
                                                    style={{
                                                        width:
                                                            "40px",
                                                        height:
                                                            "40px",
                                                        minWidth:
                                                            "40px",
                                                        borderRadius:
                                                            "12px",
                                                        background:
                                                            notification.isRead
                                                                ? theme === "dark"
                                                                    ? "#172235"
                                                                    : "#f1f1f1"
                                                                : theme === "dark"
                                                                    ? "rgba(59,130,246,0.16)"
                                                                    : "#e7f0ff",
                                                        display:
                                                            "flex",
                                                        alignItems:
                                                            "center",
                                                        justifyContent:
                                                            "center",
                                                        color:
                                                            theme === "dark"
                                                                ? "#93c5fd"
                                                                : "#0d6efd",
                                                    }}
                                                >
                                                    <FaBell />
                                                </div>

                                                {/* CONTENT */}

                                                <div
                                                    style={{
                                                        flex:
                                                            "1",
                                                        minWidth:
                                                            0,
                                                    }}
                                                >

                                                    <div
                                                        style={{
                                                            display:
                                                                "flex",
                                                            alignItems:
                                                                "center",
                                                            gap:
                                                                "6px",
                                                        }}
                                                    >

                                                        <strong
                                                            style={{
                                                                fontSize:
                                                                    "13px",
                                                                color:
                                                                    theme ===
                                                                    "dark"
                                                                        ? "#fff"
                                                                        : "#222",
                                                            }}
                                                        >
                                                            {
                                                                notification.title
                                                            }
                                                        </strong>

                                                        {!notification.isRead && (
                                                            <FaCircle
                                                                style={{
                                                                    fontSize:
                                                                        "6px",
                                                                    color:
                                                                        "#ff1f1f",
                                                                }}
                                                            />
                                                        )}

                                                    </div>

                                                    <div
                                                        style={{
                                                            fontSize:
                                                                "12px",
                                                            color:
                                                                theme ===
                                                                "dark"
                                                                    ? "#aaa"
                                                                    : "#666",
                                                            marginTop:
                                                                "4px",
                                                            lineHeight:
                                                                "1.45",
                                                        }}
                                                    >
                                                        {
                                                            notification.message
                                                        }
                                                    </div>

                                                    <small
                                                        style={{
                                                            display:
                                                                "block",
                                                            marginTop:
                                                                "5px",
                                                            color:
                                                                "#999",
                                                            fontSize:
                                                                "10px",
                                                        }}
                                                    >
                                                        {formatNotificationDate(
                                                            notification.createdAt ||
                                                                notification.$createdAt
                                                        )}
                                                    </small>

                                                </div>

                                            </div>
                                        )
                                    )
                                )}

                            </div>

                        </div>
                    )}

                </div>

                {/* ADMIN PROFILE */}

                <div className="admin-profile">

                    <FaUserCircle className="profile-icon" />

                    <div>
                        <h6>
                            Admin
                        </h6>

                        <small>
                            Administrator
                        </small>
                    </div>

                </div>

            </div>

            </header>
        </>
    );
}

export default AdminNavbar;