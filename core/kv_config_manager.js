const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');

class KVConfigManager {

  static rootDirectory = './_instant';
  static rootKVConfigFile = `kv.json`;

  name = 'KVConfigManager';

  log (message) {
    return colors.bold.cyan(`${this.name}: `) + message;
  }

  getProcessEnv () {
    let env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
    return env;
  }

  pathname () {
    return path.join(this.constructor.rootDirectory, this.constructor.rootKVConfigFile);
  }

  __check__ () {
    if (!fs.existsSync(this.constructor.rootDirectory)) {
      SchemaManager.checkdir(this.constructor.rootDirectory);
    }
  }

  __create__ () {
    this.__check__();
    let pathname = this.pathname();
    if (!this.exists()) {
      fs.writeFileSync(pathname, JSON.stringify({}, null, 2));
    }
    return this.appendGitIgnore(pathname);
  }
  
  appendGitIgnore (pathname) {
    let gitignorePathname = '.gitignore';
    if (!fs.existsSync(gitignorePathname)) {
      let gitignore = Buffer.from([pathname].join('\n') + '\n');
      fs.writeFileSync(gitignorePathname, gitignore);
      this.log(`Created ".gitignore" containing "${pathname}"`);
    } else {
      let gitignore = fs.readFileSync(gitignorePathname);
      let lines = gitignore.toString()
        .split(/\r?\n/gi)
        .map(line => line.trim())
        .filter(line => !!line);
      if (lines.indexOf(pathname) === -1) {
        lines.push(pathname);
        this.log(`Appending "${pathname}" to ".gitignore" ...`);
        fs.writeFileSync(gitignorePathname, Buffer.from(lines.join('\n')) + '\n');
      }
    }
    return true;
  }

  destroy () {
    let pathname = this.pathname();
    if (this.exists()) {
      fs.unlinkSync(pathname);
    }
    this.log(`Destroyed key-value credentials at "${pathname}"!`);
  }

  exists () {
    let pathname = this.pathname();
    return !!fs.existsSync(pathname);
  }

  write (env, name, kvCfg) {
    if (!env || !name || typeof env !== 'string' || typeof name !== 'string') {
      throw new Error(`env and name must be valid strings`);
    }
    let vcfg;
    try {
      vcfg = this.constructor.validate(kvCfg, true);
    } catch (e) {
      throw new Error(`Could not write config for ["${env}"]["${name}"]:\n${e.message}`);
    }
    this.__create__();
    let cfg = this.load();
    cfg[env] = cfg[env] || {};
    cfg[env][name] = kvCfg;
    let pathname = this.pathname();
    fs.writeFileSync(pathname, JSON.stringify(cfg, null, 2));
    this.log(`Wrote key-value credentials to "${pathname}"["${env}"]["${name}"]!`);
    return vcfg;
  }

  load () {
    let pathname = this.pathname();
    if (!this.exists()) {
      throw new Error(`No key-value config file found at "${pathname}"`);
    }
    let buffer = fs.readFileSync(pathname);
    let json;
    try {
      json = JSON.parse(buffer.toString());
    } catch (e) {
      throw new Error(`Key-value config invalid at "${pathname}":\n${e.message}`);
    }
    return json;
  }

  __parseEnvFromConfig__ (cfg, envVars = null, allowEmpty = false) {
    const prefix = '{{';
    const suffix = '}}';
    if (cfg && typeof cfg === 'object') {
      for (const key in cfg) {
        try {
          cfg[key] = this.__parseEnvFromConfig__(cfg[key], envVars, key === 'password');
        } catch (e) {
          throw new Error(`["${key}"]${e.message}`);
        }
      }
      return cfg;
    } else if (typeof cfg === 'string') {
      if (cfg.startsWith(prefix) && cfg.endsWith(suffix)) {
        envVars = envVars || process.env;
        const key = cfg.slice(prefix.length, -suffix.length).trim();
        if (!(key in envVars)) {
          throw new Error(`: No environment variable matching "${key}" found`);
        } else if (!envVars[key] && !allowEmpty) {
          throw new Error(`: Environment variable matching "${key}" is empty`);
        }
        return envVars[key];
      } else {
        return cfg;
      }
    } else {
      return cfg;
    }
  }

  read (env, name, envVars = null) {
    let pathname = this.pathname();
    this.__check__();
    let cfg = this.load();
    if (!env || !name) {
      throw new Error(`Must provide env and name`)
    } else if (!cfg[env]) {
      throw new Error(
        `Environment "${env}" not found in key-value config at "${pathname}"\n` +
        `If you are using the Instant CLI, this can be remedied with \`instant kv:add --env ${env}\``
      );
    } else if (!cfg[env][name]) {
      throw new Error(
        `Environment "${env}" key-value "${name}" not found in key-value config at "${pathname}"\n` +
        `If you are using the Instant CLI, this can be remedied with \`instant kv:add --env ${env} --db ${name}\``
      );
    }
    let parsedConfig;
    try {
      parsedConfig = this.__parseEnvFromConfig__(cfg[env][name], envVars);
    } catch (e) {
      throw new Error(`Key-value config error "${pathname}"["${env}"]["${name}"]${e.message}`);
    }
    const config = this.constructor.validate(parsedConfig);
    // if tunnel.in_vpc is true it means that when deployed,
    // the key-value environment should be in a vpc and not need a tunnel
    const currentEnv = this.getProcessEnv();
    const isLiveEnvironment = (
      currentEnv === env &&
      currentEnv !== 'development'
    );
    if (isLiveEnvironment && config.in_vpc) {
      delete config.tunnel;
    }
    return config;
  }

  static validate (cfg, allowEnvVars) {
    let vcfg = {};
    let keys = Object.keys(cfg || {});
    let expectedKeys = {};
    if (!cfg || typeof cfg !== 'object') {
      throw new Error(`Invalid config: empty`);
    } else if ('connectionString' in cfg) {
      expectedKeys = {
        'connectionString': 1,
        'in_vpc': 1,
        'tunnel': 1
      };
    } else {
      expectedKeys = {
        'host': 1,
        'port': 1,
        'user': 1,
        'password': 1,
        'database': 1,
        'ssl': 1,
        'in_vpc': 1,
        'tunnel': 1
      };
    }
    let lookupKeys = Object.keys(expectedKeys);
    let unusedKey = keys.find(key => !expectedKeys[key]);
    if (unusedKey) {
      throw new Error(
        `Could not validate key-value config:\n` +
        `Invalid key "${unusedKey}"`
      );
    }
    for (const key of lookupKeys) {
      let value = cfg[key];
      if (key === 'connectionString') {
        if (typeof value !== 'string') {
          throw new Error(
            `Could not validate key-value config:\n` +
            `"connectionString", if provided, must be a string`
          );
        }
        vcfg[key] = value;
      } else if (key === 'password') {
        value = (value === void 0 || value === null || value === false)
          ? ''
          : value;
        if (typeof value !== 'string') {
          throw new Error(
            `Could not validate key-value config:\n` +
            `"password", if provided, must be a string`
          );
        }
        vcfg[key] = value;
      } else if (key === 'ssl') {
        value = (value === void 0 || value === null)
          ? false
          : value;
        if (
          value !== false &&
          value !== true &&
          value !== 'unauthorized' &&
          JSON.stringify(value) !== '{"rejectUnauthorized":false}'
        ) {
          throw new Error(
            `Could not validate key-value config:\n` +
            `"ssl", if provided, must be true, false or "unauthorized"`
          );
        }
        vcfg[key] = value;
      } else if (key === 'port') {
        if (
          allowEnvVars &&
          typeof value === 'string' &&
          value.startsWith('{{') &&
          value.endsWith('}}')
        ) {
          vcfg[key] = value;
        } else if (
          parseInt(value) !== parseFloat(value) ||
          isNaN(parseInt(value)) ||
          parseInt(value) < 1 ||
          parseInt(value) > 65535
        ) {
          throw new Error(
            `Could not validate key-value config:\n` +
            `"port" must be between 1 - 65535.`
          );
        } else {
          vcfg[key] = parseInt(value);
        }
      } else if (key === 'in_vpc') {
        if (value !== void 0 && typeof value !== 'boolean') {
          throw new Error(`"in_vpc" must be true or false`);
        }
        vcfg[key] = value || false;
      } else if (key === 'tunnel') {
        if (value) {
          if (!value.user || typeof value.user !== 'string') {
            throw new Error(`Missing or invalid SSH tunnel "user" in key-value configuration`);
          }
          if (!value.host || typeof value.host !== 'string') {
            throw new Error(`Missing or invalid SSH tunnel "host" in key-value configuration`);
          }
          if (value.private_key && typeof value.private_key !== 'string') {
            throw new Error(`Invalid SSH tunnel "private_key" in key-value configuration`);
          }
          vcfg[key] = value;
        } else {
          vcfg[key] = null;
        }
      } else if (key === 'user' || key === 'database') {
        vcfg[key] = (cfg[key] || '') + '';
      } else if (!value || typeof value !== 'string') {
        throw new Error(
          `Could not validate key-value config:\n` +
          `"${key}" must be a non-empty string`
        );
      } else {
        vcfg[key] = value;
      }
    }
    return vcfg;
  }

}

module.exports = KVConfigManager;
