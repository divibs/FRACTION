const axios = require('axios');
const { Solver } = require('2captcha');
const readline = require('readline');
const { URL } = require('url');

const CONFIG = {
  apiKey: 'your-2captcha-api',
  // Use the token as obtained initially. It will be auto-refreshed if needed.
  token: 'Bearer eyJhbGci...',
  userId: USERID,
  agentId: AGENTID,
  sessionTypeId: 5, // Dobby arena = 5 Normal Arena = 1 
  entryFees: 0.01, // pick fees you like 0.1 0.01 0.001
  // Refresh token endpoint and credentials (update these values per your API spec)
  refreshUrl: 'https://dapp-backend-4x.fractionai.xyz/api3/auth/refresh',
  refreshPayload: {
    // Example: include userId and any other credentials needed to generate a new token.
    userId: 5783,
    // Add any additional fields required by the refresh endpoint.
  }
};

const solver = new Solver(CONFIG.apiKey);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Returns a random integer between min and max (inclusive).
 */
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Wait for a specified number of milliseconds.
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCaptchaImage(imageUrl) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const urlObj = new URL(imageUrl);
    const pathname = urlObj.pathname;
    const extension = pathname.substring(pathname.lastIndexOf('.') + 1).toLowerCase();
    return {
      base64: Buffer.from(response.data).toString('base64'),
      extension
    };
  } catch (error) {
    console.error('⚠️ Failed to download CAPTCHA image:', error.message);
    return null;
  }
}

async function solveCaptcha(imageUrl) {
  try {
    console.log('🔍 Downloading CAPTCHA...');
    const imageData = await getCaptchaImage(imageUrl);
    if (!imageData) return null;

    console.log('🔄 Submitting CAPTCHA to 2Captcha...');
    const response = await solver.imageCaptcha(imageData.base64, {
      case: 1,
      png: imageData.extension === 'png' ? 1 : 0
    });
    console.log('2Captcha Response:', response);
    if (!response?.data) {
      throw new Error('No solution in 2Captcha response');
    }
    // Force uppercase because the server expects uppercase
    return response.data.trim().toUpperCase();
  } catch (error) {
    console.error('❌ CAPTCHA Error:', error.message);
    return null;
  }
}

async function refreshToken() {
  try {
    console.log('🔄 Refreshing token...');
    // Adjust the payload and headers as required by your API.
    const res = await axios.post(CONFIG.refreshUrl, CONFIG.refreshPayload, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.data && res.data.token) {
      CONFIG.token = 'Bearer ' + res.data.token;
      console.log('✅ Token refreshed successfully:', CONFIG.token);
    } else {
      console.log('⚠️ Token refresh failed: no token returned.');
    }
  } catch (error) {
    console.error('❌ Error refreshing token:', error.message);
  }
}

async function main() {
  console.log('Fetching nonce and CAPTCHA...');
  const nonceRes = await axios.get('https://dapp-backend-4x.fractionai.xyz/api3/auth/nonce', {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'en-US,en;q=0.7',
      'Allowed-State': 'na',
      Authorization: CONFIG.token,
      Connection: 'keep-alive',
      Origin: 'https://dapp.fractionai.xyz',
      Referer: 'https://dapp.fractionai.xyz/',
      'Sec-Ch-Ua': '"Not.A/Brand";v="99", "Brave";v="133", "Chromium";v="133"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
      'Sec-Gpc': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
    }
  });

  const { nonce, image } = nonceRes.data;
  console.log(`Nonce received: ${nonce}`);
  console.log(`CAPTCHA image URL: ${image}`);

  let captchaSolution = await solveCaptcha(image);
  if (!captchaSolution) {
    captchaSolution = await new Promise(resolve =>
      rl.question('⚠️ Enter CAPTCHA manually: ', resolve)
    );
    captchaSolution = captchaSolution.trim().toUpperCase();
  }
  console.log('Using CAPTCHA solution:', captchaSolution);

  const payload = {
    userId: CONFIG.userId,
    agentId: CONFIG.agentId,
    entryFees: CONFIG.entryFees,
    sessionTypeId: CONFIG.sessionTypeId,
    nonce,
    captchaText: captchaSolution
  };
  console.log('Initiating battle with payload:', payload);

  const battleRes = await axios.post(
    'https://dapp-backend-4x.fractionai.xyz/api3/matchmaking/initiate',
    payload,
    {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.7',
        'Allowed-State': 'na',
        Authorization: CONFIG.token,
        Connection: 'keep-alive',
        'Content-Type': 'application/json',
        Origin: 'https://dapp.fractionai.xyz',
        Referer: 'https://dapp.fractionai.xyz/',
        'Sec-Ch-Ua': '"Not.A/Brand";v="99", "Brave";v="133", "Chromium";v="133"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'Sec-Gpc': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
      }
    }
  );

  console.log('✅ Battle initiated successfully:', battleRes.data);
}

async function runLoop() {
  try {
    await main();
    // Wait a random delay between 2 and 3 minutes before the next run.
    const minMs = 2 * 60 * 1000; // 2 minutes
    const maxMs = 3 * 60 * 1000; // 3 minutes
    const randomDelay = getRandomInt(minMs, maxMs);
    console.log(`\n⏳ Next run in ${Math.round(randomDelay / 1000)} seconds...\n`);
    await wait(randomDelay);
  } catch (error) {
    const errMsg = error.response?.data?.error || error.message;
    console.error('💥 Error in runLoop:', errMsg);
    // If error is 401 (Unauthorized), try refreshing token
    if (error.response && error.response.status === 401) {
      await refreshToken();
      // Wait 2 minutes before retrying after token refresh
      await wait(2 * 60 * 1000);
    }
    // If error indicates session limit reached, pause until next hour's :01 minute mark.
    else if (errMsg.includes('User has reached maximum number of sessions')) {
      // Get current time in Asia/Manila (GMT+8)
      const nowStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
      const now = new Date(nowStr);
      console.log(`Current GMT+8 time: ${now.toLocaleTimeString()}`);

      // Set target to next hour's :01 minute mark.
      const target = new Date(now);
      target.setHours(now.getHours() + 1, 1, 0, 0);
      const delay = target - now;
      console.log(`Session limit reached. Pausing until ${target.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila' })} GMT+8 (${Math.round(delay / 1000)} seconds)...`);
      await wait(delay);
    } else {
      // For other errors, wait a random delay between 2 and 3 minutes.
      const minMs = 2 * 60 * 1000;
      const maxMs = 3 * 60 * 1000;
      const randomDelay = getRandomInt(minMs, maxMs);
      console.log(`\n⏳ Next run in ${Math.round(randomDelay / 1000)} seconds...\n`);
      await wait(randomDelay);
    }
  } finally {
    runLoop();
  }
}

// Start the loop
runLoop();
