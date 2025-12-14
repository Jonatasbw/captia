export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const { accessToken, contactId, transcript } = req.body;

  if (!accessToken || !contactId) {
    return res.status(400).json({ 
      error: "Missing required fields: accessToken and contactId" 
    });
  }
