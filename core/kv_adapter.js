const { createTunnel } = require('tunnel-ssh');

class KVAdapter {

  name = 'GenericKV';

  constructor () {}
  async connect () {}
  close () {}

  /**
   * Creates an SSH tunnel using multiple retries
   * @private
   * @param {string} host 
   * @param {string|number} port 
   * @param {?string} privateKey 
   * @param {?string} sshUser 
   * @param {?string} sshHost 
   * @param {?string} sshPort 
   * @returns {Promise<object>}
   */
  async createTunnel (host, port, privateKey, sshUser, sshHost, sshPort) {
    sshPort = sshPort || 22
    let tnl;
    let localPort = 9736;
    while (OPEN_TUNNELS_BY_PORT[localPort]) {
      localPort++;
    }
    let retries = 100;
    this.log(`Attempting to create SSH tunnel ...`);
    this.log(`From: "localhost"`);
    this.log(`Via:  "${sshUser}@${sshHost}:${sshPort}"`);
    this.log(`To:   "${host}:${port}"`);
    while (!tnl) {
      try {
        let [server, conn] = await createTunnel(
          {
            autoClose: true
          },
          {
            port: localPort
          },
          {
            host: sshHost,
            username: sshUser,
            port: sshPort,
            privateKey: Buffer.from(privateKey)
          },
          {
            srcAddr: 'localhost',
	          srcPort: localPort,
            dstAddr: host,
            dstPort: port,
          }
        );
        tnl = server;
      } catch (err) {
        if (retries > 0 && err.message.includes('EADDRINUSE')) {
          localPort++;
          retries--;
          if (retries <= 0) {
            throw new Error(`Could not create SSH tunnel: Maximum retries reached`);
          }
        } else {
          throw err;
        }
      }
    }
    this.log(`Created SSH tunnel from "localhost:${localPort}" to "${host}:${port}"!`);
    const tunnelObject = {
      tunnel: tnl,
      port: localPort,
      close: () => {
        delete OPEN_TUNNELS_BY_PORT[localPort];
        tnl.close();
      }
    };
    OPEN_TUNNELS_BY_PORT[localPort] = tnl;
    return tunnelObject;
  }

  /**
   * Creates a tunnel from a config object
   * @private
   * @param {object} cfg 
   * @returns {Promise<object>}
   */
  async createTunnelFromConfig (cfg) {
    let tnl;
    try {
      tnl = await this.createTunnel(
        cfg.host,
        cfg.port,
        cfg.tunnel.private_key,
        cfg.tunnel.user,
        cfg.tunnel.host,
        cfg.tunnel.port
      );
    } catch (e) {
      console.error(e);
      throw new Error(
        `Could not connect to "${cfg.host}:${cfg.port}" via SSH tunnel "${cfg.tunnel.user}@${cfg.tunnel.host}:${cfg.tunnel.port || 22}":\n` +
        (e.message || e.code)
      );
    }
    return tnl;
  }

  async connectToTunnel () {
    let config = JSON.parse(JSON.stringify(this._config));
    let tunnelObject = null;
    if (config.tunnel) {
      tunnelObject = await this.createTunnelFromConfig(config);
      delete config.tunnel;
      config.host = 'localhost';
      config.port = tunnelObject.port;
      config.ssl = false;
    } else {
      throw new Error(`Could not connect to tunnel: no valid tunnel provided in config`);
    }
    return {config, tunnelObject};
  }

  createDefaultConfig () {
    return {
      host: 'localhost',
      database: '',
      user: 'default',
      password: '',
      port: 6379,
      ssl: false,
      in_vpc: false,
      tunnel: null
    };
  }

  parseConnectionString (connectionString, cfg = null) {
    const defaultConfig = this.createDefaultConfig();
    cfg = cfg || defaultConfig;
    const match = connectionString.match(/^redis(s)?:\/\/(?:([A-Za-z0-9_]+)(?:\:([A-Za-z0-9_\-]+))?@)?([A-Za-z0-9_\.\-]+):(\d+)(?:\/([A-Za-z0-9_]+)?)?$/);
    if (match) {
      cfg.user = match[2] || cfg.user || defaultConfig.user;
      cfg.password = match[3] || cfg.password || defaultConfig.password;
      cfg.host = match[4] || cfg.host || defaultConfig.host;
      cfg.port = match[5] || cfg.port || defaultConfig.port;
      cfg.database = match[6] || cfg.database || defaultConfig.database;
      cfg.ssl = !!match[1];
    }
    return cfg;
  }

  parseConfig (oldCfg = {}) {
    let cfg = this.createDefaultConfig();
    const readCfg = JSON.parse(JSON.stringify(oldCfg));
    Object.keys(cfg).forEach(key => {
      cfg[key] = key in readCfg ? readCfg[key] : null;
    });
    if (cfg.tunnel) {
      if (
        typeof cfg.tunnel.private_key === 'string' &&
        !cfg.tunnel.private_key.match(/^-----BEGIN (\w+ )?PRIVATE KEY-----/)
      ) {
        try {
          cfg.tunnel.private_key = fs.readFileSync(cfg.tunnel.private_key).toString();
        } catch (e) {
          throw new Error(`Could not read private key file: ${e.message}`);
        }
      }
      if (!cfg.tunnel.user) {
        throw new Error(`Missing SSH tunnel "user" in KV configuration`);
      }
      if (!cfg.tunnel.host) {
        throw new Error(`Missing SSH tunnel "host" in KV configuration`);
      }
    }
    if (readCfg.connectionString) {
      cfg = this.parseConnectionString(readCfg.connectionString, cfg);
    }
    return cfg;
  }

};

module.exports = KVAdapter;