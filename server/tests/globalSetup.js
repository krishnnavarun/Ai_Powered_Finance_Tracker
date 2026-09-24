import { MongoMemoryReplSet } from 'mongodb-memory-server';

// One in-memory MongoDB (a one-node replica set, needed for transactions) for the whole
// test run. Each test file connects to its own database inside it (tests/helpers/db.js),
// so files stay isolated without starting a separate server each.
let replSet;

export async function setup({ provide }) {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ launchTimeout: 60_000 }],
  });
  provide('mongoUri', replSet.getUri());
}

export async function teardown() {
  await replSet?.stop();
}
