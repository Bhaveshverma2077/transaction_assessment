const request = require('supertest');
const app = require('../src/app');
require('./setup');

describe('Transaction API Endpoints', () => {
  let testAccount;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Ledger Test Account' });
    testAccount = res.body.data;
  });

  describe('POST /api/v1/accounts/:accountId/transactions - Credit Transactions', () => {
    it('should successfully credit an account and update balance', async () => {
      const res = await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({
          type: 'credit',
          amount: 100.5,
          description: 'Initial deposit',
          reference_id: 'ref-credit-001',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.account_id).toBe(testAccount.id);
      expect(res.body.data.type).toBe('credit');
      expect(res.body.data.amount).toBe(100.5);
      expect(res.body.data.description).toBe('Initial deposit');
      expect(res.body.data.reference_id).toBe('ref-credit-001');
      expect(res.body.data).toHaveProperty('created_at');

      // Verify account balance updated
      const balanceRes = await request(app).get(`/api/v1/accounts/${testAccount.id}/balance`);
      expect(balanceRes.body.data.balance).toBe(100.5);
    });

    it('should accumulate consecutive credits correctly', async () => {
      // Credit 100
      await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({
          type: 'credit',
          amount: 100,
          reference_id: 'ref-c-1',
        });

      // Credit 50
      await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({
          type: 'credit',
          amount: 50,
          reference_id: 'ref-c-2',
        });

      const balanceRes = await request(app).get(`/api/v1/accounts/${testAccount.id}/balance`);
      expect(balanceRes.body.data.balance).toBe(150);
    });
  });

  describe('POST /api/v1/accounts/:accountId/transactions - Debit Transactions', () => {
    beforeEach(async () => {
      // Fund account with 100
      await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({
          type: 'credit',
          amount: 100,
          reference_id: 'funding-ref',
        });
    });

    it('should successfully debit account when sufficient balance exists', async () => {
      const res = await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({
          type: 'debit',
          amount: 30,
          description: 'Payment for groceries',
          reference_id: 'ref-debit-001',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('debit');
      expect(res.body.data.amount).toBe(30);

      // Verify balance is 70 (100 - 30)
      const balanceRes = await request(app).get(`/api/v1/accounts/${testAccount.id}/balance`);
      expect(balanceRes.body.data.balance).toBe(70);
    });

    it('should reject debit transaction when insufficient balance and keep balance unchanged', async () => {
      // Attempt to debit 150 when balance is 100
      const res = await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({
          type: 'debit',
          amount: 150,
          description: 'Overdraft attempt',
          reference_id: 'ref-debit-insufficient',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');

      // Verify balance remains 100
      const balanceRes = await request(app).get(`/api/v1/accounts/${testAccount.id}/balance`);
      expect(balanceRes.body.data.balance).toBe(100);
    });
  });

  describe('Duplicate reference_id handling', () => {
    it('should reject duplicate reference_id for the same account and keep balance unchanged', async () => {
      // First transaction
      const res1 = await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({
          type: 'credit',
          amount: 50,
          reference_id: 'unique-ref-xyz',
        });
      expect(res1.status).toBe(201);

      // Second transaction with SAME reference_id
      const res2 = await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({
          type: 'credit',
          amount: 50,
          reference_id: 'unique-ref-xyz',
        });

      expect(res2.status).toBe(409);
      expect(res2.body.success).toBe(false);
      expect(res2.body.error.code).toBe('DUPLICATE_TRANSACTION');

      // Verify balance is still 50, NOT 100
      const balanceRes = await request(app).get(`/api/v1/accounts/${testAccount.id}/balance`);
      expect(balanceRes.body.data.balance).toBe(50);
    });

    it('should allow the same reference_id for different accounts', async () => {
      const otherAccountRes = await request(app)
        .post('/api/v1/accounts')
        .send({ name: 'Second Account' });
      const otherAccount = otherAccountRes.body.data;

      const sharedRef = 'shared-reference-id';

      // First account uses sharedRef
      const res1 = await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({
          type: 'credit',
          amount: 50,
          reference_id: sharedRef,
        });
      expect(res1.status).toBe(201);

      // Second account uses SAME sharedRef
      const res2 = await request(app)
        .post(`/api/v1/accounts/${otherAccount.id}/transactions`)
        .send({
          type: 'credit',
          amount: 75,
          reference_id: sharedRef,
        });
      expect(res2.status).toBe(201);

      // Both balances correct
      const b1 = await request(app).get(`/api/v1/accounts/${testAccount.id}/balance`);
      const b2 = await request(app).get(`/api/v1/accounts/${otherAccount.id}/balance`);
      expect(b1.body.data.balance).toBe(50);
      expect(b2.body.data.balance).toBe(75);
    });
  });

  describe('Direct transaction endpoint: POST /api/v1/transactions', () => {
    it('should support adding transaction directly with account_id in body', async () => {
      const res = await request(app)
        .post('/api/v1/transactions')
        .send({
          account_id: testAccount.id,
          type: 'credit',
          amount: 250,
          description: 'Direct transaction API',
          reference_id: 'ref-direct-001',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.account_id).toBe(testAccount.id);
      expect(res.body.data.amount).toBe(250);

      const balanceRes = await request(app).get(`/api/v1/accounts/${testAccount.id}/balance`);
      expect(balanceRes.body.data.balance).toBe(250);
    });
  });

  describe('Validation errors', () => {
    it('should return 400 when transaction type is invalid', async () => {
      const res = await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({
          type: 'invalid_type',
          amount: 50,
          reference_id: 'ref-invalid-type',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when amount is 0 or negative', async () => {
      const res1 = await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({
          type: 'credit',
          amount: 0,
          reference_id: 'ref-zero',
        });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({
          type: 'credit',
          amount: -50,
          reference_id: 'ref-negative',
        });
      expect(res2.status).toBe(400);
    });

    it('should return 400 when reference_id is missing or empty', async () => {
      const res = await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({
          type: 'credit',
          amount: 50,
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 when adding transaction to non-existent account', async () => {
      const res = await request(app)
        .post('/api/v1/accounts/non_existent_account/transactions')
        .send({
          type: 'credit',
          amount: 50,
          reference_id: 'ref-orphan',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
    });
  });

  describe('GET /api/v1/accounts/:accountId/transactions - Transaction History', () => {
    beforeEach(async () => {
      // Create 5 transactions: 3 credits and 2 debits
      await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({ type: 'credit', amount: 100, reference_id: 'h-1' });

      await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({ type: 'credit', amount: 50, reference_id: 'h-2' });

      await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({ type: 'debit', amount: 30, reference_id: 'h-3' });

      await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({ type: 'credit', amount: 20, reference_id: 'h-4' });

      await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({ type: 'debit', amount: 10, reference_id: 'h-5' });
    });

    it('should return all transactions sorted latest-first when no filter is provided', async () => {
      const res = await request(app).get(`/api/v1/accounts/${testAccount.id}/transactions`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.pagination.total_records).toBe(5);

      // Verify latest-first order
      const timestamps = res.body.data.map((t) => new Date(t.created_at).getTime());
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
      }
    });

    it('should filter transactions by type=credit', async () => {
      const res = await request(app).get(
        `/api/v1/accounts/${testAccount.id}/transactions?type=credit`
      );

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.pagination.total_records).toBe(3);
      res.body.data.forEach((txn) => {
        expect(txn.type).toBe('credit');
      });
    });

    it('should filter transactions by type=debit', async () => {
      const res = await request(app).get(
        `/api/v1/accounts/${testAccount.id}/transactions?type=debit`
      );

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total_records).toBe(2);
      res.body.data.forEach((txn) => {
        expect(txn.type).toBe('debit');
      });
    });

    it('should paginate results correctly with page and limit', async () => {
      const page1Res = await request(app).get(
        `/api/v1/accounts/${testAccount.id}/transactions?page=1&limit=2`
      );

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.data).toHaveLength(2);
      expect(page1Res.body.pagination.page).toBe(1);
      expect(page1Res.body.pagination.limit).toBe(2);
      expect(page1Res.body.pagination.total_records).toBe(5);
      expect(page1Res.body.pagination.total_pages).toBe(3);
      expect(page1Res.body.pagination.has_next_page).toBe(true);

      const page2Res = await request(app).get(
        `/api/v1/accounts/${testAccount.id}/transactions?page=2&limit=2`
      );

      expect(page2Res.body.data).toHaveLength(2);
      expect(page2Res.body.pagination.page).toBe(2);

      // Verify different items returned across pages
      expect(page1Res.body.data[0].id).not.toBe(page2Res.body.data[0].id);
    });

    it('should return 404 when fetching transaction history for non-existent account', async () => {
      const res = await request(app).get('/api/v1/accounts/non_existent_acc/transactions');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
    });

    it('should return 400 when invalid filter type is provided', async () => {
      const res = await request(app).get(
        `/api/v1/accounts/${testAccount.id}/transactions?type=unknown`
      );

      expect(res.status).toBe(400);
    });
  });
});
