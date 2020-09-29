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

const main = async () => {
    const browser = await puppeteer.connect({ browserURL, defaultViewport });

    const pages = await browser.pages();
    let posPage = false;
    let cardSwipedData = false;

    let mbbxFrm = false;
    let mbbxFrmFilled = false;

    // Search for the first ocurrence of POS Tab Page
    posPage = pages.find(page => page.url().indexOf('/pos/web/') > -1);

    // handle iframe
    const frameHandle = await posPage.$('#mbbx-container iframe:nth-child(2)');
    mbbxFrm = await frameHandle.contentFrame();

    // filling form in iframe
    // await frame.type('input', 'chercher tech');
    
    // mbbxFrm = await posPage.mainFrame().childFrames().find(frame => frame.name().indexOf('mobbex_embed_fw')>-1);

    // await mbbxFrm.click('#payment-methods-single');
    await mbbxFrm.$eval('#payment-methods-single', el => el.click());
    // await mbbxFrm.type('#cc-number', '4894121721340129');


};

main();

