const axios = require('axios');
const OWLET_API_URL = 'https://the-owlet.com/api/v2';
const OWLET_API_KEY = 'owlet_79e2a3a5ab9135d1c4e417b48cd7795b02265c58a9e64e0e';

async function testEndpoints() {
  try {
    const proxyRes = await axios.post(OWLET_API_URL, { key: OWLET_API_KEY, action: 'proxy_catalog' });
    console.log("Proxy Catalog:", proxyRes.data.length ? proxyRes.data.slice(0, 2) : proxyRes.data);
  } catch (e) {
    console.log("Proxy Error:", e.message);
  }

  try {
    const gameProductsRes = await axios.post(OWLET_API_URL, { key: OWLET_API_KEY, action: 'game_products' });
    console.log("Game Products:", gameProductsRes.data.length ? gameProductsRes.data.slice(0, 2) : gameProductsRes.data);
  } catch (e) {
    console.log("Game Products Error:", e.message);
  }
}
testEndpoints();
