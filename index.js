const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const bodyParser = require('body-parser');
const QRCode = require('qrcode');
const fs = require('fs');   // <-- import fs qui

// 🔄 forza reset sessione all'avvio (così genera sempre un QR nuovo finché non colleghi il telefono)
fs.rmSync('.wwebjs_auth', { recursive: true, force: true });

const app = express();
app.use(bodyParser.json());

let latestQR = null;

const client = new Client({
  authStrategy: new LocalAuth()
});

// Genera QR code
client.on('qr', async (qr) => {
  latestQR = await QRCode.toDataURL(qr);
  console.log('📱 Vai su /qr per scansionare il codice');
});

client.on('ready', () => {
  console.log('✅ WhatsApp connesso!');
});

// Inoltra i messaggi a n8n
client.on('message', async msg => {
  console.log(`📩 ${msg.from}: ${msg.body}`);
  const fetch = (await import('node-fetch')).default;
  await fetch(process.env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: msg.from, body: msg.body })
  });
});

// Endpoint per invio da n8n
app.post('/send-message', (req, res) => {
  const { number, message } = req.body;
  client.sendMessage(number + '@c.us', message);
  res.send({ status: 'ok' });
});

// Endpoint per vedere il QR
app.get('/qr', (req, res) => {
  if (latestQR) {
    res.send(`<img src="${latestQR}" />`);
  } else {
    res.send('Nessun QR disponibile. Aspetta qualche secondo e ricarica...');
  }
});

// Ping di test
app.get('/', (req, res) => res.send('✅ Bot attivo!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server su ${PORT}`));

client.initialize();
