function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // rimuove accenti
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'pagina';
}

let pages = {}; // cache runtime: { nome: { title, content } }, popolata dai file
let currentPage = "Main";
let currentTab = "read";
let db = null;
function isProtected(name) {
  return false; // Nessuna pagina è protetta
}

// Eventuali modifiche fatte da un futuro editor in-browser restano salvate
// in localStorage e hanno priorità sul file su disco per quella pagina.
function getLocalOverlay(name) {
  try {
    const saved = localStorage.getItem("enciclopocchiedia_pages_v2");
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return parsed[name] || null;
  } catch (e) {
    return null;
  }
}

// Carica (e mette in cache) il contenuto di una pagina dal suo file HTML.
async function loadPageContent(name) {
  if (pages[name] && pages[name].content) return pages[name];

  const meta = PAGE_INDEX[name];
  if (!meta) return null;

  const overlay = getLocalOverlay(name);
  if (overlay && overlay.content) {
    pages[name] = { title: meta.title, content: overlay.content };
    return pages[name];
  }

  try {
    const res = await fetch(meta.file);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    pages[name] = { title: meta.title, content: html };
  } catch (e) {
    pages[name] = {
      title: meta.title,
      content: `<div class="wiki-notice" style="background:#fff3f3;border-left-color:#ba0000"><span class="ni">🔴</span><span>Impossibile caricare <b>${meta.file}</b>. Se hai aperto questo file direttamente dal disco (file://), il browser blocca il caricamento delle pagine: avvia un piccolo server locale (es. <code>python3 -m http.server</code> nella cartella) oppure caricalo su GitHub Pages.</span></div>`
    };
  }
  return pages[name];
}

// Carica tutte le pagine in una volta (usato per popolare la ricerca full-text).
async function preloadAllPages() {
  await Promise.all(Object.keys(PAGE_INDEX).map(name => loadPageContent(name)));
}

// Stack cronologia interna: array di nomi pagina
let navHistory = [];
let navPos = -1; // posizione corrente nello stack

function navigateTo(name, fromPopstate) {
  currentPage = name;

  // Aggiorna cronologia interna solo se non stiamo tornando
  if (!fromPopstate) {
    // Tronca il futuro se siamo in mezzo alla cronologia
    navHistory = navHistory.slice(0, navPos + 1);
    // Non duplicare se è la stessa pagina
    if (navHistory[navHistory.length - 1] !== name) {
      navHistory.push(name);
      navPos = navHistory.length - 1;
    }
    // Aggiorna URL hash senza ricaricare la pagina
    try {
      history.pushState({ page: name, pos: navPos }, '', '#' + encodeURIComponent(name));
    } catch(e) {}
  }

  updateBackButton();
  renderPage(name);
  updateSidebar();
  window.scrollTo(0, 0);
}

function goBack() {
  if (navPos > 0) {
    navPos--;
    const name = navHistory[navPos];
    currentPage = name;
    try {
      history.back(); // muovi il browser history
    } catch(e) {}
    updateBackButton();
    renderPage(name);
    updateSidebar();
    window.scrollTo(0, 0);
  }
}

function goForward() {
  if (navPos < navHistory.length - 1) {
    navPos++;
    const name = navHistory[navPos];
    currentPage = name;
    try {
      history.forward();
    } catch(e) {}
    updateBackButton();
    renderPage(name);
    updateSidebar();
    window.scrollTo(0, 0);
  }
}

function updateBackButton() {
  const btn = document.getElementById('btn-back');
  if (!btn) return;
  if (navPos > 0) {
    btn.style.display = '';
    const prev = navHistory[navPos - 1];
    btn.title = `Torna a: ${prev}`;
    btn.innerHTML = `← ${prev.length > 22 ? prev.substring(0, 20) + '…' : prev}`;
  } else {
    btn.style.display = 'none';
  }
}

// Intercetta il tasto indietro del browser
window.addEventListener('popstate', function(e) {
  if (e.state && e.state.page) {
    navPos = e.state.pos !== undefined ? e.state.pos : Math.max(0, navPos - 1);
    currentPage = e.state.page;
    updateBackButton();
    renderPage(e.state.page);
    updateSidebar();
    window.scrollTo(0, 0);
  }
});

async function renderPage(name) {
  const article = document.getElementById("article-content");

  const meta = PAGE_INDEX[name];
  if (!meta) {
    article.innerHTML = `
      <div class="wiki-notice" style="background:#fff3f3;border-left-color:#ba0000"><span class="ni">🔴</span><span>La pagina <b>"${name}"</b> non esiste ancora. Non esiste ancora.</span></div>
      <h1 class="page-title" style="color:#ba0000">${name}</h1>
      <div class="page-subtitle">Da Enciclopocchiedia, l'enciclopedia (quasi) libera.</div>
      <div class="wiki-article-body">
        <p style="font-family:sans-serif;color:#54595d;font-size:13px">Questa pagina non esiste ancora. Per crearla: aggiungi una voce a <code>PAGE_INDEX</code> e un file in <code>pages/${slugify(name)}.html</code>.</p>
      </div>`;
    return;
  }

  article.innerHTML = `<p style="font-family:sans-serif;color:#54595d;font-size:13px;padding:20px 0">Caricamento…</p>`;
  const page = await loadPageContent(name);

  if (page.content) {
    article.innerHTML = page.content;
    evidenziaPersonaggi(article);
    if (name === 'Main') setTimeout(creaPaginaDelGiorno, 0);
    else setTimeout(() => injectCitazioni(name), 0);
  } else {
    article.innerHTML = `
      <h1 class="page-title">${page.title}</h1>
      <div class="page-subtitle">Da Enciclopocchiedia, l'enciclopedia (quasi) libera.</div>
      <div class="wiki-article-body">
        <p style="font-family:sans-serif;color:#54595d;font-size:13px">Pagina vuota.</p>
      </div>`;
  }

  document.title = `${page.title} — Enciclopocchiedia`;
}

function updateSidebar() {
  const container = document.getElementById("sidebar-pages");
  container.innerHTML = "";
  for (const name in PAGE_INDEX) {
    if (name === "Main") continue;
    const a = document.createElement("a");
    a.textContent = name;
    a.onclick = () => navigateTo(name);
    if (name === currentPage) a.className = "active-page";
    container.appendChild(a);
  }
}

// ══════════════════════════════════════════════════════
//  RICERCA - SISTEMATA
// ══════════════════════════════════════════════════════

let searchTimeout = null;
let currentSearchResults = [];

function initSearch() {
  const input = document.getElementById('search-input');
  const btn   = document.getElementById('search-btn');
  const box   = document.getElementById('search-results');
  if (!input || !btn || !box) return;

  // Chiudi dropdown cliccando fuori
  document.addEventListener('mousedown', function(e) {
    const bar = document.getElementById('wiki-search-bar');
    if (bar && !bar.contains(e.target)) {
      closeSearch();
    }
  });

  // Input con debounce per evitare ricerche a ogni tasto
  input.addEventListener('input', function() {
    const q = this.value.trim();
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (q.length < 2) { 
      closeSearch(); 
      return; 
    }
    
    searchTimeout = setTimeout(() => {
      showResults(q);
    }, 250);
  });

  // Gestione tasti freccia e invio
  input.addEventListener('keydown', function(e) {
    const q = this.value.trim();
    const items = [...box.querySelectorAll('.search-result-item')];
    const focused = box.querySelector('.search-result-item.focused');
    let idx = focused ? items.indexOf(focused) : -1;
    
    switch(e.key) {
      case 'Enter':
        e.preventDefault();
        if (!q) return;
        // Se c'è un elemento focalizzato, vai a quello
        if (focused) {
          focused.click();
          return;
        }
        // Altrimenti cerca la corrispondenza esatta
        const exact = Object.keys(PAGE_INDEX).find(k => k.toLowerCase() === q.toLowerCase());
        if (exact) { goToResult(exact); return; }
        // O prendi il primo risultato
        if (items.length > 0) items[0].click();
        break;
        
      case 'Escape':
        e.preventDefault();
        closeSearch();
        input.blur();
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        if (items.length === 0) return;
        if (focused) focused.classList.remove('focused');
        idx = Math.min(idx + 1, items.length - 1);
        items[idx].classList.add('focused');
        items[idx].scrollIntoView({ block: 'nearest' });
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        if (items.length === 0) return;
        if (focused) focused.classList.remove('focused');
        idx = Math.max(idx - 1, 0);
        items[idx].classList.add('focused');
        items[idx].scrollIntoView({ block: 'nearest' });
        break;
    }
  });

  // Bottone di ricerca
  btn.addEventListener('click', function() {
    const q = input.value.trim();
    if (!q) { input.focus(); return; }
    const exact = Object.keys(PAGE_INDEX).find(k => k.toLowerCase() === q.toLowerCase());
    if (exact) { goToResult(exact); return; }
    const first = box.querySelector('.search-result-item');
    if (first) first.click();
    else showResults(q);
  });
}

function showResults(q) {
  const box = document.getElementById('search-results');
  if (!box) return;
  
  const ql = q.toLowerCase();
  const results = [];

  for (const name in PAGE_INDEX) {
    if (name === 'Main') continue;
    const page = pages[name]; // popolata da preloadAllPages() all'avvio

    // Calcola punteggio di rilevanza
    let score = 0;
    let snippet = '';
    
    // Match esatto del titolo
    if (name.toLowerCase() === ql) score = 100;
    // Match inizia con
    else if (name.toLowerCase().startsWith(ql)) score = 80;
    // Match contiene nel titolo
    else if (name.toLowerCase().includes(ql)) score = 60;
    
    // Cerca nel contenuto (solo se necessario, e solo se già caricato)
    if (score < 60 && page && page.content) {
      const tmp = document.createElement('div');
      tmp.innerHTML = page.content;
      const text = tmp.textContent || '';
      if (text.toLowerCase().includes(ql)) {
        score = 40;
        // Estrai snippet
        const idx = text.toLowerCase().indexOf(ql);
        const start = Math.max(0, idx - 50);
        const end = Math.min(text.length, idx + q.length + 70);
        snippet = (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
      }
    } else if (page && page.content && score >= 60) {
      // Se già match nel titolo, aggiungi snippet dal contenuto
      const tmp = document.createElement('div');
      tmp.innerHTML = page.content;
      const text = tmp.textContent || '';
      const idx = text.toLowerCase().indexOf(ql);
      if (idx !== -1) {
        const start = Math.max(0, idx - 50);
        const end = Math.min(text.length, idx + q.length + 70);
        snippet = (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
      }
    }
    
    if (score > 0) {
      results.push({ name, score, snippet });
    }
  }

  // Ordina per punteggio (decrescente)
  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, 10); // Mostra massimo 10 risultati

  if (!top.length) {
    box.innerHTML = `<div style="padding:10px 14px;font-family:'Source Sans 3',sans-serif;font-size:13px;color:#54595d;">🔍 Nessun risultato per <b>${escHtml(q)}</b></div>`;
    box.classList.add('open');
    return;
  }

  box.innerHTML = top.map(r => {
    const highlightedTitle = highlightMatch(r.name, q);
    return `<div class="search-result-item" data-page="${escAttr(r.name)}">
      <div class="sr-title">📄 ${highlightedTitle}</div>
      ${r.snippet ? '<div class="sr-snippet">' + escHtml(r.snippet) + '</div>' : ''}
    </div>`;
  }).join('');

  // Attach click handler con mousedown (più veloce e non fa perdere focus)
  box.querySelectorAll('.search-result-item').forEach(function(item) {
    item.addEventListener('mousedown', function(e) {
      e.preventDefault();
      const pageName = this.dataset.page;
      if (pageName) goToResult(pageName);
    });
  });

  box.classList.add('open');
}

function highlightMatch(text, q) {
  const ql = q.toLowerCase();
  const tl = text.toLowerCase();
  const idx = tl.indexOf(ql);
  if (idx === -1) return escHtml(text);
  return escHtml(text.slice(0, idx))
    + '<mark style="background:#fff3a3;color:#202122;border-radius:2px;padding:0 2px;">' + escHtml(text.slice(idx, idx + q.length)) + '</mark>'
    + escHtml(text.slice(idx + q.length));
}

function goToResult(name) {
  closeSearch();
  const cleanName = name.replace(/\\/g, '');
  navigateTo(cleanName);
}

function closeSearch() {
  const box = document.getElementById('search-results');
  const input = document.getElementById('search-input');
  if (box) { 
    box.classList.remove('open'); 
    box.innerHTML = ''; 
  }
  // Non cancellare il testo nell'input, solo chiudi il dropdown
  currentSearchResults = [];
  if (searchTimeout) clearTimeout(searchTimeout);
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(s) {
  return String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ══════════════════════════════════════════════════════
//  CITAZIONI DINAMICHE — "Citato in" per personaggi/stati
// ══════════════════════════════════════════════════════

function injectCitazioni(name) {
  const article = document.getElementById('article-content');
  if (!article) return;

  // Solo per pagine con infobox (personaggi e stati)
  if (!article.querySelector('.infobox')) return;

  // Raccogli tutte le pagine (già caricate in cache) che linkano a questa
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp("navigateTo\\('" + escaped + "'\\)");

  const citanti = [];
  for (const altroNome in pages) {
    if (altroNome === name) continue;
    const p = pages[altroNome];
    if (!p || !p.content) continue;
    if (pattern.test(p.content)) citanti.push(altroNome);
  }

  if (citanti.length === 0) return;

  // Inserisci prima di .wiki-cats (o in fondo al body se non c'è)
  const cats = article.querySelector('.wiki-cats');
  const section = document.createElement('div');
  section.className = 'citato-in-section';
  section.innerHTML =
    '<div style="border-top:1px solid #a2a9b1;margin-top:24px;padding-top:10px;">' +
    '<div style="font-family:sans-serif;font-size:11.5px;font-weight:600;color:#54595d;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">&#128204; Citato in</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
    citanti.map(function(n) {
      return '<a onclick="navigateTo(' + JSON.stringify(n) + ')" ' +
             'style="font-family:sans-serif;font-size:12.5px;color:#0645ad;border:1px solid #a2a9b1;padding:2px 8px;background:#f8f9fa;cursor:pointer;">' +
             escHtml(n) + '</a>';
    }).join('') +
    '</div></div>';

  if (cats) {
    cats.parentNode.insertBefore(section, cats);
  } else {
    article.appendChild(section);
  }
}

function creaPaginaDelGiorno() {
    // Usa le pagine già caricate in cache (popolata da preloadAllPages all'avvio)
    const pagine = [];
    for (const nome in pages) {
        if (nome === 'Main') continue;
        const p = pages[nome];
        if (!p || !p.content) continue;
        const tmp = document.createElement('div');
        tmp.innerHTML = p.content;

        // Estratto: primo paragrafo abbastanza lungo nel corpo dell'articolo
        let estratto = '';
        const paragrafi = tmp.querySelectorAll('.wiki-article-body p, p');
        for (const el of paragrafi) {
            const testo = el.textContent.trim();
            if (testo.length > 80) {
                estratto = testo.length > 280 ? testo.substring(0, 280) + '…' : testo;
                break;
            }
        }
        pagine.push({ nome, estratto });
    }

    if (pagine.length === 0) return;

    // 2. Sceglie la pagina in base alla data (cambia ogni giorno)
    const oggi = new Date();
    const seed = oggi.getFullYear() * 10000 + (oggi.getMonth() + 1) * 100 + oggi.getDate();
    const { nome: nomePagina, estratto } = pagine[seed % pagine.length];

    // 3. Inserisce nel contenitore della main page
    const container = document.getElementById('daily-box-container');
    if (!container) return;

    const dataOggi = oggi.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

    container.innerHTML = `
        <div style="border:1px solid #a2a9b1; background:#f8f9fa; margin-bottom:20px; overflow:hidden;">
            <div style="background:#cee0f2; border-bottom:1px solid #a2a9b1; padding:6px 14px; display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-family:'Source Sans 3',sans-serif; font-size:12px; color:#202122; text-transform:uppercase; letter-spacing:0.06em;">📖 Pagina del giorno</strong>
                <span style="font-family:'Source Sans 3',sans-serif; font-size:11px; color:#54595d;">${dataOggi}</span>
            </div>
            <div style="padding:14px 16px; display:flex; gap:14px; align-items:flex-start;">
                <div style="flex-shrink:0; width:80px; height:80px; border:1px solid #eaecf0; background:#fff; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                    <img src="${nomePagina.toLowerCase().replace(/\s+/g, '')}.jpg"
                         onerror="this.parentElement.innerHTML='<span style=\\'font-size:32px\\'>📄</span>'"
                         style="width:100%;height:100%;object-fit:cover;">
                </div>
                <div style="flex:1; min-width:0;">
                    <div style="font-family:'Linux Libertine Display',Georgia,serif; font-size:18px; margin-bottom:5px;">
                        <a onclick="navigateTo('${nomePagina.replace(/'/g, "\\'")}')" style="color:#0645ad; cursor:pointer; font-weight:normal;">${nomePagina}</a>
                    </div>
                    ${estratto ? `<p style="font-family:'Source Serif 4',Georgia,serif; font-size:13px; line-height:1.6; color:#202122; margin:0 0 8px;">${estratto}</p>` : ''}
                    <a onclick="navigateTo('${nomePagina.replace(/'/g, "\\'")}')" style="font-family:'Source Sans 3',sans-serif; font-size:12px; color:#0645ad; cursor:pointer;">Leggi l'articolo completo →</a>
                </div>
            </div>
        </div>
    `;
}

(async function initEnciclopocchiedia() {
  initLogoDinamico();
  initCharTooltipEvents();
  await preloadAllPages();
  updateSidebar();
  navigateTo('Main');
  initSearch();
})();

// ══════════════════════════════════════════════════════
//  LOGO DINAMICO (variante casuale a ogni caricamento)
// ══════════════════════════════════════════════════════

function initLogoDinamico() {
  const variantiLogo = ["logo.jpg", "morello.jpg", "filippo.jpg", "alessio.jpg", "ludovico.jpg"];
  const i = Math.floor(Math.random() * variantiLogo.length);
  const imgLogo = document.getElementById('logo-dinamico');

  if (imgLogo) {
    imgLogo.src = variantiLogo[i];
    console.log("Immagine cambiata in: " + variantiLogo[i]);
  }
}

// ══════════════════════════════════════════════════════
//  TOOLTIP PERSONAGGI — mostra un'immagine passando il mouse
//  (o toccando su mobile) sopra un nome, senza dover creare una
//  pagina apposta solo per far vedere una faccia.
//
//  I nomi da riconoscere e le relative immagini si definiscono in
//  un file a parte, "personaggi-data.js", dentro l'oggetto globale
//  PERSONAGGI_IMG. Se quel file non è incluso nella pagina, questa
//  funzionalità semplicemente non fa nulla (nessun errore).
// ══════════════════════════════════════════════════════

let charTooltipEl = null;
let charTooltipPinned = false;

function getPersonaggiMap() {
  return (typeof PERSONAGGI_IMG !== 'undefined') ? PERSONAGGI_IMG : null;
}

// Cerca nel testo dell'articolo tutte le occorrenze dei nomi noti e le
// trasforma in span cliccabili/hoverabili. Non tocca link esistenti,
// script/style, né nomi già trasformati in precedenza.
function evidenziaPersonaggi(root) {
  const map = getPersonaggiMap();
  if (!map || !root) return;

  const nomi = Object.keys(map).filter(n => n && n.trim().length > 0);
  if (nomi.length === 0) return;

  // Ordina dal nome più lungo al più corto, così "Mario Rossi" viene
  // riconosciuto prima del semplice "Mario" contenuto al suo interno.
  nomi.sort((a, b) => b.length - a.length);
  const escaped = nomi.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp('(' + escaped.join('|') + ')', 'g');

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest('.char-name, a, script, style, textarea')) return NodeFilter.FILTER_REJECT;
      regex.lastIndex = 0;
      if (!regex.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodiDaSostituire = [];
  let n;
  while ((n = walker.nextNode())) nodiDaSostituire.push(n);

  nodiDaSostituire.forEach(node => {
    const testo = node.nodeValue;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(testo)) !== null) {
      if (m.index > lastIndex) frag.appendChild(document.createTextNode(testo.slice(lastIndex, m.index)));
      const span = document.createElement('span');
      span.className = 'char-name';
      span.tabIndex = 0;
      span.dataset.char = m[1];
      span.textContent = m[1];
      frag.appendChild(span);
      lastIndex = m.index + m[1].length;
    }
    if (lastIndex < testo.length) frag.appendChild(document.createTextNode(testo.slice(lastIndex)));
    node.parentNode.replaceChild(frag, node);
  });
}

function ensureCharTooltip() {
  if (charTooltipEl) return charTooltipEl;
  const el = document.createElement('div');
  el.id = 'char-tooltip';
  el.innerHTML = '<img alt="">' + '<div class="ct-name"></div>';
  document.body.appendChild(el);
  charTooltipEl = el;
  return el;
}

function showCharTooltip(target, nome) {
  const map = getPersonaggiMap();
  if (!map || !map[nome]) return;
  const el = ensureCharTooltip();
  const img = el.querySelector('img');
  img.src = map[nome];
  img.alt = nome;
  el.querySelector('.ct-name').textContent = nome;
  el.classList.add('visible');

  const rect = target.getBoundingClientRect();
  const tw = el.offsetWidth || 190;
  let left = rect.left + rect.width / 2 - tw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
  let top = rect.top - el.offsetHeight - 10;
  if (top < 8) top = rect.bottom + 10;
  el.style.left = left + 'px';
  el.style.top = top + 'px';
}

function hideCharTooltip() {
  if (!charTooltipEl) return;
  charTooltipEl.classList.remove('visible');
  charTooltipPinned = false;
}

function initCharTooltipEvents() {
  const article = document.getElementById('wiki-article');
  if (!article) return;

  // Desktop: passaggio del mouse
  article.addEventListener('mouseover', function(e) {
    const span = e.target.closest('.char-name');
    if (span) showCharTooltip(span, span.dataset.char);
  });
  article.addEventListener('mouseout', function(e) {
    const span = e.target.closest('.char-name');
    if (span && !charTooltipPinned) hideCharTooltip();
  });

  // Tastiera (accessibilità)
  article.addEventListener('focusin', function(e) {
    const span = e.target.closest('.char-name');
    if (span) showCharTooltip(span, span.dataset.char);
  });
  article.addEventListener('focusout', function() {
    if (!charTooltipPinned) hideCharTooltip();
  });

  // Mobile/tocco: il click "fissa" il tooltip finché non si tocca altrove
  article.addEventListener('click', function(e) {
    const span = e.target.closest('.char-name');
    if (span) {
      e.preventDefault();
      charTooltipPinned = true;
      showCharTooltip(span, span.dataset.char);
    }
  });
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.char-name') && !e.target.closest('#char-tooltip')) {
      hideCharTooltip();
    }
  });
}
