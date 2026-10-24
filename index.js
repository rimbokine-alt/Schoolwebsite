require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const getAdminDashboardHTML = require('./admin.js');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.SESSION_SECRET;
let isConnected = false;

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
    if (isConnected && mongoose.connection.readyState === 1) return;
    if (!MONGODB_URI) throw new Error('Missing MONGODB_URI environment variable.');
    await mongoose.connect(MONGODB_URI);
    isConnected = mongoose.connection.readyState === 1;

    const adminCount = await Admin.countDocuments();
    if (adminCount === 0 && process.env.ADMIN_BOOTSTRAP_SECRET) {
        const hashed = await bcrypt.hash(process.env.ADMIN_BOOTSTRAP_SECRET, 10);
        await Admin.create({ username: 'admin', password: hashed });
    }
    const settingsCount = await Settings.countDocuments();
    if (settingsCount === 0) await Settings.create({});
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
    const admin = await Admin.findOne({ username: req.body.username });
    if (!admin || !(await bcrypt.compare(req.body.password || '', admin.password))) {
        return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const token = jwt.sign({ id: admin._id }, JWT_SECRET, { expiresIn: '1d' });
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    });
    res.json({ success: true });
}));

app.post('/api/admin/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
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
    const item = await Message.findByIdAndDelete(req.params.id);
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
nav{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:12px;text-decoration:none;min-width:0}.brand-mark{width:46px;height:46px;display:grid;place-items:center;background:var(--navy);color:var(--gold);border-radius:12px;font-size:1.35rem;flex-shrink:0}.brand-name{font-weight:850;color:var(--navy);font-size:1.08rem;line-height:1.2}.brand-small{display:block;color:var(--muted);font-size:.72rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-top:4px}
.nav-links{display:flex;align-items:center;gap:23px}.nav-links a{text-decoration:none;font-weight:650;font-size:.92rem;color:#344054}.nav-links a:hover{color:var(--gold)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 20px;border-radius:8px;background:var(--gold);color:var(--navy);text-decoration:none;border:1px solid var(--gold);font-weight:800;cursor:pointer;transition:transform .2s,background .2s}.btn:hover{transform:translateY(-2px);background:#e3bf79}.btn-outline{background:transparent;color:#fff;border-color:rgba(255,255,255,.75)}.btn-navy{background:var(--navy);color:#fff;border-color:var(--navy)}
.hero{position:relative;min-height:490px;display:flex;align-items:flex-end;background:#183c55;overflow:hidden;color:#fff}.hero-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,25,42,.86),rgba(8,25,42,.42) 58%,rgba(8,25,42,.16)),linear-gradient(0deg,rgba(8,25,42,.4),transparent 65%)}.hero-content{position:relative;z-index:1;width:100%;max-width:1200px;margin:0 auto;padding:78px 24px 58px}.hero-kicker{display:inline-block;color:var(--gold);font-weight:850;text-transform:uppercase;letter-spacing:.16em;font-size:.78rem;margin-bottom:14px}.hero h1{max-width:850px;font-size:clamp(2.35rem,5.4vw,4.6rem);line-height:1.06;letter-spacing:-.035em;margin-bottom:18px}.hero p{max-width:650px;color:#f1f5f9;font-size:1.1rem;margin-bottom:27px}.hero-actions{display:flex;gap:12px;flex-wrap:wrap}
.quick-wrap{position:relative;margin-top:-1px;background:#fff;border-bottom:1px solid var(--line)}.quick-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:0}.quick-card{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:9px;min-height:132px;padding:22px 12px;text-decoration:none;border-right:1px solid var(--line);transition:background .2s}.quick-card:first-child{border-left:1px solid var(--line)}.quick-card:hover{background:#f7f4ec}.quick-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:12px;background:#f7f0e2;color:var(--navy);font-size:1.35rem}.quick-card strong{font-size:.94rem;color:var(--navy)}.quick-card span:last-child{font-size:.77rem;color:var(--muted)}
section.content-section{padding:76px 0}.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:30px}.eyebrow{color:#a57a2b;font-weight:850;text-transform:uppercase;letter-spacing:.14em;font-size:.75rem;margin-bottom:8px}.section-title{font-size:clamp(1.8rem,3.5vw,2.6rem);line-height:1.18;color:var(--navy);letter-spacing:-.025em}.section-lead{color:var(--muted);max-width:650px;margin-top:10px}
.about-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center}.about-photo{width:100%;height:360px;object-fit:cover;border-radius:14px;box-shadow:var(--shadow);background:#e6edf3}.about-copy p{color:#526171;margin:16px 0 24px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:24px}.stat{padding:17px;background:#fff;border:1px solid var(--line);border-radius:10px}.stat strong{display:block;color:var(--navy);font-size:1.3rem}.stat span{font-size:.78rem;color:var(--muted)}
.cards-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.card{background:#fff;border:1px solid var(--line);border-radius:13px;padding:25px;box-shadow:0 5px 18px rgba(16,42,67,.035)}.card h3{color:var(--navy);margin:11px 0 8px;font-size:1.13rem}.card p{color:var(--muted);font-size:.94rem}.card-icon{width:48px;height:48px;display:grid;place-items:center;background:#f7f0e2;color:var(--navy);font-size:1.45rem;border-radius:12px}
.notice-list{background:#fff;border:1px solid var(--line);border-radius:13px;overflow:hidden}.notice-item{padding:18px 20px;border-bottom:1px solid var(--line)}.notice-item:last-child{border-bottom:0}.notice-item strong{color:var(--navy)}.notice-item p{color:var(--muted);font-size:.9rem;margin-top:5px}
.admission-band{background:var(--navy);color:#fff;border-radius:16px;padding:38px;display:flex;align-items:center;justify-content:space-between;gap:24px}.admission-band h2{font-size:clamp(1.6rem,3vw,2.3rem);line-height:1.2}.admission-band p{color:#d8e2ec;margin-top:10px;max-width:650px}
.form-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:28px;max-width:720px;margin:auto;box-shadow:var(--shadow)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.field{margin-bottom:14px}.field.full{grid-column:1/-1}.field label{display:block;font-size:.86rem;font-weight:750;margin-bottom:6px;color:#344054}.form-input{width:100%;padding:13px 14px;border:1px solid #d0d8e2;border-radius:8px;background:#fff;color:var(--ink);font-size:1rem;outline:none}.form-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(214,173,96,.18)}.form-message{margin-top:12px;font-weight:700}
.gallery-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.gallery-tile{height:210px;border-radius:12px;overflow:hidden;background:#e7edf2}.gallery-tile img{width:100%;height:100%;object-fit:cover;transition:transform .3s}.gallery-tile:hover img{transform:scale(1.04)}
.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.contact-info{display:grid;gap:14px}.contact-row{display:flex;gap:14px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px}.contact-row .card-icon{flex-shrink:0}.contact-row strong{display:block;color:var(--navy)}.contact-row p{color:var(--muted);font-size:.92rem}
footer{background:#0b2034;color:#e5edf5;padding:45px 0 22px}.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:30px}.footer-grid h3,.footer-grid h4{color:#fff;margin-bottom:12px}.footer-grid p,.footer-grid a{color:#c5d2df;font-size:.92rem;text-decoration:none}.footer-grid a:hover{color:var(--gold)}.footer-bottom{border-top:1px solid #294158;margin-top:30px;padding-top:18px;color:#9fb1c2;font-size:.82rem}
.muted{color:var(--muted)}.text-link{color:#9b7128;font-weight:800;text-decoration:none}.hidden{display:none}
@media(max-width:900px){.nav-links{display:none}.quick-grid{grid-template-columns:repeat(3,1fr)}.quick-card:nth-child(4){border-left:1px solid var(--line)}.quick-card:nth-child(-n+3){border-bottom:1px solid var(--line)}.about-grid{grid-template-columns:1fr;gap:28px}.about-photo{height:300px}.cards-3{grid-template-columns:1fr 1fr}.hero{min-height:450px}.footer-grid{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.container{padding:0 17px}.topbar-inner{justify-content:center;text-align:center}.topbar-inner span:nth-child(2){display:none}nav{min-height:68px}.brand-mark{width:40px;height:40px}.brand-name{font-size:.94rem}.nav-cta{padding:10px 12px;font-size:.84rem}.hero{min-height:430px}.hero-content{padding:58px 19px 38px}.hero h1{font-size:2.45rem}.hero p{font-size:1rem}.quick-grid{grid-template-columns:repeat(2,1fr)}.quick-card{min-height:116px;border-bottom:1px solid var(--line)}.quick-card:nth-child(odd){border-left:1px solid var(--line)}.quick-card:nth-child(even){border-right:1px solid var(--line)}section.content-section{padding:54px 0}.section-head{display:block}.cards-3{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr 1fr}.stat{padding:12px 8px}.stat strong{font-size:1.1rem}.stat span{font-size:.72rem}.admission-band{padding:26px;display:block}.admission-band .btn{margin-top:18px}.form-card{padding:19px}.form-grid{grid-template-columns:1fr}.field.full{grid-column:auto}.gallery-grid{grid-template-columns:1fr 1fr}.gallery-tile{height:145px}.contact-grid{grid-template-columns:1fr}.footer-grid{grid-template-columns:1fr}.hero-actions .btn{width:100%}}
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
<img class="hero-photo" src="${settings.heroImageUrl || 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1800&q=85'}" alt="School building and campus" onerror="this.style.display='none'">
<div class="hero-content"><span class="hero-kicker">Welcome to our school</span><h1>${settings.heroTitle || sName}</h1><p>${settings.heroSubtitle || sTagline}</p><div class="hero-actions"><a href="#admission" class="btn">Admission Inquiry ↗</a><a href="#about" class="btn btn-outline">Discover Our School</a></div></div>
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
<div><span class="eyebrow">Who we are</span><h2 class="section-title" style="text-align:left">${settings.aboutTitle || 'Learning today. Leading tomorrow.'}</h2><p class="section-lead">${settings.aboutDescription || 'We are committed to helping every student learn with confidence, discover their strengths, and build a bright future in a caring school community.'}</p>
${settings.principalName ? `<p style="margin-top:18px"><strong>Principal:</strong> ${settings.principalName}</p>` : ''}
<div class="stats"><div class="stat"><strong>Quality</strong><span>Student-focused learning</span></div><div class="stat"><strong>Care</strong><span>Supportive community</span></div><div class="stat"><strong>Growth</strong><span>Skills for the future</span></div></div>
<p style="margin-top:22px"><a class="btn btn-navy" href="#contact">Get to Know Us</a></p></div>
<img class="about-photo" src="${settings.heroImageUrl || 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1000&q=80'}" alt="Students learning at school" loading="lazy">
</div></section>
<section id="programs" class="content-section" style="background:#fff"><div class="container"><div class="section-head"><div><span class="eyebrow">Learning pathways</span><h2 class="section-title">Academics & Programs</h2><p class="section-lead">Building strong foundations, curiosity, creativity, and confidence at every stage.</p></div></div><div id="programs-list" class="cards-3">
<div class="card"><span class="card-icon">🌱</span><h3>Early Learning</h3><p>A warm, welcoming foundation for curious young minds.</p></div>
<div class="card"><span class="card-icon">📘</span><h3>Primary Education</h3><p>Strong basics, creativity, and confidence for lifelong learning.</p></div>
<div class="card"><span class="card-icon">🎓</span><h3>Secondary Education</h3><p>Knowledge and skills to prepare students for future opportunities.</p></div>
</div></div></section>
<section id="notices" class="content-section"><div class="container"><div class="section-head"><div><span class="eyebrow">Stay informed</span><h2 class="section-title">Latest Notices</h2><p class="section-lead">Important school announcements and updates in one place.</p></div><a class="text-link" href="#contact">Need help? Contact us →</a></div><div class="notice-list" id="notices-list"><div class="notice-item"><p class="muted">Loading latest notices…</p></div></div></div></section>
<section id="events" class="content-section" style="background:#fff"><div class="container"><div class="section-head"><div><span class="eyebrow">School life</span><h2 class="section-title">Events & Facilities</h2><p class="section-lead">Explore activities and facilities that support student development.</p></div></div><div class="cards-3"><div class="card"><span class="card-icon">🎉</span><h3>School Events</h3><div id="events-list"><p>Loading events…</p></div></div><div class="card"><span class="card-icon">🔬</span><h3>Learning Facilities</h3><div id="facilities-list"><p>Supportive learning spaces and student activities.</p></div></div><div class="card"><span class="card-icon">🤝</span><h3>Student Community</h3><p>Encouraging teamwork, respect, participation, and personal growth.</p></div></div></div></section>
<section id="admission" class="content-section"><div class="container"><div class="admission-band"><div><span class="hero-kicker">Join our community</span><h2>Start your learning journey with us.</h2><p>Send an admission inquiry and our school team will get in touch with you.</p></div><a class="btn" href="#admission-form">Enquire for Admission ↓</a></div>
<div class="form-card" style="margin-top:28px"><div style="margin-bottom:22px"><span class="eyebrow">Admission inquiry</span><h2 class="section-title" style="text-align:left;font-size:1.8rem">Student Information</h2><p class="muted">Fill in the details below. Fields marked required must be completed.</p></div>
<form id="admission-form" class="form-grid"><div class="field"><label>Student's full name *</label><input class="form-input" name="studentName" placeholder="Enter student name" required></div><div class="field"><label>Applying for grade *</label><input class="form-input" name="requestedGrade" placeholder="e.g. Grade 1" required></div><div class="field"><label>Parent / guardian name *</label><input class="form-input" name="parentName" placeholder="Enter parent name" required></div><div class="field"><label>Phone number *</label><input class="form-input" name="phone" type="tel" placeholder="Contact number" required></div><div class="field"><label>Email address</label><input class="form-input" name="email" type="email" placeholder="Optional email"></div><div class="field"><label>Home address *</label><input class="form-input" name="address" placeholder="Enter address" required></div><div class="field full"><button class="btn btn-navy" type="submit" style="width:100%">Submit Admission Inquiry →</button><p id="admission-message" class="form-message" aria-live="polite"></p></div></form></div></div></section>
<section id="gallery" class="content-section" style="background:#fff"><div class="container"><div class="section-head"><div><span class="eyebrow">Memories & moments</span><h2 class="section-title">School Gallery</h2><p class="section-lead">A glimpse into learning, activities, and school life.</p></div></div><div class="gallery-grid" id="gallery-grid">
<div class="gallery-tile"><img src="${settings.heroImageUrl || 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=700&q=80'}" alt="School campus" loading="lazy"></div><div class="gallery-tile"><img src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=700&q=80" alt="Classroom learning" loading="lazy"></div><div class="gallery-tile"><img src="https://images.unsplash.com/photo-1529390079861-591de354faf5?auto=format&fit=crop&w=700&q=80" alt="Students working together" loading="lazy"></div>
</div></div></section>
<section id="contact" class="content-section"><div class="container"><div class="section-head"><div><span class="eyebrow">Get in touch</span><h2 class="section-title">Contact Our School</h2><p class="section-lead">We are happy to help with your questions.</p></div></div><div class="contact-grid"><div class="contact-info">
<div class="contact-row"><span class="card-icon">📍</span><div><strong>School Address</strong><p>${settings.address || 'School Address'}${settings.city ? ', ' + settings.city : ', Nepal'}</p></div></div>
<div class="contact-row"><span class="card-icon">☎</span><div><strong>Phone</strong><p>${settings.phonePrimary || '+977-9800000000'}</p></div></div>
<div class="contact-row"><span class="card-icon">✉</span><div><strong>Email</strong><p>${settings.email || 'info@school.example'}</p></div></div>
${settings.facebookUrl ? `<div class="contact-row"><span class="card-icon">f</span><div><strong>Social Media</strong><p><a class="text-link" href="${settings.facebookUrl}" target="_blank" rel="noopener">Visit our Facebook page ↗</a></p></div></div>` : ''}
</div><div class="form-card"><h3 style="color:var(--navy);font-size:1.35rem;margin-bottom:18px">Send us a message</h3><form id="contact-form"><div class="field"><label>Your name *</label><input class="form-input" name="name" placeholder="Your name" required></div><div class="field"><label>Email address *</label><input class="form-input" name="email" type="email" placeholder="Your email" required></div><div class="field"><label>Message *</label><textarea class="form-input" name="body" rows="4" placeholder="How can we help?" required></textarea></div><button class="btn btn-navy" type="submit" style="width:100%">Send Message →</button><p id="contact-message" class="form-message" aria-live="polite"></p></form></div></div></div></section>
</main>
<footer><div class="container"><div class="footer-grid"><div><h3>${sName}</h3><p>${sTagline}</p><p style="margin-top:12px">Committed to learning, character, and a brighter future.</p></div><div><h4>Quick Links</h4><p><a href="#about">About School</a></p><p><a href="#notices">Latest Notices</a></p><p><a href="#admission">Admission</a></p><p><a href="/admin">Admin Portal</a></p></div><div><h4>Contact</h4><p>${settings.phonePrimary || '+977-9800000000'}</p><p>${settings.email || 'info@school.example'}</p><p>${settings.address || 'School Address'}</p></div></div><div class="footer-bottom">© <span id="year"></span> ${sName}. All rights reserved.</div></div></footer>
<script>
document.getElementById('year').textContent = new Date().getFullYear();
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const showMessage = (id, message, good) => { const el = document.getElementById(id); el.textContent = message; el.style.color = good ? '#087f5b' : '#b42318'; };
async function loadDynamicContent() {
  try {
    const response = await fetch('/api/public-data');
    if (!response.ok) throw new Error('Could not load school content');
    const data = await response.json();
    const notices = data.notices || [], events = data.events || [], programs = data.programs || [], facilities = data.facilities || [];
    document.getElementById('notices-list').innerHTML = notices.length ? notices.map(item => '<div class="notice-item"><strong>' + escapeHTML(item.title || 'Notice') + '</strong><p>' + escapeHTML(item.description || '') + '</p></div>').join('') : '<div class="notice-item"><strong>No new notices</strong><p>There are no notices at the moment.</p></div>';
    document.getElementById('events-list').innerHTML = events.length ? events.map(item => '<div class="notice-item"><strong>' + escapeHTML(item.title || 'Event') + '</strong><p>' + escapeHTML(item.date ? new Date(item.date).toLocaleDateString() : '') + '</p><p>' + escapeHTML(item.description || '') + '</p></div>').join('') : '<p class="muted">No upcoming events listed.</p>';
    document.getElementById('facilities-list').innerHTML = facilities.length ? facilities.map(item => '<div class="notice-item"><strong>' + escapeHTML(item.icon || '✓') + ' ' + escapeHTML(item.title || 'Facility') + '</strong><p>' + escapeHTML(item.description || '') + '</p></div>').join('') : '<p class="muted">Supportive learning spaces and student activities.</p>';
    if (programs.length) document.getElementById('programs-list').innerHTML = programs.map(item => '<div class="card">' + (item.image ? '<img src="' + escapeHTML(item.image) + '" alt="" style="width:100%;height:160px;object-fit:cover;border-radius:9px">' : '<span class="card-icon">📘</span>') + '<h3>' + escapeHTML(item.title || 'Program') + '</h3><p>' + escapeHTML(item.gradeRange || '') + '</p><p>' + escapeHTML(item.description || '') + '</p></div>').join('');
    const gallery = data.gallery || [];
    if (gallery.length) document.getElementById('gallery-grid').innerHTML = gallery.slice(0, 9).map(item => '<div class="gallery-tile"><img src="' + escapeHTML(item.imageUrl || item.url || item.image || '') + '" alt="' + escapeHTML(item.title || 'School gallery photo') + '" loading="lazy"></div>').join('');
  } catch (error) {
    document.getElementById('notices-list').innerHTML = '<div class="notice-item"><p class="muted">Notices are temporarily unavailable.</p></div>';
    document.getElementById('events-list').innerHTML = '<p class="muted">Events are temporarily unavailable.</p>';
  }
}
async function submitForm(formId, endpoint, messageId, successMessage) {
  const form = document.getElementById(formId);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const originalText = button.textContent; button.disabled = true; button.textContent = 'Sending…';
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Request failed');
      showMessage(messageId, successMessage(result), true); form.reset();
    } catch (error) { showMessage(messageId, error.message || 'Something went wrong. Please try again.', false); }
    finally { button.disabled = false; button.textContent = originalText; }
  });
}
submitForm('admission-form','/api/admissions','admission-message',result => 'Inquiry submitted! Reference number: ' + result.refNo + '.');
submitForm('contact-form','/api/contact','contact-message',() => 'Message sent successfully. Thank you!');
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
        error: process.env.NODE_ENV === 'production'
            ? 'Something went wrong. Please try again later.'
            : (err.message || 'Internal server error')
    });
});

module.exports = app;
