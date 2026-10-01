import { useEffect, useMemo, useState } from "react";
import AdminCustomSelect from "../../components/AdminCustomSelect";

import {
    FaCog,
    FaStore,
    FaCreditCard,
    FaEnvelope,
    FaShieldAlt,
    FaPalette,
    FaSave,
    FaUndo,
    FaCheckCircle,
    FaLock,
    FaServer,
    FaReact,
    FaBootstrap,
    FaMoon,
    FaDesktop,
    FaBell,
    FaPercent,
    FaTruck,
    FaInfoCircle,
    FaDatabase,
} from "react-icons/fa";

import { toast } from "react-hot-toast";
import authService from "../../appwrite/authService";

import "../../css/Settings.css";


  // DEFAULT SETTINGS

const DEFAULT_SETTINGS = {
    storeName: "TechStore",
    storeEmail: "support@techstore.com",
    phone: "",
    address: "",

    currency: "INR",
    paymentGateway: "Razorpay",
    tax: "18",
    shipping: "80",

    emailNotification: true,
    orderNotification: true,
    marketingEmail: false,

    timezone: "Asia/Kolkata",
    sessionTimeout: "30 Minutes",
    twoFactor: true,
    loginAlert: true,

    darkMode: false,
    compactSidebar: false,
    fixedHeader: true,
};


  // TAB CONFIG

const TABS = [
    {
        id: "store",
        label: "Store",
        icon: FaStore,
        description: "Store information",
    },
    {
        id: "payment",
        label: "Payment",
        icon: FaCreditCard,
        description: "Payment & pricing",
    },
    {
        id: "email",
        label: "Email",
        icon: FaEnvelope,
        description: "Notifications",
    },
    {
        id: "security",
        label: "Security",
        icon: FaShieldAlt,
        description: "Security preferences",
    },
    {
        id: "appearance",
        label: "Appearance",
        icon: FaPalette,
        description: "Admin interface",
    },
    {
        id: "system",
        label: "System",
        icon: FaCog,
        description: "System information",
    },
];


  // HELPERS


const validateSettings = (settings) => {

    if (!settings.storeName.trim()) {
        return "Store name is required.";
    }

    if (!settings.storeEmail.trim()) {
        return "Store email is required.";
    }

    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
        !emailRegex.test(
            settings.storeEmail.trim()
        )
    ) {
        return "Please enter a valid store email.";
    }

    const tax =
        Number(settings.tax);

    if (
        Number.isNaN(tax) ||
        tax < 0 ||
        tax > 100
    ) {
        return "Tax must be between 0% and 100%.";
    }

    const shipping =
        Number(settings.shipping);

    if (
        Number.isNaN(shipping) ||
        shipping < 0
    ) {
        return "Shipping charge cannot be negative.";
    }

    return "";
};


  // COMPONENT

function Settings() {

    const [activeTab, setActiveTab] =
        useState("store");

    // Keep the current global theme when opening Settings.
    // This prevents Settings from forcing light mode before
    // Appwrite preferences finish loading.
    const initialDarkMode =
        typeof document !== "undefined" &&
        (
            document.body.classList.contains("dark") ||
            document.body.classList.contains("dark-mode") ||
            document.documentElement.classList.contains("dark") ||
            document.documentElement.classList.contains("dark-mode") ||
            document.documentElement.getAttribute("data-theme") === "dark"
        );

    const [settings, setSettings] =
        useState({
            ...DEFAULT_SETTINGS,
            darkMode: Boolean(initialDarkMode),
        });

    const [savedSettings, setSavedSettings] =
        useState({
            ...DEFAULT_SETTINGS,
            darkMode: Boolean(initialDarkMode),
        });

    const [saving, setSaving] =
        useState(false);

    // Load admin settings from Appwrite account preferences
    useEffect(() => {
        let isMounted = true;
        authService.getPrefs().then((prefs) => {
            if (isMounted && prefs && Object.keys(prefs).length > 0) {
                setSettings((prev) => ({
                    ...DEFAULT_SETTINGS,
                    ...prev,
                    ...prefs,
                }));
                setSavedSettings((prev) => ({
                    ...DEFAULT_SETTINGS,
                    ...prev,
                    ...prefs,
                }));
            }
        }).catch((err) => {
            console.error("Appwrite load preferences error:", err);
        });
        return () => {
            isMounted = false;
        };
    }, []);


  // UNSAVED CHANGES

    const hasChanges =
        JSON.stringify(settings) !==
        JSON.stringify(savedSettings);


  // CURRENT TAB

    const activeTabData =
        useMemo(
            () =>
                TABS.find(
                    (tab) =>
                        tab.id === activeTab
                ),
            [activeTab]
        );


  // DARK MODE

    useEffect(() => {

        const isDark = Boolean(
            settings.darkMode
        );

        const body =
            document.body;

        const html =
            document.documentElement;

        // Keep both theme class names in sync
        // so all admin pages can use either one.
        body.classList.toggle(
            "dark",
            isDark
        );

        body.classList.toggle(
            "dark-mode",
            isDark
        );

        html.classList.toggle(
            "dark",
            isDark
        );

        html.classList.toggle(
            "dark-mode",
            isDark
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

    }, [settings.darkMode]);


  // SAVE SETTINGS

    const handleSave = async () => {

        const validationError =
            validateSettings(settings);

        if (validationError) {

            toast.error(
                validationError
            );

            return;
        }


        setSaving(true);


        try {

            await authService.updatePrefs(settings);

            setSavedSettings(settings);

            toast.success(
                "Settings saved successfully to Appwrite."
            );

        } catch (error) {

            console.error(
                "Settings Save Error:",
                error
            );

            toast.error(
                "Unable to save settings."
            );

        } finally {

            setTimeout(() => {
                setSaving(false);
            }, 400);
        }
    };


  // CHANGE HANDLER

    const handleChange = (event) => {

        const {
            name,
            value,
            type,
            checked,
        } = event.target;

        setSettings(
            (previous) => ({
                ...previous,
                [name]:
                    type === "checkbox"
                        ? checked
                        : value,
            })
        );
    };


  // RESET CURRENT CHANGES

    const handleDiscardChanges = () => {

        setSettings(
            savedSettings
        );

        toast.success(
            "Unsaved changes discarded."
        );
    };


  // RESET ALL SETTINGS

    const handleResetAll = async () => {

        const confirmed =
            window.confirm(
                "Reset all TechStore settings to default values?"
            );

        if (!confirmed) {
            return;
        }

        try {
            await authService.updatePrefs(
                DEFAULT_SETTINGS
            );

            setSettings(
                DEFAULT_SETTINGS
            );

            setSavedSettings(
                DEFAULT_SETTINGS
            );

            toast.success(
                "Settings restored to default."
            );
        } catch (error) {
            console.error("Reset Error:", error);
            toast.error("Failed to reset settings.");
        }
    };


  // TAB CHANGE

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
    };


  // RENDER

    return (

        <div className="container-fluid settings-page py-4">


            {/* HEADER */}

            <div className="settings-header">

                <div className="settings-heading">

                    <div className="settings-heading-icon">
                        <FaCog />
                    </div>

                    <div>

                        <h2 className="settings-page-title">
                            Settings
                        </h2>

                        <p className="settings-subtitle">
                            Manage your TechStore
                            administration preferences.
                        </p>

                    </div>

                </div>


                <div className="settings-header-actions">

                    {hasChanges && (

                        <span className="settings-unsaved">

                            <span className="settings-unsaved-dot" />

                            Unsaved changes

                        </span>

                    )}


                    {hasChanges && (

                        <button
                            type="button"
                            className="settings-discard-btn"
                            onClick={
                                handleDiscardChanges
                            }
                            disabled={saving}
                        >

                            <FaUndo />

                            Discard

                        </button>

                    )}


                    <button
                        type="button"
                        className="settings-save-btn"
                        onClick={handleSave}
                        disabled={
                            saving ||
                            !hasChanges
                        }
                    >

                        <FaSave />

                        {saving
                            ? "Saving..."
                            : "Save Changes"}

                    </button>

                </div>

            </div>


            {/* STATUS BANNER */}

            <div
                className={
                    hasChanges
                        ? "settings-status-banner unsaved"
                        : "settings-status-banner saved"
                }
            >

                <div className="settings-status-icon">

                    {hasChanges
                        ? <FaInfoCircle />
                        : <FaCheckCircle />}

                </div>

                <div>

                    <strong>
                        {hasChanges
                            ? "You have unsaved changes"
                            : "All settings are saved"}
                    </strong>

                    <span>
                        {hasChanges
                            ? "Save your changes before leaving this page."
                            : "Your latest preferences are stored locally."}
                    </span>

                </div>

            </div>


            {/* MAIN LAYOUT */}

            <div className="row g-4">


                {/* SIDEBAR */}

                <div className="col-xl-3 col-lg-4">

                    <div className="settings-sidebar">


                        <div className="settings-sidebar-header">

                            <div className="settings-sidebar-logo">
                                <FaCog />
                            </div>

                            <div>

                                <strong>
                                    Admin Settings
                                </strong>

                                <span>
                                    TechStore
                                </span>

                            </div>

                        </div>


                        <div className="settings-sidebar-menu">

                            {TABS.map((tab) => {

                                const Icon =
                                    tab.icon;

                                const active =
                                    activeTab ===
                                    tab.id;

                                return (

                                    <button
                                        type="button"
                                        key={tab.id}
                                        className={
                                            active
                                                ? "settings-nav-item active"
                                                : "settings-nav-item"
                                        }
                                        onClick={() =>
                                            handleTabChange(
                                                tab.id
                                            )
                                        }
                                    >

                                        <span className="settings-nav-icon">
                                            <Icon />
                                        </span>

                                        <span className="settings-nav-text">

                                            <strong>
                                                {tab.label}
                                            </strong>

                                            <small>
                                                {tab.description}
                                            </small>

                                        </span>

                                        <span className="settings-nav-arrow">
                                            →
                                        </span>

                                    </button>

                                );
                            })}

                        </div>


                        <div className="settings-sidebar-footer">

                            <div className="settings-online-dot" />

                            <span>
                                Admin Panel Online
                            </span>

                        </div>

                    </div>

                </div>


                {/* CONTENT */}

                <div className="col-xl-9 col-lg-8">

                    <div className="settings-content">


                        {/* CONTENT HEADER */}

                        <div className="settings-content-heading">

                            <div>

                                <h3>
                                    {activeTabData?.label}
                                    {" "}
                                    Settings
                                </h3>

                                <p>
                                    {activeTabData?.description}
                                    {" "}
                                    for your TechStore admin panel.
                                </p>

                            </div>

                            <div className="settings-content-icon">

                                {activeTabData &&
                                    (() => {

                                        const Icon =
                                            activeTabData.icon;

                                        return <Icon />;

                                    })()}

                            </div>

                        </div>


                        {/* STORE */}

                        {activeTab === "store" && (

                            <div className="settings-card">

                                <div className="settings-card-header">

                                    <div>

                                        <h4>
                                            <FaStore />
                                            Store Information
                                        </h4>

                                        <p>
                                            Configure your
                                            basic store information.
                                        </p>

                                    </div>

                                    <span className="settings-card-badge">
                                        General
                                    </span>

                                </div>


                                <div className="settings-card-body">

                                    <div className="row g-4">


                                        <div className="col-md-6">

                                            <label className="settings-label">
                                                Store Name
                                            </label>

                                            <div className="settings-input-wrap">

                                                <FaStore />

                                                <input
                                                    type="text"
                                                    className="settings-input"
                                                    name="storeName"
                                                    value={
                                                        settings.storeName
                                                    }
                                                    onChange={
                                                        handleChange
                                                    }
                                                    placeholder="TechStore"
                                                />

                                            </div>

                                        </div>


                                        <div className="col-md-6">

                                            <label className="settings-label">
                                                Store Email
                                            </label>

                                            <div className="settings-input-wrap">

                                                <FaEnvelope />

                                                <input
                                                    type="email"
                                                    className="settings-input"
                                                    name="storeEmail"
                                                    value={
                                                        settings.storeEmail
                                                    }
                                                    onChange={
                                                        handleChange
                                                    }
                                                    placeholder="support@example.com"
                                                />

                                            </div>

                                        </div>


                                        <div className="col-md-6">

                                            <label className="settings-label">
                                                Phone Number
                                            </label>

                                            <input
                                                type="tel"
                                                className="settings-input settings-input-plain"
                                                name="phone"
                                                value={
                                                    settings.phone
                                                }
                                                onChange={
                                                    handleChange
                                                }
                                                placeholder="+91 XXXXX XXXXX"
                                            />

                                        </div>


                                        <div className="col-md-6">

                                            <label className="settings-label">
                                                Store Logo
                                            </label>

                                            <input
                                                type="file"
                                                className="settings-input settings-file-input"
                                                accept="image/png,image/jpeg,image/webp"
                                            />

                                            <small className="settings-help">
                                                PNG, JPG or WEBP recommended.
                                            </small>

                                        </div>


                                        <div className="col-12">

                                            <label className="settings-label">
                                                Store Address
                                            </label>

                                            <textarea
                                                className="settings-input settings-textarea"
                                                name="address"
                                                value={
                                                    settings.address
                                                }
                                                onChange={
                                                    handleChange
                                                }
                                                placeholder="Enter complete store address"
                                                rows="4"
                                            />

                                        </div>

                                    </div>

                                </div>

                            </div>

                        )}


                        {/* PAYMENT */}

                        {activeTab === "payment" && (

                            <div className="settings-card">

                                <div className="settings-card-header">

                                    <div>

                                        <h4>
                                            <FaCreditCard />
                                            Payment & Pricing
                                        </h4>

                                        <p>
                                            Configure currency,
                                            gateway and charges.
                                        </p>

                                    </div>

                                    <span className="settings-card-badge success">
                                        Payments
                                    </span>

                                </div>


                                <div className="settings-card-body">

                                    <div className="row g-4">


                                        <div className="col-md-6">

                                            <label className="settings-label">
                                                Currency
                                            </label>

                                            <AdminCustomSelect
                                                className="settings-input settings-select"
                                                name="currency"
                                                value={
                                                    settings.currency
                                                }
                                                onChange={
                                                    handleChange
                                                }
                                            >

                                                <option value="INR">
                                                    INR — Indian Rupee
                                                </option>

                                                <option value="USD">
                                                    USD — US Dollar
                                                </option>

                                                <option value="EUR">
                                                    EUR — Euro
                                                </option>

                                            </AdminCustomSelect>

                                        </div>


                                        <div className="col-md-6">

                                            <label className="settings-label">
                                                Payment Gateway
                                            </label>

                                            <AdminCustomSelect
                                                className="settings-input settings-select"
                                                name="paymentGateway"
                                                value={
                                                    settings.paymentGateway
                                                }
                                                onChange={
                                                    handleChange
                                                }
                                            >

                                                <option value="Razorpay">
                                                    Razorpay
                                                </option>

                                                <option value="Stripe">
                                                    Stripe
                                                </option>

                                                <option value="PayPal">
                                                    PayPal
                                                </option>

                                            </AdminCustomSelect>

                                        </div>


                                        <div className="col-md-6">

                                            <label className="settings-label">
                                                Tax
                                            </label>

                                            <div className="settings-input-wrap">

                                                <FaPercent />

                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    className="settings-input"
                                                    name="tax"
                                                    value={
                                                        settings.tax
                                                    }
                                                    onChange={
                                                        handleChange
                                                    }
                                                />

                                            </div>

                                            <small className="settings-help">
                                                Enter tax percentage.
                                            </small>

                                        </div>


                                        <div className="col-md-6">

                                            <label className="settings-label">
                                                Shipping Charge
                                            </label>

                                            <div className="settings-input-wrap">

                                                <FaTruck />

                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="settings-input"
                                                    name="shipping"
                                                    value={
                                                        settings.shipping
                                                    }
                                                    onChange={
                                                        handleChange
                                                    }
                                                />

                                            </div>

                                            <small className="settings-help">
                                                Default shipping charge.
                                            </small>

                                        </div>


                                        <div className="col-12">

                                            <div className="settings-info-box">

                                                <FaInfoCircle />

                                                <div>

                                                    <strong>
                                                        Payment configuration
                                                    </strong>

                                                    <span>
                                                        Payment gateway
                                                        integration should
                                                        be configured separately
                                                        before processing real
                                                        payments.
                                                    </span>

                                                </div>

                                            </div>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        )}


                        {/* EMAIL */}

                        {activeTab === "email" && (

                            <div className="settings-card">

                                <div className="settings-card-header">

                                    <div>

                                        <h4>
                                            <FaEnvelope />
                                            Notification Preferences
                                        </h4>

                                        <p>
                                            Control which notifications
                                            your admin panel should use.
                                        </p>

                                    </div>

                                    <span className="settings-card-badge danger">
                                        Notifications
                                    </span>

                                </div>


                                <div className="settings-card-body">

                                    <div className="settings-toggle-list">


                                        <div className="settings-toggle">

                                            <div className="settings-toggle-info">

                                                <div className="settings-toggle-icon">
                                                    <FaEnvelope />
                                                </div>

                                                <div>

                                                    <strong>
                                                        Email Notifications
                                                    </strong>

                                                    <span>
                                                        Receive general
                                                        email notifications.
                                                    </span>

                                                </div>

                                            </div>

                                            <label className="settings-switch">

                                                <input
                                                    type="checkbox"
                                                    name="emailNotification"
                                                    checked={
                                                        settings.emailNotification
                                                    }
                                                    onChange={
                                                        handleChange
                                                    }
                                                />

                                                <span />

                                            </label>

                                        </div>


                                        <div className="settings-toggle">

                                            <div className="settings-toggle-info">

                                                <div className="settings-toggle-icon order">
                                                    <FaBell />
                                                </div>

                                                <div>

                                                    <strong>
                                                        Order Notifications
                                                    </strong>

                                                    <span>
                                                        Get notified about
                                                        new order activity.
                                                    </span>

                                                </div>

                                            </div>

                                            <label className="settings-switch">

                                                <input
                                                    type="checkbox"
                                                    name="orderNotification"
                                                    checked={
                                                        settings.orderNotification
                                                    }
                                                    onChange={
                                                        handleChange
                                                    }
                                                />

                                                <span />

                                            </label>

                                        </div>


                                        <div className="settings-toggle">

                                            <div className="settings-toggle-info">

                                                <div className="settings-toggle-icon marketing">
                                                    <FaEnvelope />
                                                </div>

                                                <div>

                                                    <strong>
                                                        Marketing Emails
                                                    </strong>

                                                    <span>
                                                        Allow promotional
                                                        email notifications.
                                                    </span>

                                                </div>

                                            </div>

                                            <label className="settings-switch">

                                                <input
                                                    type="checkbox"
                                                    name="marketingEmail"
                                                    checked={
                                                        settings.marketingEmail
                                                    }
                                                    onChange={
                                                        handleChange
                                                    }
                                                />

                                                <span />

                                            </label>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        )}


                        {/* SECURITY */}

                        {activeTab === "security" && (

                            <div className="settings-card">

                                <div className="settings-card-header">

                                    <div>

                                        <h4>
                                            <FaShieldAlt />
                                            Security Settings
                                        </h4>

                                        <p>
                                            Manage authentication and
                                            admin security preferences.
                                        </p>

                                    </div>

                                    <span className="settings-card-badge warning">
                                        Security
                                    </span>

                                </div>


                                <div className="settings-card-body">

                                    <div className="row g-4">


                                        <div className="col-md-6">

                                            <label className="settings-label">
                                                Time Zone
                                            </label>

                                            <AdminCustomSelect
                                                className="settings-input settings-select"
                                                name="timezone"
                                                value={
                                                    settings.timezone
                                                }
                                                onChange={
                                                    handleChange
                                                }
                                            >

                                                <option value="Asia/Kolkata">
                                                    Asia/Kolkata
                                                </option>

                                                <option value="UTC">
                                                    UTC
                                                </option>

                                                <option value="America/New_York">
                                                    America/New_York
                                                </option>

                                                <option value="Europe/London">
                                                    Europe/London
                                                </option>

                                            </AdminCustomSelect>

                                        </div>


                                        <div className="col-md-6">

                                            <label className="settings-label">
                                                Session Timeout
                                            </label>

                                            <AdminCustomSelect
                                                className="settings-input settings-select"
                                                name="sessionTimeout"
                                                value={
                                                    settings.sessionTimeout
                                                }
                                                onChange={
                                                    handleChange
                                                }
                                            >

                                                <option>
                                                    15 Minutes
                                                </option>

                                                <option>
                                                    30 Minutes
                                                </option>

                                                <option>
                                                    1 Hour
                                                </option>

                                                <option>
                                                    2 Hours
                                                </option>

                                            </AdminCustomSelect>

                                        </div>


                                        <div className="col-12">

                                            <div className="settings-toggle">

                                                <div className="settings-toggle-info">

                                                    <div className="settings-toggle-icon security">
                                                        <FaLock />
                                                    </div>

                                                    <div>

                                                        <strong>
                                                            Two-Factor Authentication
                                                        </strong>

                                                        <span>
                                                            Add an extra
                                                            authentication
                                                            layer to your
                                                            admin account.
                                                        </span>

                                                    </div>

                                                </div>

                                                <label className="settings-switch">

                                                    <input
                                                        type="checkbox"
                                                        name="twoFactor"
                                                        checked={
                                                            settings.twoFactor
                                                        }
                                                        onChange={
                                                            handleChange
                                                        }
                                                    />

                                                    <span />

                                                </label>

                                            </div>

                                        </div>


                                        <div className="col-12">

                                            <div className="settings-toggle">

                                                <div className="settings-toggle-info">

                                                    <div className="settings-toggle-icon login">
                                                        <FaShieldAlt />
                                                    </div>

                                                    <div>

                                                        <strong>
                                                            Login Alerts
                                                        </strong>

                                                        <span>
                                                            Show alerts for
                                                            admin login
                                                            activity.
                                                        </span>

                                                    </div>

                                                </div>

                                                <label className="settings-switch">

                                                    <input
                                                        type="checkbox"
                                                        name="loginAlert"
                                                        checked={
                                                            settings.loginAlert
                                                        }
                                                        onChange={
                                                            handleChange
                                                        }
                                                    />

                                                    <span />

                                                </label>

                                            </div>

                                        </div>


                                        <div className="col-12">

                                            <div className="settings-security-box">

                                                <div className="settings-security-box-icon">
                                                    <FaLock />
                                                </div>

                                                <div>

                                                    <strong>
                                                        Admin Security
                                                    </strong>

                                                    <p>
                                                        Authentication and
                                                        authorization should
                                                        be enforced through
                                                        your Appwrite Auth
                                                        configuration.
                                                    </p>

                                                </div>

                                            </div>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        )}


                        {/* APPEARANCE */}

                        {activeTab === "appearance" && (

                            <div className="settings-card">

                                <div className="settings-card-header">

                                    <div>

                                        <h4>
                                            <FaPalette />
                                            Appearance
                                        </h4>

                                        <p>
                                            Customize the admin panel
                                            experience.
                                        </p>

                                    </div>

                                    <span className="settings-card-badge info">
                                        UI
                                    </span>

                                </div>


                                <div className="settings-card-body">

                                    <div className="settings-toggle-list">


                                        <div className="settings-toggle">

                                            <div className="settings-toggle-info">

                                                <div className="settings-toggle-icon dark">
                                                    <FaMoon />
                                                </div>

                                                <div>

                                                    <strong>
                                                        Dark Mode
                                                    </strong>

                                                    <span>
                                                        Use the dark admin
                                                        interface theme.
                                                    </span>

                                                </div>

                                            </div>

                                            <label className="settings-switch">

                                                <input
                                                    type="checkbox"
                                                    name="darkMode"
                                                    checked={
                                                        settings.darkMode
                                                    }
                                                    onChange={
                                                        handleChange
                                                    }
                                                />

                                                <span />

                                            </label>

                                        </div>


                                        <div className="settings-toggle">

                                            <div className="settings-toggle-info">

                                                <div className="settings-toggle-icon compact">
                                                    <FaDesktop />
                                                </div>

                                                <div>

                                                    <strong>
                                                        Compact Sidebar
                                                    </strong>

                                                    <span>
                                                        Use a compact
                                                        navigation layout.
                                                    </span>

                                                </div>

                                            </div>

                                            <label className="settings-switch">

                                                <input
                                                    type="checkbox"
                                                    name="compactSidebar"
                                                    checked={
                                                        settings.compactSidebar
                                                    }
                                                    onChange={
                                                        handleChange
                                                    }
                                                />

                                                <span />

                                            </label>

                                        </div>


                                        <div className="settings-toggle">

                                            <div className="settings-toggle-info">

                                                <div className="settings-toggle-icon fixed">
                                                    <FaDesktop />
                                                </div>

                                                <div>

                                                    <strong>
                                                        Fixed Header
                                                    </strong>

                                                    <span>
                                                        Keep the admin header
                                                        visible while scrolling.
                                                    </span>

                                                </div>

                                            </div>

                                            <label className="settings-switch">

                                                <input
                                                    type="checkbox"
                                                    name="fixedHeader"
                                                    checked={
                                                        settings.fixedHeader
                                                    }
                                                    onChange={
                                                        handleChange
                                                    }
                                                />

                                                <span />

                                            </label>

                                        </div>

                                    </div>


                                    <div className="settings-preview">

                                        <div className="settings-preview-header">

                                            <span />

                                            <div />

                                            <div />

                                        </div>

                                        <div className="settings-preview-body">

                                            <div className="settings-preview-sidebar">
                                                <span />
                                                <span />
                                                <span />
                                                <span />
                                            </div>

                                            <div className="settings-preview-main">

                                                <div />
                                                <div />
                                                <div />

                                            </div>

                                        </div>

                                        <div className="settings-preview-label">

                                            <FaPalette />

                                            Live appearance preview

                                        </div>

                                    </div>

                                </div>

                            </div>

                        )}


                        {/* SYSTEM */}

                        {activeTab === "system" && (

                            <div className="settings-card">

                                <div className="settings-card-header">

                                    <div>

                                        <h4>
                                            <FaCog />
                                            System Information
                                        </h4>

                                        <p>
                                            Current TechStore application
                                            environment.
                                        </p>

                                    </div>

                                    <span className="settings-card-badge success">
                                        Online
                                    </span>

                                </div>


                                <div className="settings-card-body">

                                    <div className="row g-3">


                                        <div className="col-md-6">

                                            <div className="settings-system-item">

                                                <div className="settings-system-icon">
                                                    <FaStore />
                                                </div>

                                                <div>

                                                    <span>
                                                        Application
                                                    </span>

                                                    <strong>
                                                        TechStore
                                                    </strong>

                                                </div>

                                            </div>

                                        </div>


                                        <div className="col-md-6">

                                            <div className="settings-system-item">

                                                <div className="settings-system-icon">
                                                    <FaCog />
                                                </div>

                                                <div>

                                                    <span>
                                                        Version
                                                    </span>

                                                    <strong>
                                                        1.0.0
                                                    </strong>

                                                </div>

                                            </div>

                                        </div>


                                        <div className="col-md-6">

                                            <div className="settings-system-item">

                                                <div className="settings-system-icon react">
                                                    <FaReact />
                                                </div>

                                                <div>

                                                    <span>
                                                        Frontend
                                                    </span>

                                                    <strong>
                                                        React 19
                                                    </strong>

                                                </div>

                                            </div>

                                        </div>


                                        <div className="col-md-6">

                                            <div className="settings-system-item">

                                                <div className="settings-system-icon bootstrap">
                                                    <FaBootstrap />
                                                </div>

                                                <div>

                                                    <span>
                                                        UI Framework
                                                    </span>

                                                    <strong>
                                                        Bootstrap 5
                                                    </strong>

                                                </div>

                                            </div>

                                        </div>


                                        <div className="col-md-6">

                                            <div className="settings-system-item">

                                                <div className="settings-system-icon database">
                                                    <FaDatabase />
                                                </div>

                                                <div>

                                                    <span>
                                                        Backend
                                                    </span>

                                                    <strong>
                                                        Appwrite
                                                    </strong>

                                                </div>

                                            </div>

                                        </div>


                                        <div className="col-md-6">

                                            <div className="settings-system-item">

                                                <div className="settings-system-icon online">
                                                    <FaServer />
                                                </div>

                                                <div>

                                                    <span>
                                                        Server Status
                                                    </span>

                                                    <strong>
                                                        <span className="settings-online-status">
                                                            Online
                                                        </span>
                                                    </strong>

                                                </div>

                                            </div>

                                        </div>


                                        <div className="col-12">

                                            <div className="settings-system-info">

                                                <FaInfoCircle />

                                                <div>

                                                    <strong>
                                                        TechStore Admin Panel
                                                    </strong>

                                                    <span>
                                                        Your current
                                                        configuration is
                                                        running on the
                                                        React + Appwrite
                                                        architecture.
                                                    </span>

                                                </div>

                                            </div>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        )}

                    </div>

                </div>

            </div>


            {/* RESET AREA */}

            <div className="settings-danger-zone">

                <div>

                    <strong>
                        Reset Settings
                    </strong>

                    <span>
                        Restore all preferences to their
                        default values.
                    </span>

                </div>

                <button
                    type="button"
                    onClick={handleResetAll}
                    disabled={saving}
                >
                    <FaUndo />
                    Reset to Default
                </button>

            </div>

        </div>
    );
}

export default Settings;