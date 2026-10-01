import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import productService from "../../appwrite/productService";

function EditProduct() {

    const { id } = useParams();

    const navigate = useNavigate();


const [form, setForm] = useState({
  title: "",
  price: "",
  category: "",
  stock: "",
  thumbnail: "",
});

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    productService.getProduct(id)
      .then((product) => {
        if (isMounted) {
          setForm(product);
          setLoading(false);
        }
      })
      .catch((error) => {
        console.log(error);
        alert(error.message);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

    function handleChange(e) {

        setForm({
            ...form,
            [e.target.name]: e.target.value
        });

    }
async function handleSubmit(e) {
  e.preventDefault();

  try {

    let thumbnail = form.thumbnail;

    if (form.newImage) {
      const image = await productService.uploadImage(
        form.newImage
      );

      thumbnail = image.$id;
    }

    await productService.updateProduct(id, {
      title: form.title,
      description: form.description || "",
      brand: form.brand || "",
      category: form.category,
      price: Number(form.price),
      discount: Number(form.discount || 0),
      stock: Number(form.stock),
      thumbnail,
      featured: form.featured || false,
      rating: Number(form.rating || 0),
    });

    alert("Product Updated Successfully");

    navigate("/admin/products");

  } catch (error) {

    console.log(error);

    alert(error.message);

  }
}
 if (loading) {
  return (
    <h2 className="text-center mt-5">
      Loading...
    </h2>
  );
}
    return (

        <div className="container mt-5">

            <div className="card p-4 shadow">

                <h2>Edit Product</h2>

                <form onSubmit={handleSubmit}>

                    <input
                        className="form-control mb-3"
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                    />

                    <input
                        className="form-control mb-3"
                        name="price"
                        value={form.price}
                        onChange={handleChange}
                    />

                    <input
                        className="form-control mb-3"
                        name="category"
                        value={form.category}
                        onChange={handleChange}
                    />

                    <input
                        className="form-control mb-3"
                        name="stock"
                        value={form.stock}
                        onChange={handleChange}
                    />

                 <label className="form-label">
  Product Image
</label>

<img
  src={`https://fra.cloud.appwrite.io/v1/storage/buckets/${
    import.meta.env.VITE_APPWRITE_BUCKET_ID
  }/files/${form.thumbnail}/view?project=${
    import.meta.env.VITE_APPWRITE_PROJECT_ID
  }`}
  alt=""
  style={{
    width: "180px",
    height: "180px",
    objectFit: "contain",
  }}
  className="mb-3 d-block"
/>

<input
  type="file"
  className="form-control mb-3"
  onChange={(e) =>
    setForm({
      ...form,
      newImage: e.target.files[0],
    })
  }
/>

                    <button className="btn btn-primary">

                        Update Product

                    </button>

                </form>

            </div>

        </div>

    );

}

export default EditProduct;