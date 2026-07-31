/**
 * Notification Worker
 * Processes notification jobs from the queue and delivers them
 */
export interface NotificationJob {
  userId: string;
  type: 'push' | 'in_app';
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface Env {
  NOTIFICATION_DB: D1Database;
}

export default {
  async queue(batch: MessageBatch<NotificationJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const notification = message.body;

        // Store notification in D1
        await env.NOTIFICATION_DB.prepare(
          `INSERT INTO notifications (user_id, type, title, body, data, created_at, read_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL)`
        )
          .bind(
            notification.userId,
            notification.type,
            notification.title,
            notification.body,
            notification.data ? JSON.stringify(notification.data) : null,
            new Date().toISOString()
          )
          .run();

        // If push notification, send via push service
        if (notification.type === 'push') {
          await sendPushNotification(notification, env);
        }

        console.log(`Notification sent to user: ${notification.userId}`);
      } catch (error) {
        console.error('Error processing notification:', error);
      }
    }
  },
};

async function sendPushNotification(notification: NotificationJob, env: Env): Promise<void> {
  // Placeholder for push notification delivery
  // Will integrate with Web Push API or third-party service
  console.log(`Push notification: ${notification.title} - ${notification.body}`);
}
