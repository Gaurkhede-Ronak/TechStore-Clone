import { useState } from 'react'
import { Link } from 'react-router-dom'

function OrderSuccess() {
  const [orderId] = useState(() => "TS" + Math.floor(100000 + Math.random() * 900000));
  const [today] = useState(() => new Date());
  const [delivery] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d;
  });
  return (
    <div className='container mt-5'>
      <div className="card shadow-lg p-5 text-center ">
        <h1 className='text-success'>
          ✅ Order Placed Successfully
        </h1>
        <hr />
        <h4>Order ID : <span className='text-primary'>#{orderId}</span></h4>
        <h5>Order Date : <span className='mt-3'>#{today.toLocaleDateString()}</span></h5>
        <h5>Estimated Delivery : <span className='mt-3'>#{delivery.toLocaleDateString()}</span></h5>
        <h6>  Thank you for shopping with <strong>TechStore ❤️</strong></h6>
        <Link
          to="/"
          className="btn btn-primary mt-4"
        >

          Continue Shopping

        </Link>
      </div>

    </div>
  )
}

export default OrderSuccess
