export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  try {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.HUBSPOT_CLIENT_ID,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET,
      redirect_uri: process.env.REDIRECT_URI,
      code
    });

    const tokenRes = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return res.status(400).json(tokenData);
    }

    res.send(`
      <h1>✅ OAuth Successful</h1>
      <p><strong>Access Token:</strong></p>
      <pre>${tokenData.access_token}</pre>
      <p><strong>Refresh Token:</strong></p>
      <pre>${tokenData.refresh_token}</pre>
      <p><strong>Expires in:</strong> ${tokenData.expires_in} seconds</p>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
}
