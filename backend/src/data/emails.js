const signupEmail = async (code) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Email Verification</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          
          body {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            margin: 0;
            padding: 0;
            font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
          }
          
          .email-wrapper {
            padding: 40px 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .container {
            max-width: 600px;
            width: 100%;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1);
            position: relative;
          }
          
          .container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #4f46e5, #7c3aed, #ec4899, #f59e0b, #10b981);
            background-size: 300% 100%;
            animation: gradientShift 6s ease-in-out infinite;
          }
          
          @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          
          .header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            padding: 48px 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              rgba(255, 255, 255, 0.03) 10px,
              rgba(255, 255, 255, 0.03) 20px
            );
            animation: float 20s linear infinite;
          }
          
          @keyframes float {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
          }
          
          .header h1 {
            color: #ffffff;
            font-size: 32px;
            font-weight: 600;
            margin: 0;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            position: relative;
            z-index: 2;
          }
          
          .header .subtitle {
            color: rgba(255, 255, 255, 0.9);
            font-size: 16px;
            font-weight: 300;
            margin: 8px 0 0 0;
            position: relative;
            z-index: 2;
          }
          
          .content {
            padding: 48px 40px;
            color: #2c3e50;
            background: #ffffff;
            position: relative;
          }
          
          .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #2c3e50;
            margin-bottom: 24px;
          }
          
          .message {
            font-size: 16px;
            color: #5a6c7d;
            margin-bottom: 32px;
            line-height: 1.7;
          }
          
          .code-container {
            text-align: center;
            margin: 40px 0;
          }
          
          .code-label {
            font-size: 14px;
            font-weight: 500;
            color: #7c3aed;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 16px;
          }
          
          .code-box {
            background: linear-gradient(135deg, #4f46e5, #7c3aed);
            color: #ffffff;
            padding: 24px 32px;
            font-size: 36px;
            font-weight: 700;
            text-align: center;
            letter-spacing: 8px;
            border-radius: 16px;
            margin: 16px auto;
            display: inline-block;
            min-width: 200px;
            box-shadow: 0 8px 32px rgba(79, 70, 229, 0.4);
            position: relative;
            overflow: hidden;
          }
          
          .code-box::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            animation: shine 2s infinite;
          }
          
          @keyframes shine {
            0% { left: -100%; }
            100% { left: 100%; }
          }
          
          .expiry-notice {
            background: linear-gradient(135deg, #fff3cd, #ffeaa7);
            border: 1px solid #f39c12;
            border-radius: 12px;
            padding: 16px 20px;
            margin: 32px 0;
            font-size: 14px;
            color: #d68910;
            text-align: center;
            font-weight: 500;
          }
          
          .security-note {
            font-size: 15px;
            color: #6c757d;
            margin-top: 32px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
            border-left: 4px solid #17a2b8;
          }
          
          .signature {
            margin-top: 48px;
            font-size: 16px;
            color: #2c3e50;
            font-weight: 500;
          }
          
          .footer {
            text-align: center;
            font-size: 13px;
            color: #95a5a6;
            padding: 32px 40px;
            background: #f8f9fa;
            border-top: 1px solid #e9ecef;
          }
          
          .footer a {
            color: #4f46e5;
            text-decoration: none;
          }
          
          .footer a:hover {
            text-decoration: underline;
          }
          
          .social-links {
            margin-top: 16px;
          }
          
          .social-links a {
            display: inline-block;
            margin: 0 8px;
            padding: 8px;
            border-radius: 50%;
            background: #e9ecef;
            color: #6c757d;
            text-decoration: none;
            transition: all 0.3s ease;
          }
          
          .social-links a:hover {
            background: #4f46e5;
            color: #ffffff;
            transform: translateY(-2px);
          }
          
          @media (max-width: 600px) {
            .email-wrapper {
              padding: 20px 10px;
            }
            
            .container {
              margin: 0;
              border-radius: 16px;
            }
            
            .header {
              padding: 32px 24px;
            }
            
            .header h1 {
              font-size: 28px;
            }
            
            .content {
              padding: 32px 24px;
            }
            
            .code-box {
              font-size: 28px;
              letter-spacing: 4px;
              padding: 20px 24px;
            }
            
            .footer {
              padding: 24px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <h1>📧 Verify Your Email</h1>
              <p class="subtitle">Complete your registration</p>
            </div>
            <div class="content">
              <p class="greeting">Welcome! 🎉</p>
              <p class="message">
                Thank you for joining us! We're excited to have you on board. 
                To complete your registration and get started, please enter the verification code below:
              </p>
              
              <div class="code-container">
                <div class="code-label">Verification Code</div>
                <div class="code-box">${code}</div>
              </div>
              
              <div class="expiry-notice">
                ⏰ This verification code will expire in 5 minutes
              </div>
              
              <div class="security-note">
                <strong>🎯 Important:</strong> If you did not create an account with us, 
                you can safely ignore this email. No account has been created and no further action is needed.
              </div>
              
              <p class="signature">
                Welcome to the family!<br>
                <strong>The Team</strong> 🚀
              </p>
            </div>
            <div class="footer">
              <p>© 2024 Your Company Name. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

const resendOtpEmail = async (code, type = "verify") => {
  if (type === "verify") {
    return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Reset Your Password</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

          body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
          }

          .email-wrapper {
            padding: 40px 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .container {
            max-width: 600px;
            width: 100%;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1);
            position: relative;
          }

          .container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #ffeaa7);
            background-size: 300% 100%;
            animation: gradientShift 6s ease-in-out infinite;
          }

          @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }

          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 48px 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }

          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              rgba(255, 255, 255, 0.03) 10px,
              rgba(255, 255, 255, 0.03) 20px
            );
            animation: float 20s linear infinite;
          }

          @keyframes float {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
          }

          .header h1 {
            color: #ffffff;
            font-size: 32px;
            font-weight: 600;
            margin: 0;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            position: relative;
            z-index: 2;
          }

          .header .subtitle {
            color: rgba(255, 255, 255, 0.9);
            font-size: 16px;
            font-weight: 300;
            margin: 8px 0 0 0;
            position: relative;
            z-index: 2;
          }

          .content {
            padding: 48px 40px;
            color: #2c3e50;
            background: #ffffff;
            position: relative;
          }

          .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #2c3e50;
            margin-bottom: 24px;
          }

          .message {
            font-size: 16px;
            color: #5a6c7d;
            margin-bottom: 32px;
            line-height: 1.7;
          }

          .code-container {
            text-align: center;
            margin: 40px 0;
          }

          .code-label {
            font-size: 14px;
            font-weight: 500;
            color: #7c3aed;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 16px;
          }

          .code-box {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: #ffffff;
            padding: 24px 32px;
            font-size: 36px;
            font-weight: 700;
            text-align: center;
            letter-spacing: 8px;
            border-radius: 16px;
            margin: 16px auto;
            display: inline-block;
            min-width: 200px;
            box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
            position: relative;
            overflow: hidden;
          }

          .code-box::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            animation: shine 2s infinite;
          }

          @keyframes shine {
            0% { left: -100%; }
            100% { left: 100%; }
          }

          .expiry-notice {
            background: linear-gradient(135deg, #fff3cd, #ffeaa7);
            border: 1px solid #f39c12;
            border-radius: 12px;
            padding: 16px 20px;
            margin: 32px 0;
            font-size: 14px;
            color: #d68910;
            text-align: center;
            font-weight: 500;
          }

          .security-note {
            font-size: 15px;
            color: #6c757d;
            margin-top: 32px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
            border-left: 4px solid #17a2b8;
          }

          .signature {
            margin-top: 48px;
            font-size: 16px;
            color: #2c3e50;
            font-weight: 500;
          }

          .footer {
            text-align: center;
            font-size: 13px;
            color: #95a5a6;
            padding: 32px 40px;
            background: #f8f9fa;
            border-top: 1px solid #e9ecef;
          }

          .footer a {
            color: #667eea;
            text-decoration: none;
          }

          .footer a:hover {
            text-decoration: underline;
          }

          .social-links {
            margin-top: 16px;
          }

          .social-links a {
            display: inline-block;
            margin: 0 8px;
            padding: 8px;
            border-radius: 50%;
            background: #e9ecef;
            color: #6c757d;
            text-decoration: none;
            transition: all 0.3s ease;
          }

          .social-links a:hover {
            background: #667eea;
            color: #ffffff;
            transform: translateY(-2px);
          }

          @media (max-width: 600px) {
            .email-wrapper {
              padding: 20px 10px;
            }

            .container {
              margin: 0;
              border-radius: 16px;
            }

            .header {
              padding: 32px 24px;
            }

            .header h1 {
              font-size: 28px;
            }

            .content {
              padding: 32px 24px;
            }

            .code-box {
              font-size: 28px;
              letter-spacing: 4px;
              padding: 20px 24px;
            }

            .footer {
              padding: 24px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <h1>📧 New Verification Code</h1>
              <p class="subtitle">Fresh OTP sent successfully</p>
            </div>
            <div class="content">
              <p class="greeting">Hello again! 👋</p>
              <p class="message">
                We've sent you a new verification code as requested! Here's your fresh verification code. Please use this new code to complete your email verification:
              </p>

              <div class="code-container">
                <div class="code-label">New Verification Code</div>
                <div class="code-box">${code}</div>
              </div>

              <div class="expiry-notice">
                ⏰ This code will expire in 5 minutes for your security
              </div>

              <div class="security-note">
                <strong>🔐 Security Reminder:</strong> If you did not request this new verification code, 
                you can safely ignore this email. Your account remains secure.
              </div>

              <p class="signature">
                Thanks for your patience,<br>
                <strong>The Security Team</strong> 💙
              </p>
            </div>
            <div class="footer">
              <p>© 2024 Your Company Name. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
  } else {
    return forgotPasswordEmail(code);
  }
};

const forgotPasswordEmail = async (code) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Reset Your Password</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

          body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
          }

          .email-wrapper {
            padding: 40px 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .container {
            max-width: 600px;
            width: 100%;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1);
            position: relative;
          }

          .container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #ffeaa7);
            background-size: 300% 100%;
            animation: gradientShift 6s ease-in-out infinite;
          }

          @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }

          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 48px 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }

          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              rgba(255, 255, 255, 0.03) 10px,
              rgba(255, 255, 255, 0.03) 20px
            );
            animation: float 20s linear infinite;
          }

          @keyframes float {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
          }

          .header h1 {
            color: #ffffff;
            font-size: 32px;
            font-weight: 600;
            margin: 0;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            position: relative;
            z-index: 2;
          }

          .header .subtitle {
            color: rgba(255, 255, 255, 0.9);
            font-size: 16px;
            font-weight: 300;
            margin: 8px 0 0 0;
            position: relative;
            z-index: 2;
          }

          .content {
            padding: 48px 40px;
            color: #2c3e50;
            background: #ffffff;
            position: relative;
          }

          .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #2c3e50;
            margin-bottom: 24px;
          }

          .message {
            font-size: 16px;
            color: #5a6c7d;
            margin-bottom: 32px;
            line-height: 1.7;
          }

          .code-container {
            text-align: center;
            margin: 40px 0;
          }

          .code-label {
            font-size: 14px;
            font-weight: 500;
            color: #7c3aed;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 16px;
          }

          .code-box {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: #ffffff;
            padding: 24px 32px;
            font-size: 36px;
            font-weight: 700;
            text-align: center;
            letter-spacing: 8px;
            border-radius: 16px;
            margin: 16px auto;
            display: inline-block;
            min-width: 200px;
            box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
            position: relative;
            overflow: hidden;
          }

          .code-box::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            animation: shine 2s infinite;
          }

          @keyframes shine {
            0% { left: -100%; }
            100% { left: 100%; }
          }

          .expiry-notice {
            background: linear-gradient(135deg, #fff3cd, #ffeaa7);
            border: 1px solid #f39c12;
            border-radius: 12px;
            padding: 16px 20px;
            margin: 32px 0;
            font-size: 14px;
            color: #d68910;
            text-align: center;
            font-weight: 500;
          }

          .security-note {
            font-size: 15px;
            color: #6c757d;
            margin-top: 32px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
            border-left: 4px solid #17a2b8;
          }

          .signature {
            margin-top: 48px;
            font-size: 16px;
            color: #2c3e50;
            font-weight: 500;
          }

          .footer {
            text-align: center;
            font-size: 13px;
            color: #95a5a6;
            padding: 32px 40px;
            background: #f8f9fa;
            border-top: 1px solid #e9ecef;
          }

          .footer a {
            color: #667eea;
            text-decoration: none;
          }

          .footer a:hover {
            text-decoration: underline;
          }

          .social-links {
            margin-top: 16px;
          }

          .social-links a {
            display: inline-block;
            margin: 0 8px;
            padding: 8px;
            border-radius: 50%;
            background: #e9ecef;
            color: #6c757d;
            text-decoration: none;
            transition: all 0.3s ease;
          }

          .social-links a:hover {
            background: #667eea;
            color: #ffffff;
            transform: translateY(-2px);
          }

          @media (max-width: 600px) {
            .email-wrapper {
              padding: 20px 10px;
            }

            .container {
              margin: 0;
              border-radius: 16px;
            }

            .header {
              padding: 32px 24px;
            }

            .header h1 {
              font-size: 28px;
            }

            .content {
              padding: 32px 24px;
            }

            .code-box {
              font-size: 28px;
              letter-spacing: 4px;
              padding: 20px 24px;
            }

            .footer {
              padding: 24px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset</h1>
              <p class="subtitle">Secure verification code inside</p>
            </div>
            <div class="content">
              <p class="greeting">Hello there! 👋</p>
              <p class="message">
                We received a request to reset your password. No worries – it happens to the best of us! 
                Use the verification code below to continue with your password reset:
              </p>

              <div class="code-container">
                <div class="code-label">Verification Code</div>
                <div class="code-box">${code}</div>
              </div>

              <div class="expiry-notice">
                ⏰ This code will expire in 5 minutes for your security
              </div>

              <div class="security-note">
                <strong>🛡️ Security Note:</strong> If you did not request this password reset, 
                you can safely ignore this email. Your account remains secure and no changes have been made.
              </div>

              <p class="signature">
                Best regards,<br>
                <strong>The Security Team</strong> 💙
              </p>
            </div>
            <div class="footer">
              <p>© 2024 Your Company Name. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

const passwordResetConfirmationEmail = async () => {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Email Verification</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          
          body {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            margin: 0;
            padding: 0;
            font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
          }
          
          .email-wrapper {
            padding: 40px 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .container {
            max-width: 600px;
            width: 100%;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1);
            position: relative;
          }
          
          .container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #4f46e5, #7c3aed, #ec4899, #f59e0b, #10b981);
            background-size: 300% 100%;
            animation: gradientShift 6s ease-in-out infinite;
          }
          
          @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          
          .header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            padding: 48px 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              rgba(255, 255, 255, 0.03) 10px,
              rgba(255, 255, 255, 0.03) 20px
            );
            animation: float 20s linear infinite;
          }
          
          @keyframes float {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
          }
          
          .header h1 {
            color: #ffffff;
            font-size: 32px;
            font-weight: 600;
            margin: 0;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            position: relative;
            z-index: 2;
          }
          
          .header .subtitle {
            color: rgba(255, 255, 255, 0.9);
            font-size: 16px;
            font-weight: 300;
            margin: 8px 0 0 0;
            position: relative;
            z-index: 2;
          }
          
          .content {
            padding: 48px 40px;
            color: #2c3e50;
            background: #ffffff;
            position: relative;
          }
          
          .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #2c3e50;
            margin-bottom: 24px;
          }
          
          .message {
            font-size: 16px;
            color: #5a6c7d;
            margin-bottom: 32px;
            line-height: 1.7;
          }

          .success-message {
            background: linear-gradient(135deg, #d4edda, #c3e6cb);
            border: 1px solid #28a745;
            border-radius: 12px;
            padding: 20px;
            margin: 32px 0;
            text-align: center;
            font-weight: 500;
            color: #155724;
          }

          .success-checkmark {
            font-size: 24px;
            margin-right: 8px;
            color: #28a745;
          }

          .security-alert {
            background: linear-gradient(135deg, #fff3cd, #ffeaa7);
            border: 1px solid #f39c12;
            border-radius: 12px;
            padding: 20px;
            margin: 32px 0;
            font-size: 15px;
            color: #856404;
            border-left: 4px solid #ffc107;
          }

          .code-container {
            text-align: center;
            margin: 40px 0;
          }
          
          @keyframes shine {
            0% { left: -100%; }
            100% { left: 100%; }
          }
          
          .expiry-notice {
            background: linear-gradient(135deg, #fff3cd, #ffeaa7);
            border: 1px solid #f39c12;
            border-radius: 12px;
            padding: 16px 20px;
            margin: 32px 0;
            font-size: 14px;
            color: #d68910;
            text-align: center;
            font-weight: 500;
          }
          
          .security-note {
            font-size: 15px;
            color: #6c757d;
            margin-top: 32px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
            border-left: 4px solid #17a2b8;
          }
          
          .signature {
            margin-top: 48px;
            font-size: 16px;
            color: #2c3e50;
            font-weight: 500;
          }
          
          .footer {
            text-align: center;
            font-size: 13px;
            color: #95a5a6;
            padding: 32px 40px;
            background: #f8f9fa;
            border-top: 1px solid #e9ecef;
          }
          
          .footer a {
            color: #4f46e5;
            text-decoration: none;
          }
          
          .footer a:hover {
            text-decoration: underline;
          }
          
          .social-links {
            margin-top: 16px;
          }
          
          .social-links a {
            display: inline-block;
            margin: 0 8px;
            padding: 8px;
            border-radius: 50%;
            background: #e9ecef;
            color: #6c757d;
            text-decoration: none;
            transition: all 0.3s ease;
          }
          
          .social-links a:hover {
            background: #4f46e5;
            color: #ffffff;
            transform: translateY(-2px);
          }
          
          @media (max-width: 600px) {
            .email-wrapper {
              padding: 20px 10px;
            }
            
            .container {
              margin: 0;
              border-radius: 16px;
            }
            
            .header {
              padding: 32px 24px;
            }
            
            .header h1 {
              font-size: 28px;
            }
            
            .content {
              padding: 32px 24px;
            }
            
            .code-box {
              font-size: 28px;
              letter-spacing: 4px;
              padding: 20px 24px;
            }
            
            .footer {
              padding: 24px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <h1>🔒 Password Changed Successfully!</h1>
              <p class="subtitle">Your account is now secure</p>
            </div>
            <div class="content">
              <p class="greeting">Hello! 👋</p>
              <p class="message">
                Great news! Your password has been successfully updated. Your account is now secured with your new password.
              </p>

              <div class="success-message">
                <span class="success-checkmark">✅</span>
                Password reset completed successfully!
              </div>

              <div class="security-alert">
                <strong>⚠️ Important Security Notice:</strong> If you did not perform this password change, 
                please contact our support team immediately. This could indicate unauthorized access to your account.
              </div>

              <p class="signature">
                Stay secure,<br>
                <strong>The Security Team</strong> 🔐
              </p>
            </div>
            <div class="footer">
              <p>© 2024 Your Company Name. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

const generateStoryEmail = async (storyContent) => {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);">
        <h2 style="color: #333333; text-align: center;">✨ Your Story Is Here ✨</h2>
        <p style="font-size: 16px; color: #555555;">We're thrilled to share your beautifully enhanced story:</p>
        <div style="margin-top: 20px; font-size: 15px; line-height: 1.6; color: #444444;">
          ${storyContent}
        </div>
        <p style="margin-top: 30px; font-size: 14px; color: #888888;">Thanks for sharing your journey with us. ❤️</p>
      </div>
    </div>
  `;
};

const checkoutSuccessEmail = async (planName, startDate, expiryDate) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Checkout Successful</title>
      <style>
        body {
          font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #f4f4f7;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 10px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
          overflow: hidden;
        }
        .header {
          background-color: #10b981;
          color: white;
          padding: 24px;
          text-align: center;
        }
        .content {
          padding: 32px;
          color: #333333;
        }
        .highlight {
          background-color: #ecfdf5;
          padding: 12px 16px;
          border-radius: 8px;
          margin: 16px 0;
          color: #065f46;
          font-weight: bold;
          text-align: center;
        }
        .footer {
          padding: 24px;
          text-align: center;
          font-size: 14px;
          color: #888;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Checkout Successful!</h1>
        </div>
        <div class="content">
          <p>Hi there,</p>
          <p>Thank you for your purchase! Your plan has been activated successfully.</p>
          <div class="highlight">
            Plan: ${planName}<br />
            Start Date: ${new Date(startDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}<br />
            Expiry Date: ${new Date(expiryDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
          <p>We’re excited to have you on board. If you have any questions, feel free to reach out to our support team.</p>
          <p style="margin-top: 32px;">— The Team</p>
        </div>
        <div class="footer">
          © All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
};

const bookCartAddedEmail = async ({ bookTitle, quantity, totalPrice, currency }) => {
  const priceLabel =
    totalPrice != null && Number.isFinite(Number(totalPrice))
      ? `${currency || "USD"} ${Number(totalPrice).toFixed(2)}`
      : "Pending checkout";
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Book Added to Cart</title>
    </head>
    <body style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.05);">
        <div style="background-color: #457B9D; color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">Book Added to Your Cart</h1>
        </div>
        <div style="padding: 32px; color: #333333;">
          <p>Hi there,</p>
          <p>Your book has been added to your cart and is ready for checkout.</p>
          <div style="background-color: #F1FAEE; padding: 12px 16px; border-radius: 8px; margin: 16px 0; color: #1D3557;">
            <strong>Book:</strong> ${bookTitle || "My Keepsake Book"}<br />
            <strong>Quantity:</strong> ${quantity || 1}<br />
            <strong>Estimated total:</strong> ${priceLabel}
          </div>
          <p>Visit your cart to complete payment and send your book to print.</p>
          <p style="margin-top: 32px;">— Capturing Story Gems</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const bookPaymentSuccessEmail = async ({ bookTitle, amount, currency }) => {
  const priceLabel =
    amount != null && Number.isFinite(Number(amount))
      ? `${(currency || "usd").toUpperCase()} ${Number(amount).toFixed(2)}`
      : "Paid";
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Book Payment Successful</title>
    </head>
    <body style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.05);">
        <div style="background-color: #10b981; color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">Payment Successful</h1>
        </div>
        <div style="padding: 32px; color: #333333;">
          <p>Hi there,</p>
          <p>We've received your payment for your printed book order.</p>
          <div style="background-color: #ecfdf5; padding: 12px 16px; border-radius: 8px; margin: 16px 0; color: #065f46;">
            <strong>Book:</strong> ${bookTitle || "My Keepsake Book"}<br />
            <strong>Amount paid:</strong> ${priceLabel}
          </div>
          <p>You can now return to your cart and click <strong>Send to Print</strong> to submit your book for printing.</p>
          <p style="margin-top: 32px;">— Capturing Story Gems</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const bookSentToLuluEmail = async ({ bookTitle, printJobId, quantity }) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Book Sent to Print</title>
    </head>
    <body style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.05);">
        <div style="background-color: #1D3557; color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">Your Book Was Sent to Print</h1>
        </div>
        <div style="padding: 32px; color: #333333;">
          <p>Hi there,</p>
          <p>Great news — your book has been submitted to our print partner (Lulu).</p>
          <div style="background-color: #F1FAEE; padding: 12px 16px; border-radius: 8px; margin: 16px 0; color: #1D3557;">
            <strong>Book:</strong> ${bookTitle || "My Keepsake Book"}<br />
            <strong>Quantity:</strong> ${quantity || 1}<br />
            ${printJobId ? `<strong>Print job ID:</strong> ${printJobId}<br />` : ""}
          </div>
          <p>We'll email you again when we receive status updates from the printer.</p>
          <p style="margin-top: 32px;">— Capturing Story Gems</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const bookPrintStatusEmail = async ({ bookTitle, status, printJobId }) => {
  const statusLabel = status ? String(status).replace(/_/g, " ") : "updated";
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Print Status Update</title>
    </head>
    <body style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.05);">
        <div style="background-color: #457B9D; color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">Print Status Update</h1>
        </div>
        <div style="padding: 32px; color: #333333;">
          <p>Hi there,</p>
          <p>We received an update on your printed book order.</p>
          <div style="background-color: #F1FAEE; padding: 12px 16px; border-radius: 8px; margin: 16px 0; color: #1D3557;">
            <strong>Book:</strong> ${bookTitle || "My Keepsake Book"}<br />
            <strong>Status:</strong> ${statusLabel}<br />
            ${printJobId ? `<strong>Print job ID:</strong> ${printJobId}<br />` : ""}
          </div>
          <p>You can also check the latest status in your cart.</p>
          <p style="margin-top: 32px;">— Capturing Story Gems</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const supportRequestEmail = async (name, email, message) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Support Request Email</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f4f4f4;
        }
        .email-container {
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 300;
        }
        .header p {
          margin: 10px 0 0 0;
          opacity: 0.9;
          font-size: 14px;
        }
        .content {
          padding: 30px;
        }
        .form-field {
          margin-bottom: 25px;
          border-left: 4px solid #667eea;
          padding-left: 15px;
        }
        .field-label {
          font-weight: 600;
          color: #555;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
          display: block;
        }
        .field-value {
          font-size: 16px;
          color: #333;
          line-height: 1.5;
          word-wrap: break-word;
        }
        .message-field {
          background-color: #f8f9fa;
          border-radius: 4px;
          padding: 15px;
          border: 1px solid #e9ecef;
        }
        .timestamp {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          margin-top: 20px;
          font-size: 14px;
          color: #666;
          text-align: center;
        }
        .footer {
          background-color: #f8f9fa;
          padding: 20px;
          text-align: center;
          border-top: 1px solid #e9ecef;
        }
        .footer p {
          margin: 0;
          font-size: 14px;
          color: #666;
        }
        .priority-badge {
          display: inline-block;
          background-color: #28a745;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        @media (max-width: 600px) {
          body {
              padding: 10px;
          }
          .content {
              padding: 20px;
          }
          .header {
              padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>New Support Request Email</h1>
          <p>A customer has reached out through your website</p>
        </div>
        <div class="content">
          <div style="margin-bottom: 20px;">
            <span class="priority-badge">New Inquiry</span>
          </div>
          <div class="form-field">
            <span class="field-label">Customer Name</span>
            <div class="field-value">${name}</div>
          </div>
          <div class="form-field">
            <span class="field-label">Email Address</span>
            <div class="field-value">
              <a href="mailto:${email}" style="color: #667eea; text-decoration: none;">
                ${email}
              </a>
            </div>
          </div>
          <div class="form-field">
            <span class="field-label">Message</span>
            <div class="field-value message-field">
              ${message}
            </div>
          </div>
        </div>
        <div class="footer">
          <p><strong>Help Desk System</strong> | Please respond within 24 hours</p>
          <p style="margin-top: 10px; font-size: 12px; color: #999;">
            This message was automatically generated from your website contact form.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  signupEmail,
  resendOtpEmail,
  forgotPasswordEmail,
  passwordResetConfirmationEmail,
  generateStoryEmail,
  checkoutSuccessEmail,
  bookCartAddedEmail,
  bookPaymentSuccessEmail,
  bookSentToLuluEmail,
  bookPrintStatusEmail,
  supportRequestEmail,
};
