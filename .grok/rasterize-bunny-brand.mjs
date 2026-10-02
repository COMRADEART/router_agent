import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const browser = await chromium.launch({headless:true,channel: 'msedge'});
try {
  const svg=readFileSync('public/favicon.svg','utf8');
  for (const size of [192,512]) {
    const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;}svg{display:block;width:100%;height:100%;}</style>${svg}`);
    await page.screenshot({path:`.grok/bunny-icon-${size}.png`,omitBackground:true});
    await page.close();
  }
} finally { await browser.close(); }

