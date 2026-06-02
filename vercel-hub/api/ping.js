const Pusher = require("pusher");

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

export default async function handler(req, res) {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito, usa POST' });
  }

  const { channel, event, data } = req.body;

  if (!channel || !event) {
    return res.status(400).json({ error: 'Parametri channel ed event richiesti' });
  }

  try {
    await pusher.trigger(channel, event, data || {});
    res.status(200).json({ success: true, message: 'Ping inviato con successo' });
  } catch (error) {
    console.error('Errore Pusher:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
}
