import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaUserEdit,
  FaEnvelope,
  FaPhoneAlt,
  FaMapMarkerAlt,
  FaIdBadge,
  FaUserShield,
  FaCalendarAlt,
  FaSave,
  FaCheckCircle,
  FaBoxOpen,
  FaShoppingCart,
  FaUsers,
  FaStar,
  FaLock,
  FaSignOutAlt,
  FaEdit,
  FaClipboardCheck,
  FaSyncAlt,
} from "react-icons/fa";
import { Query } from "appwrite";
import { toast } from "react-hot-toast";

import { account } from "../../appwrite/auth";
import { databases } from "../../appwrite/config";
import "../../css/Profile.css";

/* APPWRITE CONFIG */

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;

const USERS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_USERS_COLLECTION_ID || "users";

const PRODUCTS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_PRODUCTS_COLLECTION_ID || "products";

const ORDERS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_ORDERS_COLLECTION_ID || "orders";

const REVIEWS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_REVIEWS_COLLECTION_ID ||
  "6ab2138e0013d6068c57";

/* HELPERS */

const safeString = (value, fallback = "") => {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
};

const getDisplayName = (accountData, userDocument) => {
  return (
    userDocument?.name ||
    userDocument?.fullName ||
    accountData?.name ||
    userDocument?.username ||
    accountData?.email?.split("@")?.[0] ||
    "Admin"
  ).trim();
};

const getInitial = (name) => {
  const cleanName = safeString(name, "Admin").trim();

  if (!cleanName) {
    return "A";
  }

  return cleanName.charAt(0).toUpperCase();
};

const getRole = (userDocument) => {
  const role =
    userDocument?.role ||
    userDocument?.userRole ||
    "Admin";

  return safeString(role, "Admin");
};

const getStatus = (userDocument) => {
  return safeString(userDocument?.status, "Active") || "Active";
};

const getPhone = (accountData, userDocument) => {
  return (
    userDocument?.phone ||
    userDocument?.phoneNumber ||
    accountData?.phone ||
    ""
  );
};

const getCity = (userDocument) => {
  return (
    userDocument?.city ||
    userDocument?.addressCity ||
    ""
  );
};

const getState = (userDocument) => {
  return (
    userDocument?.state ||
    userDocument?.addressState ||
    ""
  );
};

const getCountry = (userDocument) => {
  return (
    userDocument?.country ||
    "India"
  );
};

const getAddress = (userDocument) => {
  return (
    userDocument?.address ||
    userDocument?.fullAddress ||
    ""
  );
};

const getZip = (userDocument) => {
  return (
    userDocument?.zip ||
    userDocument?.pincode ||
    userDocument?.postalCode ||
    ""
  );
};

const getUsername = (accountData, userDocument, name) => {
  return (
    userDocument?.username ||
    accountData?.prefs?.username ||
    safeString(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
};

const formatDate = (date) => {
  if (!date) {
    return "Not available";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (date) => {
  if (!date) {
    return "Not available";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCount = (value) => {
  return Number(value || 0).toLocaleString("en-IN");
};

/* PROFILE */

function Profile() {
  /* ACCOUNT STATE */

  const [accountData, setAccountData] = useState(null);
  const [userDocument, setUserDocument] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* PROFILE STATE */

  const [profile, setProfile] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    zip: "",
    adminId: "",
    role: "Admin",
    department: "Administration",
    joiningDate: "",
    lastLogin: "",
    status: "Active",
  });

  /* PASSWORD STATE */

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  /* UI STATE */

  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  /* STATISTICS */

  const [statistics, setStatistics] = useState({
    products: 0,
    orders: 0,
    users: 0,
    reviews: 0,
  });

  /* PASSWORD STRENGTH */

  const passwordStrength = useMemo(() => {
    const password = passwords.newPassword;

    if (!password) {
      return {
        label: "Enter a password",
        width: "0%",
        className: "",
      };
    }

    let score = 0;

    if (password.length >= 8) {
      score++;
    }

    if (/[A-Z]/.test(password)) {
      score++;
    }

    if (/[0-9]/.test(password)) {
      score++;
    }

    if (/[^A-Za-z0-9]/.test(password)) {
      score++;
    }

    if (score <= 1) {
      return {
        label: "Weak password",
        width: "30%",
        className: "weak",
      };
    }

    if (score === 2) {
      return {
        label: "Medium password",
        width: "55%",
        className: "medium",
      };
    }

    if (score === 3) {
      return {
        label: "Good password",
        width: "75%",
        className: "good",
      };
    }

    return {
      label: "Strong password",
      width: "100%",
      className: "strong",
    };
  }, [passwords.newPassword]);

  /* LOAD CURRENT ADMIN */

  const loadCurrentAdmin = useCallback(async () => {
    try {
      const currentAccount = await account.get();

      setAccountData(currentAccount);

      let currentUserDocument = null;

      /*
       * First try to find the user's Appwrite document
       * using the logged-in account ID.
       */
      try {
        currentUserDocument = await databases.getDocument(
          DATABASE_ID,
          USERS_COLLECTION_ID,
          currentAccount.$id
        );
      } catch {
        /*
         * If the document ID is not the Appwrite account ID,
         * search the users collection using email.
         */
        try {
          const response = await databases.listDocuments(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            [
              Query.equal("email", currentAccount.email),
              Query.limit(1),
            ]
          );

          currentUserDocument =
            response.documents?.[0] || null;
        } catch (emailError) {
          console.warn(
            "Unable to find admin user document:",
            emailError
          );
        }
      }

      setUserDocument(currentUserDocument);

      const name = getDisplayName(
        currentAccount,
        currentUserDocument
      );

      const profileData = {
        fullName: name,

        username: getUsername(
          currentAccount,
          currentUserDocument,
          name
        ),

        email:
          currentAccount.email ||
          currentUserDocument?.email ||
          "",

        phone: getPhone(
          currentAccount,
          currentUserDocument
        ),

        address: getAddress(currentUserDocument),

        city: getCity(currentUserDocument),

        state: getState(currentUserDocument),

        country: getCountry(currentUserDocument),

        zip: getZip(currentUserDocument),

        adminId: currentAccount.$id || "",

        role: getRole(currentUserDocument),

        department:
          currentUserDocument?.department ||
          "Administration",

        joiningDate:
          currentAccount.$createdAt ||
          currentUserDocument?.$createdAt ||
          "",

        lastLogin:
          currentUserDocument?.lastLogin ||
          currentUserDocument?.lastLoginAt ||
          currentAccount.$updatedAt ||
          currentUserDocument?.$updatedAt ||
          "",

        status: getStatus(currentUserDocument),
      };

      setProfile(profileData);

      return {
        account: currentAccount,
        userDocument: currentUserDocument,
      };
    } catch (error) {
      console.error(
        "Load Admin Profile Error:",
        error
      );

      setAccountData(null);
      setUserDocument(null);

      if (
        error?.code === 401 ||
        error?.response?.code === 401
      ) {
        toast.error(
          "Admin session expired. Please login again."
        );
      } else {
        toast.error(
          error?.message ||
            "Unable to load admin profile."
        );
      }

      return null;
    }
  }, []);

  /* LOAD STATISTICS */

  const loadStatistics = useCallback(async () => {
    const results = {
      products: 0,
      orders: 0,
      users: 0,
      reviews: 0,
    };

    const loadCollectionCount = async (
      collectionId
    ) => {
      if (!collectionId) {
        return 0;
      }

      try {
        const response =
          await databases.listDocuments(
            DATABASE_ID,
            collectionId,
            [Query.limit(1)]
          );

        return Number(response.total || 0);
      } catch (error) {
        console.warn(
          `Unable to load collection ${collectionId}:`,
          error
        );

        return 0;
      }
    };

    const [
      products,
      orders,
      users,
      reviews,
    ] = await Promise.all([
      loadCollectionCount(
        PRODUCTS_COLLECTION_ID
      ),

      loadCollectionCount(
        ORDERS_COLLECTION_ID
      ),

      loadCollectionCount(
        USERS_COLLECTION_ID
      ),

      loadCollectionCount(
        REVIEWS_COLLECTION_ID
      ),
    ]);

    results.products = products;
    results.orders = orders;
    results.users = users;
    results.reviews = reviews;

    setStatistics(results);
  }, []);

  /* LOAD EVERYTHING */

  const loadProfile = useCallback(
    async (showRefreshLoader = false) => {
      try {
        if (showRefreshLoader) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        await Promise.all([
          loadCurrentAdmin(),
          loadStatistics(),
        ]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadCurrentAdmin, loadStatistics]
  );

  /* INITIAL LOAD */

  useEffect(() => {
    loadProfile(false);
  }, [loadProfile]);

  /* PROFILE CHANGE */

  const handleChange = (event) => {
    const { name, value } = event.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));

    setSaved(false);
  };

  /* PASSWORD CHANGE */

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;

    setPasswords((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /* SAVE PROFILE */

  const handleSaveProfile = async () => {
    if (!accountData?.$id) {
      toast.error(
        "Admin account is not available."
      );
      return;
    }

    const fullName = profile.fullName.trim();

    if (!fullName) {
      toast.error("Full name is required.");
      return;
    }

    try {
      setSaving(true);

      /*
       * Update Appwrite Account name.
       */
      await account.updateName(fullName);

      /*
       * Update the corresponding users collection
       * document when available.
       *
       * Only fields already used by the TechStore
       * users collection are sent here.
       */
      if (userDocument?.$id) {
        const updateData = {
          name: fullName,
          phone: profile.phone.trim(),
          city: profile.city.trim(),
        };

        await databases.updateDocument(
          DATABASE_ID,
          USERS_COLLECTION_ID,
          userDocument.$id,
          updateData
        );
      }

      /*
       * Reload everything directly from Appwrite.
       */
      await loadProfile(true);

      setIsEditing(false);
      setSaved(true);

      toast.success(
        "Profile updated successfully."
      );

      window.setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (error) {
      console.error(
        "Save Admin Profile Error:",
        error
      );

      toast.error(
        error?.message ||
          "Failed to update profile."
      );
    } finally {
      setSaving(false);
    }
  };

  /* UPDATE PASSWORD */

  const handleUpdatePassword = async () => {
    const currentPassword =
      passwords.currentPassword;

    const newPassword =
      passwords.newPassword;

    const confirmPassword =
      passwords.confirmPassword;

    if (!currentPassword) {
      toast.error(
        "Current password is required."
      );
      return;
    }

    if (!newPassword) {
      toast.error(
        "New password is required."
      );
      return;
    }

    if (newPassword.length < 8) {
      toast.error(
        "New password must contain at least 8 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(
        "New password and confirm password do not match."
      );
      return;
    }

    if (currentPassword === newPassword) {
      toast.error(
        "New password must be different from the current password."
      );
      return;
    }

    try {
      setChangingPassword(true);

      await account.updatePassword(
        newPassword,
        currentPassword
      );

      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setShowPassword(false);

      toast.success(
        "Password updated successfully."
      );
    } catch (error) {
      console.error(
        "Update Password Error:",
        error
      );

      toast.error(
        error?.message ||
          "Unable to update password. Check your current password."
      );
    } finally {
      setChangingPassword(false);
    }
  };

  /* LOGOUT */

  const handleLogout = async () => {
    try {
      await account.deleteSession("current");

      toast.success(
        "Logged out successfully."
      );

      /*
       * Do not use localStorage.
       * Your existing application routing/auth guard
       * should handle the logged-out state.
       */
      window.location.href = "/login";
    } catch (error) {
      console.error(
        "Admin Logout Error:",
        error
      );

      toast.error(
        error?.message ||
          "Unable to logout."
      );
    }
  };

  /* CANCEL EDIT */

  const handleCancelEdit = () => {
    if (!accountData) {
      return;
    }

    const name = getDisplayName(
      accountData,
      userDocument
    );

    setProfile({
      fullName: name,

      username: getUsername(
        accountData,
        userDocument,
        name
      ),

      email:
        accountData.email ||
        userDocument?.email ||
        "",

      phone: getPhone(
        accountData,
        userDocument
      ),

      address: getAddress(userDocument),

      city: getCity(userDocument),

      state: getState(userDocument),

      country: getCountry(userDocument),

      zip: getZip(userDocument),

      adminId: accountData.$id || "",

      role: getRole(userDocument),

      department:
        userDocument?.department ||
        "Administration",

      joiningDate:
        accountData.$createdAt ||
        userDocument?.$createdAt ||
        "",

      lastLogin:
        userDocument?.lastLogin ||
        userDocument?.lastLoginAt ||
        accountData.$updatedAt ||
        userDocument?.$updatedAt ||
        "",

      status: getStatus(userDocument),
    });

    setIsEditing(false);
    setSaved(false);
  };

  /* STATISTICS UI */

  const statisticsCards = [
    {
      icon: <FaBoxOpen />,
      value: statistics.products,
      label: "Products Added",
    },

    {
      icon: <FaShoppingCart />,
      value: statistics.orders,
      label: "Orders Managed",
    },

    {
      icon: <FaUsers />,
      value: statistics.users,
      label: "Users Managed",
    },

    {
      icon: <FaStar />,
      value: statistics.reviews,
      label: "Reviews",
    },
  ];

  /* ACTIVITY */

  const activities = useMemo(() => {
    const accountCreated =
      accountData?.$createdAt ||
      userDocument?.$createdAt;

    const accountUpdated =
      accountData?.$updatedAt ||
      userDocument?.$updatedAt;

    return [
      {
        icon: "bg-success",
        title: "Admin account verified from Appwrite",
        time: formatDateTime(accountUpdated),
      },

      {
        icon: "bg-primary",
        title: "Admin account created",
        time: formatDateTime(accountCreated),
      },

      {
        icon: "bg-info",
        title: "Profile data loaded from Appwrite",
        time: formatDateTime(
          accountUpdated || accountCreated
        ),
      },
    ];
  }, [accountData, userDocument]);

  /* LOADING */

  if (loading) {
    return (
      <div className="container-fluid profile-page py-4">
        <div
          className="d-flex justify-content-center align-items-center"
          style={{ minHeight: "60vh" }}
        >
          <div className="text-center">
            <div
              className="spinner-border text-primary"
              style={{
                width: "3rem",
                height: "3rem",
              }}
            />

            <h5 className="mt-3 fw-bold">
              Loading Admin Profile...
            </h5>

            <p className="text-muted mb-0">
              Fetching profile data from Appwrite
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* AVATAR INITIAL */

  const avatarInitial = getInitial(
    profile.fullName
  );

  /* RENDER */

  return (
    <div className="container-fluid profile-page py-4">

      {/* PAGE HEADER */}

      <div className="d-flex justify-content-between align-items-center flex-wrap mb-4">
        <div>
          <h2 className="profile-title">
            Admin Profile
          </h2>

          <p className="profile-page-subtitle mb-0">
            Manage your account information,
            security and activity.
          </p>
        </div>

        <div className="profile-header-actions">
          {!isEditing && (
            <button
              type="button"
              className="profile-btn profile-btn-primary"
              onClick={() =>
                setIsEditing(true)
              }
            >
              <FaUserEdit className="me-2" />
              Edit Profile
            </button>
          )}

          {isEditing && (
            <>
              <button
                type="button"
                className="profile-btn profile-btn-outline"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="profile-btn profile-btn-primary"
                onClick={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <FaSave className="me-2" />
                    Save Changes
                  </>
                )}
              </button>
            </>
          )}

          {!isEditing && (
            <button
              type="button"
              className="profile-btn profile-btn-outline ms-2"
              onClick={() =>
                loadProfile(true)
              }
              disabled={refreshing}
              title="Refresh Appwrite data"
            >
              <FaSyncAlt
                className={
                  refreshing
                    ? "fa-spin me-2"
                    : "me-2"
                }
              />

              Refresh
            </button>
          )}
        </div>
      </div>

      {/* SUCCESS MESSAGE */}

      {saved && (
        <div className="alert alert-success border-0 shadow-sm d-flex align-items-center rounded-4 mb-4">
          <FaCheckCircle className="me-2" />
          Profile information saved successfully.
        </div>
      )}

      {/* PROFILE HERO */}

      <div className="profile-hero p-4 p-lg-5">

        <div className="row align-items-center">

          {/* Avatar */}

          <div className="col-lg-2 text-center">
            <div className="profile-avatar-container">

              <div
                className="profile-image-wrapper d-flex align-items-center justify-content-center"
                style={{
                  overflow: "hidden",
                }}
              >
                <div
                  className="profile-admin-initial"
                  aria-label={`Admin ${avatarInitial}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "58px",
                    fontWeight: "800",
                    textTransform: "uppercase",
                    userSelect: "none",
                  }}
                >
                  {avatarInitial}
                </div>
              </div>

            </div>
          </div>

          {/* Profile Details */}

          <div className="col-lg-7 mt-4 mt-lg-0">
            <div className="profile-hero-content">

              <h3 className="profile-name">
                {profile.fullName ||
                  "Admin"}
              </h3>

              <div className="profile-username">
                @{profile.username ||
                  "admin"}
              </div>

              <span className="profile-role-badge">
                <FaUserShield className="me-2" />
                {profile.role}
              </span>

              <div className="profile-contact">

                <div className="profile-contact-item">
                  <FaEnvelope />
                  <span>
                    {profile.email ||
                      "No email available"}
                  </span>
                </div>

                <div className="profile-contact-item">
                  <FaPhoneAlt />
                  <span>
                    {profile.phone ||
                      "Phone not available"}
                  </span>
                </div>

                <div className="profile-contact-item">
                  <FaMapMarkerAlt />

                  <span>
                    {profile.city ||
                    profile.state
                      ? `${profile.city || ""}${
                          profile.city &&
                          profile.state
                            ? ", "
                            : ""
                        }${
                          profile.state || ""
                        }`
                      : "Location not available"}
                  </span>
                </div>

              </div>

            </div>
          </div>

          {/* Status */}

          <div className="col-lg-3 text-lg-end mt-4 mt-lg-0">
            <div className="d-flex flex-column align-items-lg-end gap-3">

              <div className="profile-status">
                <span className="profile-status-dot"></span>
                {profile.status ||
                  "Active"}
              </div>

              <div className="text-muted small">
                Appwrite Account
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* MAIN CONTENT */}

      <div className="row g-4 mt-1">

        {/* LEFT COLUMN */}

        <div className="col-lg-8">

          {/* PERSONAL INFORMATION */}

          <div className="profile-card mb-4">

            <div className="profile-card-header">
              <h4>
                <span className="profile-card-header-icon">
                  <FaUserEdit />
                </span>

                Personal Information
              </h4>

              {!isEditing && (
                <span className="text-muted small">
                  View Mode
                </span>
              )}

              {isEditing && (
                <span className="badge text-bg-primary">
                  Editing
                </span>
              )}
            </div>

            <div className="profile-form-body">

              <div className="row g-4">

                {/* Full Name */}

                <div className="col-md-6">
                  <label className="profile-form-label">
                    Full Name
                  </label>

                  <input
                    type="text"
                    className="profile-form-control"
                    name="fullName"
                    value={
                      profile.fullName
                    }
                    onChange={
                      handleChange
                    }
                    disabled={!isEditing}
                  />
                </div>

                {/* Username */}

                <div className="col-md-6">
                  <label className="profile-form-label">
                    Username
                  </label>

                  <input
                    type="text"
                    className="profile-form-control"
                    name="username"
                    value={
                      profile.username
                    }
                    disabled
                    readOnly
                  />
                </div>

                {/* Email */}

                <div className="col-md-6">
                  <label className="profile-form-label">
                    Email Address
                  </label>

                  <input
                    type="email"
                    className="profile-form-control"
                    name="email"
                    value={
                      profile.email
                    }
                    disabled
                    readOnly
                  />
                </div>

                {/* Phone */}

                <div className="col-md-6">
                  <label className="profile-form-label">
                    Phone Number
                  </label>

                  <input
                    type="text"
                    className="profile-form-control"
                    name="phone"
                    value={
                      profile.phone
                    }
                    onChange={
                      handleChange
                    }
                    disabled={!isEditing}
                  />
                </div>

                {/* Address */}

                <div className="col-12">
                  <label className="profile-form-label">
                    Address
                  </label>

                  <textarea
                    rows="3"
                    className="profile-form-control"
                    name="address"
                    value={
                      profile.address
                    }
                    disabled
                    readOnly
                  />
                </div>

                {/* City */}

                <div className="col-md-4">
                  <label className="profile-form-label">
                    City
                  </label>

                  <input
                    type="text"
                    className="profile-form-control"
                    name="city"
                    value={
                      profile.city
                    }
                    onChange={
                      handleChange
                    }
                    disabled={!isEditing}
                  />
                </div>

                {/* State */}

                <div className="col-md-4">
                  <label className="profile-form-label">
                    State
                  </label>

                  <input
                    type="text"
                    className="profile-form-control"
                    name="state"
                    value={
                      profile.state
                    }
                    disabled
                    readOnly
                  />
                </div>

                {/* Country */}

                <div className="col-md-4">
                  <label className="profile-form-label">
                    Country
                  </label>

                  <input
                    type="text"
                    className="profile-form-control"
                    name="country"
                    value={
                      profile.country
                    }
                    disabled
                    readOnly
                  />
                </div>

                {/* ZIP */}

                <div className="col-md-4">
                  <label className="profile-form-label">
                    ZIP Code
                  </label>

                  <input
                    type="text"
                    className="profile-form-control"
                    name="zip"
                    value={
                      profile.zip
                    }
                    disabled
                    readOnly
                  />
                </div>

              </div>

            </div>
          </div>

          {/* CHANGE PASSWORD */}

          <div className="profile-card mb-4">

            <div className="profile-card-header">

              <h4>
                <span className="profile-card-header-icon">
                  <FaLock />
                </span>

                Change Password
              </h4>

              <span className="text-muted small">
                Secure your account
              </span>

            </div>

            <div className="profile-form-body">

              <div className="row g-4">

                {/* Current Password */}

                <div className="col-md-4">

                  <label className="profile-form-label">
                    Current Password
                  </label>

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    className="profile-form-control"
                    name="currentPassword"
                    value={
                      passwords.currentPassword
                    }
                    onChange={
                      handlePasswordChange
                    }
                    placeholder="Current password"
                  />

                </div>

                {/* New Password */}

                <div className="col-md-4">

                  <label className="profile-form-label">
                    New Password
                  </label>

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    className="profile-form-control"
                    name="newPassword"
                    value={
                      passwords.newPassword
                    }
                    onChange={
                      handlePasswordChange
                    }
                    placeholder="New password"
                  />

                  <div className="password-strength">

                    <div className="password-strength-bar">

                      <div
                        className={`password-strength-fill ${passwordStrength.className}`}
                        style={{
                          width:
                            passwordStrength.width,
                        }}
                      />

                    </div>

                    <small className="text-muted">
                      {
                        passwordStrength.label
                      }
                    </small>

                  </div>

                </div>

                {/* Confirm Password */}

                <div className="col-md-4">

                  <label className="profile-form-label">
                    Confirm Password
                  </label>

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    className="profile-form-control"
                    name="confirmPassword"
                    value={
                      passwords.confirmPassword
                    }
                    onChange={
                      handlePasswordChange
                    }
                    placeholder="Confirm password"
                  />

                </div>

              </div>

              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mt-4">

                <label className="d-flex align-items-center gap-2 small text-muted">

                  <input
                    type="checkbox"
                    checked={
                      showPassword
                    }
                    onChange={(event) =>
                      setShowPassword(
                        event.target.checked
                      )
                    }
                  />

                  Show passwords

                </label>

                <button
                  type="button"
                  className="profile-btn profile-btn-primary"
                  onClick={
                    handleUpdatePassword
                  }
                  disabled={
                    changingPassword
                  }
                >

                  {changingPassword ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                      />

                      Updating...
                    </>
                  ) : (
                    <>
                      <FaLock className="me-2" />
                      Update Password
                    </>
                  )}

                </button>

              </div>

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}

        <div className="col-lg-4">

          {/* ACCOUNT INFORMATION */}

          <div className="profile-card mb-4">

            <div className="profile-card-header">

              <h4>
                <span className="profile-card-header-icon">
                  <FaIdBadge />
                </span>

                Account Information
              </h4>

            </div>

            <div className="info-list">

              <div className="info-item">

                <span className="info-label">
                  Admin ID
                </span>

                <strong
                  className="info-value"
                  style={{
                    wordBreak:
                      "break-all",
                  }}
                >
                  {profile.adminId ||
                    "Not available"}
                </strong>

              </div>

              <div className="info-item">

                <span className="info-label">
                  Role
                </span>

                <strong className="info-value">
                  {profile.role}
                </strong>

              </div>

              <div className="info-item">

                <span className="info-label">
                  Department
                </span>

                <strong className="info-value">
                  {profile.department}
                </strong>

              </div>

              <div className="info-item">

                <span className="info-label">
                  Joining Date
                </span>

                <strong className="info-value info-value-with-icon">
                  <FaCalendarAlt />
                  {formatDate(
                    profile.joiningDate
                  )}
                </strong>

              </div>

              <div className="info-item">

                <span className="info-label">
                  Last Updated
                </span>

                <strong className="info-value">
                  {formatDateTime(
                    profile.lastLogin
                  )}
                </strong>

              </div>

              <div className="info-item">

                <span className="info-label">
                  Status
                </span>

                <span className="profile-status">
                  <span className="profile-status-dot"></span>
                  {profile.status}
                </span>

              </div>

            </div>
          </div>

          {/* STATISTICS */}

          <div className="profile-card mb-4">

            <div className="profile-card-header">

              <h4>
                <span className="profile-card-header-icon">
                  <FaUserShield />
                </span>

                Statistics
              </h4>

            </div>

            <div className="profile-stats-grid">

              {statisticsCards.map(
                (stat) => (
                  <div
                    className="stats-box"
                    key={stat.label}
                  >

                    <div className="stats-icon">
                      {stat.icon}
                    </div>

                    <h3>
                      {formatCount(
                        stat.value
                      )}
                    </h3>

                    <p>
                      {stat.label}
                    </p>

                  </div>
                )
              )}

            </div>
          </div>

          {/* SECURITY SUMMARY */}

          <div className="profile-card">

            <div className="profile-card-header">

              <h4>
                <span className="profile-card-header-icon">
                  <FaClipboardCheck />
                </span>

                Security
              </h4>

            </div>

            <div className="info-list">

              <div className="info-item">

                <span className="info-label">
                  Password
                </span>

                <strong className="info-value">
                  Protected
                </strong>

              </div>

              <div className="info-item">

                <span className="info-label">
                  Account Status
                </span>

                <strong className="info-value">
                  {profile.status}
                </strong>

              </div>

              <div className="info-item">

                <span className="info-label">
                  Session
                </span>

                <strong className="info-value">
                  Appwrite Secure Session
                </strong>

              </div>

            </div>
          </div>

        </div>

      </div>

      {/* RECENT ACTIVITY */}

      <div className="profile-card mt-4">

        <div className="profile-card-header">

          <h4>
            <span className="profile-card-header-icon">
              <FaClipboardCheck />
            </span>

            Account Activity
          </h4>

          <span className="text-muted small">
            Appwrite account activity
          </span>

        </div>

        <ul className="activity-list">

          {activities.map(
            (activity, index) => (
              <li
                className="activity-item"
                key={`${activity.title}-${index}`}
              >

                <span
                  className={`activity-dot ${activity.icon}`}
                />

                <div className="activity-content">

                  <p className="activity-title">
                    {activity.title}
                  </p>

                  <span className="activity-time">
                    {activity.time}
                  </span>

                </div>

              </li>
            )
          )}

        </ul>

      </div>

      {/* QUICK ACTIONS */}

      <div className="profile-card mt-4 mb-4">

        <div className="profile-card-header">

          <h4>
            <span className="profile-card-header-icon">
              <FaEdit />
            </span>

            Quick Actions
          </h4>

        </div>

        <div className="quick-actions">

          <button
            type="button"
            className="quick-action"
            onClick={() =>
              setIsEditing(true)
            }
          >
            <FaEdit />
            <span>
              Edit Profile
            </span>
          </button>

          <button
            type="button"
            className="quick-action"
            onClick={() =>
              loadProfile(true)
            }
            disabled={refreshing}
          >
            <FaSyncAlt
              className={
                refreshing
                  ? "fa-spin"
                  : ""
              }
            />
            <span>
              Refresh Data
            </span>
          </button>

          <button
            type="button"
            className="quick-action"
            onClick={() => {
              const element =
                document.querySelector(
                  '[name="currentPassword"]'
                );

              element?.focus();
            }}
          >
            <FaLock />
            <span>
              Change Password
            </span>
          </button>

          <button
            type="button"
            className="quick-action"
            onClick={handleLogout}
          >
            <FaSignOutAlt />
            <span>
              Logout
            </span>
          </button>

        </div>

      </div>

    </div>
  );
}

export default Profile;