const axios = require('axios');
const API_URL = 'https://the-owlet.com/api/v2';
const API_KEY = 'owlet_79e2a3a5ab9135d1c4e417b48cd7795b02265c58a9e64e0e';

async function testApi() {
  const countries = ['NG', 'US', 'GB', 'CA', 'GH'];
  for (const c of countries) {
    try {
      const numRes = await axios.post(API_URL, {
        key: API_KEY,
        action: 'number_services',
        country: c
      });
      console.log(`number_services for ${c} response:`, JSON.stringify(numRes.data).substring(0, 100));
    } catch (e) {}
  }
  
  // also let's check number_countries
  try {
      const countryRes = await axios.post(API_URL, {
        key: API_KEY,
        action: 'number_countries'
      });
      console.log(`number_countries response:`, JSON.stringify(countryRes.data).substring(0, 100));
    } catch (e) {}
}

testApi();
