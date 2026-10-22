import { useState } from "react";
import AdminCustomSelect from "../../components/AdminCustomSelect";
import { useNavigate } from "react-router-dom";
import productService from "../../appwrite/productService";

function AddProduct() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    description: "",
    brand: "",
    category: "",
    price: "",
    discount: "",
    stock: "",
    rating: "",
    featured: false,
    
    thumbType: "file",
    thumbnailFile: null,
    thumbnailUrl: "",

    img1Type: "file",
    imageFile: null,
    imageUrlVal: "",

    img2Type: "file",
    image2File: null,
    image2Url: "",
  });

  // 🌟 Live Discount & Final Price Calculation
  const originalPrice = Number(form.price || 0);
  const discountPercent = Number(form.discount || 0);
  const finalPrice = originalPrice - (originalPrice * discountPercent) / 100;

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleFileChange(e, fieldName) {
    setForm((prev) => ({ ...prev, [fieldName]: e.target.files[0] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      let mainThumbnail = "";
      if (form.thumbType === "file" && form.thumbnailFile) {
        const res = await productService.uploadImage(form.thumbnailFile);
        mainThumbnail = res.$id;
      } else if (form.thumbType === "url" && form.thumbnailUrl && form.thumbnailUrl.trim() !== "") {
        mainThumbnail = form.thumbnailUrl.trim();
      } else if (form.thumbnailFile) {
        const res = await productService.uploadImage(form.thumbnailFile);
        mainThumbnail = res.$id;
      } else if (form.thumbnailUrl && form.thumbnailUrl.trim() !== "") {
        mainThumbnail = form.thumbnailUrl.trim();
      } else {
        alert("Please provide at least a Main Thumbnail image or URL.");
        return;
      }

      let imageVal = "";
      if (form.img1Type === "file" && form.imageFile) {
        const res = await productService.uploadImage(form.imageFile);
        imageVal = res.$id;
      } else if (form.img1Type === "url" && form.imageUrlVal && form.imageUrlVal.trim() !== "") {
        imageVal = form.imageUrlVal.trim();
      }

      let image2Val = "";
      if (form.img2Type === "file" && form.image2File) {
        const res = await productService.uploadImage(form.image2File);
        image2Val = res.$id;
      } else if (form.img2Type === "url" && form.image2Url && form.image2Url.trim() !== "") {
        image2Val = form.image2Url.trim();
      }

      await productService.addProduct({
        title: form.title,
        description: form.description,
        brand: form.brand,
        category: form.category,
        price: originalPrice,
        discount: discountPercent,
        stock: Number(form.stock),
        thumbnail: mainThumbnail,
        image: imageVal,
        image2: image2Val,
        featured: form.featured,
        rating: Number(form.rating || 4.5),
      });

      alert("Product Added Successfully!");
      navigate("/admin/products");
    } catch (error) {
      console.log(error);
      alert(error.message);
    }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-9">
          <div className="card border-0 shadow-lg p-4 p-md-5 rounded-4 bg-white">
            <h2 className="fw-bold mb-4">Add Product with 3 Images & Discount</h2>
            <form onSubmit={handleSubmit}>
              
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <input type="text" name="title" className="form-control" placeholder="Product Title" value={form.title} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <input type="text" name="brand" className="form-control" placeholder="Brand" value={form.brand} onChange={handleChange} required />
                </div>
              </div>

              <textarea name="description" className="form-control mb-3" placeholder="Description" rows="3" value={form.description} onChange={handleChange} required />

              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <input type="number" name="price" className="form-control" placeholder="Price (₹)" value={form.price} onChange={handleChange} required />
                </div>
                <div className="col-md-4">
                  <input type="number" name="discount" className="form-control" placeholder="Discount (%)" value={form.discount} onChange={handleChange} />
                </div>
                <div className="col-md-4">
                  <input type="number" name="stock" className="form-control" placeholder="Stock Units" value={form.stock} onChange={handleChange} required />
                </div>
              </div>

              {/* 🌟 Price & Discount Preview Box */}
              <div className="card border-success bg-light mb-4 shadow-sm rounded-3">
                <div className="card-body">
                  <h6 className="text-success fw-bold mb-2">Price & Discount Breakdown</h6>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Original Price:</span>
                    <strong className="text-dark">₹{originalPrice.toLocaleString("en-IN")}</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Discount Applied:</span>
                    <strong className="text-danger">{discountPercent}% OFF</strong>
                  </div>
                  <hr className="my-2" />
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-dark">Final Selling Price:</span>
                    <span className="fw-bold text-success fs-4">₹{finalPrice.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <AdminCustomSelect name="category" className="form-select" value={form.category} onChange={handleChange} required>
                    <option value="">Select Category</option>
                    <option value="Laptop">Laptop</option>
                    <option value="Tablet">Tablet</option>
                    <option value="Mobile">Mobile</option>
                    <option value="Accessories">Accessories</option>
                  </AdminCustomSelect>
                </div>
                <div className="col-md-6">
                  <input type="number" name="rating" className="form-control" placeholder="Rating (0-5)" step="0.1" value={form.rating} onChange={handleChange} />
                </div>
              </div>

              {/* 1. Thumbnail */}
              <div className="card p-3 mb-3 bg-light">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="fw-bold m-0">1. Main Thumbnail (Card & First View) *</label>
                  <div className="btn-group btn-group-sm">
                    <button type="button" className={`btn ${form.thumbType === "file" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setForm({ ...form, thumbType: "file" })}>File</button>
                    <button type="button" className={`btn ${form.thumbType === "url" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setForm({ ...form, thumbType: "url" })}>URL</button>
                  </div>
                </div>
                {form.thumbType === "file" ? (
                  <input type="file" className="form-control form-control-sm" accept="image/*" onChange={(e) => handleFileChange(e, "thumbnailFile")} />
                ) : (
                  <input type="url" className="form-control form-control-sm" placeholder="https://example.com/image.jpg" value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} />
                )}
              </div>

              {/* 2. Image Column */}
              <div className="card p-3 mb-3 bg-light">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="fw-bold m-0">2. Second Image Angle (Optional)</label>
                  <div className="btn-group btn-group-sm">
                    <button type="button" className={`btn ${form.img1Type === "file" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setForm({ ...form, img1Type: "file" })}>File</button>
                    <button type="button" className={`btn ${form.img1Type === "url" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setForm({ ...form, img1Type: "url" })}>URL</button>
                  </div>
                </div>
                {form.img1Type === "file" ? (
                  <input type="file" className="form-control form-control-sm" accept="image/*" onChange={(e) => handleFileChange(e, "imageFile")} />
                ) : (
                  <input type="url" className="form-control form-control-sm" placeholder="https://example.com/image2.jpg" value={form.imageUrlVal} onChange={(e) => setForm({ ...form, imageUrlVal: e.target.value })} />
                )}
              </div>

              {/* 3. Image2 Column */}
              <div className="card p-3 mb-4 bg-light">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="fw-bold m-0">3. Third Image Angle (Optional)</label>
                  <div className="btn-group btn-group-sm">
                    <button type="button" className={`btn ${form.img2Type === "file" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setForm({ ...form, img2Type: "file" })}>File</button>
                    <button type="button" className={`btn ${form.img2Type === "url" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setForm({ ...form, img2Type: "url" })}>URL</button>
                  </div>
                </div>
                {form.img2Type === "file" ? (
                  <input type="file" className="form-control form-control-sm" accept="image/*" onChange={(e) => handleFileChange(e, "image2File")} />
                ) : (
                  <input type="url" className="form-control form-control-sm" placeholder="https://example.com/image3.jpg" value={form.image2Url} onChange={(e) => setForm({ ...form, image2Url: e.target.value })} />
                )}
              </div>

              <button type="submit" className="btn btn-primary w-100 py-3 fw-bold">Publish Product</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddProduct;