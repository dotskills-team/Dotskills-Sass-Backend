import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

/** `a***@gmail.com` — enough to spot in logs which mailbox was targeted without logging a full address. */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  return `${local[0]}***@${domain}`;
}

/**
 * Thin SMTP wrapper (nodemailer) — the only place in the backend that
 * sends real emails (payment receipt + account-activation). Reads SMTP_*
 * from env; if unconfigured, logs and skips the send rather than throwing,
 * so local/dev environments without SMTP credentials never break a
 * payment/subscription flow over a missing mail server.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<string>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    this.fromAddress =
      this.configService.get<string>('SMTP_FROM') ??
      'DotSkills <no-reply@dotskills.com>';

    if (!host) {
      this.logger.warn(
        'SMTP_HOST is not configured — outgoing emails will be logged only, not sent.',
      );
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: port ? Number(port) : 587,
      secure: Number(port) === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async send(options: SendMailOptions): Promise<void> {
    if (!this.transporter) {
      this.logger.log({
        event: 'mail_skipped_no_smtp',
        to: maskEmail(options.to),
        subject: options.subject,
      });
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      // Accepted-by-SMTP-server confirmation only — not a delivered-to-inbox
      // guarantee (spam filtering, provider-side drops, etc. happen after
      // this point and are invisible to us). Logged specifically because a
      // silent success here with no eventual inbox delivery is exactly the
      // failure mode this diagnostic was added to distinguish from a real
      // send failure.
      this.logger.log({
        event: 'mail_send_accepted',
        to: maskEmail(options.to),
        subject: options.subject,
        messageId: info.messageId,
        response: info.response,
      });
    } catch (error) {
      // Email delivery must never fail a payment/subscription flow — log
      // and swallow, the settlement itself has already been recorded.
      const smtpError = error as NodeJS.ErrnoException & {
        responseCode?: number;
        command?: string;
      };
      this.logger.error({
        event: 'mail_send_failed',
        to: maskEmail(options.to),
        subject: options.subject,
        error: smtpError instanceof Error ? smtpError.message : smtpError,
        code: smtpError.code,
        responseCode: smtpError.responseCode,
        command: smtpError.command,
      });
    }
  }
}
