# COD Payment Reconciliation SOP

Date: 2026-06-18  
Scope: Tuti / Perfume Marketplace COD-first MVP production operations.

## Purpose And Scope

This SOP defines how operations, finance, support, and admins reconcile cash-on-delivery activity from order creation through driver cash collection, admin COD settlement, seller ledger credit, dispute/refund handling, and seller payout review.

This document is operational guidance only. It does not introduce card payments, automated bank disbursement, or manual database edits. It should be used with the deployment runbook in `docs/bmad/06-deployment-runbook-and-launch-checklist.md` and the release readiness status in `docs/bmad/07-release-readiness-status.md`.

## COD-Only Launch Assumptions

- MVP checkout is COD-only.
- Card checkout is not launch-ready and must remain disabled until a real payment gateway authorization, capture, refund, and reconciliation lifecycle exists.
- New COD orders start as cash pending, not paid.
- Driver delivery may record COD cash collection.
- Seller COD earnings are not credited on delivery alone.
- Seller COD credit happens after admin confirms driver cash settlement.
- Payouts are admin-controlled records, not automated bank transfers.
- Disputes and refunds must hold or reverse seller earnings according to evidence and approved resolution decisions.
- Reconciliation is required before seller payout approval.

## System Facts To Reconcile

| Area | Operational meaning |
| --- | --- |
| Order | Source record for customer purchase, payment method, status, shop allocation, totals, and driver assignment. |
| COD collection | Driver delivery records whether cash was collected and the recorded COD amount. |
| Driver cash balance | Operational cash liability for money collected by a driver but not yet settled to admin/platform. |
| Admin COD settlement | Admin confirmation that collected driver cash was received and eligible orders can be credited to sellers. |
| Seller ledger | Ledger records seller earnings, holds, releases, refund debits, and payout debits. |
| Disputes/refunds | Support/admin process that can hold, release, or debit seller earnings. |
| Payouts | Admin payout workflow that should only pay available, reconciled, non-disputed seller balances. |

## Roles And Responsibilities

| Role | Responsibilities |
| --- | --- |
| Finance operations owner | Owns daily reconciliation, variance review, settlement signoff, payout readiness, and period close. |
| Admin operations owner | Runs COD settlement batches, verifies settlement candidates, and preserves settlement references. |
| Driver operations/dispatcher | Confirms driver assignments, cash handover, missed collection reports, and delivery evidence. |
| Support owner | Owns customer disputes, refund evidence, support case status, and customer/seller communication. |
| Seller operations owner | Communicates seller ledger/payout issues and confirms seller-side order exceptions. |
| Engineering owner | Investigates system defects, failed jobs, data inconsistencies, and audit/log evidence. |
| Release/business owner | Approves launch waivers, high-value adjustments, unresolved variance treatment, and period close exceptions. |

No single person should both create an unreconciled manual money adjustment and approve it.

## Required Reports And Exports

Produce these reports daily for the previous reconciliation window. Store them in the approved finance evidence location once that location is decided.

| Report/export | Minimum fields |
| --- | --- |
| Orders export | `orderId`, `customerId`, `guest/customer flag`, `shopIds`, `paymentMethod`, `paymentStatus`, `status`, `total`, `subtotal`, `platformFee`, `createdAt`, `deliveredAt`, `customerResponse`, `supportCase/dispute status`. |
| Order items export | `orderId`, `productId`, `shopId`, `quantity`, `unit price`, `subtotal`, `vendorNet`, `bundledProductIds` where applicable. |
| Driver COD export | `driverId`, `orderId`, `codCollected`, `codAmount`, `deliveredAt`, `codSettledAt`, `codSettlementRef`, `proofOfDeliveryUrl`. |
| Driver balance export | `driverId`, `codBalance`, `totalCodCollected`, `totalDeliveries`, settlement period totals, cash handover receipt reference. |
| COD settlement candidates | `driverId`, `orderId`, `codAmount`, `vendorNet`, eligibility status, exclusion reason if not eligible. |
| COD settlement batch history | `settlementRef`, `driverId`, `orderIds`, `totalCash`, `adminId`, `notes`, `createdAt`, cash receipt reference. |
| Seller transaction ledger | `transactionId`, `shopId`, `orderId`, `type`, `amount`, `status`, `createdBy`, `createdAt`, `metadata`. |
| Shop balances | `shopId`, `pendingBalance`, `availableBalance`, `holdBalance`, `paidBalance`, balance as of reconciliation close. |
| Payout export | `payoutId`, `shopId`, `orderIds`, `amount`, `status`, `createdAt`, `completedAt`, payout reference, approver. |
| Dispute/refund export | `orderId`, `caseId`, `status`, `liability`, `refundDecision`, `payoutDecision`, `codResolution`, evidence links, approver. |
| Audit/admin activity export | Admin settlement actions, payout actions, refund/dispute decisions, manual adjustment attempts, and role/permission changes. |

## Daily Reconciliation Workflow

### 1. Define The Reconciliation Window

- Use a consistent daily cutoff time and timezone.
- Include orders created, delivered, settled, disputed, refunded, or paid out within the window.
- Record the exact window start/end in the daily reconciliation worksheet.
- Do not mix production data with smoke-test or staging data.

### 2. Reconcile Orders

Confirm that all launch orders in scope are COD orders unless a launch waiver says otherwise.

Daily checks:

- Count COD orders created in the window.
- Confirm no card order entered a paid, authorized, captured, or settlement state.
- Confirm delivered COD orders have driver assignment evidence.
- Confirm `Delivered` or `Customer Accepted` COD orders with `codCollected = true` appear in the driver COD export.
- Confirm disputed orders are excluded from settlement and payout readiness.
- Confirm canceled/refunded orders are not treated as payout-eligible.

Expected states:

| Order condition | Expected reconciliation treatment |
| --- | --- |
| COD order created, not delivered | Track as open fulfillment, no seller credit, no driver cash. |
| COD order delivered, cash collected, not settled | Driver cash liability, settlement pending, no seller payout. |
| COD order delivered, cash missing/not collected | Exception queue, no settlement, no seller payout. |
| COD order disputed | Hold settlement or payout until support/admin decision. |
| COD order settled | Seller `cod_credit` should exist once per eligible shop/order. |
| COD order refunded | Seller ledger should show approved refund debit or equivalent hold treatment before payout. |

### 3. Reconcile COD Collected By Drivers

For each driver:

- Sum delivered orders with `codCollected = true` and no active dispute.
- Compare system COD amount to the driver's physical cash handover or deposit receipt.
- Compare unsettled collected orders to the driver's current COD cash balance.
- Verify each delivered COD order has proof-of-delivery evidence when available.
- Confirm duplicate delivery attempts did not create duplicate cash, stats, or settlement records.

Formula:

```text
Expected driver cash liability =
  prior unsettled COD balance
  + COD collected during period
  - COD cash settled during period
  +/- approved corrections
```

Any difference must be logged as a variance before settlement continues.

### 4. Reconcile Driver Cash Balances

Driver cash balance should represent money collected by the driver but not yet settled with admin/platform.

Daily checks:

- Driver reported cash on hand equals expected unsettled COD balance.
- Cash handover receipt amount equals the settlement batch total.
- Settlement reduces driver COD balance by the settled cash amount.
- No driver COD balance is manually reset without approval and evidence.
- Negative balances or balances that unexpectedly fall to zero require engineering/finance review.

### 5. Reconcile Admin Settlement Batches

Before creating a settlement batch:

- Export candidate orders for the driver.
- Confirm every candidate is COD, assigned to that driver, delivered or customer accepted, cash collected, unsettled, and not actively disputed.
- Confirm cash received matches the batch total.
- Remove any order with missing proof, active support dispute, refund review, or cash mismatch.

After creating a settlement batch:

- Record `settlementRef`.
- Confirm each included order has `codSettledAt`, `codSettledBy`, and `codSettlementRef`.
- Confirm driver COD balance decreased by the total cash settled.
- Confirm seller ledger `cod_credit` was created once for each eligible shop/order share.
- Attach cash receipt and admin notes to the reconciliation evidence pack.

### 6. Reconcile Seller Earnings And Ledger

For each settled COD order:

- Compare order item `vendorNet` totals by shop to seller `cod_credit` transaction amounts.
- Confirm COD orders do not receive seller credit before admin COD settlement.
- Confirm no COD order has both an unexpected `delivery_credit` and `cod_credit` for the same shop/order unless explicitly approved and explained.
- Confirm duplicate settlement attempts did not create duplicate seller credits.
- Confirm disputed/refunded orders have appropriate `dispute_hold`, `dispute_release`, or `refund_debit` treatment.

Seller balance check:

```text
Expected shop balance movement =
  opening pending/available/hold/paid balances
  + cod_credit and other approved credits
  - refund_debit
  - payout_debit
  +/- approved adjustments
```

### 7. Reconcile Refunds And Disputes

Daily checks:

- Every disputed delivered order has a support case or resolution record.
- Active disputes are excluded from seller payout readiness.
- Refund decisions have evidence and approval notes.
- Refund debits match the credited seller earning for the affected order/shop.
- Release decisions move held earnings only after dispute resolution approval.
- COD cash refund responsibility is clear: customer cash refund by seller, platform, or no refund due.

Do not finalize a dispute or refund without evidence links and approver identity.

### 8. Reconcile Payouts

Before payout creation or approval:

- Confirm every included order has an earning credit.
- Confirm COD orders have `codSettledAt` and `codSettlementRef`.
- Confirm no included order has an active dispute, refund debit, unsettled COD state, or existing active payout.
- Confirm available seller balance is sufficient.
- Confirm payout amount equals included eligible ledger amounts.
- Confirm payout approver is not the same person who created a questionable adjustment.

After payout completion:

- Confirm `payout_debit` exists.
- Confirm seller `availableBalance` decreases and `paidBalance` increases by the payout amount.
- Confirm bank/payment reference is recorded if money was actually disbursed outside the system.

## Weekly Reconciliation Workflow

Perform weekly review after all daily reconciliations for the week are complete.

- Review all unresolved daily variances and owner assignments.
- Age unsettled COD orders by driver and delivery date.
- Age active disputes and pending refunds.
- Review seller balances with large pending, hold, or available amounts.
- Review payout requests or payout candidates for unsettled COD or dispute exposure.
- Sample proof-of-delivery evidence against delivered COD orders.
- Check for duplicate ledger transaction patterns by `orderId`, `shopId`, and transaction type.
- Check admin/audit logs for manual adjustment attempts, settlement retries, and payout status changes.
- Prepare a weekly finance signoff summary for the business owner.

Weekly close is not complete while high-risk variances remain unresolved.

## Monthly Reconciliation Workflow

Perform monthly close only after daily and weekly reconciliation packs are complete.

- Lock the month-end reconciliation window.
- Export month-end order, settlement, ledger, dispute, payout, and driver balance reports.
- Confirm opening balance plus movements equals closing balance for each seller.
- Confirm all driver COD balances are explained by unsettled orders, approved variances, or cash receipts.
- Confirm all completed payouts map to payout debits and external payment references.
- Confirm all refunds/disputes have final status or documented carry-forward status.
- Review revenue/platform fee totals against order totals.
- Archive the approved evidence pack.
- Capture open variances as next-period carry-forward items with owner and due date.

Do not close the month while unresolved cash, ledger, payout, or dispute variances remain unapproved.

## Exception Handling

### Duplicate Delivery Attempt

Indicators:

- Same order has multiple attempted delivery completions.
- Driver stats, COD amount, proof-of-delivery, or settlement fields appear inconsistent.

Required action:

- Confirm the order has only one final `deliveredAt`.
- Confirm driver COD balance increased only once.
- Confirm seller ledger has no duplicate credit.
- Confirm settlement batch includes the order at most once.
- Escalate to engineering if any duplicate mutation appears.

Do not manually create a compensating ledger entry until finance and engineering identify the actual duplicated movement.

### Missing COD Collection

Indicators:

- Order is delivered but `codCollected` is false or missing.
- Driver reports cash collected, but system does not show it.
- System shows cash collected, but driver cannot produce cash or receipt.

Required action:

- Place order in exception queue.
- Hold settlement and seller payout for the order.
- Confirm delivery proof, customer communication, driver note, and cash receipt.
- Support/driver operations determine whether customer paid, payment was waived, or collection failed.
- Finance owner approves any correction before settlement.

Do not settle or pay out the order until the COD collection state is resolved.

### Disputed Delivery

Indicators:

- Customer disputes a delivered order.
- Support case indicates missing, damaged, wrong, late, or unacceptable delivery.
- COD refund responsibility is unclear.

Required action:

- Exclude the order from payout readiness.
- Freeze or hold seller earnings if already credited.
- Attach proof-of-delivery, customer evidence, seller response, and driver notes.
- Admin/support records refund, payout, liability, and COD resolution decision.
- Release or debit seller earnings only after approved final resolution.

Do not override a dispute or release payout without evidence and approver notes.

### Refunded Order

Indicators:

- Approved refund decision exists.
- Customer refund is required or goodwill refund is approved.
- Seller earning was already credited or released.

Required action:

- Confirm refund decision, liability, and COD cash responsibility.
- Confirm seller ledger contains appropriate `refund_debit` or approved alternative treatment.
- Confirm payout eligibility excludes refunded earnings.
- If payout already occurred, escalate to finance/business owner for clawback or adjustment decision.

Do not hide refunds as manual balance edits. Use documented ledger treatment and approvals.

### Driver Cash Mismatch

Indicators:

- Driver physical cash differs from system COD balance.
- Settlement batch total differs from cash receipt.
- Driver balance unexpectedly changes outside settlement.

Required action:

- Pause that driver's COD settlement.
- Recalculate expected cash by order.
- Verify all delivery completion times, COD amounts, and settlement refs.
- Check for missing cash receipt, wrong driver assignment, duplicate delivery attempt, or unrecorded refund.
- Escalate material mismatches to finance owner and driver operations owner.
- Engineering reviews logs/audit records if system mutation is suspected.

Do not reset driver cash balance manually without approval, evidence, and a documented adjustment plan.

### Seller Payout Mismatch

Indicators:

- Payout amount differs from eligible seller ledger.
- Payout includes unsettled COD, active dispute, refunded order, or already paid order.
- Seller balance does not reconcile after payout completion.

Required action:

- Pause payout processing for the seller.
- Export included order IDs and ledger transactions.
- Confirm each included COD order has settlement evidence.
- Confirm payout debit amount and external payment reference.
- Escalate to finance/business owner before retrying or cancelling payout.

Do not issue a seller payout on unsettled COD or unresolved disputed earnings.

## Approval And Escalation Rules

| Scenario | Required approval |
| --- | --- |
| Routine zero-variance daily reconciliation | Finance operations owner. |
| COD settlement batch with matching cash receipt | Finance operations owner or delegated admin operations owner. |
| Any cash variance | Finance operations owner and driver operations owner. |
| Material cash variance above agreed threshold | Business owner plus finance operations owner. |
| Manual ledger/cash correction | Finance operations owner, business owner, and engineering review if system data changes are needed. |
| Refund or dispute override | Support owner and business owner. |
| Payout containing any exception history | Finance operations owner and business owner. |
| Period close with carry-forward variances | Business owner signoff required. |

Escalate immediately if customer money, seller payout, production data integrity, or audit evidence is at risk.

## Manual Action Guardrails

- No manual cash or ledger edits without approval, evidence, and an audit trail.
- No seller payout on unsettled COD.
- No dispute or refund override without evidence.
- No closing a reconciliation period with unresolved variances.
- No direct production database mutation for reconciliation unless engineering and business owners approve an incident procedure.
- No deleting order, driver, settlement, seller transaction, payout, support, or audit records to make reports match.
- No running smoke tests against production MongoDB.
- No using card payment states as proof of payment during COD-only launch.
- No settlement retry without checking whether a prior settlement partially succeeded.
- No payout retry without checking for an existing active or completed payout record.

## Evidence And Audit Retention

Retain a complete evidence pack for each daily reconciliation and each settlement batch.

Minimum evidence:

- Date/time window and preparer.
- Orders export.
- Driver COD and balance export.
- Cash handover/deposit receipt.
- Settlement candidate export before settlement.
- Settlement batch result with `settlementRef`.
- Seller transaction export after settlement.
- Dispute/refund evidence and decision notes.
- Payout export and external payment reference where applicable.
- Approval notes and approver identity.
- Screenshots or immutable exports for any manual review item.

Retention period is an open business decision. Until a policy is approved, keep reconciliation evidence indefinitely or according to the strictest finance/legal requirement available.

## Verification Checklist

Use this checklist before declaring reconciliation complete.

Daily:

- [ ] COD order count reconciles to checkout/order export.
- [ ] Delivered COD orders reconcile to driver delivery records.
- [ ] Driver collected COD total reconciles to driver cash balance and cash receipt.
- [ ] COD settlement batches reconcile to included orders and settlement refs.
- [ ] Seller `cod_credit` records exist once per eligible settled shop/order share.
- [ ] Disputed/refunded orders are excluded from payout readiness.
- [ ] Payout candidates exclude unsettled COD and active disputes.
- [ ] Variances have owner, evidence, and due date.

Weekly:

- [ ] All daily variance logs reviewed.
- [ ] Aged unsettled COD report reviewed.
- [ ] Aged dispute/refund report reviewed.
- [ ] Seller balance samples tie to ledger.
- [ ] Driver cash balances tie to unsettled orders or approved variances.
- [ ] Audit/admin activity reviewed for settlement, payout, and adjustment actions.

Monthly:

- [ ] Opening balances plus movements equal closing balances.
- [ ] Payouts tie to payout debits and external payment references.
- [ ] Refunds/disputes tie to approved ledger treatment.
- [ ] Carry-forward exceptions are approved.
- [ ] Evidence pack archived.
- [ ] Business owner approves period close.

## Open Decisions And Placeholders

| Decision | Placeholder |
| --- | --- |
| Daily cutoff time and timezone | TBD. |
| Finance evidence storage location | TBD. |
| Retention period for reconciliation packs | TBD. |
| Material variance threshold | TBD. |
| COD cash handover method and required receipt format | TBD. |
| Payout hold period and dispute window | TBD. |
| External bank/payment reference requirements | TBD. |
| Monthly close approver | TBD. |
| Seller communication template for payout holds | TBD. |
| Customer communication template for COD refund handling | TBD. |
| Long-term automated reconciliation report owner | TBD. |

