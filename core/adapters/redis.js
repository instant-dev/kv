const colors = require('colors/safe');
const { createClient, commandOptions } = require('redis');

const KVAdapter = require('../kv_adapter.js');

const DEFAULT_CONNECT_TIMEOUT = 5000;
const DEFAULT_COMMAND_TIMEOUT = 5000;

class RedisAdapter extends KVAdapter {

  name = 'redis';

  constructor (cfg) {
    super();
    cfg = this.parseConfig(cfg);
    this.COMMAND_TIMEOUT = DEFAULT_COMMAND_TIMEOUT;
    this._config = cfg;
    this._tunnel = null;
    this._client = null;
  }

  log (msg) {
    console.log(colors.bold.green(`KeyValue: `) + msg);
  }

  error (e) {
    if (typeof e === 'string') {
      e = new Error(e);
    } else if (e.errors) {
      e = e.errors[0];
    }
    let msg = e.message || `No message specified`;
    console.log(colors.bold.green(`KeyValue: `) + colors.bold.red(`[Error] `) + msg);
  }

  async close () {
    this._client && (await this._client.disconnect());
    this._tunnel && (await this._tunnel.close());
    this._tunnel = null;
    this._client = null;
    this.log('Closed');
  }

  async connect (connectTimeout) {
    let cfg = this._config;
    if (cfg.tunnel) {
      let result = await this.connectToTunnel(cfg);
      cfg = result.config;
      this._tunnel = result.tunnelObject;
    }
    this.log(`Connecting to ${this.name}${this._config.database ? ` database "${this._config.database}"` : ``} as role "${this._config.user}" on ${this._config.host}:${this._config.port} ...`);
    const url = `redis${this._config.ssl ? 's' : ''}://${this._config.user}:${this._config.password}@${this._config.host}:${this._config.port}/${this._config.database}`;
    this._client = createClient({
      url,
      socket: {
        connectTimeout: connectTimeout || DEFAULT_CONNECT_TIMEOUT,
        reconnectStrategy: (times) => {
          const maxDelay = 5000; // Maximum delay between reconnection attempts (in milliseconds)
          const delay = Math.min(times * 1000, maxDelay);
          this.error(`Redis connection lost. Reconnecting in ${delay} ms...`);
          return delay;
        }
      }
    });
    try {
      await new Promise(async (resolve, reject) => {
        const connectErrorHandler = async err => {
          this._client.removeListener('error', connectErrorHandler);
          await this.close();
          reject(err);
        };
        this._client.on('error', connectErrorHandler);
        let result = await this._client.connect();
        resolve(result);
      });
    } catch (e) {
      if (e.errors) {
        e = e.errors[0];
      }
      throw new Error(`Could not connect to Redis: ${e.message}`);
    }
    this.log(`Successfully connected to ${this.name}${this._config.database ? ` database "${this._config.database}"` : ``}!`);
    return true;
  }

  async command (name, ...args) {
    let opts;
    if (typeof name === 'object') {
      opts = commandOptions(name);
      name = args[0];
      args = args.slice(1);
    } else {
      opts = commandOptions({});
    }
    if (!this._client) {
      throw new Error(`Key-value not connected`);
    }
    if (!this._client[name]) {
      throw new Error(`Invalid command: "${name}"`);
    }
    let timeout;
    let result = await Promise.race([
      new Promise((resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Key-value command timed out`));
        }, this.COMMAND_TIMEOUT);
      }),
      this._client[name](opts, ...args)
    ]);
    clearTimeout(timeout);
    return result;
  }

  async set (key, value) {
    if (value === null) {
      await this.clear(key);
      return value;
    } else {
      let result = await this.command('SET', key, JSON.stringify(value));
      if (result !== 'OK') {
        throw new Error(`Invalid key-value response for "SET": ${result}`);
      }
      return value;
    }
  }

  async get (key, defaultValue = null) {
    let value = await this.command('GET', key);
    try {
      value = JSON.parse(value);
    } catch (e) {
      throw new Error(`Invalid key-value response: Invalid JSON`);
    }
    return value === null ? defaultValue : value;
  }

  async clear (key) {
    const keys = Array.isArray(key)
      ? key
      : [key];
    return this.command('DEL', ...keys);
  }

  async setRaw (key, value) {
    if (value === null) {
      await this.clear(key);
      return value;
    } else {
      let result = await this.command('SET', key, value);
      if (result !== 'OK') {
        throw new Error(`Invalid key-value response for "SET": ${result}`);
      }
      return value;
    }
  }

  async getRaw (key, defaultValue = null) {
    let value = await this.command('GET', key);
    return value === null ? defaultValue : value;
  }

  async setBuffer (key, value) {
    if (value === null) {
      await this.clear(key);
      return value;
    } else {
      if (!Buffer.isBuffer(value)) {
        throw new Error(`setBuffer requires a valid Buffer`);
      }
      let result = await this.command('SET', key, value);
      if (result !== 'OK') {
        throw new Error(`Invalid key-value response for "SET": ${result}`);
      }
      return value;
    }
  }

  async getBuffer (key, defaultValue = null) {
    if (defaultValue !== null && !Buffer.isBuffer(defaultValue)) {
      throw new Error(`getBuffer requires a valid Buffer for defaultValue`);
    }
    let value = await this.command({returnBuffers: true}, 'GET', key);
    return value === null ? defaultValue : value;
  }

}

module.exports = RedisAdapter;