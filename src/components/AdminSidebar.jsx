import { NavLink, useNavigate } from "react-router-dom";
import {
    FaTimes,
    FaTags,
    FaTicketAlt,
    FaBoxes,
    FaChartLine,
    FaCog,
    FaUserCircle,
    FaTachometerAlt,
    FaBoxOpen,
    FaShoppingCart,
    FaUsers,
    FaStar,
    FaSignOutAlt,
    FaTruck,
} from "react-icons/fa";
import toast from "react-hot-toast";

/* ADMIN SIDEBAR PREMIUM STYLES — Light + Dark in the same JSX file */

const ADMIN_SIDEBAR_STYLES = `
/* ROOT */

:root {
    color-scheme: light;

    --sidebar-bg: #ffffff;
    --sidebar-surface: #f8fafc;
    --sidebar-surface-hover: #f1f5f9;
    --sidebar-text: #0f172a;
    --sidebar-text-soft: #475569;
    --sidebar-muted: #64748b;
    --sidebar-border: #e2e8f0;
    --sidebar-primary: #2563eb;
    --sidebar-primary-2: #4f46e5;
    --sidebar-danger: #dc2626;
    --sidebar-shadow: 2px 0 20px rgba(15, 23, 42, 0.06);
    --sidebar-transition: .28s ease;
}

:is(
    body.dark,
    body.dark-mode,
    html.dark,
    html.dark-mode,
    html[data-theme="dark"]
) {
    color-scheme: dark;

    --sidebar-bg: #0b1220;
    --sidebar-surface: #111a2e;
    --sidebar-surface-hover: #172238;
    --sidebar-text: #f8fafc;
    --sidebar-text-soft: #cbd5e1;
    --sidebar-muted: #94a3b8;
    --sidebar-border: rgba(255, 255, 255, 0.08);
    --sidebar-primary: #3b82f6;
    --sidebar-primary-2: #6366f1;
    --sidebar-shadow: 6px 0 28px rgba(0, 0, 0, 0.32);
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

    background: var(--sidebar-bg);
    color: var(--sidebar-text);

    border-right: 1px solid var(--sidebar-border);
    box-shadow: var(--sidebar-shadow);

    z-index: 1200;

    overflow: hidden;

    transition:
        left .35s cubic-bezier(.16, 1, .3, 1),
        background-color var(--sidebar-transition),
        border-color var(--sidebar-transition),
        box-shadow var(--sidebar-transition),
        color var(--sidebar-transition);
}

/* LOGO */

.sidebar-logo {
    position: relative;
    padding: 26px 20px 23px;

    text-align: center;

    border-bottom: 1px solid var(--sidebar-border);

    background:
        linear-gradient(
            180deg,
            var(--sidebar-bg),
            var(--sidebar-surface)
        );

    transition:
        background var(--sidebar-transition),
        border-color var(--sidebar-transition);
}

.sidebar-logo::before {
    content: "";
    position: absolute;
    left: 50%;
    bottom: -1px;

    width: 72px;
    height: 2px;

    transform: translateX(-50%);

    border-radius: 50px;

    background:
        linear-gradient(
            90deg,
            var(--sidebar-primary),
            var(--sidebar-primary-2)
        );
}

.sidebar-logo h2 {
    margin: 0 0 8px;

    color: var(--sidebar-text);

    font-size: 26px;
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: -0.6px;

    transition: color var(--sidebar-transition);
}

.sidebar-logo span {
    display: inline-flex;
    align-items: center;
    justify-content: center;

    min-height: 25px;
    padding: 3px 12px;

    border: 1px solid var(--sidebar-border);
    border-radius: 50px;

    background: var(--sidebar-surface);
    color: var(--sidebar-muted);

    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;

    transition:
        background var(--sidebar-transition),
        color var(--sidebar-transition),
        border-color var(--sidebar-transition);
}

/* NAVIGATION */

.sidebar-nav {
    flex: 1;

    padding: 18px 12px;

    overflow-y: auto;
    overflow-x: hidden;

    scrollbar-width: thin;
    scrollbar-color: #94a3b8 transparent;
}

.sidebar-nav::-webkit-scrollbar {
    width: 6px;
}

.sidebar-nav::-webkit-scrollbar-track {
    background: transparent;
}

.sidebar-nav::-webkit-scrollbar-thumb {
    border-radius: 50px;
    background: #cbd5e1;
}

.sidebar-nav::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}

:is(
    body.dark,
    body.dark-mode,
    html.dark,
    html.dark-mode,
    html[data-theme="dark"]
) .sidebar-nav {
    scrollbar-color: #334155 transparent;
}

:is(
    body.dark,
    body.dark-mode,
    html.dark,
    html.dark-mode,
    html[data-theme="dark"]
) .sidebar-nav::-webkit-scrollbar-thumb {
    background: #334155;
}

:is(
    body.dark,
    body.dark-mode,
    html.dark,
    html.dark-mode,
    html[data-theme="dark"]
) .sidebar-nav::-webkit-scrollbar-thumb:hover {
    background: #475569;
}

.sidebar-nav a {
    position: relative;

    display: flex;
    align-items: center;
    gap: 13px;

    min-height: 48px;
    margin-bottom: 5px;
    padding: 10px 13px;

    border: 1px solid transparent;
    border-radius: 13px;

    color: var(--sidebar-text-soft);
    text-decoration: none;

    font-size: 14px;
    font-weight: 600;

    transition:
        transform var(--sidebar-transition),
        background var(--sidebar-transition),
        color var(--sidebar-transition),
        border-color var(--sidebar-transition),
        box-shadow var(--sidebar-transition);
}

.sidebar-nav a::before {
    content: "";

    position: absolute;
    left: 0;
    top: 9px;
    bottom: 9px;

    width: 3px;

    border-radius: 0 5px 5px 0;

    background: transparent;

    transition: background var(--sidebar-transition);
}

.sidebar-nav a svg {
    min-width: 20px;

    color: var(--sidebar-muted);

    font-size: 17px;

    transition:
        color var(--sidebar-transition),
        transform var(--sidebar-transition);
}

.sidebar-nav a span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sidebar-nav a:hover {
    transform: translateX(3px);

    background: var(--sidebar-surface-hover);
    color: var(--sidebar-primary);

    border-color: var(--sidebar-border);
}

.sidebar-nav a:hover svg {
    color: var(--sidebar-primary);
    transform: scale(1.05);
}

.sidebar-nav a.active {
    transform: translateX(2px);

    background:
        linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.12),
            rgba(79, 70, 229, 0.10)
        );

    color: var(--sidebar-primary);

    border-color:
        rgba(37, 99, 235, 0.15);

    box-shadow:
        0 7px 18px rgba(37, 99, 235, 0.08);
}

.sidebar-nav a.active::before {
    background:
        linear-gradient(
            180deg,
            #2563eb,
            #4f46e5
        );
}

.sidebar-nav a.active svg {
    color: var(--sidebar-primary);
    transform: scale(1.04);
}

:is(
    body.dark,
    body.dark-mode,
    html.dark,
    html.dark-mode,
    html[data-theme="dark"]
) .sidebar-nav a.active {
    background:
        linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.18),
            rgba(79, 70, 229, 0.14)
        );

    border-color:
        rgba(96, 165, 250, 0.14);

    box-shadow:
        0 9px 24px rgba(0, 0, 0, 0.22),
        inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}

:is(
    body.dark,
    body.dark-mode,
    html.dark,
    html.dark-mode,
    html[data-theme="dark"]
) .sidebar-nav a:hover {
    background: rgba(255, 255, 255, 0.055);
    border-color: rgba(255, 255, 255, 0.07);
    color: #93c5fd;
}

:is(
    body.dark,
    body.dark-mode,
    html.dark,
    html.dark-mode,
    html[data-theme="dark"]
) .sidebar-nav a:hover svg {
    color: #93c5fd;
}

/* LOGOUT */

.logout-btn {
    padding: 15px 14px 18px;

    border-top: 1px solid var(--sidebar-border);

    background: var(--sidebar-bg);

    transition:
        background var(--sidebar-transition),
        border-color var(--sidebar-transition);
}

.logout-btn button {
    min-height: 44px;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    border: 0 !important;
    border-radius: 12px !important;

    background:
        linear-gradient(
            135deg,
            #dc2626,
            #ef4444
        ) !important;

    color: #ffffff !important;

    font-size: 13px;
    font-weight: 700;

    box-shadow:
        0 7px 18px rgba(220, 38, 38, 0.18);

    transition:
        transform .22s ease,
        box-shadow .22s ease,
        filter .22s ease;
}

.logout-btn button:hover {
    transform: translateY(-2px);

    filter: brightness(1.03);

    box-shadow:
        0 11px 25px rgba(220, 38, 38, 0.27);
}

.logout-btn button:active {
    transform: translateY(0);
}

:is(
    body.dark,
    body.dark-mode,
    html.dark,
    html.dark-mode,
    html[data-theme="dark"]
) .logout-btn {
    background: #0b1220;
    border-top-color: rgba(255, 255, 255, 0.08);
}

/* MOBILE CLOSE BUTTON */

.sidebar-close-btn {
    position: absolute;
    top: 15px;
    right: 15px;

    width: 38px;
    height: 38px;

    display: none;
    align-items: center;
    justify-content: center;

    border: 1px solid var(--sidebar-border) !important;
    border-radius: 11px !important;

    background: var(--sidebar-surface) !important;
    color: var(--sidebar-text-soft) !important;

    cursor: pointer;

    z-index: 5;

    transition:
        background var(--sidebar-transition),
        color var(--sidebar-transition),
        border-color var(--sidebar-transition),
        transform var(--sidebar-transition);
}

.sidebar-close-btn:hover {
    background: var(--sidebar-surface-hover) !important;
    color: var(--sidebar-primary) !important;
    transform: rotate(5deg);
}

/* MOBILE RESPONSIVE */

@media (max-width: 991px) {
    .admin-sidebar {
        left: -270px;
        box-shadow: 14px 0 35px rgba(15, 23, 42, 0.16);
    }

    .admin-sidebar.show {
        left: 0;
    }

    .sidebar-close-btn {
        display: inline-flex;
    }

    .sidebar-logo {
        padding-top: 28px;
    }

    :is(
        body.dark,
        body.dark-mode,
        html.dark,
        html.dark-mode,
        html[data-theme="dark"]
    ) .admin-sidebar {
        box-shadow: 14px 0 40px rgba(0, 0, 0, 0.55);
    }
}

@media (min-width: 992px) {
    .sidebar-close-btn {
        display: none !important;
    }
}

@media (max-width: 576px) {
    .admin-sidebar {
        width: 280px;
        left: -290px;
    }

    .admin-sidebar.show {
        left: 0;
    }

    .sidebar-logo {
        padding: 24px 18px 20px;
    }

    .sidebar-logo h2 {
        font-size: 23px;
    }

    .sidebar-nav {
        padding: 15px 11px;
    }

    .sidebar-nav a {
        min-height: 46px;
        padding: 9px 12px;
        font-size: 13.5px;
    }

    .logout-btn {
        padding: 13px 11px 15px;
    }

    .logout-btn button {
        min-height: 43px;
        font-size: 12.5px;
    }
}

@media (max-width: 380px) {
    .admin-sidebar {
        width: 270px;
        left: -280px;
    }

    .admin-sidebar.show {
        left: 0;
    }
}

/* FOCUS */

.sidebar-nav a:focus-visible,
.sidebar-close-btn:focus-visible,
.logout-btn button:focus-visible {
    outline: 2px solid #60a5fa !important;
    outline-offset: 2px;
}

/* REDUCED MOTION */

@media (prefers-reduced-motion: reduce) {
    .admin-sidebar,
    .sidebar-logo,
    .sidebar-nav a,
    .sidebar-nav a svg,
    .logout-btn,
    .logout-btn button,
    .sidebar-close-btn {
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
    }
}
`;

function AdminSidebar({ sidebarOpen, setSidebarOpen }) {
    const navigate = useNavigate();

    const handleLogout = () => {
        // Session poori tarah logout nahi karenge,
        // sirf home page par bhej denge
        toast.success("Exited Admin Panel");
        navigate("/");
    };

    const closeSidebar = () => {
        if (window.innerWidth < 992) {
            setSidebarOpen(false);
        }
    };

    return (
        <>
            <style>{ADMIN_SIDEBAR_STYLES}</style>

            <aside
                className={`admin-sidebar ${
                    sidebarOpen ? "show" : ""
                }`}
            >
                {/* Mobile Close Button */}
                <button
                    type="button"
                    className="sidebar-close-btn d-lg-none"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Close sidebar"
                >
                    <FaTimes />
                </button>

                {/* Logo */}
                <div className="sidebar-logo">
                    <h2>TechStore</h2>
                    <span>Admin Panel</span>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    <NavLink
                        to="/admin/dashboard"
                        onClick={closeSidebar}
                    >
                        <FaTachometerAlt />
                        <span>Dashboard</span>
                    </NavLink>

                    <NavLink
                        to="/admin/products"
                        onClick={closeSidebar}
                    >
                        <FaBoxOpen />
                        <span>Products</span>
                    </NavLink>

                    <NavLink
                        to="/admin/orders"
                        onClick={closeSidebar}
                    >
                        <FaShoppingCart />
                        <span>Orders</span>
                    </NavLink>

                    <NavLink
                        to="/admin/shipments"
                        onClick={closeSidebar}
                    >
                        <FaTruck />
                        <span>Shipments</span>
                    </NavLink>

                    <NavLink
                        to="/admin/users"
                        onClick={closeSidebar}
                    >
                        <FaUsers />
                        <span>Users</span>
                    </NavLink>

                    <NavLink
                        to="/admin/reviews"
                        onClick={closeSidebar}
                    >
                        <FaStar />
                        <span>Reviews</span>
                    </NavLink>

                    <NavLink
                        to="/admin/categories"
                        onClick={closeSidebar}
                    >
                        <FaTags />
                        <span>Categories</span>
                    </NavLink>

                    <NavLink
                        to="/admin/coupons"
                        onClick={closeSidebar}
                    >
                        <FaTicketAlt />
                        <span>Coupons</span>
                    </NavLink>

                    <NavLink
                        to="/admin/inventory"
                        onClick={closeSidebar}
                    >
                        <FaBoxes />
                        <span>Inventory</span>
                    </NavLink>

                    <NavLink
                        to="/admin/analytics"
                        onClick={closeSidebar}
                    >
                        <FaChartLine />
                        <span>Analytics</span>
                    </NavLink>

                    <NavLink
                        to="/admin/settings"
                        onClick={closeSidebar}
                    >
                        <FaCog />
                        <span>Settings</span>
                    </NavLink>

                    <NavLink
                        to="/admin/profile"
                        onClick={closeSidebar}
                    >
                        <FaUserCircle />
                        <span>Profile</span>
                    </NavLink>
                </nav>

                {/* Exit Admin Panel Button */}
                <div className="logout-btn">
                    <button
                        type="button"
                        className="btn btn-danger w-100"
                        onClick={handleLogout}
                    >
                        <FaSignOutAlt className="me-2" />
                        Exit to Website
                    </button>
                </div>
            </aside>
        </>
    );
}

export default AdminSidebar;
