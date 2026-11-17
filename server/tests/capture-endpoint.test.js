const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function capture(manualEnd, rate = 16000) {
  const messages = []; let Processor;
  const scope = { sampleRate: rate, Float32Array, Int16Array, Math,
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: message => messages.push(message) }; } },
    registerProcessor(name, ctor) { Processor = ctor; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../public/js/capture-processor.js'), 'utf8'), scope);
  const processor = new Processor({ processorOptions: { manualEnd } });
  return { messages, processor, frames(count, amplitude = 0) {
    for (let i = 0; i < count && !processor.done; i++) processor.process([[new Float32Array(rate / 10).fill(amplitude)]]);
  } };
}

test('demo capture survives a click and eight seconds of quiet before speech', () => {
  const c = capture(true); c.frames(1, .03); c.frames(80);
  assert.equal(c.processor.done, false); assert.equal(c.processor.speech, false);
  c.frames(5, .006); c.frames(30);
  assert.equal(c.processor.done, false); assert.equal(c.processor.speech, true);
  assert.equal(c.messages.filter(m => m.type === 'end').length, 0);
});
test('manual capture still stops at twenty seconds and distinguishes no speech', () => {
  const c = capture(true); c.frames(210);
  assert.equal(c.messages.filter(m => m.type === 'audio').length, 200);
  assert.equal(c.messages.filter(m => m.type === 'end').length, 1);
  assert.equal(c.messages.at(-1).no_speech, true);
});
test('automatic mode ignores a click and gives ten seconds for speech to begin', () => {
  const c = capture(false); c.frames(1, .03); c.frames(69); assert.equal(c.processor.done, false);
  c.frames(30); assert.equal(c.processor.done, true); assert.equal(c.messages.at(-1).no_speech, true);
});
test('automatic mode permits pauses longer than the old seven hundred milliseconds', () => {
  const c = capture(false); c.frames(4, .006); c.frames(12); assert.equal(c.processor.done, false);
  c.frames(4, .006); c.frames(18); assert.equal(c.processor.done, true); assert.equal(c.messages.at(-1).no_speech, false);
});
test('automatic recording waits through delayed start, then ends once after speech without a button', () => {
  const c = capture(false); c.frames(1, .04); c.frames(75);
  assert.equal(c.processor.done, false);
  c.frames(8, .008); c.frames(17); assert.equal(c.processor.done, false);
  c.frames(1); assert.equal(c.processor.done, true);
  assert.equal(c.messages.filter(m => m.type === 'end').length, 1);
  assert.equal(c.messages.at(-1).no_speech, false);
});
test('48k capture retains 16k PCM framing and reports the real signal level', () => {
  const c = capture(true, 48000); c.frames(10, .01);
  const audio = c.messages.filter(m => m.type === 'audio'); assert.equal(audio.length, 10);
  assert.ok(audio.every(m => m.pcm.byteLength === 3200));
  assert.ok(c.messages.some(m => m.type === 'level' && m.level > .009 && m.level < .011));
});
