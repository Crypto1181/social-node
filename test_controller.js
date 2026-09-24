const axios = require('axios');
const API_URL = 'https://the-owlet.com/api/v2';
const API_KEY = 'owlet_79e2a3a5ab9135d1c4e417b48cd7795b02265c58a9e64e0e';

async function run() {
  const q = null;
  const country = null;
  const payload = { key: API_KEY, action: 'card_catalog' };
  if (q) payload.q = q;
  if (country) payload.country = country;
  
  console.log("payload:", payload);
  try {
    const response = await axios.post(API_URL, payload);
    console.log("card catalog success. Array len:", response.data.length);
  } catch(e) {
    console.log("error:", e.message);
  }
  
  try {
     const res2 = await axios.post(API_URL, {key: API_KEY, action: 'number_countries'});
     console.log("number_countries len:", res2.data.length);
  } catch (e) {}
}
run();
