// One text-language policy shared by the browser and local command service.
// Recognition locale selects the browser decoder; it must not relabel Hindi
// words as English. This is bounded script/lexicon detection, not an ASR model.
(function (root, factory) {
  const policy = Object.freeze(factory());
  if (typeof module === 'object' && module.exports) module.exports = policy;
  else root.HomeAutoLanguage = policy;
})(globalThis, function () {
  function inputLanguage(text, fallback = 'en') {
    const value = typeof text === 'string' ? text.normalize('NFC') : '';
    if (/[\u0904-\u0939\u0958-\u0961]/u.test(value)) return 'hi';
    if (/\b(?:karo|kijiye|kariye|chalu|chaalu|bujhao|jalao|kholo|darwaza|darwaja|namaste|namaskar|shukriya|dhanyavad|batao|bataiye|kaise|mujhe|aap|nahi|nahin|kripya)\b/iu.test(value)) return 'hi';
    if (/[a-z]/iu.test(value)) return 'en';
    return fallback === 'hi' ? 'hi' : 'en';
  }
  function wakePhrase(text) {
    const value = typeof text === 'string' ? text.normalize('NFC').trim() : '';
    const match = value.match(/^(?:(?:hey|hello|हे|हेलो)\s+)?(?:shrimaan|shreeman|shriman|shremaan|shiman|श्रीमान्?|श्रिमान|श्रीमन|शिमान)(?=$|[\s,।.!?:])(?:\s+(?:ji|जी)(?=$|[\s,।.!?:]))?[\s,।.!?:]*/iu);
    return { found: !!match, command: match ? value.slice(match[0].length).trim() : value };
  }
  return { inputLanguage, wakePhrase };
});
