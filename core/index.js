class InstantKV {

  static defaultAdapter = 'redis';
  static availableAdapters = {
    'redis': require('./adapters/redis.js')
  };

  /**
   * Retrieves an Adapter
   * @param {string} name 
   * @returns {import('./kv_adapter.js')}
   */
  static getAdapter (name) {
    return this.availableAdapters[name];
  }

  /**
   * Retrieves the default adapter
   * @returns {import('./kv_adapter.js')}
   */
  static getDefaultAdapter () {
    return this.availableAdapters[this.defaultAdapter];
  }

  /**
   * Connects to a KV store
   * @param {cfg} cfg 
   * @returns {Promise<boolean>}
   */
  async connect (cfg) {
    if (typeof cfg === 'string') {
      cfg = {connectionString: cfg};
    }
    const Adapter = (
      this.constructor.getAdapter(cfg.adapter) ||
      this.constructor.getDefaultAdapter()
    );
    this.adapter = new Adapter(this, cfg);
    await this.adapter.connect();
    return true;
  }

  /**
   * Closes connection to KV store
   */
  async close () {
    await this.adapter.close();
  }

  /**
   * Sets a key with any acceptable JSON value; setting null will clear the key
   * @param {string} key The key to set
   * @param {any} value The value to set
   * @returns {any}
   */
  async set (key, value = null) {
    if (value === null) {
      await this.clear(key);
      return value;
    } else {
      return this.adapter.setJSON(key, value);
    }
  }

  /**
   * Gets a key with any acceptable JSON value; optionall returns a defaultValue if not set
   * @param {string} key The key to set
   * @param {any} defaultValue If no value is returned, get the default
   * @returns {any}
   */
  async get (key, defaultValue = null) {
    return this.adapter.getJSON(key, defaultValue);
  }

  /**
   * Clears a key from the store
   * @param {string|array<string>} key The key or keys to clear
   * @returns {any}
   */
  async clear (key) {
    await this.adapter.clear(key);
    return true;
  }

  /**
   * Sets a key with a string value; slightly faster than .set()
   * @param {string} key The key to set
   * @param {string} value The value to set
   * @returns {any}
   */
  async setRaw (key, value = null) {
    if (value === null) {
      await this.clear(key);
      return null;
    } else {
      return this.adapter.set(key, value);
    }
  }

  /**
   * Gets the raw value of a key; slightly faster than .get()
   * @param {string} key The key to set
   * @param {string} defaultValue If no value is returned, get the default
   * @returns {any}
   */
  async getRaw (key, defaultValue = null) {
    return this.adapter.get(key, defaultValue);
  }

  /**
   * Sets a key with a Buffer value
   * @param {string} key The key to set
   * @param {buffer} value The value to set
   * @returns {any}
   */
  async setBuffer (key, value = null) {
    if (value === null) {
      await this.clear(key);
      return null;
    } else {
      return this.adapter.setBuffer(key, value);
    }
  }

  /**
   * Gets the Buffer value of a key
   * @param {string} key The key to set
   * @param {buffer} defaultValue If no value is returned, get the default
   * @returns {any}
   */
  async getBuffer (key, defaultValue = null) {
    return this.adapter.getBuffer(key, defaultValue);
  }

  /**
   * Executes an arbitrary command against the KV client
   * @param {any} args any set of strings
   * @returns {any}
   */
  async command (...args) {
    return this.adapter.command(...args);
  }

}

module.exports = InstantKV;