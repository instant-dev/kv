const KVConfigManager = require('./kv_config_manager.js');

class InstantKV {

  static defaultAdapter = 'redis';
  static availableAdapters = {
    'redis': require('./adapters/redis.js')
  };

  constructor () {
    this.Config = new KVConfigManager();
    this.__initialize__();
  }

  __initialize__ () {
    this._stores = {'main': null};
  }

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
   * Connects to your main KV store
   * @param {cfg} cfg 
   * @returns {Promise<boolean>}
   */
  async connect (cfg) {
    return this.addStore('main', cfg);
  }

  /**
   * Connects to a KV store
   * @param {string} name
   * @param {cfg} cfg 
   * @returns {Promise<boolean>}
   */
  async addStore (name, cfg) {
    if (this._stores[name]) {
      throw new Error(`Already connected to store "${name}", use ".addStore()" to connect to another`);
    }
    if (typeof cfg === 'string') {
      cfg = {connectionString: cfg};
    }
    const Adapter = (
      this.constructor.getAdapter(cfg.adapter) ||
      this.constructor.getDefaultAdapter()
    );
    this._stores[name] = new Adapter(this, cfg);
    await this._stores[name].connect();
    return true;
  }

  /**
   * Closes a KV store immediately
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  async closeStore (name) {
    await this.store(name).close();
  }

  /**
   * Disconnects from all stores
   * @returns {boolean}
   */
  async disconnect () {
    let names = Object.keys(this._stores)
      .filter(name => name !== 'main' && this._stores[name]);
    for (const name of names) {
      const store = this._stores[name];
      await this.closeStore(name);
    }
    this._stores['main'] && this.closeStore('main');
    this.__initialize__();
    return true;
  }

  /**
   * Retrieves a kv store you have connected to
   * @param {string} name 
   * @returns {import('./kv_adapter.js')}
   */
  store (name = 'main') {
    if (!this._stores[name]) {
      throw new Error(`Store "${name}" is not connected`);
    }
    return this._stores[name];
  }

}

module.exports = InstantKV;