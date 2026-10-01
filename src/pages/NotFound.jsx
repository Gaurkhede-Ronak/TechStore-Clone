import { Link } from "react-router-dom";
import "../css/NotFound.css";

function NotFound() {

    return (

        <div className="notfound">

            <h1>404</h1>

            <h2>Page Not Found</h2>

            <p>

                Sorry! The page you are looking for doesn't exist.

            </p>

            <Link
                to="/"
                className="home-btn"
            >

                Back To Home

            </Link>

        </div>

    );

}

export default NotFound;