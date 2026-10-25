function getAdminDashboardHTML() {
return `<!DOCTYPE html>

<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>School Admin Dashboard</title>
<style>
:root{--navy:#102a43;--gold:#d6ad60;--bg:#f4f7fb;--line:#e5eaf0;--muted:#667085}
*{box-sizing:border-box}
body{margin:0;font:15px Arial,sans-serif;background:var(--bg);color:#1d2939}
button,input,textarea,select{font:inherit}
button{border:0;border-radius:8px;padding:10px 14px;cursor:pointer;font-weight:bold}
.primary{background:var(--navy);color:white}
.gold{background:var(--gold);color:var(--navy)}
.danger{background:#fee4e2;color:#b42318}
.hidden{display:none!important}
.login{min-height:100vh;display:grid;place-items:center;padding:20px}
.login-card{background:white;padding:30px;border-radius:16px;width:min(420px,100%);box-shadow:0 10px 35px #102a4315}
.login-card h1{color:var(--navy)}
.field{margin:15px 0}
.field label{display:block;font-weight:bold;margin-bottom:6px}
.field input,.field textarea,.field select{width:100%;padding:12px;border:1px solid #d0d5dd;border-radius:8px}
.wide{width:100%}
.error{color:#b42318}
.layout{display:grid;grid-template-columns:235px 1fr;min-height:100vh}
.sidebar{background:var(--navy);color:white;padding:20px 12px}
.brand{font-size:21px;font-weight:bold;padding:12px 8px 24px}
.nav{display:grid;gap:5px}
.nav button{text-align:left;background:transparent;color:white;padding:12px}
.nav button.active,.nav button:hover{background:#ffffff20}
.main{min-width:0}
.topbar{background:white;border-bottom:1px solid var(--line);padding:18px 24px;display:flex;justify-content:space-between;align-items:center;gap:12px}
.topbar h2{margin:0;font-size:21px}
.content{padding:24px;max-width:1400px;margin:auto}
.welcome h1{margin-bottom:6px}
.muted{color:var(--muted)}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:20px 0}
.stat,.panel{background:white;border:1px solid var(--line);border-radius:12px}
.stat{padding:18px}
.stat span{display:block;color:var(--muted);font-size:13px}
.stat strong{display:block;font-size:28px;margin-top:8px}
.panel{margin:18px 0;overflow:hidden}
.panel-head{padding:17px 20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.panel-head h3{margin:0}
.panel-body{padding:20px}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;min-width:580px}
th,td{text-align:left;padding:13px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;color:var(--muted)}
td{font-size:14px}
.empty{padding:28px;text-align:center;color:var(--muted)}
.toolbar,.actions{display:flex;gap:8px;flex-wrap:wrap}
.actions button{padding:7px 10px;font-size:12px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}
.full{grid-column:1/-1}
.toast{position:fixed;bottom:20px;right:20px;background:#102a43;color:white;padding:14px;border-radius:9px;z-index:10}
@media(max-width:850px){
.layout{grid-template-columns:1fr}
.sidebar{padding:10px}
.brand{padding:10px}
.nav{display:flex;overflow-x:auto}
.nav button{white-space:nowrap}
.stats{grid-template-columns:1fr 1fr}
.content{padding:14px}
.topbar{padding:15px}
}
@media(max-width:500px){
.form-grid{grid-template-columns:1fr}
.full{grid-column:auto}
.topbar h2{font-size:17px}
}
</style>
</head>
<body><section id="login-screen" class="login">
<div class="login-card">
<h1>🏫 School Admin</h1>
<p class="muted">Sign in to manage your school website.</p>
<form id="login-form">
<div class="field">
<label>Username</label>
<input name="username" autocomplete="username" required>
</div>
<div class="field">
<label>Password</label>
<input name="password" type="password" autocomplete="current-password" required>
</div>
<button class="primary wide">Sign In →</button>
<p id="login-error" class="error"></p>
</form>
</div>
</section><div id="app" class="layout hidden">
<aside class="sidebar">
<div class="brand">🏫 School Admin</div>
<nav class="nav" id="nav">
<button class="active" data-page="dashboard">▦ Dashboard</button>
<button data-page="notices">📢 Notices</button>
<button data-page="events">📅 Events</button>
<button data-page="programs">📚 Programs</button>
<button data-page="teachers">👨‍🏫 Teachers</button>
<button data-page="facilities">🏢 Facilities</button>
<button data-page="gallery">🖼 Gallery</button>
<button data-page="stats">📈 Statistics</button>
<button data-page="admissions">📝 Admissions</button>
<button data-page="messages">✉ Messages</button>
<button data-page="settings">⚙ Settings</button>
</nav>
</aside><main class="main">
<header class="topbar">
<h2 id="page-title">Dashboard</h2>
<div class="toolbar">
<button class="gold" id="view-site">View Website ↗</button>
<button class="danger" id="logout">Logout</button>
</div>
</header>
<div id="content" class="content">Loading...</div>
</main>
</div>
<div id="toast" class="toast hidden"></div><script>
const $=s=>document.querySelector(s);
const titles={
dashboard:'Dashboard',notices:'Notices',events:'Events',
programs:'Academic Programs',teachers:'Teachers',
facilities:'Facilities',gallery:'School Gallery',
stats:'Statistics',admissions:'Admissions',
messages:'Messages',settings:'School Settings'
};

const schemas={
notices:[
['title','Title','text',1],
['category','Category','text',0],
['description','Description','textarea',1],
['isPublished','Published','checkbox',0]
],
events:[
['title','Event Title','text',1],
['date','Event Date','date',1],
['category','Category','text',0],
['description','Description','textarea',0],
['image','Image URL','url',0],
['isPublished','Published','checkbox',0]
],
programs:[
['title','Program Title','text',1],
['gradeRange','Grade Range','text',0],
['description','Description','textarea',0],
['image','Image URL','url',0],
['isPublished','Published','checkbox',0]
],
teachers:[
['name','Teacher Name','text',1],
['designation','Designation','text',0],
['department','Department','text',0],
['bio','Biography','textarea',0],
['image','Photo URL','url',0]
],
facilities:[
['title','Facility Title','text',1],
['description','Description','textarea',0],
['icon','Icon / Emoji','text',0]
],
gallery:[
['title','Photo Title','text',1],
['category','Category','text',0],
['imageUrl','Image URL','url',1]
],
stats:[
['label','Label','text',1],
['value','Value','text',1],
['icon','Icon / Emoji','text',0]
]
};

let currentPage='dashboard';
let editingId=null;

function esc(v){
return String(v??'').replace(/[&<>"']/g,c=>({
'&':'&amp;','<':'&lt;','>':'&gt;',
'"':'&quot;',"'":'&#39;'
}[c]));
}

function toast(message){
const el=$('#toast');
el.textContent=message;
el.classList.remove('hidden');
setTimeout(()=>el.classList.add('hidden'),2500);
}

async function api(url,options={}){
const response=await fetch(url,{
credentials:'same-origin',
...options,
headers:{
'Content-Type':'application/json',
...(options.headers||{})
}
});
let data={};
try{data=await response.json()}catch{}
if(!response.ok)throw new Error(data.error||'Request failed');
return data;
}

function showLogin(){
$('#login-screen').classList.remove('hidden');
$('#app').classList.add('hidden');
}

function showApp(){
$('#login-screen').classList.add('hidden');
$('#app').classList.remove('hidden');
}

$('#login-form').addEventListener('submit',async e=>{
e.preventDefault();
$('#login-error').textContent='';
const fd=new FormData(e.target);
try{
await api('/api/admin/login',{
method:'POST',
body:JSON.stringify({
username:fd.get('username'),
password:fd.get('password')
})
});
showApp();
await renderPage('dashboard');
}catch(err){
$('#login-error').textContent=err.message;
}
});

$('#logout').addEventListener('click',async()=>{
try{
await api('/api/admin/logout',{
method:'POST',body:JSON.stringify({})
});
}catch(err){}
showLogin();
});

$('#view-site').addEventListener('click',()=>{
window.open('/','_blank','noopener');
});

$('#nav').addEventListener('click',e=>{
const btn=e.target.closest('[data-page]');
if(btn)renderPage(btn.dataset.page);
});

async function checkSession(){
try{
await api('/api/admin/me');
showApp();
await renderPage('dashboard');
}catch(err){
showLogin();
}
}

async function renderPage(page){
currentPage=page;
$('#page-title').textContent=titles[page]||page;
document.querySelectorAll('#nav button').forEach(b=>{
b.classList.toggle('active',b.dataset.page===page);
});
$('#content').innerHTML='<p class="muted">Loading...</p>';

try{
if(page==='dashboard')return await dashboardPage();
if(page==='settings')return await settingsPage();
if(page==='admissions')return await admissionsPage();
if(page==='messages')return await messagesPage();
return await crudPage(page);
}catch(err){
$('#content').innerHTML=
'<div class="panel"><div class="empty">'+
esc(err.message)+
'<br><br><button class="primary" id="retry">Try Again</button>'+
'</div></div>';
$('#retry').onclick=()=>renderPage(page);
}
}

async function dashboardPage(){
const d=await api('/api/admin/dashboard');
$('#content').innerHTML=`
<div class="welcome">
<h1>Welcome back 👋</h1>
<p class="muted">Manage your school website from one place.</p>
</div>
<div class="stats">
<div class="stat"><span>Pending Admissions</span>
<strong>${d.admissions?.pending||0}</strong></div>
<div class="stat"><span>Unread Messages</span>
<strong>${d.messages?.unread||0}</strong></div>
<div class="stat"><span>Total Notices</span>
<strong>${d.content?.notices||0}</strong></div>
<div class="stat"><span>Total Events</span>
<strong>${d.content?.events||0}</strong></div>
</div>
<section class="panel">
<div class="panel-head"><h3>Recent Admissions</h3>
<button class="primary" id="all-admissions">View All</button></div>
<div class="table-wrap">
<table><thead><tr>
<th>Student</th><th>Grade</th><th>Parent</th><th>Phone</th><th>Status</th>
</tr></thead><tbody>
${(d.recentAdmissions||[]).map(a=>`
<tr><td>${esc(a.studentName)}</td>
<td>${esc(a.requestedGrade)}</td>
<td>${esc(a.parentName)}</td>
<td>${esc(a.phone)}</td>
<td>${esc(a.status||'pending')}</td></tr>`).join('')||
'<tr><td colspan="5">No admission inquiries yet.</td></tr>'}
</tbody></table></div></section>
<section class="panel"><div class="panel-head"><h3>Quick Actions</h3></div>
<div class="panel-body toolbar">
<button class="primary" data-go="notices">Manage Notices</button>
<button class="primary" data-go="events">Manage Events</button>
<button class="primary" data-go="settings">School Settings</button>
</div></section>`;
$('#all-admissions').onclick=()=>renderPage('admissions');
document.querySelectorAll('[data-go]').forEach(b=>{
b.onclick=()=>renderPage(b.dataset.go);
});
}

async function crudPage(page){
if(!schemas[page])throw new Error('Unknown section');
const rows=await api('/api/admin/'+page);
editingId=null;

const columns=schemas[page].slice(0,3);

$('#content').innerHTML=`
<section class="panel">
<div class="panel-head">
<div><h3>${esc(titles[page])}</h3>
<span class="muted">${rows.length} item(s)</span></div>
<button class="primary" id="add-item">+ Add New</button>
</div>
<div id="editor" class="panel-body hidden"></div>
${rows.length?`
<div class="table-wrap"><table>
<thead><tr>${columns.map(f=>'<th>'+esc(f[1])+'</th>').join('')}<th>Actions</th></tr></thead>
<tbody>${rows.map(r=>`
<tr>${columns.map(f=>{
let value=r[f[0]];
if(f[0]==='description')value=String(value||'').slice(0,90);
if(f[0]==='image'||f[0]==='imageUrl'){
return '<td>'+(value?'<a target="_blank" rel="noopener" href="'+esc(value)+'">View image</a>':'—')+'</td>';
}
return '<td>'+esc(value)+'</td>';
}).join('')}
<td><div class="actions">
<button class="gold" data-edit="${esc(r._id)}">Edit</button>
<button class="danger" data-delete="${esc(r._id)}">Delete</button>
</div></td></tr>`).join('')}</tbody></table></div>`
:'<div class="empty">No items yet. Click Add New to create one.</div>'}
</section>`;

$('#add-item').onclick=()=>showEditor(page,{});
document.querySelectorAll('[data-edit]').forEach(b=>{
b.onclick=()=>showEditor(page,rows.find(r=>r._id===b.dataset.edit));
});
document.querySelectorAll('[data-delete]').forEach(b=>{
b.onclick=()=>deleteItem(page,b.dataset.delete);
});
}

function showEditor(page,row){
editingId=row._id||null;
const box=$('#editor');
box.classList.remove('hidden');

box.innerHTML=`
<h3>${editingId?'Edit':'Add'} Item</h3>
<form id="item-form" class="form-grid">
${schemas[page].map(f=>{
const [key,label,type,required]=f;
const value=row[key]??(key==='isPublished'?true:'');
if(type==='checkbox'){
return '<div class="field"><label><input name="'+key+
'" type="checkbox" '+(value?'checked':'')+'> '+label+'</label></div>';
}
if(type==='textarea'){
return '<div class="field full"><label>'+label+
'</label><textarea name="'+key+'" '+(required?'required':'')+'>'+
esc(value)+'</textarea></div>';}
return '<div class="field"><label>'+label+
'</label><input name="'+key+'" type="'+type+'" value="'+
esc(type==='date'&&value?String(value).slice(0,10):value)+
'" '+(required?'required':'')+'></div>';
}).join('')}

<div class="field full toolbar">
<button class="primary" type="submit">Save</button>
<button type="button" id="cancel-edit">Cancel</button>
</div></form>`;$('#cancel-edit').onclick=()=>box.classList.add('hidden');

$('#item-form').onsubmit=async e=>{
e.preventDefault();
const body={};
for(const f of schemas[page]){
const el=e.target.elements[f[0]];
body[f[0]]=f[2]==='checkbox'?el.checked:el.value.trim();
}
try{
await api('/api/admin/'+page+(editingId?'/'+editingId:''),{
method:editingId?'PUT':'POST',
body:JSON.stringify(body)
});
toast('Saved successfully!');
await crudPage(page);
}catch(err){toast(err.message)}
};
}

async function deleteItem(page,id){
if(!confirm('Delete this item permanently?'))return;
try{
await api('/api/admin/'+page+'/'+id,{method:'DELETE'});
toast('Item deleted');
await crudPage(page);
}catch(err){toast(err.message)}
}

async function admissionsPage(){
const rows=await api('/api/admin/admissions');
$('#content').innerHTML=`

<section class="panel">
<div class="panel-head"><h3>Admission Inquiries (${rows.length})</h3></div>
${rows.length?`<div class="table-wrap"><table>
<thead><tr><th>Student</th><th>Grade</th><th>Parent</th><th>Contact</th><th>Status</th></tr></thead>
<tbody>${rows.map(a=>`
<tr><td>${esc(a.studentName)}<br><small>${esc(a.refNo)}</small></td>
<td>${esc(a.requestedGrade)}</td><td>${esc(a.parentName)}</td>
<td>${esc(a.phone)}<br>${esc(a.email)}</td>
<td><select data-status="${esc(a._id)}">
${['pending','approved','rejected'].map(s=>
'<option value="'+s+'" '+(a.status===s?'selected':'')+'>'+s+'</option>'
).join('')}
</select></td></tr>`).join('')}</tbody></table></div>`
:'<div class="empty">No admissions yet.</div>'}
</section>`;document.querySelectorAll('[data-status]').forEach(el=>{
el.onchange=async()=>{
try{
await api('/api/admin/admissions/'+el.dataset.status,{
method:'PATCH',body:JSON.stringify({status:el.value})
});
toast('Admission status updated');
}catch(err){toast(err.message)}
};
});
}

async function messagesPage(){
const rows=await api('/api/admin/messages');
$('#content').innerHTML=`

<section class="panel">
<div class="panel-head"><h3>Contact Messages (${rows.length})</h3></div>
${rows.length?`<div class="table-wrap"><table>
<thead><tr><th>Sender</th><th>Message</th><th>Date</th><th>Actions</th></tr></thead>
<tbody>${rows.map(m=>`
<tr><td>${esc(m.name)}<br>${esc(m.email)}<br>${m.isRead?'Read':'Unread'}</td>
<td>${esc(m.body)}</td>
<td>${m.createdAt?new Date(m.createdAt).toLocaleString():'—'}</td>
<td><div class="actions">
<button class="gold" data-read="${esc(m._id)}" data-value="${!m.isRead}">
${m.isRead?'Mark Unread':'Mark Read'}</button>
<button class="danger" data-msg-delete="${esc(m._id)}">Delete</button>
</div></td></tr>`).join('')}</tbody></table></div>`
:'<div class="empty">No messages yet.</div>'}
</section>`;document.querySelectorAll('[data-read]').forEach(b=>{
b.onclick=async()=>{
try{
await api('/api/admin/messages/'+b.dataset.read,{
method:'PATCH',
body:JSON.stringify({isRead:b.dataset.value==='true'})
});
await messagesPage();
}catch(err){toast(err.message)}
};
});

document.querySelectorAll('[data-msg-delete]').forEach(b=>{
b.onclick=async()=>{
if(!confirm('Delete this message?'))return;
try{
await api('/api/admin/messages/'+b.dataset.msgDelete,{
method:'DELETE'
});
toast('Message deleted');
await messagesPage();
}catch(err){toast(err.message)}
};
});
}

async function settingsPage(){
const result=await api('/api/admin/settings');
const s=result.settings||{};
const fields=[
['schoolName','School Name'],
['shortName','Short Name'],
['tagline','Tagline'],
['logoUrl','Logo URL'],
['establishedYear','Established Year'],
['academicSession','Academic Session'],
['principalName','Principal Name'],
['phonePrimary','Phone'],
['email','Email'],
['address','Address'],
['city','City'],
['facebookUrl','Facebook URL'],
['heroTitle','Homepage Title'],
['heroSubtitle','Homepage Subtitle'],
['heroImageUrl','Homepage Image URL'],
['aboutTitle','About Section Title'],
['aboutDescription','About Description']
];

$('#content').innerHTML=`

<section class="panel">
<div class="panel-head"><h3>School Information</h3></div>
<div class="panel-body">
<form id="settings-form" class="form-grid">
${fields.map(([k,label])=>{
const area=['heroSubtitle','aboutDescription'].includes(k);
const type=k==='email'?'email':k.toLowerCase().includes('url')?'url':'text';
return '<div class="field '+(area?'full':'')+'"><label>'+label+
'</label>'+(area?'<textarea name="'+k+'">'+esc(s[k])+'</textarea>':
'<input name="'+k+'" type="'+type+'" value="'+esc(s[k])+'">')+'</div>';
}).join('')}
<div class="field full"><h3>Theme Colors</h3></div>
${[['primary','Primary'],['secondary','Secondary'],['background','Background']].map(([k,label])=>
'<div class="field"><label>'+label+' Color</label><input type="color" name="color-'+k+'" value="'+esc(s.colors?.[k]||'#4F7CFF')+'"></div>'
).join('')}
<div class="field full"><button class="primary">Save Settings</button></div>
</form></div></section>`;$('#settings-form').onsubmit=async e=>{
e.preventDefault();
const fd=new FormData(e.target),body={};
for(const [k,v] of fd.entries()){
if(!k.startsWith('color-'))body[k]=v;
}
body.colors={
primary:fd.get('color-primary'),
secondary:fd.get('color-secondary'),
background:fd.get('color-background')
};
try{
await api('/api/admin/settings',{
method:'PATCH',body:JSON.stringify(body)
});
toast('School settings saved!');
}catch(err){toast(err.message)}
};
}

checkSession();
</script>

</body>
</html>`;
}module.exports = getAdminDashboardHTML;
