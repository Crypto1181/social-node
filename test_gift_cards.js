const axios = require('axios');
require('dotenv').config();
const API_URL = 'https://the-owlet.com/api/v2';
const API_KEY = process.env.OWLET_API_KEY || 'owlet_79e2a3a5ab9135d1c4e417b48cd7795b02265c58a9e64e0e';

async function run() {
  try {
    const res = await axios.post(API_URL, {key: API_KEY, action: 'services'});
    const services = res.data;
    // Filter for gift cards
    const giftCards = services.filter(s => s.name && s.name.toLowerCase().includes('gift'));
    console.log("Gift Card Services:", giftCards.slice(0, 5));
    
    // Filter for virtual cards
    const virtualCards = services.filter(s => s.name && s.name.toLowerCase().includes('virtual') || s.name.toLowerCase().includes('card'));
    console.log("Virtual Card Services:", virtualCards.slice(0, 5));
  } catch(e) {
    console.log(e.message);
  }
}
run();
