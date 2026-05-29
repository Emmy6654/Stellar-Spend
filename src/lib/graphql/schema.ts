import { buildSchema } from "graphql";

export const typeDefs = `
  type Transaction {
    id: ID!
    status: String!
    amount: String!
    currency: String!
    destinationAmount: String
    rate: Float
    bridgeFee: String
    payoutFee: String
    createdAt: String!
    updatedAt: String!
    stellarTxHash: String
    paycrestOrderId: String
  }

  type Quote {
    destinationAmount: String!
    rate: Float!
    currency: String!
    bridgeFee: String!
    payoutFee: String!
    estimatedTime: Int!
  }

  type Currency {
    code: String!
    name: String!
    symbol: String!
    flag: String
  }

  type Institution {
    id: String!
    name: String!
    code: String!
    currency: String!
  }

  type RateInfo {
    rate: Float!
    currency: String!
    updatedAt: String!
  }

  type WebhookDelivery {
    id: ID!
    destinationUrl: String!
    status: String!
    attemptCount: Int!
    maxAttempts: Int!
    createdAt: String!
    updatedAt: String!
    nextAttemptAt: String
  }

  type DLQEntry {
    id: ID!
    deliveryId: String!
    destinationUrl: String!
    finalError: String!
    addedAt: String!
    expiresAt: String!
  }

  type WebhookStats {
    pending: Int!
    delivered: Int!
    failed: Int!
    dlqCount: Int!
  }

  type Query {
    # Transaction queries
    transaction(id: ID!): Transaction
    transactions(limit: Int, offset: Int, status: String): [Transaction!]!

    # Quote query
    quote(amount: String!, currency: String!, feeMethod: String): Quote

    # Currency queries
    currencies: [Currency!]!
    institutions(currency: String!): [Institution!]!

    # Rate query
    rate(currency: String): RateInfo!

    # Webhook queries
    webhookDelivery(id: ID!): WebhookDelivery
    webhookDeliveries(status: String, limit: Int): [WebhookDelivery!]!
    webhookStats: WebhookStats!
    dlqEntries(limit: Int): [DLQEntry!]!
  }

  type Mutation {
    # Replay a failed webhook from DLQ
    replayWebhook(dlqEntryId: ID!): WebhookDelivery!

    # Retry a failed delivery
    retryWebhookDelivery(deliveryId: ID!): WebhookDelivery!
  }

  type Subscription {
    # Real-time transaction status updates
    transactionStatusChanged(id: ID!): Transaction!

    # Real-time rate updates
    rateUpdated(currency: String): RateInfo!
  }
`;

export const schema = buildSchema(typeDefs);
