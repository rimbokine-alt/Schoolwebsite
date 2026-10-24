module.exports = function getAdminDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard | School Management</title>
    <style>
        :root {
            --primary: #4F7CFF; --secondary: #8B5CF6; --bg: #F5F7FF; --text: #202747; --white: #FFFFFF;
            --clay-bg: #E8ECF7;
            --clay-shadow: 12px 12px 24px #c8d0e7, -12px -12px 24px #ffffff;
            --clay-inner: inset 6px 6px 12px #c8d0e7, inset -6px -6px 12px #ffffff;
            --success: #2DD4BF; --danger: #FF7B72; --warn: #FFD166;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, sans-serif; }
        body { background: var(--bg); color: var(--text); display: flex; height: 100vh; overflow: hidden; }
        
        /* Claymorphism Utilities */
        .clay { background: var(--clay-bg); border-radius: 24px; box-shadow: var(--clay-shadow); border: 1px solid rgba(255,255,255,0.6); }
        .clay-btn { background: var(--primary); color: var(--white); border: none; padding: 12px 24px; border-radius: 16px; cursor: pointer; font-weight: bold; box-shadow: 6px 6px 12px #c8d0e7, -6px -6px 12px #ffffff; transition: 0.2s; }
        .clay-btn:active { box-shadow: inset 4px 4px 8px rgba(0,0,0,0.2), inset -4px -4px 8px rgba(255,255,255,0.3); }
        .clay-input { width: 100%; padding: 14px; border: none; background: var(--clay-bg); border-radius: 16px; box-shadow: var(--clay-inner); color: var(--text); outline: none; margin-bottom: 16px; }
        
        /* Layout */
        #login-screen { position: fixed; inset: 0; background: var(--bg); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .login-box { padding: 40px; width: 100%; max-width: 400px; text-align: center; }
        
        .sidebar { width: 260px; padding: 24px; height: 100%; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; background: var(--clay-bg); z-index: 10; }
        .sidebar h2 { margin-bottom: 24px; font-size: 1.2rem; color: var(--primary); }
        .nav-item { padding: 12px 20px; border-radius: 16px; cursor: pointer; font-weight: 500; transition: 0.3s; }
        .nav-item:hover, .nav-item.active { background: var(--clay-bg); box-shadow: var(--clay-shadow); color: var(--primary); }
        
        .main-content { flex: 1; padding: 32px; overflow-y: auto; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
        
        /* Views & Tables */
        .view-section { display: none; animation: fadeIn 0.3s ease; }
        .view-section.active { display: block; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .grid-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; margin-bottom: 32px; }
        .stat-card { padding: 24px; text-align: center; }
        .stat-card h3 { font-size: 2rem; color: var(--primary); margin-bottom: 8px; }
        
        table { width: 100%; border-collapse: separate; border-spacing: 0 12px; }
        th { text-align: left; padding: 12px; color: var(--secondary); font-weight: 600; }
        td { padding: 16px 12px; background: var(--clay-bg); }
        tr td:first-child { border-radius: 16px 0 0 16px; }
        tr td:last-child { border-radius: 0 16px 16px 0; }
        tr { box-shadow: 4px 4px 8px #c8d0e7, -4px -4px 8px #ffffff; transition: 0.2s; }
        tr:hover { transform: translateY(-2px); }
        
        /* Modals & Forms */
        .modal { position: fixed; inset: 0; background: rgba(32,39,71,0.5); backdrop-filter: blur(4px); display: none; justify-content: center; align-items: center; z-index: 100; }
        .modal.active { display: flex; }
        .modal-content { padding: 32px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
        
        .toast { position: fixed; bottom: 24px; right: 24px; padding: 16px 24px; border-radius: 16px; color: white; transform: translateX(150%); transition: 0.3s; z-index: 2000; }
        .toast.show { transform: translateX(0); }
        .toast.success { background: var(--success); }
        .toast.error { background: var(--danger); }
        
        .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .settings-tabs { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .tab-btn { padding: 8px 16px; border-radius: 12px; cursor: pointer; background: transparent; border: none; font-weight: 500; }
        .tab-btn.active { background: var(--primary); color: white; box-shadow: 4px 4px 8px #c8d0e7, -4px -4px 8px #ffffff; }
        
        .badge { padding: 4px 8px; border-radius: 8px; font-size: 0.8rem; }
        .badge.pending { background: var(--warn); color: #000; }
        .badge.approved { background: var(--success); color: white; }
        .badge.rejected { background: var(--danger); color: white; }
        
        .actions button { margin-right: 8px; padding: 6px 12px; border-radius: 8px; font-size: 0.85rem; border:none; cursor:pointer; }
    </style>
</head>
<body>

<div id="login-screen">
    <div class="clay login-box">
        <h2 style="margin-bottom: 24px; color: var(--primary);">Admin Portal</h2>
        <form id="login-form">
            <input type="text" id="username" class="clay-input" placeholder="Username" required>
            <input type="password" id="password" class="clay-input" placeholder="Password" required>
            <button type="submit" class="clay-btn" style="width: 100%;">Secure Login</button>
        </form>
    </div>
</div>

<div class="sidebar">
    <h2>Bright Dashboard</h2>
    <div class="nav-item active" data-target="dashboard">Overview</div>
    <div class="nav-item" data-target="settings">School Settings</div>
    <div class="nav-item" data-target="admissions">Admissions</div>
    <div class="nav-item" data-target="notices">Notices</div>
    <div class="nav-item" data-target="events">Events</div>
    <div class="nav-item" data-target="programs">Academic Programs</div>
    <div class="nav-item" data-target="teachers">Teachers</div>
    <div class="nav-item" data-target="facilities">Facilities</div>
    <div class="nav-item" data-target="gallery">Gallery</div>
    <div class="nav-item" data-target="stats">Statistics</div>
    <div class="nav-item" data-target="messages">Messages</div>
    <div style="flex:1;"></div>
    <div class="nav-item" id="logout-btn" style="color: var(--danger);">Logout</div>
</div>

<div class="main-content">
    <div class="header">
        <h1 id="page-title">Dashboard Overview</h1>
    </div>
    
    <!-- Views injected here by JS -->
    <div id="views-container"></div>
</div>

<!-- Generic Modal -->
<div class="modal" id="crud-modal">
    <div class="clay modal-content">
        <h2 id="modal-title" style="margin-bottom: 24px;">Edit</h2>
        <form id="crud-form">
            <div id="modal-body"></div>
            <div style="display:flex; justify-content:flex-end; gap:12px; margin-top: 24px;">
                <button type="button" class="clay-btn" style="background:var(--text);" onclick="closeModal()">Cancel</button>
                <button type="submit" class="clay-btn">Save Changes</button>
            </div>
        </form>
    </div>
</div>

<div class="toast" id="toast">Message</div>

<script>
    // System State & Config
    const API = '/api/admin';
    let currentEntity = null;
    let settingsData = {};
    
    // Schema definitions for the universal CRUD engine
    const schemas = {
        notices: { title: 'Notice', fields: [ {name:'title', type:'text'}, {name:'category', type:'text'}, {name:'description', type:'textarea'}, {name:'isPublished', type:'checkbox'} ] },
        events: { title: 'Event', fields: [ {name:'title', type:'text'}, {name:'date', type:'date'}, {name:'category', type:'text'}, {name:'description', type:'textarea'}, {name:'image', type:'text'}, {name:'isPublished', type:'checkbox'} ] },
        programs: { title: 'Academic Program', fields: [ {name:'title', type:'text'}, {name:'gradeRange', type:'text'}, {name:'description', type:'textarea'}, {name:'image', type:'text'}, {name:'isPublished', type:'checkbox'} ] },
        teachers: { title: 'Teacher', fields: [ {name:'name', type:'text'}, {name:'designation', type:'text'}, {name:'department', type:'text'}, {name:'bio', type:'textarea'}, {name:'image', type:'text'} ] },
        facilities: { title: 'Facility', fields: [ {name:'title', type:'text'}, {name:'description', type:'textarea'}, {name:'icon', type:'text'} ] },
        gallery: { title: 'Gallery Item', fields: [ {name:'title', type:'text'}, {name:'category', type:'text'}, {name:'imageUrl', type:'text'} ] },
        stats: { title: 'Statistic', fields: [ {name:'label', type:'text'}, {name:'value', type:'text'}, {name:'icon', type:'text'} ] }
    };

    // UI Utilities
    const showToast = (msg, type='success') => {
        const t = document.getElementById('toast');
        t.textContent = msg; t.className = \`toast show \${type}\`;
        setTimeout(() => t.className = 'toast', 3000);
    };
    
    const closeModal = () => document.getElementById('crud-modal').classList.remove('active');

    // Auth API wrapper
    async function apiCall(endpoint, method='GET', body=null) {
        const opts = { method, headers: {} };
        if(body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
        const res = await fetch(endpoint, opts);
        if(res.status === 401) { document.getElementById('login-screen').style.display = 'flex'; throw new Error('Unauthorized'); }
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || 'API Error');
        return data;
    }

    // Auth Handlers
    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
            await apiCall('/api/admin/login', 'POST', { 
                username: e.target.username.value, password: e.target.password.value 
            });
            document.getElementById('login-screen').style.display = 'none';
            initDashboard();
        } catch(err) { showToast(err.message, 'error'); }
    };

    document.getElementById('logout-btn').onclick = async () => {
        await apiCall('/api/admin/logout', 'POST');
        location.reload();
    };

    // View Routing
    document.querySelectorAll('.nav-item[data-target]').forEach(el => {
        el.onclick = () => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            el.classList.add('active');
            document.getElementById('page-title').innerText = el.innerText;
            loadView(el.dataset.target);
        };
    });

    // Main App Initialization
    async function checkAuth() {
        try { await apiCall('/api/admin/me'); document.getElementById('login-screen').style.display = 'none'; initDashboard(); } 
        catch(e) {} // remains on login
    }
    checkAuth();

    function initDashboard() { loadView('dashboard'); }

    async function loadView(view) {
        const container = document.getElementById('views-container');
        container.innerHTML = '<div class="clay" style="padding:40px;text-align:center;">Loading...</div>';
        
        try {
            if (view === 'dashboard') await renderDashboard(container);
            else if (view === 'settings') await renderSettings(container);
            else if (view === 'admissions') await renderAdmissions(container);
            else if (view === 'messages') await renderMessages(container);
            else if (schemas[view]) await renderCRUD(view, container);
        } catch (e) { container.innerHTML = \`<p style="color:var(--danger);">Error: \${e.message}</p>\`; }
    }

    // Dashboard Overview
    async function renderDashboard(container) {
        const stats = await apiCall(API + '/dashboard');
        container.innerHTML = \`
            <div class="grid-cards">
                <div class="clay stat-card"><h3>\${stats.admissions.pending}</h3><p>Pending Admissions</p></div>
                <div class="clay stat-card"><h3>\${stats.messages.unread}</h3><p>Unread Messages</p></div>
                <div class="clay stat-card"><h3>\${stats.content.notices}</h3><p>Active Notices</p></div>
                <div class="clay stat-card"><h3>\${stats.content.events}</h3><p>Upcoming Events</p></div>
            </div>
            <div class="clay" style="padding:24px;">
                <h3 style="margin-bottom:16px;">Recent Applications</h3>
                <table>
                    <tr><th>Name</th><th>Grade</th><th>Date</th><th>Status</th></tr>
                    \${stats.recentAdmissions.map(a => \`
                        <tr><td>\${a.studentName}</td><td>\${a.requestedGrade}</td>
                        <td>\${new Date(a.createdAt).toLocaleDateString()}</td>
                        <td><span class="badge \${a.status}">\${a.status}</span></td></tr>
                    \`).join('') || '<tr><td colspan="4">No recent applications</td></tr>'}
                </table>
            </div>
        \`;
    }

    // Settings Manager
    async function renderSettings(container) {
        const res = await apiCall(API + '/settings');
        settingsData = res.settings;
        
        const tabs = ['General', 'Contact', 'Appearance', 'Homepage'];
        
        let html = \`<div class="clay" style="padding:32px;">
            <div class="settings-tabs">
                \${tabs.map((t,i) => \`<button class="tab-btn \${i===0?'active':''}" onclick="switchSettingsTab('\${t}')">\${t}</button>\`).join('')}
            </div>
            <form id="settings-form">
                <div id="settings-content"></div>
                <button type="submit" class="clay-btn" style="margin-top:24px;">Save Settings</button>
            </form>
        </div>\`;
        container.innerHTML = html;
        
        window.switchSettingsTab = (tab) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText === tab));
            const c = document.getElementById('settings-content');
            if(tab === 'General') c.innerHTML = buildFields([ 'schoolName', 'shortName', 'tagline', 'logoUrl', 'establishedYear', 'academicSession', 'principalName' ]);
            if(tab === 'Contact') c.innerHTML = buildFields([ 'phonePrimary', 'email', 'address', 'city', 'facebookUrl' ]);
            if(tab === 'Appearance') c.innerHTML = buildFields([ 'colors.primary', 'colors.secondary', 'colors.background' ]);
            if(tab === 'Homepage') c.innerHTML = buildFields([ 'heroTitle', 'heroSubtitle', 'heroImageUrl', 'aboutTitle', 'aboutDescription' ]);
        };
        
        function buildFields(keys) {
            return \`<div class="settings-grid">\${keys.map(k => {
                const val = k.includes('.') ? settingsData[k.split('.')[0]][k.split('.')[1]] : settingsData[k];
                return \`<div><label style="display:block; margin-bottom:8px; font-size:0.9rem;">\${k}</label>
                <input type="text" name="\${k}" class="clay-input" value="\${val || ''}"></div>\`;
            }).join('')}</div>\`;
        }
        
        switchSettingsTab('General');
        
        document.getElementById('settings-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const updates = {};
            fd.forEach((v,k) => {
                if(k.includes('.')) { const [a,b] = k.split('.'); updates[a] = updates[a]||{}; updates[a][b] = v; }
                else updates[k] = v;
            });
            try { await apiCall(API + '/settings', 'PATCH', updates); showToast('Settings Updated!'); }
            catch(err) { showToast(err.message, 'error'); }
        };
    }

    // Universal CRUD Engine
    async function renderCRUD(entity, container) {
        currentEntity = entity;
        const data = await apiCall(\`\${API}/\${entity}\`);
        const schema = schemas[entity];
        
        container.innerHTML = \`
            <div style="margin-bottom:24px; text-align:right;">
                <button class="clay-btn" onclick="openModal()">+ Add New \${schema.title}</button>
            </div>
            <table>
                <tr>\${schema.fields.filter(f=>f.type!=='textarea').map(f => \`<th>\${f.name}</th>\`).join('')}<th>Actions</th></tr>
                \${data.map(item => \`
                    <tr>
                        \${schema.fields.filter(f=>f.type!=='textarea').map(f => \`<td>\${f.type==='checkbox' ? (item[f.name]?'Yes':'No') : (item[f.name] || '-')}</td>\`).join('')}
                        <td class="actions">
                            <button style="background:var(--secondary); color:white;" onclick='editItem(\${JSON.stringify(item).replace(/'/g, "&apos;")})'>Edit</button>
                            <button style="background:var(--danger); color:white;" onclick="deleteItem('\${item._id}')">Delete</button>
                        </td>
                    </tr>
                \`).join('')}
            </table>
        \`;
    }

    window.openModal = (item = null) => {
        const schema = schemas[currentEntity];
        document.getElementById('modal-title').innerText = item ? \`Edit \${schema.title}\` : \`Add \${schema.title}\`;
        
        let html = schema.fields.map(f => {
            const val = item ? item[f.name] : '';
            if(f.type === 'textarea') return \`<label>\${f.name}</label><textarea name="\${f.name}" class="clay-input" rows="3">\${val||''}</textarea>\`;
            if(f.type === 'checkbox') return \`<label style="display:flex; gap:12px; margin-bottom:16px; align-items:center;"><input type="checkbox" name="\${f.name}" \${val?'checked':''}> \${f.name}</label>\`;
            return \`<label>\${f.name}</label><input type="\${f.type}" name="\${f.name}" class="clay-input" value="\${val||''}" required>\`;
        }).join('');
        
        if(item) html += \`<input type="hidden" name="_id" value="\${item._id}">\`;
        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('crud-modal').classList.add('active');
    };

    window.editItem = (item) => openModal(item);

    document.getElementById('crud-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = Object.fromEntries(fd.entries());
        
        schemas[currentEntity].fields.forEach(f => { if(f.type==='checkbox') payload[f.name] = fd.has(f.name); });
        
        const id = payload._id; delete payload._id;
        const method = id ? 'PUT' : 'POST';
        const url = id ? \`\${API}/\${currentEntity}/\${id}\` : \`\${API}/\${currentEntity}\`;
        
        try {
            await apiCall(url, method, payload);
            closeModal(); showToast('Saved successfully');
            loadView(currentEntity);
        } catch(err) { showToast(err.message, 'error'); }
    };

    window.deleteItem = async (id) => {
        if(!confirm('Are you sure you want to delete this?')) return;
        try { await apiCall(\`\${API}/\${currentEntity}/\${id}\`, 'DELETE'); showToast('Deleted'); loadView(currentEntity); }
        catch(err) { showToast(err.message, 'error'); }
    };

    // Specific Handlers (Admissions & Messages)
    async function renderAdmissions(container) {
        const data = await apiCall(API + '/admissions');
        container.innerHTML = \`
            <table style="font-size:0.9rem;">
                <tr><th>Ref No</th><th>Student</th><th>Grade</th><th>Date</th><th>Status</th><th>Actions</th></tr>
                \${data.map(a => \`
                    <tr>
                        <td>\${a.refNo}</t
