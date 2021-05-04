import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketServer,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { Inject, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { censorEmail } from './utils';

const confirmations: {[key: string]: (err: any, code: string) => void} = {};

@WebSocketGateway(8080,{
  pingInterval: 25000,
  transports: ['websocket']
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {

  constructor(@Inject(AppService) private readonly appService: AppService) {

    this.appService.manager.on('status-change', (email, status) => {
      this.server.emit('bot-change', email, {status});
    });

    this.appService.manager.on('change', () => {
      this.server.emit('bots', this.appService.manager.getBots());
    });

    this.appService.manager.on('confirmEmail', (email, callback) => {
      confirmations[email] = callback;

      this.server.emit('confirmEmail', email);
    });
  }

  private logger: Logger = new Logger('AppGateway');

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('confirmEmail')
  confirmEmail(client: any, payload: any) {
    if (!confirmations[payload[0]]) return;

    confirmations[payload[0]](null, payload[1]);

    delete confirmations[payload[0]];
  }

  @SubscribeMessage('enable/disable')
  handleMessage(client: any, payload: any, callback: any): string {
    const bot = this.appService.manager.bots.find(b => censorEmail(b.email) === payload[0]);

    if (!bot) return;

    bot.setEnabled(payload[1]);

    return;
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);

    client.emit('bots', this.appService.manager.getBots());
    client.emit('confirmEmail', Object.keys(confirmations));
  }

}
