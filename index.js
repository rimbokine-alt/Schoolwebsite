require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const getAdminDashboardHTML = require('./admin.js');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set('trust proxy', 1);

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.SESSION_SECRET;
const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
let isConnected = false;
let cachedDb = null;

const AdminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const SettingsSchema = new mongoose.Schema({
    schoolName: { type: String, default: 'Bright Future Academy' },
    shortName: String, tagline: String, logoUrl: String, establishedYear: String,
    academicSession: String, principalName: String, phonePrimary: String, email: String,
    address: String, city: String, facebookUrl: String,
    heroTitle: { type: String, default: 'Welcome to Bright Future Academy' },
    heroSubtitle: String, heroImageUrl: String, aboutTitle: String, aboutDescription: String,
    colors: {
        primary: { type: String, default: '#4F7CFF' },
        secondary: { type: String, default: '#8B5CF6' },
        background: { type: String, default: '#F5F7FF' }
    }
});
const AdmissionSchema = new mongoose.Schema({
    studentName: String, requestedGrade: String, parentName: String, phone: String,
    email: String, address: String, status: { type: String, default: 'pending' }, refNo: String
}, { timestamps: true });
const NoticeSchema = new mongoose.Schema({
    title: String, category: String, description: String,
    isPublished: { type: Boolean, default: true }
}, { timestamps: true });
const EventSchema = new mongoose.Schema({
    title: String, date: Date, category: String, description: String, image: String,
    isPublished: { type: Boolean, default: true }
}, { timestamps: true });
const ProgramSchema = new mongoose.Schema({
    title: String, gradeRange: String, description: String, image: String,
    isPublished: { type: Boolean, default: true }
});
const TeacherSchema = new mongoose.Schema({ name: String, designation: String, department: String, bio: String, image: String });
const FacilitySchema = new mongoose.Schema({ title: String, description: String, icon: String });
const GallerySchema = new mongoose.Schema({ title: String, category: String, imageUrl: String });
const StatSchema = new mongoose.Schema({ label: String, value: String, icon: String });
const MessageSchema = new mongoose.Schema({
    name: String, email: String, body: String, isRead: { type: Boolean, default: false }
}, { timestamps: true });

const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
const Admission = mongoose.models.Admission || mongoose.model('Admission', AdmissionSchema);
const Notice = mongoose.models.Notice || mongoose.model('Notice', NoticeSchema);
const Event = mongoose.models.Event || mongoose.model('Event', EventSchema);
const Program = mongoose.models.Program || mongoose.model('Program', ProgramSchema);
const Teacher = mongoose.models.Teacher || mongoose.model('Teacher', TeacherSchema);
const Facility = mongoose.models.Facility || mongoose.model('Facility', FacilitySchema);
const Gallery = mongoose.models.Gallery || mongoose.model('Gallery', GallerySchema);
const Stat = mongoose.models.Stat || mongoose.model('Stat', StatSchema);
const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);

async function connectDB() {
    if (cachedDb && mongoose.connection.readyState === 1) return cachedDb;
    if (!MONGODB_URI) throw new Error('Missing MONGODB_URI environment variable.');

    mongoose.set('strictQuery', true);
    cachedDb = await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10
    });
    isConnected = mongoose.connection.readyState === 1;

    const adminCount = await Admin.countDocuments();
    const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_SECRET || DEFAULT_ADMIN_PASSWORD;
    if (adminCount === 0) {
        const hashed = await bcrypt.hash(bootstrapPassword, 10);
        await Admin.create({ username: DEFAULT_ADMIN_USERNAME, password: hashed });
    }

    const settingsCount = await Settings.countDocuments();
    if (settingsCount === 0) await Settings.create({});

    return cachedDb;
}

const asyncRoute = (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

const requireAuth = (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        if (!JWT_SECRET) return res.status(500).json({ error: 'Server authentication is not configured.' });
        req.admin = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid session. Please log in again.' });
    }
};

app.get('/api/health', (req, res) => res.json({ ok: true, message: 'School website API is running.' }));

app.get('/api/settings', asyncRoute(async (req, res) => {
    await connectDB();
    res.json(await Settings.findOne().lean() || {});
}));

app.get('/api/public-data', asyncRoute(async (req, res) => {
    await connectDB();
    const [notices, events, programs, teachers, facilities, gallery, stats] = await Promise.all([
        Notice.find({ isPublished: true }).sort({ createdAt: -1 }).limit(5).lean(),
        Event.find({ isPublished: true, date: { $gte: new Date() } }).sort({ date: 1 }).limit(5).lean(),
        Program.find({ isPublished: true }).lean(),
        Teacher.find().lean(),
        Facility.find().lean(),
        Gallery.find().lean(),
        Stat.find().lean()
    ]);
    res.json({ notices, events, programs, teachers, facilities, gallery, stats });
}));

app.post('/api/admissions', asyncRoute(async (req, res) => {
    await connectDB();
    const { studentName, requestedGrade, parentName, phone, email, address } = req.body;
    if (!studentName || !requestedGrade || !parentName || !phone || !address) {
        return res.status(400).json({ error: 'Please complete all required admission fields.' });
    }
    const refNo = 'APP-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    await Admission.create({ studentName, requestedGrade, parentName, phone, email, address, refNo });
    res.status(201).json({ success: true, refNo });
}));

app.post('/api/contact', asyncRoute(async (req, res) => {
    await connectDB();
    const { name, email, body } = req.body;
    if (!name || !email || !body) return res.status(400).json({ error: 'Please complete all contact fields.' });
    await Message.create({ name, email, body });
    res.status(201).json({ success: true });
}));

app.post('/api/admin/login', asyncRoute(async (req, res) => {
    await connectDB();
    if (!JWT_SECRET) return res.status(500).json({ error: 'SESSION_SECRET is not configured.' });
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const admin = await Admin.findOne({ username });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
        return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const token = jwt.sign({ id: admin._id }, JWT_SECRET, { expiresIn: '1d' });
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    });
    res.json({ success: true });
}));

app.post('/api/admin/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
        sameSite: 'lax'
    }).json({ success: true });
});

app.get('/api/admin/me', requireAuth, (req, res) => res.json({ success: true }));

app.get('/api/admin/dashboard', requireAuth, asyncRoute(async (req, res) => {
    await connectDB();
    const stats = {
        admissions: { pending: await Admission.countDocuments({ status: 'pending' }) },
        messages: { unread: await Message.countDocuments({ isRead: false }) },
        content: { notices: await Notice.countDocuments(), events: await Event.countDocuments() },
        recentAdmissions: await Admission.find().sort({ createdAt: -1 }).limit(5).lean()
    };
    res.json(stats);
}));

app.get('/api/admin/settings', requireAuth, asyncRoute(async (req, res) => {
    await connectDB();
    res.json({ settings: await Settings.findOne().lean() });
}));

app.patch('/api/admin/settings', requireAuth, asyncRoute(async (req, res) => {
    await connectDB();
    const allowed = [
        'schoolName', 'shortName', 'tagline', 'logoUrl', 'establishedYear', 'academicSession',
        'principalName', 'phonePrimary', 'email', 'address', 'city', 'facebookUrl',
        'heroTitle', 'heroSubtitle', 'heroImageUrl', 'aboutTitle', 'aboutDescription', 'colors'
    ];
    const update = {};
    for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];
    const settings = await Settings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true, runValidators: true });
    res.json({ success: true, settings });
}));

const crudModels = {
    notices: Notice, events: Event, programs: Program, teachers: Teacher,
    facilities: Facility, gallery: Gallery, stats: Stat
};
for (const [path, Model] of Object.entries(crudModels)) {
    app.get(`/api/admin/${path}`, requireAuth, asyncRoute(async (req, res) => {
        await connectDB();
        res.json(await Model.find().sort({ createdAt: -1 }).lean());
    }));
    app.post(`/api/admin/${path}`, requireAuth, asyncRoute(async (req, res) => {
        await connectDB();
        res.status(201).json(await Model.create(req.body));
    }));
    app.put(`/api/admin/${path}/:id`, requireAuth, asyncRoute(async (req, res) => {
        await connectDB();
        const item = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!item) return res.status(404).json({ error: 'Item not found.' });
        res.json(item);
    }));
    app.delete(`/api/admin/${path}/:id`, requireAuth, asyncRoute(async (req, res) => {
        await connectDB();
        const item = await Model.findByIdAndDelete(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found.' });
        res.json({ success: true });
    }));
}

app.get('/api/admin/admissions', requireAuth, asyncRoute(async (req, res) => {
    await connectDB();
    res.json(await Admission.find().sort({ createdAt: -1 }).lean());
}));
app.patch('/api/admin/admissions/:id', requireAuth, asyncRoute(async (req, res) => {
    await connectDB();
    const allowedStatuses = ['pending', 'approved', 'rejected'];
    if (!allowedStatuses.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status.' });
    const item = await Admission.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!item) return res.status(404).json({ error: 'Admission not found.' });
    res.json(item);
}));
app.get('/api/admin/messages', requireAuth, asyncRoute(async (req, res) => {
    await connectDB();
    res.json(await Message.find().sort({ createdAt: -1 }).lean());
}));
app.patch('/api/admin/messages/:id', requireAuth, asyncRoute(async (req, res) => {
    await connectDB();
    const item = await Message.findByIdAndUpdate(req.params.id, { isRead: Boolean(req.body.isRead) }, { new: true });
    if (!item) return res.status(404).json({ error: 'Message not found.' });
    res.json(item);
}));
app.delete('/api/admin/messages/:id', requireAuth, asyncRoute(async (req, res) => {
    await connectDB();
    const item = await Model.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Message not found.' });
    res.json({ success: true });
}));

app.get('/admin', (req, res) => {
    res.type('html').send(getAdminDashboardHTML());
});

app.get('/', asyncRoute(async (req, res) => {
    await connectDB();
    const settings = await Settings.findOne().lean() || {};
    const primary = settings.colors?.primary || '#4F7CFF';
    const secondary = settings.colors?.secondary || '#8B5CF6';
    const bg = settings.colors?.background || '#F5F7FF';
    const sName = settings.schoolName || 'Bright Future Academy';
    const sTagline = settings.tagline || 'Learn Today. Lead Tomorrow.';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${sName} | Home</title>
<meta name="description" content="${settings.aboutDescription || sTagline}">
<style>
:root{--navy:#102a43;--navy2:#173f5f;--gold:#d6ad60;--ink:#1d2939;--muted:#667085;--paper:#f7f8fa;--white:#fff;--line:#e5eaf0;--shadow:0 16px 42px rgba(16,42,67,.10)}
*{box-sizing:border-box;margin:0;padding:0;font-family:Inter,'Segoe UI',system-ui,sans-serif}
html{scroll-behavior:smooth;scroll-padding-top:90px}body{background:var(--paper);color:var(--ink);line-height:1.65;overflow-x:hidden}
a{color:inherit}.container{max-width:1200px;margin:auto;padding:0 24px}
.topbar{background:var(--navy);color:#fff;font-size:.9rem;padding:8px 0}.topbar-inner{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}
header{position:sticky;top:0;z-index:1000;background:rgba(255,255,255,.96);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
nav{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:12px;text-decoration:none;min-width:0}.brand-mark{width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,var(--gold),#f3d98e);display:grid;place-items:center;font-size:1.6rem}.brand-name{display:flex;flex-direction:column;line-height:1.1}.brand-small{font-size:.71rem;color:var(--muted);font-weight:700;letter-spacing:.02em}
.nav-links{display:flex;align-items:center;gap:23px}.nav-links a{text-decoration:none;font-weight:650;font-size:.92rem;color:#344054}.nav-links a:hover{color:var(--gold)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 20px;border-radius:8px;background:var(--gold);color:var(--navy);text-decoration:none;border:1px solid transparent;font-weight:800}.btn-navy{background:var(--navy);color:#fff}.hero{position:relative;min-height:490px;display:flex;align-items:flex-end;background:#183c55;overflow:hidden;color:#fff}.hero-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(1.06)}.hero::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,17,31,.72),rgba(15,31,46,.32));}.hero-content{position:relative;z-index:1;padding:72px 24px;max-width:680px}.hero-kicker{display:inline-block;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);font-weight:800;text-transform:uppercase;font-size:.72rem;letter-spacing:.08em;margin-bottom:20px}.hero h1{font-size:clamp(2.3rem,5vw,4.4rem);line-height:1.05;margin-bottom:14px}.hero p{font-size:1.1rem;max-width:560px;color:rgba(255,255,255,.9)}.hero-actions{display:flex;gap:14px;flex-wrap:wrap;margin-top:26px}.quick-wrap{position:relative;margin-top:-1px;background:#fff;border-bottom:1px solid var(--line)}.quick-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:0}.quick-card{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:22px 16px;text-decoration:none;border-left:1px solid var(--line);border-top:1px solid var(--line);background:#fff;color:var(--navy);text-align:center}.quick-card:first-child{border-left:none}.quick-icon{font-size:1.45rem}.quick-card strong{font-size:1rem}.quick-card span{font-size:.78rem;color:var(--muted)}
section.content-section{padding:76px 0}.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:30px}.eyebrow{color:#a57a2b;font-weight:850;text-transform:uppercase;letter-spacing:.08em;font-size:.72rem}.section-title{font-size:clamp(2rem,3vw,2.6rem);color:var(--navy);line-height:1.1}.section-lead{margin-top:12px;color:var(--muted);font-size:1.02rem;max-width:650px}.about-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center}.about-photo{width:100%;height:360px;object-fit:cover;border-radius:14px;box-shadow:var(--shadow)}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:24px}.stat{background:#fff;border:1px solid var(--line);padding:20px;border-radius:12px;box-shadow:0 6px 16px rgba(16,42,67,.04)}.stat strong{display:block;color:var(--navy);font-size:1.35rem;margin-bottom:4px}.stat span{color:var(--muted)}.cards-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.card{background:#fff;border:1px solid var(--line);border-radius:13px;padding:25px;box-shadow:0 5px 18px rgba(16,42,67,.05)}.card-icon{font-size:1.8rem;display:inline-block;margin-bottom:10px}.card h3{font-size:1.25rem;color:var(--navy);margin-bottom:10px}.card p{color:var(--muted)}.notice-list,.event-list,.facility-list{background:#fff;border:1px solid var(--line);border-radius:13px;overflow:hidden}.notice-item,.event-item,.facility-item{padding:18px 20px;border-bottom:1px solid var(--line)}.notice-item:last-child,.event-item:last-child,.facility-item:last-child{border-bottom:none}.notice-item strong,.event-item strong,.facility-item strong{display:block;color:var(--navy);margin-bottom:8px}.notice-item p,.event-item p,.facility-item p{color:var(--muted)}.admission-band{background:var(--navy);color:#fff;border-radius:16px;padding:38px;display:flex;align-items:center;justify-content:space-between;gap:24px}.admission-band h2{font-size:clamp(1.6rem,2vw,2.8rem);max-width:500px}.form-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:28px;max-width:720px;margin:auto;box-shadow:var(--shadow)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.field{display:grid;gap:8px}.field label{font-size:.9rem;font-weight:700;color:var(--navy)}.form-input,.form-textarea{width:100%;padding:12px 13px;border:1px solid #d7dfe9;border-radius:10px;background:#fff;color:var(--ink);font:inherit}.form-textarea{min-height:120px;resize:vertical}.gallery-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.gallery-tile{height:210px;border-radius:12px;overflow:hidden;background:#e7edf2}.gallery-tile img{width:100%;height:100%;object-fit:cover;display:block}.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.contact-info{display:grid;gap:14px}.contact-row{display:flex;gap:14px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px}.card-icon{font-size:1.5rem;display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:10px;background:#f5f7ff;color:var(--navy)}.contact-row p{color:var(--muted)}footer{background:#0b2034;color:#e5edf5;padding:45px 0 22px}.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:30px}.footer-grid h3,.footer-grid h4{color:#fff;margin-bottom:12px}.footer-grid p{color:#d4dfe8}.muted{color:var(--muted)}.text-link{color:#9b7128;font-weight:800;text-decoration:none}.hidden{display:none}.form-message{margin-top:12px;font-size:.93rem;font-weight:600}.status-success{color:#0f9d75}.status-error{color:#d14343}
@media(max-width:900px){.nav-links{display:none}.quick-grid{grid-template-columns:repeat(3,1fr)}.quick-card:nth-child(4){border-left:1px solid var(--line)}.quick-card:nth-child(-n+3){border-bottom:1px solid var(--line)}.about-grid,.contact-grid,.form-grid,.admission-band,.footer-grid{grid-template-columns:1fr;display:grid}.admission-band{padding:26px 18px}.}
@media(max-width:600px){.container{padding:0 17px}.topbar-inner{justify-content:center;text-align:center}.topbar-inner span:nth-child(2){display:none}nav{min-height:68px}.brand-mark{width:40px;height:40px}.hero-content{padding:52px 16px}.hero h1{font-size:2.5rem}.quick-grid{grid-template-columns:repeat(2,1fr)}.cards-3,.gallery-grid,.stats{grid-template-columns:1fr}.section-title{font-size:2rem}}
</style>
</head>
<body>
<div class="topbar"><div class="container topbar-inner"><span>🎓 Welcome to our school community</span><span>📞 ${settings.phonePrimary || '+977-9800000000'} &nbsp; · &nbsp; ${settings.email || 'info@school.example'}</span></div></div>
<header><div class="container"><nav>
<a href="#" class="brand"><span class="brand-mark">🏫</span><span class="brand-name" id="school-name">${sName}<span class="brand-small">Education · Excellence · Future</span></span></a>
<div class="nav-links"><a href="#about">About</a><a href="#programs">Academics</a><a href="#notices">Notices</a><a href="#gallery">Gallery</a><a href="#contact">Contact</a></div>
<a href="#admission" class="btn btn-navy nav-cta">Admission ↗</a>
</nav></div></header>
<main>
<section class="hero">
<img class="hero-photo" src="${settings.heroImageUrl || 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1800&q=85'}" alt="School building and campus" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1800&q=85'">
<div class="hero-content"><span class="hero-kicker">Welcome to our school</span><h1>${settings.heroTitle || sName}</h1><p>${settings.heroSubtitle || sTagline}</p><div class="hero-actions"><a href="#admission" class="btn">Apply Now</a><a href="#contact" class="btn btn-navy">Contact Us</a></div></div>
</section>
<div class="quick-wrap"><div class="container quick-grid">
<a class="quick-card" href="tel:${settings.phonePrimary || '+977-9800000000'}"><span class="quick-icon">☎</span><strong>Call Us</strong><span>Talk to our team</span></a>
<a class="quick-card" href="#notices"><span class="quick-icon">📢</span><strong>Notices</strong><span>Latest updates</span></a>
<a class="quick-card" href="#admission"><span class="quick-icon">📝</span><strong>Admission</strong><span>Apply or enquire</span></a>
<a class="quick-card" href="#events"><span class="quick-icon">📅</span><strong>Events</strong><span>School activities</span></a>
<a class="quick-card" href="#about"><span class="quick-icon">🏫</span><strong>About School</strong><span>Who we are</span></a>
<a class="quick-card" href="#gallery"><span class="quick-icon">🖼️</span><strong>Gallery</strong><span>Life at school</span></a>
</div></div>
<section id="about" class="content-section"><div class="container about-grid">
<div><span class="eyebrow">Who we are</span><h2 class="section-title" style="text-align:left">${settings.aboutTitle || 'Learning today. Leading tomorrow.'}</h2><p class="section-lead">${settings.aboutDescription || 'Education that builds confidence, values, and future-ready success.'}</p>
<div class="stats"><div class="stat"><strong>Quality</strong><span>Student-focused learning</span></div><div class="stat"><strong>Care</strong><span>Supportive community</span></div><div class="stat"><strong>Growth</strong><span>Future-ready mindset</span></div></div>
${settings.principalName ? `<p style="margin-top:18px"><strong>Principal:</strong> ${settings.principalName}</p>` : ''}
<p style="margin-top:22px"><a class="btn btn-navy" href="#contact">Get to Know Us</a></p></div>
<img class="about-photo" src="${settings.heroImageUrl || 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1000&q=80'}" alt="Students learning at school" loading="lazy">
</div></section>
<section id="programs" class="content-section" style="background:#fff"><div class="container"><div class="section-head"><div><span class="eyebrow">Learning pathways</span><h2 class="section-title">Academics & Programs</h2></div></div><div class="cards-3" id="programs-list"><div class="card"><span class="card-icon">🌱</span><h3>Early Learning</h3><p>A warm, welcoming foundation for curious young minds.</p></div><div class="card"><span class="card-icon">📘</span><h3>Primary Education</h3><p>Strong basics, creativity, and confidence for lifelong learning.</p></div><div class="card"><span class="card-icon">🎓</span><h3>Secondary Education</h3><p>Knowledge and skills to prepare students for future opportunities.</p></div></div></div></section>
<section id="notices" class="content-section"><div class="container"><div class="section-head"><div><span class="eyebrow">Stay informed</span><h2 class="section-title">Latest Notices</h2></div></div><div id="notices-list" class="notice-list"><div class="notice-item"><p class="muted">Loading notices...</p></div></div></div></section>
<section id="events" class="content-section" style="background:#fff"><div class="container"><div class="section-head"><div><span class="eyebrow">School life</span><h2 class="section-title">Upcoming Events</h2></div></div><div id="events-list" class="event-list"><div class="event-item"><p class="muted">Loading events...</p></div></div></div></section>
<section id="admission" class="content-section"><div class="container"><div class="admission-band"><div><span class="hero-kicker">Join our community</span><h2>Start your learning journey with us.</h2></div><a href="#admission-form" class="btn btn-navy">Apply Now</a></div><div class="form-card" style="margin-top:28px"><div style="margin-bottom:22px"><span class="eyebrow">Admission inquiry</span><h2 class="section-title" style="text-align:left;font-size:1.8rem">Student Registration</h2></div><form id="admission-form" class="form-grid"><div class="field"><label>Student's full name *</label><input class="form-input" name="studentName" placeholder="Enter student name" required></div><div class="field"><label>Requested grade *</label><input class="form-input" name="requestedGrade" placeholder="e.g. Grade 6" required></div><div class="field"><label>Parent/Guardian name *</label><input class="form-input" name="parentName" placeholder="Parent name" required></div><div class="field"><label>Phone number *</label><input class="form-input" name="phone" placeholder="Phone number" required></div><div class="field" style="grid-column:1/-1"><label>Email address</label><input class="form-input" name="email" type="email" placeholder="Email address"></div><div class="field" style="grid-column:1/-1"><label>Address *</label><textarea class="form-textarea" name="address" placeholder="Home address" required></textarea></div><div class="field" style="grid-column:1/-1"><button type="submit" class="btn btn-navy" style="width:100%">Submit Admission</button><div id="admission-message" class="form-message"></div></div></form></div></div></section>
<section id="gallery" class="content-section" style="background:#fff"><div class="container"><div class="section-head"><div><span class="eyebrow">Memories & moments</span><h2 class="section-title">School Gallery</h2></div></div><div id="gallery-grid" class="gallery-grid"><div class="gallery-tile"><img src="${settings.heroImageUrl || 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=700&q=80'}" alt="School campus" loading="lazy"></div><div class="gallery-tile"><img src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=700&q=80" alt="Students smiling" loading="lazy"></div><div class="gallery-tile"><img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=700&q=80" alt="Classroom learning" loading="lazy"></div></div></div></section>
<section id="contact" class="content-section"><div class="container"><div class="section-head"><div><span class="eyebrow">Get in touch</span><h2 class="section-title">Contact Our School</h2></div></div><div class="contact-grid"><div class="contact-info"><div class="contact-row"><span class="card-icon">📍</span><div><strong>School Address</strong><p>${settings.address || 'School address'}${settings.city ? ', ' + settings.city : ', Nepal'}</p></div></div><div class="contact-row"><span class="card-icon">☎</span><div><strong>Phone</strong><p>${settings.phonePrimary || '+977-9800000000'}</p></div></div><div class="contact-row"><span class="card-icon">✉</span><div><strong>Email</strong><p>${settings.email || 'info@school.example'}</p></div></div>${settings.facebookUrl ? `<div class="contact-row"><span class="card-icon">f</span><div><strong>Social Media</strong><p><a class="text-link" href="${settings.facebookUrl}" target="_blank" rel="noopener noreferrer">Facebook Page</a></p></div></div>` : ''}</div><div class="form-card"><h3 style="color:var(--navy);font-size:1.35rem;margin-bottom:18px">Send us a message</h3><form id="contact-form"><div class="field"><label>Your name *</label><input class="form-input" name="name" placeholder="Your name" required></div><div class="field"><label>Email *</label><input class="form-input" name="email" type="email" placeholder="you@example.com" required></div><div class="field" style="grid-column:1/-1"><label>Message *</label><textarea class="form-textarea" name="body" placeholder="How can we help you?" required></textarea></div><div class="field" style="grid-column:1/-1"><button type="submit" class="btn btn-navy" style="width:100%">Send Message</button><div id="contact-message" class="form-message"></div></div></form></div></div></div></section>
</main>
<footer><div class="container"><div class="footer-grid"><div><h3>${sName}</h3><p>${sTagline}</p><p style="margin-top:12px">Committed to learning, character, and a brighter future.</p></div><div><h4>Quick Links</h4><p><a href="#about" class="text-link">About</a></p><p><a href="#programs" class="text-link">Academics</a></p><p><a href="#notices" class="text-link">Notices</a></p></div><div><h4>Contact</h4><p>${settings.phonePrimary || '+977-9800000000'}</p><p>${settings.email || 'info@school.example'}</p><p>© <span id="year">${new Date().getFullYear()}</span></p></div></div></div></footer>
<script>
const escapeHTML = (value) => String(value ?? '').replace(/[&<>\"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const showMessage = (id, message, good) => { const el = document.getElementById(id); if (!el) return; el.textContent = message; el.className = 'form-message ' + (good ? 'status-success' : 'status-error'); };
async function loadDynamicContent() {
  try {
    const response = await fetch('/api/public-data');
    if (!response.ok) throw new Error('Could not load school content');
    const data = await response.json();
    const notices = data.notices || [];
    const events = data.events || [];
    const programs = data.programs || [];
    const facilities = data.facilities || [];
    const gallery = data.gallery || [];

    document.getElementById('notices-list').innerHTML = notices.length ? notices.map(item => '<div class="notice-item"><strong>' + escapeHTML(item.title || 'Notice') + '</strong><p>' + escapeHTML(item.description || '') + '</p></div>').join('') : '<div class="notice-item"><p class="muted">No notices available right now.</p></div>';
    document.getElementById('events-list').innerHTML = events.length ? events.map(item => '<div class="event-item"><strong>' + escapeHTML(item.title || 'Event') + '</strong><p>' + escapeHTML(item.description || '') + '</p></div>').join('') : '<div class="event-item"><p class="muted">No upcoming events.</p></div>';
    if (programs.length) document.getElementById('programs-list').innerHTML = programs.map(item => '<div class="card"><span class="card-icon">📘</span><h3>' + escapeHTML(item.title || 'Program') + '</h3><p>' + escapeHTML(item.description || '') + '</p></div>').join('');
    if (gallery.length) document.getElementById('gallery-grid').innerHTML = gallery.slice(0, 9).map(item => '<div class="gallery-tile"><img src="' + escapeHTML(item.imageUrl || item.image || item.url || 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=700&q=80') + '" alt="' + escapeHTML(item.title || 'School image') + '" loading="lazy"></div>').join('');
    if (facilities.length) {
      const facilityContainer = document.getElementById('facilities-list');
      if (facilityContainer) facilityContainer.innerHTML = facilities.map(item => '<div class="facility-item"><strong>' + escapeHTML(item.icon || '✓') + ' ' + escapeHTML(item.title || 'Facility') + '</strong><p>' + escapeHTML(item.description || '') + '</p></div>').join('');
    }
  } catch (error) {
    document.getElementById('notices-list').innerHTML = '<div class="notice-item"><p class="muted">Notices are temporarily unavailable.</p></div>';
    document.getElementById('events-list').innerHTML = '<div class="event-item"><p class="muted">Events are temporarily unavailable.</p></div>';
  }
}
async function submitForm(formId, endpoint, messageId, successMessage) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const originalText = button ? button.textContent : 'Submit';
    if (button) { button.disabled = true; button.textContent = 'Sending…'; }
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const response = await fetch(endpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Request failed');
      showMessage(messageId, successMessage(result), true); form.reset();
    } catch (error) {
      showMessage(messageId, error.message || 'Something went wrong. Please try again.', false);
    } finally {
      if (button) { button.disabled = false; button.textContent = originalText; }
    }
  });
}
submitForm('admission-form', '/api/admissions', 'admission-message', (result) => 'Inquiry submitted! Reference number: ' + result.refNo + '.');
submitForm('contact-form', '/api/contact', 'contact-message', () => 'Message sent successfully. Thank you!');
loadDynamicContent();
</script>
</body>
</html>`;
    res.type('html').send(html);
}));

app.use((err, req, res, next) => {
    console.error('Request error:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
            ? 'Something went wrong. Please try again later.'
            : (err.message || 'Internal server error')
    });
});

if (require.main === module) {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`School website server running on port ${port}`);
    });
}

module.exports = app;
