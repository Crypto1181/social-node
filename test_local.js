const axios = require('axios');
async function test() {
  try {
    // We need a token. We can just login as an existing user.
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'test@example.com', // wait, I don't know the test user email
      password: 'password123'
    });
    console.log("Logged in");
  } catch (e) {
    console.log("Login failed:", e.message);
  }
}
test();
