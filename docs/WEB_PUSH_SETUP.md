# تفعيل Push Notifications

الإشعارات الخارجية تحتاج مفاتيح VAPID وخدمة إرسال آمنة؛ لا تضع المفتاح الخاص في المتصفح أو في Git.

1. أنشئ المفاتيح مرة واحدة: `npx web-push generate-vapid-keys`.
2. اضبط أسرار Supabase: `VAPID_PUBLIC_KEY` و`VAPID_PRIVATE_KEY` و`VAPID_SUBJECT` و`WEB_PUSH_WEBHOOK_SECRET`. التطبيق يجلب المفتاح العام تلقائياً من الدالة، ولا يحتاج متغير بيئة في الاستضافة.
3. انشر الدالة: `supabase functions deploy send-web-push --no-verify-jwt`.
4. شغّل migration `configure_web_push_dispatch`: ينشئ trigger آمنًا يستخدم `pg_net` وSupabase Vault لإرسال كل صف جديد في `notification_queue` إلى الدالة تلقائيًا. لا تنشئ Database Webhook يدويًا حتى لا يتكرر الإرسال.

بعدها يضغط المستخدم «تفعيل إشعارات خارج التطبيق» مرة واحدة من جرس الإشعارات. الإشعارات ستصل حتى لو كانت الصفحة مغلقة، ما دام التطبيق/المتصفح يسمحان بالإشعارات.
