const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
let currentUser = null;
let equipmentCache = [];
let categoriesCache = [];
let departmentsCache = [];
let loansCache = [];
let toastTimer;

const statusLabels = {pending:"Menunggu",approved:"Disetujui",borrowed:"Sedang dipinjam",returned:"Dikembalikan",rejected:"Ditolak",overdue:"Terlambat"};
const statusClass = s => `status status-${s}`;
const dateText = value => value ? new Date(value).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const money = n => Number(n||0).toLocaleString("id-ID");
function notify(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2800)}
async function api(url, options={}) {
  const res = await fetch(`/api${url}`, {credentials:"same-origin",headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Permintaan gagal.");
  return data;
}
function showLogin(){ $("#loginView").classList.remove("hidden");$("#appView").classList.add("hidden"); }
function showApp(user){
  currentUser=user;$("#loginView").classList.add("hidden");$("#appView").classList.remove("hidden");
  $("#userName").textContent=user.full_name;$("#userRole").textContent=user.role==="admin"?"Administrator":"Siswa";
  $("#userAvatar").textContent=user.full_name.charAt(0).toUpperCase();
  document.body.classList.toggle("role-student",user.role==="student");
  $$(".nav-link").forEach(b=>{if(b.dataset.page==="equipment"||b.dataset.page==="dashboard"||b.dataset.page==="loans"||b.dataset.page==="reports")b.classList.remove("hidden")});
  if(user.role==="student"){$$('.nav-link[data-page="reports"]').forEach(x=>x.classList.add("hidden"));}
  navigate("dashboard");
}
async function init(){
  $("#year").textContent=new Date().getFullYear();
  try{const data=await api("/auth/me");showApp(data.user)}catch{showLogin()}
}
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();$("#loginError").textContent="";
  const form=new FormData(e.currentTarget);
  try{const data=await api("/auth/login",{method:"POST",body:JSON.stringify({username:form.get("username"),password:form.get("password")})});showApp(data.user)}
  catch(err){$("#loginError").textContent=err.message}
});
$("#logoutBtn").addEventListener("click",async()=>{try{await api("/auth/logout",{method:"POST"})}finally{currentUser=null;showLogin()}});
$("#menuToggle").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$$(".nav-link").forEach(b=>b.addEventListener("click",()=>{navigate(b.dataset.page);$("#sidebar").classList.remove("open")}));

async function navigate(page){
  $$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const titles={dashboard:"Dashboard",equipment:"Data Barang",loans:"Data Peminjaman","new-loan":"Ajukan Peminjaman",reports:"Laporan"};
  $("#pageTitle").textContent=titles[page]||"Dashboard";
  try{
    if(page==="dashboard") await renderDashboard();
    if(page==="equipment") await renderEquipment();
    if(page==="loans") await renderLoans();
    if(page==="new-loan") await renderNewLoan();
    if(page==="reports") await renderReports();
  }catch(err){$("#pageContent").innerHTML=`<div class="panel empty-state">${escapeHtml(err.message)}</div>`}
}
function heading(title,desc,extra=""){return `<div class="page-heading"><div><h1>${title}</h1><p>${desc}</p></div>${extra}</div>`}
function stat(label,value,icon,foot){return `<div class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-number">${value}</div><div class="stat-foot">${foot}</div></div>`}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function statusBadge(s){return `<span class="${statusClass(s)}">${statusLabels[s]||s}</span>`}
async function renderDashboard(){
  const d=await api("/dashboard"), e=d.equipment,l=d.loans;
  const greeting=currentUser.role==="admin"?"Pantau aktivitas inventaris sekolah dalam satu tampilan.":"Lihat ketersediaan alat dan status peminjamanmu.";
  $("#pageContent").innerHTML=heading(`Halo, ${escapeHtml(currentUser.full_name.split(" ")[0])} 👋`,greeting,`<span class="date-chip">◷ ${new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</span>`)+
  `<div class="stats-grid">${stat("Jenis barang",money(e.total_items),"▦","Barang inventaris aktif")}${stat("Total stok",money(e.total_stock),"▤","Seluruh unit barang")}${stat("Barang tersedia",money(e.available_stock),"✓","Siap dipinjam")}${stat(currentUser.role==="admin"?"Menunggu persetujuan":"Peminjaman aktif",money(currentUser.role==="admin"?l.pending:l.active),"⇄",currentUser.role==="admin"?"Perlu ditinjau admin":"Transaksi berjalan")}</div>
  <div class="dashboard-grid"><section class="panel"><div class="panel-head"><h3>Transaksi terbaru</h3><small>6 aktivitas terakhir</small></div><div class="table-wrap"><table><thead><tr><th>Kode</th><th>Peminjam</th><th>Tanggal</th><th>Status</th></tr></thead><tbody>${d.recent.length?d.recent.map(x=>`<tr><td class="primary-cell">${escapeHtml(x.loan_code)}</td><td><div class="primary-cell">${escapeHtml(x.full_name)}</div><div class="sub-cell">${escapeHtml(x.class_name)}</div></td><td>${dateText(x.requested_at)}</td><td>${statusBadge(x.status)}</td></tr>`).join(""):`<tr><td colspan="4" class="empty-state">Belum ada transaksi.</td></tr>`}</tbody></table></div></section>
  <section class="panel"><div class="panel-head"><h3>Ringkasan peminjaman</h3><small>Status saat ini</small></div><div class="quick-list"><div class="quick-item"><span class="quick-symbol">◷</span><div><b>${money(l.pending||0)} permintaan menunggu</b><small>Menunggu keputusan petugas</small></div></div><div class="quick-item"><span class="quick-symbol">⇄</span><div><b>${money(l.active||0)} transaksi aktif</b><small>Barang masih dalam masa pinjam</small></div></div><div class="quick-item"><span class="quick-symbol">!</span><div><b>${money(l.overdue||0)} transaksi terlambat</b><small>Perlu tindak lanjut pengembalian</small></div></div></div></section></div>`;
}
async function loadLookups(){[categoriesCache,departmentsCache]=await Promise.all([api("/categories"),api("/departments")])}
async function renderEquipment(){
  equipmentCache=await api("/equipment");
  const isAdmin=currentUser.role==="admin";
  $("#pageContent").innerHTML=heading("Data Barang","Kelola inventaris alat praktik dari seluruh jurusan.",isAdmin?`<button class="btn btn-primary" id="addEquipment">＋ Tambah Barang</button>`:"")+
  `<div class="toolbar"><input id="equipmentSearch" class="search-input" placeholder="Cari nama, kode, atau kategori barang..."><span class="section-count">${equipmentCache.length} jenis barang</span></div>
  <section class="panel panel-table"><div class="table-wrap"><table><thead><tr><th>Kode inventaris</th><th>Nama barang</th><th>Kategori / Jurusan</th><th>Stok</th><th>Kondisi</th><th>Lokasi</th>${isAdmin?"<th>Aksi</th>":""}</tr></thead><tbody id="equipmentRows">${equipmentRows(equipmentCache,isAdmin)}</tbody></table></div></section>`;
  $("#equipmentSearch").addEventListener("input",e=>$("#equipmentRows").innerHTML=equipmentRows(equipmentCache.filter(x=>(x.name+" "+x.inventory_code+" "+x.category_name).toLowerCase().includes(e.target.value.toLowerCase())),isAdmin));
  if(isAdmin)$("#addEquipment").addEventListener("click",()=>openEquipmentModal());
}
function equipmentRows(rows,isAdmin){return rows.length?rows.map(x=>`<tr><td class="primary-cell">${escapeHtml(x.inventory_code)}</td><td><div class="primary-cell">${escapeHtml(x.name)}</div><div class="sub-cell">${escapeHtml(x.description||"Tanpa deskripsi")}</div></td><td>${escapeHtml(x.category_name)}<div class="sub-cell">${escapeHtml(x.department_name||"Lintas jurusan")}</div></td><td><b>${money(x.available_stock)}</b><span class="sub-cell"> / ${money(x.total_stock)} unit</span></td><td>${escapeHtml(x.condition_status.replace("_"," "))}</td><td>${escapeHtml(x.storage_location||"—")}</td>${isAdmin?`<td><button class="btn btn-small btn-outline" data-edit="${x.id}">Edit</button></td>`:""}</tr>`).join(""):`<tr><td colspan="7" class="empty-state">Belum ada data barang. Admin dapat menambahkan inventaris.</td></tr>`}
async function openEquipmentModal(item=null){
  await loadLookups();
  const modal=document.createElement("div");modal.className="modal-backdrop";
  modal.innerHTML=`<section class="modal"><div class="modal-head"><h2>${item?"Edit barang":"Tambah barang baru"}</h2><button class="modal-close">×</button></div>
  <form class="modal-form" id="equipmentForm">
  <label>Kode inventaris<input name="inventory_code" required placeholder="Contoh: TKJ-001" ${item?"readonly":""} value="${escapeHtml(item?.inventory_code||"")}"></label>
  <label>Nama barang<input name="name" required value="${escapeHtml(item?.name||"")}"></label>
  <label>Kategori<select name="category_id" required>${categoriesCache.map(c=>`<option value="${c.id}" ${item?.category_id===c.id?"selected":""}>${escapeHtml(c.name)}</option>`).join("")}</select></label>
  <label>Jurusan<select name="department_id"><option value="">Lintas jurusan</option>${departmentsCache.map(d=>`<option value="${d.id}" ${item?.department_id===d.id?"selected":""}>${escapeHtml(d.name)}</option>`).join("")}</select></label>
  <label>Jumlah stok<input name="total_stock" type="number" min="0" required value="${item?.total_stock??0}"></label>
  <label>Kondisi<select name="condition_status"><option value="baik">Baik</option><option value="perlu_perbaikan">Perlu perbaikan</option><option value="rusak">Rusak</option></select></label>
  <label class="full">Lokasi penyimpanan<input name="storage_location" value="${escapeHtml(item?.storage_location||"")}" placeholder="Contoh: Lab Komputer 1"></label>
  <label class="full">Deskripsi<textarea name="description" rows="2">${escapeHtml(item?.description||"")}</textarea></label>
  <div class="modal-actions"><button type="button" class="btn btn-outline cancel">Batal</button><button class="btn btn-primary">Simpan barang</button></div></form></section>`;
  document.body.append(modal);modal.querySelectorAll(".modal-close,.cancel").forEach(b=>b.onclick=()=>modal.remove());
  modal.querySelector("#equipmentForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),body=Object.fromEntries(f.entries());body.total_stock=Number(body.total_stock);body.category_id=Number(body.category_id);body.department_id=body.department_id?Number(body.department_id):null;
    try{await api(item?`/equipment/${item.id}`:"/equipment",{method:item?"PUT":"POST",body:JSON.stringify(body)});modal.remove();notify("Data barang berhasil disimpan.");renderEquipment()}catch(err){notify(err.message)}};
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-edit]");if(b){const item=equipmentCache.find(x=>x.id===Number(b.dataset.edit));openEquipmentModal(item)}});
async function renderLoans(){
  loansCache=await api("/loans");const admin=currentUser.role==="admin";
  $("#pageContent").innerHTML=heading("Data Peminjaman",admin?"Tinjau permintaan dan catat pengembalian barang.":"Pantau seluruh status dan riwayat peminjamanmu.")+
  `<div class="toolbar"><input id="loanSearch" class="search-input" placeholder="Cari kode, nama, kelas, atau barang..."><span class="section-count">${loansCache.length} transaksi</span></div>
  <section class="panel panel-table"><div class="table-wrap"><table><thead><tr><th>Kode transaksi</th>${admin?"<th>Peminjam</th>":""}<th>Barang</th><th>Tanggal pinjam</th><th>Batas kembali</th><th>Status</th>${admin?"<th>Aksi</th>":""}</tr></thead><tbody id="loanRows">${loanRows(loansCache,admin)}</tbody></table></div></section>`;
  $("#loanSearch").addEventListener("input",e=>{const q=e.target.value.toLowerCase();$("#loanRows").innerHTML=loanRows(loansCache.filter(x=>(x.loan_code+" "+x.full_name+" "+x.class_name+" "+x.items).toLowerCase().includes(q)),admin)});
}
function loanRows(rows,admin){return rows.length?rows.map(x=>`<tr><td class="primary-cell">${escapeHtml(x.loan_code)}${admin?`<div class="sub-cell">${escapeHtml(x.purpose)}</div>`:""}</td>${admin?`<td><div class="primary-cell">${escapeHtml(x.full_name)}</div><div class="sub-cell">${escapeHtml(x.class_name)} · ${escapeHtml(x.department_name)}</div></td>`:""}<td>${escapeHtml(x.items)}</td><td>${dateText(x.requested_at)}</td><td>${dateText(x.planned_return_date)}</td><td>${statusBadge(x.status)}</td>${admin?`<td><div class="action-row">${x.status==="pending"?`<button class="btn btn-small btn-soft" data-approve="${x.id}">Setujui</button><button class="btn btn-small btn-outline" data-reject="${x.id}">Tolak</button>`:""}${["borrowed","overdue"].includes(x.status)?`<button class="btn btn-small btn-primary" data-return="${x.id}">Kembalikan</button>`:""}</div></td>`:""}</tr>`).join(""):`<tr><td colspan="8" class="empty-state">Belum ada transaksi peminjaman.</td></tr>`}
document.addEventListener("click",async e=>{
  const approve=e.target.closest("[data-approve]"),reject=e.target.closest("[data-reject]"),ret=e.target.closest("[data-return]");
  try{
    if(approve){await api(`/loans/${approve.dataset.approve}/approve`,{method:"PATCH",body:JSON.stringify({})});notify("Peminjaman disetujui.");renderLoans()}
    if(reject){const note=prompt("Alasan penolakan (opsional):")||"";await api(`/loans/${reject.dataset.reject}/reject`,{method:"PATCH",body:JSON.stringify({admin_note:note})});notify("Permintaan ditolak.");renderLoans()}
    if(ret){const note=prompt("Catatan kondisi barang saat dikembalikan (opsional):")||"";await api(`/loans/${ret.dataset.return}/return`,{method:"PATCH",body:JSON.stringify({condition_note:note})});notify("Pengembalian dicatat.");renderLoans()}
  }catch(err){notify(err.message)}
});
async function renderNewLoan(){
  if(currentUser.role!=="student")throw new Error("Halaman ini khusus siswa.");
  equipmentCache=await api("/equipment");
  const available=equipmentCache.filter(x=>x.available_stock>0&&x.condition_status==="baik");
  $("#pageContent").innerHTML=heading("Ajukan Peminjaman","Lengkapi data barang yang ingin kamu pinjam.")+
  `<section class="panel"><div class="panel-head"><h3>Identitas peminjam</h3><small>Terisi dari akun login</small></div><div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">${stat("Nama",escapeHtml(currentUser.full_name),"♙","Siswa")}${stat("Kelas",escapeHtml(currentUser.class_name||"—"),"▦",escapeHtml(currentUser.department_name||"Jurusan"))}${stat("NISN",escapeHtml(currentUser.nisn||"—"),"▤","Nomor induk")}</div>
  <form id="loanForm" class="modal-form"><label class="full">Keperluan peminjaman<textarea name="purpose" rows="2" required placeholder="Jelaskan keperluan penggunaan alat..."></textarea></label><label class="full">Rencana tanggal pengembalian<input name="planned_return_date" type="date" required min="${new Date().toISOString().slice(0,10)}"></label>
  <div class="full"><div class="panel-head"><h3>Pilih barang</h3><button type="button" class="btn btn-small btn-soft" id="addLoanItem">＋ Tambah barang</button></div><div id="loanItems"></div></div>
  <div class="modal-actions"><button class="btn btn-primary">Kirim permintaan</button></div></form></section>`;
  const list=$("#loanItems");
  function addRow(){const row=document.createElement("div");row.className="loan-item-row";row.innerHTML=`<label>Barang<select class="loan-equipment" required><option value="">Pilih barang</option>${available.map(x=>`<option value="${x.id}">${escapeHtml(x.name)} — tersedia ${x.available_stock}</option>`).join("")}</select></label><label>Jumlah<input class="loan-quantity" type="number" min="1" value="1" required></label><button type="button" aria-label="Hapus">×</button>`;row.querySelector("button").onclick=()=>row.remove();list.append(row)}
  addRow();$("#addLoanItem").onclick=addRow;
  $("#loanForm").onsubmit=async e=>{e.preventDefault();const items=$$(".loan-item-row",list).map(r=>({equipment_id:Number($(".loan-equipment",r).value),quantity:Number($(".loan-quantity",r).value)}));if(items.some(x=>!x.equipment_id||!x.quantity)){notify("Lengkapi pilihan barang dan jumlah.");return}
    const f=new FormData(e.target);try{const result=await api("/loans",{method:"POST",body:JSON.stringify({purpose:f.get("purpose"),planned_return_date:f.get("planned_return_date"),items})});notify(result.message);navigate("loans")}catch(err){notify(err.message)}};
}
async function renderReports(){
  if(currentUser.role!=="admin")throw new Error("Laporan hanya dapat diakses admin.");
  const [loans,equipment]=await Promise.all([api("/loans"),api("/equipment")]);
  const returned=loans.filter(x=>x.status==="returned").length, active=loans.filter(x=>["borrowed","overdue"].includes(x.status)).length;
  const popular={};loans.forEach(l=>String(l.items||"").split(", ").forEach(item=>{const name=item.replace(/ \\(\\d+\\)$/,"");popular[name]=(popular[name]||0)+1}));
  const popularRows=Object.entries(popular).sort((a,b)=>b[1]-a[1]).slice(0,5);
  $("#pageContent").innerHTML=heading("Laporan","Ringkasan aktivitas inventaris dan transaksi peminjaman.")+
  `<div class="stats-grid">${stat("Total transaksi",loans.length,"▤","Semua riwayat")}${stat("Sudah kembali",returned,"✓","Transaksi selesai")}${stat("Masih dipinjam",active,"⇄","Transaksi aktif")}${stat("Jenis inventaris",equipment.length,"▦","Barang aktif")}</div>
  <section class="panel"><div class="panel-head"><h3>Ringkasan barang yang sering dipinjam</h3><button class="btn btn-small btn-outline" id="exportCsv">↓ Unduh CSV</button></div><div class="table-wrap"><table><thead><tr><th>Nama barang</th><th>Jumlah transaksi tercatat</th></tr></thead><tbody>${popularRows.length?popularRows.map(x=>`<tr><td class="primary-cell">${escapeHtml(x[0])}</td><td>${x[1]}</td></tr>`).join(""):`<tr><td colspan="2" class="empty-state">Belum ada data transaksi.</td></tr>`}</tbody></table></div></section>
  <section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Riwayat transaksi</h3><small>${loans.length} baris data</small></div><div class="table-wrap"><table><thead><tr><th>Kode</th><th>Peminjam</th><th>Kelas</th><th>Barang</th><th>Status</th></tr></thead><tbody>${loans.map(x=>`<tr><td>${escapeHtml(x.loan_code)}</td><td>${escapeHtml(x.full_name)}</td><td>${escapeHtml(x.class_name)}</td><td>${escapeHtml(x.items)}</td><td>${statusBadge(x.status)}</td></tr>`).join("")}</tbody></table></div></section>`;
  $("#exportCsv").onclick=()=>{const rows=[["Kode","Peminjam","NISN","Kelas","Barang","Tanggal Pinjam","Batas Kembali","Status"],...loans.map(x=>[x.loan_code,x.full_name,x.nisn,x.class_name,x.items,x.requested_at,x.planned_return_date,statusLabels[x.status]||x.status])];const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");const blob=new Blob(["\\ufeff"+csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="laporan-peminjaman.csv";a.click();URL.revokeObjectURL(a.href)};
}
init();
