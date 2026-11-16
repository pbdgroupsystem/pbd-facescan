/* PBD สแกนหน้านอกพื้นที่ — service worker (แอปบนเครื่อง / PWA)
 * หน้าเว็บ + config.js : ดึงใหม่จากเน็ตก่อนเสมอ (อัปโหลดแล้วเห็นทันที) · ไม่มีเน็ต → ใช้ฉบับที่เก็บไว้
 * ไอคอน / เสียง        : เก็บไว้ในเครื่อง
 * ตัวจดจำใบหน้า face-api.js + ไฟล์โมเดล (~10 MB จาก cdn.jsdelivr.net) และ LINE SDK : เก็บไว้ในเครื่องหลังโหลดครั้งแรก → เปิดเร็ว ใช้ได้ตอนสัญญาณไม่ดี
 * ไม่เก็บคำขอไประบบหลังบ้าน (GAS) → รายชื่อ/รูปใบหน้า/ผลสแกนไม่ถูกเก็บโดย service worker
 * แก้ไฟล์นี้ / เปลี่ยนไฟล์เสียงเมื่อไร ให้เปลี่ยน VERSION เพื่อล้างของเก่า */
const VERSION = 'pbd-facescan-v1';
const MODEL_CACHE = 'pbd-facescan-models-v1';   // แยกไว้ ไม่ต้องโหลดโมเดลใหม่ทุกครั้งที่เปลี่ยน VERSION
const SHELL = ['./', './index.html', './config.js', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './sounds/ok.mp3', './sounds/dup.mp3', './sounds/no-trip.mp3', './sounds/queued.mp3', './sounds/fail.mp3', './sounds/blink.mp3', './sounds/no-blink.mp3'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => { })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== MODEL_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // ตัวจดจำใบหน้า + โมเดล + LINE SDK: ใช้ของในเครื่องก่อน (ไฟล์มีเวอร์ชันตายตัว ไม่เปลี่ยน)
  if ((url.hostname === 'cdn.jsdelivr.net' && /face-api\.js@/.test(url.pathname)) || url.hostname === 'static.line-scdn.net') {
    e.respondWith(caches.open(MODEL_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (req.mode === 'navigate' || /\/(index\.html|config\.js)$/.test(url.pathname)) {   // หน้าเว็บ/ค่าตั้งค่า: เอาใหม่ก่อน
    const key = req.mode === 'navigate' ? './index.html' : req;
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(key, cp)); }
      return res;
    }).catch(() => caches.match(key, { ignoreSearch: true })));
    return;
  }
  if (/\/(icons\/|sounds\/|manifest\.json)/.test(url.pathname)) e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});
