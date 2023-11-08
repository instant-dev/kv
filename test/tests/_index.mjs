import chai from 'chai';
const expect = chai.expect;

import fs from 'fs';

import InstantKV from '../../core/index.js';

export const name = 'Main tests';
export default async function (setupResult) {

  const cfg = {connectionString: 'redis://localhost:6379'};
  const kv = new InstantKV();

  it ('See if kv will connect', async function () {

    await kv.connect(cfg);
    expect(kv).to.exist;

  });

  it ('Will set a value', async function () {

    let result = await kv.set('test', 'a');
    expect(result).to.equal('a');

  });

  it ('Will get a value', async function () {

    let result = await kv.get('test');
    expect(result).to.equal('a');

  });

  it ('Will clear value via `set` with null', async function () {

    let result = await kv.set('test', null);
    expect(result).to.equal(null);
    
    let result2 = await kv.get('test');
    expect(result2).to.equal(null);

    let result3 = await kv.getRaw('test');
    expect(result3).to.equal(null);

  });

  it ('Will clear value via `clear`', async function () {

    await kv.set('test', 'alpha');
    let prefill = await kv.get('test');
    expect(prefill).to.equal('alpha');

    let result = await kv.set('test', null);
    expect(result).to.equal(null);
    
    let result2 = await kv.get('test');
    expect(result2).to.equal(null);

    let result3 = await kv.getRaw('test');
    expect(result3).to.equal(null);

  });

  it ('Will get a default value if no value is set', async function () {

    let result = await kv.get('test2', 'a');
    expect(result).to.equal('a');

  });

  it ('Will set a Raw value', async function () {

    let result = await kv.setRaw('test', 'a');
    expect(result).to.equal('a');

  });

  it ('Will get a Raw value', async function () {

    let result = await kv.getRaw('test');
    expect(result).to.equal('a');

  });

  it ('Will fail to get a value that was set Raw', async function () {

    let error;

    try {
      await kv.get('test');
    } catch (e) {
      error = e;
    }
    
    expect(error).to.exist;
    expect(error.message).to.contain('Invalid JSON');

  });

  it ('Will get a raw value that was set with JSON', async function () {

    await kv.set('test', [1, 2]);
    let result = await kv.getRaw('test');
    expect(result).to.equal('[1,2]');

  });

  it ('Will fail to set a Buffer value without a buffer', async function () {

    let error;

    try {
      await kv.setBuffer('file', 'abc');
    } catch (e) {
      error = e;
    }

    expect(error).to.exist;
    expect(error.message).to.contain('setBuffer requires a valid Buffer');

  });

  it ('Will set a Buffer value', async function () {

    let result = await kv.setBuffer('file', Buffer.from('abc'));
    expect(result).to.exist;
    expect(Buffer.isBuffer(result)).to.equal(true);
    expect(result.toString()).to.equal('abc');

  });

  it ('Will get a Buffer value', async function () {

    let result = await kv.getBuffer('file');
    expect(result).to.exist;
    expect(Buffer.isBuffer(result)).to.equal(true);
    expect(result.toString()).to.equal('abc');

  });

  after(async function () {

    await kv.close();

  });

};
