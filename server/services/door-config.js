const { ModuleStore } = require('../modules/store');

class DoorConfig {
  constructor(filename) {
    this.store = new ModuleStore(filename);
    const saved = this.store.load();
    this.value = saved?.pin || null;
    if (this.value !== null && !/^[0-9]{4,8}$/.test(this.value)) throw Error('Invalid saved door PIN configuration');
  }
  pin() { return this.value; }
  configured() { return !!this.value; }
  async setPin(pin) {
    if (typeof pin !== 'string' || !/^[0-9]{4,8}$/.test(pin)) {
      const { fail } = require('../lib/errors'); fail('INVALID_DOOR_PIN', 400);
    }
    await this.store.save({ pin });
    this.value = pin;
  }
}

module.exports = { DoorConfig };
