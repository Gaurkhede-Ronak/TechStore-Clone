import { Link } from "react-router-dom";
import "../css/EmptyState.css";

const DEFAULT_IMAGE = "https://cdn-icons-png.flaticon.com/512/10265/10265785.png";

function EmptyState({
    image = DEFAULT_IMAGE,
    title = "No Data Found",
    message = "There is nothing to display right now.",
    buttonText = "Go Back",
    buttonLink = "/"
}) {
    const handleImgError = (e) => {
        if (e.currentTarget.src !== DEFAULT_IMAGE) {
            e.currentTarget.src = DEFAULT_IMAGE;
        }
    };

    return (
        <div className="empty-state animate-float-in">
            <img
                src={image || DEFAULT_IMAGE}
                alt={title}
                onError={handleImgError}
            />
            <h2>{title}</h2>
            <p>{message}</p>
            <Link
                to={buttonLink}
                className="empty-btn"
            >
                {buttonText}
            </Link>
        </div>
    );
}

export default EmptyState;