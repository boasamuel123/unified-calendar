require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const { google } = require('googleapis');

const app = express();

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: true
}));

app.use(express.static(path.join(__dirname, 'public')));

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'http://localhost:3000/auth/google/callback'
);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/calendar'
    ]
  });

  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const code = req.query.code;

    if (!code) {
      return res.status(400).send('No code received from Google');
    }

    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;

    res.redirect('/');
  } catch (err) {
    console.error('AUTH ERROR:', err.response?.data || err.message || err);
    res.status(500).send('Auth failed');
  }
});

app.get('/auth/status', (req, res) => {
  res.json({ loggedIn: !!req.session.tokens });
});

app.get('/events', async (req, res) => {
  try {
    if (!req.session.tokens) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    oauth2Client.setCredentials(req.session.tokens);

    const calendar = google.calendar({
      version: 'v3',
      auth: oauth2Client
    });

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 4, 0, 23, 59, 59).toISOString();

    const response = await calendar.events.list({
      calendarId: 'primary',
      maxResults: 250,
      singleEvents: true,
      orderBy: 'startTime',
      timeMin: start,
      timeMax: end
    });

    const events = response.data.items.map(event => ({
      id: event.id,
      title: event.summary || 'Untitled Event',
      description: event.description || '',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      allDay: !!event.start?.date
    }));

    res.json(events);
  } catch (err) {
    console.error('EVENT ERROR:', err.response?.data || err.message || err);
    res.status(500).json({ error: 'Error fetching events' });
  }
});

app.post('/add-event', async (req, res) => {
  try {
    if (!req.session.tokens) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const { title, description, date, startTime, endTime } = req.body;

    if (!title || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    oauth2Client.setCredentials(req.session.tokens);

    const calendar = google.calendar({
      version: 'v3',
      auth: oauth2Client
    });

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);

    const event = {
      summary: title,
      description: description || '',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'Europe/London'
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'Europe/London'
      }
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event
    });

    res.json({
      message: 'Event added',
      event: response.data
    });
  } catch (err) {
    console.error('ADD EVENT ERROR:', err.response?.data || err.message || err);
    res.status(500).json({ error: 'Error adding event' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
