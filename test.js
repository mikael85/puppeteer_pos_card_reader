const puppeteer = require('puppeteer-core');
const https = require('https');

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

// function b2a(a) {
const b2a = (a) => {
    var c, d, e, f, g, h, i, j, o, b = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", k = 0, l = 0, m = "", n = [];
    if (!a) return a;
    do c = a.charCodeAt(k++), d = a.charCodeAt(k++), e = a.charCodeAt(k++), j = c << 16 | d << 8 | e,
        f = 63 & j >> 18, g = 63 & j >> 12, h = 63 & j >> 6, i = 63 & j, n[l++] = b.charAt(f) + b.charAt(g) + b.charAt(h) + b.charAt(i); while (k < a.length);
    return m = n.join(""), o = a.length % 3, (o ? m.slice(0, o - 3) : m) + "===".slice(o || 3);
};

const main = async () => {
    const hcid = 'KlYknhJn2'; //hardcoded
    var raw_coupon = false;
    while (!raw_coupon) {
        try {
            raw_coupon = await _get_raw_coupon(hcid);
            if (raw_coupon.result) {
                raw_coupon = raw_coupon.data;
            }
        } catch (e) {
            console.error(e);
            raw_coupon = false;
        }
    }
    var base64qr = false;
    // remove <meta/> tags
    raw_coupon = raw_coupon.replace(/<meta[ a-zA-Z"-=]*\/>/g, '');
    //remove <script/> tag and content
    raw_coupon = raw_coupon.replace(/<script[ a-zA-Z"-=]*\/?>[ a-zA-Z.=();{}]*<\/script>/g, '');
    var html_body = await raw_coupon.match(/(<body>(<div class="col".*<\/div><\/div>)(<div class="col".*<\/div><\/div>)<\/body>)/);
    var signature_coupon = html_body[2];
    var qr_coupon = html_body[3];

    //replace img link with base64, so it can be sent to jposbox
    // DO NOT SET /g ON REGEX, it won't be showing capturing groups
    image_tag = await raw_coupon.match(/(<img .* src="(.*)" \/>)/);
    //image_tag[0]: whole match
    //image_tag[1]: whole img tag
    //image_tag[2]: image link, must be passed to _get_base64_qr
    console.log('image_tag[2]:', image_tag[2]);
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
    // base64qr = await _get_base64_qr(image_tag[2]);
    var new_image_tag = `<img width="120" height="120" src="${base64qr}"/>`;
    qr_coupon = qr_coupon.replace(/(<img .* src="(.*)" \/>)/g, new_image_tag);

    const coupon1 = raw_coupon.replace(/(<body>(<div class="col".*<\/div><\/div>)(<div class="col".*<\/div><\/div>)<\/body>)/g, `<body>${signature_coupon}</body>`)
        .replace('<div class="col"', '<div class="row"');
        // .replace('<body>', '<body style="flex-direction: column;">');
    const coupon2 = raw_coupon.replace(/(<body>(<div class="col".*<\/div><\/div>)(<div class="col".*<\/div><\/div>)<\/body>)/g, `<body>${qr_coupon}</body>`)
        .replace('<div class="col"', '<div class="row"');
        // .replace('<body>', '<body style="flex-direction: column;">');


    // console.log('raw_coupon: ', raw_coupon);
    // console.log('image_tag: ', image_tag);
    // console.log('coupon1: ', b2a(coupon1));
    console.log('coupon1: ', coupon1);
    console.log('coupon2: ', coupon2);
    // console.log('coupon2: ', b2a(coupon2));
    // console.log('coupon: ', coupon);
    // console.log('coupon: ', raw_coupon);

};

main();
