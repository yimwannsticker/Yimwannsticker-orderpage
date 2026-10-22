# คู่มือติดตั้งระบบสั่งพิมพ์ Yimwann Sticker (ทีละขั้นตอน)

ใช้เวลาประมาณ 1–1.5 ชั่วโมง ทำบนคอมพิวเตอร์จะง่ายกว่ามือถือ
ชื่อเมนูในเว็บผู้ให้บริการอาจเปลี่ยนเล็กน้อย ถ้าหาไม่เจอให้มองหาคำที่ใกล้เคียง

ลำดับ: **เตรียมตัว → Supabase → Cloudflare R2 → Netlify → กลับไปตั้งค่าที่เหลือ → ทดสอบ**
(ต้องได้ลิงก์เว็บจาก Netlify ก่อน ถึงจะตั้งค่าบางส่วนของ Supabase และ R2 ให้เสร็จได้)

---

## ขั้นที่ 0: เตรียมตัว

1. เปิดไฟล์โน้ตว่างไว้ 1 ไฟล์ (เช่น Notes หรือ Notepad) สำหรับจดค่าต่างๆ ระหว่างทาง **ห้ามส่งค่าพวกนี้ให้ใคร**
2. สร้างรหัสลับแบบสุ่ม 2 ชุด ยาวอย่างน้อย 40 ตัวอักษร (ใช้ตัวสร้างรหัสผ่านของมือถือ/เบราว์เซอร์ หรือเว็บสร้างรหัสผ่านก็ได้) จดไว้เป็น
   - `APP_SECRET` = ชุดที่ 1
   - `CRON_SECRET` = ชุดที่ 2
3. เตรียมอีเมลที่จะใช้ล็อกอินหลังบ้าน (เช่น อีเมลร้าน)

---

## ขั้นที่ 1: Supabase (ฐานข้อมูล + ล็อกอินหลังบ้าน)

### 1.1 สร้างโปรเจกต์
1. เข้า https://supabase.com → **Start your project** → สมัครด้วย GitHub หรืออีเมล
2. กด **New project**
   - Organization: ใช้อันที่ระบบสร้างให้
   - Project name: `yimwann-sticker`
   - Database Password: กด **Generate a password** แล้ว **จดไว้** (ไม่ได้ใช้ในเว็บ แต่ต้องใช้ถ้าจะกู้ระบบ)
   - Region: **Southeast Asia (Singapore)**
   - Plan: **Free**
3. กด **Create new project** แล้วรอประมาณ 2 นาที

### 1.2 สร้างตารางฐานข้อมูล
ต้องรันไฟล์ทั้งหมด 5 ไฟล์ **ตามลำดับ**:
`0001_init.sql` → `0002_reorder.sql` → `0003_lookup_attempts.sql` → `0004_sticker_size.sql` → `0005_heartbeat.sql` → `0006_trim.sql`

ทำทีละไฟล์:
1. เปิด GitHub repo ของร้าน → เปลี่ยน branch เป็น `claude/sticker-order-app` → เข้าโฟลเดอร์ `supabase/migrations` → คลิกชื่อไฟล์
2. กดปุ่ม **Copy raw file** (ไอคอนคัดลอกมุมขวาบนของเนื้อหาไฟล์)
3. กลับมาที่ Supabase → เมนูซ้าย **SQL Editor** → **New query**
4. วางโค้ด → กด **Run** (หรือ Ctrl+Enter)
5. ต้องขึ้น **Success. No rows returned** ถ้าขึ้นสีแดง ให้แคปหน้าจอเก็บไว้แล้วหยุดก่อน
6. ทำซ้ำกับไฟล์ถัดไปจนครบ 5 ไฟล์

ตรวจสอบ: เมนู **Table Editor** ต้องเห็นตาราง `orders`, `order_items`, `customers`, `settings`, `staff`, `uploads`, `lookup_attempts`, `app_heartbeat`

### 1.3 สร้างบัญชีแอดมิน
1. เมนูซ้าย **Authentication** → **Users** → **Add user** → **Create new user**
2. ใส่อีเมลและรหัสผ่านที่จะใช้เข้าหลังบ้าน
3. ติ๊ก **Auto Confirm User** → **Create user**
4. จดอีเมลนี้ไว้เป็น `ADMIN_EMAILS`

### 1.4 คัดลอก key
1. เมนูซ้าย **Project Settings** (รูปเฟือง) → **API Keys** (หรือ **API**)
2. จดค่าเหล่านี้:
   - **Project URL** (หน้า Data API หรือ API) เช่น `https://abcdxyz.supabase.co` → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** หรือ **Publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** หรือ **Secret key** (กด Reveal) → `SUPABASE_SERVICE_ROLE_KEY`
     ⚠️ ตัวนี้มีสิทธิ์เต็มฐานข้อมูล ห้ามส่งให้ใคร ห้ามแปะในแชท

> ขั้น 1.5 (ตั้งค่าลิงก์ล็อกอิน) ทำหลังได้ลิงก์เว็บจาก Netlify ในขั้นที่ 4

---

## ขั้นที่ 2: Cloudflare R2 (เก็บไฟล์งานและสลิป)

### 2.1 เปิดใช้ R2
1. เข้า https://dash.cloudflare.com/sign-up → สมัครด้วยอีเมล → ยืนยันอีเมล
2. เมนูซ้าย **R2 Object Storage** (หรือ Storage & Databases → R2)
3. กด **Purchase R2 Plan** / **Add R2 subscription** → ผูกบัตรเครดิต/เดบิต
   (แพ็กเกจฟรีเก็บได้ 10 GB ไม่คิดเงินถ้าไม่เกิน)
4. ในหน้า R2 Overview จะเห็น **Account ID** (มุมขวา) → จดไว้เป็น `R2_ACCOUNT_ID`

### 2.2 สร้าง bucket
1. กด **Create bucket**
2. Bucket name: `yimwann-files` → จดไว้เป็น `R2_BUCKET`
3. Location: **Automatic** (หรือ Asia-Pacific)
4. Default storage class: **Standard**
5. กด **Create bucket**
6. **ไม่ต้อง**เปิด Public access (ปล่อยเป็น private)

### 2.3 สร้าง API token
1. กลับหน้า R2 Overview → **Manage API Tokens** (หรือ API → Manage API tokens)
2. **Create API token** (เลือกแบบ Account API token)
   - Token name: `yimwann-web`
   - Permissions: **Object Read & Write**
   - Specify bucket(s): **Apply to specific buckets only** → เลือก `yimwann-files`
   - TTL: Forever
3. กด **Create API Token**
4. จดค่าเหล่านี้ (**แสดงครั้งเดียว** ถ้าปิดหน้าไปต้องสร้างใหม่):
   - **Access Key ID** → `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → `R2_SECRET_ACCESS_KEY`

> ขั้น 2.4 (CORS) ทำหลังได้ลิงก์เว็บจาก Netlify ในขั้นที่ 4

---

## ขั้นที่ 3: Netlify (ตัวเว็บ)

### 3.1 นำเว็บขึ้น Netlify
1. เข้า https://app.netlify.com/signup → **Sign up with GitHub**
2. กด **Add new project** (หรือ Add new site) → **Import an existing project** → **GitHub**
3. อนุญาตให้ Netlify เข้าถึง repo `Yimwannsticker-orderpage`
4. หน้าตั้งค่า:
   - **Branch to deploy**: `claude/sticker-order-app`
   - Build command / Publish directory: ปล่อยตามที่ขึ้นมา (อ่านจาก `netlify.toml` อัตโนมัติ)
   - Project name: `yimwann-sticker` (จะได้ลิงก์ `https://yimwann-sticker.netlify.app` ถ้าชื่อซ้ำให้เปลี่ยนเล็กน้อย)
5. **ยังไม่ต้องกด Deploy** ให้ใส่ Environment variables ก่อน (ข้อ 3.2) ถ้าเผลอ deploy ไปแล้วไม่เป็นไร ใส่ทีหลังแล้ว deploy ใหม่ได้

### 3.2 ใส่ Environment variables
ในหน้าเดียวกันกด **Add environment variables** (หรือหลังสร้างแล้วไปที่ **Project configuration → Environment variables → Add a variable**)

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | จากข้อ 1.4 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | จากข้อ 1.4 |
| `SUPABASE_SERVICE_ROLE_KEY` | จากข้อ 1.4 |
| `R2_ACCOUNT_ID` | จากข้อ 2.1 |
| `R2_ACCESS_KEY_ID` | จากข้อ 2.3 |
| `R2_SECRET_ACCESS_KEY` | จากข้อ 2.3 |
| `R2_BUCKET` | `yimwann-files` |
| `NEXT_PUBLIC_SITE_URL` | `https://yimwann-sticker.netlify.app` (ลิงก์จริงของเว็บ ไม่มี / ท้าย) |
| `APP_SECRET` | จากขั้นที่ 0 |
| `CRON_SECRET` | จากขั้นที่ 0 |
| `ADMIN_EMAILS` | อีเมลแอดมินจากข้อ 1.3 |

### 3.3 Deploy
1. กด **Deploy** แล้วรอ 3–5 นาที
2. ดูความคืบหน้าที่เมนู **Deploys** ต้องขึ้น **Published** สีเขียว
3. ถ้าขึ้น **Failed** ให้กดเข้าไปดู log แล้วแคปส่วนที่เป็นสีแดงเก็บไว้
4. ถ้าลิงก์จริงไม่ตรงกับที่ใส่ใน `NEXT_PUBLIC_SITE_URL` ให้แก้ค่าแล้วกด **Deploys → Trigger deploy → Clear cache and deploy site**
   (ค่าที่ขึ้นต้นด้วย `NEXT_PUBLIC_` จะมีผลหลัง deploy ใหม่เท่านั้น)

---

## ขั้นที่ 4: ตั้งค่าที่ต้องใช้ลิงก์เว็บ

### 4.1 Supabase: ลิงก์ล็อกอิน (ต่อจากข้อ 1.4)
1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL**: `https://yimwann-sticker.netlify.app`
3. **Redirect URLs** → **Add URL**: `https://yimwann-sticker.netlify.app/admin/auth/callback` → Save

### 4.2 Cloudflare R2: CORS (ต่อจากข้อ 2.3)
ถ้าข้ามขั้นนี้ ลูกค้าจะอัปโหลดไฟล์ไม่ได้
1. Cloudflare → R2 → เลือก bucket `yimwann-files` → แท็บ **Settings** → **CORS Policy** → **Add CORS policy** (หรือ Edit)
2. ลบของเดิมแล้ววาง (เปลี่ยนลิงก์ให้ตรงกับเว็บจริง):
   ```json
   [
     {
       "AllowedOrigins": ["https://yimwann-sticker.netlify.app"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
3. กด **Save**
4. ถ้าภายหลังซื้อโดเมนของร้าน ให้เพิ่มโดเมนใหม่ใน `AllowedOrigins` ด้วย เช่น `["https://yimwann-sticker.netlify.app", "https://order.yimwann.com"]`

---

## ขั้นที่ 5: ตั้งค่าร้านในหลังบ้าน

1. เปิด `https://yimwann-sticker.netlify.app/admin` → ล็อกอินด้วยอีเมล/รหัสผ่านจากข้อ 1.3
2. เมนู **ตั้งค่า**:
   - **การชำระเงิน:** ใส่พร้อมเพย์ (เบอร์โทรหรือเลขบัตรประชาชน), ชื่อบัญชี, ธนาคาร, เลขบัญชี
   - **ตารางราคา / ค่าส่ง / โปรสะสม / ค่าแก้ไฟล์:** ตรวจตัวเลขให้ถูก
   - **ขนาดแผ่น:** ตรวจว่าเป็น 330 × 483 มม.
   - **LINE OA ของร้าน:** ใส่ไอดี เช่น `@yimwann` (แสดงให้ลูกค้าเห็น)
3. กด **บันทึกการตั้งค่า**
4. (ถ้ามีพนักงานกราฟิก) เมนู **พนักงาน** → เพิ่มอีเมล + รหัสผ่านเริ่มต้น + บทบาท "กราฟิก"

---

## ขั้นที่ 6: ทดสอบก่อนส่งลิงก์ให้ลูกค้า

ทำบนมือถือ 1 รอบ และบนคอม 1 รอบ:
1. เปิด `https://yimwann-sticker.netlify.app`
2. อัปโหลดไฟล์ JPG, PNG, PDF และ AI อย่างละ 1 ไฟล์ → ต้องขึ้นรูปตัวอย่างและป้ายผลตรวจ
3. เลือกทรงไดคัท ขนาด ประเภท จำนวน → กรอกที่อยู่ → สแกน QR พร้อมเพย์ด้วยแอปธนาคาร (ดูว่ายอดเงินขึ้นถูก **ไม่ต้องโอนจริง**) → แนบรูปอะไรก็ได้แทนสลิป → ยืนยันสั่งซื้อ
4. ต้องได้เลขออเดอร์ (เช่น YW1001) → กดไปหน้าเช็คสถานะ
5. หลังบ้าน → เปิดออเดอร์ → ลองดาวน์โหลดไฟล์ต้นฉบับ → กดยืนยันชำระเงิน → เริ่มผลิต → ใส่เลขแทร็คทดสอบ
6. กลับไปหน้าเช็คสถานะ → ต้องขึ้น "จัดส่งแล้ว" พร้อมเลขแทร็ค
7. ทดลองเสร็จแล้ว เปลี่ยนสถานะออเดอร์ทดสอบเป็น **ยกเลิก**
8. Netlify → **Logs** → **Functions** → `scheduled-cleanup` ต้องมีบันทึก `cleanup 200` ทุกชั่วโมง

---

## ขั้นที่ 7 (ไม่บังคับ): อีเมลแจ้งเตือนออเดอร์ใหม่ (Gmail ฟรี)

1. บัญชี Google ที่จะใช้ส่ง → https://myaccount.google.com/security → เปิด **2-Step Verification**
2. ค้นหา **App passwords** ในหน้าบัญชี Google → ตั้งชื่อ `yimwann` → **Create** → จดรหัส 16 ตัว
3. Netlify → Environment variables เพิ่ม:

| Key | Value |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | อีเมล Gmail นั้น |
| `SMTP_PASS` | รหัส 16 ตัว (ไม่มีช่องว่าง) |

4. หลังบ้าน → ตั้งค่า → ใส่ **อีเมลร้านสำหรับแจ้งออเดอร์ใหม่** → บันทึก
5. Netlify → Trigger deploy ใหม่ 1 ครั้ง → ลองสั่งออเดอร์ทดสอบ ต้องมีอีเมลเข้า

---

## ขั้นที่ 8 (ทำทีหลังได้): เชื่อม LINE

### 8.1 LINE Login (ลูกค้าเข้าด้วย LINE เห็นไฟล์เดิม ที่อยู่เดิม ยอดสะสม ได้ทุกเครื่อง)
1. เปิด [developers.line.biz](https://developers.line.biz) → **Log in to Console** → เข้าด้วยบัญชี LINE ที่เป็นแอดมินของ LINE OA ร้าน
2. เลือก **Provider** ที่ LINE OA ของร้านอยู่ (ถ้าเคยเปิด Messaging API ไว้จะมีอยู่แล้ว) ถ้ายังไม่มี กด **Create** ตั้งชื่อ เช่น `Yimwann Sticker`
3. ใน Provider นั้น กด **Create a new channel** → เลือก **LINE Login**
   - Region: **Thailand**
   - Channel name: `ยิ้มหวานสติกเกอร์` (ชื่อนี้ลูกค้าเห็นตอนกดเข้าสู่ระบบ)
   - Channel description: เช่น `เข้าสู่ระบบเพื่อสั่งพิมพ์สติกเกอร์`
   - App types: ติ๊ก **Web app**
   - ใส่อีเมลร้าน → ติ๊กยอมรับเงื่อนไข → **Create**
4. แท็บ **LINE Login** → **Callback URL** → ใส่ `https://yimwann-sticker.netlify.app/api/line/callback` → **Update**
   (ถ้าเปลี่ยนเป็นโดเมนร้านทีหลัง ต้องมาแก้ตรงนี้ด้วย)
5. แท็บ **Basic settings**
   - **Linked LINE Official Account** → เลือก OA ของร้าน (ตอนลูกค้าเข้าสู่ระบบ จะมีปุ่มชวนแอดเพื่อน OA)
   - **Privacy policy URL** (ถ้ามีช่อง) → `https://yimwann-sticker.netlify.app/privacy`
   - จด **Channel ID** และ **Channel secret** ไว้ (Channel secret ห้ามส่งให้ใคร ห้ามแคปหน้าจอ)
6. ⚠️ **กด Publish** ที่ด้านบนของหน้า channel (สถานะเปลี่ยนจาก Developing เป็น Published)
   ถ้าไม่กด จะมีแค่แอดมินที่เข้าสู่ระบบได้ ลูกค้าจะเข้าไม่ได้
7. Netlify → **Site configuration** → **Environment variables** → เพิ่ม 2 ค่า

| Key | Value |
|---|---|
| `LINE_LOGIN_CHANNEL_ID` | Channel ID |
| `LINE_LOGIN_CHANNEL_SECRET` | Channel secret |

8. Netlify → **Deploys** → **Trigger deploy** → **Deploy site** รอ 2–3 นาที
9. ทดสอบ: เปิดหน้าเว็บในมือถือ → ต้องเห็นกล่องเขียว "เคยสั่งแล้ว? เข้าสู่ระบบด้วย LINE" → กด → อนุญาต → กลับมาหน้าเว็บ
   - LINE ที่ยังไม่เคยใช้สั่ง: ขึ้น "เชื่อมต่อ LINE เรียบร้อย…" → สั่ง 1 ครั้ง (หรือยืนยันชื่อ + เบอร์ที่ "เลือกจากไฟล์ที่เคยสั่ง") ระบบจะผูก LINE กับเบอร์ให้
   - ครั้งต่อไป เข้าด้วย LINE จากมือถือ/คอมเครื่องไหนก็ได้ จะขึ้นข้อความต้อนรับ ยอดสะสม ไฟล์เดิม และที่อยู่เดิมทันที

**ความปลอดภัย:** ระบบจะผูก LINE กับเบอร์ก็ต่อเมื่อชื่อผู้รับตรงกับออเดอร์เก่าของเบอร์นั้น (หรือเป็นเบอร์ใหม่) คนที่พิมพ์เบอร์คนอื่นมาสั่งจะไม่ได้สิทธิ์เห็นไฟล์หรือที่อยู่ของเจ้าของเบอร์
ถ้าลูกค้าแจ้งว่าผูก LINE ผิด: Supabase → Table Editor → `customers` → หาเบอร์ → ลบค่าในช่อง `line_user_id`

### 8.2 แจ้งเลขพัสดุทาง LINE + บอทตอบเลขออเดอร์
ดูหัวข้อ "LINE" ใน README (เปิด Messaging API ของ LINE OA ร้าน)

## ขั้นที่ 9 (ไม่บังคับ): ใช้โดเมนของร้าน
1. ซื้อโดเมน (เช่น จาก Cloudflare Registrar หรือผู้ขายโดเมนไทย)
2. Netlify → **Domain management** → **Add a domain** → ทำตามขั้นตอนตั้งค่า DNS
3. แก้ `NEXT_PUBLIC_SITE_URL` เป็นโดเมนใหม่ → Trigger deploy
4. เพิ่มโดเมนใหม่ใน Supabase (ข้อ 4.1) และ R2 CORS (ข้อ 4.2)

---

## งานประจำ
- **ทุกสัปดาห์:** หลังบ้าน → ตั้งค่า → **สำรองข้อมูล** → ดาวน์โหลดทั้ง 2 ไฟล์ เก็บไว้ใน Google Drive
- **ทุกเดือน:** ดูพื้นที่ R2 (Cloudflare → R2 → Overview) ถ้าใกล้ 10 GB จะเริ่มมีค่าใช้จ่ายเล็กน้อย (ประมาณ 0.5 บาท/GB/เดือน) หรือลดจำนวนวันเก็บไฟล์ในหน้าตั้งค่า

---

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุที่น่าจะเป็น | วิธีแก้ |
|---|---|---|
| หน้าแรกขึ้น error / หน้าขาว | key ของ Supabase ผิด | ตรวจ 3 ค่าในข้อ 1.4 แล้ว deploy ใหม่ |
| อัปโหลดไฟล์ค้าง 0% หรือขึ้น "อัปโหลดไม่สำเร็จ" | ยังไม่ได้ตั้ง CORS หรือลิงก์ใน CORS ไม่ตรง | ทำข้อ 4.2 ให้ลิงก์ตรงกับเว็บทุกตัวอักษร (มี https:// ไม่มี / ท้าย) |
| "เตรียมอัปโหลดไม่สำเร็จ" | ค่า R2 ผิด | ตรวจ 4 ค่าของ R2 / สร้าง API token ใหม่ |
| รูปตัวอย่างในหลังบ้านไม่ขึ้น | R2 token ไม่มีสิทธิ์อ่าน | สร้าง token ใหม่แบบ Object Read & Write |
| ล็อกอินหลังบ้านแล้วเด้งกลับหน้า login | ตั้ง Site URL / Redirect ไม่ครบ หรืออีเมลไม่อยู่ใน `ADMIN_EMAILS` | ทำข้อ 4.1 และตรวจ `ADMIN_EMAILS` |
| QR พร้อมเพย์ไม่ขึ้น | ยังไม่ได้ใส่เลขพร้อมเพย์ | หลังบ้าน → ตั้งค่า → การชำระเงิน |
| Deploy ขึ้น Failed | ค่า env ไม่ครบ หรือ Netlify ยังไม่รองรับบางส่วนของ Next.js 16 | แคป log ส่วนสีแดงส่งให้ผู้ดูแลระบบ |
