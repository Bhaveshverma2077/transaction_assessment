const request = require('supertest');
const app = require('../src/app');
require('./setup');

describe('Bonus: Money Transfer API - POST /api/v1/transfers', () => {
  let accountA, accountB;

  beforeEach(async () => {
    // Create Account A with 100
    const resA = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Account A' });
    accountA = resA.body.data;

    await request(app)
      .post(`/api/v1/accounts/${accountA.id}/transactions`)
      .send({ type: 'credit', amount: 100, reference_id: 'fund-a' });

    // Create Account B with 50
    const resB = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Account B' });
    accountB = resB.body.data;

    await request(app)
      .post(`/api/v1/accounts/${accountB.id}/transactions`)
      .send({ type: 'credit', amount: 50, reference_id: 'fund-b' });
  });

  it('should successfully transfer 30 from A to B: A becomes 70, B becomes 80 (Assignment Example)', async () => {
    const res = await request(app)
      .post('/api/v1/transfers')
      .send({
        from_account_id: accountA.id,
        to_account_id: accountB.id,
        amount: 30,
        description: 'Payment for invoice',
        reference_id: 'transfer-ref-001',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.from_account.new_balance).toBe(70);
    expect(res.body.data.to_account.new_balance).toBe(80);

    // Verify account A balance
    const balA = await request(app).get(`/api/v1/accounts/${accountA.id}/balance`);
    expect(balA.body.data.balance).toBe(70);

    // Verify account B balance
    const balB = await request(app).get(`/api/v1/accounts/${accountB.id}/balance`);
    expect(balB.body.data.balance).toBe(80);

    // Verify Account A has a debit transaction
    const histA = await request(app).get(`/api/v1/accounts/${accountA.id}/transactions?type=debit`);
    expect(histA.body.data).toHaveLength(1);
    expect(histA.body.data[0].amount).toBe(30);

    // Verify Account B has a credit transaction
    const histB = await request(app).get(`/api/v1/accounts/${accountB.id}/transactions?type=credit`);
    // Account B had initial credit of 50 + transfer credit of 30
    expect(histB.body.data).toHaveLength(2);
    expect(histB.body.data[0].amount).toBe(30);
  });

  it('should reject transfer when source account has insufficient balance', async () => {
    // Attempt to transfer 200 from A (balance is 100)
    const res = await request(app)
      .post('/api/v1/transfers')
      .send({
        from_account_id: accountA.id,
        to_account_id: accountB.id,
        amount: 200,
        reference_id: 'transfer-overdraft',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);

    // Verify balances remain untouched
    const balA = await request(app).get(`/api/v1/accounts/${accountA.id}/balance`);
    const balB = await request(app).get(`/api/v1/accounts/${accountB.id}/balance`);
    expect(balA.body.data.balance).toBe(100);
    expect(balB.body.data.balance).toBe(50);
  });

  it('should reject transfer when from_account_id and to_account_id are the same', async () => {
    const res = await request(app)
      .post('/api/v1/transfers')
      .send({
        from_account_id: accountA.id,
        to_account_id: accountA.id,
        amount: 25,
        reference_id: 'transfer-self',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TRANSFER_SAME_ACCOUNT');
  });

  it('should reject duplicate reference_id for transfers', async () => {
    const transferPayload = {
      from_account_id: accountA.id,
      to_account_id: accountB.id,
      amount: 10,
      reference_id: 'dup-transfer-ref',
    };

    const res1 = await request(app).post('/api/v1/transfers').send(transferPayload);
    expect(res1.status).toBe(201);

    const res2 = await request(app).post('/api/v1/transfers').send(transferPayload);
    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe('DUPLICATE_TRANSACTION');
  });

  it('should return 404 when source or destination account does not exist', async () => {
    const res = await request(app)
      .post('/api/v1/transfers')
      .send({
        from_account_id: 'non_existent_account',
        to_account_id: accountB.id,
        amount: 10,
        reference_id: 'transfer-orphan',
      });

    expect(res.status).toBe(404);
  });
});
