# تفعيل Push Notifications

الإشعارات الخارجية تحتاج مفاتيح VAPID وخدمة إرسال آمنة؛ لا تضع المفتاح الخاص في المتصفح أو في Git.

1. أنشئ المفاتيح مرة واحدة: `npx web-push generate-vapid-keys`.
2. أضف المفتاح العام إلى بيئة بناء الواجهة باسم `VITE_WEB_PUSH_PUBLIC_KEY` ثم أعد نشر الواجهة.
3. اضبط أسرار Supabase: `VAPID_PUBLIC_KEY` و`VAPID_PRIVATE_KEY` و`VAPID_SUBJECT` و`WEB_PUSH_WEBHOOK_SECRET`.
4. انشر الدالة: `supabase functions deploy send-web-push --no-verify-jwt`.
5. من Supabase Dashboard > Database > Webhooks أنشئ Webhook لحدث `INSERT` على جدول `notification_queue` إلى `https://<project-ref>.supabase.co/functions/v1/send-web-push`، وأضف Header باسم `x-webhook-secret` وقيمته نفس `WEB_PUSH_WEBHOOK_SECRET`.

بعدها يضغط المستخدم «تفعيل إشعارات خارج التطبيق» مرة واحدة من جرس الإشعارات. الإشعارات ستصل حتى لو كانت الصفحة مغلقة، ما دام التطبيق/المتصفح يسمحان بالإشعارات.
