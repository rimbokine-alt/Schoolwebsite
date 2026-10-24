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

// ---------------------------------------------------------
// DATABASE CONFIG & SCHEMAS (Serverless Optimized)
// ---------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/school_db';
const JWT_SECRET = process.env.SESSION_SECRET || 'fallback_secret_only_for_dev';

let isConnected;
const connectDB = async () => {
    if (isConnected) return;
    try {
        const db = await mongoose.connect(MONGODB_URI);
        isConnected = db.connections[0].readyState;
        await initializeSystem();
    } catch (err) { console.error('MongoDB Connection Error:', err); }
};

const AdminSchema = new mongoose.Schema({ username: { type: String, required: true, unique: true }, password: { type: String, required: true } });
const SettingsSchema = new mongoose.Schema({
    schoolName: { type: String, default: "Bright Future Academy" }, shortName: String, tagline: String,
    logoUrl: String, establishedYear: String, academicSession: String, principalName: String,
    phonePrimary: String, email: String, address: String, city: String, facebookUrl: String,
    heroTitle: { type: String, default: "Welcome to Bright Future Academy" }, heroSubtitle: String, heroImageUrl: String,
    aboutTitle: String, aboutDescription: String,
    colors: { primary: { type: String, default: "#4F7CFF" }, secondary: { type: String, default: "#8B5CF6" }, background: { type: String, default: "#F5F7FF" } }
});
const AdmissionSchema = new mongoose.Schema({ studentName: String, requestedGrade: String, parentName: String, phone: String, email: String, address: String, status: { type: String, default: 'pending' }, refNo: String }, { timestamps: true });
const NoticeSchema = new mongoose.Schema({ title: String, category: String, description: String, isPublished: { type: Boolean, default: true } }, { timestamps: true });
const EventSchema = new mongoose.Schema({ title: String, date: Date, category: String, description: String, image: String, isPublished: { type: Boolean, default: true } }, { timestamps: true });
const ProgramSchema = new mongoose.Schema({ title: String, gradeRange: String, description: String, image: String, isPublished: { type: Boolean, default: true } });
const TeacherSchema = new mongoose.Schema({ name: String, designation: String, department: String, bio: String, image: String });
const FacilitySchema = new mongoose.Schema({ title: String, description: String, icon: String });
const GallerySchema = new mongoose.Schema({ title: String, category: String, imageUrl: String });
const StatSchema = new mongoose.Schema({ label: String, value: String, icon: String });
const MessageSchema = new mongoose.Schema({ name: String, email: String, body: String, isRead: { type: Boolean, default: false } }, { timestamps: true });

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

// INITIALIZATION
async function initializeSystem() {
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0 && process.env.ADMIN_BOOTSTRAP_SECRET) {
        const hashed = await bcrypt.hash(process.env.ADMIN_BOOTSTRAP_SECRET, 10);
        await Admin.create({ username: 'admin', password: hashed });
    }
    const settingsCount = await Settings.countDocuments();
    if (settingsCount === 0) await Settings.create({});
}

// ---------------------------------------------------------
// MIDDLEWARE
// ---------------------------------------------------------
const requireAuth = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded; next();
    } catch (e) { res.status(401).json({ error: 'Invalid Session' }); }
};

// ---------------------------------------------------------
// API ROUTES
// ---------------------------------------------------------

// --- PUBLIC APIs ---
app.get('/api/settings', async (req, res) => { await connectDB(); const s = await Settings.findOne(); res.json(s); });
app.get('/api/public-data', async (req, res) => {
    await connectDB();
    const [notices, events, programs, teachers, facilities, gallery, stats] = await Promise.all([
        Notice.find({ isPublished: true }).sort('-createdAt').limit(5),
        Event.find({ isPublished: true, date: { $gte: new Date() } }).sort('date').limit(5),
        Program.find({ isPublished: true }), Teacher.find(), Facility.find(), Gallery.find(), Stat.find()
    ]);
    res.json({ notices, events, programs, teachers, facilities, gallery, stats });
});
app.post('/api/admissions', async (req, res) => {
    await connectDB();
    const refNo = 'APP-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    await Admission.create({ ...req.body, refNo });
    res.json({ success: true, refNo });
});
app.post('/api/contact', async (req, res) => {
    await connectDB();
    await Message.create(req.body);
    res.json({ success: true });
});

// --- ADMIN AUTH ---
app.post('/api/admin/login', async (req, res) => {
    await connectDB();
    const admin = await Admin.findOne({ username: req.body.username });
    if (!admin || !(await bcrypt.compare(req.body.password, admin.password))) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: admin._id }, JWT_SECRET, { expiresIn: '1d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    res.json({ success: true });
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie('token').json({ success: true }); });
app.get('/api/admin/me', requireAuth, (req, res) => res.json({ success: true }));

// --- ADMIN PROTECTED APIs ---
app.get('/api/admin/dashboard', requireAuth, async (req, res) => {
    await connectDB();
    const stats = {
        admissions: { pending: await Admission.countDocuments({ status: 'pending' }) },
        messages: { unread: await Message.countDocuments({ isRead: false }) },
        content: { notices: await Notice.countDocuments(), events: await Event.countDocuments() },
        recentAdmissions: await Admission.find().sort('-createdAt').limit(5)
    };
    res.json(stats);
});
app.get('/api/admin/settings', requireAuth, async (req, res) => { await connectDB(); res.json({ settings: await Settings.findOne() }); });
app.patch('/api/admin/settings', requireAuth, async (req, res) => {
    await connectDB();
    const s = await Settings.findOne();
    Object.assign(s, req.body);
    await s.save();
    res.json({ success: true });
});

// Generic CRUD Generator for Admin
const generateCRUD = (path, Model) => {
    app.get(`/api/admin/${path}`, requireAuth, async (req, res) => { await connectDB(); res.json(await Model.find().sort('-createdAt')); });
    app.post(`/api/admin/${path}`, requireAuth, async (req, res) => { await connectDB(); res.json(await Model.create(req.body)); });
    app.put(`/api/admin/${path}/:id`, requireAuth, async (req, res) => { await connectDB(); res.json(await Model.findByIdAndUpdate(req.params.id, req.body, {new:true})); });
    app.delete(`/api/admin/${path}/:id`, requireAuth, async (req, res) => { await connectDB(); await Model.findByIdAndDelete(req.params.id); res.json({success:true}); });
};
generateCRUD('notices', Notice);
generateCRUD('events', Event);
generateCRUD('programs', Program);
generateCRUD('teachers', Teacher);
generateCRUD('facilities', Facility);
generateCRUD('gallery', Gallery);
generateCRUD('stats', Stat);

app.get('/api/admin/admissions', requireAuth, async (req, res) => { await connectDB(); res.json(await Admission.find().sort('-createdAt')); });
app.patch('/api/admin/admissions/:id', requireAuth, async (req, res) => { await connectDB(); res.json(await Admission.findByIdAndUpdate(req.params.id, {status: req.body.status})); });
app.get('/api/admin/messages', requireAuth, async (req, res) => { await connectDB(); res.json(await Message.find().sort('-createdAt')); });
app.patch('/api/admin/messages/:id', requireAuth, async (req, res) => { await connectDB(); res.json(await Message.findByIdAndUpdate(req.params.id, {isRead: req.body.isRead})); });
app.delete('/api/admin/messages/:id', requireAuth, async (req, res) => { await connectDB(); await Message.findByIdAndDelete(req.params.id); res.json({success:true}); });

// ---------------------------------------------------------
// DASHBOARD & WEBSITE RENDERING (Serverless Compatible)
// ---------------------------------------------------------

app.get('/admin', (req, res) => {
    res.send(getAdminDashboardHTML());
});

app.get('/', async (req, res) => {
    await connectDB();
    const settings = await Settings.findOne() || {};
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
        :root {
            --primary: ${primary}; --secondary: ${secondary}; --bg: ${bg};
            --text: #202747; --white: #FFFFFF;
            --clay-bg: #E8ECF7;
            --clay-shadow: 12px 12px 24px #c8d0e7, -12px -12px 24px #ffffff;
            --clay-inner: inset 6px 6px 12px #c8d0e7, inset -6px -6px 12px #ffffff;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, sans-serif; }
        body { background: var(--bg); color: var(--text); line-height: 1.6; overflow-x: hidden; }
        
        .clay { background: var(--clay-bg); border-radius: 28px; box-shadow: var(--clay-shadow); border: 1px solid rgba(255,255,255,0.6); padding: 32px; }
        .clay-btn { display: inline-block; background: var(--primary); color: var(--white); border: none; padding: 14px 28px; border-radius: 16px; cursor: pointer; font-weight: bold; font-size: 1rem; box-shadow: 6px 6px 12px #c8d0e7, -6px -6px 12px #ffffff; transition: 0.2s; text-decoration: none; }
        .clay-btn:active { box-shadow: inset 4px 4px 8px rgba(0,0,0,0.2), inset -4px -4px 8px rgba(255,255,255,0.3); }
        .clay-btn.secondary { background: var(--clay-bg); color: var(--primary); }
        
        .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
        
        /* Nav */
        header { position: sticky; top: 0; z-index: 1000; background: rgba(245,247,255,0.8); backdrop-filter: blur(10px); padding: 16px 0; box-shadow: 0 4px 24px rgba(0,0,0,0.05); }
        nav { display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 1.5rem; font-weight: 800; color: var(--primary); text-decoration: none; display: flex; align-items: center; gap: 12px; }
        .nav-links { display: flex; gap: 24px; }
        .nav-links a { text-decoration: none; color: var(--text); font-weight: 500; transition: color 0.2s; }
        .nav-links a:hover { color: var(--primary); }
        
        /* Hero */
        .hero { padding: 80px 0; min-height: 80vh; display: flex; align-items: center; }
        .hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
        .hero h1 { font-size: 3.5rem; line-height: 1.2; margin-bottom: 24px; color: var(--primary); }
        .hero p { font-size: 1.2rem; margin-bottom: 32px; opacity: 0.8; }
        
        /* Sections */
        section { padding: 80px 0; }
        .section-title { text-align: center; font-size: 2.5rem; color: var(--primary); margin-bottom: 48px; }
        .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px; }
        .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; }
        
        /* Cards */
        .card { text-align: center; transition: transform 0.3s; }
        .card:hover { transform: translateY(-10px); }
        .card h3 { color: var(--secondary); margin-bottom: 12px; font-size: 1.3rem; }
        
        /* Form */
        .clay-input { width: 100%; padding: 16px; border: none; background: var(--clay-bg); border-radius: 16px; box-shadow: var(--clay-inner); color: var(--text); outline: none; margin-bottom: 24px; font-size: 1rem; }
        
        /* Footer */
        footer { background: var(--clay-bg); padding: 48px 0; box-shadow: inset 0 10px 20px rgba(0,0,0,0.02); }
        .footer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 32px; }
        .footer-grid h4 { color: var(--primary); margin-bottom: 16px; }
        
        @media (max-width: 768px) {
            .hero-grid { grid-template-columns: 1fr; text-align: center; }
            .nav-links { display: none; } /* Simplified mobile for size constraints */
            .hero h1 { font-size: 2.5rem; }
        }
    </style>
</head>
<body>

<header>
    <div class="container nav">
        <nav>
            <a href="#" class="logo">
                <div class="clay" style="padding:12px; border-radius:12px;">🏫</div>
                ${sName}
            </a>
            <div class="nav-links">
                <a href="#about">About</a>
                <a href="#academics">Academics</a>
                <a href="#admission">Admission</a>
                <a href="#contact">Contact</a>
            </div>
            <a href="#admission" class="clay-btn" style="padding: 10px 20px;">Apply Now</a>
        </nav>
    </div>
</header>

<main>
    <section class="hero container">
        <div class="hero-grid">
            <div>
                <h1>${settings.heroTitle || 'Welcome to ' + sName}</h1>
                <p>${settings.heroSubtitle || sTagline}</p>
                <div style="display:flex; gap:16px; flex-wrap:wrap; justify-content: flex-start;">
                    <a href="#admission" class="clay-btn">Apply for Admission</a>
                    <a href="#about" class="clay-btn secondary">Explore School</a>
                </div>
            </div>
            <div class="clay" style="height:400px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                ${settings.heroImageUrl ? `<img src="${settings.heroImageUrl}" alt="School Hero" style="width:100%; height:100%; object-fit:cover; border-radius:16px;">` : '<h2>Welcome</h2>'}
            </div>
        </div>
    </section>

    <section id="about" class="container">
        <h2 class="section-title">About Our School</h2>
        <div class="clay" style="text-align:center; max-width:800px; margin:0 auto;">
            <h3 style="margin-bottom:16px; color:var(--secondary);">${settings.aboutTitle || 'Our Vision'}</h3>
            <p style="font-size:1.1rem; margin-bottom:24px;">${settings.aboutDescription || 'Dedicated to providing holistic education and fostering future leaders.'}</p>
            ${settings.principalName ? `<p><strong>Principal:</strong> ${settings.principalName}</p>` : ''}
            <p><strong>Established:</strong> ${settings.establishedYear || '2010'} | <strong>Academic Session:</strong> ${settings.academicSession || '2083 B.S.'}</p>
        </div>
    </section>
    
    <section id="dynamic-content" class="container"></section>

    <section id="admission" class="container">
        <h2 class="section-title">Online Admission</h2>
        <div class="clay" style="max-width: 600px; margin: 0 auto;">
            <form id="admission-form">
                <input type="text" id="studentName" class="clay-input" placeholder="Student's Full Name" required>
                <input type="text" id="requestedGrade" class="clay-input" placeholder="Requested Grade (e.g., Grade 1)" required>
                <input type="text" id="parentName" class="clay-input" placeholder="Parent/Guardian Name" required>
                <input type="tel" id="phone" class="clay-input" placeholder="Contact Phone Number" required>
                <input type="email" id="email" class="clay-input" placeholder="Email Address (Optional)">
                <input type="text" id="address" class="clay-input" placeholder="Physical Address" required>
                <button type="submit" class="clay-btn" style="width:100%;">Submit Application</button>
            </form>
            <div id="admission-success" style="display:none; text-align:center; padding: 20px; color: #2DD4BF; font-weight:bold;"></div>
        </div>
    </section>
    
    <section id="contact" class="container">
        <h2 class="section-title">Contact Us</h2>
        <div class="grid-3">
            <div class="clay card">
                <h3>Location</h3><p>${settings.address || 'Lakeside Road'}<br>${settings.city || 'Pokhara, Nepal'}</p>
            </div>
            <div class="clay card">
                <h3>Contact</h3><p>Phone: ${settings.phonePrimary || '+977-9800000000'}<br>Email: ${settings.email || 'info@school.example'}</p>
            </div>
            <div class="clay card">
                <h3>Message Us</h3>
                <form id="contact-form">
                    <input type="text" id="c_name" class="clay-input" placeholder="Your Name" required style="padding:10px; margin-bottom:12px;">
                    <input type="email" id="c_email" class="clay-input" placeholder="Your Email" required style="padding:10px; margin-bottom:12px;">
                    <textarea id="c_body" class="clay-input" placeholder="Message" rows="3" required style="padding:10px; margin-bottom:12px;"></textarea>
                    <button type="submit" class="clay-btn" style="width:100%; padding:10px;">Send Message</button>
                </form>
            </div>
        </div>
    </section>
</main>

<footer>
    <div class="container footer-grid">
        <div>
            <h3 style="color:var(--primary); margin-bottom:16px;">${sName}</h3>
            <p>${sTagline}</p>
        </div>
        <div>
            <h4>Quick Links</h4>
            <ul style="list-style:none;">
                <li><a href="#about" style="color:inherit; text-decoration:none;">About Us</a></li>
                <li><a href="#admission" style="color:inherit; text-decoration:none;">Admissions</a></li>
                <li><a href="/admin" style="color:inherit; text-decoration:none;">Admin Portal</a></li>
            </ul>
        </div>
        <div>
            <h4>Connect</h4>
            <p>${settings.phonePrimary || '+977-9800000000'}</p>
            <p>${settings.email || 'info@school.example'}</p>
            
