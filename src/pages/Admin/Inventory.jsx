import { useEffect, useMemo, useState } from "react";

import {
  FaBoxes,
  FaSearch,
  FaEdit,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimes,
  FaSave,
  FaWarehouse,
  FaCube,
  FaSyncAlt,
} from "react-icons/fa";

import { toast } from "react-hot-toast";

import productService from "../../appwrite/productService";

import "../../css/Inventory.css";

  // EMPTY FORM

const EMPTY_ITEM = {
  id: "",
  product: "",
  sku: "",
  stock: 0,
  threshold: 10,
  warehouse: "",
  category: "",
};

  // STATUS

const getStatusFromStock = (stock, threshold = 10) => {
  const quantity = Number(stock || 0);
  const limit = Number(threshold || 0);

  if (quantity <= 0) {
    return "Out of Stock";
  }

  if (quantity <= limit) {
    return "Low Stock";
  }

  return "In Stock";
};

  // IMAGE URL

const getProductImage = (thumbnail) => {
  if (!thumbnail) return "";

  // Already a complete URL
  if (
    typeof thumbnail === "string" &&
    thumbnail.startsWith("http")
  ) {
    return thumbnail;
  }

  const bucketId =
    import.meta.env.VITE_APPWRITE_BUCKET_ID;

  const projectId =
    import.meta.env.VITE_APPWRITE_PROJECT_ID;

  const endpoint =
    import.meta.env.VITE_APPWRITE_ENDPOINT ||
    "https://fra.cloud.appwrite.io/v1";

  return `${endpoint}/storage/buckets/${bucketId}/files/${thumbnail}/view?project=${projectId}`;
};

  // INVENTORY

function Inventory() {
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);

  const [saving, setSaving] = useState(false);

  const [currentItem, setCurrentItem] =
    useState(EMPTY_ITEM);

  // LOAD PRODUCTS FROM APPWRITE

  const loadProducts = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response =
        await productService.getProducts();

      const documents =
        response?.documents || [];

      setProducts(documents);

      if (showRefresh) {
        toast.success(
          "Inventory refreshed successfully."
        );
      }
    } catch (error) {
      console.error(
        "Inventory Load Error:",
        error
      );

      toast.error(
        error?.message ||
          "Failed to load inventory."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // INITIAL LOAD

  useEffect(() => {
    loadProducts();
  }, []);

  // NORMALIZE PRODUCT DATA

  const inventory = useMemo(() => {
    return products.map((product) => {
      const stock = Number(
        product?.stock ?? 0
      );

      const threshold = Number(
        product?.lowStockThreshold ??
          product?.threshold ??
          10
      );

      return {
        id: product?.$id,

        product:
          product?.title ||
          product?.name ||
          "Unnamed Product",

        sku:
          product?.sku ||
          product?.SKU ||
          product?.productCode ||
          "N/A",

        stock,

        threshold,

        warehouse:
          product?.warehouse ||
          product?.warehouseName ||
          product?.warehouseCity ||
          "Not Assigned",

        category:
          product?.category ||
          "Uncategorized",

        thumbnail:
          product?.thumbnail ||
          product?.image ||
          "",

        price:
          Number(product?.price || 0),

        status: getStatusFromStock(
          stock,
          threshold
        ),

        raw: product,
      };
    });
  }, [products]);

  // SEARCH

  const filteredInventory = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    if (!keyword) {
      return inventory;
    }

    return inventory.filter((item) => {
      const product =
        String(item.product || "")
          .toLowerCase();

      const sku =
        String(item.sku || "")
          .toLowerCase();

      const warehouse =
        String(item.warehouse || "")
          .toLowerCase();

      const category =
        String(item.category || "")
          .toLowerCase();

      return (
        product.includes(keyword) ||
        sku.includes(keyword) ||
        warehouse.includes(keyword) ||
        category.includes(keyword)
      );
    });
  }, [inventory, search]);

  // STATISTICS

  const totalProducts =
    inventory.length;

  const inStock =
    inventory.filter(
      (item) =>
        item.status === "In Stock"
    ).length;

  const lowStock =
    inventory.filter(
      (item) =>
        item.status === "Low Stock"
    ).length;

  const outOfStock =
    inventory.filter(
      (item) =>
        item.status === "Out of Stock"
    ).length;

  const totalUnits =
    inventory.reduce(
      (total, item) =>
        total +
        Number(item.stock || 0),
      0
    );

  // OPEN EDIT

  const openEditModal = (item) => {
    setCurrentItem({
      ...item,
    });

    setShowModal(true);
  };

  // CLOSE MODAL

  const closeModal = () => {
    if (saving) {
      return;
    }

    setShowModal(false);

    setCurrentItem({
      ...EMPTY_ITEM,
    });
  };

  // HANDLE CHANGE

  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setCurrentItem((previous) => ({
      ...previous,

      [name]:
        name === "stock" ||
        name === "threshold"
          ? value === ""
            ? ""
            : Number(value)
          : value,
    }));
  };

  // SAVE STOCK

  const handleSubmit = async (event) => {
    event.preventDefault();

    const stock = Number(
      currentItem.stock
    );

    const threshold = Number(
      currentItem.threshold
    );

    if (!currentItem.id) {
      toast.error(
        "Product ID is missing."
      );
      return;
    }

    if (
      !Number.isFinite(stock) ||
      stock < 0
    ) {
      toast.error(
        "Stock cannot be negative."
      );
      return;
    }

    if (
      !Number.isFinite(threshold) ||
      threshold < 0
    ) {
      toast.error(
        "Threshold cannot be negative."
      );
      return;
    }

    try {
      setSaving(true);

      // Only update fields that belong
      // to inventory management.
      const updateData = {
        stock,
      };

      /*
       * IMPORTANT:
       *
       * Threshold is only sent if your
       * products collection actually has
       * "lowStockThreshold".
       *
       * Otherwise remove this line.
       */
      if (
        Object.prototype.hasOwnProperty.call(
          currentItem.raw || {},
          "lowStockThreshold"
        )
      ) {
        updateData.lowStockThreshold =
          threshold;
      }

      const updatedProduct =
        await productService.updateProduct(
          currentItem.id,
          updateData
        );

      if (!updatedProduct) {
        throw new Error(
          "Product update failed."
        );
      }

      toast.success(
        "Inventory updated successfully."
      );

      setShowModal(false);

      setCurrentItem({
        ...EMPTY_ITEM,
      });

      await loadProducts();
    } catch (error) {
      console.error(
        "Inventory Update Error:",
        error
      );

      toast.error(
        error?.message ||
          "Failed to update inventory."
      );
    } finally {
      setSaving(false);
    }
  };

  // CLEAR SEARCH

  const clearSearch = () => {
    setSearch("");
  };

  // LOADING

  if (loading) {
    return (
      <div className="inventory-page container-fluid py-5">
        <div className="inventory-loading">
          <div
            className="spinner-border text-primary"
            role="status"
          />

          <h5 className="mt-3">
            Loading Inventory...
          </h5>

          <p className="text-muted mb-0">
            Fetching products from Appwrite.
          </p>
        </div>
      </div>
    );
  }

  // RETURN

  return (
    <div className="container-fluid inventory-page py-4">

      {/* HEADER */}

      <div className="inventory-header d-flex flex-column flex-lg-row justify-content-between align-items-lg-center mb-4">

        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <div className="inventory-title-icon">
              <FaBoxes />
            </div>

            <h2 className="page-title mb-0">
              Inventory Management
            </h2>
          </div>

          <p className="text-muted mb-0">
            Manage your real product stock directly
            from the Appwrite products collection.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-primary inventory-refresh-btn mt-3 mt-lg-0"
          onClick={() =>
            loadProducts(true)
          }
          disabled={refreshing}
        >
          <FaSyncAlt
            className={
              refreshing
                ? "inventory-spin me-2"
                : "me-2"
            }
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh Inventory"}
        </button>
      </div>

      {/* DATABASE INFO */}

      <div className="inventory-db-banner mb-4">
        <div className="inventory-db-icon">
          <FaCheckCircle />
        </div>

        <div>
          <strong>
            Live Appwrite Inventory
          </strong>

          <div>
            Products shown below are loaded
            directly from your database.
          </div>
        </div>
      </div>

      {/* STATISTICS */}

      <div className="row g-4 mb-4">

        {/* TOTAL */}

        <div className="col-xl-3 col-md-6">
          <div className="inventory-card total-card">
            <div>
              <small>
                Total Products
              </small>

              <h3>
                {totalProducts}
              </h3>

              <span className="inventory-stat-extra">
                {totalUnits} total units
              </span>
            </div>

            <div className="inventory-icon">
              <FaBoxes />
            </div>
          </div>
        </div>

        {/* IN STOCK */}

        <div className="col-xl-3 col-md-6">
          <div className="inventory-card stock-card">
            <div>
              <small>
                In Stock
              </small>

              <h3>
                {inStock}
              </h3>

              <span className="inventory-stat-extra">
                Products available
              </span>
            </div>

            <div className="inventory-icon">
              <FaCheckCircle />
            </div>
          </div>
        </div>

        {/* LOW */}

        <div className="col-xl-3 col-md-6">
          <div className="inventory-card low-card">
            <div>
              <small>
                Low Stock
              </small>

              <h3>
                {lowStock}
              </h3>

              <span className="inventory-stat-extra">
                Needs attention
              </span>
            </div>

            <div className="inventory-icon">
              <FaExclamationTriangle />
            </div>
          </div>
        </div>

        {/* OUT */}

        <div className="col-xl-3 col-md-6">
          <div className="inventory-card out-card">
            <div>
              <small>
                Out Of Stock
              </small>

              <h3>
                {outOfStock}
              </h3>

              <span className="inventory-stat-extra">
                Currently unavailable
              </span>
            </div>

            <div className="inventory-icon">
              <FaBoxes />
            </div>
          </div>
        </div>
      </div>

      {/* TABLE */}

      <div className="card inventory-table-card shadow-sm">

        <div className="card-body">

          {/* SEARCH */}

          <div className="row align-items-center g-3 mb-4">

            <div className="col-lg-7">

              <div className="input-group inventory-search">

                <span className="input-group-text">
                  <FaSearch />
                </span>

                <input
                  type="text"
                  className="form-control"
                  placeholder="Search product, SKU, category or warehouse..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                />

                {search && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary inventory-clear-btn"
                    onClick={clearSearch}
                  >
                    <FaTimes />
                  </button>
                )}
              </div>
            </div>

            <div className="col-lg-5 text-lg-end">

              <small className="text-muted">
                Showing{" "}
                <strong>
                  {filteredInventory.length}
                </strong>{" "}
                of{" "}
                <strong>
                  {inventory.length}
                </strong>{" "}
                products
              </small>

            </div>
          </div>

          {/* TABLE */}

          <div className="table-responsive">

            <table className="table table-hover align-middle mb-0">

              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Threshold</th>
                  <th>Warehouse</th>
                  <th>Status</th>
                  <th className="text-center">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>

                {filteredInventory.length > 0 ? (

                  filteredInventory.map(
                    (item, index) => (

                      <tr key={item.id}>

                        {/* NUMBER */}

                        <td>
                          <span className="fw-semibold">
                            {index + 1}
                          </span>
                        </td>

                        {/* PRODUCT */}

                        <td>

                          <div className="inventory-product">

                            <div className="inventory-product-image">

                              {item.thumbnail ? (
                                <img
                                  src={getProductImage(
                                    item.thumbnail
                                  )}
                                  alt={
                                    item.product
                                  }
                                />
                              ) : (
                                <FaCube />
                              )}

                            </div>

                            <div>

                              <div className="fw-semibold inventory-product-name">
                                {item.product}
                              </div>

                              <small className="text-muted">
                                ₹{" "}
                                {Number(
                                  item.price || 0
                                ).toLocaleString(
                                  "en-IN"
                                )}
                              </small>

                            </div>

                          </div>

                        </td>

                        {/* SKU */}

                        <td>
                          <span className="inventory-sku">
                            {item.sku}
                          </span>
                        </td>

                        {/* CATEGORY */}

                        <td>
                          <span className="inventory-category">
                            {item.category}
                          </span>
                        </td>

                        {/* STOCK */}

                        <td>

                          <strong
                            className={
                              item.stock <= 0
                                ? "stock-danger"
                                : item.stock <=
                                  item.threshold
                                ? "stock-warning"
                                : "stock-success"
                            }
                          >
                            {item.stock}
                          </strong>

                          <small className="inventory-unit">
                            units
                          </small>

                        </td>

                        {/* THRESHOLD */}

                        <td>
                          <span className="inventory-threshold">
                            {item.threshold}
                          </span>
                        </td>

                        {/* WAREHOUSE */}

                        <td>
                          <span className="inventory-warehouse">
                            <FaWarehouse className="me-2" />
                            {item.warehouse}
                          </span>
                        </td>

                        {/* STATUS */}

                        <td>

                          <span
                            className={`inventory-status ${
                              item.status ===
                              "In Stock"
                                ? "instock"
                                : item.status ===
                                  "Low Stock"
                                ? "lowstock"
                                : "outstock"
                            }`}
                          >
                            {item.status}
                          </span>

                        </td>

                        {/* ACTION */}

                        <td>

                          <div className="d-flex justify-content-center">

                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm inventory-edit-btn"
                              onClick={() =>
                                openEditModal(
                                  item
                                )
                              }
                              title="Update stock"
                            >
                              <FaEdit />
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

                      <div className="inventory-empty-state">

                        <FaBoxes size={46} />

                        <h6 className="mt-3 mb-1">
                          No Products Found
                        </h6>

                        <p className="text-muted mb-0">
                          {search
                            ? "Try another search keyword."
                            : "No products are available in your Appwrite database."}
                        </p>

                      </div>

                    </td>

                  </tr>

                )}

              </tbody>

            </table>

          </div>

        </div>

      </div>

      {/* EDIT STOCK MODAL */}

      {showModal && (

        <>

          <div
            className="modal fade show inventory-modal"
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

                {/* HEADER */}

                <div className="modal-header">

                  <div>

                    <h5 className="modal-title fw-bold mb-1">
                      Update Inventory
                    </h5>

                    <small className="modal-subtitle">
                      Update stock for the existing
                      database product.
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

                {/* FORM */}

                <form
                  onSubmit={handleSubmit}
                >

                  <div className="modal-body">

                    <div className="row g-4">

                      {/* PRODUCT */}

                      <div className="col-md-6">

                        <label className="form-label">
                          Product
                        </label>

                        <div className="inventory-readonly-field">

                          <div className="inventory-modal-product-image">

                            {currentItem.thumbnail ? (
                              <img
                                src={getProductImage(
                                  currentItem.thumbnail
                                )}
                                alt={
                                  currentItem.product
                                }
                              />
                            ) : (
                              <FaCube />
                            )}

                          </div>

                          <div>

                            <strong>
                              {currentItem.product}
                            </strong>

                            <small>
                              {currentItem.category}
                            </small>

                          </div>

                        </div>

                      </div>

                      {/* SKU */}

                      <div className="col-md-6">

                        <label className="form-label">
                          SKU
                        </label>

                        <input
                          type="text"
                          className="form-control"
                          value={
                            currentItem.sku
                          }
                          readOnly
                        />

                      </div>

                      {/* STOCK */}

                      <div className="col-md-6">

                        <label className="form-label">
                          Stock Quantity
                        </label>

                        <input
                          type="number"
                          className="form-control"
                          name="stock"
                          min="0"
                          step="1"
                          value={
                            currentItem.stock
                          }
                          onChange={
                            handleChange
                          }
                          autoFocus
                        />

                      </div>

                      {/* THRESHOLD */}

                      <div className="col-md-6">

                        <label className="form-label">
                          Low Stock Threshold
                        </label>

                        <input
                          type="number"
                          className="form-control"
                          name="threshold"
                          min="0"
                          step="1"
                          value={
                            currentItem.threshold
                          }
                          onChange={
                            handleChange
                          }
                        />

                      </div>

                      {/* WAREHOUSE */}

                      <div className="col-md-6">

                        <label className="form-label">
                          Warehouse
                        </label>

                        <input
                          type="text"
                          className="form-control"
                          value={
                            currentItem.warehouse
                          }
                          readOnly
                        />

                      </div>

                      {/* STATUS */}

                      <div className="col-md-6">

                        <label className="form-label">
                          Current Status
                        </label>

                        <div className="inventory-modal-status">

                          <span
                            className={`inventory-status ${
                              getStatusFromStock(
                                currentItem.stock,
                                currentItem.threshold
                              ) ===
                              "In Stock"
                                ? "instock"
                                : getStatusFromStock(
                                    currentItem.stock,
                                    currentItem.threshold
                                  ) ===
                                  "Low Stock"
                                ? "lowstock"
                                : "outstock"
                            }`}
                          >
                            {getStatusFromStock(
                              currentItem.stock,
                              currentItem.threshold
                            )}
                          </span>

                        </div>

                        <small className="form-help">
                          Status is automatically
                          calculated from stock quantity
                          and threshold.
                        </small>

                      </div>

                      {/* PREVIEW */}

                      <div className="col-12">

                        <div className="inventory-preview">

                          <div className="inventory-preview-icon">
                            <FaBoxes />
                          </div>

                          <div className="flex-grow-1">

                            <small>
                              Inventory Preview
                            </small>

                            <h5>
                              {currentItem.product}
                            </h5>

                            <div className="inventory-preview-meta">

                              <span>
                                Stock:{" "}
                                <strong>
                                  {currentItem.stock}
                                </strong>
                              </span>

                              <span>
                                Threshold:{" "}
                                <strong>
                                  {
                                    currentItem.threshold
                                  }
                                </strong>
                              </span>

                              <span>
                                Status:{" "}
                                <strong>
                                  {getStatusFromStock(
                                    currentItem.stock,
                                    currentItem.threshold
                                  )}
                                </strong>
                              </span>

                            </div>

                          </div>

                        </div>

                      </div>

                    </div>

                  </div>

                  {/* FOOTER */}

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
                          <span className="spinner-border spinner-border-sm me-2" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <FaSave className="me-2" />
                          Update Stock
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

export default Inventory;