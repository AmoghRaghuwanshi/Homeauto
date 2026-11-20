const { chromium } = require('playwright');
const { startSimulation } = require('./simulation');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const fixture = await startSimulation({port:0});
  const folder = path.resolve(__dirname,'../../.local/qa/simulation-return');
  fs.mkdirSync(folder,{recursive:true});
  const report = {checks:[],captures:[],errors:[],external:[]};
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({viewport:{width:390,height:844}});
    page.on('pageerror',error=>report.errors.push(error.message));
    await page.route('**/*',route=>new URL(route.request().url()).origin===fixture.url ? route.continue() : (report.external.push(route.request().url()),route.abort()));
    await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop(){}}]});window.SpeechRecognition=class {start(){} abort(){}};});
    await page.goto(fixture.url+'/assistant');
    await page.waitForFunction(()=>document.documentElement.dataset.connected==='true');
    assert.equal(await page.locator('#assistant-mic').isEnabled(),true);
    assert.equal(await page.getByText('Simulation — no physical devices connected',{exact:true}).count(),1);
    assert.equal(await page.getByRole('heading',{name:'Connect your ESP32',exact:true}).count(),0);
    await page.getByLabel('Type a request',{exact:true}).fill('turn on light two');
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('assistant-messages').textContent.includes('Light 2'));
    await page.waitForFunction(async()=>{const data=await(await fetch('/api/snapshot')).json();return data.devices.find(d=>d.id==='light-2').observation.reported_status==='on';});
    report.checks.push('Simulation opens without owner setup or an ESP32, supports browser voice, and executes a simulated light request');
    await page.goto(fixture.url+'/modules');
    await page.getByRole('heading',{name:'Camera simulation',exact:true}).waitFor();
    await page.getByRole('button',{name:'Simulate gas alert',exact:true}).click();
    await page.waitForFunction(async()=>{const data=await(await fetch('/api/snapshot')).json();return data.devices.find(d=>d.id==='sensor-gas').latest.alert;});
    await page.getByRole('button',{name:'Clear scenario',exact:true}).click();
    await page.waitForFunction(async()=>{const data=await(await fetch('/api/snapshot')).json();return !data.devices.find(d=>d.id==='sensor-gas').latest.alert;});
    const before=fixture.runtime.repo.one('SELECT COUNT(*) n FROM commands').n;
    const preview=page.getByRole('button',{name:'Preview test camera',exact:true});
    await preview.click();
    await page.getByRole('dialog').getByRole('img',{name:'Generated camera test image',exact:true}).waitFor();
    await page.waitForFunction(()=>{const image=document.querySelector('dialog img');return image?.complete&&image.naturalWidth>0;});
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({state:'detached'});
    assert.equal(await preview.evaluate(n=>n===document.activeElement),true);
    report.checks.push('Sensor scenarios change only simulated reports; camera test pattern decodes and closing restores focus');
    for(const [label,expected] of [['Simulate camera offline','Test camera unavailable'],['Simulate stale frame','Test frame is stale'],['Simulate camera failure','Test camera unavailable']]){
      await page.getByRole('button',{name:label,exact:true}).click();
      await page.getByText(expected,{exact:true}).waitFor();
      assert.equal(await preview.isDisabled(),true);
      assert.equal((await page.request.get(fixture.url+'/api/camera/frame')).status(),503);
      assert.equal((await page.request.get(fixture.url+'/api/snapshot')).status(),200);
      await page.getByRole('button',{name:'Restore test camera',exact:true}).click();
      await page.getByText('Test frame available',{exact:true}).waitFor();
    }
    assert.equal(fixture.runtime.repo.one('SELECT COUNT(*) n FROM commands').n,before);
    report.checks.push('Camera stale/offline/fault recovery stays independent of home controls and sends no door command');
    for(const theme of ['05','01','03','04'])for(const width of [320,768,1280]){
      await page.evaluate(async theme=>(await import('/js/preferences.js')).applyPreferences({theme}),theme);
      await page.setViewportSize({width,height:844});
      const issues=await page.evaluate(()=>{const out=[];if(document.documentElement.scrollWidth>innerWidth+1)out.push('overflow');for(const item of document.querySelectorAll('main button,main a')){const r=item.getBoundingClientRect();if(!r.width||!r.height)continue;if(r.width<44||r.height<44)out.push('small target');if(r.left<0||r.right>innerWidth+1)out.push('clipped');}return out;});
      assert.deepEqual(issues,[]);
      await page.addScriptTag({url:'/__qa/axe.js'});
      const violations=await page.evaluate(async()=>(await axe.run('main',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>v.id));
      assert.deepEqual(violations,[]);
      const capture='simulation-'+theme+'-'+width+'.png';await page.screenshot({path:path.join(folder,capture),fullPage:true});report.captures.push(capture);
    }
    await page.evaluate(async()=>(await import('/js/preferences.js')).applyPreferences({theme:'05',language:'hi'}));
    await page.reload();await page.getByRole('heading',{name:'कैमरे का सिमुलेशन',exact:true}).waitFor();
    report.checks.push('Four themes at mobile/tablet/desktop widths have usable targets and no accessibility violations; Hindi copy renders');
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);
  } finally {
    fs.writeFileSync(path.join(folder,'browser-results.json'),JSON.stringify(report,null,2));
    await browser?.close();await fixture.runtime.stop();
  }
  console.log(JSON.stringify({checks:report.checks.length,captures:report.captures.length,errors:report.errors.length,external:report.external.length}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
