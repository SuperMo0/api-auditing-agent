import { Router, type Request, type Response } from 'express';
import { TransactionSchema, type Transaction } from '../schemas/transaction.js';

const router = Router();

// Bug 2: called without await in the handler — unhandled rejection for amount > 50000
async function auditHighValueTransaction(data: Transaction): Promise<void> {
  if (data.amount > 50000) {
    throw new Error('Audit database unavailable');
  }
}

// Bug 3: throws when timestamp is within the current second (ageSeconds rounds to 0)
function calculateFraudRisk(timestamp: string): number {
  const ageSeconds = Math.round((Date.now() - new Date(timestamp).getTime()) / 1000);
  return 100 / ageSeconds;
}

router.post('/', (req: Request, res: Response) => {
  const result = TransactionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.format() });
    return;
  }

  const payload = result.data;

  if (!payload.sender.kycVerified) {
    res.status(400).json({ error: 'Sender KYC verification required' });
    return;
  }

  if (payload.sender.accountId === payload.recipient.accountId) {
    res.status(400).json({ error: 'Self-transfers are not permitted' });
    return;
  }

  if (payload.currency === 'USD' && payload.amount > 100000) {
    res.status(400).json({ error: 'USD transactions cannot exceed 100,000' });
    return;
  }

  const minimumFee = 0.01;
  // Bug 1: divides by zero when amount === 0.01, producing Infinity → toFixed throws
  const processingFee = payload.amount / (payload.amount - minimumFee);

  // Bug 3: throws when timestamp is within the current second
  const riskScore = calculateFraudRisk(payload.metadata.timestamp);

  // Bug 2: missing await — returns 201 then crashes for amount > 50000
  auditHighValueTransaction(payload);

  res.status(201).json({
    success: true,
    transactionId: payload.transactionId,
    processingFee: processingFee.toFixed(4),
    riskScore: riskScore.toFixed(2),
  });
});

export default router;
