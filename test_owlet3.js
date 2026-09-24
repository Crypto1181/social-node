const axios = require('axios');
const API_URL = 'https://the-owlet.com/api/v2';
const API_KEY = 'owlet_79e2a3a5ab9135d1c4e417b48cd7795b02265c58a9e64e0e';

async function testApi() {
  try {
    const cardRes = await axios.post(API_URL, {
      key: API_KEY,
      action: 'card_catalog',
      q: null,
      country: null
    });
    console.log("card_catalog with nulls:", JSON.stringify(cardRes.data).substring(0, 100));
  } catch (e) {
    console.error("error:", e.message);
  }
}
testApi();
