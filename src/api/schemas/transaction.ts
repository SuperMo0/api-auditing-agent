import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const SenderSchema = z.object({
  accountId: z.string().regex(/^[a-zA-Z0-9]{8,16}$/).openapi({ description: '8–16 alphanumeric characters' }),
  name: z.string().min(2).max(50),
  kycVerified: z.boolean(),
}).openapi('Sender');

export const RecipientSchema = z.object({
  accountId: z.string().regex(/^[a-zA-Z0-9]{8,16}$/).openapi({ description: '8–16 alphanumeric characters' }),
  name: z.string().min(2).max(50),
  bankCode: z.string().regex(/^\d{9}$/).openapi({ description: 'ABA routing number — exactly 9 digits' }),
}).openapi('Recipient');

export const MetadataSchema = z.object({
  ipAddress: z.ipv4(),
  userAgent: z.string().max(200),
  timestamp: z.string().datetime(),
}).openapi('TransactionMetadata');

export const TransactionSchema = z.object({
  transactionId: z.string().uuid(),
  amount: z.number().positive().multipleOf(0.01).max(999999.99),
  currency: z.enum(['USD', 'EUR', 'GBP']),
  sender: SenderSchema,
  recipient: RecipientSchema,
  metadata: MetadataSchema,
}).openapi('Transaction');

export type Transaction = z.infer<typeof TransactionSchema>;
