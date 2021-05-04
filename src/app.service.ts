import { Injectable } from '@nestjs/common';
import Manager from './classes/Manager';
import * as fs from 'fs';

@Injectable()
export class AppService  {

  public async onApplicationBootstrap() {
    this.run();
  }

  public manager: Manager = new Manager({
    oneTimeMine: 2
  });

  private async run() {

    if (!process.env.anticaptcha_key) throw new Error('Add anticaptcha_key key to .env file!')

    const bots: {email: string; password: string; proxy: string}[] = JSON.parse(fs.readFileSync('./bots.json', {
      encoding: 'utf8'
    }));

    for (const bot of bots) {
      this.manager.addBot({
        email: bot.email,
        password: bot.password,
        proxy: bot.proxy,
        anticaptchaKey: process.env.anticaptcha_key
      });
    }

  }

}