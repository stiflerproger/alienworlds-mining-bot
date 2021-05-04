import { DBStats, ManagerOptions } from './types';
import { Alien } from '../Alien';
import { ClassOptions } from '../Alien/types';
import * as path from 'path';
import * as fs from 'fs';
import { censorEmail } from '../../utils';
import * as Events from 'events';

export default class Manager extends Events {

  options: ManagerOptions;
  bots: Alien[] = [];
  stats: DBStats = {};

  // боты, которым нужно майнить
  readyToMine: string[] = [];
  // боты, что сейчас майнят свой результат
  miningProcess: Map<string, true> = new Map();

  public getBots() {
    const bots = [];

    for (const bot of this.bots) {
      bots.push({
        enabled: bot.enabled,
        email: censorEmail(bot.email),
        history: this.stats[bot.email] || [],
        account: bot.account?.account_name || null,
        balance: bot.account ? {
          waxp: Number(parseFloat(bot.account.core_liquid_balance).toFixed(3)),
          tlm: bot.tlmBalance,
        } : null,
        resources: bot.account ? {
          cpu: bot.account.cpu_limit,
          net: bot.account.net_limit,
          ram: {
            max: bot.account.ram_quota,
            used: bot.account.ram_usage,
            available: 0
          },
        } : null,
        status: typeof bot.status === 'string' || bot.status.type === 'error' ? bot.status : {
          type: "timer",
          event: bot.status.event,
          timer: Math.ceil(Math.max(0, ((bot.status.created + (bot.status.timer * 1000)) - Date.now()) / 1000))
        }
      });
    }

    return bots;

  }

  constructor(options: ManagerOptions) {
    super();

    this.options = options;

    const statsPath = path.normalize(`${__dirname}/../../../store/stats.json`);

    if (!fs.existsSync(statsPath)) {
      fs.mkdirSync(path.normalize(`${__dirname}/../../../store`), {recursive: true});
      fs.writeFileSync(statsPath, '{}');
    }

    this.stats = JSON.parse(fs.readFileSync(statsPath, {
      encoding: 'utf8',
    }));
  }

  private _saveStatsTimeout;

  public saveStats() {
    clearTimeout(this._saveStatsTimeout);

    this._saveStatsTimeout = setTimeout(() => {
      const statsPath = path.normalize(`${__dirname}/../../../store/stats.json`);
      fs.writeFileSync(statsPath, JSON.stringify(this.stats));
    }, 2000);

    this.emit('history-saved');
  }

  addBot(bot: ClassOptions) {
    const newBot = new Alien(bot);

    newBot.on('confirmEmail', (email: string, callback) => {
      this.emit('confirmEmail', email, callback);
    })

    newBot.on('ready-to-mine', (email) => {
      if (!this.miningProcess.has(email) || !this.readyToMine.find(e => e === email)) {
        this.readyToMine.push(email);

        if (this.readyToMine.length === 1) this._tick();
      }
    });

    // выключение бота
    newBot.on('disabling', (email) => {
      const index = this.readyToMine.findIndex(e => e === email);

      if (index > -1) {
        this.readyToMine.splice(index, 1);
      }
    });

    newBot.on('mined', (email) => {
      if (this.miningProcess.has(email)) this.miningProcess.delete(email);
    });

    newBot.on('claimed', (email, amount) => {

      if (!this.stats[email]) this.stats[email] = [];

      this.stats[email].push({
        claimed: amount,
        timestamp: Date.now(),
      });

      this.saveStats();

    });

    newBot.on('status-change', (status) => {
      this.emit('status-change', censorEmail(newBot.email), status);
    })

    newBot.on('change', (email, balance) => {
      this.emit('change');
    })

    this.bots.push(newBot);
  }

  private _tick() {

    //console.log(`readyToMine: ${this.readyToMine.length} | inProcess: ${this.miningProcess.size}`);

    if (!this.readyToMine.length) return;

    if (this.miningProcess.size >= this.options.oneTimeMine) {
      return setTimeout(this._tick.bind(this), 1000);
    }

    const email = this.readyToMine.shift();

    this.miningProcess.set(email, true);

    this.bots.find(b => b.email === email).mine();

    return setTimeout(this._tick.bind(this), 1000);
  }


}