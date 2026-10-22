import { useCallback, useEffect, useMemo, useState } from "react";
import AdminCustomSelect from "../../components/AdminCustomSelect";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaSearch,
  FaTags,
  FaBoxOpen,
  FaCheckCircle,
  FaTimesCircle,
  FaImage,
  FaTimes,
  FaSave,
  FaSyncAlt,
} from "react-icons/fa";
import { ID, Query } from "appwrite";
import { toast } from "react-hot-toast";

import { databases } from "../../appwrite/config";
import "../../css/Categories.css";

/* APPWRITE CONFIG */

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;

const CATEGORIES_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_CATEGORIES_COLLECTION_ID ||
  "categories";

const PRODUCTS_COLLECTION_ID =
  import.meta.env.VITE_APPWRITE_PRODUCTS_COLLECTION_ID ||
  "products";

/* CONSTANTS */

const PAGE_SIZE = 100;

const EMPTY_CATEGORY = {
  id: null,
  name: "",
  image: "",
  products: 0,
  status: "Active",
};

/* HELPERS */

const normalizeStatus = (value) => {
  return String(value || "Active").toLowerCase() === "inactive"
    ? "Inactive"
    : "Active";
};

const normalizeCategory = (category) => {
  return {
    ...category,
    id: category?.$id || category?.id || null,
    name: String(
      category?.name ||
        category?.categoryName ||
        ""
    ).trim(),
    image: String(
      category?.image ||
        category?.imageUrl ||
        ""
    ).trim(),
    products: Number(
      category?.products ??
        category?.productCount ??
        0
    ),
    status: normalizeStatus(category?.status),
  };
};

const normalizeProductCategory = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase();
};

const getErrorMessage = (error, fallback) => {
  if (!error) {
    return fallback;
  }

  if (error?.message) {
    return error.message;
  }

  return fallback;
};

/* COMPONENT */

function Categories() {
  /* STATE */

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [currentCategory, setCurrentCategory] =
    useState(EMPTY_CATEGORY);

  const [imageError, setImageError] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  /* CONFIG VALIDATION */

  const configError = useMemo(() => {
    if (!DATABASE_ID) {
      return "VITE_APPWRITE_DATABASE_ID is missing from .env";
    }

    if (!CATEGORIES_COLLECTION_ID) {
      return "VITE_APPWRITE_CATEGORIES_COLLECTION_ID is missing from .env";
    }

    return "";
  }, []);

  /* FETCH ALL DOCUMENTS HELPER */

  const fetchAllDocuments = useCallback(
    async (collectionId, orderByName = false) => {
      if (!DATABASE_ID || !collectionId) {
        return [];
      }

      const allDocuments = [];
      let offset = 0;

      while (true) {
        const queries = [
          Query.limit(PAGE_SIZE),
          Query.offset(offset),
        ];

        if (orderByName) {
          queries.push(Query.orderAsc("name"));
        }

        const response = await databases.listDocuments(
          DATABASE_ID,
          collectionId,
          queries
        );

        const documents = response?.documents || [];

        allDocuments.push(...documents);

        if (documents.length < PAGE_SIZE) {
          break;
        }

        offset += PAGE_SIZE;
      }

      return allDocuments;
    },
    []
  );

  /* FETCH CATEGORIES */

  const fetchCategories = useCallback(
    async (showRefreshLoader = false) => {
      if (configError) {
        setCategories([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (showRefreshLoader) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const documents = await fetchAllDocuments(
          CATEGORIES_COLLECTION_ID,
          true
        );

        const normalized = documents.map(
          normalizeCategory
        );

        setCategories(normalized);
      } catch (error) {
        console.error(
          "Fetch Categories Error:",
          error
        );

        toast.error(
          getErrorMessage(
            error,
            "Failed to load categories from Appwrite."
          )
        );

        setCategories([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      configError,
      fetchAllDocuments,
    ]
  );

  /* FETCH PRODUCTS */

  const fetchProducts = useCallback(
    async () => {
      if (!DATABASE_ID || !PRODUCTS_COLLECTION_ID) {
        setProducts([]);
        return;
      }

      try {
        const documents = await fetchAllDocuments(
          PRODUCTS_COLLECTION_ID,
          false
        );

        setProducts(documents);
      } catch (error) {
        console.warn(
          "Fetch Products For Category Count Error:",
          error
        );

        /*
          Product count is an additional feature.
          If products cannot be loaded, categories
          should still work normally.
        */
        setProducts([]);
      }
    },
    [fetchAllDocuments]
  );

  /* LOAD DATA */

  const loadData = useCallback(
    async (showRefreshLoader = false) => {
      if (configError) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        await Promise.all([
          fetchCategories(false),
          fetchProducts(),
        ]);
      } catch (error) {
        console.error(
          "Categories Load Data Error:",
          error
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      configError,
      fetchCategories,
      fetchProducts,
    ]
  );

  /* INITIAL LOAD */

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  /* PRODUCT COUNT */

  const getProductCount = useCallback(
    (category) => {
      const categoryName =
        normalizeProductCategory(
          category?.name
        );

      const categoryId =
        normalizeProductCategory(
          category?.id
        );

      if (!categoryName && !categoryId) {
        return 0;
      }

      return products.filter((product) => {
        /*
          Direct category fields
        */
        const possibleCategoryValues = [
          product?.category,
          product?.categoryName,
          product?.categoryId,
        ];

        const directMatch =
          possibleCategoryValues.some(
            (value) => {
              const normalizedValue =
                normalizeProductCategory(
                  value
                );

              return (
                normalizedValue ===
                  categoryName ||
                normalizedValue ===
                  categoryId
              );
            }
          );

        if (directMatch) {
          return true;
        }

        /*
          categories array
        */
        if (
          Array.isArray(
            product?.categories
          )
        ) {
          return product.categories.some(
            (item) => {
              const normalizedItem =
                normalizeProductCategory(
                  typeof item === "object"
                    ? item?.name ||
                        item?.id
                    : item
                );

              return (
                normalizedItem ===
                  categoryName ||
                normalizedItem ===
                  categoryId
              );
            }
          );
        }

        return false;
      }).length;
    },
    [products]
  );

  /* LIVE CATEGORIES */

  const liveCategories = useMemo(() => {
    return categories.map((category) => ({
      ...category,
      products:
        getProductCount(category),
    }));
  }, [
    categories,
    getProductCount,
  ]);

  /* FILTERED CATEGORIES */

  const filteredCategories = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    if (!keyword) {
      return liveCategories;
    }

    return liveCategories.filter(
      (category) => {
        const name =
          String(category?.name || "")
            .toLowerCase();

        const status =
          String(category?.status || "")
            .toLowerCase();

        return (
          name.includes(keyword) ||
          status.includes(keyword)
        );
      }
    );
  }, [
    liveCategories,
    search,
  ]);

  /* STATISTICS */

  const totalCategories =
    liveCategories.length;

  const activeCategories =
    liveCategories.filter(
      (category) =>
        category.status === "Active"
    ).length;

  const inactiveCategories =
    liveCategories.filter(
      (category) =>
        category.status === "Inactive"
    ).length;

  const totalProducts =
    liveCategories.reduce(
      (total, category) =>
        total +
        Number(
          category.products || 0
        ),
      0
    );

  /* OPEN ADD MODAL */

  const openAddModal = () => {
    if (saving) {
      return;
    }

    setIsEditing(false);
    setImageError(false);

    setCurrentCategory({
      ...EMPTY_CATEGORY,
    });

    setShowModal(true);
  };

  /* OPEN EDIT MODAL */

  const openEditModal = (category) => {
    if (!category?.id) {
      toast.error(
        "Unable to edit this category."
      );
      return;
    }

    setIsEditing(true);
    setImageError(false);

    setCurrentCategory({
      id: category.id,
      name: category.name || "",
      image: category.image || "",
      products: Number(
        category.products || 0
      ),
      status:
        normalizeStatus(
          category.status
        ),
    });

    setShowModal(true);
  };

  /* CLOSE MODAL */

  const closeModal = () => {
    if (saving) {
      return;
    }

    setShowModal(false);
    setIsEditing(false);
    setImageError(false);

    setCurrentCategory({
      ...EMPTY_CATEGORY,
    });
  };

  /* RESET MODAL AFTER SUCCESS */

  const resetModal = () => {
    setShowModal(false);
    setIsEditing(false);
    setImageError(false);

    setCurrentCategory({
      ...EMPTY_CATEGORY,
    });
  };

  /* HANDLE INPUT */

  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setCurrentCategory(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );

    if (name === "image") {
      setImageError(false);
    }
  };

  /* VALIDATE CATEGORY */

  const validateCategory = () => {
    const categoryName =
      String(
        currentCategory?.name || ""
      ).trim();

    if (!categoryName) {
      toast.error(
        "Category name is required."
      );
      return false;
    }

    if (categoryName.length < 2) {
      toast.error(
        "Category name must contain at least 2 characters."
      );
      return false;
    }

    if (categoryName.length > 100) {
      toast.error(
        "Category name cannot exceed 100 characters."
      );
      return false;
    }

    const duplicateCategory =
      categories.find(
        (category) => {
          const existingName =
            String(
              category?.name || ""
            )
              .trim()
              .toLowerCase();

          return (
            existingName ===
              categoryName.toLowerCase() &&
            category.id !==
              currentCategory.id
          );
        }
      );

    if (duplicateCategory) {
      toast.error(
        "This category already exists."
      );
      return false;
    }

    const image =
      String(
        currentCategory?.image || ""
      ).trim();

    if (image.length > 1000) {
      toast.error(
        "Image URL cannot exceed 1000 characters."
      );
      return false;
    }

    return true;
  };

  /* CREATE CATEGORY */

  const createCategory = async (
    categoryData
  ) => {
    return databases.createDocument(
      DATABASE_ID,
      CATEGORIES_COLLECTION_ID,
      ID.unique(),
      categoryData
    );
  };

  /* UPDATE CATEGORY */

  const updateCategory = async (
    documentId,
    categoryData
  ) => {
    return databases.updateDocument(
      DATABASE_ID,
      CATEGORIES_COLLECTION_ID,
      documentId,
      categoryData
    );
  };

  /* HANDLE SUBMIT */

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (configError) {
      toast.error(configError);
      return;
    }

    if (!validateCategory()) {
      return;
    }

    const cleanedCategory = {
      name: String(
        currentCategory.name || ""
      ).trim(),

      image: String(
        currentCategory.image || ""
      ).trim(),

      status:
        currentCategory.status ===
        "Inactive"
          ? "Inactive"
          : "Active",
    };

    try {
      setSaving(true);

      if (
        isEditing &&
        currentCategory.id
      ) {
        await updateCategory(
          currentCategory.id,
          cleanedCategory
        );

        toast.success(
          "Category updated successfully."
        );
      } else {
        await createCategory(
          cleanedCategory
        );

        toast.success(
          "Category added successfully."
        );
      }

      /*
        Important:
        Do NOT call closeModal() here because
        saving is still true.
      */
      resetModal();

      await fetchCategories(true);
    } catch (error) {
      console.error(
        "Save Category Error:",
        error
      );

      toast.error(
        getErrorMessage(
          error,
          "Failed to save category."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  /* DELETE CATEGORY */

  const deleteCategory = async (
    id
  ) => {
    if (!id || deletingId) {
      return;
    }

    const category =
      categories.find(
        (item) =>
          item.id === id
      );

    if (!category) {
      toast.error(
        "Category not found."
      );
      return;
    }

    const productCount =
      getProductCount(category);

    let confirmationMessage =
      `Are you sure you want to delete "${category.name}"?`;

    if (productCount > 0) {
      confirmationMessage +=
        `\n\nThis category currently has ${productCount} product(s).`;
    }

    confirmationMessage +=
      "\n\nThis action cannot be undone.";

    const confirmed =
      window.confirm(
        confirmationMessage
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(id);

      await databases.deleteDocument(
        DATABASE_ID,
        CATEGORIES_COLLECTION_ID,
        id
      );

      toast.success(
        "Category deleted successfully."
      );

      await fetchCategories(true);
    } catch (error) {
      console.error(
        "Delete Category Error:",
        error
      );

      toast.error(
        getErrorMessage(
          error,
          "Failed to delete category. Check Appwrite permissions."
        )
      );
    } finally {
      setDeletingId(null);
    }
  };

  /* IMAGE ERROR */

  const handleImageError = () => {
    setImageError(true);
  };

  /* IMAGE LOAD */

  const handleImageLoad = () => {
    setImageError(false);
  };

  /* CLEAR SEARCH */

  const clearSearch = () => {
    setSearch("");
  };

  /* CONFIG ERROR SCREEN */

  if (configError) {
    return (
      <div className="container-fluid categories-page py-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="d-flex align-items-start gap-3">
              <div className="text-danger fs-3">
                <FaTimesCircle />
              </div>

              <div>
                <h4 className="fw-bold mb-2">
                  Appwrite Configuration Error
                </h4>

                <p className="text-muted mb-3">
                  {configError}
                </p>

                <div className="bg-light rounded p-3">
                  <div className="fw-semibold mb-2">
                    Required .env values:
                  </div>

                  <code>
                    VITE_APPWRITE_DATABASE_ID=your_database_id
                    <br />
                    VITE_APPWRITE_CATEGORIES_COLLECTION_ID=categories
                  </code>
                </div>

                <small className="text-muted d-block mt-3">
                  After changing .env, restart the
                  Vite development server.
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* LOADING */

  if (loading) {
    return (
      <div className="container-fluid categories-page py-4">
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
              Loading Categories...
            </h5>

            <p className="text-muted mb-0">
              Fetching categories from
              Appwrite
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* UI */

  return (
    <div className="container-fluid categories-page py-4">

      {/* HEADER */}

      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center mb-4">

        <div>
          <h2 className="page-title fw-bold mb-1">
            Categories Management
          </h2>

          <p className="text-muted mb-0">
            Manage product categories,
            monitor inventory groups and
            organize your TechStore
            products.
          </p>
        </div>

        <div className="d-flex gap-2 mt-3 mt-lg-0">

          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() =>
              loadData(true)
            }
            disabled={
              refreshing ||
              saving ||
              Boolean(deletingId)
            }
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
            type="button"
            className="btn btn-primary"
            onClick={openAddModal}
            disabled={
              saving ||
              Boolean(deletingId)
            }
          >
            <FaPlus className="me-2" />
            Add Category
          </button>

        </div>

      </div>

      {/* STATISTICS */}

      <div className="row g-4 mb-4">

        <div className="col-xl-3 col-md-6">
          <div className="category-card total-card">
            <div className="d-flex justify-content-between align-items-center">

              <div>
                <small>
                  Total Categories
                </small>

                <h3>
                  {totalCategories}
                </h3>
              </div>

              <div className="category-icon">
                <FaTags />
              </div>

            </div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6">
          <div className="category-card active-card">
            <div className="d-flex justify-content-between align-items-center">

              <div>
                <small>
                  Active Categories
                </small>

                <h3>
                  {activeCategories}
                </h3>
              </div>

              <div className="category-icon">
                <FaCheckCircle />
              </div>

            </div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6">
          <div className="category-card inactive-card">
            <div className="d-flex justify-content-between align-items-center">

              <div>
                <small>
                  Inactive Categories
                </small>

                <h3>
                  {inactiveCategories}
                </h3>
              </div>

              <div className="category-icon">
                <FaTimesCircle />
              </div>

            </div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6">
          <div className="category-card product-card">
            <div className="d-flex justify-content-between align-items-center">

              <div>
                <small>
                  Total Products
                </small>

                <h3>
                  {totalProducts}
                </h3>
              </div>

              <div className="category-icon">
                <FaBoxOpen />
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* SEARCH */}

      <div className="card border-0 shadow-sm category-table-card mb-4">

        <div className="card-body">

          <div className="row align-items-center g-3">

            <div className="col-lg-6">

              <div className="input-group">

                <span className="input-group-text">
                  <FaSearch />
                </span>

                <input
                  type="text"
                  className="form-control"
                  placeholder="Search category..."
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
                    className="btn btn-outline-secondary"
                    onClick={
                      clearSearch
                    }
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
                  {
                    filteredCategories.length
                  }
                </strong>{" "}

                of{" "}

                <strong>
                  {
                    categories.length
                  }
                </strong>{" "}

                categories

              </small>

            </div>

          </div>

        </div>

      </div>

      {/* CATEGORIES TABLE */}

      <div className="card border-0 shadow-sm category-table-card">

        <div className="table-responsive">

          <table className="table table-hover align-middle mb-0">

            <thead>
              <tr>

                <th>#</th>

                <th>Image</th>

                <th>Category</th>

                <th>Products</th>

                <th>Status</th>

                <th className="text-center">
                  Actions
                </th>

              </tr>
            </thead>

            <tbody>

              {filteredCategories.length >
              0 ? (
                filteredCategories.map(
                  (
                    category,
                    index
                  ) => (
                    <tr
                      key={
                        category.id
                      }
                    >

                      {/* Number */}

                      <td>
                        <span className="fw-semibold">
                          {index + 1}
                        </span>
                      </td>

                      {/* Image */}

                      <td>

                        {category.image ? (
                          <img
                            src={
                              category.image
                            }
                            alt={
                              category.name
                            }
                            className="rounded"
                            width="60"
                            height="60"
                            style={{
                              objectFit:
                                "cover",
                            }}
                            onError={(
                              event
                            ) => {
                              event.currentTarget.style.display =
                                "none";

                              if (
                                event
                                  .currentTarget
                                  .parentElement
                              ) {
                                event.currentTarget.parentElement.innerHTML =
                                  `
                                  <div
                                    class="rounded bg-light text-primary d-flex align-items-center justify-content-center"
                                    style="width:60px;height:60px;font-size:22px;"
                                  >
                                    <span>🏷️</span>
                                  </div>
                                `;
                              }
                            }}
                          />
                        ) : (
                          <div
                            className="rounded bg-light text-primary d-flex align-items-center justify-content-center"
                            style={{
                              width: "60px",
                              height: "60px",
                              fontSize:
                                "22px",
                            }}
                          >
                            <FaTags />
                          </div>
                        )}

                      </td>

                      {/* Category */}

                      <td>

                        <div className="fw-semibold">
                          {
                            category.name
                          }
                        </div>

                        <small className="text-muted">
                          Category ID:{" "}
                          {category.id}
                        </small>

                      </td>

                      {/* Products */}

                      <td>

                        <span className="badge bg-primary">
                          {
                            category.products
                          }{" "}
                          Products
                        </span>

                      </td>

                      {/* Status */}

                      <td>

                        <span
                          className={`badge category-status ${String(
                            category.status
                          ).toLowerCase()}`}
                        >
                          {
                            category.status
                          }
                        </span>

                      </td>

                      {/* Actions */}

                      <td>

                        <div className="d-flex justify-content-center gap-2">

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() =>
                              openEditModal(
                                category
                              )
                            }
                            title="Edit category"
                            disabled={
                              deletingId ===
                                category.id ||
                              saving
                            }
                          >
                            <FaEdit />
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() =>
                              deleteCategory(
                                category.id
                              )
                            }
                            title="Delete category"
                            disabled={
                              deletingId !==
                                null ||
                              saving
                            }
                          >
                            {deletingId ===
                            category.id ? (
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
                    colSpan="6"
                    className="text-center py-5 text-muted"
                  >

                    <FaTags
                      size={35}
                      className="mb-3 opacity-50"
                    />

                    <div className="fw-semibold">
                      No Categories Found
                    </div>

                    <small>
                      {search
                        ? "Try another search keyword."
                        : "No categories are available in Appwrite."}
                    </small>

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
            className="modal fade show category-modal"
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

                {/* Modal Header */}

                <div className="modal-header">

                  <h5 className="modal-title fw-bold">
                    {isEditing
                      ? "Edit Category"
                      : "Add Category"}
                  </h5>

                  <button
                    type="button"
                    className="btn-close"
                    onClick={
                      closeModal
                    }
                    disabled={saving}
                    aria-label="Close"
                  />

                </div>

                {/* Form */}

                <form
                  onSubmit={
                    handleSubmit
                  }
                >

                  <div className="modal-body">

                    <div className="row g-4">

                      {/* Category Name */}

                      <div className="col-md-6">

                        <label className="form-label fw-semibold">
                          Category Name
                          <span className="text-danger ms-1">
                            *
                          </span>
                        </label>

                        <input
                          type="text"
                          className="form-control"
                          name="name"
                          placeholder="Enter category name"
                          value={
                            currentCategory.name
                          }
                          onChange={
                            handleChange
                          }
                          autoComplete="off"
                          maxLength={100}
                          disabled={saving}
                        />

                        <small className="text-muted">
                          {
                            currentCategory
                              .name
                              .length
                          }
                          /100
                        </small>

                      </div>

                      {/* Image URL */}

                      <div className="col-md-6">

                        <label className="form-label fw-semibold">
                          Image URL
                        </label>

                        <div className="input-group">

                          <span className="input-group-text">
                            <FaImage />
                          </span>

                          <input
                            type="url"
                            className={`form-control ${
                              imageError
                                ? "is-invalid"
                                : ""
                            }`}
                            name="image"
                            placeholder="https://example.com/image.jpg"
                            value={
                              currentCategory.image
                            }
                            onChange={
                              handleChange
                            }
                            disabled={saving}
                            maxLength={1000}
                          />

                        </div>

                        <small className="text-muted">
                          Optional
                        </small>

                      </div>

                      {/* Status */}

                      <div className="col-md-6">

                        <label className="form-label fw-semibold">
                          Status
                          <span className="text-danger ms-1">
                            *
                          </span>
                        </label>

                        <AdminCustomSelect
                          className="form-select"
                          name="status"
                          value={
                            currentCategory.status
                          }
                          onChange={
                            handleChange
                          }
                          disabled={saving}
                        >

                          <option value="Active">
                            Active
                          </option>

                          <option value="Inactive">
                            Inactive
                          </option>

                        </AdminCustomSelect>

                      </div>

                      {/* Product Count */}

                      <div className="col-md-6">

                        <label className="form-label fw-semibold">
                          Products
                        </label>

                        <input
                          type="text"
                          className="form-control"
                          value={
                            getProductCount(
                              currentCategory
                            )
                          }
                          disabled
                          readOnly
                        />

                        <small className="text-muted">
                          Product count is
                          calculated
                          automatically from
                          Appwrite products.
                        </small>

                      </div>

                      {/* Image Preview */}

                      {currentCategory.image && (
                        <div className="col-12">

                          <label className="form-label fw-semibold">
                            Image Preview
                          </label>

                          <div className="category-preview">

                            {!imageError ? (
                              <img
                                src={
                                  currentCategory.image
                                }
                                alt="Category Preview"
                                className="preview-image"
                                onError={
                                  handleImageError
                                }
                                onLoad={
                                  handleImageLoad
                                }
                              />
                            ) : (
                              <div className="text-center text-muted">

                                <FaImage
                                  size={40}
                                  className="mb-2"
                                />

                                <div className="fw-semibold">
                                  Image could not be loaded
                                </div>

                                <small>
                                  Please check
                                  the image
                                  URL.
                                </small>

                              </div>
                            )}

                          </div>

                        </div>
                      )}

                    </div>

                  </div>

                  {/* Modal Footer */}

                  <div className="modal-footer">

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={
                        closeModal
                      }
                      disabled={saving}
                    >
                      <FaTimes className="me-2" />
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={
                        saving ||
                        !currentCategory.name.trim()
                      }
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
                            ? "Update Category"
                            : "Add Category"}
                        </>
                      )}

                    </button>

                  </div>

                </form>

              </div>

            </div>

          </div>

          {/* Backdrop */}

          <div
            className="modal-backdrop fade show"
            onClick={
              saving
                ? undefined
                : closeModal
            }
          />

        </>
      )}

    </div>
  );
}

export default Categories;