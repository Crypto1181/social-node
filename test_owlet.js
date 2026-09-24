const axios = require('axios');
const OWLET_API_URL = 'https://the-owlet.com/api/v2';
const OWLET_API_KEY = 'owlet_79e2a3a5ab9135d1c4e417b48cd7795b02265c58a9e64e0e';

async function test() {
  try {
    const r1 = await axios.post(OWLET_API_URL, { key: OWLET_API_KEY, action: 'number_countries' });
    console.log("Countries:", typeof r1.data === 'string' ? r1.data.substring(0, 100) : Object.keys(r1.data));
  } catch (e) {
    console.error("Countries Error", e.message);
  }
}
test();
