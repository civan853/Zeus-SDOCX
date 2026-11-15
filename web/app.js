import init, { DocumentSession } from './sdocx.js';
import { convertSdocx } from './core.js';
const $ = (id) => document.getElementById(id), A = window.Android, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STEPS = ['Dosya açılıyor', 'Notlar çözülüyor', 'Sayfalar işleniyor', 'PDF kaydediliyor', 'Dosyalar kaydediliyor'];
const MIME = { m4a: 'audio/mp4', mp4: 'audio/mp4', mp3: 'audio/mpeg', aac: 'audio/aac', wav: 'audio/wav', amr: 'audio/amr', ogg: 'audio/ogg', opus: 'audio/ogg', '3ga': 'audio/3gpp' };
$('list').innerHTML = STEPS.map((s) => `<li><span class="ic"></span><span>${s}</span></li>`).join('');
const lis = [...$('list').children];
const step = (i, det = '') => { lis.forEach((li, k) => (li.className = k < i ? 'done' : k === i ? 'act' : '')); $('det').textContent = det; };
const bar = (p) => ($('bar').firstChild.style.width = p + '%');
const progress = (m) => {
  const p = m.match(/Sayfa (\d+)\/(\d+)/);
  if (p) { step(2, `Sayfa ${p[1]} / ${p[2]}`); bar((p[1] / p[2]) * 100); }
  else step(m.startsWith('Dosya') ? 0 : m.startsWith('Notlar') ? 1 : 3, m.startsWith('PDF') ? 'Biraz sürebilir...' : '');
  return sleep(25);
};
const rasterize = (svg, w, h) => new Promise((res, rej) => {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), img = new Image();
  img.onload = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url); c.toBlob(async (b) => { c.width = c.height = 0; res(new Uint8Array(await b.arrayBuffer())); }, 'image/png'); };
  img.onerror = () => rej(new Error('Sayfa resme çevrilemedi')); img.src = url;
});
const b64 = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(b); });
async function save(blob, name, mime) {
  if (!A) return { url: URL.createObjectURL(blob), name, mime };
  if (!A.begin(name, mime)) throw new Error('Dosya oluşturulamadı');
  for (let o = 0; o < blob.size; o += 524288) A.chunk(await b64(blob.slice(o, o + 524288)));
  return { uri: A.end(), name, mime };
}
function item(r) {
  const d = document.createElement('div'); d.className = 'item';
  d.innerHTML = `<div><b></b><small>${A ? 'İndirilenler/ZeusSDOCX' : 'Tarayıcı indirmeleri'}</small></div>`;
  d.querySelector('b').textContent = r.name;
  const b = document.createElement(A ? 'button' : 'a'); b.textContent = A ? 'Aç' : 'İndir';
  if (A) b.onclick = () => A.open(r.uri, r.mime); else { b.href = r.url; b.download = r.name; }
  d.appendChild(b); $('res').appendChild(d);
}
try {
  await init({ module_or_path: new Uint8Array(await (await fetch('sdocx_bg.wasm')).arrayBuffer()) });
  $('file').disabled = false; $('hint').textContent = 'Dosya seç, gerisini ben yaparım. Hiçbir şey internete gönderilmez.';
} catch (e) { $('hint').textContent = 'Başlatılamadı: ' + e.message; }
$('file').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  $('res').innerHTML = ''; $('steps').hidden = false; bar(0); step(0); if (A) A.keepAwake(true);
  try {
    const base = f.name.replace(/\.sdocx$/i, '');
    const r = await convertSdocx(await f.arrayBuffer(), { JSZip, PDFLib, DocumentSession }, progress, { mode: $('mode').value, rasterize, scale: +$('q').value });
    step(4); bar(100);
    item(await save(new Blob([r.pdf], { type: 'application/pdf' }), base + '_notlu.pdf', 'application/pdf'));
    for (const [i, a] of r.audio.entries()) { const ext = (a.name.match(/\.(\w+)$/) || [, 'm4a'])[1].toLowerCase(); item(await save(new Blob([a.data]), `${base}_ses${r.audio.length > 1 ? i + 1 : ''}.${ext}`, MIME[ext] || 'audio/*')); }
    lis.forEach((li) => (li.className = 'done')); $('det').textContent = r.audio.length ? 'Bitti ✓' : 'Bitti ✓ (bu notta ses kaydı yok)';
  } catch (err) { const a = lis.find((li) => li.className === 'act'); if (a) a.className = 'err'; $('det').textContent = 'Hata: ' + (err.message || err); console.error(err); }
  finally { if (A) A.keepAwake(false); }
};
