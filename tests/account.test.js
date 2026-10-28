const request = require('supertest');
const app = require('../src/app');
require('./setup');

describe('Account API Endpoints', () => {
  describe('POST /api/v1/accounts - Create Account', () => {
    it('should successfully create a new account with balance = 0', async () => {
      const res = await request(app)
        .post('/api/v1/accounts')
        .send({ name: 'Alice Smith' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(typeof res.body.data.id).toBe('string');
      expect(res.body.data.name).toBe('Alice Smith');
      expect(res.body.data.balance).toBe(0);
      expect(res.body.data).toHaveProperty('created_at');
    });

    it('should fail with 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/v1/accounts')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should fail with 400 when name is empty string or only whitespace', async () => {
      const res = await request(app)
        .post('/api/v1/accounts')
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should fail with 400 when client tries to set initial balance', async () => {
      const res = await request(app)
        .post('/api/v1/accounts')
        .send({ name: 'Bob Jones', balance: 500 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Client is not allowed to set initial balance');
    });

    it('should generate unique IDs for different accounts', async () => {
      const res1 = await request(app)
        .post('/api/v1/accounts')
        .send({ name: 'User One' });

      const res2 = await request(app)
        .post('/api/v1/accounts')
        .send({ name: 'User Two' });

      expect(res1.body.data.id).not.toBe(res2.body.data.id);
    });
  });

  describe('GET /api/v1/accounts/:accountId/balance - Get Account Balance', () => {
    it('should return balance of an existing account', async () => {
      const createRes = await request(app)
        .post('/api/v1/accounts')
        .send({ name: 'Charlie' });

      const accountId = createRes.body.data.id;

      const res = await request(app).get(`/api/v1/accounts/${accountId}/balance`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.account_id).toBe(accountId);
      expect(res.body.data.balance).toBe(0);
    });

    it('should return 404 when account does not exist', async () => {
      const res = await request(app).get('/api/v1/accounts/non_existent_acc_123/balance');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
    });
  });

  describe('GET /api/v1/accounts/:accountId - Get Account By ID', () => {
    it('should return account details', async () => {
      const createRes = await request(app)
        .post('/api/v1/accounts')
        .send({ name: 'Diana' });

      const accountId = createRes.body.data.id;

      const res = await request(app).get(`/api/v1/accounts/${accountId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(accountId);
      expect(res.body.data.name).toBe('Diana');
      expect(res.body.data.balance).toBe(0);
    });

    it('should return 404 if account does not exist', async () => {
      const res = await request(app).get('/api/v1/accounts/non_existent_id');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
