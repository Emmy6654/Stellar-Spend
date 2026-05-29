import { getRecordsByStatus, getRecord } from "../webhook/delivery-store";
import { list as listDLQ, replay as replayDLQ } from "../webhook/dlq";
import { updateRecord } from "../webhook/delivery-store";

// ─── Context ────────────────────────────────────────────────────────────────

export interface GraphQLContext {
  userId?: string;
  isPremium?: boolean;
  isAuthenticated: boolean;
}

// ─── Query Resolvers ─────────────────────────────────────────────────────────

const Query = {
  async transaction(_: unknown, { id }: { id: string }, ctx: GraphQLContext) {
    requireAuth(ctx);
    // Fetch from DB via existing DAL
    const { getTransactionById } = await import("../db/dal");
    return getTransactionById(id);
  },

  async transactions(
    _: unknown,
    { limit = 20, offset = 0, status }: { limit?: number; offset?: number; status?: string },
    ctx: GraphQLContext,
  ) {
    requireAuth(ctx);
    const { getTransactions } = await import("../db/dal");
    return getTransactions({ limit, offset, status });
  },

  async quote(
    _: unknown,
    { amount, currency, feeMethod = "USDC" }: { amount: string; currency: string; feeMethod?: string },
    ctx: GraphQLContext,
  ) {
    requireAuth(ctx);
    const { getQuote } = await import("../services/quote.service");
    return getQuote({ amount, currency, feeMethod });
  },

  async currencies(_: unknown, __: unknown, ctx: GraphQLContext) {
    requireAuth(ctx);
    const { getCurrencies } = await import("../currencies");
    return getCurrencies();
  },

  async institutions(_: unknown, { currency }: { currency: string }, ctx: GraphQLContext) {
    requireAuth(ctx);
    const { getInstitutions } = await import("../currencies");
    return getInstitutions(currency);
  },

  async rate(_: unknown, { currency = "NGN" }: { currency?: string }, ctx: GraphQLContext) {
    requireAuth(ctx);
    const { getRate } = await import("../services/quote.service");
    const rate = await getRate(currency);
    return { rate, currency, updatedAt: new Date().toISOString() };
  },

  async webhookDelivery(_: unknown, { id }: { id: string }, ctx: GraphQLContext) {
    requireAuth(ctx);
    return getRecord(id);
  },

  async webhookDeliveries(
    _: unknown,
    { status = "pending", limit = 50 }: { status?: string; limit?: number },
    ctx: GraphQLContext,
  ) {
    requireAuth(ctx);
    const records = await getRecordsByStatus(status as "pending" | "delivered" | "failed");
    return records.slice(0, limit);
  },

  async webhookStats(_: unknown, __: unknown, ctx: GraphQLContext) {
    requireAuth(ctx);
    const [pending, delivered, failed, dlqEntries] = await Promise.all([
      getRecordsByStatus("pending"),
      getRecordsByStatus("delivered"),
      getRecordsByStatus("failed"),
      listDLQ(),
    ]);
    return {
      pending: pending.length,
      delivered: delivered.length,
      failed: failed.length,
      dlqCount: dlqEntries.length,
    };
  },

  async dlqEntries(_: unknown, { limit = 50 }: { limit?: number }, ctx: GraphQLContext) {
    requireAuth(ctx);
    const entries = await listDLQ();
    return entries.slice(0, limit);
  },
};

// ─── Mutation Resolvers ───────────────────────────────────────────────────────

const Mutation = {
  async replayWebhook(_: unknown, { dlqEntryId }: { dlqEntryId: string }, ctx: GraphQLContext) {
    requireAuth(ctx);
    return replayDLQ(dlqEntryId);
  },

  async retryWebhookDelivery(_: unknown, { deliveryId }: { deliveryId: string }, ctx: GraphQLContext) {
    requireAuth(ctx);
    const record = await getRecord(deliveryId);
    if (!record) throw new Error(`Delivery ${deliveryId} not found`);
    return updateRecord(deliveryId, {
      status: "pending",
      nextAttemptAt: new Date().toISOString(),
    });
  },
};

// ─── Subscription Resolvers ───────────────────────────────────────────────────

export const subscriptions = {
  transactionStatusChanged: {
    // In production, use a pub/sub system (Redis, etc.)
    subscribe: async function* (_: unknown, { id }: { id: string }) {
      // Placeholder: poll every 5 seconds
      while (true) {
        await new Promise((r) => setTimeout(r, 5000));
        const { getTransactionById } = await import("../db/dal");
        const tx = await getTransactionById(id);
        if (tx) yield { transactionStatusChanged: tx };
      }
    },
  },

  rateUpdated: {
    subscribe: async function* (_: unknown, { currency = "NGN" }: { currency?: string }) {
      while (true) {
        await new Promise((r) => setTimeout(r, 30000));
        const { getRate } = await import("../services/quote.service");
        const rate = await getRate(currency);
        yield { rateUpdated: { rate, currency, updatedAt: new Date().toISOString() } };
      }
    },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireAuth(ctx: GraphQLContext): void {
  if (!ctx.isAuthenticated) {
    throw new Error("Unauthorized: authentication required");
  }
}

export const resolvers = { Query, Mutation };
