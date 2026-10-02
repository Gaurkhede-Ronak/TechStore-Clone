import "../css/Skeleton.css";

function SkeletonCard() {
    return (
        <div className="skeleton-card h-100">
            <div className="skeleton skeleton-image"></div>
            <div className="p-3">
                <div className="skeleton skeleton-title"></div>
                <div className="skeleton skeleton-text"></div>
                <div className="skeleton skeleton-price"></div>
                <div className="skeleton skeleton-btn"></div>
            </div>
        </div>
    );
}

export default SkeletonCard;
