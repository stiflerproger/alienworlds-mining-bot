import { ClassOptions } from './types';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import axiosCookieJarSupport from 'axios-cookiejar-support';
import { Account, AutoAcceptLogin, WaxSession } from '../../types/wax-session';
import { HttpsProxyAgent } from 'hpagent';
import * as anticaptcha from '@antiadmin/anticaptchaofficial';
import { CookieJar } from 'tough-cookie';
import { censorEmail, sleep, timeRange } from '../../utils';
import { FileCookieStore } from 'tough-cookie-file-store';
import * as path from 'path';
import * as fs from 'fs';
import Miner from '../Miner';
import {
  get_bounty_from_tx,
  getBagAssets,
  getBlock,
  getInfo,
  getLandAssets,
  getLastMiners,
  getNextMineDelay, getTMLBalance,
} from '../WaxSweden';
import * as waxjs from '@waxio/waxjs/dist';
import { JsonRpc, Serialize } from 'eosjs';
import { MineWork } from '../Miner/types';
import * as Events from 'events';

export class Alien extends Events {
  public email: string;
  private options: ClassOptions;
  private readonly client: AxiosInstance;
  private readonly jar: CookieJar;
  private readonly storePath = path.normalize(`${__dirname}/../../../store/`);
  private accountStr: string;
  private pubKeys: [string, string];
  private wax: waxjs.WaxJS;
  private _fetch;
  private mineData: MineWork;
  public enabled = true;
  private claimTimeout;
  private claming = false; // нельзя выключить бота пока клеймится
  private mining = false; // нельзя выключить бота пока майнится
  public tlmBalance = 0;

  public account: Account;
  public status: string | {type: "error"; error: string;} | {type: "timer"; event: string; timer: number; created?: number;} = "";

  private setStatus(status) {

    if (typeof status !== 'string' && status.type === 'timer') {
      status.created = Date.now();
    }

    this.emit('status-change', status);

    this.status = status;
  }

  public setEnabled(state = true, error: string = null) {
    if (state) {
      this.enabled = true;
      this.emit('ready-to-mine', this.options.email);
    } else {
      if (this.claming || this.mining) {
        return this.error('Can\' disable while claiming or mining!');
      }

      if (error) {
        this.setStatus({
          type: "error",
          error: error
        })
      } else {
        this.status = "Выключен";
      }

      this.emit('disabling', this.options.email);
      clearTimeout(this.claimTimeout);
      this.enabled = false;
    }

    this.emit('change');
  }

  private log(...data: any) {
    if (data[0]?.claimed) {
      console.log(`\x1b[32m[AlienLogger]  - \x1b[0m${new Date().toLocaleString()}  \x1b[33m[AlienBot-${censorEmail(this.options.email)}] \x1b[0m \x1B[34m +${data[0].claimed} TLM`);
    } else {
      console.log(`\x1b[32m[AlienLogger]  - \x1b[0m${new Date().toLocaleString()}  \x1b[33m[AlienBot-${censorEmail(this.options.email)}] \x1b[0m`, ...data);
    }
  };

  private error(...data: any) {
    console.log(`\x1b[31m[AlienLogger]  - \x1b[0m${new Date().toLocaleString()}  \x1b[33m[AlienBot-${censorEmail(this.options.email)}] \x1b[0m`, ...data);
  };

  constructor(options: ClassOptions) {
    super();

    this.options = options;

    if (!options.proxy) {
      throw new Error(`You have to set proxy to account ${options.email}`);
    }

    this.email = this.options.email;

    // adding cookie file
    if (!fs.existsSync(this.storePath)) {
      fs.mkdirSync(this.storePath, { recursive: true });
    }

    this.client = axios.create({
      httpsAgent: new HttpsProxyAgent({ proxy: options.proxy }),
    });

    // adding CookieJar to axios instance
    axiosCookieJarSupport(this.client);

    this.jar = new CookieJar(new FileCookieStore(`${this.storePath}/${options.email}.json`));
    this.client.defaults.jar = this.jar;

    anticaptcha.setAPIKey(options.anticaptchaKey);
    anticaptcha.shutUp();

    this._init();
  }

  private async _init() {

    let inited = false;

    while (!inited) {
      try {

        this.setStatus('Запуск...');

        await this.init();
        inited = true;
      } catch (e) {

        console.log(e);

        this.setStatus({
          type: "timer",
          timer: 5,
          event: "Повторный запуск"
        });

        this.error('Initiating error, sleeping for 5sec');

        if (e?.response?.data) this.error(JSON.stringify(e?.response?.data));
        
        await sleep(5000);
      }
    }

    this.setStatus('Залогинен');

  }

  public async init() {

    this.log(`Initiating...`);

    this.setStatus("Проверка сессии...");

    let isLogged = await this.isLoggedToWax();

    if (!isLogged) {
      await this.loginToWax();
      isLogged = await this.isLoggedToWax();
    }

    if (!isLogged) {
      this.error('Not logged! Will try later');
      throw new Error('Not logged. Something wrong');
    }

    /** Getting account name */
    const { userAccount, pubKeys } = await this.autoAcceptLogin();

    this.log(`Hello, Mr. ${userAccount}`);

    this.accountStr = userAccount;
    this.pubKeys = pubKeys;

    this._fetch = (url, options) => {

      //this.log('Alien fetching..', url, options);

      return new Promise((res, rej) => {
        this.client.post(url, JSON.parse(options.body))
          .then(result => {
            return res({
              ok: true,
              json: () => result.data,
            });
          })
          .catch(err => {
            return rej(err);
          });
      });

    };

    global['fetch'] = this._fetch;

    this.wax = new waxjs.WaxJS('https://api.waxsweden.org', this.accountStr, this.pubKeys, false);

    this.wax.api.rpc = new JsonRpc('https://api.waxsweden.org', {
      fetch: this._fetch,
    });

    this.setEnabled(this.enabled);

    this.getAccount();

  }

  public async getAccount(): Promise<Account> {
    this.log('Updating account info');

    try {
      const { data }: AxiosResponse<Account> = await this.client.post('https://chain.wax.io/v1/chain/get_account', {
        account_name: this.accountStr,
      });

      this.account = data;
      this.emit('change')

      return data;
    } catch (e) {
      this.error(`Get account error`, e);
      await sleep(2000);
      return this.getAccount();
    }
  }

  /*
    Check is user logged to all-access.wax.io
   */
  public async isLoggedToWax(): Promise<boolean> {

    this.log('Check login..');

    let data: WaxSession;

    try {

      const res = await this.client.get('https://all-access.wax.io/api/session', {
        withCredentials: true,
      });

      data = res.data;

    } catch (e) {

      if (typeof e.response?.data === 'object' && Array.isArray(e.response.data?.errors)) {

        for (const err of e.response.data?.errors) {
          if (err?.message === 'Token not found') {
            this.log('Token too old. Relogin');
            this.jar.removeAllCookiesSync();
            return false;
          }
        }

      } else if (!e?.response?.data || typeof e.response.data !== 'object' || e.response.data.indexOf('Unauthorized') > -1) {
        this.error(e.response?.data);
        return false;
      }

      this.error('Something wrong. Can\'t get your login status');

      throw new Error(JSON.stringify(data));
    }

    this.log(`Logged as ${censorEmail(this.options.email)}`);

    return true;

  }

  public async loginToWax() {

    this.setStatus("Решаю капчу..");

    this.log('Login in to all-access.wax.io');

    this.log('Solving captcha..');

    let solvedCaptcha: string;

    try {
      solvedCaptcha = await anticaptcha.solveRecaptchaV2Proxyless('https://all-access.wax.io/', '6LdaB7UUAAAAAD2w3lLYRQJqsoup5BsYXI2ZIpFF');
    } catch (e) {
      this.error(e);
      throw new Error(e);
    }

    this.log('Captcha Solved!', solvedCaptcha.slice(0, 15) + '....');

    await this._login(solvedCaptcha);

  }

  private async _login(captcha: string) {

    this.setStatus('Логин...');

    this.log('Trying to login');

    let response;

    try {
      response = await this.client.post('https://all-access.wax.io/api/session', {
        'g-recaptcha-response': captcha,
        username: this.options.email,
        password: this.options.password,
        redirectTo: '',
      }, {
        headers: {
          origin: 'https://all-access.wax.io',
          referer: 'https://all-access.wax.io/',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.85 Safari/537.36',
          'content-type': 'application/json;charset=UTF-8',
        },
        withCredentials: true,
      });
    } catch (e) {
      if (e.response?.data?.challengeToken) {
        this.log('Need to confirm email!');

        const code = await this.getEmailConfirmationCode();

        this.log('Code:' + code);

        response = await this.confirmEmailChallenge(e.response.data.challengeToken, code);
      } else {
        throw e;
      }
    }

    this.log('Got Wax session token!', response.data.token.slice(0, 5) + '....');

    return response.data.token;

  }

  private async getEmailConfirmationCode(): Promise<string> {

    return new Promise((res, rej) => {
      this.emit('confirmEmail', this.email, (err, code) => {
        if (err) return rej(err);

        return res(code);
      });
    });

  }

  private async confirmEmailChallenge(token: string, code: string) {

    const response = await this.client.post('https://all-access.wax.io/api/session/challenge', {
      challenge: token,
      code: code
    }, {
      withCredentials: true,
      headers: {
        origin: "https://all-access.wax.io",
        referer: "https://all-access.wax.io/challenge?challenge=" + token
      }
    });

    return response;

  }


  private getCookieValue(cookieName: string) {
    const token = this.jar.serializeSync().cookies?.find(e => e.key === cookieName);

    return token ? token.value : undefined;
  }

  public async autoAcceptLogin(): Promise<AutoAcceptLogin> {

    const res = await this.client.get('https://api-idm.wax.io/v1/accounts/auto-accept/login', {
      headers: {
        cookie: 'session_token=' + this.getCookieValue('session_token'),
        origin: 'https://play.alienworlds.io',
        referer: 'https://play.alienworlds.io/',
      },
    });

    return res.data;

  }

  public async mine() {
    this.mining = true;

    let mined = false;

    while(!mined) {
      try {

        this.setStatus("Майнинг...");

        await this._mine();

        mined = true;

      } catch (e) {

        this.setStatus({
          type: "timer",
          timer: 15,
          event: "Повторный майнинг"
        });

        this.error('Mine error', e);
        this.error('Sleeping for 15sec');
        await sleep(10000);
      }
    }

    this.mining = false;
  }

  public async _mine() {

    const bagAssets = await getBagAssets(this.accountStr, this.client);
    const bagParams = getBagMiningParams(bagAssets);

    const bagDifficulty = bagParams.difficulty;

    const landAssets = await getLandAssets(this.accountStr, this.client);
    const landParams = getLandMiningParams(landAssets);

    const landDifficulty = landParams.difficulty;

    const lastMine = await this.getLastMine();

    this.log(`Bag difficulty = ${bagDifficulty}, Land difficulty = ${landDifficulty}, Last mine = ${lastMine}`);

    const lastMineResultPath = path.normalize(`${__dirname}/../../../store/${this.options.email}.mined`);

    if (!fs.existsSync(lastMineResultPath)) {
      fs.writeFileSync(lastMineResultPath, '{}');
    }

    const storedMine = JSON.parse(fs.readFileSync(lastMineResultPath, {
      encoding: 'utf8',
    }));

    let mineData: MineWork;

    if (storedMine?.difficulty === bagDifficulty + landDifficulty && storedMine?.last_mine_tx === lastMine) {

      this.log('Mine data restored');

      mineData = storedMine.result;

    } else {

      const miner = new Miner();

      mineData = await miner.mine({
        account: this.accountStr,
        difficulty: bagDifficulty + landDifficulty,
        last_mine_tx: lastMine,
        mining_account: 'm.federation',
        logger: this.log.bind(this),
      });

      this.log('Mine success');

      fs.writeFileSync(lastMineResultPath, JSON.stringify({
        difficulty: bagDifficulty + landDifficulty,
        last_mine_tx: lastMine,
        result: mineData
      }));

    }
    this.mineData = mineData;

    this.emit('mined', this.options.email);

    this.updateBalance();
    this.getAccount();

    if (!this.enabled) return mineData;

    // проверить когда нужно клеймить
    bagParams.delay *= landParams.delay / 10;
    bagParams.difficulty += landParams.difficulty;

    this._claim({
      miner: mineData.account,
      nonce: mineData.rand_str,
    }, bagParams.delay);

    return mineData;

  }

  private async updateBalance() {
    let updated = false;

    while (!updated) {

      try {
        const tlmBalance = await getTMLBalance(this.accountStr, this.client);

        this.tlmBalance = tlmBalance;
        updated = true;
      } catch (e) {

      }

    }

    this.emit('change');

  }

  private async getLastMine() {
    const lastMine = await getLastMiners(this.accountStr, this.client);

    return lastMine.last_mine_tx;
  }

  private async _claim(mineWork: { miner: string; nonce: string }, delay) {

    clearTimeout(this.claimTimeout);

    const nextMineAfter = await getNextMineDelay(this.accountStr, delay, this.client);

    if (!this.enabled) return;

    this.log(`Claim rewards after: ${Math.floor(nextMineAfter / 1000)} sec.`);

    this.setStatus({
      type: "timer",
      timer: Math.floor(nextMineAfter / 1000),
      event: "Сбор TLM"
    });

    this.claimTimeout = setTimeout(async () => {

      this.setStatus("Собираю TLM...");

      this.claming = true;

      let claimed = false;

      while (!claimed) {
        try {

          const claimAmount = await this.claim(mineWork);

          claimed = true;

          this.log({claimed: claimAmount});

          if (typeof claimAmount === 'number') this.emit('claimed', this.email, claimAmount);

          this.setStatus(`Собрал ${claimAmount} TLM`);

        } catch(e) {

          const reason = e?.response?.data?.error?.what;

          if (reason && typeof reason === 'string') {
            // выключаем бота, т.к. CPU превышен
            this.claming = false;

            if (reason.indexOf('CPU usage limit') > -1) {
              this.error('CPU usage limit!');
              this.setEnabled(false, "CPU usage limit!");
            } else {
              this.error(reason);
              this.setEnabled(false, reason);
            }

            return;
          }

          this.setStatus({
            type: "timer",
            timer: 15,
            event: "Повторный Сбор TLM"
          });

          this.error(`Got claim error`, reason || (e?.code === 'ECONNRESET' ? 'Proxy error' : e));
          this.error('Sleeping for 15sec');
          await sleep(10000);
        }
      }

      await sleep(5000);
      this.emit('ready-to-mine', this.options.email);

    }, timeRange(2000 + nextMineAfter, 7000 + nextMineAfter));

  }

  public async claim(mineWork: { miner: string; nonce: string }) {

    this.log('Claiming..');

    const actions = [{
      account: 'm.federation',
      name: 'mine',
      authorization: [{
        actor: this.accountStr,
        permission: 'active',
      }],
      data: mineWork,
    }];

    let transaction: any = {};
    transaction.actions = actions;

    const info = await getInfo(this.client);

    const block = await getBlock(this.client, info.head_block_num - 3); // blocksBehind

    transaction = { transaction, ...this.transactionHeader(block, 90) }; // expireSeconds

    const serializedActions = await this.wax.api.serializeActions(actions);

    transaction.actions = serializedActions;

    const serializedTransaction = await this.wax.api.serializeTransaction(transaction);

    this.log('Signing transaction...');

    const sign = await this.signTransaction(serializedTransaction);

    this.log('Pushing signed transaction...');

    this.setStatus("Собираю TLM... отправка");

    const res = await this.wax.api.pushSignedTransaction({
      signatures: sign.signatures,
      serializedTransaction: serializedTransaction,
    });

    this.log('Pushing done!');

    // get claimed result
    const claimed = await get_bounty_from_tx(this.client, res.transaction_id, this.accountStr);

    this.claming = false;

    return claimed;

  }

  private transactionHeader(block, expireSeconds) {
    function d(t) {
      const e = new Date(1e3 * t).toISOString();
      return e.substr(0, e.length - 1);
    }

    return {
      expiration: d(Math.round(Date.parse(block.timestamp + 'Z') / 1e3) + expireSeconds),
      ref_block_num: 65535 & block.block_num,
      ref_block_prefix: block.ref_block_prefix,
    };
  }

  /** Get signatures for transaction */
  private async signTransaction(serializedTransaction: Uint8Array, website = 'play.alienworlds.io') {

    this.log('Solving captcha..');

    let solvedCaptcha: string;

    let solved = false;

    while (!solved) {
      try {
        this.setStatus("Собираю TLM... решаю капчу");

        solvedCaptcha = await anticaptcha.solveRecaptchaV2Proxyless('https://all-access.wax.io/', '6LdaB7UUAAAAAD2w3lLYRQJqsoup5BsYXI2ZIpFF');

        solved = true;
      } catch (e) {

        this.setStatus({
          type: "timer",
          event: "Повторное решение капчи",
          timer: 15
        });

        this.error(e);

        await sleep(15000);
      }
    }

    this.setStatus("Собираю TLM... подписываю");

    this.log('Captcha Solved!', solvedCaptcha.slice(0, 15) + '....');

    const result: AxiosResponse<{ signatures: string[] }> = await this.client.post('https://public-wax-on.wax.io/wam/sign', {
      description: 'jwt is insecure',
      'g-recaptcha-response': solvedCaptcha,
      serializedTransaction: [...serializedTransaction], website,
    }, {
      headers: {
        referer: 'https://all-access.wax.io/',
        'x-access-token': this.getCookieValue('session_token'),
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.85 Safari/537.36',
        'content-type': 'application/json;charset=UTF-8',
      },
      withCredentials: true,
    });

    return result.data;

  }

}

const getBagMiningParams = (bag) => {
  const mining_params = {
    delay: 0,
    difficulty: 0,
    ease: 0,
  };

  let min_delay = 65535;

  for (let b = 0; b < bag.length; b++) {
    if (bag[b].data.delay < min_delay) {
      min_delay = bag[b].data.delay;
    }
    mining_params.delay += bag[b].data.delay;
    mining_params.difficulty += bag[b].data.difficulty;
    mining_params.ease += bag[b].data.ease / 10;
  }

  if (bag.length === 2) {
    mining_params.delay -= parseInt((min_delay / 2) as any);
  } else if (bag.length === 3) {
    mining_params.delay -= min_delay;
  }

  return mining_params;
};

const getLandMiningParams = (land) => {
  const mining_params = {
    delay: 0,
    difficulty: 0,
    ease: 0,
  };

  mining_params.delay += land.data.delay;
  mining_params.difficulty += land.data.difficulty;
  mining_params.ease += land.data.ease;

  return mining_params;
};
