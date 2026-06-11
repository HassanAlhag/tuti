# Tuti MVP Manual UAT Script

Last updated: 2026-06-01

## Environment

- Customer web: `http://localhost:5173`
- Seller app: `http://localhost:5174`
- Admin app: `http://localhost:5175`
- Backend API: `http://localhost:5055`

## Test Roles

- Admin
- Seller
- Customer

---

## A) Sales Rep Referral Flow

### UAT-A1
- **Test ID:** `UAT-A1`
- **Role:** Admin
- **Steps:**
  1. Open Admin app.
  2. Go to Sales Reps.
  3. Create a new sales rep with a unique rep code.
- **Expected result:**
  - Sales rep is created successfully and appears in the rep list.
- **Status:** Not Tested / Pass / Fail
- **Notes:**

### UAT-A2
- **Test ID:** `UAT-A2`
- **Role:** Customer/Seller onboarding
- **Steps:**
  1. Open Customer web URL with referral code: `/sell?rep=CODE`.
  2. Click seller CTA and complete seller registration using referral code.
- **Expected result:**
  - Seller account and pending-review shop are created.
  - Referral attribution is attached.
- **Status:** Not Tested / Pass / Fail
- **Notes:**

### UAT-A3
- **Test ID:** `UAT-A3`
- **Role:** Admin
- **Steps:**
  1. Open Admin Sellers.
  2. Approve the pending-review referred seller.
- **Expected result:**
  - Seller status becomes Approved.
  - Referral becomes active.
  - Signup bonus commission entry is created.
- **Status:** Not Tested / Pass / Fail
- **Notes:**

---

## B) Seller Product Flow

### UAT-B1
- **Test ID:** `UAT-B1`
- **Role:** Seller
- **Steps:**
  1. Login to Seller app.
  2. Create a product with valid image upload.
- **Expected result:**
  - Product is created successfully.
  - Product enters `Needs approval`.
- **Status:** Not Tested / Pass / Fail
- **Notes:**

### UAT-B2
- **Test ID:** `UAT-B2`
- **Role:** Admin
- **Steps:**
  1. Open Admin product approvals.
  2. Approve seller product.
- **Expected result:**
  - Product status becomes `Live`.
- **Status:** Not Tested / Pass / Fail
- **Notes:**

### UAT-B3
- **Test ID:** `UAT-B3`
- **Role:** Seller
- **Steps:**
  1. Update stock only for a Live product.
- **Expected result:**
  - Stock updates.
  - Product remains `Live`.
- **Status:** Not Tested / Pass / Fail
- **Notes:**

### UAT-B4
- **Test ID:** `UAT-B4`
- **Role:** Seller
- **Steps:**
  1. Edit a sensitive field (e.g., name/price/description/image).
- **Expected result:**
  - Product moves to `Needs approval`.
- **Status:** Not Tested / Pass / Fail
- **Notes:**

### UAT-B5
- **Test ID:** `UAT-B5`
- **Role:** Admin + Seller
- **Steps:**
  1. Admin rejects product.
  2. Seller opens rejected product, fixes data, and resubmits.
- **Expected result:**
  - Rejected product can be fixed and resubmitted to `Needs approval`.
- **Status:** Not Tested / Pass / Fail
- **Notes:**

---

## C) Customer COD Order Flow

### UAT-C1
- **Test ID:** `UAT-C1`
- **Role:** Customer
- **Steps:**
  1. Browse products on Customer web.
  2. Add item to cart.
  3. Checkout with COD.
- **Expected result:**
  - Order is created successfully.
  - Confirmation appears with order ID and status.
  - Order appears in Account order history (if logged in).
- **Status:** Not Tested / Pass / Fail
- **Notes:**

---

## D) Seller Fulfillment Flow

### UAT-D1
- **Test ID:** `UAT-D1`
- **Role:** Seller
- **Steps:**
  1. Open Seller Orders.
  2. Move order through:
     - Pending → Confirmed
     - Confirmed → Processing
     - Processing → Ready for Delivery
     - Ready for Delivery → Shipped (with courier ref)
     - Shipped → Delivered
- **Expected result:**
  - All transitions succeed in order.
  - Courier reference is captured before/when shipped.
- **Status:** Not Tested / Pass / Fail
- **Notes:**

---

## E) Customer Accept Flow

### UAT-E1
- **Test ID:** `UAT-E1`
- **Role:** Customer
- **Steps:**
  1. Open delivered order in Account.
  2. Confirm delivery acceptance.
- **Expected result:**
  - Order status becomes `Customer Accepted`.
  - Customer confirmation message is shown.
- **Status:** Not Tested / Pass / Fail
- **Notes:**

---

## F) Customer Dispute + Admin Support Flow

### UAT-F1
- **Test ID:** `UAT-F1`
- **Role:** Customer
- **Steps:**
  1. Open delivered order in Account.
  2. Submit dispute with note.
- **Expected result:**
  - Order status becomes `Disputed`.
  - Dispute hold markers are visible in admin support queue.
- **Status:** Not Tested / Pass / Fail
- **Notes:**

### UAT-F2
- **Test ID:** `UAT-F2`
- **Role:** Admin/Support
- **Steps:**
  1. Open Admin Support dispute queue.
  2. Add support note/action (`reviewing`, `contact_customer`, etc.).
  3. Save resolution decision.
  4. Finalize resolution decision.
- **Expected result:**
  - Support case updates persist.
  - Resolution decision saves.
  - Finalization succeeds and status markers update.
  - No payment transfer is executed automatically.
- **Status:** Not Tested / Pass / Fail
- **Notes:**

### UAT-F3
- **Test ID:** `UAT-F3`
- **Role:** Seller + Customer
- **Steps:**
  1. Seller opens order detail.
  2. Customer opens account order detail.
- **Expected result:**
  - Seller sees read-only resolution summary.
  - Customer sees safe support decision summary.
  - Internal/admin-only details remain hidden from customer.
- **Status:** Not Tested / Pass / Fail
- **Notes:**

---

## G) Build Your Box Flow

### UAT-G1
- **Test ID:** `UAT-G1`
- **Role:** Customer
- **Steps:**
  1. Open `/build-a-box`.
  2. Select one perfume.
  3. Select one same-shop treat.
  4. Add configured box to cart.
  5. Checkout order.
- **Expected result:**
  - Build Your Box is one configured cart line.
  - Checkout/confirmation/account show selected contents.
  - Nested stock deduction applies to selected perfume+treat (not `build-box` SKU).
- **Status:** Not Tested / Pass / Fail
- **Notes:**

---

## H) Upload Security Checks

### UAT-H1
- **Test ID:** `UAT-H1`
- **Role:** Seller/Admin
- **Steps:**
  1. Upload valid image file (jpeg/png/webp under size limit).
- **Expected result:**
  - Upload succeeds.
- **Status:** Not Tested / Pass / Fail
- **Notes:**

### UAT-H2
- **Test ID:** `UAT-H2`
- **Role:** Guest
- **Steps:**
  1. Attempt upload without authentication.
- **Expected result:**
  - Request is rejected (auth required).
- **Status:** Not Tested / Pass / Fail
- **Notes:**

### UAT-H3
- **Test ID:** `UAT-H3`
- **Role:** Customer
- **Steps:**
  1. Login as customer and attempt upload.
- **Expected result:**
  - Request is rejected (insufficient role).
- **Status:** Not Tested / Pass / Fail
- **Notes:**

### UAT-H4
- **Test ID:** `UAT-H4`
- **Role:** Seller/Admin
- **Steps:**
  1. Attempt upload of invalid file type (e.g., PDF/EXE).
- **Expected result:**
  - Request is rejected (invalid type).
- **Status:** Not Tested / Pass / Fail
- **Notes:**

---

## Final UAT Sign-off Checklist

- [ ] Build passes (`npm run build`)
- [ ] Backend starts cleanly on expected port
- [ ] Core MVP flows pass (A through H)
- [ ] Known limitations are accepted by internal stakeholders
- [ ] Ready for next phase

