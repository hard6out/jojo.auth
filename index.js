/*****************************************************
 * index.js
 * Works with GoTo OAuth using the "collab" scope
 * using node-fetch@2 (CommonJS) and Express.
 *****************************************************/
const express = require('express');
const fetch = require('node-fetch');  // node-fetch v2
require('dotenv').config();           // loads environment variables from .env (if local)

const app = express();
// Use port 5000 by default, or process.env.PORT if running on Replit or other platform
const port = process.env.PORT || 5000;

/*****************************************************
 * In-memory token store (for DEMO only).
 * In production, store tokens in a database!
 *****************************************************/
let tokenStore = {
  access_token: null,
  refresh_token: null,
  expires_in: null
};

/*****************************************************
 * 1) A simple Hello World route
 *****************************************************/
app.get('/', (req, res) => {
  res.send('Hello World from your Node server!');
});

/*****************************************************
 * 2) Start OAuth flow - Build /authorize URL & redirect
 *****************************************************/
app.get('/authorize', (req, res) => {
  const clientId = process.env.CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.REDIRECT_URI);

  // If your GoTo Developer Portal lumps everything under collab, request 'collab' scope:
  // If you prefer to request "all assigned scopes", you can omit &scope entirely.
  const scope = '';

  // Construct the authorization URL
  let gotoAuthUrl = `
    https://authentication.logmeininc.com/oauth/authorize
      ?response_type=code
      &client_id=${clientId}
      &redirect_uri=${redirectUri}
      &scope=${encodeURIComponent(scope)}
  `;

  // Remove extra whitespace/newlines
  gotoAuthUrl = gotoAuthUrl.replace(/\s+/g, '');

  // Redirect user's browser to GoTo's auth page
  res.redirect(gotoAuthUrl);
});

/*****************************************************
 * 3) OAuth Callback Route - matches your REDIRECT_URI
 *****************************************************/
app.get('/callback', async (req, res) => {
  // The authorization code from GoTo
  const authCode = req.query.code;

  // If user denies or there's no code
  if (!authCode) {
    return res.send('No authorization code provided or user denied the request.');
  }

  try {
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const redirectUri = process.env.REDIRECT_URI;

    // Create Basic Auth header: base64("clientId:clientSecret")
    const base64Creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    // Exchange code for tokens
    const tokenResponse = await fetch('https://authentication.logmeininc.com/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${base64Creds}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        client_id: clientId,
        code: authCode
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return res.send(`Error from GoTo token endpoint: ${errorText}`);
    }

    // Parse JSON response
    const tokenData = await tokenResponse.json();
    console.log('Token Data:', tokenData);

    // Store tokens in memory
    tokenStore.access_token = tokenData.access_token;
    tokenStore.refresh_token = tokenData.refresh_token;
    tokenStore.expires_in = tokenData.expires_in;

    // Show success page with token info
    res.send(`
      <h1>Authorization successful!</h1>
      <p>We received your tokens from GoTo.</p>
      <pre>${JSON.stringify(tokenData, null, 2)}</pre>
      <p>Check /token to see stored tokens.</p>
    `);
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    res.send('An error occurred while exchanging the authorization code for a token.');
  }
});

/*****************************************************
 * 4) Endpoint to retrieve tokens (for Voiceflow, etc.)
 *****************************************************/
app.get('/token', (req, res) => {
  // In a real app, you'd likely secure this endpoint.
  res.json(tokenStore);
});

/*****************************************************
 * Start the server
 *****************************************************/
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});