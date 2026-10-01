import { useCallback, useEffect, useMemo, useState } from "react";
import AdminCustomSelect from "../../components/AdminCustomSelect";
import {
  FaUsers,
  FaUserCheck,
  FaUserShield,
  FaSearch,
  FaPlus,
  FaDownload,
  FaBell,
  FaCog,
  FaTrash,
  FaEye,
  FaEdit,
  FaSyncAlt,
  FaTimes,
  FaTruck,
} from "react-icons/fa";
import { ID, Query } from "appwrite";
import { toast } from "react-hot-toast";

import { databases } from "../../appwrite/config";
import "../../css/Users.css";

/* APPWRITE CONFIG */

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;

const USERS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_USERS_COLLECTION_ID || "users";

const ORDERS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_ORDERS_COLLECTION_ID || "orders";

/* ROLE CONFIG — IMPORTANT: — These values MUST match Appwrite exactly. */

const ROLE_OPTIONS = [
  {
    value: "customer",
    label: "Customer",
  },
  {
    value: "deliveryBoy",
    label: "Delivery Boy",
  },
  {
    value: "admin",
    label: "Admin",
  },
];

/* HELPERS */

const getRoleLabel = (role) => {
  if (role === "deliveryBoy") {
    return "Delivery Boy";
  }

  if (role === "admin") {
    return "Admin";
  }

  return "Customer";
};

const getRoleBadgeClass = (role) => {
  if (role === "admin") {
    return "bg-danger";
  }

  if (role === "deliveryBoy") {
    return "bg-warning text-dark";
  }

  return "bg-primary";
};

const getUserName = (user) =>
  user?.name ||
  user?.fullName ||
  user?.username ||
  user?.email?.split("@")?.[0] ||
  "Unknown User";

const getUserEmail = (user) =>
  user?.email ||
  user?.emailAddress ||
  "No email";

const getUserPhone = (user) =>
  user?.phone ||
  user?.phoneNumber ||
  "Not available";

/* NORMALIZE ROLE FROM APPWRITE */

const getUserRole = (user) => {
  const role = user?.role;

  if (role === "admin") {
    return "admin";
  }

  if (role === "deliveryBoy") {
    return "deliveryBoy";
  }

  return "customer";
};

const getUserStatus = (user) =>
  user?.status || "Active";

const getUserInitial = (user) => {
  const name = getUserName(user);

  if (!name) {
    return "U";
  }

  return name.trim().charAt(0).toUpperCase();
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);

  return `₹${amount.toLocaleString("en-IN")}`;
};

const formatDate = (date) => {
  if (!date) {
    return "Never";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
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
    return "Unknown";
  }

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* EMPTY FORM — Only existing Appwrite attributes. */

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  role: "customer",
  status: "Active",
};

/* USERS COMPONENT */

function Users() {
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Newest");

  const [currentPage, setCurrentPage] = useState(1);

  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState(EMPTY_FORM);

  const usersPerPage = 8;

  /* FETCH USERS + ORDERS */

  const fetchData = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const [usersResponse, ordersResponse] =
          await Promise.all([
            databases.listDocuments(
              DATABASE_ID,
              USERS_COLLECTION_ID,
              [
                Query.limit(100),
                Query.orderDesc("$createdAt"),
              ]
            ),

            databases.listDocuments(
              DATABASE_ID,
              ORDERS_COLLECTION_ID,
              [
                Query.limit(100),
                Query.orderDesc("$createdAt"),
              ]
            ),
          ]);

        setUsers(usersResponse?.documents || []);
        setOrders(ordersResponse?.documents || []);
      } catch (error) {
        console.error(
          "Users Appwrite Error:",
          error
        );

        toast.error(
          error?.message ||
            "Failed to load users from Appwrite."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  /* INITIAL LOAD */

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  /* NORMALIZE USERS */

  const normalizedUsers = useMemo(() => {
    return users.map((user) => {
      const userOrders = orders.filter(
        (order) =>
          String(order?.userId || "") ===
          String(user.$id)
      );

      const spending = userOrders.reduce(
        (total, order) => {
          const amount =
            order?.grandTotal ??
            order?.totalAmount ??
            order?.total ??
            order?.amount ??
            0;

          return total + Number(amount || 0);
        },
        0
      );

      const role = getUserRole(user);

      return {
        ...user,

        id: user.$id,

        name: getUserName(user),

        email: getUserEmail(user),

        phone: getUserPhone(user),

        role,

        roleLabel: getRoleLabel(role),

        status: getUserStatus(user),

        initial: getUserInitial(user),

        orders: userOrders.length,

        spending,

        createdAt: user.$createdAt,

        updatedAt: user.$updatedAt,

        lastLogin:
          user?.lastLogin ||
          user?.lastLoginAt ||
          user?.$updatedAt ||
          user?.$createdAt,
      };
    });
  }, [users, orders]);

  /* FILTER USERS */

  const filteredUsers = useMemo(() => {
    let data = [...normalizedUsers];

    const keyword = search.trim().toLowerCase();

    if (keyword) {
      data = data.filter((user) => {
        return (
          user.name
            .toLowerCase()
            .includes(keyword) ||
          user.email
            .toLowerCase()
            .includes(keyword) ||
          user.phone
            .toLowerCase()
            .includes(keyword) ||
          user.roleLabel
            .toLowerCase()
            .includes(keyword)
        );
      });
    }

    if (statusFilter !== "All") {
      data = data.filter(
        (user) =>
          user.status === statusFilter
      );
    }

    if (roleFilter !== "All") {
      data = data.filter(
        (user) =>
          user.role === roleFilter
      );
    }

    if (sortBy === "Name") {
      data.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    }

    if (sortBy === "Orders") {
      data.sort(
        (a, b) =>
          b.orders - a.orders
      );
    }

    if (sortBy === "Spending") {
      data.sort(
        (a, b) =>
          b.spending - a.spending
      );
    }

    if (sortBy === "Newest") {
      data.sort(
        (a, b) =>
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
      );
    }

    return data;
  }, [
    normalizedUsers,
    search,
    statusFilter,
    roleFilter,
    sortBy,
  ]);

  /* STATS */

  const totalUsers = normalizedUsers.length;

  const activeUsers =
    normalizedUsers.filter(
      (user) =>
        user.status === "Active"
    ).length;

  const adminUsers =
    normalizedUsers.filter(
      (user) =>
        user.role === "admin"
    ).length;

  const deliveryBoyUsers =
    normalizedUsers.filter(
      (user) =>
        user.role === "deliveryBoy"
    ).length;

  const totalOrders =
    normalizedUsers.reduce(
      (total, user) =>
        total + user.orders,
      0
    );

  const totalRevenue =
    normalizedUsers.reduce(
      (total, user) =>
        total + user.spending,
      0
    );

  /* PAGINATION */

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredUsers.length /
        usersPerPage
    )
  );

  const indexOfLastUser =
    currentPage * usersPerPage;

  const indexOfFirstUser =
    indexOfLastUser - usersPerPage;

  const currentUsers =
    filteredUsers.slice(
      indexOfFirstUser,
      indexOfLastUser
    );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /* FORM CHANGE */

  const handleInputChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /* RESET FORM */

  const resetForm = () => {
    setFormData({
      ...EMPTY_FORM,
    });
  };

  /* ADD USER */

  const openAddUser = () => {
    setSelectedUser(null);
    setEditingUser(null);
    resetForm();
    setShowAddModal(true);
  };

  /* EDIT USER */

  const openEditUser = (user) => {
    setSelectedUser(null);
    setEditingUser(user);

    setFormData({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",

      role:
        user?.role === "admin"
          ? "admin"
          : user?.role === "deliveryBoy"
          ? "deliveryBoy"
          : "customer",

      status:
        user?.status || "Active",
    });
  };

  /* CLOSE USER MODAL */

  const closeUserModal = () => {
    if (saving) {
      return;
    }

    setShowAddModal(false);
    setEditingUser(null);
    resetForm();
  };

  /* VALIDATE FORM */

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required.");
      return false;
    }

    if (!formData.email.trim()) {
      toast.error("Email is required.");
      return false;
    }

    const validRole = ROLE_OPTIONS.some(
      (role) =>
        role.value === formData.role
    );

    if (!validRole) {
      toast.error(
        "Please select a valid role."
      );
      return false;
    }

    return true;
  };

  /* CREATE USER DOCUMENT — Appwrite payload: — customer — deliveryBoy — admin — NO city — NO verified */

  const handleAddUser = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      await databases.createDocument(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        ID.unique(),
        {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          role: formData.role,
          status: formData.status,
        }
      );

      toast.success(
        "User created successfully."
      );

      closeUserModal();

      await fetchData(true);
    } catch (error) {
      console.error(
        "Create User Error:",
        error
      );

      toast.error(
        error?.message ||
          "Failed to create user in Appwrite."
      );
    } finally {
      setSaving(false);
    }
  };

  /* UPDATE USER — Appwrite payload: — customer — deliveryBoy — admin — NO city — NO verified */

  const handleUpdateUser = async () => {
    if (!editingUser?.$id) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      await databases.updateDocument(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        editingUser.$id,
        {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          role: formData.role,
          status: formData.status,
        }
      );

      toast.success(
        `${getRoleLabel(
          formData.role
        )} role updated successfully.`
      );

      closeUserModal();

      await fetchData(true);
    } catch (error) {
      console.error(
        "Update User Error:",
        error
      );

      toast.error(
        error?.message ||
          "Failed to update user in Appwrite."
      );
    } finally {
      setSaving(false);
    }
  };

  /* DELETE USER */

  const openDeleteUser = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (deleting) {
      return;
    }

    setSelectedUser(null);
    setShowDeleteModal(false);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser?.$id) {
      return;
    }

    try {
      setDeleting(true);

      await databases.deleteDocument(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        selectedUser.$id
      );

      toast.success(
        "User deleted successfully."
      );

      closeDeleteModal();

      await fetchData(true);
    } catch (error) {
      console.error(
        "Delete User Error:",
        error
      );

      toast.error(
        error?.message ||
          "Failed to delete user."
      );
    } finally {
      setDeleting(false);
    }
  };

  /* EXPORT CSV */

  const handleExport = () => {
    if (!filteredUsers.length) {
      toast.error(
        "No users available to export."
      );
      return;
    }

    const headers = [
      "Name",
      "Email",
      "Phone",
      "Role",
      "Status",
      "Orders",
      "Spending",
      "Created At",
    ];

    const rows = filteredUsers.map(
      (user) => [
        user.name,
        user.email,
        user.phone,
        user.roleLabel,
        user.status,
        user.orders,
        user.spending,
        user.createdAt || "",
      ]
    );

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => {
            const text = String(
              value ?? ""
            );

            return `"${text.replaceAll(
              '"',
              '""'
            )}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `techstore-users-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    toast.success(
      "Users exported successfully."
    );
  };

  /* LOADING */

  if (loading) {
    return (
      <div className="users-page">
        <div
          className="d-flex justify-content-center align-items-center"
          style={{
            minHeight: "60vh",
          }}
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
              Loading Users...
            </h5>

            <p className="text-muted">
              Fetching users from Appwrite
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* UI */

  return (
    <div className="users-page">

      {/* HEADER */}

      <div className="users-topbar">
        <div>
          <h2>
            Users Management
          </h2>

          <p>
            Manage customers, delivery
            boys and administrators.
          </p>
        </div>

        <div className="topbar-right">

          <button
            className="icon-btn"
            type="button"
            title="Notifications"
          >
            <FaBell />
          </button>

          <button
            className="icon-btn"
            type="button"
            title="Settings"
          >
            <FaCog />
          </button>

          <button
            className="btn btn-outline-primary"
            type="button"
            onClick={() =>
              fetchData(true)
            }
            disabled={refreshing}
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

          <button
            className="btn btn-success"
            type="button"
            onClick={openAddUser}
          >
            <FaPlus className="me-2" />

            Add User
          </button>

        </div>
      </div>

      {/* STATS */}

      <div className="row g-4 mb-4">

        <div className="col-xl-3 col-md-6">
          <div className="dashboard-card primary-card">

            <div className="card-icon">
              <FaUsers />
            </div>

            <div className="card-info">
              <h6>Total Users</h6>
              <h2>{totalUsers}</h2>

              <span className="growth up">
                Live Appwrite Data
              </span>
            </div>

          </div>
        </div>

        <div className="col-xl-3 col-md-6">
          <div className="dashboard-card success-card">

            <div className="card-icon">
              <FaUserCheck />
            </div>

            <div className="card-info">
              <h6>Active Users</h6>
              <h2>{activeUsers}</h2>

              <span className="growth up">
                Active Accounts
              </span>
            </div>

          </div>
        </div>

        <div className="col-xl-3 col-md-6">
          <div className="dashboard-card warning-card">

            <div className="card-icon">
              <FaTruck />
            </div>

            <div className="card-info">
              <h6>Delivery Boys</h6>
              <h2>{deliveryBoyUsers}</h2>

              <span className="growth">
                Delivery Accounts
              </span>
            </div>

          </div>
        </div>

        <div className="col-xl-3 col-md-6">
          <div className="dashboard-card danger-card">

            <div className="card-icon">
              <FaUserShield />
            </div>

            <div className="card-info">
              <h6>Administrators</h6>
              <h2>{adminUsers}</h2>

              <span className="growth">
                Admin Accounts
              </span>
            </div>

          </div>
        </div>

      </div>

      {/* ANALYTICS */}

      <div className="row g-4 mb-4">

        <div className="col-lg-8">
          <div className="analytics-panel">

            <div className="d-flex justify-content-between align-items-center mb-4">

              <div>
                <h4 className="fw-bold mb-1">
                  User Analytics
                </h4>

                <p className="text-muted mb-0">
                  Live statistics from Appwrite
                </p>
              </div>

              <button
                className="btn btn-outline-primary"
                type="button"
                onClick={handleExport}
              >
                <FaDownload className="me-2" />
                Export
              </button>

            </div>

            <div className="row text-center">

              <div className="col-md-4">
                <div className="mini-stat">

                  <h3>
                    {formatCurrency(
                      totalRevenue
                    )}
                  </h3>

                  <p>Total Spending</p>

                </div>
              </div>

              <div className="col-md-4">
                <div className="mini-stat">

                  <h3>
                    {totalOrders}
                  </h3>

                  <p>Total Orders</p>

                </div>
              </div>

              <div className="col-md-4">
                <div className="mini-stat">

                  <h3>
                    {activeUsers > 0
                      ? `${Math.round(
                          (activeUsers /
                            Math.max(
                              totalUsers,
                              1
                            )) *
                            100
                        )}%`
                      : "0%"}
                  </h3>

                  <p>Active Rate</p>

                </div>
              </div>

            </div>

          </div>
        </div>

        <div className="col-lg-4">
          <div className="welcome-box">

            <h4 className="mb-3">
              Manage Your Team 👋
            </h4>

            <p>
              Customer, Delivery Boy અને
              Admin roles હવે અહીંથી જ
              manage કરી શકો છો.
            </p>

            <button
              className="btn btn-light mt-3"
              type="button"
              onClick={() =>
                fetchData(true)
              }
            >
              <FaSyncAlt className="me-2" />
              Refresh Data
            </button>

          </div>
        </div>

      </div>

      {/* FILTERS */}

      <div className="card border-0 shadow-sm rounded-4 mb-4">

        <div className="card-body">

          <div className="row g-3 align-items-center">

            <div className="col-lg-4">

              <div className="input-group">

                <span className="input-group-text bg-white border-end-0">
                  <FaSearch />
                </span>

                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search name, email, phone, role..."
                  value={search}
                  onChange={(event) => {
                    setSearch(
                      event.target.value
                    );
                    setCurrentPage(1);
                  }}
                />

                {search && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setSearch("");
                      setCurrentPage(1);
                    }}
                  >
                    <FaTimes />
                  </button>
                )}

              </div>

            </div>

            <div className="col-lg-2">

              <AdminCustomSelect
                className="form-select"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(
                    event.target.value
                  );
                  setCurrentPage(1);
                }}
              >
                <option value="All">
                  All Status
                </option>

                <option value="Active">
                  Active
                </option>

                <option value="Blocked">
                  Blocked
                </option>

                <option value="Pending">
                  Pending
                </option>
              </AdminCustomSelect>

            </div>

            <div className="col-lg-2">

              <AdminCustomSelect
                className="form-select"
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(
                    event.target.value
                  );
                  setCurrentPage(1);
                }}
              >
                <option value="All">
                  All Roles
                </option>

                <option value="customer">
                  Customer
                </option>

                <option value="deliveryBoy">
                  Delivery Boy
                </option>

                <option value="admin">
                  Admin
                </option>
              </AdminCustomSelect>

            </div>

            <div className="col-lg-2">

              <AdminCustomSelect
                className="form-select"
                value={sortBy}
                onChange={(event) =>
                  setSortBy(
                    event.target.value
                  )
                }
              >
                <option value="Newest">
                  Newest
                </option>

                <option value="Name">
                  Name
                </option>

                <option value="Orders">
                  Orders
                </option>

                <option value="Spending">
                  Spending
                </option>
              </AdminCustomSelect>

            </div>

            <div className="col-lg-2">

              <button
                className="btn btn-primary w-100"
                type="button"
                onClick={handleExport}
              >
                <FaDownload className="me-2" />
                Export
              </button>

            </div>

          </div>

        </div>

      </div>

      {/* USERS TABLE */}

      <div className="card border-0 shadow-sm rounded-4">

        <div className="card-header bg-white border-0 py-3">

          <div className="d-flex justify-content-between align-items-center">

            <div>

              <h4 className="fw-bold mb-1">
                All Users
              </h4>

              <small className="text-muted">
                Showing{" "}
                {currentUsers.length}{" "}
                of{" "}
                {filteredUsers.length}{" "}
                users
              </small>

            </div>

            <span className="badge bg-primary px-3 py-2 fs-6">
              {totalUsers} Users
            </span>

          </div>

        </div>

        <div className="table-responsive">

          <table className="table align-middle table-hover mb-0">

            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Orders</th>
                <th>Spending</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>

              {currentUsers.map((user) => (
                <tr key={user.$id}>

                  {/* USER */}

                  <td>

                    <div className="d-flex align-items-center">

                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                        style={{
                          width: "55px",
                          height: "55px",
                          fontSize: "20px",
                          fontWeight: "800",
                          background:
                            "linear-gradient(135deg,#2563eb,#7c3aed)",
                          color: "#ffffff",
                        }}
                      >
                        {user.initial}
                      </div>

                      <div className="ms-3">

                        <h6 className="fw-bold mb-0">
                          {user.name}
                        </h6>

                        <small className="text-muted">
                          {user.email}
                        </small>

                        <br />

                        <small className="text-secondary">
                          {user.phone}
                        </small>

                      </div>

                    </div>

                  </td>

                  {/* ROLE */}

                  <td>

                    <span
                      className={`badge px-3 py-2 ${getRoleBadgeClass(
                        user.role
                      )}`}
                    >

                      {user.role ===
                      "deliveryBoy" ? (
                        <FaTruck className="me-1" />
                      ) : user.role ===
                        "admin" ? (
                        <FaUserShield className="me-1" />
                      ) : (
                        <FaUsers className="me-1" />
                      )}

                      {user.roleLabel}

                    </span>

                  </td>

                  {/* STATUS */}

                  <td>

                    <span
                      className={`badge px-3 py-2 ${
                        user.status === "Active"
                          ? "bg-success"
                          : user.status === "Blocked"
                          ? "bg-danger"
                          : "bg-warning text-dark"
                      }`}
                    >
                      {user.status}
                    </span>

                  </td>

                  {/* ORDERS */}

                  <td>
                    <strong>
                      {user.orders}
                    </strong>
                  </td>

                  {/* SPENDING */}

                  <td>

                    <span className="fw-bold text-success">
                      {formatCurrency(
                        user.spending
                      )}
                    </span>

                  </td>

                  {/* UPDATED */}

                  <td>

                    <small className="text-muted">
                      {formatDateTime(
                        user.updatedAt
                      )}
                    </small>

                  </td>

                  {/* ACTION */}

                  <td>

                    <div className="d-flex gap-2">

                      <button
                        className="btn btn-sm btn-primary"
                        type="button"
                        title="View User"
                        onClick={() =>
                          setSelectedUser(user)
                        }
                      >
                        <FaEye />
                      </button>

                      <button
                        className="btn btn-sm btn-warning text-white"
                        type="button"
                        title="Edit User"
                        onClick={() =>
                          openEditUser(user)
                        }
                      >
                        <FaEdit />
                      </button>

                      <button
                        className="btn btn-sm btn-danger"
                        type="button"
                        title="Delete User"
                        onClick={() =>
                          openDeleteUser(user)
                        }
                      >
                        <FaTrash />
                      </button>

                    </div>

                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>

        {/* EMPTY */}

        {currentUsers.length === 0 && (
          <div className="text-center py-5">

            <FaUsers
              size={45}
              className="text-muted mb-3"
            />

            <h5 className="fw-bold">
              No Users Found
            </h5>

            <p className="text-muted">
              Try changing your search
              or filters.
            </p>

          </div>
        )}

      </div>

      {/* PAGINATION */}

      {filteredUsers.length > 0 && (
        <div className="d-flex justify-content-between align-items-center mt-4 flex-wrap gap-3">

          <p className="text-muted mb-0">

            Showing{" "}

            <strong>
              {indexOfFirstUser + 1}
            </strong>{" "}

            to{" "}

            <strong>
              {Math.min(
                indexOfLastUser,
                filteredUsers.length
              )}
            </strong>{" "}

            of{" "}

            <strong>
              {filteredUsers.length}
            </strong>

          </p>

          <div className="d-flex gap-2">

            <button
              className="btn btn-outline-primary"
              type="button"
              disabled={currentPage === 1}
              onClick={() =>
                setCurrentPage((page) =>
                  Math.max(1, page - 1)
                )
              }
            >
              Previous
            </button>

            <span className="btn btn-primary">
              {currentPage} / {totalPages}
            </span>

            <button
              className="btn btn-outline-primary"
              type="button"
              disabled={
                currentPage === totalPages
              }
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(
                    totalPages,
                    page + 1
                  )
                )
              }
            >
              Next
            </button>

          </div>

        </div>
      )}

      {/* VIEW USER MODAL */}

      {selectedUser &&
        !showDeleteModal && (
          <div
            className="modal fade show d-block"
            style={{
              background: "rgba(0,0,0,.55)",
              backdropFilter: "blur(4px)",
            }}
          >

            <div className="modal-dialog modal-lg modal-dialog-centered">

              <div className="modal-content border-0 rounded-4 shadow-lg">

                <div className="modal-header bg-primary text-white">

                  <h4 className="modal-title">
                    User Profile
                  </h4>

                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() =>
                      setSelectedUser(null)
                    }
                  />

                </div>

                <div className="modal-body">

                  <div className="text-center mb-4">

                    <div
                      className="mx-auto rounded-circle d-flex align-items-center justify-content-center shadow"
                      style={{
                        width: "120px",
                        height: "120px",
                        fontSize: "46px",
                        fontWeight: "800",
                        color: "#ffffff",
                        background:
                          "linear-gradient(135deg,#2563eb,#7c3aed)",
                      }}
                    >
                      {selectedUser.initial}
                    </div>

                    <h3 className="mt-3 fw-bold">
                      {selectedUser.name}
                    </h3>

                    <p className="text-muted mb-2">
                      {selectedUser.email}
                    </p>

                    <span
                      className={`badge px-3 py-2 ${getRoleBadgeClass(
                        selectedUser.role
                      )}`}
                    >
                      {selectedUser.roleLabel}
                    </span>

                  </div>

                  <div className="row g-3">

                    <div className="col-md-6">
                      <div className="profile-box">
                        <h6>Phone</h6>
                        <p>
                          {selectedUser.phone}
                        </p>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="profile-box">
                        <h6>Role</h6>
                        <p>
                          {selectedUser.roleLabel}
                        </p>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="profile-box">
                        <h6>Status</h6>
                        <p>
                          {selectedUser.status}
                        </p>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="profile-box">
                        <h6>Orders</h6>
                        <p>
                          {selectedUser.orders}
                        </p>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="profile-box">
                        <h6>Total Spending</h6>

                        <p className="text-success fw-bold">
                          {formatCurrency(
                            selectedUser.spending
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="profile-box">
                        <h6>Joined</h6>

                        <p>
                          {formatDate(
                            selectedUser.createdAt
                          )}
                        </p>
                      </div>
                    </div>

                  </div>

                </div>

                <div className="modal-footer">

                  <button
                    type="button"
                    className="btn btn-warning text-white"
                    onClick={() =>
                      openEditUser(
                        selectedUser
                      )
                    }
                  >
                    <FaEdit className="me-2" />
                    Edit User
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      setSelectedUser(null)
                    }
                  >
                    Close
                  </button>

                </div>

              </div>

            </div>

          </div>
        )}

      {/* ADD / EDIT MODAL */}

      {(showAddModal || editingUser) && (
        <div
          className="modal fade show d-block"
          style={{
            background: "rgba(0,0,0,.55)",
            backdropFilter: "blur(4px)",
          }}
        >

          <div className="modal-dialog modal-lg modal-dialog-centered">

            <div className="modal-content border-0 rounded-4 shadow-lg">

              <div className="modal-header">

                <div>

                  <h4 className="fw-bold mb-1">
                    {editingUser
                      ? "Edit User"
                      : "Add New User"}
                  </h4>

                  <small className="text-muted">
                    {editingUser
                      ? "Update user information and role."
                      : "Create a new user record."}
                  </small>

                </div>

                <button
                  type="button"
                  className="btn-close"
                  onClick={closeUserModal}
                  disabled={saving}
                />

              </div>

              <div className="modal-body">

                <div className="row g-3">

                  {/* NAME */}

                  <div className="col-md-6">

                    <label className="form-label fw-semibold">
                      Full Name
                    </label>

                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      placeholder="Enter full name"
                      value={formData.name}
                      onChange={handleInputChange}
                      disabled={saving}
                    />

                  </div>

                  {/* EMAIL */}

                  <div className="col-md-6">

                    <label className="form-label fw-semibold">
                      Email
                    </label>

                    <input
                      type="email"
                      name="email"
                      className="form-control"
                      placeholder="Enter email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={saving}
                    />

                  </div>

                  {/* PHONE */}

                  <div className="col-md-6">

                    <label className="form-label fw-semibold">
                      Phone
                    </label>

                    <input
                      type="text"
                      name="phone"
                      className="form-control"
                      placeholder="Enter phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      disabled={saving}
                    />

                  </div>

                  {/* ROLE */}

                  <div className="col-md-6">

                    <label className="form-label fw-semibold">

                      Role

                      <span className="text-danger">
                        {" "}*
                      </span>

                    </label>

                    <AdminCustomSelect
                      name="role"
                      className="form-select"
                      value={formData.role}
                      onChange={handleInputChange}
                      disabled={saving}
                    >

                      {ROLE_OPTIONS.map(
                        (role) => (
                          <option
                            key={role.value}
                            value={role.value}
                          >
                            {role.label}
                          </option>
                        )
                      )}

                    </AdminCustomSelect>

                    <small className="text-muted">
                      Appwrite values:{" "}
                      <strong>
                        customer
                      </strong>
                      {" / "}
                      <strong>
                        deliveryBoy
                      </strong>
                      {" / "}
                      <strong>
                        admin
                      </strong>
                    </small>

                  </div>

                  {/* STATUS */}

                  <div className="col-md-6">

                    <label className="form-label fw-semibold">
                      Status
                    </label>

                    <AdminCustomSelect
                      name="status"
                      className="form-select"
                      value={formData.status}
                      onChange={handleInputChange}
                      disabled={saving}
                    >

                      <option value="Active">
                        Active
                      </option>

                      <option value="Blocked">
                        Blocked
                      </option>

                      <option value="Pending">
                        Pending
                      </option>

                    </AdminCustomSelect>

                  </div>

                </div>

              </div>

              <div className="modal-footer">

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeUserModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-success"
                  onClick={
                    editingUser
                      ? handleUpdateUser
                      : handleAddUser
                  }
                  disabled={saving}
                >

                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Saving...
                    </>
                  ) : (
                    editingUser
                      ? "Update User"
                      : "Create User"
                  )}

                </button>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* DELETE MODAL */}

      {showDeleteModal &&
        selectedUser && (
          <div
            className="modal fade show d-block"
            style={{
              background: "rgba(0,0,0,.6)",
              backdropFilter: "blur(5px)",
            }}
          >

            <div className="modal-dialog modal-dialog-centered">

              <div className="modal-content border-0 rounded-4 shadow-lg">

                <div className="modal-body text-center p-5">

                  <div
                    className="mx-auto mb-4 d-flex justify-content-center align-items-center bg-danger text-white rounded-circle"
                    style={{
                      width: "90px",
                      height: "90px",
                      fontSize: "35px",
                    }}
                  >
                    <FaTrash />
                  </div>

                  <h3 className="fw-bold">
                    Delete User?
                  </h3>

                  <p className="text-muted">

                    Are you sure you want to
                    delete

                    <br />

                    <strong>
                      {selectedUser.name}
                    </strong>

                    ?

                    <br />

                    This will delete the user
                    document from Appwrite.

                  </p>

                  <div className="d-flex justify-content-center gap-3 mt-4">

                    <button
                      type="button"
                      className="btn btn-secondary px-4"
                      onClick={closeDeleteModal}
                      disabled={deleting}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className="btn btn-danger px-4"
                      onClick={handleDeleteUser}
                      disabled={deleting}
                    >

                      {deleting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <FaTrash className="me-2" />
                          Delete
                        </>
                      )}

                    </button>

                  </div>

                </div>

              </div>

            </div>

          </div>
        )}

    </div>
  );
}

export default Users;