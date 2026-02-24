-- Reclassify bill payment transactions from INCOME/EXPENSE to TRANSFER.
-- Payment transactions move money between balance sheet accounts (Cash <-> AP/AR)
-- and should not be counted as income or expense (the accrual already records that).

UPDATE transactions
SET type = 'TRANSFER'
WHERE id IN (
    SELECT DISTINCT bp.transaction_id
    FROM bill_payments bp
)
AND type IN ('INCOME', 'EXPENSE');
