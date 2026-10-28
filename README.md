# 💳 Transaction Ledger API

A production-grade, ACID-compliant financial transaction ledger API built with **Node.js**, **Express 5**, and **MongoDB / Mongoose 9**. 

Designed with strict financial accounting principles: **append-only immutability**, **concurrency safety**, **idempotency**, **floating-point precision protection**, and **real-time auditability**.

---

## 📑 Table of Contents

- [Key Architecture & Financial Principles](#-key-architecture--financial-principles)
- [Tech Stack](#-tech-stack)
- [Directory Structure](#-directory-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Running the Application](#running-the-application)
- [API Reference](#-api-reference)
  - [Health Check](#1-health-check)
  - [Account Endpoints](#2-account-endpoints)
  - [Transaction Endpoints](#3-transaction-endpoints)
  - [Transfer Endpoint (Bonus)](#4-transfer-endpoint-bonus)
  - [Audit & Balance Reconciliation](#5-audit--balance-reconciliation)
  - [Immutability & Safety Rules](#6-immutability--safety-rules)
- [Error Handling & Error Codes](#-error-handling--error-codes)
- [Testing](#-testing)
- [Postman Collection](#-postman-collection)
- [Assumptions](#-assumptions)
- [License](#-license)

---

## 🏛 Key Architecture & Financial Principles

1. **Append-Only Immutability**:
   - Financial ledger entries must never be modified or deleted.
   - Any `PUT`, `PATCH`, or `DELETE` attempt on transactions is rejected with **`405 Method Not Allowed`** at the HTTP routing layer.
   - Additionally guarded at the database layer via Mongoose middleware hooks (`pre('updateOne')`, `pre('deleteOne')`, etc.).

2. **Concurrency Safety & Race Condition Prevention**:
   - Balance debits use atomic conditional queries: `{ id: accountId, balance: { $gte: debitAmount } }` with `{ $inc: { balance: -debitAmount } }`.
   - Prevents race conditions and double-spending: two simultaneous debit requests cannot overdraw the account below zero.

3. **Multi-Document Transactions & Dual Topology Support**:
   - Automatically detects MongoDB cluster topology on boot.
   - **Replica Set**: Uses native MongoDB Sessions (`session.startTransaction()`, `commitTransaction()`, `abortTransaction()`).
   - **Standalone**: Falls back to atomic document updates with compensating rollbacks.

4. **Strict Idempotency**:
   - Credit and debit requests require a unique `reference_id`.
   - A compound unique index `{ account_id: 1, reference_id: 1 }` prevents duplicate transaction processing (returns **`409 Conflict`** on replay).
   - Transfers enforce global `reference_id` uniqueness across transfers.

5. **Financial Floating-Point Precision**:
   - Pure JavaScript IEEE 754 floating-point operations can introduce rounding drift (e.g. `0.1 + 0.2 = 0.30000000000000004`).
   - All monetary calculations are sanitized using `Math.round((num + Number.EPSILON) * 100) / 100` and integer cent arithmetic.

6. **Auditability & Reconciled Balance Verification**:
   - Dedicated endpoint `GET /api/v1/accounts/:accountId/verify-balance` calculates:
     $$\text{Audited Balance} = \sum(\text{Credits}) - \sum(\text{Debits})$$
   - Verifies mathematical equality against the cached `account.balance` to guarantee zero discrepancies.

---

## 🛠 Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) (v18+ or v20+ recommended)
- **Framework**: [Express 5](https://expressjs.com/)
- **Database / ODM**: [MongoDB](https://www.mongodb.com/) with [Mongoose 9](https://mongoosejs.com/)
- **Schema Validation**: [Joi](https://joi.dev/)
- **Testing**: [Jest](https://jestjs.io/), [Supertest](https://github.com/ladjs/supertest), [mongodb-memory-server](https://github.com/nodkz/mongodb-memory-server)
- **Security**: [Helmet](https://helmetjs.github.io/), [CORS](https://github.com/expressjs/cors)
- **Logging**: [Morgan](https://github.com/expressjs/morgan)

---

## 📁 Directory Structure

```text
transactionProject/
├── src/
│   ├── app.js                         # Express application setup & middleware
│   ├── server.js                      # HTTP server startup & graceful shutdown
│   ├── config/
│   │   ├── database.js                # MongoDB connection & topology detection
│   │   └── env.js                     # Environment variable validation
│   ├── constants/
│   │   ├── errorCodes.js              # Standardized API error codes
│   │   └── transactionTypes.js        # Transaction type enums (credit, debit)
│   ├── controllers/
│   │   ├── accountController.js       # Account HTTP handlers
│   │   ├── transactionController.js   # Transaction HTTP handlers
│   │   └── transferController.js      # Money transfer HTTP handler
│   ├── middleware/
│   │   ├── errorHandler.js            # Global centralized error handler
│   │   ├── notFoundHandler.js         # 404 handler for unknown routes
│   │   ├── requestLogger.js           # HTTP access logger
│   │   └── validate.js                # Joi request validation middleware
│   ├── models/
│   │   ├── Account.js                 # Account Mongoose schema & indexes
│   │   ├── Transaction.js             # Transaction ledger schema & immutability hooks
│   │   └── Transfer.js                # Transfer tracking schema
│   ├── routes/
│   │   ├── accountRoutes.js           # /api/v1/accounts routes
│   │   ├── index.js                   # Main route aggregator & health check
│   │   ├── transactionRoutes.js       # /api/v1/transactions routes
│   │   └── transferRoutes.js          # /api/v1/transfers routes
│   ├── services/
│   │   ├── accountService.js          # Account business logic & balance audit
│   │   ├── transactionService.js      # Ledger operations & balance updates
│   │   └── transferService.js         # Inter-account transfer orchestration
│   ├── utils/
│   │   ├── apiError.js                # Custom operational error class
│   │   ├── apiResponse.js             # Standardized JSON response helper
│   │   ├── idGenerator.js             # UUID identifier generator
│   │   ├── mathUtils.js               # Precision currency arithmetic
│   │   └── transactionExecutor.js     # Transaction runner (replica set vs standalone)
│   └── validators/
│       ├── accountValidator.js        # Account payload validation schemas
│       ├── transactionValidator.js    # Transaction & query validation schemas
│       └── transferValidator.js       # Transfer payload validation schemas
├── tests/
│   ├── account.test.js                # Account creation & retrieval tests
│   ├── dataIntegrity.test.js          # Immutability & balance integrity tests
│   ├── setup.js                       # Jest test harness & in-memory MongoDB runner
│   ├── transaction.test.js            # Credit, debit, pagination & filter tests
│   └── transfer.test.js               # Inter-account money transfer tests
├── Transaction_Ledger_API.postman_collection.json # Ready-to-import Postman collection
├── .env.example                       # Sample environment configuration
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **MongoDB**: Local MongoDB instance (`mongodb://127.0.0.1:27017`), MongoDB Atlas, or Docker.
  *(Note: Automated tests run with an embedded in-memory MongoDB automatically; no separate database is required to run tests!)*

### Installation

1. Clone or download the repository:
   ```bash
   cd transactionProject
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Configuration

Create a `.env` file in the root directory (or copy from `.env.example`):

```bash
cp .env.example .env
```

| Variable | Description | Default Value |
| :--- | :--- | :--- |
| `PORT` | HTTP server listening port | `3000` |
| `NODE_ENV` | Environment (`development`, `production`, `test`) | `development` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/transaction_ledger` |
| `MONGODB_TEST_URI` | *(Optional)* MongoDB URI for test suite | In-memory MongoDB (`mongodb-memory-server`) |
| `LOG_LEVEL` | Logging verbosity | `debug` |

### Running the Application

- **Development Mode** (with automatic hot-reloading via `nodemon`):
  ```bash
  npm run dev
  ```

- **Production Mode**:
  ```bash
  npm start
  ```

- Once running, the server is available at:
  - Base URL: `http://localhost:3000`
  - Health check: `http://localhost:3000/api/v1/health`

---

## 📡 API Reference

All successful responses follow a uniform format:
```json
{
  "success": true,
  "message": "Operation description",
  "data": { ... }
}
```

---

### 1. Health Check

#### `GET /api/v1/health`
Checks service uptime and MongoDB connection state.

**Response (`200 OK`):**
```json
{
  "success": true,
  "status": "UP",
  "timestamp": "2026-10-28T15:30:00.000Z",
  "database": {
    "connected": true,
    "topology": "standalone"
  }
}
```

---

### 2. Account Endpoints

#### `POST /api/v1/accounts`
Creates a new account. The initial balance is always set to `0.00` (clients cannot set an initial balance directly).

**Request Body:**
```json
{
  "name": "Alice Smith"
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "id": "acc_7a4e610d40214695",
    "name": "Alice Smith",
    "balance": 0,
    "created_at": "2026-10-28T15:31:00.000Z"
  }
}
```

---

#### `GET /api/v1/accounts/:accountId`
Retrieves account metadata and current balance.

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Account retrieved successfully",
  "data": {
    "id": "acc_7a4e610d40214695",
    "name": "Alice Smith",
    "balance": 150.5,
    "created_at": "2026-10-28T15:31:00.000Z"
  }
}
```

---

#### `GET /api/v1/accounts/:accountId/balance`
Retrieves only the account ID, account holder name, and current balance.

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Account balance retrieved successfully",
  "data": {
    "account_id": "acc_7a4e610d40214695",
    "name": "Alice Smith",
    "balance": 150.5
  }
}
```

---

### 3. Transaction Endpoints

#### `POST /api/v1/accounts/:accountId/transactions`
Applies a `credit` or `debit` transaction to the account.

> *Alternatively, `POST /api/v1/transactions` can be used by including `"account_id"` in the request body.*

#### A. Credit Transaction (Deposit)
**Request Body:**
```json
{
  "type": "credit",
  "amount": 100.00,
  "description": "Salary deposit",
  "reference_id": "ref-credit-1001"
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Credit transaction applied successfully",
  "data": {
    "id": "txn_894c718b5329432f",
    "account_id": "acc_7a4e610d40214695",
    "type": "credit",
    "amount": 100,
    "description": "Salary deposit",
    "reference_id": "ref-credit-1001",
    "balance_after": 100,
    "created_at": "2026-10-28T15:32:00.000Z"
  }
}
```

#### B. Debit Transaction (Withdrawal)
**Request Body:**
```json
{
  "type": "debit",
  "amount": 30.00,
  "description": "Coffee & Groceries",
  "reference_id": "ref-debit-1002"
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Debit transaction applied successfully",
  "data": {
    "id": "txn_9182371af1298412",
    "account_id": "acc_7a4e610d40214695",
    "type": "debit",
    "amount": 30,
    "description": "Coffee & Groceries",
    "reference_id": "ref-debit-1002",
    "balance_after": 70,
    "created_at": "2026-10-28T15:33:00.000Z"
  }
}
```

---

#### `GET /api/v1/accounts/:accountId/transactions`
Retrieves paginated transaction history, sorted newest first (`created_at: -1`).

**Query Parameters:**
- `type` *(optional)*: Filter by `credit` or `debit`.
- `page` *(optional, default: `1`)*: Page number.
- `limit` *(optional, default: `10`, max: `100`)*: Items per page.

**Example Request:**
```http
GET /api/v1/accounts/acc_7a4e610d40214695/transactions?type=credit&page=1&limit=5
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Transaction history retrieved successfully",
  "data": {
    "account_id": "acc_7a4e610d40214695",
    "pagination": {
      "total_items": 4,
      "page": 1,
      "limit": 5,
      "total_pages": 1,
      "has_next_page": false,
      "has_prev_page": false
    },
    "transactions": [
      {
        "id": "txn_9182371af1298412",
        "account_id": "acc_7a4e610d40214695",
        "type": "credit",
        "amount": 50,
        "description": "Direct deposit",
        "reference_id": "ref-credit-1003",
        "created_at": "2026-10-28T15:34:00.000Z"
      }
    ]
  }
}
```

---

### 4. Transfer Endpoint (Bonus)

#### `POST /api/v1/transfers`
Transfers money between two accounts atomically. Creates a debit transaction on the source account and a credit transaction on the destination account.

**Request Body:**
```json
{
  "from_account_id": "acc_source123",
  "to_account_id": "acc_destination456",
  "amount": 30.00,
  "description": "Lunch split",
  "reference_id": "transfer-unique-001"
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Transfer of 30 completed successfully",
  "data": {
    "transfer": {
      "id": "xfer_87a12b3c4d5e",
      "from_account_id": "acc_source123",
      "to_account_id": "acc_destination456",
      "amount": 30,
      "description": "Lunch split",
      "reference_id": "transfer-unique-001",
      "debit_transaction_id": "txn_deb_123",
      "credit_transaction_id": "txn_crd_456",
      "created_at": "2026-10-28T15:35:00.000Z"
    },
    "from_account": {
      "id": "acc_source123",
      "new_balance": 70
    },
    "to_account": {
      "id": "acc_destination456",
      "new_balance": 80
    }
  }
}
```

---

### 5. Audit & Balance Reconciliation

#### `GET /api/v1/accounts/:accountId/verify-balance`
Performs an independent mathematical audit of the account's ledger entries. Computes:
$$\text{Calculated Balance} = \sum(\text{Credits}) - \sum(\text{Debits})$$
and compares it with the cached balance stored on the account document.

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Account balance audit completed",
  "data": {
    "account_id": "acc_7a4e610d40214695",
    "name": "Alice Smith",
    "stored_balance": 100,
    "calculated_balance": 100,
    "is_balanced": true,
    "discrepancy": 0,
    "total_credit_volume": 150,
    "total_debit_volume": 50,
    "total_transaction_count": 4,
    "audited_at": "2026-10-28T15:36:00.000Z"
  }
}
```

---

### 6. Immutability & Safety Rules

| Condition | Method / Route | Response Status | Error Code |
| :--- | :--- | :--- | :--- |
| **Attempt to modify transaction** | `PUT /accounts/:id/transactions/:txnId` | `405 Method Not Allowed` | `RESOURCE_IMMUTABLE` |
| **Attempt to delete transaction** | `DELETE /accounts/:id/transactions/:txnId` | `405 Method Not Allowed` | `RESOURCE_IMMUTABLE` |
| **Reusing `reference_id` on same account** | `POST /accounts/:id/transactions` | `409 Conflict` | `DUPLICATE_TRANSACTION` |
| **Debit with insufficient funds** | `POST /accounts/:id/transactions` | `422 Unprocessable Entity` | `INSUFFICIENT_BALANCE` |
| **Transfer to same account** | `POST /transfers` | `400 Bad Request` | `TRANSFER_SAME_ACCOUNT` |
| **Specify initial balance on creation** | `POST /accounts` | `400 Bad Request` | `VALIDATION_ERROR` |

---

## ⚠️ Error Handling & Error Codes

All errors return a predictable JSON payload:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance. Account balance is 20, requested debit amount is 50",
    "details": null
  }
}
```

### Standardized Error Codes

- `ACCOUNT_NOT_FOUND` (404)
- `INSUFFICIENT_BALANCE` (422)
- `DUPLICATE_TRANSACTION` (409)
- `RESOURCE_IMMUTABLE` (405)
- `VALIDATION_ERROR` (400)
- `TRANSFER_SAME_ACCOUNT` (400)
- `ROUTE_NOT_FOUND` (404)
- `INTERNAL_SERVER_ERROR` (500)

---

## 🧪 Testing

The test suite runs with **Jest** and utilizes an isolated **in-memory MongoDB instance** (`mongodb-memory-server`), ensuring zero test pollution and no requirement for an external running database.

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Coverage Highlights

- ✅ **Account Suite** (`tests/account.test.js`): Account initialization with `balance = 0`, validation of required fields, rejection of custom initial balance.
- ✅ **Transaction Suite** (`tests/transaction.test.js`): Credits, debits, consecutive credits, debit overdraw rejection, idempotency via `reference_id`, pagination, and type filtering.
- ✅ **Money Transfer Suite** (`tests/transfer.test.js`): Assignment walkthrough example (`30 transferred from A to B: A becomes 70, B becomes 80`), insufficient balance rejection, same-account transfer rejection.
- ✅ **Data Integrity Suite** (`tests/dataIntegrity.test.js`): Strict immutability rejection (`PUT`/`PATCH`/`DELETE` returning `405`), and the full assignment mathematical progression:
  $$0 \xrightarrow{+100} 100 \xrightarrow{+50} 150 \xrightarrow{-30} 120 \xrightarrow{-20} 100$$

---

## 📮 Postman Collection

A complete, pre-configured Postman collection is included in the root directory:  
[`Transaction_Ledger_API.postman_collection.json`](./Transaction_Ledger_API.postman_collection.json)

### Features of the Postman Collection:
1. **Dynamic Environment Variables**: Automatically extracts `accountId`, `destinationAccountId`, and `transactionId` from responses and injects them into subsequent calls.
2. **Dynamic `reference_id` Generation**: Pre-request scripts generate timestamped reference IDs (e.g. `ref-credit-1730129...`) so requests can be run repeatedly without 409 conflict errors.
3. **Automated Test Assertions**: Tests for expected status codes (`201`, `405`, `409`, `422`) and response structures.
4. **Organized by Feature**:
   - `1. Health Check`
   - `2. Accounts`
   - `3. Transactions`
   - `4. Money Transfers (Bonus)`
   - `5. Immutability & Validation Tests`

---

## 💡 Assumptions

1. **Single-Currency Ledger & Decimal Precision**:
   - The ledger operates on a single currency (e.g., USD/EUR/INR).
   - Transaction amounts are limited to a maximum precision of 2 decimal places. All calculations are converted and rounded safely to prevent IEEE 754 floating-point drift.
2. **Strict Zero Initial Balance**:
   - When an account is created, its balance is always `0.00`. An account cannot be created with an initial balance; funds must be added through an explicit, auditable `credit` transaction.
3. **No Overdraft**:
   - Account balances cannot be negative. Debit transactions that exceed the current balance are rejected with `422 Unprocessable Entity` (`INSUFFICIENT_BALANCE`), and the balance remains unchanged.
4. **Idempotency Scope (`reference_id`)**:
   - `reference_id` uniqueness is enforced per account. The same `reference_id` may be reused by different accounts without collision.
   - For inter-account money transfers (`POST /api/v1/transfers`), the `reference_id` is globally unique across all transfer requests.
5. **No Self-Transfers**:
   - An account cannot transfer funds to itself (`from_account_id` cannot equal `to_account_id`).
6. **Immutable Historical Records**:
   - Ledger records are permanent. Corrections or refunds must be modeled as new compensating transactions rather than editing past transactions.
7. **Database Deployment Flexibility**:
   - The system is architected to run in both MongoDB Standalone mode (using atomic conditional updates with compensating rollback) and MongoDB Replica Set mode (using multi-document ACID transactions).

---

## 📄 License

This project is licensed under the **ISC License**.
