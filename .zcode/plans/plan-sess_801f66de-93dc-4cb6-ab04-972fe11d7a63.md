## خطة: دفع الطلب من المحفظة (Wallet Payment at Checkout)

المطلوب: لما العميل يكون معاه رصيد في محفظة المطعم وييجي يعمل طلب، التطبيق يعرضله رصيده ويخليه يختار "ادفع بالمحفظة"، ويخصم من رصيده تلقائياً. ولو الطلب اتلغى/اترفض، الرصيد يرجعله.

**القرارات المعمارية (متفق عليها):**
- الرصيد **مرتبط بكل مطعم** (per-tenant) — الـ schema الحالي بيدعمه طبيعياً.
- **بالكامل بس** — مفيش دفع جزئي؛ لو الرصيد أقل من الإجمالي نخفي/نعطّل الخيار.
- **نعم نرجّع الرصيد** عند cancellation/rejection.

---

### الجزء 1: قاعدة البيانات (SQL) — 3 تغييرات

#### 1.1 دالة خصم آمنة `SECURITY DEFINER` (لبّ الموضوع)

سبب ضرورتها: سياسة RLS الحالية بتمنع العميل من إدراج صفوف في `wallet_transactions` (الإدراج متاح لصاحب المطعم/super admin بس). وعشان نتجنب ظروف التزامن (race conditions) — عميلان يطلبا في نفس اللحظة — لازم الفحص والخصم يحصلوا ذرّياً (atomic) في معاملة (transaction) واحدة على الـ DB.

دالة جديدة `pay_order_with_wallet(p_order_id uuid)`:
- `SECURITY DEFINER` عشان تتخطى الـ RLS.
- بتقرأ الـ order (customer_id, tenant_id, total_iqd, payment_method).
- بتتأكد إن `payment_method = 'wallet'` ومش متخصم قبل كده (عشان مننشأش صف خصم مرتين).
- بتفرز الرصيد per-tenant: `SUM(amount) FILTER(type='credit') - SUM(amount) FILTER(type='debit' AND user_id=customer)`.
- لو الرصيد ≥ `total_iqd`: تدرج صف `debit` في `wallet_transactions` (order_id، note "دفع طلب #...")، وتحدّث `orders.payment_collected = true`، وترجع success.
- لو الرصيد غير كافٍ: ترجع خطأ واضح.
- هتتركب في migration جديد + تتعملها `mirror` في `setup_full_database.sql`.

#### 1.2 Trigger استرجاع الرصيد عند الإلغاء/الرفض

`refund_wallet_on_cancel()` trigger `AFTER UPDATE` على `orders`:
- لو الـ status بقت `cancelled` أو `rejected` (ومكانتش كده قبل كده)، والـ `payment_method = 'wallet'`.
- ندرج صف `credit` معاد في `wallet_transactions` (note "استرجاع طلب #..."، order_id).
- نمنع التكرار بـ `EXISTS` check على صف `debit` موجود + صف refund عمره ما اتسجّل قبل كده للطلب ده.

#### 1.3 فهرس (index) للتسريع
`CREATE INDEX IF NOT EXISTS wallet_txn_user_tenant ON wallet_transactions(user_id, tenant_id, type);` عشان حساب الرصيد يبقى سريع مع نمو البيانات.

---

### الجزء 2: الواجهة — `src/routes/r.$slug.tsx`

#### 2.1 جلب رصيد العميل لهذا المطعم
- لما العميل يكون مسجّل دخول، نعمل `useQuery` جديد بمفتاح `["wallet-balance", tenantId, userId]` بيجيب آخر صفوف `wallet_transactions` الخاصة بهذا الـ tenant + هذا العميل، ونحسب الرصيد per-tenant (مش كل الـ tenants زي صفحة المحفظة الحالية).
- أو نقدر نضيف دالة `get_wallet_balance(p_tenant, p_user)` في الـ DB ونعملها `.rpc()` — أبسط وأدق. هفضل الـ RPC.

#### 2.2 اختيار طريقة الدفع (UI)
- نضيف `state`: `const [paymentMethod, setPaymentMethod] = useState<"cash" | "wallet">("cash")`.
- في فورم الـ checkout (بعد حقل الملاحظات، ~line 726)، نضيف قسم "طريقة الدفع" بزري اختيار:
  - **نقداً (كاش)** — افتراضي.
  - **من المحفظة** — متاح بس لو `walletBalance ≥ grandTotal`. نظهر الرصيد جنبه (`رصيدك: X د.ع`)، ولو غير كافٍ نظهره معطّل + رسالة "رصيدك غير كافي".

#### 2.3 تعديل `placeOrder` (line 343)
- نحط `payment_method: paymentMethod` بدل التثبيت `"cash"` (line 404).
- بعد ما الـ order يتخلق بنجاح (line 410)، لو `paymentMethod === "wallet"`: ننادي `supabase.rpc("pay_order_with_wallet", { p_order_id: created.id })`.
  - لو رجعت خطأ (رصيد نقص فجأة بين العرض والدفع — نادر): نلغي الطلب (نحذفه أو نحدّث payment_method لـ cash) ونظهر رسالة خطأ مناسبة.
  - لو نجحت: نعمل `invalidate` لـ `wallet-balance` عشان الـ UI يتحدّث.

#### 2.4 تحديث نص الإجمالي
- نغيّر "الإجمالي (نقداً)" (line 736) لـ "الإجمالي" فقط، أو نظهر طريقة الدفع المختارة ديناميكياً.

---

### الجزء 3: ملفات التنفيذ

1. **`supabase/migrations/<ts>_wallet_payment.sql`** (جديد) — فيه:
   - `pay_order_with_wallet` function + grant.
   - `refund_wallet_on_cancel` function + trigger.
   - الفهرس.
2. **`supabase/setup_full_database.sql`** (تعديل) — نفس المحتوى mirror.
3. **`src/routes/r.$slug.tsx`** (تعديل) — جلب الرصيد + UI الاختيار + تعديل placeOrder.

---

### أمان وصحة (حوادث طرفية)
- **Race condition**: الـ RPC بتشتغل في transaction ذرّي → آمنة.
- **رفض مزدوج للرصيد**: الـ trigger بيتأكد بـ EXISTS إن مفيش refund اتسجّل قبل كده.
- **عميل اختار محفظة وبعدين اتغيّر السلة**: الرصيد بيتتحكّم وقت الـ submit من الـ DB، فلو النص كمل فعلاً الـ DB هيرفض والطلب هيتلغي.
- **الـ type drift** (`wallet_transactions.id` typed كـ `number` في `types.ts` بس `uuid` في الـ DB): مش هألمسه في الميزة دي عشان خارج نطاقها، بس ممكن أصلحه كمان لو حابب.

---

### خطوات التنفيذ بعد الموافقة
1. أكتب ملف الـ migration (الـ functions + trigger + index).
2. أعمل mirror في `setup_full_database.sql`.
3. أعدّل `r.$slug.tsx`: جلب الرصيد + UI الاختيار + منطق `placeOrder`.
4. أعمل لك تعليمات SQL للـ Supabase SQL Editor عشان تطبّق الـ functions على الـ DB الحي زي ما عملنا في bug المحفظة قبل كده.

---

**ملاحظة:** دي ميزة فيها تعديل DB + UI. عايزك توافق على الخطة الأول قبل ما أبدأ أكتب. لو في أي حاجة عايز تغيّرها (مثلاً طريقة عرض اختيار الدفع، أو تحب نحط حد أدنى للطلب بالمحفظة) قولي.