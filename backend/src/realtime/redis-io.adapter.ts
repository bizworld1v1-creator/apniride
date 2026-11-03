import type { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Socket.IO through Redis pub/sub, so an event emitted on one API instance (or a BullMQ worker)
 * reaches a phone connected to another instance.
 */
export class RedisIoAdapter extends IoAdapter {
  private pub: Redis | null = null;
  private sub: Redis | null = null;

  constructor(
    app: INestApplication,
    private readonly redisUrl: string,
  ) {
    super(app);
  }

  async connect(): Promise<void> {
    this.pub = new Redis(this.redisUrl, { lazyConnect: true });
    this.sub = this.pub.duplicate();
    await Promise.all([this.pub.connect(), this.sub.connect()]);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: '*' },
      // Phones on weak 3G: be patient before declaring a connection dead.
      pingInterval: 25_000,
      pingTimeout: 30_000,
      // Replays missed events after a short disconnect (e.g. passing under a flyover).
      connectionStateRecovery: { maxDisconnectionDuration: 2 * 60_000 },
    } as ServerOptions);
    if (this.pub && this.sub) server.adapter(createAdapter(this.pub, this.sub));
    return server;
  }

  override async dispose(): Promise<void> {
    await super.dispose();
    this.pub?.disconnect();
    this.sub?.disconnect();
  }
}
