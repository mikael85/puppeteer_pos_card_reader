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

};

main();