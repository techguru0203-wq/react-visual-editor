## Project Structure

```
.
├── backend/
│   ├── config/           # App configuration
│   │   ├── constants.ts # Environment and app constants
│   │   └── passport.ts  # Authentication config
│   ├── db/
│   │   ├── db.ts        # Initializes and exports the database connection
│   │   └── schema.ts    # Database schema definitions
│   ├── middleware/
│   │   ├── auth.ts      # JWT authentication
│   │   └── errorHandler.ts # Global error handling
│   ├── repositories/
│   │   └── users.ts     # User data access
│   ├── routes/
│   │   └── auth.ts      # Authentication routes
│   │   ├── stripe.ts    # Create Stripe checkout/subscription sessions
│   │   └── webhook
│   │       └── stripeWebhook.ts # Handles incoming Stripe webhook events
│   ├── server.ts        # Entry point
│   └── services/
│       └── stripeService.ts # Service layer for interacting with the Stripe API
├── frontend/
    ├── src/
    │   ├── components/
    │   │   └── ui/      # Shared UI components from shadcn/ui
    |   |   └── custom/  # custom components
    │   ├── config/      # configuration parameters
    │   ├── hooks/       # hooks for react app
    │   ├── lib/         # utility functions
    │   ├── services/    # services for frontend/backend interaction
    │   ├── pages/       # Route components
    │   ├── types/       # Common types for the app
    ├── index.html
    └── vite.config.ts
```

## API Routes

- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login with credentials
- `GET /api/auth/me` - Get current user info (used for session persistence)

  - Requires JWT token in Authorization header
  - Returns user's id, email, and name
  - Used for auto-login and token validation

- `POST /api/stripe/create-checkout-session` – Create a Stripe Checkout Session for **one-time payment**

  - Requires JWT authentication
  - **Body:**
    ```json
    {
      "productId": "string",
      "quantity": 1
    }
    ```
    - `productId` – ID of the product in your database
    - `quantity` – Optional, defaults to `1`
  - Returns:
    ```json
    {
      "success": true,
      "data": { "sessionId": "string" }
    }
    ```
  - Redirect the user to `https://checkout.stripe.com/pay/{sessionId}` to complete payment

- `POST /api/stripe/create-subscription-session` – Create a Stripe Subscription Session (inline `price_data.recurring`)

  - Requires JWT authentication
  - **Body:**
    ```json
    {
      "productId": "string",
      "interval": "week | month | year",
      "intervalCount": 1,
      "trialDays": 0
    }
    ```
    - `productId` – ID of the product in your database
    - `interval` – Billing interval (`week`, `month`, `year`)
    - `intervalCount` – Optional, defaults to `1` (max `52`)
    - `trialDays` – Optional, free trial period in days (0–90)
  - Returns:
    ```json
    {
      "success": true,
      "data": { "sessionId": "string" }
    }
    ```
  - Redirect the user to `https://checkout.stripe.com/pay/{sessionId}` to complete payment

- `POST /api/stripe/webhook` – Stripe webhook endpoint
  - Receives and verifies Stripe event payloads
  - **Must** use:
    ```ts
    express.raw({ type: 'application/json' });
    ```
    to verify signature
  - Handles:
    - `checkout.session.completed` → Process one-time payments and subscriptions, store in DB
    - `invoice.payment_succeeded` → Process subscription renewals, store in DB

## Database Management

This project uses Drizzle ORM with a push-based workflow for simplicity:

1. **Schema Definition** (`backend/db/schema.ts`):

```typescript
export const users = pgTable('Users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

2. **Schema Updates**:

- Modify `schema.ts` with your changes
- Run `npm run db:push` to update the database
- No manual migration management needed

3. **Type Safety**:

```typescript
// Types are automatically inferred from your schema
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
```
