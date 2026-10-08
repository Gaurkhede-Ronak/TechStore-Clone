import { useEffect, useRef, useState } from "react";

import authService from "../appwrite/authService";
import notificationService from "../appwrite/notificationService";
import deliveryOtpService from "../appwrite/deliveryOtpService";

import {
    Link,
    NavLink,
    useNavigate,
} from "react-router-dom";

import {
    FaBars,
    FaTimes,
    FaSearch,
    FaShoppingCart,
    FaHeart,
    FaMoon,
    FaSun,
    FaChevronDown,
    FaUser,
    FaShieldAlt,
    FaBell,
    FaCheck,
    FaCheckDouble,
    FaArrowRight,
    FaHome,
    FaBoxOpen,
    FaShoppingBag,
    FaInfoCircle,
    FaEnvelope,
} from "react-icons/fa";

import {
    useDispatch,
    useSelector,
} from "react-redux";

import toast from "react-hot-toast";

import { logout } from "../redux/slices/authSlice";
import { toggleTheme } from "../redux/slices/themeSlice";

import "../css/Navbar.css";


function Navbar() {

    const dispatch = useDispatch();
    const navigate = useNavigate();


  // STATES

    const [menuOpen, setMenuOpen] =
        useState(false);

    const [profileOpen, setProfileOpen] =
        useState(false);

    const [notificationOpen, setNotificationOpen] =
        useState(false);

    const [search, setSearch] =
        useState("");

    const [scrolled, setScrolled] =
        useState(false);

    const [notifications, setNotifications] =
        useState([]);

    const [loadingNotifications, setLoadingNotifications] =
        useState(false);


  // REFS

    const profileRef =
        useRef(null);

    const desktopNotificationRef =
        useRef(null);

    const mobileNotificationRef =
        useRef(null);


  // REDUX

    const theme =
        useSelector(
            (state) => state.theme.mode
        );

    const {
        isLoggedIn,
        user,
    } = useSelector(
        (state) => state.auth
    );


    const cartItems =
        useSelector(
            (state) => state.cart.items
        );


    const wishlistItems =
        useSelector(
            (state) => state.wishlist.items
        );


  // CART COUNT

    const totalCartItems =
        cartItems.reduce(
            (total, item) =>
                total + item.quantity,
            0
        );


  // USER INITIAL

    const getUserInitial = (
        nameStr
    ) => {

        if (!nameStr) {
            return "U";
        }

        return nameStr
            .trim()
            .charAt(0)
            .toUpperCase();
    };


    const userInitial =
        getUserInitial(
            user?.name
        );


  // UNREAD NOTIFICATION COUNT

    const unreadCount =
        notifications.filter(
            (notification) =>
                notification.isRead === false
        ).length;


  // LOAD USER NOTIFICATIONS

    const loadNotifications =
        async () => {

            if (
                !isLoggedIn ||
                !user
            ) {

                setNotifications([]);

                return;
            }


            try {

                setLoadingNotifications(
                    true
                );


                const userId =
                    String(
                        user?.$id ||
                        user?.id ||
                        ""
                    );


                if (!userId) {

                    setNotifications([]);

                    return;
                }

                try {
                    await deliveryOtpService.syncUserShipmentNotifications(
                        userId
                    );
                } catch (syncErr) {
                    console.warn("Navbar notification sync warning:", syncErr);
                }

                const response =
                    await notificationService
                        .getUserNotifications(
                            userId
                        );


                const documents =
                    response?.documents ||
                    [];


                // Latest notifications first

                const sortedNotifications =
                    [...documents].sort(
                        (a, b) => {

                            return (
                                new Date(
                                    b.createdAt ||
                                    b.$createdAt
                                ).getTime() -

                                new Date(
                                    a.createdAt ||
                                    a.$createdAt
                                ).getTime()
                            );
                        }
                    );


                setNotifications(
                    sortedNotifications
                );

            } catch (error) {

                console.error(
                    "Load notifications error:",
                    error
                );

            } finally {

                setLoadingNotifications(
                    false
                );
            }
        };


  // LOAD WHEN LOGIN CHANGES

    useEffect(() => {

        if (
            isLoggedIn &&
            user
        ) {

            loadNotifications();

        } else {

            setNotifications([]);

        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isLoggedIn,
        user,
    ]);


  // AUTO REFRESH

    useEffect(() => {

        if (
            !isLoggedIn ||
            !user
        ) {

            return;
        }


        const interval =
            setInterval(
                () => {

                    loadNotifications();

                },
                30000
            );


        return () =>
            clearInterval(
                interval
            );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isLoggedIn,
        user,
    ]);


  // SEARCH

    const handleSearch =
        (e) => {

            e.preventDefault();


            if (
                !search.trim()
            ) {

                return;
            }


            navigate(
                `/products?search=${encodeURIComponent(
                    search.trim()
                )}`
            );


            setMenuOpen(false);

            setSearch("");
        };


  // LOGOUT

    const handleLogout =
        async () => {

            try {

                await authService.logout();


                dispatch(
                    logout()
                );


                setNotifications([]);

                setNotificationOpen(
                    false
                );

                setProfileOpen(
                    false
                );


                toast.success(
                    "Logged Out Successfully"
                );


                navigate(
                    "/login"
                );


                setMenuOpen(
                    false
                );

            } catch (error) {

                toast.error(
                    error.message ||
                    "Logout Failed"
                );
            }
        };


  // CLOSE MOBILE MENU

    const closeMenu = () => {

        setMenuOpen(false);

        setNotificationOpen(false);
    };


  // FORMAT NOTIFICATION TIME

    const formatNotificationTime =
        (createdAt) => {

            if (!createdAt) {
                return "";
            }


            const createdDate =
                new Date(
                    createdAt
                );


            if (
                Number.isNaN(
                    createdDate.getTime()
                )
            ) {

                return "";
            }


            const now =
                new Date();


            const difference =
                now.getTime() -
                createdDate.getTime();


            const seconds =
                Math.floor(
                    difference /
                    1000
                );


            const minutes =
                Math.floor(
                    seconds / 60
                );


            const hours =
                Math.floor(
                    minutes / 60
                );


            const days =
                Math.floor(
                    hours / 24
                );


            if (
                seconds < 60
            ) {

                return "Just now";
            }


            if (
                minutes < 60
            ) {

                return `${minutes} min ago`;
            }


            if (
                hours < 24
            ) {

                return `${hours} hour${
                    hours > 1
                        ? "s"
                        : ""
                } ago`;
            }


            if (
                days < 7
            ) {

                return `${days} day${
                    days > 1
                        ? "s"
                        : ""
                } ago`;
            }


            return createdDate.toLocaleDateString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                }
            );
        };


  // NOTIFICATION ICON

    const getNotificationIcon =
        (notification) => {

            const type =
                String(
                    notification?.type ||
                    ""
                ).toUpperCase();


            if (
                type ===
                "DELIVERY_OTP"
            ) {

                return "🔐";
            }


            if (
                type.includes(
                    "DELIVER"
                )
            ) {

                return "✅";
            }


            if (
                type.includes(
                    "DISPATCH"
                )
            ) {

                return "🚚";
            }


            if (
                type.includes(
                    "PACK"
                )
            ) {

                return "📦";
            }


            if (
                type.includes(
                    "ORDER"
                )
            ) {

                return "🛒";
            }


            if (
                type.includes(
                    "CANCEL"
                )
            ) {

                return "❌";
            }


            if (
                type.includes(
                    "OFFER"
                )
            ) {

                return "🎁";
            }


            return "🔔";
        };


  // NOTIFICATION CLICK

    const handleNotificationClick =
        async (
            notification
        ) => {

            try {

                if (
                    !notification?.$id
                ) {

                    return;
                }


                if (
                    notification.isRead ===
                    false
                ) {

                    await notificationService
                        .markAsRead(
                            notification.$id
                        );


                    setNotifications(
                        (prev) =>
                            prev.map(
                                (item) =>
                                    item.$id ===
                                    notification.$id
                                        ? {
                                            ...item,
                                            isRead: true,
                                        }
                                        : item
                            )
                    );
                }


                // Order notification

                if (
                    notification.orderId
                ) {

                    setNotificationOpen(
                        false
                    );

                    setMenuOpen(
                        false
                    );


                    navigate(
                        `/order-details?orderId=${encodeURIComponent(
                            notification.orderId
                        )}`
                    );

                    return;
                }


                // Normal notification

                setNotificationOpen(
                    false
                );

            } catch (error) {

                console.error(
                    "Mark notification read error:",
                    error
                );
            }
        };


  // MARK ALL AS READ

    const handleMarkAllAsRead =
        async () => {

            try {

                const userId =
                    String(
                        user?.$id ||
                        user?.id ||
                        ""
                    );


                if (
                    !userId ||
                    unreadCount === 0
                ) {

                    return;
                }


                await notificationService
                    .markAllAsRead(
                        userId
                    );


                setNotifications(
                    (prev) =>
                        prev.map(
                            (item) => ({
                                ...item,
                                isRead: true,
                            })
                        )
                );


                toast.success(
                    "All notifications marked as read"
                );

            } catch (error) {

                console.error(
                    "Mark all notifications error:",
                    error
                );


                toast.error(
                    "Failed to mark notifications as read"
                );
            }
        };


  // CLICK OUTSIDE

    useEffect(() => {

        const handleClickOutside =
            (event) => {

                // Profile

                if (
                    profileRef.current &&
                    !profileRef.current.contains(
                        event.target
                    )
                ) {

                    setProfileOpen(
                        false
                    );
                }


                // Notification
                const clickedDesktop =
                    desktopNotificationRef.current &&
                    desktopNotificationRef.current.contains(
                        event.target
                    );
                const clickedMobile =
                    mobileNotificationRef.current &&
                    mobileNotificationRef.current.contains(
                        event.target
                    );

                if (!clickedDesktop && !clickedMobile) {
                    setNotificationOpen(
                        false
                    );
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


  // SCROLL

    useEffect(() => {

        const handleScroll =
            () => {

                setScrolled(
                    window.scrollY > 30
                );
            };


        window.addEventListener(
            "scroll",
            handleScroll
        );


        return () =>
            window.removeEventListener(
                "scroll",
                handleScroll
            );

    }, []);


  // RENDER

    return (

        <header className="navbar-wrapper">

            <nav
                className={`custom-navbar ${
                    scrolled
                        ? "navbar-scrolled"
                        : ""
                }`}
            >

                <div className="container">


                    {/* MOBILE NAVBAR */}

                    <div className="mobile-navbar-wrapper">

                        <div className="mobile-navbar">


                            {/* MOBILE MENU BUTTON */}

                            <button
                                className="mobile-menu-btn"
                                onClick={() =>
                                    setMenuOpen(
                                        !menuOpen
                                    )
                                }
                                aria-label="Toggle Navigation"
                            >

                                {menuOpen ? (
                                    <FaTimes />
                                ) : (
                                    <FaBars />
                                )}

                            </button>


                            {/* MOBILE LOGO */}

                            <Link
                                to="/"
                                className="mobile-logo"
                                onClick={closeMenu}
                            >

                                <span className="logo-blue">
                                    Tech
                                </span>

                                <span className="logo-text">
                                    Store
                                </span>

                            </Link>


                            {/* MOBILE ICONS */}

                            <div className="mobile-icons">


                                {/* MOBILE NOTIFICATION */}

                                {isLoggedIn && (

                                    <div
                                        ref={
                                            mobileNotificationRef
                                        }
                                        style={{
                                            position:
                                                "relative",
                                        }}
                                    >

                                        <button
                                            className="mobile-icon"
                                            title="Notifications"
                                            onClick={() => {
                                                const nextOpen = !notificationOpen;
                                                setNotificationOpen(nextOpen);
                                                if (nextOpen) {
                                                    loadNotifications();
                                                }
                                            }}
                                        >

                                            <FaBell />

                                            {unreadCount >
                                                0 && (

                                                <span className="icon-badge">

                                                    {unreadCount >
                                                        9
                                                        ? "9+"
                                                        : unreadCount}

                                                </span>
                                            )}

                                        </button>


                                        {/* MOBILE NOTIFICATION DROPDOWN */}

                                        {notificationOpen && (

                                            <div className="notification-dropdown-container mobile">

                                                <NotificationDropdown
                                                    notifications={
                                                        notifications
                                                    }
                                                    unreadCount={
                                                        unreadCount
                                                    }
                                                    loading={
                                                        loadingNotifications
                                                    }
                                                    onNotificationClick={
                                                        handleNotificationClick
                                                    }
                                                    onMarkAllRead={
                                                        handleMarkAllAsRead
                                                    }
                                                    onViewAll={() => {

                                                        setNotificationOpen(
                                                            false
                                                        );

                                                        setMenuOpen(
                                                            false
                                                        );

                                                        navigate(
                                                            "/notifications"
                                                        );
                                                    }}
                                                    formatTime={
                                                        formatNotificationTime
                                                    }
                                                    getIcon={
                                                        getNotificationIcon
                                                    }
                                                />

                                            </div>
                                        )}

                                    </div>
                                )}


                                {/* MOBILE CART */}

                                <Link
                                    to="/cart"
                                    className="mobile-icon"
                                    onClick={closeMenu}
                                >

                                    <FaShoppingCart />

                                    {totalCartItems >
                                        0 && (

                                        <span className="icon-badge">
                                            {totalCartItems}
                                        </span>
                                    )}

                                </Link>


                                {/* MOBILE WISHLIST */}

                                <Link
                                    to="/wishlist"
                                    className="mobile-icon"
                                    onClick={closeMenu}
                                >

                                    <FaHeart />

                                    {wishlistItems.length >
                                        0 && (

                                        <span className="icon-badge">
                                            {wishlistItems.length}
                                        </span>
                                    )}

                                </Link>

                            </div>

                        </div>


                        {/* MOBILE SEARCH */}

                        <form
                            className="mobile-search-form"
                            onSubmit={
                                handleSearch
                            }
                        >

                            <div className="search-box">

                                <FaSearch className="search-icon" />

                                <input
                                    type="text"
                                    placeholder="Search products..."
                                    value={search}
                                    onChange={(e) =>
                                        setSearch(
                                            e.target.value
                                        )
                                    }
                                />

                            </div>

                        </form>

                    </div>


                    {/* DESKTOP NAVBAR */}

                    <div className="desktop-navbar">


                        {/* LOGO */}

                        <Link
                            to="/"
                            className="desktop-logo"
                        >

                            <span className="logo-blue">
                                Tech
                            </span>

                            <span className="logo-text">
                                Store
                            </span>

                        </Link>


                        {/* SEARCH */}

                        <form
                            className="search-form"
                            onSubmit={
                                handleSearch
                            }
                        >

                            <div className="search-box">

                                <FaSearch className="search-icon" />

                                <input
                                    type="text"
                                    placeholder="Search laptops, mobiles, accessories..."
                                    value={search}
                                    onChange={(e) =>
                                        setSearch(
                                            e.target.value
                                        )
                                    }
                                />

                            </div>

                        </form>


                        {/* DESKTOP MENU */}

                        <ul className="desktop-menu">

                            <li>

                                <NavLink
                                    to="/"
                                    onClick={closeMenu}
                                >
                                    Home
                                </NavLink>

                            </li>


                            <li>

                                <NavLink
                                    to="/products"
                                    onClick={closeMenu}
                                >
                                    Products
                                </NavLink>

                            </li>


                            <li>

                                <NavLink
                                    to="/orders"
                                    onClick={closeMenu}
                                >
                                    Orders
                                </NavLink>

                            </li>


                            <li>

                                <NavLink
                                    to="/about"
                                    onClick={closeMenu}
                                >
                                    About
                                </NavLink>

                            </li>


                            <li>

                                <NavLink
                                    to="/contact"
                                    onClick={closeMenu}
                                >
                                    Contact
                                </NavLink>

                            </li>

                        </ul>


                        {/* DESKTOP ACTIONS */}

                        <div className="desktop-actions">


                            {/* WISHLIST */}

                            <Link
                                to="/wishlist"
                                className="action-icon"
                                title="Wishlist"
                            >

                                <FaHeart />

                                {wishlistItems.length >
                                    0 && (

                                    <span className="icon-badge">
                                        {wishlistItems.length}
                                    </span>
                                )}

                            </Link>


                            {/* NOTIFICATION — Wishlist ke bilkul baju me */}

                            {isLoggedIn && (

                                <div
                                    ref={
                                        desktopNotificationRef
                                    }
                                    style={{
                                        position:
                                            "relative",
                                    }}
                                >

                                    <button
                                        className="action-icon"
                                        title="Notifications"
                                        onClick={() => {
                                            const nextOpen = !notificationOpen;
                                            setNotificationOpen(nextOpen);
                                            if (nextOpen) {
                                                loadNotifications();
                                            }
                                        }}
                                    >

                                        <FaBell />

                                        {unreadCount >
                                            0 && (

                                            <span className="icon-badge">

                                                {unreadCount >
                                                    9
                                                    ? "9+"
                                                    : unreadCount}

                                            </span>
                                        )}

                                    </button>


                                    {/* DESKTOP NOTIFICATION DROPDOWN */}

                                    {notificationOpen && (

                                        <div className="notification-dropdown-container desktop">

                                            <NotificationDropdown
                                                notifications={
                                                    notifications
                                                }
                                                unreadCount={
                                                    unreadCount
                                                }
                                                loading={
                                                    loadingNotifications
                                                }
                                                onNotificationClick={
                                                    handleNotificationClick
                                                }
                                                onMarkAllRead={
                                                    handleMarkAllAsRead
                                                }
                                                onViewAll={() => {

                                                    setNotificationOpen(
                                                        false
                                                    );

                                                    navigate(
                                                        "/notifications"
                                                    );
                                                }}
                                                formatTime={
                                                    formatNotificationTime
                                                }
                                                getIcon={
                                                    getNotificationIcon
                                                }
                                            />

                                        </div>
                                    )}

                                </div>
                            )}


                            {/* CART */}

                            <Link
                                to="/cart"
                                className="action-icon"
                                title="Cart"
                            >

                                <FaShoppingCart />

                                {totalCartItems >
                                    0 && (

                                    <span className="icon-badge">
                                        {totalCartItems}
                                    </span>
                                )}

                            </Link>


                            {/* THEME */}

                            <button
                                className="theme-btn"
                                onClick={() =>
                                    dispatch(
                                        toggleTheme()
                                    )
                                }
                                title="Toggle Light/Dark Theme"
                            >

                                {theme ===
                                    "light" ? (
                                    <FaMoon />
                                ) : (
                                    <FaSun />
                                )}

                            </button>


                            {/* PROFILE */}

                            {isLoggedIn ? (

                                <div
                                    className="profile-dropdown"
                                    ref={
                                        profileRef
                                    }
                                >

                                    <button
                                        className="profile-btn"
                                        onClick={() =>
                                            setProfileOpen(
                                                !profileOpen
                                            )
                                        }
                                    >

                                        <div
                                            className="d-flex align-items-center justify-content-center bg-primary text-white rounded-circle fw-bold me-1"
                                            style={{
                                                width:
                                                    "24px",
                                                height:
                                                    "24px",
                                                fontSize:
                                                    "12px",
                                            }}
                                        >

                                            {userInitial}

                                        </div>


                                        <span>
                                            {user?.name ||
                                                "Profile"}
                                        </span>


                                        <FaChevronDown
                                            className={
                                                profileOpen
                                                    ? "rotate"
                                                    : ""
                                            }
                                        />

                                    </button>


                                    {profileOpen && (

                                        <div className="dropdown-menu-custom">


                                            {user?.role ===
                                                "admin" && (

                                                <Link
                                                    to="/admin/dashboard"
                                                    className="text-primary fw-bold"
                                                    onClick={() => {

                                                        setProfileOpen(
                                                            false
                                                        );

                                                        closeMenu();
                                                    }}
                                                >

                                                    Admin Dashboard

                                                </Link>
                                            )}


                                            <Link
                                                to="/profile"
                                                onClick={() => {

                                                    setProfileOpen(
                                                        false
                                                    );

                                                    closeMenu();
                                                }}
                                            >

                                                My Profile

                                            </Link>


                                            <Link
                                                to="/orders"
                                                onClick={() => {

                                                    setProfileOpen(
                                                        false
                                                    );

                                                    closeMenu();
                                                }}
                                            >

                                                My Orders

                                            </Link>


                                            {/* PROFILE NOTIFICATIONS */}

                                            <Link
                                                to="/notifications"
                                                onClick={() => {

                                                    setProfileOpen(
                                                        false
                                                    );

                                                    closeMenu();
                                                }}
                                            >

                                                <FaBell className="me-2" />

                                                Notifications

                                            </Link>


                                            <button
                                                onClick={
                                                    handleLogout
                                                }
                                            >

                                                Logout

                                            </button>

                                        </div>
                                    )}

                                </div>

                            ) : (

                                <Link
                                    to="/login"
                                    className="login-btn"
                                    onClick={
                                        closeMenu
                                    }
                                >
                                    Login
                                </Link>
                            )}

                        </div>

                    </div>


                    {/* MOBILE DRAWER */}

                    <div
                        className={`mobile-drawer ${
                            menuOpen
                                ? "drawer-open"
                                : ""
                        }`}
                    >


                        {/* MOBILE PROFILE */}

                        {isLoggedIn && (

                            <div className="mobile-drawer-profile">

                                <div
                                    className="d-flex align-items-center justify-content-center bg-primary text-white rounded-circle fw-bold shadow-sm"
                                    style={{
                                        width:
                                            "42px",
                                        height:
                                            "42px",
                                        fontSize:
                                            "18px",
                                        flexShrink:
                                            0,
                                    }}
                                >

                                    {userInitial}

                                </div>


                                <div className="overflow-hidden">

                                    <h6 className="fw-bold mb-0 text-truncate">
                                        {user?.name}
                                    </h6>

                                    <small className="text-muted text-truncate d-block">
                                        {user?.email}
                                    </small>

                                </div>

                            </div>
                        )}


                        {/* HOME */}

                        <NavLink
                            to="/"
                            onClick={closeMenu}
                        >
                            <FaHome className="me-2" />
                            Home
                        </NavLink>


                        {/* PRODUCTS */}

                        <NavLink
                            to="/products"
                            onClick={closeMenu}
                        >
                            <FaBoxOpen className="me-2" />
                            Products
                        </NavLink>


                        {/* ORDERS */}

                        <NavLink
                            to="/orders"
                            onClick={closeMenu}
                        >
                            <FaShoppingBag className="me-2" />
                            Orders
                        </NavLink>


                        {/* ABOUT */}

                        <NavLink
                            to="/about"
                            onClick={closeMenu}
                        >
                            <FaInfoCircle className="me-2" />
                            About
                        </NavLink>


                        {/* CONTACT */}

                        <NavLink
                            to="/contact"
                            onClick={closeMenu}
                        >
                            <FaEnvelope className="me-2" />
                            Contact
                        </NavLink>


                        {/* ADMIN */}

                        {isLoggedIn &&
                            user?.role ===
                                "admin" && (

                                <NavLink
                                    to="/admin/dashboard"
                                    onClick={
                                        closeMenu
                                    }
                                    className="text-primary fw-bold"
                                >

                                    <FaShieldAlt className="me-2" />

                                    Admin Dashboard

                                </NavLink>
                            )}


                        {/* PROFILE */}

                        {isLoggedIn && (

                            <NavLink
                                to="/profile"
                                onClick={
                                    closeMenu
                                }
                            >

                                <FaUser className="me-2" />

                                My Profile

                            </NavLink>
                        )}


                        {/* NOTIFICATIONS */}

                        {isLoggedIn && (

                            <NavLink
                                to="/notifications"
                                onClick={
                                    closeMenu
                                }
                                className="mobile-notification-link justify-content-between"
                            >

                                <span className="d-flex align-items-center">

                                    <FaBell
                                        className="me-2"
                                    />

                                    Notifications

                                </span>


                                {unreadCount >
                                    0 && (

                                    <span
                                        className="badge bg-danger rounded-pill"
                                        style={{
                                            fontSize:
                                                "11px",
                                            minWidth:
                                                "22px",
                                            padding:
                                                "4px 7px",
                                        }}
                                    >

                                        {unreadCount >
                                            9
                                            ? "9+"
                                            : unreadCount}

                                    </span>
                                )}

                            </NavLink>
                        )}


                        {/* THEME */}

                        <button
                            className="drawer-theme-btn mt-2"
                            onClick={() =>
                                dispatch(
                                    toggleTheme()
                                )
                            }
                        >

                            {theme ===
                                "light" ? (

                                <>
                                    <FaMoon className="me-2" />
                                    Dark Mode
                                </>

                            ) : (

                                <>
                                    <FaSun className="me-2" />
                                    Light Mode
                                </>

                            )}

                        </button>


                        {/* LOGOUT */}

                        {isLoggedIn ? (

                            <button
                                className="drawer-logout-btn"
                                onClick={
                                    handleLogout
                                }
                            >

                                Logout

                            </button>

                        ) : (

                            <Link
                                to="/login"
                                className="drawer-login-btn"
                                onClick={
                                    closeMenu
                                }
                            >

                                Login

                            </Link>
                        )}

                    </div>


                    {/* DRAWER OVERLAY */}

                    {menuOpen && (

                        <div
                            className="drawer-overlay"
                            onClick={
                                closeMenu
                            }
                        />

                    )}

                </div>

            </nav>

        </header>
    );
}


  // NOTIFICATION DROPDOWN COMPONENT

function NotificationDropdown({
    notifications,
    unreadCount,
    loading,
    onNotificationClick,
    onMarkAllRead,
    onViewAll,
    formatTime,
    getIcon,
}) {
    const visibleNotifications =
        notifications.slice(0, 5);

    return (
        <div>
            {/* HEADER */}
            <div className="notif-header">
                <div>
                    <h6 className="notif-header-title">
                        <FaBell style={{ fontSize: "14px", opacity: 0.8 }} />
                        Notifications
                        {unreadCount > 0 && (
                            <span className="notif-unread-chip">
                                {unreadCount} new
                            </span>
                        )}
                    </h6>
                </div>

                {unreadCount > 0 && (
                    <button
                        onClick={onMarkAllRead}
                        className="notif-mark-read-btn"
                    >
                        Mark all read
                    </button>
                )}
            </div>

            {/* LOADING */}
            {loading && (
                <div className="notif-empty">
                    <div
                        className="spinner-border spinner-border-sm text-primary mb-2"
                        role="status"
                    />
                    <p className="mb-0 small">Loading notifications...</p>
                </div>
            )}

            {/* EMPTY */}
            {!loading && visibleNotifications.length === 0 && (
                <div className="notif-empty">
                    <div className="notif-empty-icon">
                        <FaBell />
                    </div>
                    <div className="notif-empty-title">
                        No notifications
                    </div>
                    <small>You're all caught up with your updates!</small>
                </div>
            )}

            {/* NOTIFICATION LIST */}
            {!loading && (
                <div className="notif-list">
                    {visibleNotifications.map((notification) => {
                        const isUnread = notification.isRead === false;

                        return (
                            <button
                                key={notification.$id}
                                onClick={() => onNotificationClick(notification)}
                                className={`notif-item ${isUnread ? "unread" : ""}`}
                            >
                                {/* ICON */}
                                <div className="notif-item-icon">
                                    {getIcon(notification)}
                                </div>

                                {/* CONTENT */}
                                <div className="notif-item-body">
                                    <div className="notif-item-title-row">
                                        <strong className="notif-item-title">
                                            {notification.title}
                                        </strong>
                                        {isUnread && <span className="notif-dot" />}
                                    </div>

                                    <p className="notif-item-msg">
                                        {notification.message}
                                    </p>

                                    {String(notification.type || "").toUpperCase() === "DELIVERY_OTP" &&
                                        (() => {
                                            const m = String(notification.message || "").match(/\b(\d{6})\b/);
                                            const otpVal = notification.otp || (m ? m[1] : "");
                                            const isTerminal = notifications.some((n) => {
                                                const nt = String(n.type || "").toUpperCase();
                                                if (!nt.includes("DELIVERED") && !nt.includes("CANCEL")) {
                                                    return false;
                                                }
                                                return (
                                                    (notification.orderId && n.orderId === notification.orderId) ||
                                                    (notification.shipmentId && n.shipmentId === notification.shipmentId)
                                                );
                                            });
                                            if (!otpVal || isTerminal) return null;
                                            return (
                                                <div
                                                    style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: "6px",
                                                        padding: "3px 9px",
                                                        borderRadius: "7px",
                                                        background: "rgba(37, 99, 235, 0.12)",
                                                        border: "1px dashed #3b82f6",
                                                        color: "#2563eb",
                                                        fontWeight: 800,
                                                        fontSize: "12px",
                                                        letterSpacing: "1.5px",
                                                        marginBottom: "4px",
                                                    }}
                                                >
                                                    🔐 OTP: {otpVal}
                                                </div>
                                            );
                                        })()}

                                    <small className="notif-item-time">
                                        {formatTime(
                                            notification.createdAt ||
                                            notification.$createdAt
                                        )}
                                    </small>
                                </div>

                                {/* READ STATUS */}
                                <div style={{ opacity: 0.5, fontSize: "12px", marginTop: "3px" }}>
                                    {notification.isRead ? (
                                        <FaCheckDouble style={{ color: "#22c55e" }} />
                                    ) : (
                                        <FaCheck />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* FOOTER */}
            {!loading && notifications.length > 0 && (
                <button onClick={onViewAll} className="notif-footer-btn">
                    View All Notifications <FaArrowRight style={{ fontSize: "11px" }} />
                </button>
            )}
        </div>
    );
}


export default Navbar;