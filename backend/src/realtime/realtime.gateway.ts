import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { driverLocationUpdateSchema, SOCKET_EVENTS, type UserRole } from '@apniride/shared';
import type { Server, Socket } from 'socket.io';
import { type AuthUser, TokensService } from '../auth/tokens.service.js';
import { DriversService } from '../drivers/drivers.service.js';
import { TrackingService } from '../drivers/tracking.service.js';

/** One private room per user per app, e.g. "driver:<uuid>". The same person can use both apps. */
const room = (role: UserRole, userId: string) => `${role}:${userId}`;

type AuthedSocket = Socket & { data: { user: AuthUser } };

/**
 * Socket.IO on the API port. Clients connect with `auth: { token: <access token> }`.
 * A bad or expired token fails the connection with the message "unauthorized";
 * the app then refreshes its token and reconnects.
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger('Realtime');
  @WebSocketServer() private server!: Server;

  constructor(
    private readonly tokens: TokensService,
    private readonly drivers: DriversService,
    private readonly tracking: TrackingService,
  ) {}

  afterInit(server: Server) {
    server.use((socket, next) => {
      const token: unknown = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) return next(new Error('unauthorized'));
      this.tokens
        .verifyAccessToken(token)
        .then((user) => {
          (socket as AuthedSocket).data.user = user;
          next();
        })
        .catch(() => next(new Error('unauthorized')));
    });
  }

  async handleConnection(socket: AuthedSocket) {
    const { user } = socket.data;
    await socket.join(room(user.role, user.userId));
  }

  @SubscribeMessage('driver:location')
  async onDriverLocation(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    const { user } = socket.data;
    if (user.role !== 'driver') return;
    const parsed = driverLocationUpdateSchema.safeParse(body);
    if (!parsed.success) return;
    try {
      // Matching pool (only while online) and live tracking (only during a ride) are separate.
      const [, forward] = await Promise.all([
        this.drivers.updateLocation(user.userId, parsed.data),
        this.tracking.onDriverLocation(user.userId, parsed.data),
      ]);
      if (forward) this.toPassenger(forward.passengerId, SOCKET_EVENTS.rideDriverLocation, forward.position);
    } catch (err) {
      this.logger.warn(`location update failed: ${(err as Error).message}`);
    }
  }

  toPassenger(userId: string, event: string, payload: unknown) {
    this.server.to(room('passenger', userId)).emit(event, payload);
  }

  toDriver(userId: string, event: string, payload: unknown) {
    this.server.to(room('driver', userId)).emit(event, payload);
  }
}
