import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/server.js';

const app = createApp();

const validPayload = {
  transactionId: '123e4567-e89b-12d3-a456-426614174000',
  amount: 100.50,
  currency: 'USD',
  sender: { accountId: 'ACCT1234', name: 'Alice Smith', kycVerified: true },
  recipient: { accountId: 'ACCT5678', name: 'Bob Jones', bankCode: '021000021' },
  metadata: {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    timestamp: '2026-01-15T10:30:00.000Z',
  },
};

describe('POST /api/v1/transactions', () => {
  it('returns 201 for a valid payload', async () => {
    const res = await request(app).post('/api/v1/transactions').send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 for an empty body', async () => {
    const res = await request(app).post('/api/v1/transactions').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for invalid currency', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .send({ ...validPayload, currency: 'JPY' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when kycVerified is false', async () => {
    const res = await request(app).post('/api/v1/transactions').send({
      ...validPayload,
      sender: { ...validPayload.sender, kycVerified: false },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Sender KYC verification required');
  });

  it('returns 400 for self-transfer', async () => {
    const res = await request(app).post('/api/v1/transactions').send({
      ...validPayload,
      recipient: { ...validPayload.recipient, accountId: 'ACCT1234' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Self-transfers are not permitted');
  });

  it('returns 400 for USD amount over 100000', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .send({ ...validPayload, amount: 100001 });
    expect(res.status).toBe(400);
  });
});

describe('GET /docs.json', () => {
  it('returns a valid OpenAPI 3.0 spec', async () => {
    const res = await request(app).get('/docs.json');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('openapi', '3.0.0');
    expect(res.body.paths).toHaveProperty('/api/v1/transactions');
  });
});
