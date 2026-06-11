import { MessageSquare, Send, Star } from "lucide-react";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { StarPicker } from "@tuti/shared/components/StarPicker.jsx";
import { bayesianScore } from "@tuti/shared/utils/rating.js";

function ReviewRange({ label, value, onChange }) {
  return (
    <label className="review-range">
      <span>{label}</span>
      <input
        type="range"
        min="1"
        max="5"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <strong>{value}</strong>
    </label>
  );
}

export function ReviewContributionPanel({
  product,
  reviewDraft,
  reviewList,
  reviewNote,
  setReviewDraft,
  submitCustomerReview,
}) {
  if (!product) return null;

  const productReviews = reviewList.filter((review) => review.productId === product.id);
  const type = product.category || "perfume";
  const labels = type === "cake" || type === "dessert"
    ? { first: "Taste", second: "Freshness", third: "Value", placeholder: "Share taste, freshness, delivery, packaging, or occasion notes" }
    : type === "gift_box" || type === "bundle"
    ? { first: "Presentation", second: "Delivery", third: "Value", placeholder: "Share packaging, pairing, delivery, and gift experience notes" }
    : { first: "Scent", second: "Longevity", third: "Value", placeholder: "Share scent, longevity, value, delivery, or packaging notes" };

  return (
    <section className="cart-panel review-panel">
      <PanelHeader icon={MessageSquare} title="Client ratings" action="Verified review flow" />
      <div className="review-target">
        <BottleArt product={product} compact />
        <div>
          <strong>{product.name}</strong>
          <span>{product.reviews} total reviews · score {bayesianScore(product.rating, product.reviews)}</span>
        </div>
      </div>

      <form className="review-form" onSubmit={submitCustomerReview}>
        <label>
          Your rating
          <StarPicker
            value={reviewDraft.rating}
            onChange={(rating) => setReviewDraft({ ...reviewDraft, rating })}
          />
        </label>
        <label>
          Review title
          <input
            value={reviewDraft.title}
            onChange={(event) => setReviewDraft({ ...reviewDraft, title: event.target.value })}
            placeholder="Example: Long lasting oud"
          />
        </label>
        <label>
          Client review
          <textarea
            value={reviewDraft.body}
            onChange={(event) => setReviewDraft({ ...reviewDraft, body: event.target.value })}
            placeholder={labels.placeholder}
            rows="4"
          />
        </label>
        <div className="aspect-grid">
          <ReviewRange label={labels.first} value={reviewDraft.scent} onChange={(scent) => setReviewDraft({ ...reviewDraft, scent })} />
          <ReviewRange label={labels.second} value={reviewDraft.longevity} onChange={(longevity) => setReviewDraft({ ...reviewDraft, longevity })} />
          <ReviewRange label={labels.third} value={reviewDraft.value} onChange={(value) => setReviewDraft({ ...reviewDraft, value })} />
        </div>
        <label className="toggle-row review-toggle">
          <span>
            <strong>Verified purchase</strong>
            <small>Counts stronger in ranking</small>
          </span>
          <input
            checked={reviewDraft.verified}
            onChange={(event) => setReviewDraft({ ...reviewDraft, verified: event.target.checked })}
            type="checkbox"
          />
        </label>
        <button className="primary-action full-width" type="submit">
          <Send size={17} />
          Submit rating
        </button>
        {reviewNote ? <p className="success-note">{reviewNote}</p> : null}
      </form>

      <div className="review-list">
        {productReviews.slice(0, 2).map((review) => (
          <article className="review-card" key={review.id}>
            <div className="review-card-head">
              <strong>{review.title}</strong>
              <span><Star size={14} fill="currentColor" /> {review.rating}</span>
            </div>
            <p>{review.body}</p>
            <small>{review.customer} · {review.verified ? "Verified purchase" : "Community review"}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
