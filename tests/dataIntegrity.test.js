const request = require('supertest');
const app = require('../src/app');
require('./setup');

describe('Data Integrity & Immutability', () => {
  let testAccount;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Integrity Test Account' });
    testAccount = res.body.data;
  });

  describe('Transaction Immutability', () => {
    let createdTxnId;

    beforeEach(async () => {
      const txnRes = await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({
          type: 'credit',
          amount: 100,
          description: 'Immutable test txn',
          reference_id: 'immut-1',
        });
      createdTxnId = txnRes.body.data.id;
    });

    it('should reject PUT operations on transactions with 405 Method Not Allowed', async () => {
      const res1 = await request(app)
        .put(`/api/v1/accounts/${testAccount.id}/transactions/${createdTxnId}`)
        .send({ amount: 200 });

      expect(res1.status).toBe(405);
      expect(res1.body.success).toBe(false);

      const res2 = await request(app)
        .put(`/api/v1/transactions/${createdTxnId}`)
        .send({ amount: 200 });

      expect(res2.status).toBe(405);
    });

    it('should reject PATCH operations on transactions with 405 Method Not Allowed', async () => {
      const res = await request(app)
        .patch(`/api/v1/transactions/${createdTxnId}`)
        .send({ description: 'Altered description' });

      expect(res.status).toBe(405);
      expect(res.body.success).toBe(false);
    });

    it('should reject DELETE operations on transactions with 405 Method Not Allowed', async () => {
      const res1 = await request(app)
        .delete(`/api/v1/accounts/${testAccount.id}/transactions/${createdTxnId}`);

      expect(res1.status).toBe(405);
      expect(res1.body.success).toBe(false);

      const res2 = await request(app)
        .delete(`/api/v1/transactions/${createdTxnId}`);

      expect(res2.status).toBe(405);
    });
  });

  describe('Balance Consistency - Assignment Specification Walkthrough', () => {
    it('should match the exact sequence specified in assignment: 0 -> +100 -> +50 -> -30 -> -20 = 100', async () => {
      // Initial balance: 0
      const initBalance = await request(app).get(`/api/v1/accounts/${testAccount.id}/balance`);
      expect(initBalance.body.data.balance).toBe(0);

      // Credit: 100
      await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({ type: 'credit', amount: 100, reference_id: 'step-1' });

      // Credit: 50
      await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({ type: 'credit', amount: 50, reference_id: 'step-2' });

      // Debit: 30
      await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({ type: 'debit', amount: 30, reference_id: 'step-3' });

      // Debit: 20
      await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({ type: 'debit', amount: 20, reference_id: 'step-4' });

      // Final balance must be 100
      const finalBalanceRes = await request(app).get(`/api/v1/accounts/${testAccount.id}/balance`);
      expect(finalBalanceRes.body.data.balance).toBe(100);

      // Verify mathematical balance consistency through audit endpoint
      const auditRes = await request(app).get(`/api/v1/accounts/${testAccount.id}/verify-balance`);
      expect(auditRes.status).toBe(200);
      expect(auditRes.body.data.stored_balance).toBe(100);
      expect(auditRes.body.data.calculated_balance).toBe(100);
      expect(auditRes.body.data.is_consistent).toBe(true);
      expect(auditRes.body.data.transaction_count).toBe(4);
    });

    it('should ensure rejected or failed transactions do not alter balance', async () => {
      // Fund 100
      await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({ type: 'credit', amount: 100, reference_id: 'f-1' });

      // Failed debit (insufficient funds)
      const failedDebit = await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({ type: 'debit', amount: 500, reference_id: 'fail-overdraft' });
      expect(failedDebit.status).toBe(422);

      // Failed duplicate reference
      const failedDup = await request(app)
        .post(`/api/v1/accounts/${testAccount.id}/transactions`)
        .send({ type: 'credit', amount: 50, reference_id: 'f-1' });
      expect(failedDup.status).toBe(409);

      // Balance remains 100
      const auditRes = await request(app).get(`/api/v1/accounts/${testAccount.id}/verify-balance`);
      expect(auditRes.body.data.stored_balance).toBe(100);
      expect(auditRes.body.data.calculated_balance).toBe(100);
      expect(auditRes.body.data.is_consistent).toBe(true);
      expect(auditRes.body.data.transaction_count).toBe(1);
    });
  });
});
