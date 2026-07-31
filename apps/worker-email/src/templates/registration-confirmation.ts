/**
 * Registration Confirmation Email Template
 * Variables: {{userName}}, {{eventName}}, {{eventDate}}, {{eventVenue}}, {{qrCodeUrl}}, {{ticketType}}
 */

export const registrationConfirmationHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>参加登録完了</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e5e7eb;
    }
    .header h1 {
      font-size: 24px;
      color: #111;
      margin: 0;
    }
    .success-badge {
      display: inline-block;
      background-color: #10b981;
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 14px;
      margin-top: 8px;
    }
    .details {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 16px;
      margin: 16px 0;
    }
    .details dt {
      font-weight: 600;
      color: #6b7280;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 12px;
    }
    .details dt:first-child {
      margin-top: 0;
    }
    .details dd {
      margin: 4px 0 0 0;
      font-size: 16px;
      color: #111;
    }
    .qr-section {
      text-align: center;
      margin: 24px 0;
      padding: 20px;
      background-color: #f0f9ff;
      border-radius: 6px;
      border: 1px dashed #3b82f6;
    }
    .qr-section p {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #1e40af;
    }
    .qr-link {
      display: inline-block;
      background-color: #3b82f6;
      color: white;
      padding: 10px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
    }
    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #9ca3af;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>参加登録完了</h1>
      <div class="success-badge">登録が確認されました</div>
    </div>

    <p>{{userName}} さん、</p>
    <p>以下のイベントへの参加登録が完了しました。</p>

    <div class="details">
      <dl>
        <dt>イベント名</dt>
        <dd>{{eventName}}</dd>
        <dt>日時</dt>
        <dd>{{eventDate}}</dd>
        <dt>会場</dt>
        <dd>{{eventVenue}}</dd>
        <dt>チケット</dt>
        <dd>{{ticketType}}</dd>
      </dl>
    </div>

    <div class="qr-section">
      <p>当日は受付でQRコードを提示してください</p>
      <a href="{{qrCodeUrl}}" class="qr-link">QRコードを表示する</a>
    </div>

    <p>ご質問がある場合は、このメールに返信してお問い合わせください。</p>

    <div class="footer">
      <p>Event Platform - イベント管理プラットフォーム</p>
      <p>このメールは自動送信されています</p>
    </div>
  </div>
</body>
</html>`;

export const registrationConfirmationText = `参加登録完了

{{userName}} さん、

以下のイベントへの参加登録が完了しました。

---
イベント名: {{eventName}}
日時: {{eventDate}}
会場: {{eventVenue}}
チケット: {{ticketType}}
---

当日は受付でQRコードを提示してください。
QRコードURL: {{qrCodeUrl}}

ご質問がある場合は、このメールに返信してお問い合わせください。

---
Event Platform - イベント管理プラットフォーム
このメールは自動送信されています
`;
