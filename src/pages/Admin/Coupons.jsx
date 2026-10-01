import AdminCustomSelect from "../../components/AdminCustomSelect";
// pages/Admin/Coupons.jsx

import { useEffect, useMemo, useState } from "react";
import couponService from "../../appwrite/couponService";

import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaSearch,
  FaTags,
  FaPercentage,
  FaMoneyBillWave,
  FaCheckCircle,
  FaTimesCircle,
  FaTimes,
  FaSave,
  FaCalendarAlt,
  FaShoppingCart,
} from "react-icons/fa";

import { toast } from "react-hot-toast";

import "../../css/Coupons.css";

/* EMPTY COUPON */

const EMPTY_COUPON = {
  $id: null,
  code: "",
  type: "Percentage",
  discount: "",
  minOrder: "",
  usageLimit: "",
  used: 0,
  expiry: "",
  status: "Active",
};

/* COUPONS */

function Coupons() {
  const [coupons, setCoupons] = useState([]);

  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);

  const [isEditing, setIsEditing] = useState(false);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  const [currentCoupon, setCurrentCoupon] =
    useState(EMPTY_COUPON);

  /* LOAD COUPONS */

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      setLoading(true);

      const response = await couponService.getCoupons();

      setCoupons(response?.documents || []);
    } catch (error) {
      console.error("Load Coupons Error:", error);

      toast.error(
        error?.message || "Failed to load coupons."
      );

      setCoupons([]);
    } finally {
      setLoading(false);
    }
  };

  /* FILTER */

  const filteredCoupons = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return coupons;
    }

    return coupons.filter((coupon) =>
      String(coupon.couponCode || "")
        .toLowerCase()
        .includes(keyword)
    );
  }, [coupons, search]);

  /* STATISTICS */

  const totalCoupons = coupons.length;

  const activeCoupons = coupons.filter(
    (coupon) =>
      String(coupon.status || "").toLowerCase() ===
      "active"
  ).length;

  const expiredCoupons = coupons.filter(
    (coupon) =>
      String(coupon.status || "").toLowerCase() ===
      "expired"
  ).length;

  const totalUsage = coupons.reduce(
    (total, coupon) =>
      total + Number(coupon.usedCount || 0),
    0
  );

  /* OPEN ADD MODAL */

  const openAddModal = () => {
    setIsEditing(false);

    setCurrentCoupon({
      ...EMPTY_COUPON,
    });

    setShowModal(true);
  };

  /* OPEN EDIT MODAL */

  const openEditModal = (coupon) => {
    setIsEditing(true);

    setCurrentCoupon({
      $id: coupon.$id,

      code: coupon.couponCode || "",

      type: coupon.type || "Percentage",

      discount: coupon.discount ?? "",

      minOrder: coupon.minOrder ?? "",

      usageLimit: coupon.maxUsage ?? "",

      used: coupon.usedCount ?? 0,

      expiry: coupon.expiryDate
        ? String(coupon.expiryDate).split("T")[0]
        : "",

      status: coupon.status || "Active",
    });

    setShowModal(true);
  };

  /* CLOSE MODAL */

  const closeModal = () => {
    if (saving) {
      return;
    }

    setShowModal(false);

    setCurrentCoupon({
      ...EMPTY_COUPON,
    });

    setIsEditing(false);
  };

  /* HANDLE CHANGE */

  const handleChange = (event) => {
    const { name, value } = event.target;

    setCurrentCoupon((previous) => ({
      ...previous,

      [name]:
        name === "discount" ||
        name === "minOrder" ||
        name === "usageLimit" ||
        name === "used"
          ? value === ""
            ? ""
            : Number(value)
          : name === "code"
          ? value.toUpperCase()
          : value,
    }));
  };

  /* VALIDATE COUPON */

  const validateCoupon = () => {
    const code = currentCoupon.code.trim();

    const discount = Number(
      currentCoupon.discount
    );

    const minOrder = Number(
      currentCoupon.minOrder
    );

    const usageLimit = Number(
      currentCoupon.usageLimit
    );

    const used = Number(currentCoupon.used);

    /* Code */

    if (!code) {
      toast.error("Coupon code is required.");
      return false;
    }

    if (code.length < 3) {
      toast.error(
        "Coupon code must contain at least 3 characters."
      );
      return false;
    }

    /* Duplicate */

    const duplicate = coupons.find(
      (coupon) =>
        String(coupon.couponCode || "")
          .trim()
          .toLowerCase() === code.toLowerCase() &&
        coupon.$id !== currentCoupon.$id
    );

    if (duplicate) {
      toast.error("This coupon code already exists.");
      return false;
    }

    /* Discount */

    if (!Number.isFinite(discount) || discount <= 0) {
      toast.error("Enter a valid discount value.");
      return false;
    }

    if (
      currentCoupon.type === "Percentage" &&
      discount > 100
    ) {
      toast.error(
        "Percentage discount cannot be greater than 100%."
      );
      return false;
    }

    /* Minimum order */

    if (!Number.isFinite(minOrder) || minOrder < 0) {
      toast.error("Enter a valid minimum order amount.");
      return false;
    }

    /* Usage */

    if (
      !Number.isFinite(usageLimit) ||
      usageLimit <= 0
    ) {
      toast.error(
        "Usage limit must be greater than 0."
      );
      return false;
    }

    if (used < 0) {
      toast.error("Used count cannot be negative.");
      return false;
    }

    if (used > usageLimit) {
      toast.error(
        "Used count cannot be greater than usage limit."
      );
      return false;
    }

    /* Expiry */

    if (!currentCoupon.expiry) {
      toast.error("Expiry date is required.");
      return false;
    }

    return true;
  };

  /* SUBMIT */

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateCoupon()) {
      return;
    }

    try {
      setSaving(true);

      const data = {
        couponCode:
          currentCoupon.code.trim().toUpperCase(),

        type: currentCoupon.type,

        discount: Number(
          currentCoupon.discount
        ),

        minOrder: Number(
          currentCoupon.minOrder
        ),

        maxUsage: Number(
          currentCoupon.usageLimit
        ),

        usedCount: Number(
          currentCoupon.used
        ),

        expiryDate: currentCoupon.expiry,

        status: currentCoupon.status,
      };

      if (isEditing) {
        await couponService.updateCoupon(
          currentCoupon.$id,
          data
        );

        toast.success(
          "Coupon updated successfully."
        );
      } else {
        await couponService.addCoupon(data);

        toast.success(
          "Coupon added successfully."
        );
      }

      await loadCoupons();

      setShowModal(false);

      setCurrentCoupon({
        ...EMPTY_COUPON,
      });

      setIsEditing(false);
    } catch (error) {
      console.error(
        "Save Coupon Error:",
        error
      );

      toast.error(
        error?.message ||
          "Failed to save coupon."
      );
    } finally {
      setSaving(false);
    }
  };

  /* DELETE */

  const deleteCoupon = async (id) => {
    if (!id) {
      return;
    }

    const coupon = coupons.find(
      (item) => item.$id === id
    );

    const couponCode =
      coupon?.couponCode || "this coupon";

    const confirmed = window.confirm(
      `Are you sure you want to delete "${couponCode}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(id);

      await couponService.deleteCoupon(id);

      setCoupons((previous) =>
        previous.filter(
          (couponItem) =>
            couponItem.$id !== id
        )
      );

      toast.success(
        "Coupon deleted successfully."
      );
    } catch (error) {
      console.error(
        "Delete Coupon Error:",
        error
      );

      toast.error(
        error?.message ||
          "Failed to delete coupon."
      );
    } finally {
      setDeletingId(null);
    }
  };

  /* CLEAR SEARCH */

  const clearSearch = () => {
    setSearch("");
  };

  /* FORMAT DATE */

  const formatDate = (date) => {
    if (!date) {
      return "-";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "-";
    }

    return parsedDate.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  /* RETURN */

  return (
    <div className="container-fluid coupons-page py-4">
      {/* HEADER */}

      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center mb-4">
        <div>
          <h2 className="page-title fw-bold mb-1">
            Coupons Management
          </h2>

          <p className="text-muted mb-0">
            Create, manage and track discount coupons
            for your TechStore.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary add-coupon-btn mt-3 mt-lg-0"
          onClick={openAddModal}
          disabled={loading}
        >
          <FaPlus className="me-2" />

          Add Coupon
        </button>
      </div>

      {/* STATISTICS */}

      <div className="row g-4 mb-4">
        {/* Total */}

        <div className="col-xl-3 col-md-6">
          <div className="coupon-card total-card">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <small>Total Coupons</small>

                <h3>{totalCoupons}</h3>
              </div>

              <div className="coupon-icon">
                <FaTags />
              </div>
            </div>
          </div>
        </div>

        {/* Active */}

        <div className="col-xl-3 col-md-6">
          <div className="coupon-card active-card">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <small>Active Coupons</small>

                <h3>{activeCoupons}</h3>
              </div>

              <div className="coupon-icon">
                <FaCheckCircle />
              </div>
            </div>
          </div>
        </div>

        {/* Expired */}

        <div className="col-xl-3 col-md-6">
          <div className="coupon-card expired-card">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <small>Expired Coupons</small>

                <h3>{expiredCoupons}</h3>
              </div>

              <div className="coupon-icon">
                <FaTimesCircle />
              </div>
            </div>
          </div>
        </div>

        {/* Usage */}

        <div className="col-xl-3 col-md-6">
          <div className="coupon-card usage-card">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <small>Total Used</small>

                <h3>{totalUsage}</h3>
              </div>

              <div className="coupon-icon">
                <FaMoneyBillWave />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH */}

      <div className="card border-0 shadow-sm coupon-table-card mb-4">
        <div className="card-body">
          <div className="row align-items-center g-3">
            <div className="col-lg-6">
              <div className="input-group coupon-search">
                <span className="input-group-text">
                  <FaSearch />
                </span>

                <input
                  type="text"
                  className="form-control"
                  placeholder="Search coupon code..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />

                {search && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary clear-search-btn"
                    onClick={clearSearch}
                    title="Clear search"
                  >
                    <FaTimes />
                  </button>
                )}
              </div>
            </div>

            <div className="col-lg-6 text-lg-end">
              <small className="text-muted">
                Showing{" "}
                <strong>
                  {filteredCoupons.length}
                </strong>{" "}
                of{" "}
                <strong>{coupons.length}</strong>{" "}
                coupons
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* TABLE */}

      <div className="card border-0 shadow-sm coupon-table-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>Coupon Code</th>
                <th>Type</th>
                <th>Discount</th>
                <th>Min Order</th>
                <th>Usage</th>
                <th>Expiry</th>
                <th>Status</th>
                <th className="text-center">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="9"
                    className="text-center py-5"
                  >
                    <div className="coupon-loading">
                      <div
                        className="spinner-border text-primary"
                        role="status"
                      />

                      <div className="mt-3 text-muted">
                        Loading coupons...
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredCoupons.length > 0 ? (
                filteredCoupons.map(
                  (coupon, index) => (
                    <tr key={coupon.$id}>
                      {/* Number */}

                      <td>
                        <span className="fw-semibold">
                          {index + 1}
                        </span>
                      </td>

                      {/* Code */}

                      <td>
                        <span className="coupon-code">
                          {coupon.couponCode}
                        </span>
                      </td>

                      {/* Type */}

                      <td>
                        {coupon.type ===
                        "Percentage" ? (
                          <span className="badge bg-info">
                            <FaPercentage className="me-1" />
                            Percentage
                          </span>
                        ) : (
                          <span className="badge bg-info">
                            <FaMoneyBillWave className="me-1" />
                            Fixed
                          </span>
                        )}
                      </td>

                      {/* Discount */}

                      <td>
                        <strong>
                          {coupon.type ===
                          "Percentage"
                            ? `${coupon.discount}%`
                            : `₹${coupon.discount}`}
                        </strong>
                      </td>

                      {/* Minimum Order */}

                      <td>
                        ₹
                        {Number(
                          coupon.minOrder || 0
                        ).toLocaleString("en-IN")}
                      </td>

                      {/* Usage */}

                      <td>
                        <span className="badge bg-primary">
                          {coupon.usedCount || 0} /{" "}
                          {coupon.maxUsage || 0}
                        </span>
                      </td>

                      {/* Expiry */}

                      <td>
                        <span className="expiry-date">
                          <FaCalendarAlt className="me-2" />

                          {formatDate(
                            coupon.expiryDate
                          )}
                        </span>
                      </td>

                      {/* Status */}

                      <td>
                        <span
                          className={`badge coupon-status ${String(
                            coupon.status || ""
                          ).toLowerCase()}`}
                        >
                          {coupon.status}
                        </span>
                      </td>

                      {/* Actions */}

                      <td>
                        <div className="d-flex justify-content-center gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() =>
                              openEditModal(coupon)
                            }
                            title="Edit coupon"
                            disabled={
                              deletingId ===
                              coupon.$id
                            }
                          >
                            <FaEdit />
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() =>
                              deleteCoupon(
                                coupon.$id
                              )
                            }
                            title="Delete coupon"
                            disabled={
                              deletingId ===
                              coupon.$id
                            }
                          >
                            {deletingId ===
                            coupon.$id ? (
                              <span
                                className="spinner-border spinner-border-sm"
                                role="status"
                              />
                            ) : (
                              <FaTrash />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td
                    colSpan="9"
                    className="text-center py-5"
                  >
                    <div className="coupon-empty-state">
                      <FaTags size={42} />

                      <h6 className="mt-3 mb-1">
                        No Coupons Found
                      </h6>

                      <p className="text-muted mb-0">
                        {search
                          ? "Try another coupon code."
                          : "Create your first coupon to get started."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT MODAL */}

      {showModal && (
        <>
          <div
            className="modal fade show coupon-modal"
            style={{
              display: "block",
              background:
                "rgba(0,0,0,0.55)",
            }}
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg">
                {/* Header */}

                <div className="modal-header">
                  <div>
                    <h5 className="modal-title fw-bold mb-1">
                      {isEditing
                        ? "Edit Coupon"
                        : "Add Coupon"}
                    </h5>

                    <small className="modal-subtitle">
                      {isEditing
                        ? "Update your coupon details."
                        : "Create a new discount coupon."}
                    </small>
                  </div>

                  <button
                    type="button"
                    className="btn-close"
                    onClick={closeModal}
                    disabled={saving}
                    aria-label="Close"
                  />
                </div>

                {/* Form */}

                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="row g-4">
                      {/* Coupon Code */}

                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Coupon Code
                        </label>

                        <div className="input-group">
                          <span className="input-group-text">
                            <FaTags />
                          </span>

                          <input
                            type="text"
                            className="form-control"
                            name="code"
                            placeholder="e.g. TECH20"
                            value={
                              currentCoupon.code
                            }
                            onChange={
                              handleChange
                            }
                            maxLength="30"
                            autoComplete="off"
                          />
                        </div>
                      </div>

                      {/* Type */}

                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Discount Type
                        </label>

                        <AdminCustomSelect
                          className="form-select"
                          name="type"
                          value={
                            currentCoupon.type
                          }
                          onChange={
                            handleChange
                          }
                        >
                          <option value="Percentage">
                            Percentage (%)
                          </option>

                          <option value="Fixed">
                            Fixed Amount (₹)
                          </option>
                        </AdminCustomSelect>
                      </div>

                      {/* Discount */}

                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Discount Value
                        </label>

                        <div className="input-group">
                          <span className="input-group-text">
                            {currentCoupon.type ===
                            "Percentage" ? (
                              <FaPercentage />
                            ) : (
                              <FaMoneyBillWave />
                            )}
                          </span>

                          <input
                            type="number"
                            className="form-control"
                            name="discount"
                            min="0"
                            max={
                              currentCoupon.type ===
                              "Percentage"
                                ? "100"
                                : undefined
                            }
                            step="0.01"
                            placeholder={
                              currentCoupon.type ===
                              "Percentage"
                                ? "20"
                                : "500"
                            }
                            value={
                              currentCoupon.discount
                            }
                            onChange={
                              handleChange
                            }
                          />
                        </div>
                      </div>

                      {/* Minimum Order */}

                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Minimum Order
                        </label>

                        <div className="input-group">
                          <span className="input-group-text">
                            ₹
                          </span>

                          <input
                            type="number"
                            className="form-control"
                            name="minOrder"
                            min="0"
                            step="1"
                            placeholder="1000"
                            value={
                              currentCoupon.minOrder
                            }
                            onChange={
                              handleChange
                            }
                          />
                        </div>
                      </div>

                      {/* Usage Limit */}

                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Usage Limit
                        </label>

                        <div className="input-group">
                          <span className="input-group-text">
                            <FaShoppingCart />
                          </span>

                          <input
                            type="number"
                            className="form-control"
                            name="usageLimit"
                            min="1"
                            step="1"
                            placeholder="100"
                            value={
                              currentCoupon.usageLimit
                            }
                            onChange={
                              handleChange
                            }
                          />
                        </div>
                      </div>

                      {/* Used Count */}

                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Used Count
                        </label>

                        <input
                          type="number"
                          className="form-control"
                          name="used"
                          min="0"
                          step="1"
                          value={
                            currentCoupon.used
                          }
                          onChange={
                            handleChange
                          }
                        />
                      </div>

                      {/* Expiry */}

                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Expiry Date
                        </label>

                        <div className="input-group">
                          <span className="input-group-text">
                            <FaCalendarAlt />
                          </span>

                          <input
                            type="date"
                            className="form-control"
                            name="expiry"
                            value={
                              currentCoupon.expiry
                            }
                            onChange={
                              handleChange
                            }
                          />
                        </div>
                      </div>

                      {/* Status */}

                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Status
                        </label>

                        <AdminCustomSelect
                          className="form-select"
                          name="status"
                          value={
                            currentCoupon.status
                          }
                          onChange={
                            handleChange
                          }
                        >
                          <option value="Active">
                            Active
                          </option>

                          <option value="Expired">
                            Expired
                          </option>
                        </AdminCustomSelect>
                      </div>

                      {/* Preview */}

                      <div className="col-12">
                        <div className="coupon-preview">
                          <div className="coupon-preview-icon">
                            {currentCoupon.type ===
                            "Percentage" ? (
                              <FaPercentage />
                            ) : (
                              <FaMoneyBillWave />
                            )}
                          </div>

                          <div>
                            <small>
                              Coupon Preview
                            </small>

                            <h5>
                              {currentCoupon.code ||
                                "COUPONCODE"}
                            </h5>

                            <p>
                              {currentCoupon.type ===
                              "Percentage"
                                ? `${
                                    currentCoupon.discount ||
                                    0
                                  }% OFF`
                                : `₹${
                                    currentCoupon.discount ||
                                    0
                                  } OFF`}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}

                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={closeModal}
                      disabled={saving}
                    >
                      <FaTimes className="me-2" />
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="btn btn-primary"
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

                          {isEditing
                            ? "Update Coupon"
                            : "Add Coupon"}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div
            className="modal-backdrop fade show"
            onClick={closeModal}
          />
        </>
      )}
    </div>
  );
}

export default Coupons;