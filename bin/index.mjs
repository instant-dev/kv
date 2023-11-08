#! /usr/bin/env node 

import fs from 'fs';
import InstantKV from '../index.js';

const args = process.argv.slice(2);

if (!args[1]) {
  throw new Error(`Must provide environment name as first parameter`);
}

const env = args[1];
const envFile = env === 'development' ? `.env` : `.env.${env}`;
if (!fs.existsSync(envFile)) {
  throw new Error(`Missing env file "${envFile}" for environment "${env}"`);
} else if (fs.statSync(envFile).isDirectory()) {
  throw new Error(`Env file "${envFile}" for environment "${env}" is invalid: is a directory`);
}

const lines = fs.readFileSync(envFile).toString().split('\n');
const entries = lines
  .map(v => v.trim())
  .filter(v => !!v)
  .reduce((entries, line) => {
    const values = line.split('=');
    const key = values[0];
    const value = values.slice(1).join('=');
    entries[key] = value;
    return entries;
  }, {});

if (!entries['KV_URL']) {
  throw new Error(`Missing "KV_URL" in "${envFile}" for environment "${env}"`);
}