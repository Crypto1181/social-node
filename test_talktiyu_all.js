const axios = require('axios');
require('dotenv').config();
const API_URL = 'https://the-owlet.com/api/v2';
const API_KEY = process.env.OWLET_API_KEY || 'owlet_79e2a3a5ab9135d1c4e417b48cd7795b02265c58a9e64e0e';

async function run() {
  try {
    const res = await axios.post(API_URL, {key: API_KEY, action: 'number_services'});
    console.log("Number Services:", res.data.slice(0, 3));
  } catch(e) {
    console.log(e.message);
  }
}
run();
