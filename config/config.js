import dotenv from 'dotenv';

// Memuat file .env ke process.env
dotenv.config();

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const CHAT_ID = process.env.CHAT_ID;
