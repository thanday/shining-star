require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Simple ASCII-safe sanitizer -> underscores
function safePart(str) {
  return String(str)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'participant';
}

// Multer storage with custom filename: name_age_mobile.ext
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const { name = '', age = '', mobile = '' } = req.body || {};
    const base = `${safePart(name)}_${safePart(age)}_${safePart(mobile)}`;

    const ext = path.extname(file.originalname).toLowerCase();
    let target = `${base}${ext}`;

    // If file exists, append a timestamp to keep unique
    const fullPath = (t) => path.join(UPLOAD_DIR, t);
    if (fs.existsSync(fullPath(target))) {
      const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
      target = `${base}_${stamp}${ext}`;
    }
    cb(null, target);
  }
});


const allowedExts = new Set(['.mp4', '.mov']);
const allowedMimes = new Set(['video/mp4', 'video/quicktime']);

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    const extOk = allowedExts.has(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowedMimes.has(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Only MP4 or MOV video files are allowed.'));
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', upload.single('video'), async (req, res) => {
    try {
      const { name, age, mobile } = req.body || {};
  
      const missing = [];
      if (!name) missing.push('name');
      if (!age) missing.push('age');
      if (!mobile) missing.push('mobile');
      if (missing.length) {
        return res.status(400).json({ ok: false, error: `Missing required fields: ${missing.join(', ')}` });
      }
  
      // Maldives mobile: exactly 7 digits, starting with 7 or 9
      if (!/^[79][0-9]{6}$/.test(String(mobile))) {
        return res.status(400).json({ ok: false, error: 'Mobile must be 7 digits and start with 7 or 9 (Maldives).' });
      }
  
      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'No video uploaded.' });
      }
  
      // === Send confirmation SMS 
      const smsResult = { ok: false };
      try {
        const ACCESS_KEY = process.env.MSGOWL_ACCESS_KEY;
        const SENDER_ID  = process.env.MSGOWL_SENDER_ID || 'SS Media';
        if (!ACCESS_KEY) throw new Error('MSGOWL_ACCESS_KEY missing');
  
        const recipients = `960${mobile}`;
        const body = `Hi ${name}, we\'ve received your Shining Star audition. We\'ll review and contact you. Thank you!`;
  
        const resp = await fetch('https://rest.msgowl.com/messages', {
          method: 'POST',
          headers: {
            'Authorization': `AccessKey ${ACCESS_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ recipients, sender_id: SENDER_ID, body })
        });
  
        const data = await resp.json().catch(() => ({}));
        smsResult.ok = resp.ok;
        smsResult.id = data && data.id;
        smsResult.status = resp.status;
      } catch (e) {
        smsResult.error = e.message;
      }
  
      return res.json({ ok: true, filename: req.file.filename, sms: smsResult });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Server error.' });
    }
  });

// Basic health
app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Shining Star portal running on http://localhost:${PORT}`);
});