const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createOnlinePreview}=require('../tests/helpers/online-preview');

async function main(){
  const functionalOnly=process.argv.includes('--functional-only');
  const engine=process.argv.includes('--browser=webkit')?'webkit':'chromium';
  const folder=process.env.HOMEAUTO_ONBOARDING_QA_DIR||path.resolve(__dirname,'../../.local/qa/onboarding',engine);fs.mkdirSync(folder,{recursive:true});
  const result={engine,fixture:'Disposable database; simulated hardware only',checks:[],screenshots:[],errors:[],violations:[],device_network_writes:0};
  const f=await createOnlinePreview();let browser,page;const responseFailures=[];
  try{
    browser=await({chromium,webkit}[engine]).launch();const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',acceptDownloads:true});page=await context.newPage();
    page.on('pageerror',e=>result.errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)responseFailures.push({path:new URL(r.url()).pathname,status:r.status()});});
    page.on('request',r=>{if(/^\/api\/(commands|devices|assistant\/execute)(\/|$)/.test(new URL(r.url()).pathname)&&r.method()!=='GET')result.device_network_writes++;});
    await page.route('**/*',route=>new URL(route.request().url()).origin===f.url?route.continue():route.abort());
    const inspect=async name=>{
      await page.locator('main[aria-busy="true"]').waitFor({state:'detached'});await page.locator('main .loading-panel').waitFor({state:'detached'});
      assert.deepEqual(await page.evaluate(()=>{const issues=[];if(document.documentElement.scrollWidth>innerWidth+1)issues.push('Horizontal overflow');for(const e of document.querySelectorAll('main h1,main h2,main button,main .button,dialog button')){const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;if(r.left< -1||r.right>innerWidth+1)issues.push('Clipped: '+e.textContent);if(e.matches('button,.button')&&(r.width<44||r.height<44))issues.push('Small target: '+e.textContent);}return issues;}),[],name);
      await page.addScriptTag({url:'/__qa/axe.js'});const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));if(violations.length)result.violations.push({name,violations});assert.deepEqual(violations,[],name);
      await page.screenshot({path:path.join(folder,name+'.png'),fullPage:true});result.screenshots.push(name+'.png');
    };
    const username='onboarding-owner',password='synthetic-onboarding-password';
    await page.goto(f.url+'/signup');await page.getByLabel('Your name',{exact:true}).fill('New home owner');await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByLabel('Confirm password',{exact:true}).fill(password);await page.getByRole('button',{name:'Create account',exact:true}).click();await page.waitForURL(f.url+'/login');
    await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Set up your home',exact:true}).waitFor();
    assert.equal(await page.getByText('Home gateway is offline',{exact:true}).count(),0);assert.ok(await page.getByRole('link',{name:'Connect gateway',exact:true}).count());assert.equal(await page.getByRole('button',{name:'Explore demo home',exact:true}).count(),1);result.checks.push('New account receives real gateway setup and an explicit demo choice');
    await page.getByRole('button',{name:'Explore demo home',exact:true}).click();await page.getByRole('heading',{name:'Demo home',exact:true}).waitFor();await page.getByText('Simulated devices. No physical commands are sent.',{exact:true}).waitFor();
    await page.locator('[data-device-id="light-1"]').getByRole('button',{name:'Sofa light: Turn off',exact:true}).click();await page.locator('[data-device-id="light-1"]').getByRole('button',{name:'Sofa light: Turn on',exact:true}).waitFor();
    await page.getByRole('button',{name:'Simulate gas alert',exact:true}).click();await page.getByRole('heading',{name:'Demo home',exact:true}).waitFor();
    await page.reload();await page.getByRole('heading',{name:'Demo home',exact:true}).waitFor();await page.locator('[data-device-id="light-1"]').getByRole('button',{name:'Sofa light: Turn on',exact:true}).waitFor();
    await page.getByRole('button',{name:'Use my real home',exact:true}).click();await page.getByRole('heading',{name:'Set up your home',exact:true}).waitFor();assert.equal(result.device_network_writes,0);result.checks.push('Domain demo persists across refresh, returns to real empty home, and sends no device commands');
    for(const theme of (functionalOnly?['05']:['05','01','03','04']))for(const [width,height]of (functionalOnly?[[390,844]]:[[320,568],[768,1024],[1440,1000]])){
      await page.evaluate(async theme=>(await import('/js/preferences.js')).applyPreferences({theme}),theme);await page.setViewportSize({width,height});await page.locator('.home-name').click();await page.waitForURL(f.url+'/');await page.getByRole('heading',{name:'Set up your home',exact:true}).waitFor();await inspect(theme+'-'+width+'-welcome');await page.getByRole('link',{name:'Connect gateway',exact:true}).click();await page.getByRole('heading',{name:'No gateway added',exact:true}).waitFor();await inspect(theme+'-'+width+'-gateway');
    }
    await page.setViewportSize({width:390,height:844});assert.equal((await page.request.post(f.url+'/api/gateway-setup',{headers:{Origin:f.url},data:{replace_unused:false}})).status(),403);assert.equal((await page.request.post(f.url+'/api/gateway-setup',{headers:{Origin:'https://foreign.invalid'},data:{replace_unused:false}})).status(),403);await page.getByRole('button',{name:'Create connection file',exact:true}).click();await page.getByRole('dialog').getByLabel('Password',{exact:true}).fill(password);await page.getByRole('dialog').getByRole('button',{name:'Reauthenticate',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Create connection file',exact:true}).click();await page.getByRole('heading',{name:'Connection file ready',exact:true}).waitFor();
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download connection file',exact:true}).click();const download=await downloadPromise;
    // Read synthetic credentials only in memory. Never save the download to report artifacts.
    const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const config=JSON.parse(Buffer.concat(chunks));assert.equal(config.version,1);assert.match(config.gateway_token,/^[a-f0-9]{64}$/);assert.equal(config.origin,f.url);await download.delete();
    await page.getByRole('dialog').getByRole('button',{name:'Done',exact:true}).click();await page.getByRole('heading',{name:'Waiting for the first connection',exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'Replace setup file',exact:true}).count());
    result.checks.push('Fresh password confirmation creates a private one-time download; pending connection is explicit');
    assert.equal(await page.getByRole('button',{name:'Explore demo home',exact:true}).count(),0);
    await page.reload();await page.getByRole('heading',{name:'Waiting for the first connection',exact:true}).waitFor();
    for(const theme of (functionalOnly?['05']:['05','01','03','04']))for(const [width,height]of (functionalOnly?[[390,844]]:[[320,568],[768,1024],[1440,1000]])){
      await page.evaluate(async theme=>(await import('/js/preferences.js')).applyPreferences({theme}),theme);await page.setViewportSize({width,height});
      for(const [route,title]of [['/','Set up your home'],['/rooms','Set up your home'],['/security','Set up your home'],['/assistant','Set up your home'],['/settings','Settings'],['/security/activity','Set up your home'],['/modules','Modules']]){if(['/', '/rooms', '/security', '/assistant', '/settings'].includes(route)){await page.locator(`.primary-nav a[href="${route}"]`).click();await page.waitForURL(f.url+route);}else await page.goto(f.url+route);await page.getByRole('heading',{name:title,exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Explore demo home',exact:true}).count(),['/settings','/modules'].includes(route)?0:1);await inspect(theme+'-'+width+'-real-'+(route.replaceAll('/','-')||'home'));}
    }
    await page.setViewportSize({width:390,height:844});await page.goto(f.url+'/settings/gateway');await page.getByRole('heading',{name:'Waiting for the first connection',exact:true}).waitFor();
    await page.getByRole('button',{name:'Replace setup file',exact:true}).click();const confirmation=page.getByRole('dialog');await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();await confirmation.waitFor({state:'detached'});assert.equal(await page.getByRole('button',{name:'Replace setup file',exact:true}).evaluate(n=>n===document.activeElement),true);
    await page.getByRole('link',{name:'My home',exact:true}).click();await page.waitForURL(f.url+'/');await page.getByRole('heading',{name:'Set up your home',exact:true}).waitFor();
    const real=await page.evaluate(async()=>(await(await fetch('/api/snapshot')).json()));assert.equal(real.devices.length,0);assert.equal(real.gateway.state,'awaiting_connection');assert.equal(real.demo,undefined);assert.equal(result.device_network_writes,0);assert.deepEqual(result.errors,[]);
    result.checks.push('Pending enrollment survives refresh; four themes at phone/tablet/desktop sizes; real empty-home sections and Modules; cancellation restores focus; My home returns to setup; zero device command requests');
    result.passed=true;
  }catch(error){result.failure={message:error.message,route:page?.url(),headings:await page?.locator('h1').allTextContents().catch(()=>[]),responses:responseFailures.slice(-8)};console.error(JSON.stringify(result.failure));throw error;}finally{if(browser)await browser.close();await f.stop();fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify(result,null,2));}
  console.log(JSON.stringify({engine,passed:result.passed,screenshots:result.screenshots.length,device_network_writes:result.device_network_writes}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
