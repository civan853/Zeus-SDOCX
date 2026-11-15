// Core: sdocx -> { pdf: Uint8Array, audio: [{name, data}] }
const AUDIO_EXT = /\.(m4a|mp3|aac|wav|amr|3ga|ogg|opus|mp4)$/i;
const hex = (h) => { h = (h || '#000000').replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) / 255); };
const attr = (s, k) => { const m = s.match(new RegExp('\\b' + k + '="([^"]*)"')); return m ? m[1] : null; };

export async function convertSdocx(buf, { JSZip, PDFLib, DocumentSession }, progress = () => {}, opts = {}) {
  const { PDFDocument, rgb, LineCapStyle } = PDFLib;
  await progress('Dosya açılıyor...');
  const zip = await JSZip.loadAsync(buf);
  const lite = new JSZip();
  const audio = [], pdfBytes = {};
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const base = name.split('/').pop();
    if (name.startsWith('media/') && AUDIO_EXT.test(base)) {
      audio.push({ name: base.replace(/^\d+@/, ''), data: await entry.async('uint8array') });
      continue; // ses kaydı hafif zip'e girmez (parse için gerekmiyor)
    }
    const data = await entry.async('uint8array');
    if (name.startsWith('media/') && /\.pdf$/i.test(base)) pdfBytes[parseInt(base.split('@')[0])] = data;
    lite.file(name, data, { compression: 'STORE' });
  }
  await progress('Notlar çözülüyor...');
  const liteBytes = await lite.generateAsync({ type: 'uint8array' });
  const session = new DocumentSession(liteBytes);
  const info = session.inspection();
  const out = await PDFDocument.create();
  const bgDocs = {};
  for (const [id, bytes] of Object.entries(pdfBytes)) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const idx = src.getPageIndices();
    bgDocs[id] = { src, emb: await out.embedPdf(src, idx) };
  }
  const n = Math.min(session.page_count, opts.maxPages || 1e9);
  for (let i = 0; i < n; i++) {
    await progress(`Sayfa ${i + 1}/${n} işleniyor...`);
    let svg = session.render_svg(i, 'light');
    const pg = info.layout.pages[i].page;
    const paper = pg.background && pg.background.pdf_paper && pg.background.pdf_paper[0];
    const bg = paper && bgDocs[paper.media_id];
    const vb = svg.match(/viewBox="0(?:\.0+)? 0(?:\.0+)? ([\d.]+) ([\d.]+)"/);
    const sw = vb ? +vb[1] : pg.width, sh = vb ? +vb[2] : pg.height;
    let W = sw * 0.48, H = sh * 0.48, emb = null;
    if (bg && bg.emb[paper.page_index]) {
      emb = bg.emb[paper.page_index];
      const r = bg.src.getPage(paper.page_index).getSize(); W = r.width; H = r.height;
    }
    const page = out.addPage([W, H]);
    const s = W / sw;
    if (emb) await emb.embed();
    if (emb) page.drawPage(emb, { x: 0, y: 0, width: W, height: H });
    else { const c = svg.match(/<rect fill="#([0-9a-f]{3,6})"/i); page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...hex(c ? c[1] : 'ffffff')) }); }
    const X = (x) => x * s, Y = (y) => H - y * s;
    const seg = (x1, y1, x2, y2, st, w, op, cap) => page.drawLine({
      start: { x: X(x1), y: Y(y1) }, end: { x: X(x2), y: Y(y2) },
      thickness: Math.max(w * s, 0.05), color: rgb(...hex(st)), opacity: op, lineCap: LineCapStyle.Round });
    if (opts.mode === 'image' && opts.rasterize) {
      const clean = svg.replace(/<rect fill="#[0-9a-fA-F]+"[^>]*\/>\n?/, '');
      const k = opts.scale || 2.5;
      const png = await opts.rasterize(clean, Math.round(sw * k), Math.round(sh * k));
      const im = await out.embedPng(png);
      await im.embed(); // işi şimdi yap, sona bırakma
      page.drawImage(im, { x: 0, y: 0, width: W, height: H });
      continue;
    }
    for (const m of svg.matchAll(/<(line|polyline|path|circle)\b[^>]*>/g)) {
      const t = m[0], tag = m[1];
      if (/clip-path|data-sdocx/.test(t) && tag !== 'path') continue;
      const st = attr(t, 'stroke') || attr(t, 'fill'), w = parseFloat(attr(t, 'stroke-width') || '1'), op = parseFloat(attr(t, 'stroke-opacity') || '1');
      if (tag === 'line') seg(+attr(t, 'x1'), +attr(t, 'y1'), +attr(t, 'x2'), +attr(t, 'y2'), st, w, op);
      else if (tag === 'polyline') {
        const p = attr(t, 'points').trim().split(/\s+/).map(Number);
        for (let k = 0; k + 3 < p.length; k += 2) seg(p[k], p[k + 1], p[k + 2], p[k + 3], st, w, op);
        if (p.length === 2) seg(p[0], p[1], p[0], p[1], st, w, op);
      } else if (tag === 'path') {
        for (const q of (attr(t, 'd') || '').matchAll(/M([\d.\-]+),([\d.\-]+)\s*H([\d.\-]+)/g)) seg(+q[1], +q[2], +q[3], +q[2], st, w, op);
      } else if (tag === 'circle') {
        page.drawCircle({ x: X(+attr(t, 'cx')), y: Y(+attr(t, 'cy')), size: Math.max(+attr(t, 'r') * s, 0.05), color: rgb(...hex(attr(t, 'fill'))) });
      }
    }
  }
  session.dispose();
  await progress('PDF kaydediliyor... (biraz sürebilir)');
  return { pdf: await out.save(), audio };
}
