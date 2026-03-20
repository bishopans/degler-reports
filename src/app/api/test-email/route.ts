import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function GET() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    return NextResponse.json({ error: 'EMAIL_USER or EMAIL_PASS not set', user: !!user, pass: !!pass });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user,
        pass,
      },
      tls: {
        minVersion: 'TLSv1.2',
      },
      logger: false,
      debug: false,
    });

    // Verify connection
    await transporter.verify();

    // Send test email
    const info = await transporter.sendMail({
      from: user,
      to: user, // send to self
      subject: 'DW Reports — SMTP Test',
      text: 'If you received this, SMTP is working correctly.',
    });

    return NextResponse.json({ success: true, messageId: info.messageId, response: info.response });
  } catch (err) {
    const errObj = err instanceof Error ? { message: err.message, name: err.name, stack: err.stack?.split('\n').slice(0, 5) } : String(err);
    return NextResponse.json({ success: false, error: errObj }, { status: 500 });
  }
}
