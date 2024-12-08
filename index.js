import TelegramBot from 'node-telegram-bot-api';
import db from './db.js';
import axios from 'axios';
import { TOKENS, tokenSuggestions } from './config/token.js';
import { CHAT_ID, TELEGRAM_BOT_TOKEN } from './config/config.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
dotenv.config();

// Konfigurasi Telegram Bot
const telegramBotToken = TELEGRAM_BOT_TOKEN;
const chatId = process.env.CHAT_ID;
const CHANNEL_USERNAME = '';

const bot = new TelegramBot(telegramBotToken, { polling: true });

const lastNotificationTime = {};
const prices = {};
const dailyData = {};
const priceThreshold = 0.1;
const NOTIFICATION_INTERVAL = 24 * 60 * 60 * 1000;

const savePriceToDatabase = (token, initialPrice, finalPrice, percentageChange) => {
   const date = new Date().toISOString().split('T')[0]; // Format tanggal (YYYY-MM-DD)
   db.run(
      `INSERT INTO prices (token, date, initialPrice, finalPrice, percentageChange) 
       VALUES (?, ?, ?, ?, ?)`,
      [token, date, initialPrice, finalPrice, percentageChange],
      (err) => {
         if (err) {
            console.error('Gagal menyimpan data ke database:', err.message);
         } else {
            console.log(`Data harga ${token} berhasil disimpan ke database.`);
         }
      }
   );
};

const getTokenPrice = async (symbol) => {
   try {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
         params: {
            symbol: `${symbol}USDT`,
         },
      });
      return parseFloat(response.data.price);
   } catch (error) {
      console.error(`Gagal mendapatkan harga ${symbol}:`, error.message);
      return null;
   }
};
// const sendMessageToChannel = (message) => {
//    bot.sendMessage(CHANNEL_USERNAME, message)
//       .then(() => console.log('Pesan berhasil dikirim ke channel!'))
//       .catch((err) => console.error('Gagal mengirim pesan:', err));
// };
// sendMessageToChannel('Halo semua, ini adalah notifikasi dari bot!');

// Monitoring Harga
const monitorPrices = async () => {
   // Ambil harga awal untuk semua token
   for (const token of TOKENS) {
      if (!prices[token]) {
         prices[token] = await getTokenPrice(token);
         dailyData[token] = { initialPrice: prices[token], finalPrice: null, percentageChange: 0 };
         console.log(`Harga awal ${token}: $${prices[token]}`);
      }
   }

   setInterval(async () => {
      for (const token of TOKENS) {
         const currentPrice = await getTokenPrice(token);
         if (!currentPrice) continue;

         const initialPrice = prices[token];
         const percentageChange = ((currentPrice - initialPrice) / initialPrice) * 100;
         const now = Date.now();
         if (Math.abs(percentageChange) >= priceThreshold && (!lastNotificationTime[token] || now - lastNotificationTime[token] > NOTIFICATION_INTERVAL)) {
            let message = `⚠️ Harga ${token} ${percentageChange > 0 ? 'naik' : 'turun'} ${percentageChange.toFixed(2)}%!\nHarga saat ini: $${currentPrice}`;

            // Tambahkan saran beli/jual berdasarkan kenaikan/penurunan harga
            if (percentageChange > 0) {
               // Jika harga naik, sarankan untuk membeli
               if (tokenSuggestions[token] && tokenSuggestions[token].length > 0) {
                  message += `\n💡 Saran: Beli ${tokenSuggestions[token].join(' dan ')}.`;
               } else {
                  message += `\n💡 Saran: Pertimbangkan untuk membeli token ini.`;
               }
            } else {
               // Jika harga turun, sarankan untuk menjual
               message += `\n💡 Saran: Pertimbangkan untuk menjual token ${token}.`;
            }

            bot.sendMessage(chatId, message);
            // sendMessageToChannel(message);

            // Reset harga awal setelah notifikasi
            lastNotificationTime[token] = now;
            prices[token] = currentPrice;
         }

         console.log(`Harga ${token}: $${currentPrice} (${percentageChange.toFixed(2)}% dari harga awal)`);
      }
   }, 10000);

   // Interval untuk reset data harian setiap 24 jam
   setInterval(() => {
      const today = new Date().toISOString().split('T')[0];
      for (const token in dailyData) {
         const data = dailyData[token];
         if (data.finalPrice !== null) {
            savePriceToDatabase(token, data.initialPrice, data.finalPrice, data.percentageChange);
         }
      }

      // Reset data harian
      for (const token of TOKENS) {
         prices[token] = dailyData[token].finalPrice; // Set harga akhir jadi harga awal
         dailyData[token] = { initialPrice: prices[token], finalPrice: null, percentageChange: 0 };
      }

      console.log(`Data token berhasil disimpan untuk tanggal ${today} dan data direset.`);
   }, NOTIFICATION_INTERVAL);
};

// Jalankan fungsi monitoring
monitorPrices();

bot.on('message', (msg) => {
   const chatId = msg.chat.id;
   const text = msg.text.toLowerCase();

   if (text.startsWith('/start')) {
      bot.sendMessage(chatId, 'Halo! Saya adalah bot pemantau harga token. Ketik /help untuk melihat perintah yang tersedia.');
   } else if (text.startsWith('/help')) {
      const helpMessage = `
📌 Perintah yang tersedia:
/start - Mulai bot
/help - Melihat perintah yang tersedia
/prices - Melihat harga saat ini untuk semua token
      `;
      bot.sendMessage(chatId, helpMessage);
   } else if (text.startsWith('/prices')) {
      Promise.all(TOKENS.map((token) => getTokenPrice(token))).then((prices) => {
         const priceMessage = TOKENS.map((token, index) => `${token}: $${prices[index]}`).join('\n');
         bot.sendMessage(chatId, `Harga saat ini:\n${priceMessage}`);
      });
   } else {
      bot.sendMessage(chatId, '⚠️ Perintah tidak dikenal! Ketik /help untuk melihat daftar perintah.');
   }
});
