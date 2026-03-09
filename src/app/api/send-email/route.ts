import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
    try {
        console.log('API route hit');
        const formData = await request.formData();
        console.log('Form data received:', formData);

        const pdfFile = formData.get('pdf') as Blob;
        const subject = formData.get('subject') as string;
        const emailTo = formData.get('emailTo') as string;
        
        console.log('Email details:', { subject, emailTo });
        console.log('Environment variables:', {
            user: process.env.EMAIL_USER,
            hasPass: !!process.env.EMAIL_PASS
        });

        // Create PDF buffer from blob
        const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

        // Create email transporter with Office 365 settings
        const transporter = nodemailer.createTransport({
            host: "smtp.office365.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                ciphers: 'SSLv3'
            }
        });

        console.log('Attempting to send email');

        // Send email
        const info = await transporter.sendMail({
            from: 'andrew@deglerwhiting.com',
            to: emailTo,
            subject: subject,
            text: 'Please find the attached training report.',
            attachments: [
                {
                    filename: `${subject}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        });

        console.log('Email sent:', info);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Detailed email error:', error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}