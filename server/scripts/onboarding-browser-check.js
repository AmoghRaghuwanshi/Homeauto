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
  const f=await createOnlinePreview();let browser;
  try{
    browser=await({chromium,webkit}[engine]).launch();const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',acceptDownloads:true});const page=await context.newPage();
    page.on('pageerror',e=>result.errors.push(e.message));let demoActive=false;
    page.on('request',r=>{if(demoActive&&new URL(r.url()).pathname.startsWith('/api/')&&r.method()!=='GET'&&!new URL(r.url()).pathname.startsWith('/api/auth/'))result.device_network_writes++;});
    await page.route('**/*',route=>new URL(route.request().url()).origin===f.url?route.continue():route.abort());
    const inspect=async name=>{
      assert.deepEqual(await page.evaluate(()=>{const issues=[];if(document.documentElement.scrollWidth>innerWidth+1)issues.push('Horizontal overflow');for(const e of document.querySelectorAll('main h1,main h2,main button,main .button,dialog button')){const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;if(r.left< -1||r.right>innerWidth+1)issues.push('Clipped: '+e.textContent);if(e.matches('button,.button')&&(r.width<44||r.height<44))issues.push('Small target: '+e.textContent);}return issues;}),[],name);
      await page.addScriptTag({url:'/__qa/axe.js'});const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));if(violations.length)result.violations.push({name,violations});assert.deepEqual(violations,[],name);
      await page.screenshot({path:path.join(folder,name+'.png'),fullPage:true});result.screenshots.push(name+'.png');
    };
    const username='onboarding-owner',password='synthetic-onboarding-password';
    await page.goto(f.url+'/signup');await page.getByLabel('Your name',{exact:true}).fill('New home owner');await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByLabel('Confirm password',{exact:true}).fill(password);await page.getByRole('button',{name:'Create account',exact:true}).click();await page.waitForURL(f.url+'/login');
    await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Set up your home',exact:true}).waitFor();
    assert.equal(await page.getByText('Home gateway is offline',{exact:true}).count(),0);assert.ok(await page.getByRole('link',{name:'Connect gateway',exact:true}).count());result.checks.push('New account receives gateway-first setup and a separate demo choice, without false offline alarm');
    for(const theme of (functionalOnly?['05']:['05','01','03','04']))for(const [width,height]of (functionalOnly?[[390,844]]:[[320,568],[768,1024],[1440,1000]])){
      await page.evaluate(async theme=>(await import('/js/preferences.js')).applyPreferences({theme}),theme);await page.setViewportSize({width,height});await page.goto(f.url+'/');await page.getByRole('heading',{name:'Set up your home',exact:true}).waitFor();await inspect(theme+'-'+width+'-welcome');await page.getByRole('link',{name:'Connect gateway',exact:true}).click();await page.getByRole('heading',{name:'No gateway added',exact:true}).waitFor();await inspect(theme+'-'+width+'-gateway');
    }
    await page.setViewportSize({width:390,height:844});assert.equal((await page.request.post(f.url+'/api/gateway-setup',{headers:{Origin:f.url},data:{replace_unused:false}})).status(),403);assert.equal((await page.request.post(f.url+'/api/gateway-setup',{headers:{Origin:'https://foreign.invalid'},data:{replace_unused:false}})).status(),403);await page.getByRole('button',{name:'Create connection file',exact:true}).click();await page.getByRole('dialog').getByLabel('Password',{exact:true}).fill(password);await page.getByRole('dialog').getByRole('button',{name:'Reauthenticate',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Create connection file',exact:true}).click();await page.getByRole('heading',{name:'Connection file ready',exact:true}).waitFor();
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download connection file',exact:true}).click();const download=await downloadPromise;
    // Read synthetic credentials only in memory. Never save the download to report artifacts.
    const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const config=JSON.parse(Buffer.concat(chunks));assert.equal(config.version,1);assert.match(config.gateway_token,/^[a-f0-9]{64}$/);assert.equal(config.origin,f.url);await download.delete();
    await page.getByRole('dialog').getByRole('button',{name:'Done',exact:true}).click();await page.getByRole('heading',{name:'Waiting for the first connection',exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'Replace setup file',exact:true}).count());
    result.checks.push('Fresh password confirmation creates a private one-time download; pending connection is explicit');
    await page.getByRole('button',{name:'Explore demo home',exact:true}).click();demoActive=true;await page.getByRole('heading',{name:'Demo home',exact:true}).waitFor();await page.getByRole('button',{name:'Sofa light: Turn off',exact:true}).click();await page.getByRole('button',{name:'Sofa light: Turn on',exact:true}).waitFor();await page.reload();await page.getByRole('button',{name:'Sofa light: Turn on',exact:true}).waitFor();
    for(const theme of (functionalOnly?['05']:['05','01','03','04']))for(const [width,height]of (functionalOnly?[[390,844]]:[[320,568],[768,1024],[1440,1000]])){
      await page.evaluate(async theme=>(await import('/js/preferences.js')).applyPreferences({theme}),theme);await page.setViewportSize({width,height});
      for(const [route,title]of [['/','Demo home'],['/rooms','Rooms'],['/security','Security'],['/assistant','Shrimaan'],['/settings','Settings'],['/security/activity','Activity']]){await page.goto(f.url+route);await page.getByRole('heading',{name:title,exact:true}).waitFor();await inspect(theme+'-'+width+'-demo-'+(route.replaceAll('/','-')||'home'));}
    }
    await page.goto(f.url+'/assistant');await page.getByLabel('Type a request',{exact:true}).fill('turn off sofa light');await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByText('Sofa light: Simulated report off',{exact:false}).waitFor();await page.getByRole('link',{name:'My home',exact:true}).click();await page.getByRole('button',{name:'Sofa light: Turn on',exact:true}).waitFor();result.checks.push('Shrimaan text preview controls only simulated lights');
    await page.setViewportSize({width:390,height:844});await page.goto(f.url+'/');await page.getByRole('button',{name:'Simulate gas alert',exact:true}).click();await page.getByRole('link',{name:'View alerts',exact:true}).click();await page.getByRole('heading',{name:'Gas sensor reports a possible issue.',exact:true}).waitFor();
    await page.goto(f.url+'/');await page.getByRole('button',{name:'Reset demo',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Reset demo',exact:true}).evaluate(n=>n===document.activeElement),true);
    await page.goto(f.url+'/rooms/living-room');await page.getByRole('heading',{name:'Living room',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'Living room',exact:true}).waitFor();await page.getByRole('link',{name:'My home',exact:true}).click();await page.getByRole('heading',{name:'Demo home',exact:true}).waitFor();
    await page.getByRole('button',{name:'Use my real home',exact:true}).click();demoActive=false;await page.getByRole('heading',{name:'Set up your home',exact:true}).waitFor();
    const real=await page.evaluate(async()=>(await(await fetch('/api/snapshot')).json()));assert.equal(real.devices.length,0);assert.equal(real.gateway.state,'awaiting_connection');assert.equal(real.demo,undefined);assert.equal(result.device_network_writes,0);assert.deepEqual(result.errors,[]);
    result.checks.push('Simulated lights and refresh persistence; all main screens in four themes at phone/tablet/desktop sizes; alert scenario; modal focus return; nested refresh; My home; exit restores empty real home; zero hardware API writes');
    result.passed=true;
  }finally{if(browser)await browser.close();await f.stop();fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify(result,null,2));}
  console.log(JSON.stringify({engine,passed:result.passed,screenshots:result.screenshots.length,device_network_writes:result.device_network_writes}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
