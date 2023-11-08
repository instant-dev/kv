# Instant KV

![travis-ci build](https://travis-ci.org/instant-dev/kv.svg?branch=main)
![npm version](https://img.shields.io/npm/v/@instant.dev/kv?label=)

## Manage multiple Redis connections easily

Instant KV is a simple wrapper for Redis, specifically the
[node-redis](https://github.com/redis/node-redis) client, that allows you to
work with JSON by default, easily manage multiple connections and gracefully
handle request timeouts.

It is intended to provide idiomatic kv management to
[Instant API](https://github.com/instant-dev/api) projects.

## Getting Started

### Quickstart

If you are using the [Instant CLI](https://github.com/instant-dev/instant) the fastest
way to get started is built-in;

```shell
instant kit kv
```

This will;
- Install `@instant.dev/kv`
- Set up your local `.env` with `MAIN_KV_CONNECTIONSTRING`
- Configure `./_instant/kv.json` automatically with `{"development":{"main":{...}}}` settings
- Extend `Instant` with an `Instant.kv` object via a plugin
- Automatically add tests to make sure everything works

Voila! Now you can use Instant KV in an Instant project;

```javascript
// Using the InstantORM extension
const InstantORM = require('@instant.dev/orm');
const Instant = await Instant.connectToPool(); // connect to ORM, runs plugins
await Instant.kv.store().set('my_key', 'my_value'); // set by plugin

// Or...
const InstantKV = require('@instant.dev/kv');
const kv = new InstantKV();
await kv.connect(); // will default to using cfg from
                    // _instant.dev/kv.json["development"]["main"]
                    // where "development" is process.env.NODE_ENV
await kv.store().set('my_key', 'my_value');
```

### Custom Installation

If you want to import Instant KV in a standalone project, use;

```shell
cd my_project_dir
npm i @instant.dev/kv --save
```

And then use with;

```javascript
const InstantKV = require('@instant.dev/kv');
const kv = new InstantKV();
await kv.connect({connectionString: process.env.REDIS_URL}); // set this yourself
await kv.store().set('my_key', 'my_value');
```

## API Reference

Connect to your main kv;

```javascript
const InstantKV = require('@instant.dev/kv');
const kv = new InstantKV();
await kv.connect(cfg); // connectionString: or host:, port:, user: ...
```

Access your store;

```javascript
const store = kv.store();
console.log(store === kv.store('main')); // true, can also alias
```

Connect to multiple stores simultaneously;

```javascript
const otherStore = await kv.addStore('other_redis_instance', cfg);
```

Run queries;

```javascript
const store = kv.store();
await store.set('key', {some: "value"}); // default to JSON
let json = await store.get('key');       // will default parse JSON
```

- JSON Methods (default store and retrieve as JSON)
  - `await store.set(key, value);` (`null` will clear)
  - `await store.get(key, defaultValue);`
- Raw String Methods (a bit faster, no JSON parse)
  - `await store.setRaw(key, value)`
  - `await store.getRaw(key, value)`
- Buffer methods (for arbitrary encodings, files)
  - `await store.setBuffer(key, value)`
  - `await store.getBuffer(key, value)`
- Clear keys
  - `await store.clear(key)` or `store.clear([key1, key2, ...])`
- Arbitrary commands (node-redis)
  - `await store.command('hSet', 'key', 'field', 'value')`
  - `let client = store.command('duplicate')` - for making a duplicate client for pub/sub
  - These will execute any arbitrary method of [node-redis](https://github.com/redis/node-redis)


# Acknowledgements

Special thank you to [Scott Gamble](https://x.com/threesided) who helps run all of the front-of-house work for instant.dev 💜!

| Destination | Link |
| ----------- | ---- |
| Home | [instant.dev](https://instant.dev) |
| GitHub | [github.com/instant-dev](https://github.com/instant-dev) |
| Discord | [discord.gg/puVYgA7ZMh](https://discord.gg/puVYgA7ZMh) |
| X / instant.dev | [x.com/instantdevs](https://x.com/instantdevs) |
| X / Keith Horwood | [x.com/keithwhor](https://x.com/keithwhor) |
| X / Scott Gamble | [x.com/threesided](https://x.com/threesided) |