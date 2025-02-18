// Ensure environment variables are loaded
require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = [
    'GOOGLE_PRIVATE_KEY_ID',
    'GOOGLE_PRIVATE_KEY',
    'GOOGLE_CLIENT_EMAIL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_X509_CERT_URL',
    'SPREADSHEET_ID',
    'SHEET_NAME'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const path = require('path');
const pino = require('pino');
const GoogleSheetsUtil = require('./utils/sheets');

// Configure logger
const logger = pino({
    level: 'debug',
    transport: {
        target: 'pino-pretty'
    }
});

// Load environment variables or credentials here
const credentials = {
    type: "service_account",
    project_id: process.env.GOOGLE_PROJECT_ID || "dotted-clover-385118",
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
    universe_domain: "googleapis.com"
};

const sheetsUtil = new GoogleSheetsUtil(
    credentials,
    process.env.SPREADSHEET_ID,
    process.env.SHEET_NAME
);

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: logger,
        browser: ['WhatsApp Bot', 'Chrome', '1.0.0'],
        getMessage: async (key) => {
            return { conversation: '' };
        }
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            logger.info('QR Code received, scan it to connect');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            logger.info('Connection closed due to ', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            logger.info('Connection opened successfully');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        logger.info(`Received message of type: ${type}`);
        
        for (const message of messages) {
            if (!message.message) continue;

            const isGroup = message.key.remoteJid.endsWith('@g.us');
            logger.info(`Message from ${isGroup ? 'group' : 'private chat'}: ${message.key.remoteJid}`);

            // Get the message text from various possible message types
            const messageText = message.message.conversation || 
                              message.message.extendedTextMessage?.text || 
                              message.message.imageMessage?.caption ||
                              '';
            
            if (!messageText.startsWith('/')) continue;

            const parts = messageText.trim().split(/\s+/);
            if (parts.length < 2) {
                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Escribiste mal, boludito. Usa "/casa [nombre]" o "/cbu [nombre]".'
                }, { quoted: message });
                continue;
            }

            const command = parts[0].toLowerCase();
            const name = parts.slice(1).join(' ');

            try {
                const row = await sheetsUtil.getRowByName(name);
                
                if (!row) {
                    await sock.sendMessage(message.key.remoteJid, {
                        text: 'Ese nombre no existe en la lista, capo.'
                    }, { quoted: message });
                } else if (command === '/casa') {
                    await sock.sendMessage(message.key.remoteJid, {
                        text: row[1]
                    }, { quoted: message });
                } else if (command === '/cbu') {
                    await sock.sendMessage(message.key.remoteJid, {
                        text: row[2]
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(message.key.remoteJid, {
                        text: 'A ver si aprendes a escribir'
                    }, { quoted: message });
                }
            } catch (err) {
                logger.error('Error processing message:', err);
                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Error procesando el mensaje: ' + (err.message || 'Error desconocido')
                }, { quoted: message });
            }
        }
    });
}

connectToWhatsApp();