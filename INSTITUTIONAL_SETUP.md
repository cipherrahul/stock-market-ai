# 🦅 Institutional Setup: 2026 Sovereign Financial Agent

This guide outlines the critical steps to transition from the **Zero-Mock Development State** to **Live Institutional Execution**.

## 🛡️ Step 1: Security Initialization

The Sovereign Agent uses **AES-256-CBC** encryption to protect your broker access tokens.

1.  **Generate a Master Key**: 
    Create a 32-character string and add it to your `.env` file as `SYSTEM_ENCRYPTION_KEY`.
    ```bash
    # Example (Use a password manager to generate)
    SYSTEM_ENCRYPTION_KEY=sovereign_2026_master_key_secret_32
    ```

2.  **Encrypt Broker Tokens**:
    Use the `SecurityVault` utility to encrypt your `access_token` before placing it in the `.env` file.
    *(See `libs/security-util` for the internal logic).*

## 📡 Step 2: API Credentialing

Fill in the following sections in your `.env` file:

### 🏙️ Zerodha (KiteConnect)
- `ZERODHA_API_KEY`: Found in your Kite Console.
- `ZERODHA_ACCESS_TOKEN_ENC`: The **encrypted** result of your daily login access token.

### 🏢 Upstox
- `UPSTOX_API_KEY`: From Upstox Developer API v2.
- `UPSTOX_API_SECRET`: From Upstox Developer API v2.
- `UPSTOX_ACCESS_TOKEN_ENC`: The **encrypted** result of your OAuth token.

### 🏦 Banking (Stripe Treasury)
- `STRIPE_SECRET_KEY`: Your live secret key from the Stripe Dashboard.
- `PLAID_CLIENT_ID`: Required for bank account linking and verification.

## 🚀 Step 3: Fleet Deployment

1.  **Sync Infrastructure**:
    ```bash
    npm run db:migrate   # Apply 2026 Sovereign Schema
    npm run build        # Build all microservices
    ```

2.  **Start the Sovereign Fleet**:
    ```bash
    docker-compose up -d --build
    ```

3.  **Verify Liveness**:
    Check the logs for the `liquidity-management-service` to ensure the **14-day Sandbox Hardlock** is active or expired depending on your deployment date.

## 🤵 CFO Liveness Guardian
The system is configured to **Fail-Safe**. If any critical service (Kafka, Redis, PG) is unreachable, or if credentials fail to decrypt, the `Agent Orchestrator` will halt all autonomous trading and attempt to secure funds in the primary bank vault.

> [!WARNING]
> Never share your `SYSTEM_ENCRYPTION_KEY`. This key is the root of trust for your autonomous financial identity.

🏛️💎🚀
