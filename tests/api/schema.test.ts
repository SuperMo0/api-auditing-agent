import { describe, it, expect } from 'vitest';
import { TransactionSchema } from '../../src/api/schemas/transaction.js';

const validPayload = {
  transactionId: '123e4567-e89b-12d3-a456-426614174000',
  amount: 100.50,
  currency: 'USD',
  sender: {
    accountId: 'ACCT1234',
    name: 'Alice Smith',
    kycVerified: true,
  },
  recipient: {
    accountId: 'ACCT5678',
    name: 'Bob Jones',
    bankCode: '021000021',
  },
  metadata: {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    timestamp: '2026-01-15T10:30:00.000Z',
  },
};

describe('TransactionSchema', () => {
  it('accepts a valid payload', () => {
    expect(TransactionSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejects a non-UUID transactionId', () => {
    const result = TransactionSchema.safeParse({ ...validPayload, transactionId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects a negative amount', () => {
    const result = TransactionSchema.safeParse({ ...validPayload, amount: -10 });
    expect(result.success).toBe(false);
  });

  it('rejects an unsupported currency', () => {
    const result = TransactionSchema.safeParse({ ...validPayload, currency: 'JPY' });
    expect(result.success).toBe(false);
  });

  it('rejects a bankCode that is not exactly 9 digits', () => {
    const result = TransactionSchema.safeParse({
      ...validPayload,
      recipient: { ...validPayload.recipient, bankCode: '12345' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid IPv4 address', () => {
    const result = TransactionSchema.safeParse({
      ...validPayload,
      metadata: { ...validPayload.metadata, ipAddress: 'not-an-ip' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an accountId shorter than 8 characters', () => {
    const result = TransactionSchema.safeParse({
      ...validPayload,
      sender: { ...validPayload.sender, accountId: 'ABC' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts amount with exactly 2 decimal places', () => {
    const result = TransactionSchema.safeParse({ ...validPayload, amount: 99.99 });
    expect(result.success).toBe(true);
  });
});
