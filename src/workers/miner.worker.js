// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createHash } = require('crypto')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { workerData, parentPort } = require('worker_threads');

const getRand = () => {
  const arr = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    arr[i] = Math.floor(Math.random() * 255);
  }
  return arr;
};

const toHex = (buffer) => {
  return [...new Uint8Array(buffer)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const {
  account_str,
  difficulty,
  last_mine_tx,
  last_mine_arr,
  logger
} = workerData;

let {account} = workerData;

account = account.slice(0, 8);

const is_wam = account_str.substr(-4) === '.wam';

let good = false, itr = 0, hash, hex_digest, rand_arr, last;

if (is_wam) {
  parentPort.postMessage({message: `WAM account`})
}

const start = (new Date()).getTime();

while (!good) {
  rand_arr = getRand();

  const combined = new Uint8Array(account.length + last_mine_arr.length + rand_arr.length);
  combined.set(account);
  combined.set(last_mine_arr, account.length);
  combined.set(rand_arr, account.length + last_mine_arr.length);

  hash = createHash('sha256').update(combined.slice(0, 24)).digest();

  hex_digest = toHex(hash);

  if (is_wam) {
    // easier for .wam accounts
    good = hex_digest.substr(0, 4) === '0000';
  } else {
    parentPort.postMessage({message: `non-WAM account, mining is harder`})
    good = hex_digest.substr(0, 6) === '000000';
  }

  if (good) {
    if (is_wam) {
      last = parseInt(hex_digest.substr(4, 1), 16);
    } else {
      last = parseInt(hex_digest.substr(6, 1), 16);
    }

    good = (last <= difficulty) && true;

  }
  itr++;

  if (itr % 1000000 === 0) {
    parentPort.postMessage({message: `Still mining - tried ${itr} iterations`})
  }

  if (!good) {
    hash = null;
  }
}

const end = (new Date()).getTime();
const rand_str = toHex(rand_arr);

parentPort.postMessage({message: `Found nonce ${rand_str}, taked ${(end - start) / 1000}s`})

const mine_work = { account: account_str, rand_str, hex_digest };

parentPort.postMessage({result: mine_work})

process.exit(2);

