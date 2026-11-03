import { Injectable, Logger } from '@nestjs/common';
import { maskPhone } from '@apniride/shared';

/** Sends SMS. Swap the implementation per SMS_PROVIDER (e.g. a Pakistani SMS gateway) later. */
export abstract class SmsSender {
  abstract send(phoneE164: string, message: string): Promise<void>;
}

/** Development only: prints the message instead of sending it. Blocked in production by env validation. */
@Injectable()
export class ConsoleSmsSender extends SmsSender {
  private readonly logger = new Logger('SMS');

  async send(phoneE164: string, message: string): Promise<void> {
    // Masked number – full phone numbers must never reach logs.
    this.logger.warn(`[dev] to ${maskPhone(phoneE164)}: ${message}`);
  }
}
