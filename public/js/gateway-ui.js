import { el, icon, button, link, modal, pageHeader } from './components.js';
import { t, errorText, dateText } from './i18n.js';
import { Api } from './api.js';
import { state } from './state.js';

const heading=pageHeader;
export function welcomeHome(ctx) {
  const owner=state.session.user.role==='owner';
  return el('div', { class: 'stack onboarding-page' }, heading('Set up your home', 'Connect your home hub and ESP32 to start.'),
    el('section', { class: 'card stack' }, el('h2', {}, t('Connect your gateway')),
      el('p', {}, t('Your devices will appear after the gateway receives current controller reports.')),
      owner ? link('Connect gateway', '/settings/gateway', 'button button-primary') : el('p', {}, t('Ask the home owner to connect a gateway.'))));
}
function downloadConfig(config) {
  const blob=new Blob([JSON.stringify(config,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
  const a=el('a',{href:url,download:'homeauto-gateway.json'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function gatewayView(ctx) {
  if(Api.demo)return el('div',{class:'settings-wrap stack'},heading('Home gateway','Demo devices do not need a gateway.'),el('section',{class:'card stack'},el('p',{},t('Leave the demo to connect your real home hub.')),button('Use my real home',()=>ctx.exitDemo('/settings/gateway'),{kind:'primary'})));
  if(Api.mode!=='cloud')return el('div',{class:'stack'},heading('Home gateway','Gateway setup is available from the online app.'));
  if(state.session.user.role!=='owner')return el('div',{class:'stack'},heading('Home gateway','Ask the home owner to connect a gateway.'));
  const setup=await Api.request('/api/gateway-setup');
  const labels={not_enrolled:'No gateway added',awaiting_connection:'Waiting for the first connection',connected:'Gateway connected',offline:'Gateway offline',revoked:'Gateway access revoked'};
  const view=el('div',{class:'settings-wrap stack gateway-page'},heading('Home gateway','Connect your own home hub. Local controls remain on the hub.'),
    el('section',{class:'card stack'},el('h2',{},t(labels[setup.state]||'No gateway added')),el('p',{},t('One home hub connects the lights, door and sensors in this home.')),setup.last_seen_at&&el('p',{class:'small muted'},t('Last report'),': ',dateText(setup.last_seen_at)),!setup.available&&el('p',{class:'warning-note'},t('Gateway setup is being updated. Try again shortly.'))));
  const instructions=el('section',{class:'card stack'},el('h2',{},t('Connect in three steps')),
    el('ol',{class:'setup-steps'},el('li',{},el('strong',{},t('Prepare your home hub')),el('p',{},t('Use your local HomeAuto installation on the computer connected to your ESP32 boards. Keep its normal network and device settings.'))),
      el('li',{},el('strong',{},t('Download a private connection file')),el('p',{},t('Confirm your password, then save the file on your home hub. The file contains a secret; keep it private.'))),
      el('li',{},el('strong',{},t('Start the connected hub')),el('p',{},t('Stop the running hub first. From the project folder, run the command below using the downloaded file path.')),el('pre',{class:'setup-command'},el('code',{},'node server/scripts/with-gateway.js "PATH_TO/homeauto-gateway.json"')),el('p',{class:'small muted'},t('This connects reports to the online app. Remote lights and door commands remain disabled; local operation stays on the hub.')))));
  view.append(instructions);
  const canPrepare=setup.available&&['not_enrolled','awaiting_connection'].includes(setup.state);
  if(canPrepare){
    const prepare=()=>ctx.sensitive(()=>modal(setup.registered?'Replace setup file':'Connect your gateway',el('div',{class:'stack'},el('p',{},t(setup.registered?'The previous setup file will stop working. Replace it only before your hub has connected.':'Create a private connection file for this home. Only device reports are enabled.')),el('p',{class:'small muted'},t('The connection file expires after 30 days. Renew it through the home operator before it expires.'))),{confirmLabel:setup.registered?'Replace setup file':'Create connection file',onConfirm:async()=>{
      const result=await Api.request('/api/gateway-setup',{method:'POST',body:{replace_unused:setup.registered},timeoutMs:25000});
      const content=el('div',{class:'stack'},el('p',{},t('Your connection file is ready. Download it now; it cannot be retrieved later.')),button('Download connection file',()=>downloadConfig(result.config),{kind:'primary',symbol:'arrow'}),el('p',{class:'small muted'},t('If you lose the file before connecting, replace the setup file from this page.')));
      setTimeout(()=>modal('Connection file ready',content,{readOnly:true,confirmLabel:'Done'}),0);ctx.run(ctx.refresh);
    }}));
    view.append(el('div',{class:'row row-wrap'},button(setup.registered?'Replace setup file':'Create connection file',prepare,{kind:'primary',symbol:'home'}),button('Check connection',()=>ctx.run(ctx.refresh),{kind:'secondary',symbol:'wifi'})));
  }else view.append(button('Check connection',()=>ctx.run(ctx.refresh),{symbol:'wifi'}));
  if(['offline','revoked','connected'].includes(setup.state))view.append(el('p',{class:'warning-note'},t('An existing gateway is registered. Key renewal or replacement is handled by the local operator to protect the connected home.')));
  return view;
}
