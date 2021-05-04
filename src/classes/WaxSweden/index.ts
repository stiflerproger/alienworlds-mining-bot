import {
  AtomicItemAsset,
  AtomicItemAssetResponse,
  BagResponse, GetBlockResponse,
  GetInfoResponse,
  LandResponse,
  LandRowsEntity,
} from './types';
import { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { sleep } from '../../utils';

export const getInfo = async (client: AxiosInstance) => {
  const res: AxiosResponse<GetInfoResponse> = await client.post('https://api.waxsweden.org/v1/chain/get_info');

  return res.data;
}

export const getBlock = async (client: AxiosInstance, blockId: number) => {
  const res: AxiosResponse<GetBlockResponse> = await client.post('https://api.waxsweden.org/v1/chain/get_block', {
    block_num_or_id: blockId
  });

  return res.data;
}

export const getBagAssets = async (account: string, client: AxiosInstance): Promise<AtomicItemAsset[]> => {

  const bagRes: BagResponse = await getTableRows(client, {
    lower_bound: account,
    upper_bound: account,
    table: 'bags',
  });

  if (!bagRes.rows.length) throw new Error('Empty bag');

  const items_p = bagRes.rows[0].items.map((item_id) => {

    return client.get('https://wax.api.atomicassets.io/atomicassets/v1/assets/' + item_id)
      .then((res: AxiosResponse<AtomicItemAssetResponse>) => {
        return res.data.data;
      });

  });

  const assets = await Promise.all(items_p);

  return assets;

}

export const getLandAssets = async (account: string, client: AxiosInstance): Promise<AtomicItemAsset> => {

  const landRes: LandResponse = await getTableRows(client, {
    lower_bound: account,
    upper_bound: account,
    table: "miners",
  });

  if (!landRes.rows.length) throw new Error('Empty land');

  const item_id = landRes.rows[0].current_land;

  //console.log(`Getting land asset ${item_id}`);

  const res: AxiosResponse<AtomicItemAssetResponse> = await client.get('https://wax.api.atomicassets.io/atomicassets/v1/assets/' + item_id);

  return res.data.data;

}

export const getLastMiners = async (account: string, client: AxiosInstance): Promise<LandRowsEntity> => {

  const landRes: LandResponse = await getTableRows(client, {
    lower_bound: account,
    upper_bound: account,
    table: "miners",
  });

  if (!landRes.rows.length) throw new Error('Empty land');

  return landRes.rows[0];

}

export const getTMLBalance = async (account, client: AxiosInstance): Promise<number> => {

  const data = await getTableRows(client, {
    code: "alien.worlds",
    json: true,
    limit: 1000,
    scope: account,
    table: "accounts"
  });

  return data?.rows[0]?.balance ? Number(parseFloat(data?.rows[0]?.balance).toFixed(4)) : 0;

}

export const getNextMineDelay = async (account, chargeTime, client: AxiosInstance) => {

  let state_res;

  try {
    state_res = await getLastMiners(account, client);
  } catch (e) {}

  let ms_until_mine = -1;
  const now = new Date().getTime();
  //console.log(`Delay = ${chargeTime}`);

  if (state_res && state_res.last_mine_tx !== '0000000000000000000000000000000000000000000000000000000000000000'){
    //console.log(`Last mine was at ${state_res.last_mine}, now is ${new Date()}`);
    const last_mine_ms = Date.parse(state_res.last_mine + '.000Z');
    ms_until_mine = last_mine_ms + (chargeTime * 1000) - now;

    if (ms_until_mine < 0){
      ms_until_mine = 0;
    }
  }
  //console.log(`ms until next mine ${ms_until_mine}`);

  return ms_until_mine;

}

async function getTableRows(client: AxiosInstance, options) {

  const res = await client.post('https://api.waxsweden.org/v1/chain/get_table_rows', {
    code: "m.federation",
    index_position: 1,
    json: true,
    key_type: "",
    limit: 10,
    reverse: false,
    scope: "m.federation",
    table_key: "",
    ...options
  });

  return res.data;

}

export const get_bounty_from_tx = async (client: AxiosInstance, transaction_id, miner, hyperion_endpoints = [
  "https://api.waxsweden.org",
  "https://wax.eosusa.news",
  "https://wax.eosrio.io"]): Promise<number|"UNKNOWN"> => {
  return new Promise(async (resolve, reject) => {
    for (let i = 0; i < 30; i++){
      for (let h = 0; h < hyperion_endpoints.length; h++){
        const hyp = hyperion_endpoints[h];
        if (hyp != 'https://wax.eosusa.news')
        {
          try {
            const url = `${hyp}/v2/history/get_transaction?id=${transaction_id}`
            const {data: t_json} = await client.get(url);
            // console.log(t_json)
            if (t_json.executed){
              let amount = 0
              const amounts = t_json.actions.filter(a => a.act.name === 'transfer').map(a => a.act).filter(a => a.data.to === miner).map(a => a.data.quantity)
              amounts.forEach(a => amount += parseFloat(a))
              if (amount > 0){
                resolve(Number(amount.toFixed(4)))
                return
              }
            }
          }
          catch (e){
            console.log(e.message)
          }
        }

        await sleep(1000);
      }

      await sleep(2000);
    }

    resolve('UNKNOWN');
  });
}