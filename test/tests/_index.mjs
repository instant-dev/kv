import chai from 'chai';
const expect = chai.expect;

import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({path: '.env.test'});

import InstantKV from '../../core/index.js';

export const name = 'Main tests';
export default async function (setupResult) {

  const cfg = {connectionString: 'redis://localhost:6379'};
  const kv = new InstantKV();

  it ('Makes sure no _instant/kv.json exists', async function () {

    if (fs.existsSync('./_instant/kv.json')) {
      fs.unlinkSync('./_instant/kv.json');
    }
    expect(fs.existsSync('./_instant/kv.json')).to.equal(false);

  });

  it ('Writes and reads config to _instant/kv.json', async function () {

    let cfg = kv.Config.write('test', 'main', {connectionString: '{{ REDIS_URL }}'});

    expect(cfg).to.exist;
    expect(cfg.connectionString).to.equal('{{ REDIS_URL }}');

    let readCfg = kv.Config.read('test', 'main');

    expect(readCfg).to.exist;
    expect(readCfg.connectionString).to.equal(process.env.REDIS_URL);

  });

  it ('Writes more config to _instant/kv.json', async function () {

    const host = `host-${new Date().valueOf()}`;
    let cfg = kv.Config.write('development', 'main', {host, port: 1111});

    expect(cfg).to.exist;
    expect(cfg.host).to.equal(host);

    let readCfg = kv.Config.read('development', 'main');

    expect(readCfg).to.exist;
    expect(readCfg.host).to.equal(host);

  });

  it ('Connects to database from test credentials if no cfg provided', async function () {

    await kv.connect();
    expect(kv).to.exist;
    expect(kv.store()).to.exist;
    expect(kv.store('main')).to.exist;
    expect(kv.store('main')).to.equal(kv.store());

  });

  it ('Will disconnect and then reconnect using manual credentials', async function () {

    await kv.disconnect();

    await kv.connect(cfg);
    expect(kv).to.exist;
    expect(kv.store()).to.exist;
    expect(kv.store('main')).to.exist;
    expect(kv.store('main')).to.equal(kv.store());

  });

  it ('Will set a value', async function () {

    let result = await kv.store().set('test', 'a');
    expect(result).to.equal('a');

  });

  it ('Will get a value', async function () {

    let result = await kv.store().get('test');
    expect(result).to.equal('a');

  });

  it ('Will clear value via `set` with null', async function () {

    let result = await kv.store().set('test', null);
    expect(result).to.equal(null);
    
    let result2 = await kv.store().get('test');
    expect(result2).to.equal(null);

    let result3 = await kv.store().getRaw('test');
    expect(result3).to.equal(null);

  });

  it ('Will clear value via `clear`', async function () {

    await kv.store().set('test', 'alpha');
    let prefill = await kv.store().get('test');
    expect(prefill).to.equal('alpha');

    let result = await kv.store().set('test', null);
    expect(result).to.equal(null);
    
    let result2 = await kv.store().get('test');
    expect(result2).to.equal(null);

    let result3 = await kv.store().getRaw('test');
    expect(result3).to.equal(null);

  });

  it ('Will get a default value if no value is set', async function () {

    let result = await kv.store().get('test2', 'a');
    expect(result).to.equal('a');

  });

  it ('Will set a Raw value', async function () {

    let result = await kv.store().setRaw('test', 'a');
    expect(result).to.equal('a');

  });

  it ('Will get a Raw value', async function () {

    let result = await kv.store().getRaw('test');
    expect(result).to.equal('a');

  });

  it ('Will fail to get a value that was set Raw', async function () {

    let error;

    try {
      await kv.store().get('test');
    } catch (e) {
      error = e;
    }
    
    expect(error).to.exist;
    expect(error.message).to.contain('Invalid JSON');

  });

  it ('Will get a raw value that was set with JSON', async function () {

    await kv.store().set('test', [1, 2]);
    let result = await kv.store().getRaw('test');
    expect(result).to.equal('[1,2]');

  });

  it ('Will fail to set a Buffer value without a buffer', async function () {

    let error;

    try {
      await kv.store().setBuffer('file', 'abc');
    } catch (e) {
      error = e;
    }

    expect(error).to.exist;
    expect(error.message).to.contain('setBuffer requires a valid Buffer');

  });

  it ('Will set a Buffer value', async function () {

    let result = await kv.store().setBuffer('file', Buffer.from('abc'));
    expect(result).to.exist;
    expect(Buffer.isBuffer(result)).to.equal(true);
    expect(result.toString()).to.equal('abc');

  });

  it ('Will get a Buffer value', async function () {

    let result = await kv.store().getBuffer('file');
    expect(result).to.exist;
    expect(Buffer.isBuffer(result)).to.equal(true);
    expect(result.toString()).to.equal('abc');

  });

  it ('Will connect to another host', async function () {

    let cfg = kv.Config.read('test', 'main');
    await kv.addStore('hello', cfg);

    expect(kv.store('hello')).to.exist;

  });

  after(async function () {

    await kv.disconnect();

  });

};
