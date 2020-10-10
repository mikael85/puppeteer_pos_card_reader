const puppeteer = require('puppeteer-core');

// Must start Chrome with flags: 
// --remote-debugging-port=21222 
// --disable-web-security
// --disable-features=IsolateOrigins,site-per-process

// One and only one Odoo POS Tab
// https://stackoverflow.com/questions/55096771/connecting-browsers-in-puppeteer
// https://stackoverflow.com/questions/46529201/puppeteer-how-to-fill-form-that-is-inside-an-iframe

const browserURL = 'http://127.0.0.1:21222'; // you should start chrome with --remote-debugging-port=21222
const defaultViewport = null; // Disables 800 * 600 default
var cardSwipedData = false;
var frmFilled = false;

const clickNext = async (currentPosPage) => {
  const frameHandle = await currentPosPage.$('#mbbx-container iframe:nth-child(2)');
  mbbxFrm = await frameHandle.contentFrame();
  // for some cases it works, for some others don't.
  // const mbbxFrm = await currentPosPage.mainFrame().childFrames().find(frame => frame.name().indexOf('mobbex_embed_fw') > -1); 
  await mbbxFrm.$eval('#payment-methods-single', el => el.click());
  // return;
};

const fillFrm = async (currentPosPage) => {
  if (!cardSwipedData) {
    return;
  }
  if (frmFilled) {
    return;
  }
  const frameHandle = await currentPosPage.waitForSelector('#mbbx-container iframe:nth-child(2)');
  const mbbxFrm = await frameHandle.contentFrame();

  await mbbxFrm.waitForNavigation();
  await clickNext(currentPosPage);

  await mbbxFrm.type('#cc-number', cardSwipedData.full_number);
  await mbbxFrm.type('#cc-name', cardSwipedData.name);
  await mbbxFrm.type('#card_expiration', `${cardSwipedData.expiration_date.substring(2, 4)}/${cardSwipedData.expiration_date.substring(0, 2)}`);
  frmFilled = true;
  return;
};

const _get_raw_coupon = (id) => {
  const url = `https://ms.mobbex.com/prod/reports/v2/coupon/${id}?schema=card&format=html`;
  const coupon = new Promise((resolve, reject) => {
    https.get(url, (response) => {
      var body = '';
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        body = body.replace(/\s{2,}/g, '').trim();
        resolve({ 'result': true, 'data': body, 'error': null });
      });
    }).on('error', (e) => {
      console.error('Error: ', e);
      reject({ 'result': false, 'data': null, 'error': e });
    });
  });
  return coupon;
};

const _get_base64_qr = (img_url) => {
  const image = new Promise((resolve, reject) => {
    https.get(img_url, (response) => {
      response.setEncoding('base64');
      var body = "data:" + response.headers["content-type"] + ";base64,";
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({ 'result': true, 'data': body, 'error': null });
      });
    }).on('error', (e) => {
      resolve({ 'result': false, 'data': null, 'error': e });
      reject(e);
    });
  });
  return image;
};

const b2a = (a) => {
  var c, d, e, f, g, h, i, j, o, b = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", k = 0, l = 0, m = "", n = [];
  if (!a) return a;
  do c = a.charCodeAt(k++), d = a.charCodeAt(k++), e = a.charCodeAt(k++), j = c << 16 | d << 8 | e,
    f = 63 & j >> 18, g = 63 & j >> 12, h = 63 & j >> 6, i = 63 & j, n[l++] = b.charAt(f) + b.charAt(g) + b.charAt(h) + b.charAt(i); while (k < a.length);
  return m = n.join(""), o = a.length % 3, (o ? m.slice(0, o - 3) : m) + "===".slice(o || 3);
};

const get_coupon = async (transaction_id) => {
  var raw_coupon = false;
  while (!raw_coupon) {
    try {
      raw_coupon = await _get_raw_coupon(transaction_id);
      if (raw_coupon.result) {
        raw_coupon = raw_coupon.data;
      }
    } catch (e) {
      console.error(e);
      raw_coupon = false;
    }
  }
  var base64qr = false;
  raw_coupon = await raw_coupon.replace(/<meta[ a-zA-Z"-=]*\/>/g, ''); // remove <meta/> tags
  raw_coupon = await raw_coupon.replace(/<script[ a-zA-Z"-=]*\/?>[ a-zA-Z.=();{}]*<\/script>/g, ''); //remove <script/> tag and content

  var html_body = await raw_coupon.match(/(<body>(<div class="col".*<\/div><\/div>)(<div class="col".*<\/div><\/div>)<\/body>)/);
  var signature_coupon = html_body[2];
  var qr_coupon = html_body[3];


  image_tag = await raw_coupon.match(/(<img .* src="(.*)" \/>)/); //replace img link with base64, so it can be sent to jposbox
  //image_tag: [0]: whole match, [1]: whole img tag, [2]: image link, must be passed to _get_base64_qr
  while (!base64qr) {
    try {
      base64qr = await _get_base64_qr(image_tag[2]);
      if (base64qr.result) {
        base64qr = base64qr.data;
      }

    } catch (e) {
      console.log(e);
      base64qr = false;
    }
  }

  const new_image_tag = `<img width="120" height="120" src="${base64qr}"/>`;
  qr_coupon = await qr_coupon.replace(/(<img .* src="(.*)" \/>)/g, new_image_tag);
  
  const coupon1 = await raw_coupon.replace(/(<body>(<div class="col".*<\/div><\/div>)(<div class="col".*<\/div><\/div>)<\/body>)/g, `<body>${signature_coupon}</body>`)
    .replace('<div class="col"', '<div class="row"');

  const coupon2 = await raw_coupon.replace(/(<body>(<div class="col".*<\/div><\/div>)(<div class="col".*<\/div><\/div>)<\/body>)/g, `<body>${qr_coupon}</body>`)
    .replace('<div class="col"', '<div class="row"');

  return {
    'mobbex_coupon': coupon1,
    'mobbex_qr_coupon': coupon2,
  };
};

const main = async () => {
  const browser = await puppeteer.connect({ browserURL, defaultViewport });
  const pages = await browser.pages();

  // Search for the first ocurrence of POS Tab Page
  const posPage = pages.find(page => page.url().indexOf('/pos/web/') > -1);

  await posPage.exposeFunction('onMobbexFrmOpen', (url) => {
    console.log('onMobbexFrmOpen');
    fillFrm(posPage);
  });

  await posPage.exposeFunction('onMobbexFrmClose', () => {
    console.log('Mobbex frm closed');
    cardSwipedData = false;
    frmFilled = false;
  });

  // Expose a handler to the page
  await posPage.exposeFunction('onCardSwiped', cardData => {
    cardSwipedData = cardData;
  });

  //TODO: Save first request to avoid process two times
  await posPage.exposeFunction('printMobbexCoupon', async transaction_id => {
    const coupon = await get_coupon(transaction_id).mobbex_coupon;
    // Maniputate posPage to set content
  });

  await posPage.exposeFunction('printMobbexQRCoupon', async transaction_id => {
    const coupon = await get_coupon(transaction_id).mobbex_qr_coupon;
    // Maniputate posPage to set content

  });

};

main();