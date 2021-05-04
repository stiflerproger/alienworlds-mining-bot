import { MineWork, MiningParams } from './types';
import { Serialize } from 'eosjs';
import { Worker } from 'worker_threads';
import * as path from 'path';

export default class Miner {

  public async mine(miningParams: MiningParams) {
    // only first 8 bytes of txid is needed
    miningParams.last_mine_tx = miningParams.last_mine_tx.substr(0, 16);
    miningParams.last_mine_arr = fromHexString(miningParams.last_mine_tx);

    miningParams.sb = new Serialize.SerialBuffer({
      textEncoder: new TextEncoder,
      textDecoder: new TextDecoder,
    });

    miningParams.account_str = miningParams.account as string;
    miningParams.account = nameToArray(miningParams.account);

    return await this.resolveHash(miningParams);
  }

  private async resolveHash(data: MiningParams): Promise<MineWork> {

    const {
      logger
    } = data;

    const workerData = {...data, logger: undefined};

    logger('Mining..');

    return new Promise((res, rej) => {

      const worker = new Worker(path.join(__dirname, '../../workers', 'miner.worker.js'), {workerData});

      worker.on('message', (msg) => {
        if (msg.message) logger(msg.message);
        if (msg.result) return res(msg.result);
      });

      worker.on('error', (err) => {
        return rej(err);
      });

      worker.on('exit', (code) => {
        if (code !== 2) {
          return rej(2);
        }
      });

    });

  }
}

const nameToArray = (name) => {
  const sb = new Serialize.SerialBuffer({
    textEncoder: new TextEncoder,
    textDecoder: new TextDecoder,
  });

  sb.pushName(name);

  return sb.array;
};

const fromHexString = hexString =>
  new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));