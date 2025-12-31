import { db } from '../db';
import {
  stripeCustomers,
  stripeSubscriptions,
  stripeOrders,
  stripeWebhookEvents,
  InsertStripeCustomer,
  InsertStripeSubscription,
  InsertStripeOrder,
  InsertStripeWebhookEvent,
} from '../db/schema';
import { eq, desc } from 'drizzle-orm';

export class StripeRepository {
  // Customer operations
  async createCustomer(customerData: InsertStripeCustomer) {
    const [customer] = await db
      .insert(stripeCustomers)
      .values(customerData)
      .returning();
    return customer;
  }

  async findCustomerByStripeId(stripeCustomerId: string) {
    const [customer] = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.stripeCustomerId, stripeCustomerId));
    return customer;
  }

  async findCustomerByUserId(userId: string) {
    const [customer] = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.userId, userId));
    return customer;
  }

  async findCustomerByEmail(email: string) {
    const [customer] = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.email, email));
    return customer;
  }

  async updateCustomer(id: string, data: Partial<InsertStripeCustomer>) {
    const [customer] = await db
      .update(stripeCustomers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(stripeCustomers.id, id))
      .returning();
    return customer;
  }

  // Subscription operations
  async createSubscription(subscriptionData: InsertStripeSubscription) {
    const [subscription] = await db
      .insert(stripeSubscriptions)
      .values(subscriptionData)
      .returning();
    return subscription;
  }

  async findSubscriptionByStripeId(stripeSubscriptionId: string) {
    const [subscription] = await db
      .select()
      .from(stripeSubscriptions)
      .where(
        eq(stripeSubscriptions.stripeSubscriptionId, stripeSubscriptionId)
      );
    return subscription;
  }

  async findSubscriptionsByCustomerId(stripeCustomerId: string) {
    const subscriptions = await db
      .select()
      .from(stripeSubscriptions)
      .where(eq(stripeSubscriptions.stripeCustomerId, stripeCustomerId))
      .orderBy(desc(stripeSubscriptions.createdAt));
    return subscriptions;
  }

  async updateSubscription(
    id: string,
    data: Partial<InsertStripeSubscription>
  ) {
    const [subscription] = await db
      .update(stripeSubscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(stripeSubscriptions.id, id))
      .returning();
    return subscription;
  }

  // Order operations
  async createOrder(orderData: InsertStripeOrder) {
    const [order] = await db.insert(stripeOrders).values(orderData).returning();
    return order;
  }

  async findOrderById(id: string) {
    const [order] = await db
      .select()
      .from(stripeOrders)
      .where(eq(stripeOrders.id, id));
    return order;
  }

  async findOrderByCheckoutSessionId(sessionId: string) {
    const [order] = await db
      .select()
      .from(stripeOrders)
      .where(eq(stripeOrders.stripeCheckoutSessionId, sessionId));
    return order;
  }

  async findOrderByPaymentIntentId(paymentIntentId: string) {
    const [order] = await db
      .select()
      .from(stripeOrders)
      .where(eq(stripeOrders.stripePaymentIntentId, paymentIntentId));
    return order;
  }

  async findOrdersByCustomerId(stripeCustomerId: string) {
    const orders = await db
      .select()
      .from(stripeOrders)
      .where(eq(stripeOrders.stripeCustomerId, stripeCustomerId))
      .orderBy(desc(stripeOrders.createdAt));
    return orders;
  }

  async updateOrder(id: string, data: Partial<InsertStripeOrder>) {
    const [order] = await db
      .update(stripeOrders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(stripeOrders.id, id))
      .returning();
    return order;
  }

  // Webhook event operations
  async createWebhookEvent(eventData: InsertStripeWebhookEvent) {
    const [event] = await db
      .insert(stripeWebhookEvents)
      .values(eventData)
      .returning();
    return event;
  }

  async findWebhookEventByStripeId(stripeEventId: string) {
    const [event] = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId));
    return event;
  }

  async markWebhookEventProcessed(id: string) {
    const [event] = await db
      .update(stripeWebhookEvents)
      .set({ processed: 1 })
      .where(eq(stripeWebhookEvents.id, id))
      .returning();
    return event;
  }
}

export const stripeRepository = new StripeRepository();
