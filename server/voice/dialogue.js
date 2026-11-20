// Small offline dialogue classifier. It can select replies, never device actions.
const { detectWakeWord } = require('./intent');

function dialogueKind(text, parsed) {
  if (typeof text !== 'string' || !text.trim() || text.length > 500) return null;
  const wake = detectWakeWord(text);
  const s = wake.command;
  const question = s.replace(/^(?:hello|hi|hey|नमस्ते|नमस्कार|हैलो)\s+/u, '');
  if (!s && wake.found) return 'greeting';
  if (/^(?:hi|hello|hello there|hey|namaste|namaskar|good morning|good afternoon|good evening|नमस्ते|नमस्कार|हेलो|हैलो|हाय)(?: shrimaan| श्रीमान| जी)?$/u.test(s)) return 'greeting';
  if (/^(?:who are you|what is your name|what s your name|आप कौन हैं|तुम कौन हो|आपका नाम क्या है|तुम्हारा नाम क्या है)$/u.test(question)) return 'identity';
  if (/^(?:how are you|how are you doing|आप कैसे हैं|कैसे हो|कैसे हैं|तुम कैसे हो|तुम कैसी हो)$/u.test(question)) return 'wellbeing';
  if (/^(?:help|help me|what can you do|what can you help me with|how can you help me|how can you help|मदद|मेरी मदद करो|आप क्या कर सकते हैं|आप क्या क्या कर सकते हैं|आप क्या कर सकती हैं|तुम क्या कर सकते हो|तुम क्या क्या कर सकते हो|तुम क्या कर सकती हो|क्या क्या कर सकते हो|आप मेरी कैसे मदद कर सकते हैं)$/u.test(question)) return 'capabilities';
  if (/^(?:thanks|thank you|thank you very much|धन्यवाद|शुक्रिया|बहुत धन्यवाद)$/u.test(s)) return 'thanks';
  if (/^(?:bye|goodbye|good night|अलविदा|फिर मिलेंगे|शुभ रात्रि)$/u.test(s)) return 'goodbye';
  // An unsupported qualifier, negation or target in a home command must not
  // become a valid action through conversational matching. Keep policy errors.
  const homeWords = /(?:\b(?:lights?|lamps?|rooms?|doors?|gates?|gas|motion|movement|rfid)\b|लाइट|लाईट|बत्ती|कमरा|कमरे|रूम|दरवाजा|दरवाज़ा|गेट|गैस|मोशन|हलचल)/u.test(s);
  if (parsed?.ok || ['negated', 'conflicting', 'unknown_target'].includes(parsed?.reason)) return null;
  // Definitions and other unsupported questions can mention a device without
  // being requests to operate it. They receive guidance, never inferred actions.
  if (/^(?:what|who|why|where|how|when)\b/u.test(s) || /(?:^|\s)(?:कैसे|क्यों|कहाँ|कौन|कब)(?:\s|$)/u.test(s)) return 'scope';
  if (homeWords) return null;
  return 'scope';
}

function capabilityText(home, actor, language) {
  const devices = home.repo.getDevices();
  const control = ['owner', 'resident'].includes(actor.role);
  const parts = [];
  if (control && devices.some(d => d.type === 'light')) parts.push(language === 'hi' ? 'लाइट चालू या बंद कर सकता हूँ' : 'turn lights on or off');
  if (control && home.allowDoor && devices.some(d => d.id === 'door-1')) parts.push(language === 'hi' ? 'दरवाज़ा लॉक कर सकता हूँ' : 'lock the door');
  if (devices.length) parts.push(language === 'hi' ? 'उपकरणों की स्थिति बता सकता हूँ' : 'check device status');
  if (!parts.length) return language === 'hi' ? 'इस घर में अभी कोई समर्थित उपकरण सेट अप नहीं है।' : 'No supported devices are set up in this home yet.';
  const last = parts.pop();
  const joined = parts.length ? parts.join(', ') + (language === 'hi' ? ' और ' : ' and ') + last : last;
  return (language === 'hi' ? 'मैं ' : 'I can ') + joined + (language === 'hi' ? '।' : '.');
}

function dialogueText(kind, home, actor, language) {
  if (!['en', 'hi'].includes(language)) throw new Error('Unsupported reply language');
  const hindi = language === 'hi';
  switch (kind) {
    case 'greeting': return hindi ? 'नमस्ते! मैं श्रीमान हूँ। घर के किस काम में मदद चाहिए?' : "Hello! I'm Shrimaan. What would you like help with at home?";
    case 'identity': return hindi ? 'मैं श्रीमान हूँ, आपके घर का सहायक। ' + capabilityText(home, actor, language) : "I'm Shrimaan, your home assistant. " + capabilityText(home, actor, language);
    case 'wellbeing': return hindi ? 'मैं घर के काम में आपकी मदद के लिए तैयार हूँ। क्या करना है?' : "I'm ready to help with your home. What would you like to do?";
    case 'thanks': return hindi ? 'घर के किसी और काम में मदद चाहिए तो बताइए।' : "You're welcome. Let me know if you need anything else for your home.";
    case 'goodbye': return hindi ? 'ठीक है। फिर मदद चाहिए हो तो अनुरोध लिखें या माइक्रोफ़ोन दबाएँ।' : 'Okay. Type a request or tap the microphone whenever you need help again.';
    case 'capabilities': return capabilityText(home, actor, language) + (hindi ? ' दरवाज़ा अनलॉक करने और एक्सेस कार्ड के लिए सुरक्षा पेज खोलें।' : ' Use Security for door unlocking and access cards.');
    case 'scope': return (hindi ? 'मैं फिलहाल यह काम नहीं कर सकता। ' : "I can't help with that request yet. ") + capabilityText(home, actor, language);
    default: throw new Error('Unknown dialogue reply');
  }
}

module.exports = { dialogueKind, dialogueText };
