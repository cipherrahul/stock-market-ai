import { SecurityVault } from '../libs/security-util/src';
import dotenv from 'dotenv';

dotenv.config();

const token = process.argv[2];

if (!token) {
    console.error("❌ Usage: npx tsx scripts/encrypt_token.ts <PLAIN_TEXT_TOKEN>");
    process.exit(1);
}

try {
    const encrypted = SecurityVault.encrypt(token);
    console.log("\n🔐 2026 SOVEREIGN ENCRYPTION SUCCESSFUL");
    console.log("----------------------------------------");
    console.log("Your Encrypted Token (Add this to .env):");
    console.log(`\x1b[32m${encrypted}\x1b[0m`);
    console.log("----------------------------------------\n");
} catch (error) {
    console.error("❌ Encryption Failed. Ensure SYSTEM_ENCRYPTION_KEY is 32 characters in .env");
}
