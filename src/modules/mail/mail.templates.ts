/**
 * Plain, self-contained HTML email templates — no external template engine,
 * matches the "no unnecessary architecture" constraint. Field set mirrors
 * the frontend `ReceiptDocument` component so the emailed receipt and the
 * downloadable PDF never disagree.
 */

interface ReceiptEmailData {
  companyName: string;
  ownerName: string;
  invoiceNumber: string;
  receiptNumber: string;
  planName: string;
  billingCycle: string;
  amount: string;
  currencyCode: string;
  paymentMethod: string;
  transactionId: string;
  paidAt: string;
  receiptUrl: string;
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e7eb;">
            <tr>
              <td style="background:#111827;padding:20px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:600;">DotSkills</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="font-size:18px;margin:0 0 16px;">${title}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#f9fafb;color:#6b7280;font-size:12px;">
                This is an automated message from DotSkills. Please do not reply to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#6b7280;font-size:13px;width:45%;">${label}</td>
    <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${value}</td>
  </tr>`;
}

export function paymentReceiptEmailHtml(data: ReceiptEmailData): {
  subject: string;
  html: string;
} {
  const body = `
    <p style="font-size:14px;color:#374151;margin:0 0 20px;">
      Hi ${data.ownerName}, your payment for <strong>${data.companyName}</strong> was successful. Here is your receipt.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:12px 0;">
      ${row('Receipt Number', data.receiptNumber)}
      ${row('Invoice Number', data.invoiceNumber)}
      ${row('Plan', `${data.planName} (${data.billingCycle})`)}
      ${row('Amount Paid', `${data.currencyCode} ${data.amount}`)}
      ${row('Payment Method', data.paymentMethod)}
      ${row('Transaction ID', data.transactionId)}
      ${row('Paid On', data.paidAt)}
    </table>
    <p style="margin:20px 0 0;">
      <a href="${data.receiptUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:13px;">
        View &amp; Download Receipt (PDF)
      </a>
    </p>`;

  return {
    subject: `Payment Receipt — ${data.receiptNumber}`,
    html: layout('Payment Receipt', body),
  };
}

export function accountActivationEmailHtml(data: {
  ownerName: string;
  companyName: string;
  loginUrl: string;
}): { subject: string; html: string } {
  const body = `
    <p style="font-size:14px;color:#374151;margin:0 0 16px;">
      Hi ${data.ownerName}, great news — <strong>${data.companyName}</strong> is now active on DotSkills.
    </p>
    <p style="font-size:14px;color:#374151;margin:0 0 20px;">
      Your subscription payment was confirmed and your dashboard is ready to use. Log in with your registered email and password to get started.
    </p>
    <p style="margin:0;">
      <a href="${data.loginUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:13px;">
        Go to Dashboard
      </a>
    </p>`;

  return {
    subject: `${data.companyName} is now active on DotSkills`,
    html: layout('Your Company is Live', body),
  };
}
