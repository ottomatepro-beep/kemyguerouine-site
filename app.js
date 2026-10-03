/* =========================================================
   FVIA (Formez-vous à l'IA) - application
   Routeur par ancre, trois roles (membre, admin, god mode), donnees locales.
   IMPORTANT : la connexion est simulee dans le navigateur. Avant mise en ligne,
   les roles doivent etre verifies par un serveur. Rien ici n'est une securite.
   ========================================================= */
(() => {
  'use strict';

  // ---------- Stockage local (protege : navigation privee, stockage bloque) ----------
  const PREFIX = 'fvia:';
  // Reprise des donnees enregistrees sous l'ancien nom (OTTOTECH)
  try { Object.keys(localStorage).filter(k => k.startsWith('ottotech:')).forEach(k => { const n = 'fvia:' + k.slice(9); if (localStorage.getItem(n) === null) localStorage.setItem(n, localStorage.getItem(k)); localStorage.removeItem(k); }); } catch (e) {}
  const store = {
    get(k, d) { try { const v = localStorage.getItem(PREFIX + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible : l'etat reste en memoire */ } },
    clear() { try { Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k)); } catch (e) {} }
  };

  const EMPTY_DATA = () => ({ cours: [], videos: [], ateliers: [], exercices: [], rendus: [], articles: [], nouveautes: [], projets: [], posts: [], evenements: [] });
  // Credits : sur le site, les clients qui paient directement debloquent le contenu avec des credits
  // (Skool sert le parcours CPF, avec le meme contenu). Valeurs par defaut, reglables dans la console.
  const COUT_DEFAUT = { cours: 1, videos: 1, ateliers: 2, exercices: 1, articles: 0 };
  const PACKS_DEFAUT = [
    { id: 'decouverte', nom: 'Découverte', credits: 10, prix: '' },
    { id: 'essentiel', nom: 'Essentiel', credits: 30, prix: '', reco: true },
    { id: 'integral', nom: 'Intégral', credits: 80, prix: '' }
  ];
  const DEFAULT_FLAGS = { forum: true, projets: true, evenements: true, classement: true, membres: true, accompagnement: true, ateliers: true, exercices: true };

  const S = {
    user: store.get('user', null),
    viewAs: store.get('viewAs', null),
    data: Object.assign(EMPTY_DATA(), store.get('data', {})),
    settings: Object.assign({ annonce: '', delai: '' }, store.get('settings', {})),
    flags: Object.assign({}, DEFAULT_FLAGS, store.get('flags', {})),
    quiz: store.get('quiz', null),
    progress: store.get('progress', {}),
    votes: store.get('votes', {}),
    watch: store.get('watch', {}),
    audit: store.get('audit', []),
    theme: store.get('theme', 'light'),
    announceClosed: store.get('announceClosed', ''),
    members: store.get('members', []),
    waitlist: store.get('waitlist', []),
    retractations: store.get('retractations', []),
    wallets: store.get('wallets', {})
  };
  S.settings.cout = Object.assign({}, COUT_DEFAUT, S.settings.cout || {});
  if (!Array.isArray(S.settings.packs) || S.settings.packs.length !== 3) S.settings.packs = PACKS_DEFAUT.map(p => ({ ...p }));
  if (typeof S.settings.bienvenue !== 'number') S.settings.bienvenue = 0;
  const save = (...keys) => keys.forEach(k => store.set(k, S[k]));
  // Ancienne rubrique "formations" (videos) : on la range dans "videos"
  if (S.data.formations) { S.data.videos = S.data.videos.concat(S.data.formations); delete S.data.formations; save('data'); }

  // Mode demo : raccourcis de roles visibles seulement avec ?demo=1 (memorise). Sans lui, l'acces equipe reste ferme.
  if (/[?&]demo=1/.test(location.search)) store.set('demo', true);
  if (/[?&]demo=0/.test(location.search)) store.set('demo', false);
  const DEMO = store.get('demo', false);

  // ---------- Roles ----------
  const RANK = { guest: 0, member: 1, admin: 2, god: 3 };
  const ROLE = {
    guest: { label: 'Invité', badge: 'badge-member', icon: 'user-round' },
    member: { label: 'Membre', badge: 'badge-member', icon: 'user-round' },
    admin: { label: 'Admin', badge: 'badge-admin', icon: 'shield-check' },
    god: { label: 'God mode', badge: 'badge-god', icon: 'crown' }
  };
  const realRole = () => (S.user ? S.user.role : 'guest');
  const role = () => (realRole() === 'god' && S.viewAs ? S.viewAs : realRole());
  const atLeast = r => RANK[role()] >= RANK[r];
  const roleBadge = r => `<span class="badge ${ROLE[r].badge}">${ic(ROLE[r].icon)}${ROLE[r].label}</span>`;

  const PERMS = [
    ['Lire les contenus publics', 'guest'],
    ['Suivre les cours et les vidéos, garder sa progression', 'member'],
    ['Rendre un exercice et recevoir sa correction', 'member'],
    ['Débloquer un contenu avec ses tokens', 'member'],
    ['Publier dans la communauté et voter', 'member'],
    ['Partager un projet', 'member'],
    ['Créer cours, vidéos, ateliers, exercices, articles', 'admin'],
    ['Corriger les exercices rendus', 'admin'],
    ['Accéder à tout le contenu sans token', 'admin'],
    ['Régler les prix, les packs et offrir des tokens', 'admin'],
    ['Modérer : épingler et supprimer', 'admin'],
    ['Voir les membres et les réglages du site', 'admin'],
    ['Activer ou couper une fonctionnalité', 'god'],
    ["Changer le rôle d'un compte", 'god'],
    ['Voir le site en tant que...', 'god'],
    ["Journal d'audit et remise à zéro", 'god']
  ];

  // ---------- Utilitaires ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (n, cls = '') => `<i data-lucide="${n}"${cls ? ` class="${cls}"` : ''} aria-hidden="true"></i>`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const initials = name => (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const firstName = name => (name || '').trim().split(/\s+/)[0] || '';
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  const ago = t => {
    const s = Math.round((t - Date.now()) / 1000);
    const a = Math.abs(s);
    if (a < 60) return "à l'instant";
    if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
    if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
    if (a < 2592000) return rtf.format(Math.round(s / 86400), 'day');
    return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const dateLong = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function icons() {
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons({ attrs: { 'stroke-width': 1.5 } });
  }

  function audit(msg) {
    S.audit.unshift({ t: Date.now(), who: S.user ? S.user.name : 'Invité', msg });
    S.audit = S.audit.slice(0, 200);
    save('audit');
  }

  // ---------- Points et niveaux (gradient d'objectif) ----------
  const LEVELS = [0, 10, 30, 60, 100, 160, 240, 350, 500];
  function pointsOf(email, since = 0) {
    if (!email) return 0;
    const posts = S.data.posts.filter(p => p.authorEmail === email && p.date >= since);
    const fromPosts = posts.reduce((a, p) => a + Math.max(0, p.score || 0), 0) + posts.length;
    const fromReplies = S.data.posts.reduce((a, p) => a + (p.replies || []).filter(r => r.authorEmail === email && r.date >= since).length, 0);
    const fromProjects = S.data.projets.filter(p => p.authorEmail === email && p.date >= since).length * 3;
    const fromRendus = S.data.rendus.filter(r => r.email === email && r.date >= since).length * 5;
    const fromLearning = !since && email === (S.user && S.user.email) ? Object.values(S.progress).filter(v => v >= 100).length * 10 : 0;
    return fromPosts + fromReplies + fromProjects + fromRendus + fromLearning;
  }
  function levelOf(pts) {
    let lv = 1;
    LEVELS.forEach((min, i) => { if (pts >= min) lv = i + 1; });
    const next = LEVELS[lv] ?? null;
    const cur = LEVELS[lv - 1];
    return { lv, next, cur, pct: next === null ? 100 : Math.round(((pts - cur) / (next - cur)) * 100) };
  }

  // ---------- Parcours en 3 questions (engagement progressif) ----------
  const QUIZ = [
    { k: 'niveau', q: "Où en es-tu avec l'IA ?", o: [
      { v: 'decouvre', icon: 'compass', t: 'Je découvre', s: "J'en entends parler, je n'ai pas encore essayé" },
      { v: 'utilise', icon: 'message-circle', t: "J'utilise ChatGPT ou Claude", s: 'Pour écrire, chercher, résumer' },
      { v: 'construis', icon: 'hammer', t: 'Je construis déjà', s: "J'ai commencé une automatisation ou une app" }
    ] },
    { k: 'but', q: 'Que veux-tu construire ?', o: [
      { v: 'automatiser', icon: 'route', t: 'Automatiser mon travail', s: 'Les tâches répétitives, une fois pour toutes' },
      { v: 'lancer', icon: 'rocket', t: 'Lancer une activité', s: 'Proposer un service ou un produit' },
      { v: 'app', icon: 'layout-dashboard', t: 'Créer mon application', s: 'Un outil pour moi ou pour mes clients' }
    ] },
    { k: 'temps', q: 'Combien de temps as-tu par semaine ?', o: [
      { v: '1-2', icon: 'clock', t: '1 à 2 heures', s: 'Un petit rythme, tenu dans la durée' },
      { v: '3-5', icon: 'clock', t: '3 à 5 heures', s: 'Un vrai créneau dans la semaine' },
      { v: '5+', icon: 'clock', t: 'Plus de 5 heures', s: 'Tu veux avancer vite' }
    ] }
  ];
  const PARCOURS = {
    automatiser: 'Automatiser ton travail',
    lancer: 'Lancer ton activité',
    app: 'Construire ton application'
  };
  const DEPART = { decouvre: 'Départ : les bases', utilise: 'Départ : au-delà du chat', construis: 'Départ : passer à la vitesse supérieure' };
  const RYTHME = { '1-2': '1 à 2 h par semaine', '3-5': '3 à 5 h par semaine', '5+': 'plus de 5 h par semaine' };
  let quizStep = 0;
  let quizAnswers = {};

  // ---------- Communaute ----------
  const COMM = [
    { r: 'communaute', t: 'Forum', icon: 'messages-square', flag: 'forum', d: 'Questions, entraide, discussions' },
    { r: 'projets', t: 'Projets', icon: 'folder-kanban', flag: 'projets', d: 'Ce que les membres construisent' },
    { r: 'evenements', t: 'Événements', icon: 'calendar-days', flag: 'evenements', d: 'Lives, ateliers et replays' },
    { r: 'classement', t: 'Classement', icon: 'trophy', flag: 'classement', d: 'Niveaux et points' },
    { r: 'membres', t: 'Membres', icon: 'users', flag: 'membres', d: 'Les personnes qui avancent avec toi' }
  ];
  const SALONS = [
    { id: 'annonces', t: 'Annonces', icon: 'megaphone', staff: true },
    { id: 'presentations', t: 'Présentations', icon: 'user-round' },
    { id: 'entraide', t: 'Entraide', icon: 'life-buoy' },
    { id: 'creations', t: 'Mes créations', icon: 'hammer' },
    { id: 'ressources', t: 'Ressources', icon: 'book-open-text' },
    { id: 'hors-sujet', t: 'Hors-sujet', icon: 'coffee' }
  ];
  const salon = id => SALONS.find(s => s.id === id) || SALONS[2];

  // ---------- Schemas de creation (tiroir generique) ----------
  const SCHEMAS = {
    cours: { title: 'Nouveau cours', done: 'Cours publié', min: 'admin', fields: [
      { k: 'titre', l: 'Titre', req: true, ph: 'Par exemple : Comprendre une API sans jargon' },
      { k: 'parcours', l: 'Parcours', type: 'select', opts: 'parcours' },
      { k: 'niveau', l: 'Niveau', type: 'select', opts: ['Débutant', 'Intermédiaire', 'Avancé'] },
      { k: 'duree', l: 'Temps de lecture', help: 'Par exemple : 8 min' },
      { k: 'description', l: 'Résumé', type: 'textarea', req: true, help: 'Deux phrases, affichées dans la liste.' },
      { k: 'contenu', l: 'Le cours', type: 'textarea', rows: 14 },
      { k: 'credits', l: 'Tokens pour débloquer', type: 'number', help: 'Vide : le coût par défaut du format (réglable dans Réglages). 0 : gratuit.' }
    ] },
    videos: { title: 'Nouvelle vidéo', done: 'Vidéo publiée', min: 'admin', fields: [
      { k: 'titre', l: 'Titre', req: true, ph: 'Par exemple : Ta première automatisation' },
      { k: 'parcours', l: 'Parcours', type: 'select', opts: 'parcours' },
      { k: 'niveau', l: 'Niveau', type: 'select', opts: ['Débutant', 'Intermédiaire', 'Avancé'] },
      { k: 'duree', l: 'Durée', help: 'Par exemple : 18 min' },
      { k: 'video', l: 'Lien de la vidéo', type: 'url', help: 'Facultatif. YouTube, Vimeo ou fichier.' },
      { k: 'description', l: 'Description', type: 'textarea', req: true },
      { k: 'credits', l: 'Tokens pour débloquer', type: 'number', help: 'Vide : le coût par défaut du format (réglable dans Réglages). 0 : gratuit.' }
    ] },
    ateliers: { title: 'Nouvel atelier', done: 'Atelier programmé', min: 'admin', fields: [
      { k: 'titre', l: 'Titre', req: true, ph: 'Par exemple : On met ton site en ligne' },
      { k: 'date', l: 'Date', type: 'date', req: true },
      { k: 'heure', l: 'Heure', type: 'time' },
      { k: 'duree', l: 'Durée', help: 'Par exemple : 1 h 30' },
      { k: 'format', l: 'Format', type: 'select', opts: ['En direct', 'Replay'] },
      { k: 'lien', l: 'Lien', type: 'url', help: "Facultatif. Le lien de visio pour le direct, ou celui du replay une fois l'atelier passé." },
      { k: 'description', l: 'Ce que vous allez construire', type: 'textarea' },
      { k: 'credits', l: 'Tokens pour débloquer', type: 'number', help: 'Vide : le coût par défaut du format (réglable dans Réglages). 0 : gratuit.' }
    ] },
    exercices: { title: 'Nouvel exercice', done: 'Exercice publié', min: 'admin', fields: [
      { k: 'titre', l: 'Titre', req: true, ph: 'Par exemple : Automatise ton premier email' },
      { k: 'niveau', l: 'Niveau', type: 'select', opts: ['Débutant', 'Intermédiaire', 'Avancé'] },
      { k: 'temps', l: 'Temps estimé', help: 'Par exemple : 45 min' },
      { k: 'consigne', l: 'La consigne', type: 'textarea', req: true, rows: 6 },
      { k: 'livrable', l: 'Ce que l\'élève rend', type: 'textarea', req: true, help: 'Par exemple : le lien de ton site et une capture de la page.' },
      { k: 'lie', l: 'Cours ou vidéo lié', help: 'Facultatif. Le titre du cours que l\'exercice met en pratique.' },
      { k: 'credits', l: 'Tokens pour débloquer', type: 'number', help: 'Vide : le coût par défaut du format (réglable dans Réglages). 0 : gratuit.' }
    ] },
    articles: { title: 'Nouvel article', done: 'Article publié', min: 'admin', fields: [
      { k: 'titre', l: 'Titre', req: true },
      { k: 'theme', l: 'Thème', type: 'select', opts: ['Méthode', 'Outils', "Retours d'expérience"] },
      { k: 'resume', l: 'Résumé', type: 'textarea', req: true, help: 'Deux phrases, affichées dans la liste.' },
      { k: 'contenu', l: 'Contenu', type: 'textarea', rows: 10 },
      { k: 'credits', l: 'Tokens pour débloquer', type: 'number', help: 'Vide : le coût par défaut du format (réglable dans Réglages). 0 : gratuit.' }
    ] },
    nouveautes: { title: 'Nouvelle annonce', done: 'Nouveauté publiée', min: 'admin', fields: [
      { k: 'titre', l: 'Titre', req: true },
      { k: 'type', l: 'Type', type: 'select', opts: ['Nouvelle formation', 'Amélioration', 'Événement', 'Communauté'] },
      { k: 'texte', l: 'Texte', type: 'textarea', req: true }
    ] },
    evenements: { title: 'Nouvel événement', done: 'Événement ajouté', min: 'admin', fields: [
      { k: 'titre', l: 'Titre', req: true },
      { k: 'date', l: 'Date', type: 'date', req: true },
      { k: 'heure', l: 'Heure', type: 'time' },
      { k: 'format', l: 'Format', type: 'select', opts: ['Live en ligne', 'Atelier', 'Replay'] },
      { k: 'description', l: 'Description', type: 'textarea' }
    ] },
    projets: { title: 'Partager un projet', done: 'Projet partagé', min: 'member', fields: [
      { k: 'titre', l: 'Nom du projet', req: true },
      { k: 'description', l: "Ce qu'il fait", type: 'textarea', req: true, help: 'Le problème de départ, et ce que ton outil change.' },
      { k: 'lien', l: 'Lien', type: 'url', help: 'Facultatif.' }
    ] },
    posts: { title: 'Nouvelle publication', done: 'Message publié', min: 'member', fields: [
      { k: 'salon', l: 'Salon', type: 'select', opts: 'salons' },
      { k: 'titre', l: 'Titre', req: true, ph: 'Ta question ou ton sujet, en une phrase' },
      { k: 'texte', l: 'Message', type: 'textarea', req: true, rows: 6, help: "Si tu bloques : dis ce que tu as déjà essayé, on t'aidera plus vite." }
    ] }
  };

  // ---------- Routeur ----------
  const main = $('#main');
  const seen = new Set();
  let pendingAction = null;
  let forumSort = 'populaires';
  let lbRange = 'toujours';
  let calOffset = 0;
  let filters = { niveau: 'Tous', parcours: 'Tous', articles: 'Tous', q: '' };

  function parse() {
    const h = (location.hash || '#/').replace(/^#\/?/, '');
    const [name = '', a = '', b = ''] = h.split('/').map(decodeURIComponent);
    return { name, a, b };
  }
  const go = path => { if (location.hash === '#/' + path) render(); else location.hash = '#/' + path; };

  const ROUTES = {
    '': { v: viewHome, t: 'Formez-vous à l\'IA (FVIA)' },
    apprendre: { v: viewApprendre, t: 'Apprendre' },
    cours: { v: () => viewLearnList('cours'), t: 'Cours', skel: true },
    cour: { v: p => viewTrack('cours', p), t: 'Cours' },
    videos: { v: () => viewLearnList('videos'), t: 'Vidéos', skel: true },
    video: { v: p => viewTrack('videos', p), t: 'Vidéo' },
    formations: { v: () => viewLearnList('videos'), t: 'Vidéos' },
    formation: { v: p => viewTrack('videos', p), t: 'Vidéo' },
    ateliers: { v: viewAteliers, t: 'Ateliers', flag: 'ateliers', skel: true },
    atelier: { v: viewAtelier, t: 'Atelier', flag: 'ateliers' },
    exercices: { v: () => viewLearnList('exercices'), t: 'Exercices', flag: 'exercices', skel: true },
    exercice: { v: viewExercice, t: 'Exercice', flag: 'exercices' },
    articles: { v: viewArticles, t: 'Articles', skel: true },
    article: { v: viewArticle, t: 'Article' },
    nouveautes: { v: viewNouveautes, t: 'Nouveautés' },
    communaute: { v: viewForum, t: 'Forum', flag: 'forum', skel: true },
    post: { v: viewPost, t: 'Discussion', flag: 'forum' },
    projets: { v: viewProjets, t: 'Projets', flag: 'projets' },
    evenements: { v: viewEvenements, t: 'Événements', flag: 'evenements' },
    classement: { v: viewClassement, t: 'Classement', flag: 'classement' },
    membres: { v: viewMembres, t: 'Membres', flag: 'membres' },
    accompagnement: { v: viewAccompagnement, t: 'Accompagnement', flag: 'accompagnement' },
    tarifs: { v: viewTarifs, t: 'Packs de tokens' },
    espace: { v: viewEspace, t: 'Mon espace', min: 'member' },
    admin: { v: viewAdmin, t: 'Console admin', min: 'admin' },
    godmode: { v: viewGod, t: 'God mode', min: 'god', real: true },
    legal: { v: viewLegal, t: 'Informations légales' },
    retractation: { v: viewRetractation, t: 'Se rétracter du contrat' }
  };

  function render() {
    const p = parse();
    const route = ROUTES[p.name] || { v: viewNotFound, t: 'Page introuvable' };
    closeFloating();
    let html;
    const need = route.min;
    const effective = route.real ? realRole() : role();
    if (need && RANK[effective] < RANK[need]) html = viewGate(need);
    else if (route.flag && !S.flags[route.flag] && realRole() !== 'god') html = viewDisabled();
    else if (route.skel && !seen.has(p.name) && !reduceMotion()) {
      seen.add(p.name);
      html = viewSkeleton();
      const h0 = location.hash;
      setTimeout(() => { if (location.hash === h0) paint(route.v(parse()), route, parse(), true); }, 260);
    } else html = route.v(p);
    paint(html, route, p);
  }

  function paint(html, route, p, keepScroll) {
    const flagNote = route.flag && !S.flags[route.flag] && realRole() === 'god'
      ? `<div class="container" style="padding-top:16px"><div class="badge badge-god">${ic('eye-off')}Fonction coupée pour le public, visible car tu es en god mode</div></div>` : '';
    main.innerHTML = `<div id="top-sentinel" aria-hidden="true"></div>${flagNote}<div class="view">${html}</div>`;
    document.title = route.t === ROUTES[''].t ? route.t : `${route.t} | FVIA`;
    renderChrome(p.name);
    icons();
    observe();
    if (!keepScroll) { const h = document.documentElement; h.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); h.style.scrollBehavior = ''; }
  }

  let lastHash = location.hash || '#/';
  window.addEventListener('hashchange', () => {
    // Lien d'evitement "Aller au contenu" : on donne le focus au contenu sans changer de page
    if (location.hash === '#main') { history.replaceState(null, '', lastHash); main.focus(); return; }
    lastHash = location.hash;
    closeLayer(true); render(); main.focus({ preventScroll: true });
  });

  // ---------- Observateurs (pas d'ecouteur de defilement) ----------
  let io, navIo;
  function observe() {
    if (io) io.disconnect();
    io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    $$('.reveal, .path').forEach(el => io.observe(el));
    if (navIo) navIo.disconnect();
    const sentinel = $('#top-sentinel');
    navIo = new IntersectionObserver(([e]) => $('#nav').classList.toggle('is-scrolled', !e.isIntersecting));
    if (sentinel) navIo.observe(sentinel);
  }

  // ---------- Habillage : navigation, bandeaux, pied de page, barre mobile ----------
  function renderChrome(cur) {
    const r = realRole();
    const user = S.user;
    const commActive = COMM.some(c => c.r === cur) || cur === 'post';
    const learnActive = LEARN_ROUTES.includes(cur);

    // Ruban god mode : voir le site en tant que...
    $('#god-ribbon').innerHTML = r === 'god' ? `
      <div class="god-ribbon" role="region" aria-label="God mode">
        <strong>${ic('crown')}God mode actif</strong>
        <span>Voir en tant que</span>
        <div class="seg" role="group" aria-label="Voir le site en tant que">
          ${[['', 'Moi'], ['guest', 'Invité'], ['member', 'Membre'], ['admin', 'Admin']].map(([v, l]) => `<button type="button" data-action="viewas" data-v="${v}" aria-pressed="${(S.viewAs || '') === v}">${l}</button>`).join('')}
        </div>
      </div>` : '';

    // Bandeau d'annonce (regle depuis la console admin)
    const a = S.settings.annonce;
    $('#announce').innerHTML = a && S.announceClosed !== a ? `
      <div class="announce"><span>${esc(a)}</span>
        <button class="icon-btn" data-action="close-announce" aria-label="Fermer l'annonce">${ic('x')}</button></div>` : '';

    const link = (r2, t, cls = '') => `<a class="nav-link ${cls}" href="#/${r2}" ${cur === r2 ? 'aria-current="page"' : ''}>${t}</a>`;
    $('#nav').innerHTML = `
      <div class="container nav-inner">
        <a class="brand" href="#/" aria-label="Formez-vous à l'IA, accueil"><span class="brand-mark" aria-hidden="true"><span>F</span></span>FVIA</a>
        <div class="nav-links">
          <button type="button" class="nav-link" data-action="mega" data-m="learn" aria-expanded="false" aria-controls="mega" ${learnActive ? 'aria-current="page"' : ''}>Apprendre ${ic('chevron-down')}</button>
          <button type="button" class="nav-link" data-action="mega" data-m="comm" aria-expanded="false" aria-controls="mega" ${commActive ? 'aria-current="page"' : ''}>Communauté ${ic('chevron-down')}</button>
          ${link('nouveautes', 'Nouveautés', 'opt')}
          ${S.flags.accompagnement || r === 'god' ? link('accompagnement', 'Accompagnement') : ''}
        </div>
        <div class="nav-right">
          <button type="button" class="search-trigger" data-action="cmd" aria-label="Rechercher (Ctrl K)">${ic('search')}<span class="label">Rechercher</span><span class="kbd">${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'} K</span></button>
          ${user && role() === 'member' ? `<a class="credit-chip" href="#/tarifs" aria-label="${wallet().solde} tokens, voir les packs">${ic('coins')}<span>${wallet().solde}</span></a>` : ''}
          ${user ? `
            <button type="button" class="user-btn" data-action="usermenu" aria-haspopup="menu" aria-expanded="false" aria-controls="user-menu" aria-label="Menu du compte de ${esc(user.name)}">
              <span class="avatar ${r === 'god' ? 'gold' : ''}">${esc(initials(user.name))}</span>${ic('chevron-down')}
            </button>` : `
            <button type="button" class="btn btn-sm btn-quiet btn-signin" data-action="login">Se connecter</button>
            <button type="button" class="btn btn-sm btn-primary btn-start" data-action="start">Commencer</button>`}
        </div>
      </div>`;

    paintMega();

    $('#user-menu').innerHTML = user ? `
      <div class="popover-head"><span class="avatar lg ${r === 'god' ? 'gold' : ''}">${esc(initials(user.name))}</span>
        <div><strong>${esc(user.name)}</strong>${roleBadge(r)}</div></div>
      <div class="menu-sep"></div>
      <a class="menu-item" role="menuitem" href="#/espace">${ic('house')}Mon espace</a>
      ${RANK[r] >= 2 ? `<a class="menu-item" role="menuitem" href="#/admin">${ic('layout-dashboard')}Console admin</a>` : ''}
      ${r === 'god' ? `<a class="menu-item" role="menuitem" href="#/godmode">${ic('crown')}God mode</a>` : ''}
      <div class="menu-sep"></div>
      <div style="padding:6px 8px 8px"><span class="tiny muted" style="display:block;margin:0 4px 6px">Apparence</span>
        <div class="seg" role="group" aria-label="Apparence" style="width:100%">
          ${[['light', 'sun', 'Clair'], ['dark', 'moon', 'Sombre'], ['system', 'monitor', 'Auto']].map(([v, i, l]) => `<button type="button" style="flex:1" data-action="theme" data-v="${v}" aria-pressed="${S.theme === v}">${ic(i)}${l}</button>`).join('')}
        </div></div>
      <div class="menu-sep"></div>
      <button type="button" class="menu-item" role="menuitem" data-action="logout">${ic('log-out')}Se déconnecter</button>` : '';

    const fl = (r2, t) => `<li><a href="#/${r2}">${t}</a></li>`;
    $('#footer').innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <a class="brand" href="#/" aria-label="Formez-vous à l'IA, accueil"><span class="brand-mark" aria-hidden="true"><span>F</span></span>FVIA</a>
            <p style="margin-top:8px;max-width:32ch">Formez-vous à l'IA. Apprendre à construire avec l'IA, quand on n'est pas développeur.</p>
          </div>
          <div><h4>Apprendre</h4><ul>${fl('apprendre', "Vue d'ensemble")}${LEARN.filter(learnOn).map(l => fl(l.r, l.t)).join('')}${fl('nouveautes', 'Nouveautés')}</ul></div>
          <div><h4>Communauté</h4><ul>${COMM.filter(c => S.flags[c.flag]).map(c => fl(c.r, c.t)).join('')}</ul></div>
          <div><h4>Accompagnement</h4><ul>${fl('tarifs', 'Les packs de tokens')}${S.flags.accompagnement ? fl('accompagnement', 'Les formules') : ''}<li><a href="https://www.ottom4t3.com" target="_blank" rel="noopener">OTTOM4T3, fait pour toi</a></li></ul></div>
          <div><h4>Compte</h4><ul>${user ? fl('espace', 'Mon espace') : '<li><button type="button" data-action="login">Se connecter</button></li>'}<li><button type="button" data-action="team">Accès équipe</button></li></ul></div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 Formez-vous à l'IA</span>
          <span style="display:flex;gap:20px;flex-wrap:wrap"><a href="#/legal/mentions">Mentions légales</a><a href="#/legal/confidentialite">Confidentialité</a><a href="#/legal/cgv">Conditions de vente</a><a href="#/retractation" style="color:var(--fg);font-weight:600">Se rétracter du contrat ici</a></span>
        </div>
      </div>`;

    const tb = (r2, i, t, match) => `<a href="#/${r2}" ${match ? 'aria-current="page"' : ''}>${ic(i)}<span>${t}</span></a>`;
    $('#tabbar').innerHTML = `
      ${tb('', 'house', 'Accueil', cur === '')}
      ${tb('apprendre', 'graduation-cap', 'Apprendre', learnActive)}
      ${tb('communaute', 'messages-square', 'Communauté', commActive)}
      ${user ? tb('espace', 'user-round', 'Mon espace', cur === 'espace' || cur === 'admin' || cur === 'godmode') : `<button type="button" data-action="login">${ic('log-in')}<span>Connexion</span></button>`}
      <button type="button" data-action="menu-sheet">${ic('menu')}<span>Plus</span></button>`;
  }

  // ---------- Morceaux reutilisables ----------
  const pageHead = (title, lead, right = '') => `
    <header class="page-head container"><div class="row">
      <div><h1 class="display-l">${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div>
      ${right ? `<div>${right}</div>` : ''}
    </div></header>`;

  const communityNav = cur => `
    <div class="subnav"><div class="container subnav-inner">
      <span class="subnav-title">Communauté</span>
      ${COMM.filter(c => S.flags[c.flag] || realRole() === 'god').map(c => `<a href="#/${c.r}" ${cur === c.r ? 'aria-current="page"' : ''}>${ic(c.icon)}${c.t}</a>`).join('')}
    </div></div>`;

  const emptyState = ({ icon, title, text, actions = '' }) => `
    <div class="empty reveal">
      <div class="empty-art">${ic(icon)}</div>
      <h3>${title}</h3>
      <p>${text}</p>
      ${actions ? `<div class="actions">${actions}</div>` : ''}
    </div>`;

  // Bouton "me prevenir" : invite un invite a creer son compte, bascule l'abonnement d'un membre
  function watchBtn(key, label = 'Me prévenir') {
    if (!S.user) return `<button type="button" class="btn btn-primary" data-action="signup">${ic('bell')}${label}</button>`;
    const on = !!S.watch[key];
    return `<button type="button" class="btn ${on ? 'btn-quiet' : 'btn-primary'}" data-action="watch" data-k="${key}" aria-pressed="${on}">${ic(on ? 'bell-ring' : 'bell')}${on ? 'Tu seras prévenu' : label}</button>`;
  }
  const createBtn = (type, label, cls = 'btn-primary') => `<button type="button" class="btn ${cls}" data-action="create" data-type="${type}">${ic('plus')}${label}</button>`;

  function viewSkeleton() {
    return `<div class="container" style="padding-top:64px" aria-busy="true" aria-label="Chargement">
      <div class="skeleton" style="height:48px;width:320px;margin-bottom:16px"></div>
      <div class="skeleton" style="height:22px;width:460px;max-width:100%;margin-bottom:48px"></div>
      <div class="sk-grid">${'<div class="skeleton sk-card"></div>'.repeat(3)}</div></div>`;
  }

  function viewGate(need) {
    const isGod = need === 'god';
    const isAdmin = need === 'admin';
    return `<div class="gate">
      <div class="empty-art">${ic(isGod ? 'crown' : isAdmin ? 'shield-check' : 'lock')}</div>
      <h1 class="display-m">${isGod ? 'Accès fondateur' : isAdmin ? 'Espace réservé à l\'équipe' : 'Connecte-toi pour continuer'}</h1>
      <p class="muted">${isGod ? 'Cette console ne s\'ouvre qu\'avec le compte fondateur et son code à 6 chiffres.' : isAdmin ? 'Cette page est réservée aux administrateurs.' : 'Ton espace garde ta progression, tes messages et ton parcours.'}</p>
      <div class="actions" style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap;justify-content:center">
        ${isGod || isAdmin ? `<button type="button" class="btn btn-primary" data-action="team">${ic('key-round')}Accès équipe</button>` : `<button type="button" class="btn btn-primary" data-action="login">Se connecter</button><button type="button" class="btn btn-secondary" data-action="signup">Créer un compte</button>`}
      </div></div>`;
  }
  const viewDisabled = () => `<div class="gate"><div class="empty-art">${ic('eye-off')}</div><h1 class="display-m">Bientôt disponible</h1><p class="muted">Cet espace ouvre prochainement.</p><a class="btn btn-primary" href="#/">Retour à l'accueil</a></div>`;
  const viewNotFound = () => `<div class="gate"><div class="empty-art">${ic('compass')}</div><h1 class="display-m">Cette page n'existe pas</h1><p class="muted">Le lien est peut-être ancien. Tout le reste est à un clic.</p><div style="display:flex;gap:10px"><a class="btn btn-primary" href="#/">Accueil</a><button type="button" class="btn btn-quiet" data-action="cmd">${ic('search')}Rechercher</button></div></div>`;

  // =========================================================
  // ACCUEIL
  // =========================================================
  function viewHome() {
    return `
    <section class="hero">
      <div class="container hero-grid">
        <div>
          <h1 class="display-xl">Tu n'es pas développeur.<span class="second">Moi non plus.</span></h1>
          <p class="lead">Apprends à construire tes propres outils avec l'IA, pas à pas, avec quelqu'un qui te répond.</p>
          <div class="hero-ctas">
            <button type="button" class="btn btn-primary btn-lg" data-action="start">Commencer ${ic('arrow-right')}</button>
            <a class="btn btn-secondary btn-lg" href="#/apprendre">Voir comment on apprend</a>
          </div>
        </div>
        <div id="quiz" class="quiz" aria-live="polite">${quizHTML()}</div>
      </div>
    </section>

    <section class="band alt" aria-labelledby="h-espaces">
      <div class="container">
        <div class="section-head reveal">
          <h2 id="h-espaces" class="display-l">Cinq façons d'apprendre, une seule communauté.</h2>
          <p class="lead">Des cours pour comprendre, des vidéos pour voir faire, des ateliers pour construire ensemble, des exercices corrigés pour progresser.</p>
        </div>
        <div class="bento">
          <a class="tile tile-formations reveal" href="#/videos" style="--d:0">
            <span class="t-icon">${ic('play')}</span>
            <h3>Cours vidéo</h3>
            <p>Des leçons courtes, dans l'ordre. Ta progression est enregistrée, tu reprends où tu t'es arrêté.</p>
            <span class="t-go">Voir les vidéos ${ic('arrow-right')}</span>
            <span class="play-orb" aria-hidden="true"><span class="po-btn"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></span></span>
          </a>
          <a class="tile reveal" href="#/cours" style="--d:1">
            <span class="t-icon">${ic('book-open-text')}</span>
            <h3>Cours</h3>
            <p>Comprendre à ton rythme, en quelques minutes de lecture.</p>
          </a>
          ${S.flags.ateliers ? `<a class="tile reveal" href="#/ateliers" style="--d:2">
            <span class="t-icon" style="color:var(--gold);background:var(--gold-tint)">${ic('presentation')}</span>
            <h3>Ateliers</h3>
            <p>En direct, chacun construit son projet. Le replay reste.</p>
          </a>` : ''}
          ${S.flags.exercices ? `<a class="tile tile-projets reveal" href="#/exercices" style="--d:3">
            <span class="t-icon">${ic('list-checks')}</span>
            <h3>Exercices</h3>
            <p>Tu rends ton travail, tu reçois une correction.</p>
          </a>` : ''}
          <a class="tile reveal" href="#/articles" style="--d:4">
            <span class="t-icon">${ic('newspaper')}</span>
            <h3 class="serif" style="font-size:26px">Articles</h3>
            <p>Des réponses claires aux questions que tu te poses.</p>
          </a>
          ${S.flags.forum ? `<a class="tile tile-skool span-2 reveal" href="#/communaute" style="--d:5">
            <span class="t-icon">${ic('messages-square')}</span>
            <h3>Communauté</h3>
            <p>Pose ta question, montre où tu en es. Chaque contribution te fait monter de niveau.</p>
            <span class="levels" aria-hidden="true">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<span>${n}</span>`).join('')}</span>
          </a>` : ''}
          ${S.flags.accompagnement ? `<a class="tile tile-accomp span-2 reveal" href="#/accompagnement" style="--d:6">
            <span class="t-icon">${ic('heart-handshake')}</span>
            <h3>Accompagnement</h3>
            <p>Quelqu'un regarde ton travail et te répond. Et si tu n'as pas le temps, l'agence le fait pour toi.</p>
          </a>` : ''}
        </div>
      </div>
    </section>

    <section class="band" aria-labelledby="h-path">
      <div class="container">
        <h2 id="h-path" class="display-l reveal" style="max-width:18ch">Comment tu vas avancer.</h2>
        <div class="path">
          <span class="path-line" aria-hidden="true"></span>
          ${[
            ['target', 'Choisis ton parcours', "Trois questions, et tu sais par où commencer."],
            ['hammer', 'Construis en apprenant', 'Tu travailles sur ton projet, pas sur des exercices.'],
            ['share-2', 'Montre ton travail', 'Tu le partages, la communauté te fait des retours.'],
            ['trophy', 'Passe au niveau suivant', 'Ta progression reste visible, étape après étape.']
          ].map(([i, t, d], n) => `<div class="path-step" style="--i:${n}"><div class="path-dot">${ic(i)}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}
        </div>
      </div>
    </section>

    ${S.flags.accompagnement ? `
    <section class="band deep on-deep" aria-labelledby="h-accomp">
      <div class="container">
        <div class="chapter-grid">
          <div class="reveal">
            <h2 id="h-accomp" class="display-l">Tu bloques ?<br>Quelqu'un te répond.</h2>
            <p class="lead">Des formations gratuites, il en existe. Ce qui manque le plus souvent, c'est quelqu'un qui suit ton avancée.</p>
            <div style="margin-top:28px"><a class="link-arrow" href="#/accompagnement">Découvrir l'accompagnement ${ic('chevron-right')}</a></div>
          </div>
          <ul class="chapter-list reveal" style="--d:2">
            <li>${ic('message-circle')}<div><strong>Des réponses, pas un silence</strong><span>${S.settings.delai ? `Réponse sous ${esc(S.settings.delai)}, c'est un engagement.` : 'Le délai de réponse sera annoncé et tenu.'}</span></div></li>
            <li>${ic('circle-check')}<div><strong>Ton travail relu</strong><span>Tu reçois un retour sur ce que tu construis.</span></div></li>
            <li>${ic('users')}<div><strong>Des gens au même point que toi</strong><span>Tu avances avec d'autres, pas tout seul.</span></div></li>
          </ul>
        </div>
        <div class="bridge reveal">
          <p><strong>Pas le temps de le faire toi-même ?</strong> L'agence OTTOM4T3 peut le construire pour toi.</p>
          <a class="btn btn-light" href="https://www.ottom4t3.com" target="_blank" rel="noopener">Voir OTTOM4T3 ${ic('external-link')}</a>
        </div>
      </div>
    </section>` : ''}

    <section class="band" aria-labelledby="h-promesses">
      <div class="container">
        <h2 id="h-promesses" class="display-l reveal" style="max-width:20ch">Ce qu'on ne te promettra jamais.</h2>
        <div class="pledges">
          ${[
            ['Un revenu.', "Personne ne peut te le garantir. Ceux qui le font te vendent autre chose qu'une formation."],
            ['Une urgence.', 'Pas de compte à rebours, pas de places qui disparaissent. Tu décides quand tu es prêt.'],
            ['Des résultats cachés.', 'Le taux de réussite sera publié, échecs compris.']
          ].map(([t, d], i) => `<div class="pledge reveal" style="--d:${i}"><span class="p-icon">${ic('x')}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}
        </div>
      </div>
    </section>

    <section class="band alt" aria-labelledby="h-faq">
      <div class="container faq-grid">
        <div class="sticky reveal">
          <h2 id="h-faq" class="display-m">Les questions qu'on nous pose.</h2>
          <p class="muted" style="margin-top:16px">Une autre question ? Pose-la dans la communauté.</p>
        </div>
        <div class="acc reveal" style="--d:1">
          ${[
            ['Faut-il savoir coder ?', "Non. C'est même le point de départ : tout est pensé pour quelqu'un qui n'a jamais écrit une ligne de code."],
            ['Et si je bloque ?', "Tu poses ta question dans la communauté, ou en accompagnement si tu l'as choisi. Tu n'es pas seul face à l'écran."],
            ["Qui est derrière FVIA ?", "Kemy. Ancien infirmier, il a créé son agence d'automatisation et son logiciel sans être développeur. Il t'apprend à faire pareil."],
            ['Je peux commencer gratuitement ?', "Oui : les articles et une partie de la communauté sont ouverts. Crée ton compte pour garder ton parcours."]
          ].map(([q, a], i) => `<div class="acc-item"><button type="button" class="acc-btn" data-action="acc" aria-expanded="false" aria-controls="acc-${i}" id="accb-${i}">${q}<span class="plus">${ic('plus')}</span></button><div class="acc-panel" id="acc-${i}" role="region" aria-labelledby="accb-${i}"><div><p>${a}</p></div></div></div>`).join('')}
        </div>
      </div>
    </section>

    <section class="final">
      <div class="container reveal">
        <h2 class="display-l">Ton point de départ t'attend.</h2>
        <p class="lead">Trois questions, deux minutes, et tu sais par où commencer.</p>
        <button type="button" class="btn btn-primary btn-lg" data-action="start">Commencer ${ic('arrow-right')}</button>
      </div>
    </section>`;
  }

  function quizHTML() {
    if (S.quiz && quizStep >= QUIZ.length) return quizResultHTML(S.quiz);
    if (S.quiz && quizStep === 0 && !Object.keys(quizAnswers).length) return quizResultHTML(S.quiz);
    const step = QUIZ[quizStep];
    return `
      <div class="quiz-head"><h2>Trouve ton point de départ</h2><span class="small muted">${quizStep + 1} sur ${QUIZ.length}</span></div>
      <div class="quiz-steps" aria-hidden="true">${QUIZ.map((_, i) => `<span class="${i < quizStep ? 'done' : ''}"></span>`).join('')}</div>
      <div class="quiz-body"><div class="quiz-panel">
        <p class="quiz-q" id="quiz-q">${step.q}</p>
        <div class="options" role="group" aria-labelledby="quiz-q">
          ${step.o.map(o => `<button type="button" class="option" data-action="quiz-pick" data-k="${step.k}" data-v="${o.v}" aria-pressed="${quizAnswers[step.k] === o.v}">
            <span class="o-icon">${ic(o.icon)}</span><span><strong>${o.t}</strong><span>${o.s}</span></span><span class="o-check">${ic('circle-check')}</span></button>`).join('')}
        </div>
      </div></div>
      <div class="quiz-foot">
        ${quizStep > 0 ? `<button type="button" class="btn btn-sm btn-quiet" data-action="quiz-back">${ic('arrow-left')}Retour</button>` : '<span class="small muted">Sans inscription, deux minutes.</span>'}
      </div>`;
  }

  function quizResultHTML(q) {
    return `<div class="quiz-result quiz-panel">
      <div class="result-mark">${ic('route')}</div>
      <p class="small muted">Ton parcours conseillé</p>
      <p class="result-title">${PARCOURS[q.but] || 'Ton parcours'}</p>
      <div class="result-tags">
        <span class="badge badge-admin">${DEPART[q.niveau] || ''}</span>
        <span class="badge badge-member">${ic('clock')}${RYTHME[q.temps] || ''}</span>
      </div>
      <div class="result-actions">
        ${S.user
          ? `<a class="btn btn-primary btn-block" href="#/apprendre">Voir par où commencer ${ic('arrow-right')}</a>`
          : `<button type="button" class="btn btn-primary btn-block" data-action="signup">Garder mon parcours ${ic('arrow-right')}</button>`}
        <button type="button" class="btn btn-quiet btn-block" data-action="quiz-reset">${ic('rotate-ccw')}Refaire le test</button>
      </div>
    </div>`;
  }

  function refreshQuiz() {
    const el = $('#quiz');
    if (!el) return;
    el.innerHTML = quizHTML();
    icons();
  }

  // =========================================================
  // CREDITS : portefeuille, cout d'un contenu, deblocage
  // =========================================================
  const KIND_OBJ = { cours: 'ce cours', videos: 'cette vidéo', ateliers: 'cet atelier', exercices: 'cet exercice', articles: 'cet article' };
  function wallet(email) {
    const e = email || (S.user && S.user.email);
    if (!e) return null;
    if (!S.wallets[e]) S.wallets[e] = { solde: 0, debloques: [], journal: [] };
    return S.wallets[e];
  }
  function coutOf(kind, item) {
    const v = item && item.credits !== undefined && item.credits !== '' ? parseInt(item.credits, 10) : NaN;
    return Number.isFinite(v) && v >= 0 ? v : (S.settings.cout[kind] ?? 0);
  }
  function accessOf(kind, item) {
    const cout = coutOf(kind, item);
    if (cout === 0) return { ok: true, cout, free: true };
    if (atLeast('admin')) return { ok: true, cout, staff: true };
    if (!S.user) return { ok: false, cout, guest: true };
    const w = wallet();
    if (w.debloques.includes(item.id)) return { ok: true, cout, owned: true };
    return { ok: false, cout, solde: w.solde };
  }
  const creditBadge = (kind, item) => {
    const a = accessOf(kind, item);
    if (a.free || a.staff) return '';
    if (a.owned) return `<span class="badge badge-success">${ic('lock-open')}Débloqué</span>`;
    return `<span class="badge badge-member">${ic('lock')}${plural(a.cout, 'token', 'tokens')}</span>`;
  };
  function lockPanel(kind, item, a, label) {
    if (a.guest) return `<div class="lock reveal"><span class="lock-icon">${ic('lock')}</span><div class="lock-text"><strong>Réservé aux membres</strong><p class="small muted">Crée ton compte, choisis un pack de tokens et débloque ce que tu veux, quand tu veux.</p></div><div class="lock-actions"><button type="button" class="btn btn-primary" data-action="signup">Créer mon compte</button><a class="btn btn-quiet" href="#/tarifs">Voir les packs</a></div></div>`;
    const manque = a.cout - a.solde;
    return `<div class="lock reveal"><span class="lock-icon">${ic('lock')}</span><div class="lock-text"><strong>${label || 'Débloque ' + KIND_OBJ[kind]} pour ${plural(a.cout, 'token', 'tokens')}</strong><p class="small muted">Tu as ${plural(a.solde, 'token', 'tokens')}. ${manque > 0 ? `Il t'en manque ${manque}.` : 'Une fois débloqué, il reste dans ton espace.'}</p></div><div class="lock-actions">${manque > 0 ? `<a class="btn btn-primary" href="#/tarifs">${ic('coins')}Recharger mes tokens</a>` : `<button type="button" class="btn btn-primary" data-action="unlock" data-kind="${kind}" data-id="${item.id}" data-cout="${a.cout}">${ic('lock-open')}Débloquer</button>`}</div>${manque > 0 ? '' : `<p class="tiny muted lock-legal">En débloquant, tu demandes l'accès immédiat à ${KIND_OBJ[kind]} et tu reconnais perdre ton droit de rétractation pour ce contenu (article L221-28 du Code de la consommation). Tes tokens non utilisés restent remboursables 14 jours.</p>`}</div>`;
  }
  const lockAside = a => `<h2 class="title-m">${plural(a.cout, 'token', 'tokens')}</h2><p class="small muted" style="margin:8px 0 20px">Débloqué une fois, ce contenu reste ensuite accessible dans ton espace.</p><a class="btn btn-quiet btn-block" href="#/tarifs">Comment marchent les tokens</a>`;

  function viewTarifs() {
    const w = role() === 'member' ? wallet() : null;
    const c = S.settings.cout;
    const equiv = n => {
      const parts = [];
      if (c.videos) parts.push(`${Math.floor(n / c.videos)} cours ou vidéos`);
      if (c.ateliers) parts.push(`${Math.floor(n / c.ateliers)} ateliers`);
      return parts.length ? "Jusqu'à " + parts.join(', ou ') : 'Tout le contenu';
    };
    const btn = p => {
      if (atLeast('admin')) return `<a class="btn btn-quiet btn-block" href="#/admin/reglages">Régler ce pack</a>`;
      if (S.user && DEMO) return `<button type="button" class="btn btn-block ${p.reco ? 'btn-primary' : 'btn-secondary'}" data-action="buy" data-id="${p.id}">Ajouter ${p.credits} tokens (démo)</button>`;
      return `<button type="button" class="btn btn-block ${p.reco ? 'btn-primary' : 'btn-secondary'}" data-action="waitlist">Être prévenu à l'ouverture</button>`;
    };
    return `${pageHead('Les packs de tokens', "Tu paies une fois, puis tu débloques ce que tu veux, quand tu veux. Pas d'abonnement.", w ? `<a class="wallet-big" href="#/espace">${ic('coins')}<span><strong>${w.solde}</strong> ${w.solde > 1 ? 'tokens disponibles' : 'token disponible'}</span></a>` : '')}
      <section class="container" style="padding-bottom:96px">
        <div class="offers">${S.settings.packs.map(p => `
          <div class="offer ${p.reco ? 'featured' : ''} reveal">
            ${p.reco ? `<span class="badge badge-god flag">${ic('star')}Recommandé</span>` : ''}
            <h3>${esc(p.nom)}</h3>
            <p class="credits-big"><strong>${p.credits}</strong> tokens</p>
            <p class="price">${p.prix ? esc(p.prix) + ' €' : "Prix annoncé à l'ouverture"}</p>
            <ul>
              <li>${ic('check')}<span>${equiv(p.credits)}</span></li>
              <li>${ic('check')}<span>Les exercices que tu débloques sont corrigés</span></li>
              <li>${ic('check')}<span>Les articles et la communauté, sans token</span></li>
            </ul>
            ${btn(p)}
          </div>`).join('')}</div>
        <section class="panel reveal" style="margin-top:56px">
          <h2 class="title-l" style="margin-bottom:24px">Ce que coûte chaque format</h2>
          <div class="cost-grid">${LEARN.filter(learnOn).map(l => `<a class="cost" href="#/${l.r}"><span class="combo-icon">${ic(l.icon)}</span><strong>${l.t}</strong><span class="small muted">${c[l.r] ? plural(c[l.r], 'token', 'tokens') : 'Gratuit'}</span></a>`).join('')}</div>
          <p class="small muted" style="margin-top:20px">Un contenu débloqué reste accessible dans ton espace. Les ateliers se réservent avec des tokens, le replay est inclus.</p>
        </section>
      </section>`;
  }

  // =========================================================
  // APPRENDRE : cours, videos, ateliers, exercices, articles
  // =========================================================
  const PARCOURS_OPTS = ["Je me lance dans l'IA", "J'automatise ma boîte", 'Tronc commun'];
  const NIVEAUX = ['Débutant', 'Intermédiaire', 'Avancé'];
  const KIND = {
    cours: { label: 'Cours', detail: 'cour', icon: 'book-open-text', lead: 'Pour comprendre, à ton rythme. Chaque cours se lit en quelques minutes.', empty: 'Les premiers cours arrivent.', create: 'Nouveau cours', track: true, fem: false },
    videos: { label: 'Vidéos', detail: 'video', icon: 'play', lead: "Pour voir faire, étape par étape. Ta progression est enregistrée.", empty: 'Les premières vidéos arrivent.', create: 'Nouvelle vidéo', track: true, fem: true },
    exercices: { label: 'Exercices', detail: 'exercice', icon: 'list-checks', lead: "Un nouvel exercice chaque jour. Tu rends ton travail, tu reçois une correction écrite.", empty: 'Les premiers exercices arrivent.', create: 'Nouvel exercice', track: false, fem: false }
  };
  const LEARN = [
    { r: 'cours', t: 'Cours', icon: 'book-open-text', d: 'Comprendre, à ton rythme' },
    { r: 'videos', t: 'Vidéos', icon: 'play', d: 'Voir faire, étape par étape' },
    { r: 'ateliers', t: 'Ateliers', icon: 'presentation', d: 'Construire ensemble, en direct', flag: 'ateliers' },
    { r: 'exercices', t: 'Exercices', icon: 'list-checks', d: 'Pratiquer et être corrigé', flag: 'exercices' },
    { r: 'articles', t: 'Articles', icon: 'newspaper', d: 'Approfondir un sujet précis' }
  ];
  const LEARN_ROUTES = ['apprendre', 'cours', 'cour', 'videos', 'video', 'formations', 'formation', 'ateliers', 'atelier', 'exercices', 'exercice', 'articles', 'article'];
  const learnOn = l => !l.flag || S.flags[l.flag] || realRole() === 'god';
  const learnNav = cur => `
    <div class="subnav"><div class="container subnav-inner">
      <span class="subnav-title">Apprendre</span>
      <a href="#/apprendre" ${cur === 'apprendre' ? 'aria-current="page"' : ''}>${ic('layers')}Vue d'ensemble</a>
      ${LEARN.filter(learnOn).map(l => `<a href="#/${l.r}" ${cur === l.r ? 'aria-current="page"' : ''}>${ic(l.icon)}${l.t}</a>`).join('')}
    </div></div>`;
  const PLAY_SVG = '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>';
  const atTime = a => new Date(a.date + 'T' + (a.heure || '23:59')).getTime();
  const dateFr = a => new Date(a.date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + (a.heure ? ' à ' + a.heure : '');

  const rendusOf = (exId, email) => S.data.rendus.filter(r => r.exId === exId && (!email || r.email === email)).sort((a, b) => b.date - a.date);
  function exStatus(exId) {
    if (!S.user) return null;
    const r = rendusOf(exId, S.user.email)[0];
    if (!r) return { k: 'todo', t: 'À faire', cls: 'badge-member' };
    if (r.statut === 'corrige') return { k: 'done', t: 'Corrigé', cls: 'badge-success', r };
    return { k: 'wait', t: 'En attente de correction', cls: 'badge-gold', r };
  }

  // ---------- Vue d'ensemble ----------
  function viewApprendre() {
    const word = { cours: ['cours', 'cours'], videos: ['vidéo', 'vidéos'], ateliers: ['atelier', 'ateliers'], exercices: ['exercice', 'exercices'], articles: ['article', 'articles'] };
    const info = {
      videos: { cls: 'tile-formations wide', d: "Des leçons courtes, dans l'ordre, pour voir chaque étape à l'écran. Tu reprends exactement où tu t'es arrêté." },
      cours: { cls: '', d: 'La même matière, par écrit. Pour comprendre en profondeur et revenir sur un point précis.' },
      ateliers: { cls: 'tile-accomp', d: 'En direct, en petit groupe : chacun avance sur son propre projet. Le replay reste disponible.' },
      exercices: { cls: 'tile-projets', d: 'Un cas concret à faire seul. Tu rends ton travail, tu reçois une correction écrite.' },
      articles: { cls: '', d: 'Une question, une réponse claire. Lisibles par tous, même sans compte.' }
    };
    const tiles = ['videos', 'cours', 'ateliers', 'exercices', 'articles'].map(r => LEARN.find(l => l.r === r)).filter(learnOn).map((l, i) => {
      const c = (S.data[l.r] || []).length;
      return `<a class="tile ${info[l.r].cls} reveal" href="#/${l.r}" style="--d:${i}">
        <span class="t-icon">${ic(l.icon)}</span>
        <h3${l.r === 'articles' ? ' class="serif"' : ''}>${l.t}</h3>
        <p>${info[l.r].d}</p>
        <span class="t-go">${c ? plural(c, word[l.r][0], word[l.r][1]) : 'Bientôt disponible'} ${ic('arrow-right')}</span>
        ${l.r === 'videos' ? `<span class="play-orb" aria-hidden="true"><span class="po-btn"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></span></span>` : ''}
      </a>`;
    }).join('');
    return `${learnNav('apprendre')}${pageHead('Apprendre', 'Cinq formats qui se complètent. Commence par celui qui te ressemble, les autres suivront.')}
      <div class="container" style="padding-bottom:96px">
        <div class="learn-grid">${tiles}</div>
        <section class="panel reveal" style="margin-top:48px">
          <h2 class="title-l" style="margin-bottom:24px">Comment ils s'emboîtent</h2>
          <div class="combo">
            ${[['play', 'Tu regardes', 'La vidéo te montre comment faire.'], ['book-open-text', 'Tu comprends', 'Le cours explique le pourquoi, à ton rythme.'], ['list-checks', 'Tu pratiques', "L'exercice te fait construire, la correction te fait progresser."]].map(([i, t, d]) => `<div><span class="combo-icon">${ic(i)}</span><h3 class="title-m">${t}</h3><p class="small muted" style="margin-top:4px">${d}</p></div>`).join('')}
          </div>
          <p class="small muted" style="margin-top:24px">Les ateliers te font avancer avec les autres. Les articles répondent aux questions précises.</p>
        </section>
      </div>`;
  }

  // ---------- Listes : cours, videos, exercices ----------
  function viewLearnList(kind) {
    const K = KIND[kind];
    const all = S.data[kind];
    const q = filters.q.toLowerCase();
    const list = all.filter(f => (filters.niveau === 'Tous' || f.niveau === filters.niveau)
      && (kind === 'exercices' || filters.parcours === 'Tous' || f.parcours === filters.parcours)
      && (!q || ((f.titre || '') + ' ' + (f.description || f.consigne || '')).toLowerCase().includes(q)));
    const inProgress = K.track && S.user ? all.filter(f => (S.progress[f.id] || 0) > 0 && S.progress[f.id] < 100) : [];
    const right = atLeast('admin') ? createBtn(kind, K.create) : '';
    let body;
    if (!all.length) {
      body = emptyState({
        icon: K.icon, title: K.empty,
        text: atLeast('admin') ? 'Publie le premier : il apparaîtra ici pour tous les membres.' : S.user ? 'Active la notification, tu seras prévenu dès la mise en ligne.' : 'Crée ton compte pour être prévenu dès la mise en ligne et garder ta progression.',
        actions: atLeast('admin') ? createBtn(kind, K.create) : `${watchBtn('contenus')}<a class="btn btn-quiet" href="#/apprendre">Voir les autres formats</a>`
      });
    } else if (!list.length) {
      body = emptyState({ icon: 'search', title: 'Rien ne correspond.', text: 'Essaie un autre niveau, un autre parcours ou un autre mot.', actions: `<button type="button" class="btn btn-quiet" data-action="reset-filters">Tout afficher</button>` });
    } else {
      const jour = kind === 'exercices' && filters.niveau === 'Tous' && !q ? list[0] : null;
      body = `${jour ? `<a class="today reveal" href="#/exercice/${jour.id}"><span class="today-tag">${ic('sunrise')}L'exercice du jour</span><h2 class="display-m">${esc(jour.titre)}</h2><p class="lead">${esc((jour.consigne || '').slice(0, 160))}</p><span class="t-go">S'y mettre ${ic('arrow-right')}</span></a>` : ''}
        <div class="grid-3">${(jour ? list.slice(1) : list).map((f, i) => learnCard(kind, f, i)).join('')}</div>`;
    }
    const chips = (key, opts, allLabel, label) => `<div class="chips" role="group" aria-label="${label}">${['Tous', ...opts].map(n => `<button type="button" class="chip" data-action="filter" data-f="${key}" data-v="${esc(n)}" aria-pressed="${filters[key] === n}">${n === 'Tous' ? allLabel : esc(n)}</button>`).join('')}</div>`;
    return `${learnNav(kind)}${pageHead(K.label, K.lead, right)}
      <div class="container" style="padding-bottom:96px">
        ${inProgress.length ? `<section class="panel reveal" style="margin-bottom:32px"><div class="panel-head"><h2>Reprendre là où tu t'es arrêté</h2></div><div class="grid-3">${inProgress.map((f, i) => learnCard(kind, f, i)).join('')}</div></section>` : ''}
        ${all.length ? `<div class="toolbar">
          <label class="search-field"><span class="sr-only">Rechercher</span>${ic('search')}<input type="search" data-bind="q" value="${esc(filters.q)}" placeholder="Rechercher"></label>
          ${chips('niveau', NIVEAUX, 'Tous niveaux', 'Filtrer par niveau')}
          ${kind !== 'exercices' ? chips('parcours', PARCOURS_OPTS, 'Tous parcours', 'Filtrer par parcours') : ''}
        </div>` : ''}
        ${body}
      </div>`;
  }

  function learnCard(kind, f, i = 0) {
    const K = KIND[kind];
    const p = S.progress[f.id] || 0;
    const e = K.fem ? 'e' : '';
    const st = kind === 'exercices' ? exStatus(f.id) : null;
    const media = kind === 'videos' ? `<div class="card-media">${ic('play')}</div>` : `<div class="card-media ${kind === 'cours' ? 'media-cours' : 'media-ex'}">${ic(K.icon)}</div>`;
    return `<a class="card reveal" href="#/${K.detail}/${f.id}" style="--d:${i % 6}">
      ${media}
      <div class="card-body">
        <div class="card-meta"><span class="badge badge-admin">${esc(f.niveau || 'Débutant')}</span>${f.parcours ? `<span>${esc(f.parcours)}</span>` : ''}${f.duree || f.temps ? `<span>${esc(f.duree || f.temps)}</span>` : ''}</div>
        <h3>${esc(f.titre)}</h3>
        <p class="small muted">${esc((f.description || f.consigne || '').slice(0, 120))}</p>
        ${K.track && S.user ? `<div class="progress" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="Progression"><i style="width:${p}%"></i></div><span class="tiny muted">${p >= 100 ? 'Terminé' + e : p > 0 ? 'En cours' : 'Pas encore commencé' + e}</span>` : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap">${st && accessOf(kind, f).ok ? `<span class="badge ${st.cls}">${st.t}</span>` : ''}${creditBadge(kind, f)}</div>
      </div></a>`;
  }

  // ---------- Fiche : cours ou video ----------
  function viewTrack(kind, p) {
    const K = KIND[kind];
    const f = S.data[kind].find(x => x.id === p.a);
    if (!f) return viewNotFound();
    const prog = S.progress[f.id] || 0;
    const e = K.fem ? 'e' : '';
    const acc = accessOf(kind, f);
    const top = !acc.ok ? '' : kind === 'videos'
      ? `<div class="player" style="margin-top:16px">${f.video ? `<a class="po-btn" href="${esc(f.video)}" target="_blank" rel="noopener" aria-label="Lire la vidéo">${PLAY_SVG}</a>` : `<div style="display:grid;justify-items:center;gap:12px"><span class="po-btn" aria-hidden="true">${PLAY_SVG}</span><span class="small">Vidéo bientôt en ligne</span></div>`}</div>`
      : '';
    const body = !acc.ok ? `<p class="lead" style="margin:20px 0 28px">${esc(f.description)}</p>${lockPanel(kind, f, acc)}` : kind === 'cours'
      ? `<p class="lead" style="margin:20px 0 32px">${esc(f.description)}</p>${f.contenu ? `<div class="lesson">${esc(f.contenu)}</div>` : '<p class="muted">Le contenu de ce cours arrive bientôt.</p>'}`
      : `<p class="measure" style="white-space:pre-line;margin-top:20px">${esc(f.description)}</p>`;
    return `${learnNav(kind)}<div class="container detail-grid">
      <div>
        <a class="link-arrow" href="#/${kind}">${ic('chevron-left')}${K.label}</a>
        ${top}
        <h1 class="display-m" style="margin-top:${kind === 'videos' ? 32 : 16}px">${esc(f.titre)}</h1>
        <div class="card-meta" style="margin-top:12px"><span class="badge badge-admin">${esc(f.niveau || 'Débutant')}</span>${f.parcours ? `<span>${esc(f.parcours)}</span>` : ''}${f.duree ? `<span>${esc(f.duree)}</span>` : ''}<span>Publié${e} ${ago(f.date)}</span></div>
        ${body}
      </div>
      <aside class="panel" style="position:sticky;top:calc(var(--nav-h) + 72px)">
        ${!acc.ok ? lockAside(acc) : S.user ? `
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
            <div class="ring" style="--p:${prog}"><span>${prog}%</span></div>
            <div><strong>${prog >= 100 ? 'Terminé' + e : prog > 0 ? 'En cours' : 'Pas commencé' + e}</strong><p class="small muted">${prog >= 100 ? 'Bravo. Passe à la pratique.' : prog > 0 ? 'Tu y es presque.' : 'Ta progression sera gardée.'}</p></div>
          </div>
          ${prog >= 100 ? `<a class="btn btn-primary btn-block" href="#/exercices">${ic('list-checks')}Faire un exercice</a>`
            : `<button type="button" class="btn btn-primary btn-block" data-action="progress" data-id="${f.id}" data-kind="${kind}">${prog > 0 ? `${ic('circle-check')}Marquer comme terminé${e}` : `${ic(kind === 'videos' ? 'play' : 'book-open-text')}Commencer`}</button>`}
        ` : `
          <h2 class="title-m">Garde ta progression</h2>
          <p class="small muted" style="margin:8px 0 20px">Avec un compte, tu reprends exactement où tu t'étais arrêté.</p>
          <button type="button" class="btn btn-primary btn-block" data-action="signup">Créer mon compte</button>`}
        ${atLeast('admin') ? `<div class="menu-sep" style="margin:20px 0"></div><button type="button" class="btn btn-quiet btn-block" data-action="delete" data-type="${kind}" data-id="${f.id}">${ic('trash-2')}Supprimer</button>` : ''}
      </aside></div>`;
  }

  // ---------- Fiche : exercice (rendu et correction) ----------
  function viewExercice(p) {
    const f = S.data.exercices.find(x => x.id === p.a);
    if (!f) return viewNotFound();
    const st = exStatus(f.id);
    const nb = rendusOf(f.id).length;
    const acc = accessOf('exercices', f);
    let side;
    if (!acc.ok) side = lockAside(acc);
    else if (!S.user) side = `<h2 class="title-m">Rends ton travail, reçois une correction</h2><p class="small muted" style="margin:8px 0 20px">Crée ton compte pour rendre cet exercice et suivre sa correction.</p><button type="button" class="btn btn-primary btn-block" data-action="signup">Créer mon compte</button>`;
    else if (st.k === 'todo') side = `<span class="badge badge-member">À faire</span><p class="small muted" style="margin:12px 0 20px">Quand c'est prêt, rends ton travail : un lien et deux lignes d'explication suffisent.${S.settings.delai ? ` Correction sous ${esc(S.settings.delai)}.` : ''}</p><button type="button" class="btn btn-primary btn-block" data-action="rendre" data-id="${f.id}">${ic('arrow-right')}Rendre mon exercice</button>`;
    else if (st.k === 'wait') side = `<span class="badge badge-gold">${ic('clock')}En attente de correction</span><p class="small muted" style="margin:12px 0 20px">Rendu ${ago(st.r.date)}. Tu seras prévenu dès que la correction arrive.</p><button type="button" class="btn btn-quiet btn-block" data-action="rendre" data-id="${f.id}">Remplacer mon rendu</button>`;
    else side = `<span class="badge badge-success">${ic('circle-check')}Corrigé</span><div class="reply" style="margin:14px 0 20px"><div class="card-meta" style="margin-bottom:6px"><strong style="color:var(--fg)">${esc(st.r.correcteur || 'Correction')}</strong><span>${ago(st.r.corrigeLe)}</span></div><p style="white-space:pre-line">${esc(st.r.retour)}</p></div><button type="button" class="btn btn-secondary btn-block" data-action="rendre" data-id="${f.id}">Rendre une nouvelle version</button>`;
    return `${learnNav('exercices')}<div class="container detail-grid">
      <div>
        <a class="link-arrow" href="#/exercices">${ic('chevron-left')}Exercices</a>
        <h1 class="display-m" style="margin-top:16px">${esc(f.titre)}</h1>
        <div class="card-meta" style="margin:12px 0 32px"><span class="badge badge-admin">${esc(f.niveau || 'Débutant')}</span>${f.temps ? `<span>${esc(f.temps)}</span>` : ''}${f.lie ? `<span>Met en pratique : ${esc(f.lie)}</span>` : ''}${atLeast('admin') ? `<span>${plural(nb, 'rendu', 'rendus')}</span>` : ''}</div>
        ${acc.ok ? `<section class="panel" style="margin-bottom:16px"><h2 class="title-m" style="margin-bottom:10px">La consigne</h2><p class="lesson" style="font-size:17px">${esc(f.consigne)}</p></section>
        <section class="panel"><h2 class="title-m" style="margin-bottom:10px">Ce que tu rends</h2><p class="lesson" style="font-size:17px">${esc(f.livrable)}</p></section>` : lockPanel('exercices', f, acc, 'Débloque cet exercice et sa correction')}
      </div>
      <aside class="panel" style="position:sticky;top:calc(var(--nav-h) + 72px)">${side}
        ${atLeast('admin') ? `<div class="menu-sep" style="margin:20px 0"></div><a class="btn btn-quiet btn-block" href="#/admin/corrections">${ic('list-checks')}Voir les rendus</a><button type="button" class="btn btn-quiet btn-block" style="margin-top:8px" data-action="delete" data-type="exercices" data-id="${f.id}">${ic('trash-2')}Supprimer</button>` : ''}
      </aside></div>`;
  }

  // ---------- Ateliers ----------
  function viewAteliers() {
    const now = Date.now();
    const avenir = S.data.ateliers.filter(a => atTime(a) >= now).sort((a, b) => atTime(a) - atTime(b));
    const passes = S.data.ateliers.filter(a => atTime(a) < now).sort((a, b) => atTime(b) - atTime(a));
    const right = atLeast('admin') ? createBtn('ateliers', 'Nouvel atelier') : '';
    const card = (a, past, i) => `<a class="card reveal" href="#/atelier/${a.id}" style="--d:${i % 6}">
        <div class="card-body">
          <div class="card-meta"><span class="badge ${past ? 'badge-member' : 'badge-gold'}">${past ? (a.lien ? 'Replay disponible' : 'Terminé') : 'À venir'}</span><span>${dateFr(a)}</span></div>
          <h3>${esc(a.titre)}</h3>
          ${a.description ? `<p class="small muted">${esc(a.description.slice(0, 120))}</p>` : ''}
          <div style="display:flex;gap:6px;flex-wrap:wrap">${!past && S.user && S.watch['at-' + a.id] ? `<span class="badge badge-success">${ic('check')}Inscrit</span>` : ''}${creditBadge('ateliers', a)}</div>
        </div></a>`;
    const body = !S.data.ateliers.length
      ? emptyState({ icon: 'presentation', title: 'Le premier atelier sera bientôt annoncé.', text: "Un atelier, c'est une à deux heures en direct : chacun construit son projet, on avance ensemble, et le replay reste disponible.", actions: atLeast('admin') ? createBtn('ateliers', 'Programmer le premier') : watchBtn('ateliers', 'Être prévenu') })
      : `${avenir.length ? `<h2 class="title-l" style="margin-bottom:20px">À venir</h2><div class="grid-3" style="margin-bottom:56px">${avenir.map((a, i) => card(a, false, i)).join('')}</div>` : ''}
         ${passes.length ? `<h2 class="title-l" style="margin-bottom:20px">Replays</h2><div class="grid-3">${passes.map((a, i) => card(a, true, i)).join('')}</div>` : ''}`;
    return `${learnNav('ateliers')}${pageHead('Ateliers', "Deux ateliers en direct chaque semaine. Chacun avance sur son propre projet, et le replay reste.", right)}
      <div class="container" style="padding-bottom:96px">${body}</div>`;
  }

  function viewAtelier(p) {
    const a = S.data.ateliers.find(x => x.id === p.a);
    if (!a) return viewNotFound();
    const past = atTime(a) < Date.now();
    const inscrit = !!S.watch['at-' + a.id];
    const acc = accessOf('ateliers', a);
    let side;
    if (!acc.ok && !acc.guest) side = lockPanel('ateliers', a, acc, past ? 'Débloque le replay' : 'Réserve ta place');
    else if (past) side = a.lien
      ? `<span class="badge badge-member">Terminé</span><p class="small muted" style="margin:12px 0 20px">Le replay est disponible.</p>${S.user ? `<a class="btn btn-primary btn-block" href="${esc(a.lien)}" target="_blank" rel="noopener">${ic('play')}Voir le replay</a>` : `<button type="button" class="btn btn-primary btn-block" data-action="signup">Voir le replay</button>`}`
      : `<span class="badge badge-member">Terminé</span><p class="small muted" style="margin-top:12px">Le replay sera ajouté ici.</p>`;
    else if (!S.user) side = `<span class="badge badge-gold">À venir</span><p class="small muted" style="margin:12px 0 20px">Crée ton compte pour t'inscrire et recevoir le lien.</p><button type="button" class="btn btn-primary btn-block" data-action="signup">Je m'inscris</button>`;
    else side = `<span class="badge ${inscrit ? 'badge-success' : 'badge-gold'}">${inscrit ? 'Inscrit' : 'À venir'}</span>
      <p class="small muted" style="margin:12px 0 20px">${inscrit ? (a.lien ? 'Le lien de connexion est juste en dessous.' : 'Le lien de connexion arrive avant le début.') : 'Inscris-toi : tu recevras un rappel la veille.'}</p>
      <button type="button" class="btn ${inscrit ? 'btn-quiet' : 'btn-primary'} btn-block" data-action="rsvp-at" data-id="${a.id}">${inscrit ? 'Me désinscrire' : "Je m'inscris"}</button>
      ${inscrit && a.lien ? `<a class="btn btn-secondary btn-block" style="margin-top:8px" href="${esc(a.lien)}" target="_blank" rel="noopener">${ic('external-link')}Rejoindre l'atelier</a>` : ''}`;
    return `${learnNav('ateliers')}<div class="container detail-grid">
      <div>
        <a class="link-arrow" href="#/ateliers">${ic('chevron-left')}Ateliers</a>
        <h1 class="display-m" style="margin-top:16px">${esc(a.titre)}</h1>
        <div class="card-meta" style="margin:12px 0 28px"><span class="badge badge-admin">${esc(a.format || 'En direct')}</span><span>${dateFr(a)}</span>${a.duree ? `<span>${esc(a.duree)}</span>` : ''}</div>
        ${a.description ? `<p class="lesson" style="font-size:17px">${esc(a.description)}</p>` : ''}
      </div>
      <aside class="panel" style="position:sticky;top:calc(var(--nav-h) + 72px)">${side}
        ${atLeast('admin') ? `<div class="menu-sep" style="margin:20px 0"></div><button type="button" class="btn btn-quiet btn-block" data-action="delete" data-type="ateliers" data-id="${a.id}">${ic('trash-2')}Supprimer</button>` : ''}
      </aside></div>`;
  }

  // ---------- Console : corrections ----------
  let corrFilter = 'a-corriger';
  function adminCorrections() {
    const rows = S.data.rendus.filter(r => corrFilter === 'tous' || r.statut === corrFilter);
    return `<div class="panel reveal"><div class="panel-head"><h2>Corrections</h2>
      <div class="seg" role="group" aria-label="Statut">${[['a-corriger', 'À corriger'], ['corrige', 'Corrigés'], ['tous', 'Tous']].map(([v, l]) => `<button type="button" data-action="corrfilter" data-v="${v}" aria-pressed="${corrFilter === v}">${l}</button>`).join('')}</div></div>
      <p class="small muted" style="margin:-8px 0 16px">${S.settings.delai ? `Délai promis aux élèves : ${esc(S.settings.delai)}.` : "Fixe le délai de correction dans Réglages : il s'affiche aux élèves."}</p>
      <div class="table-wrap"><table><thead><tr><th>Exercice</th><th>Élève</th><th>Rendu</th><th>Statut</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
      ${rows.length ? rows.map(r => `<tr><td><a href="#/exercice/${r.exId}"><strong>${esc(r.exTitre)}</strong></a></td><td>${esc(r.nom)}</td><td>${ago(r.date)}</td><td>${r.statut === 'corrige' ? '<span class="badge badge-success">Corrigé</span>' : '<span class="badge badge-gold">À corriger</span>'}</td><td style="text-align:right"><button type="button" class="btn btn-sm ${r.statut === 'corrige' ? 'btn-quiet' : 'btn-primary'}" data-action="corriger" data-id="${r.id}">${r.statut === 'corrige' ? 'Revoir' : 'Corriger'}</button></td></tr>`).join('')
        : `<tr class="table-empty"><td colspan="5">${corrFilter === 'a-corriger' ? 'Rien à corriger. Tous les élèves ont leur retour.' : "Aucun rendu pour l'instant."}</td></tr>`}
      </tbody></table></div></div>`;
  }

  // =========================================================
  // ARTICLES
  // =========================================================
  function viewArticles() {
    const all = S.data.articles;
    const list = all.filter(a => filters.articles === 'Tous' || a.theme === filters.articles);
    const right = atLeast('admin') ? createBtn('articles', 'Nouvel article') : '';
    let body;
    if (!all.length) body = emptyState({ icon: 'newspaper', title: 'Le premier article se prépare.', text: atLeast('admin') ? 'Publie le premier. Il sera lisible par tout le monde, même sans compte.' : 'Un article par semaine, sur les questions que tu te poses vraiment.', actions: atLeast('admin') ? createBtn('articles', 'Écrire le premier article') : watchBtn('articles') });
    else if (!list.length) body = emptyState({ icon: 'search', title: 'Rien dans ce thème pour l\'instant.', text: 'Les autres thèmes ont peut-être ce que tu cherches.', actions: `<button type="button" class="btn btn-quiet" data-action="reset-filters">Tous les thèmes</button>` });
    else body = `<div class="article-list">${list.map(a => `
        <a class="article-row reveal" href="#/article/${a.id}">
          <div><div class="card-meta" style="margin-bottom:8px"><span class="eyebrow">${esc(a.theme)}</span><span>${dateLong(a.date)}</span></div>
          <h3>${esc(a.titre)}</h3><p class="muted" style="margin-top:8px;max-width:64ch">${esc(a.resume)}</p></div>
          <span class="icon-btn" aria-hidden="true">${ic('arrow-right')}</span></a>`).join('')}</div>`;
    return `${learnNav('articles')}${pageHead('Articles', 'Un nouvel article chaque semaine, sur les questions que tu te poses vraiment.', right)}
      <div class="container" style="padding-bottom:96px">
        ${all.length ? `<div class="toolbar"><div class="chips" role="group" aria-label="Filtrer par thème">${['Tous', 'Méthode', 'Outils', "Retours d'expérience"].map(n => `<button type="button" class="chip" data-action="filter" data-f="articles" data-v="${esc(n)}" aria-pressed="${filters.articles === n}">${n === 'Tous' ? 'Tous les thèmes' : n}</button>`).join('')}</div></div>` : ''}
        ${body}
      </div>`;
  }

  function viewArticle(p) {
    const a = S.data.articles.find(x => x.id === p.a);
    if (!a) return viewNotFound();
    const words = ((a.contenu || '') + ' ' + a.resume).split(/\s+/).length;
    return `<article class="container" style="max-width:760px;padding:48px var(--gutter) 96px">
      <a class="link-arrow" href="#/articles">${ic('chevron-left')}Articles</a>
      <div class="card-meta" style="margin:24px 0 12px"><span class="eyebrow">${esc(a.theme)}</span><span>${dateLong(a.date)}</span><span>${Math.max(1, Math.round(words / 220))} min de lecture</span></div>
      <h1 class="serif" style="font-size:clamp(36px,5vw,52px);line-height:1.12;font-weight:500">${esc(a.titre)}</h1>
      <p class="lead" style="margin:24px 0 40px">${esc(a.resume)}</p>
      ${accessOf('articles', a).ok ? `<div style="white-space:pre-line;font-size:19px;line-height:1.65">${esc(a.contenu || '')}</div>` : lockPanel('articles', a, accessOf('articles', a))}
      <aside class="panel" style="margin-top:64px;display:flex;gap:20px;align-items:center;flex-wrap:wrap">
        <div style="flex:1;min-width:220px"><strong>Tu veux le mettre en pratique ?</strong><p class="small muted">Les cours, les vidéos et les exercices reprennent ces sujets pas à pas.</p></div>
        <a class="btn btn-secondary" href="#/apprendre">Voir comment on apprend</a>
      </aside>
      ${atLeast('admin') ? `<button type="button" class="btn btn-quiet" style="margin-top:24px" data-action="delete" data-type="articles" data-id="${a.id}">${ic('trash-2')}Supprimer l'article</button>` : ''}
    </article>`;
  }

  // =========================================================
  // NOUVEAUTES
  // =========================================================
  function viewNouveautes() {
    const all = S.data.nouveautes;
    const right = atLeast('admin') ? createBtn('nouveautes', 'Publier une nouveauté') : '';
    const body = !all.length
      ? emptyState({ icon: 'sparkles', title: 'Rien de neuf pour le moment.', text: 'Chaque nouvelle formation, chaque amélioration du site sera annoncée ici.', actions: atLeast('admin') ? createBtn('nouveautes', 'Publier la première') : watchBtn('nouveautes', 'Suivre les nouveautés') })
      : `<div class="timeline">${all.map(n => `<div class="tl-item reveal"><div class="card-meta"><span class="badge badge-gold">${esc(n.type)}</span><span>${dateLong(n.date)}</span></div><h3>${esc(n.titre)}</h3><p class="muted measure" style="white-space:pre-line">${esc(n.texte)}</p>${atLeast('admin') ? `<button type="button" class="btn btn-sm btn-quiet" style="margin-top:10px" data-action="delete" data-type="nouveautes" data-id="${n.id}">${ic('trash-2')}Supprimer</button>` : ''}</div>`).join('')}</div>`;
    return `${pageHead('Nouveautés', 'Tout ce qui arrive sur FVIA, dans l\'ordre.', right)}<div class="container" style="padding-bottom:96px"><div style="max-width:760px">${body}</div></div>`;
  }

  // =========================================================
  // FORUM (facon Reddit)
  // =========================================================
  function viewForum(p) {
    const cur = p.a || 'tous';
    let posts = S.data.posts.filter(x => cur === 'tous' || x.salon === cur);
    if (forumSort === 'recents') posts = posts.slice().sort((a, b) => b.date - a.date);
    else if (forumSort === 'sans-reponse') posts = posts.filter(x => !(x.replies || []).length);
    else posts = posts.slice().sort((a, b) => (b.score || 0) - (a.score || 0) || b.date - a.date);
    posts.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    const count = id => S.data.posts.filter(x => id === 'tous' || x.salon === id).length;
    const s = SALONS.find(x => x.id === cur);
    const canPostHere = !(s && s.staff) || atLeast('admin');
    return `${communityNav('communaute')}
      <div class="container forum">
        <nav class="side-nav" aria-label="Salons">
          <h4>Salons</h4>
          <a class="side-link" href="#/communaute" ${cur === 'tous' ? 'aria-current="true"' : ''}>${ic('layers')}Tous les salons<span class="count">${count('tous') || ''}</span></a>
          ${SALONS.map(x => `<a class="side-link" href="#/communaute/${x.id}" ${cur === x.id ? 'aria-current="true"' : ''}>${ic(x.icon)}${x.t}<span class="count">${count(x.id) || ''}</span></a>`).join('')}
        </nav>
        <div>
          ${canPostHere ? `<button type="button" class="composer" data-action="create" data-type="posts" data-salon="${s ? s.id : ''}">
            <span class="avatar ${realRole() === 'god' ? 'gold' : ''}">${S.user ? esc(initials(S.user.name)) : ic('user-round')}</span>
            <span class="fake-input">${s ? `Écrire dans ${s.t}` : 'Pose ta question ou partage une avancée'}</span>
            <span class="icon-btn" aria-hidden="true">${ic('square-pen')}</span></button>` : ''}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:12px;flex-wrap:wrap">
            <h1 class="title-l">${s ? s.t : 'Tous les salons'}</h1>
            <div class="seg" role="group" aria-label="Trier">${[['populaires', 'Populaires'], ['recents', 'Récents'], ['sans-reponse', 'Sans réponse']].map(([v, l]) => `<button type="button" data-action="sort" data-v="${v}" aria-pressed="${forumSort === v}">${l}</button>`).join('')}</div>
          </div>
          ${posts.length ? posts.map(postCard).join('') : emptyState({
            icon: forumSort === 'sans-reponse' && S.data.posts.length ? 'circle-check' : 'messages-square',
            title: forumSort === 'sans-reponse' && S.data.posts.length ? 'Toutes les questions ont une réponse.' : 'Personne n\'a encore écrit ici.',
            text: forumSort === 'sans-reponse' && S.data.posts.length ? 'Belle communauté.' : 'Le premier message donne le ton. Présente-toi, ou pose la question qui te bloque.',
            actions: canPostHere ? `<button type="button" class="btn btn-primary" data-action="create" data-type="posts" data-salon="${s ? s.id : 'presentations'}">${ic('square-pen')}Écrire le premier message</button>` : ''
          })}
        </div>
        <aside class="aside-stack">
          <div class="aside-card"><h4>À propos</h4><p class="small muted">Un espace pour avancer ensemble. Pose tes questions, montre ce que tu construis, aide ceux qui débutent.</p>
            ${S.data.posts.length || S.members.length ? `<div style="display:flex;gap:24px;margin-top:6px"><div><strong>${S.data.posts.length}</strong><p class="tiny muted">${S.data.posts.length > 1 ? 'messages' : 'message'}</p></div><div><strong>${S.members.length}</strong><p class="tiny muted">${S.members.length > 1 ? 'membres' : 'membre'}</p></div></div>` : ''}
          </div>
          <div class="aside-card"><h4>Les règles</h4><ol><li>La bienveillance d'abord.</li><li>Dis ce que tu as déjà essayé avant de demander.</li><li>Pas de promotion non sollicitée.</li><li>Partage tes réussites et tes échecs.</li></ol></div>
          ${!S.user ? `<div class="aside-card" style="background:var(--primary);color:var(--on-primary)"><h4>Rejoins la discussion</h4><p class="small" style="opacity:.82">Un compte suffit pour publier, voter et gagner des points.</p><button type="button" class="btn btn-light btn-sm" data-action="signup">Créer un compte</button></div>` : ''}
        </aside>
      </div>`;
  }

  function postCard(x, full) {
    const v = S.votes[x.id] || 0;
    const mine = S.user && x.authorEmail === S.user.email;
    return `<article class="post ${x.pinned ? 'pinned' : ''} reveal">
      <div class="votes" aria-label="Votes">
        <button type="button" class="up" data-action="vote" data-id="${x.id}" data-v="1" aria-pressed="${v === 1}" aria-label="Voter pour">${ic('arrow-big-up')}</button>
        <output aria-live="polite">${x.score || 0}</output>
        <button type="button" class="down" data-action="vote" data-id="${x.id}" data-v="-1" aria-pressed="${v === -1}" aria-label="Voter contre">${ic('arrow-big-down')}</button>
      </div>
      <div class="post-main">
        <div class="card-meta"><span class="avatar" style="width:22px;height:22px;font-size:10px">${esc(initials(x.auteur))}</span><strong style="color:var(--fg);font-weight:600">${esc(x.auteur)}</strong><span>dans ${salon(x.salon).t}</span><span>${ago(x.date)}</span>${x.pinned ? `<span class="badge badge-gold">${ic('pin')}Épinglé</span>` : ''}</div>
        <h3><a href="#/post/${x.id}">${esc(x.titre)}</a></h3>
        ${full ? `<div style="white-space:pre-line;margin-top:4px">${esc(x.texte)}</div>` : `<p>${esc(x.texte)}</p>`}
        <div class="post-actions">
          <a href="#/post/${x.id}">${ic('message-circle')}${plural((x.replies || []).length, 'réponse', 'réponses')}</a>
          <button type="button" data-action="share" data-id="${x.id}">${ic('link-2')}Copier le lien</button>
          ${atLeast('admin') ? `<button type="button" data-action="pin" data-id="${x.id}">${ic('pin')}${x.pinned ? 'Désépingler' : 'Épingler'}</button>` : ''}
          ${atLeast('admin') || mine ? `<button type="button" data-action="delete" data-type="posts" data-id="${x.id}">${ic('trash-2')}Supprimer</button>` : ''}
        </div>
      </div></article>`;
  }

  function viewPost(p) {
    const x = S.data.posts.find(y => y.id === p.a);
    if (!x) return viewNotFound();
    return `${communityNav('communaute')}
      <div class="container" style="max-width:820px;padding-top:32px;padding-bottom:96px">
        <a class="link-arrow" href="#/communaute/${x.salon}">${ic('chevron-left')}${salon(x.salon).t}</a>
        <div style="margin-top:16px">${postCard(x, true)}</div>
        <h2 class="title-m" style="margin-top:40px">${plural((x.replies || []).length, 'réponse', 'réponses')}</h2>
        <div class="replies">${(x.replies || []).map(r => `<div class="reply"><div class="card-meta" style="margin-bottom:6px"><strong style="color:var(--fg)">${esc(r.auteur)}</strong><span>${ago(r.date)}</span></div><p style="white-space:pre-line">${esc(r.texte)}</p></div>`).join('') || '<p class="muted">Pas encore de réponse. La tienne sera la première.</p>'}</div>
        ${S.user ? `<form class="panel" style="margin-top:24px" data-form="reply" data-id="${x.id}" novalidate>
            <div class="field"><label for="reply-t">Ta réponse</label><textarea id="reply-t" class="textarea" name="texte" required placeholder="Partage ce qui a marché pour toi"></textarea><span class="err">${ic('triangle-alert')}Écris quelques mots avant d'envoyer.</span></div>
            <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" type="submit">${ic('reply')}Répondre</button></div>
          </form>` : `<div class="panel" style="margin-top:24px;display:flex;gap:16px;align-items:center;flex-wrap:wrap"><p style="flex:1">Connecte-toi pour répondre.</p><button type="button" class="btn btn-primary" data-action="login">Se connecter</button></div>`}
      </div>`;
  }

  // =========================================================
  // PROJETS
  // =========================================================
  function viewProjets() {
    const all = S.data.projets;
    return `${communityNav('projets')}
      ${pageHead('Projets', 'Ce que les membres construisent. Chaque projet est une preuve que c\'est possible.', createBtn('projets', 'Partager un projet'))}
      <div class="container" style="padding-bottom:96px">
        ${all.length ? `<div class="grid-3">${all.map((x, i) => `<article class="card reveal" style="--d:${i % 6}">
          <div class="card-body">
            <div class="card-meta"><span class="avatar" style="width:24px;height:24px;font-size:10px">${esc(initials(x.auteur))}</span>${esc(x.auteur)}<span>${ago(x.date)}</span></div>
            <h3>${esc(x.titre)}</h3><p class="small muted" style="white-space:pre-line">${esc(x.description)}</p>
            <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">${x.lien ? `<a class="btn btn-sm btn-secondary" href="${esc(x.lien)}" target="_blank" rel="noopener">${ic('external-link')}Voir</a>` : ''}
            ${atLeast('admin') || (S.user && S.user.email === x.authorEmail) ? `<button type="button" class="btn btn-sm btn-quiet" data-action="delete" data-type="projets" data-id="${x.id}">${ic('trash-2')}Supprimer</button>` : ''}</div>
          </div></article>`).join('')}</div>`
        : emptyState({ icon: 'folder-kanban', title: 'Le premier projet sera peut-être le tien.', text: 'Une automatisation, une app, un outil pour ton activité. Même petit, même pas fini.', actions: createBtn('projets', 'Partager un projet') })}
      </div>`;
  }

  // =========================================================
  // EVENEMENTS (calendrier)
  // =========================================================
  function viewEvenements() {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth() + calOffset, 1);
    const month = base.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const startDow = (base.getDay() + 6) % 7;
    const days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push('<div class="cal-day out"></div>');
    for (let d = 1; d <= days; d++) {
      const iso = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const evs = [...S.data.evenements, ...S.data.ateliers.map(a => ({ ...a, titre: 'Atelier : ' + a.titre }))].filter(e => e.date === iso);
      const today = d === now.getDate() && calOffset === 0;
      cells.push(`<div class="cal-day ${today ? 'today' : ''} ${evs.length ? 'has-ev' : ''}"><span class="num">${d}</span>${evs.map(e => `<span class="cal-ev" title="${esc(e.titre)}">${e.heure ? esc(e.heure) + ' ' : ''}${esc(e.titre)}</span>`).join('')}</div>`);
    }
    while (cells.length % 7) cells.push('<div class="cal-day out"></div>');
    const upcoming = S.data.evenements.filter(e => new Date(e.date + 'T23:59') >= now).sort((a, b) => a.date.localeCompare(b.date));
    return `${communityNav('evenements')}
      ${pageHead('Événements', 'Des lives et des ateliers pour avancer ensemble. Les replays restent disponibles.', atLeast('admin') ? createBtn('evenements', 'Nouvel événement') : '')}
      <div class="container lb-grid" style="grid-template-columns:minmax(0,1fr) 340px;padding-bottom:96px">
        <div class="cal reveal">
          <div class="cal-head">
            <button type="button" class="icon-btn" data-action="cal" data-v="-1" aria-label="Mois précédent">${ic('chevron-left')}</button>
            <strong aria-live="polite">${month}</strong>
            <button type="button" class="icon-btn" data-action="cal" data-v="1" aria-label="Mois suivant">${ic('chevron-right')}</button>
          </div>
          <div class="cal-grid">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => `<div class="cal-dow">${d}</div>`).join('')}${cells.join('')}</div>
        </div>
        <aside>
          <h2 class="title-m" style="margin-bottom:16px">À venir</h2>
          ${upcoming.length ? upcoming.map(e => `<div class="panel reveal" style="padding:18px 20px;margin-bottom:12px">
              <div class="card-meta"><span class="badge badge-admin">${esc(e.format)}</span><span>${new Date(e.date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}${e.heure ? ' à ' + esc(e.heure) : ''}</span></div>
              <h3 class="title-m" style="font-size:18px;margin-top:8px">${esc(e.titre)}</h3>
              ${e.description ? `<p class="small muted" style="margin-top:6px">${esc(e.description)}</p>` : ''}
              <div style="display:flex;gap:8px;margin-top:12px">${S.user ? `<button type="button" class="btn btn-sm btn-primary" data-action="rsvp" data-id="${e.id}">${S.watch['ev-' + e.id] ? `${ic('check')}Inscrit` : 'Je participe'}</button>` : `<button type="button" class="btn btn-sm btn-primary" data-action="login">Je participe</button>`}
              ${atLeast('admin') ? `<button type="button" class="btn btn-sm btn-quiet" data-action="delete" data-type="evenements" data-id="${e.id}" aria-label="Supprimer">${ic('trash-2')}</button>` : ''}</div>
            </div>`).join('')
          : `<div class="empty" style="padding:40px 20px"><div class="empty-art">${ic('calendar-days')}</div><h3 style="font-size:19px">Aucun événement prévu.</h3><p class="small">Le premier live sera annoncé ici et dans les nouveautés.</p>${atLeast('admin') ? createBtn('evenements', 'Planifier', 'btn-sm btn-primary') : watchBtn('evenements')}</div>`}
        </aside>
      </div>`;
  }

  // =========================================================
  // CLASSEMENT (niveaux facon Skool)
  // =========================================================
  function viewClassement() {
    const since = lbRange === '7j' ? Date.now() - 7 * 864e5 : lbRange === '30j' ? Date.now() - 30 * 864e5 : 0;
    const board = S.members.map(m => ({ ...m, pts: pointsOf(m.email, since) })).filter(m => m.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 10);
    const me = S.user ? pointsOf(S.user.email) : 0;
    const L = levelOf(me);
    return `${communityNav('classement')}
      ${pageHead('Classement', 'Chaque message, chaque réponse utile, chaque projet partagé te fait avancer.')}
      <div class="container lb-grid" style="padding-bottom:96px">
        <div style="display:grid;gap:16px">
          <div class="level-card reveal">
            ${S.user ? `
              <div style="display:flex;align-items:center;gap:16px"><span class="avatar lg gold">${esc(initials(S.user.name))}</span><div><strong style="font-size:19px">${esc(S.user.name)}</strong><p class="small muted">Niveau ${L.lv} sur 9</p></div></div>
              <div><div style="display:flex;justify-content:space-between" class="small"><span>${plural(me, 'point', 'points')}</span><span class="muted">${L.next === null ? 'Niveau maximum' : `${L.next - me} avant le niveau ${L.lv + 1}`}</span></div>
              <div class="progress gold" style="margin-top:8px;background:rgba(255,255,255,.12)"><i style="width:${L.pct}%;background:var(--gold-light)"></i></div></div>`
            : `<strong style="font-size:21px">Ton niveau t'attend.</strong><p class="small muted">Crée ton compte : tu démarres au niveau 1, et chaque contribution compte.</p><button type="button" class="btn btn-light" data-action="signup">Créer mon compte</button>`}
          </div>
          <div class="panel reveal" style="padding:12px">
            <div class="level-scale">${LEVELS.map((min, i) => `<div class="level-row ${S.user && L.lv === i + 1 ? 'current' : ''}"><span class="lv">${i + 1}</span><span>Niveau ${i + 1}</span><span class="tiny muted">${min} pts</span></div>`).join('')}</div>
          </div>
          <div class="aside-card"><h4>Comment gagner des points</h4><ol><li>Publier un message : 1 point</li><li>Chaque vote reçu : 1 point</li><li>Répondre à quelqu'un : 1 point</li><li>Partager un projet : 3 points</li><li>Rendre un exercice : 5 points</li><li>Terminer un cours ou une vidéo : 10 points</li></ol></div>
        </div>
        <div class="panel reveal">
          <div class="panel-head"><h2>Les plus actifs</h2><div class="seg" role="group" aria-label="Période">${[['7j', '7 jours'], ['30j', '30 jours'], ['toujours', 'Toujours']].map(([v, l]) => `<button type="button" data-action="lb" data-v="${v}" aria-pressed="${lbRange === v}">${l}</button>`).join('')}</div></div>
          ${board.length ? `<div class="level-scale">${board.map((m, i) => `<div class="level-row" style="grid-template-columns:34px 34px 1fr auto"><span class="small muted" style="text-align:center;font-weight:600">${i + 1}</span><span class="avatar">${esc(initials(m.name))}</span><span><strong>${esc(m.name)}</strong> <span class="tiny muted">niveau ${levelOf(m.pts).lv}</span></span><span class="small" style="font-weight:600">+${m.pts}</span></div>`).join('')}</div>`
          : emptyState({ icon: 'trophy', title: 'Le classement démarre avec le premier message.', text: 'Personne n\'a encore de points. La première place est libre.', actions: `<a class="btn btn-primary" href="#/communaute">Aller au forum</a>` })}
        </div>
      </div>`;
  }

  // =========================================================
  // MEMBRES
  // =========================================================
  function viewMembres() {
    const q = filters.q.toLowerCase();
    const list = S.members.filter(m => !q || m.name.toLowerCase().includes(q));
    return `${communityNav('membres')}
      ${pageHead('Membres', 'Les personnes qui avancent avec toi.')}
      <div class="container" style="padding-bottom:96px">
        ${S.members.length ? `<div class="toolbar"><label class="search-field"><span class="sr-only">Rechercher un membre</span>${ic('search')}<input type="search" data-bind="q" value="${esc(filters.q)}" placeholder="Rechercher un membre"></label></div>
          <div class="grid-3">${list.map((m, i) => `<div class="card reveal" style="--d:${i % 6}"><div class="card-body" style="grid-template-columns:auto 1fr;align-items:center;gap:14px">
            <span class="avatar lg ${m.role === 'god' ? 'gold' : ''}">${esc(initials(m.name))}</span>
            <div><strong>${esc(m.name)}</strong>${S.user && m.email === S.user.email ? ' <span class="tiny muted">(toi)</span>' : ''}<p class="tiny muted">Membre depuis ${dateLong(m.joined)}</p><p class="tiny muted">Niveau ${levelOf(pointsOf(m.email)).lv}</p></div>
          </div></div>`).join('') || '<p class="muted">Aucun membre ne correspond.</p>'}</div>`
        : emptyState({ icon: 'users', title: 'Les premiers membres arrivent.', text: 'Les premiers inscrits auront le badge de membre fondateur.', actions: S.user ? '' : `<button type="button" class="btn btn-primary" data-action="signup">Devenir membre fondateur</button>` })}
      </div>`;
  }

  // =========================================================
  // ACCOMPAGNEMENT
  // =========================================================
  function viewAccompagnement() {
    const joined = S.user ? S.waitlist.includes(S.user.email) : false;
    const cta = joined ? `<button type="button" class="btn btn-quiet btn-block" disabled>${ic('check')}Tu es sur la liste</button>` : `<button type="button" class="btn btn-block BTNCLS" data-action="waitlist">Être prévenu</button>`;
    const offer = (t, d, items, featured) => `
      <div class="offer ${featured ? 'featured' : ''} reveal">
        ${featured ? `<span class="badge badge-god flag">${ic('star')}Recommandé</span>` : ''}
        <h3>${t}</h3><p class="muted small">${d}</p>
        <p class="price">Tarif annoncé à l'ouverture</p>
        <ul>${items.map(x => `<li>${ic('check')}<span>${x}</span></li>`).join('')}</ul>
        ${cta.replace('BTNCLS', featured ? 'btn-primary' : 'btn-secondary')}
      </div>`;
    return `
      <section class="container" style="padding:80px var(--gutter) 64px">
        <div style="max-width:760px">
          <h1 class="display-xl">Tu avances.<br><span style="color:var(--muted)">Quelqu'un suit.</span></h1>
          <p class="lead" style="margin-top:24px;max-width:44ch">Des formations gratuites, il en existe. Ce qui manque, c'est quelqu'un qui regarde ton travail et te répond.</p>
        </div>
      </section>
      <section class="container" style="padding-bottom:96px">
        <div class="offers">
          ${offer('Communauté', 'Pour apprendre à ton rythme, entouré.', ['Les cours, les vidéos et les exercices', 'Le forum et l\'entraide', 'Les ateliers en direct et leurs replays'])}
          ${offer('Accompagnement', 'Pour avancer vite, sans rester bloqué.', ['Tout ce que contient Communauté', 'Un retour sur chacun de tes livrables', S.settings.delai ? `Une réponse sous ${esc(S.settings.delai)}` : 'Un délai de réponse garanti', 'Un nombre de places limité pour tenir ce délai'], true)}
          ${offer('Fait avec toi', 'Pour construire ton projet ensemble.', ['Des séances individuelles', 'On construit ton outil côte à côte', 'Si tu préfères déléguer, l\'agence prend le relais'])}
        </div>
        <p class="small muted" style="margin-top:20px;text-align:center">Sur ce site, le contenu se débloque avec des tokens. <a class="link-arrow" style="min-height:0;display:inline-flex" href="#/tarifs">Voir les packs ${ic('chevron-right')}</a></p>
        <div class="bridge" style="background:var(--deep);color:var(--on-deep);margin-top:80px">
          <p style="color:var(--on-deep-muted)"><strong style="color:var(--on-deep)">Pas le temps de le faire toi-même ?</strong> L'agence OTTOM4T3 construit pour toi ce que la formation t'apprend à faire.</p>
          <a class="btn btn-light" href="https://www.ottom4t3.com" target="_blank" rel="noopener">Voir OTTOM4T3 ${ic('external-link')}</a>
        </div>
      </section>`;
  }

  // =========================================================
  // MON ESPACE (membre)
  // =========================================================
  function viewEspace() {
    const u = S.user;
    const email = u.email;
    const steps = [
      { t: 'Créer ton compte', done: true, href: '#/espace' },
      { t: 'Choisir ton parcours', done: !!S.quiz, href: '#/', action: 'start' },
      { t: 'Te présenter à la communauté', done: S.data.posts.some(p => p.authorEmail === email && p.salon === 'presentations'), action: 'create', type: 'posts', salon: 'presentations' },
      { t: 'Suivre ta première leçon', done: Object.values(S.progress).some(v => v > 0), href: '#/apprendre' },
      { t: 'Rendre ton premier exercice', done: S.data.rendus.some(r => r.email === email), href: '#/exercices' }
    ];
    const doneCount = steps.filter(s => s.done).length;
    const pct = Math.round((doneCount / steps.length) * 100);
    const inProgress = ['cours', 'videos'].flatMap(k => S.data[k].filter(f => (S.progress[f.id] || 0) > 0 && S.progress[f.id] < 100).map(f => [k, f]));
    const mesRendus = S.data.rendus.filter(r => r.email === email);
    const pts = pointsOf(email);
    const L = levelOf(pts);
    return `<div class="container dash">
      ${dashSide('espace', [['espace', 'house', 'Vue d\'ensemble']])}
      <div class="dash-main">
        <div class="reveal"><h1 class="display-m">Bonjour, ${esc(firstName(u.name))}.</h1><p class="lead" style="margin-top:8px">${doneCount < steps.length ? `Encore ${steps.length - doneCount} ${steps.length - doneCount > 1 ? 'étapes' : 'étape'} et ton démarrage est complet.` : 'Ton démarrage est complet. Place au concret.'}</p></div>

        <section class="panel reveal" aria-labelledby="h-start">
          <div class="panel-head"><div style="display:flex;align-items:center;gap:16px"><div class="ring" style="--p:${pct}"><span>${doneCount}/${steps.length}</span></div><div><h2 id="h-start">Bien démarrer</h2><p class="small muted">${pct === 100 ? 'Terminé' : 'Chaque étape te rapproche de ton premier projet.'}</p></div></div></div>
          <div class="checklist">${steps.map(s => {
            const attrs = s.action ? `data-action="${s.action}" ${s.type ? `data-type="${s.type}"` : ''} ${s.salon ? `data-salon="${s.salon}"` : ''}` : '';
            const tag = s.done ? 'div' : s.action ? 'button type="button"' : `a href="${s.href}"`;
            const close = s.done ? 'div' : s.action ? 'button' : 'a';
            return `<${tag} class="check-row ${s.done ? 'done' : ''}" ${s.done ? '' : attrs}><span class="tick">${ic('check')}</span><span class="label">${s.t}</span>${s.done ? '' : `<span class="go">${ic('chevron-right')}</span>`}</${close}>`;
          }).join('')}</div>
        </section>

        <div class="grid-2">
          <section class="panel reveal">
            <div class="panel-head"><h2>Ton parcours</h2></div>
            ${S.quiz ? `<p class="result-title" style="font-size:24px">${PARCOURS[S.quiz.but]}</p><div class="result-tags"><span class="badge badge-admin">${DEPART[S.quiz.niveau]}</span><span class="badge badge-member">${RYTHME[S.quiz.temps]}</span></div><button type="button" class="btn btn-sm btn-quiet" data-action="quiz-restart">${ic('rotate-ccw')}Refaire le test</button>`
              : `<p class="muted small" style="margin-bottom:16px">Trois questions pour savoir par où commencer.</p><button type="button" class="btn btn-primary" data-action="start">Choisir mon parcours</button>`}
          </section>
          <section class="panel reveal">
            <div class="panel-head"><h2>Ton niveau</h2><span class="badge badge-gold">${ic('trophy')}Niveau ${L.lv}</span></div>
            <p class="small"><strong>${plural(pts, 'point', 'points')}</strong> <span class="muted">${L.next === null ? '' : `, encore ${L.next - pts} pour le niveau ${L.lv + 1}`}</span></p>
            <div class="progress gold" style="margin:12px 0 16px"><i style="width:${L.pct}%"></i></div>
            <a class="link-arrow" href="#/classement">Voir le classement ${ic('chevron-right')}</a>
          </section>
        </div>

        ${role() === 'member' ? (() => { const w = wallet(); return `<section class="panel reveal">
          <div class="panel-head"><h2>Mes tokens</h2><div style="display:flex;gap:8px;flex-wrap:wrap">${w.journal.some(j => j.d > 0 && Date.now() - j.t < 14 * 864e5) ? `<a class="btn btn-sm btn-quiet" href="#/retractation">Se rétracter du contrat ici</a>` : ''}<a class="btn btn-sm btn-primary" href="#/tarifs">${ic('coins')}Recharger</a></div></div>
          <p><strong style="font-size:34px;letter-spacing:-0.03em">${w.solde}</strong> <span class="muted">${w.solde > 1 ? 'tokens disponibles' : 'token disponible'}, ${plural(w.debloques.length, 'contenu débloqué', 'contenus débloqués')}</span></p>
          ${w.journal.length ? `<ul class="log" style="margin-top:16px">${w.journal.slice(0, 6).map(j => `<li><time>${new Date(j.t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</time><span><strong style="color:${j.d > 0 ? 'var(--success)' : 'var(--fg)'}">${j.d > 0 ? '+' : ''}${j.d}</strong> ${esc(j.l)}</span></li>`).join('')}</ul>` : '<p class="small muted" style="margin-top:8px">Choisis un pack, puis débloque les contenus qui t\'intéressent.</p>'}
        </section>`; })() : ''}

        <section class="panel reveal">
          <div class="panel-head"><h2>Reprendre là où tu t'es arrêté</h2></div>
          ${inProgress.length ? `<div class="grid-3">${inProgress.map(([k, f], i) => learnCard(k, f, i)).join('')}</div>` : `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><p class="muted" style="flex:1">Tu n'as rien en cours pour l'instant.</p><a class="btn btn-secondary" href="#/apprendre">Choisir un format</a></div>`}
        </section>

        <section class="panel reveal">
          <div class="panel-head"><h2>Mes exercices</h2>${mesRendus.length ? `<span class="small muted">${plural(mesRendus.length, 'rendu', 'rendus')}</span>` : ''}</div>
          ${mesRendus.length ? `<div class="checklist">${mesRendus.map(r => `<a class="check-row ${r.statut === 'corrige' ? 'done' : ''}" href="#/exercice/${r.exId}"><span class="tick">${ic('check')}</span><span class="label" style="text-decoration:none">${esc(r.exTitre)}</span><span class="badge ${r.statut === 'corrige' ? 'badge-success' : 'badge-gold'}" style="margin-left:auto">${r.statut === 'corrige' ? 'Corrigé' : 'En attente de correction'}</span></a>`).join('')}</div>`
            : `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><p class="muted" style="flex:1">Tu n'as encore rendu aucun exercice. C'est là que tu progresses le plus vite.</p><a class="btn btn-secondary" href="#/exercices">Voir les exercices</a></div>`}
        </section>

        <section class="panel reveal">
          <div class="panel-head"><h2>Notifications</h2></div>
          ${[['contenus', 'Nouveaux contenus', 'Dès qu\'un cours, une vidéo ou un exercice est en ligne'], ['ateliers', 'Ateliers', 'Quand un nouvel atelier est programmé'], ['replies', 'Réponses à mes messages', 'Quand quelqu\'un te répond dans la communauté'], ['nouveautes', 'Nouveautés', 'Le résumé des nouveautés du site']].map(([k, t, d]) => `
            <div class="setting"><div><strong>${t}</strong><span>${d}</span></div><label class="switch"><input type="checkbox" data-action="watch-toggle" data-k="${k}" ${S.watch[k] ? 'checked' : ''} aria-label="${t}"><span></span></label></div>`).join('')}
        </section>
      </div></div>`;
  }

  function dashSide(cur, items, extra = '') {
    const r = realRole();
    return `<nav class="dash-side" aria-label="Sections">
      <div class="who"><span class="avatar lg ${r === 'god' ? 'gold' : ''}">${esc(initials(S.user.name))}</span><div><strong>${esc(S.user.name)}</strong><div>${roleBadge(r)}</div></div></div>
      ${items.map(([h, i, t]) => `<a class="side-link" href="#/${h}" ${cur === h ? 'aria-current="true"' : ''}>${ic(i)}${t}</a>`).join('')}
      ${extra}
    </nav>`;
  }

  // =========================================================
  // CONSOLE ADMIN
  // =========================================================
  const ADMIN_TABS = [['admin', 'layout-dashboard', 'Vue d\'ensemble'], ['admin/corrections', 'list-checks', 'Corrections'], ['admin/contenus', 'layers', 'Contenus'], ['admin/moderation', 'shield-alert', 'Modération'], ['admin/membres', 'users', 'Membres'], ['admin/reglages', 'settings', 'Réglages']];
  const TYPE_LABEL = { cours: 'Cours', videos: 'Vidéo', ateliers: 'Atelier', exercices: 'Exercice', articles: 'Article', nouveautes: 'Nouveauté', evenements: 'Événement', projets: 'Projet', posts: 'Message' };

  function viewAdmin(p) {
    const tab = p.a || '';
    const cur = tab ? 'admin/' + tab : 'admin';
    let content;
    if (tab === 'corrections') content = adminCorrections();
    else if (tab === 'contenus') content = adminContenus();
    else if (tab === 'moderation') content = adminModeration();
    else if (tab === 'membres') content = adminMembres();
    else if (tab === 'reglages') content = adminReglages();
    else content = adminOverview();
    return `<div class="container dash">${dashSide(cur, ADMIN_TABS, realRole() === 'god' ? `<a class="side-link" href="#/godmode" style="margin-top:12px">${ic('crown')}God mode</a>` : '')}<div class="dash-main">${content}</div></div>`;
  }

  function adminOverview() {
    const d = S.data;
    const unanswered = d.posts.filter(p => !(p.replies || []).length).length;
    const total = d.cours.length + d.videos.length + d.ateliers.length + d.exercices.length + d.articles.length;
    const aCorriger = d.rendus.filter(r => r.statut !== 'corrige').length;
    return `
      <div class="reveal"><h1 class="display-m">Console admin</h1><p class="lead" style="margin-top:8px">${total ? 'Voici où en est le site.' : 'Le site est prêt. Il ne manque que le contenu.'}</p></div>
      <div class="kpis reveal">${[[S.members.length, 'Membres'], [total, 'Contenus publiés'], [aCorriger, 'Exercices à corriger'], [d.posts.length, 'Messages']].map(([v, l]) => `<div class="kpi"><span class="v">${v}</span><span class="l">${l}</span></div>`).join('')}</div>
      <section class="panel reveal"><div class="panel-head"><h2>Publier</h2></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">${createBtn('cours', 'Cours')}${createBtn('videos', 'Vidéo')}${createBtn('ateliers', 'Atelier', 'btn-secondary')}${createBtn('exercices', 'Exercice', 'btn-secondary')}${createBtn('articles', 'Article', 'btn-secondary')}${createBtn('nouveautes', 'Nouveauté', 'btn-secondary')}</div>
      </section>
      ${S.retractations.length ? `<section class="panel reveal" style="border-color:var(--danger)"><div class="panel-head"><h2>Rétractations reçues</h2><span class="small muted">${plural(S.retractations.length, 'demande', 'demandes')}</span></div><ul class="log">${S.retractations.map(r => `<li><time>${new Date(r.t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time><span><strong>${esc(r.nom)}</strong> (${esc(r.email)}) : ${esc(r.contrat)}. Référence ${esc(r.ref)}. Remboursement à faire sous 14 jours.</span></li>`).join('')}</ul></section>` : ''}
      <section class="panel reveal"><div class="panel-head"><h2>À traiter</h2></div>
        <div class="checklist">
          <a class="check-row ${aCorriger ? '' : 'done'}" href="#/admin/corrections"><span class="tick">${ic('check')}</span><span class="label">${aCorriger ? `${plural(aCorriger, 'exercice attend', 'exercices attendent')} une correction` : 'Aucun exercice en attente de correction'}</span><span class="go">${ic('chevron-right')}</span></a>
          <a class="check-row ${unanswered ? '' : 'done'}" href="#/communaute"><span class="tick">${ic('check')}</span><span class="label">${unanswered ? `${plural(unanswered, 'message attend', 'messages attendent')} une réponse` : 'Aucun message sans réponse'}</span><span class="go">${ic('chevron-right')}</span></a>
          <a class="check-row ${d.cours.length || d.videos.length ? 'done' : ''}" href="#/apprendre"><span class="tick">${ic('check')}</span><span class="label">Publier un premier cours ou une première vidéo</span><span class="go">${ic('chevron-right')}</span></a>
          <a class="check-row ${S.settings.delai ? 'done' : ''}" href="#/admin/reglages"><span class="tick">${ic('check')}</span><span class="label">Fixer le délai de réponse affiché</span><span class="go">${ic('chevron-right')}</span></a>
        </div>
      </section>`;
  }

  let contentFilter = 'tous';
  function adminContenus() {
    const types = ['cours', 'videos', 'ateliers', 'exercices', 'articles', 'nouveautes', 'evenements', 'projets'];
    const PLURAL = { cours: 'Cours', videos: 'Vidéos', ateliers: 'Ateliers', exercices: 'Exercices', articles: 'Articles', nouveautes: 'Nouveautés', evenements: 'Événements', projets: 'Projets' };
    const rows = types.filter(t => contentFilter === 'tous' || contentFilter === t).flatMap(t => S.data[t].map(x => ({ ...x, _t: t }))).sort((a, b) => b.date - a.date);
    const view = { cours: 'cour', videos: 'video', ateliers: 'atelier', exercices: 'exercice', articles: 'article' };
    return `<div class="panel reveal">
      <div class="panel-head"><h2>Contenus</h2>
        <div class="seg" role="group" aria-label="Type" style="flex-wrap:wrap">${[['tous', 'Tous'], ...types.map(t => [t, PLURAL[t]])].map(([v, l]) => `<button type="button" data-action="cfilter" data-v="${v}" aria-pressed="${contentFilter === v}">${l}</button>`).join('')}</div></div>
      <div class="table-wrap"><table><thead><tr><th>Titre</th><th>Type</th><th>Auteur</th><th>Date</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
        ${rows.length ? rows.map(x => `<tr><td><strong>${esc(x.titre)}</strong></td><td>${TYPE_LABEL[x._t]}</td><td>${esc(x.auteur || '')}</td><td>${dateLong(x.date)}</td><td style="text-align:right;white-space:nowrap">
          ${view[x._t] ? `<a class="icon-btn" href="#/${view[x._t]}/${x.id}" aria-label="Voir">${ic('eye')}</a>` : ''}
          <button type="button" class="icon-btn" data-action="delete" data-type="${x._t}" data-id="${x.id}" aria-label="Supprimer">${ic('trash-2')}</button></td></tr>`).join('')
        : `<tr class="table-empty"><td colspan="5">Aucun contenu publié. Utilise "Publier" dans la vue d'ensemble.</td></tr>`}
      </tbody></table></div></div>`;
  }

  function adminModeration() {
    const posts = S.data.posts.slice().sort((a, b) => b.date - a.date);
    return `<div class="panel reveal"><div class="panel-head"><h2>Modération</h2><span class="small muted">${plural(posts.length, 'message', 'messages')}</span></div>
      <div class="table-wrap"><table><thead><tr><th>Message</th><th>Salon</th><th>Auteur</th><th>Score</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
        ${posts.length ? posts.map(x => `<tr><td><a href="#/post/${x.id}"><strong>${esc(x.titre)}</strong></a>${x.pinned ? ' <span class="badge badge-gold">Épinglé</span>' : ''}</td><td>${salon(x.salon).t}</td><td>${esc(x.auteur)}</td><td>${x.score || 0}</td><td style="text-align:right;white-space:nowrap">
          <button type="button" class="icon-btn" data-action="pin" data-id="${x.id}" aria-label="${x.pinned ? 'Désépingler' : 'Épingler'}">${ic('pin')}</button>
          <button type="button" class="icon-btn" data-action="delete" data-type="posts" data-id="${x.id}" aria-label="Supprimer">${ic('trash-2')}</button></td></tr>`).join('')
        : '<tr class="table-empty"><td colspan="5">Rien à modérer. La communauté est calme.</td></tr>'}
      </tbody></table></div></div>`;
  }

  function adminMembres(godView) {
    const canRole = realRole() === 'god';
    return `<div class="panel reveal ${godView ? 'god-panel' : ''}"><div class="panel-head"><h2>${godView ? 'Rôles des comptes' : 'Membres'}</h2><span class="small muted">${plural(S.members.length, 'compte', 'comptes')}</span></div>
      <div class="table-wrap"><table><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Tokens</th><th>Inscrit</th></tr></thead><tbody>
        ${S.members.length ? S.members.map(m => `<tr><td><strong>${esc(m.name)}</strong></td><td>${esc(m.email)}</td><td>${canRole && m.email !== S.user.email
          ? `<label class="sr-only" for="role-${esc(m.email)}">Rôle de ${esc(m.name)}</label><select id="role-${esc(m.email)}" class="select" style="min-height:36px;padding:4px 10px;width:auto" data-action="set-role" data-email="${esc(m.email)}">${['member', 'admin', 'god'].map(r => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${ROLE[r].label}</option>`).join('')}</select>`
          : roleBadge(m.role)}</td><td style="white-space:nowrap">${m.role === 'member' ? `${wallet(m.email).solde} <button type="button" class="btn btn-sm btn-quiet" data-action="gift" data-email="${esc(m.email)}">${ic('gift')}Offrir</button>` : '<span class="muted">illimité</span>'}</td><td>${dateLong(m.joined)}</td></tr>`).join('')
        : '<tr class="table-empty"><td colspan="5">Aucun compte pour l\'instant.</td></tr>'}
      </tbody></table></div></div>`;
  }

  function adminReglages() {
    return `<form class="panel reveal" data-form="settings" novalidate>
      <div class="panel-head"><h2>Réglages du site</h2></div>
      <div class="form-grid">
        <div class="field"><label for="set-annonce">Bandeau d'annonce</label><input id="set-annonce" class="input" name="annonce" value="${esc(S.settings.annonce)}" maxlength="120" placeholder="Laisser vide pour ne rien afficher"><span class="help">Affiché en haut de toutes les pages. 120 caractères maximum.</span></div>
        <div class="field"><label for="set-delai">Délai de réponse garanti</label><input id="set-delai" class="input" name="delai" value="${esc(S.settings.delai)}" maxlength="30" placeholder="Par exemple : 24 heures ouvrées"><span class="help">Affiché sur l'accueil et dans la formule Accompagnement. N'affiche que ce que tu peux tenir.</span></div>
        <h3 class="title-m" style="margin-top:12px">Informations légales</h3>
        <div class="field"><label for="set-tel">Téléphone de l'éditeur</label><input id="set-tel" class="input" name="telephone" value="${esc(S.settings.telephone || '')}" inputmode="tel"><span class="help">Obligatoire dans les mentions légales pour un entrepreneur individuel (loi LCEN, article 6).</span></div>
        <div class="field"><label for="set-med">Médiateur de la consommation</label><input id="set-med" class="input" name="mediateur" value="${esc(S.settings.mediateur || '')}" placeholder="Nom et site du médiateur"><span class="help">Obligatoire avant la première vente à un particulier. Il s'affiche dans les conditions de vente.</span></div>
        <div class="field"><label for="set-wh">Adresse d'envoi automatique des rétractations</label><input id="set-wh" class="input" type="url" name="webhook" value="${esc(S.settings.webhook || '')}" placeholder="https://..."><span class="help">Adresse d'un webhook (par exemple n8n) qui envoie l'accusé de réception par email au client et te prévient.</span></div>
        <h3 class="title-m" style="margin-top:12px">Tokens : coût de chaque format</h3>
        <div class="grid-cost-form">${[['cours', 'Cours'], ['videos', 'Vidéos'], ['ateliers', 'Ateliers'], ['exercices', 'Exercices'], ['articles', 'Articles']].map(([k, l]) => `<div class="field"><label for="ct-${k}">${l}</label><input id="ct-${k}" class="input" type="number" min="0" step="1" inputmode="numeric" name="cout_${k}" value="${S.settings.cout[k]}"></div>`).join('')}</div>
        <span class="help">0 = gratuit. Un contenu peut avoir son propre coût, réglé à sa création.</span>
        <h3 class="title-m" style="margin-top:12px">Les 3 packs</h3>
        ${S.settings.packs.map((p, i) => `<div class="grid-pack-form"><div class="field"><label for="pk-${i}-n">Nom</label><input id="pk-${i}-n" class="input" name="pack_${i}_nom" value="${esc(p.nom)}"></div><div class="field"><label for="pk-${i}-c">Tokens</label><input id="pk-${i}-c" class="input" type="number" min="1" step="1" name="pack_${i}_credits" value="${p.credits}"></div><div class="field"><label for="pk-${i}-p">Prix en euros</label><input id="pk-${i}-p" class="input" name="pack_${i}_prix" value="${esc(p.prix)}" placeholder="Vide : annoncé à l'ouverture"></div></div>`).join('')}
        <div class="field" style="max-width:320px"><label for="set-bienvenue">Tokens offerts à l'inscription</label><input id="set-bienvenue" class="input" type="number" min="0" step="1" name="bienvenue" value="${S.settings.bienvenue}"><span class="help">0 par défaut. Un token offert permet d'essayer un contenu avant d'acheter.</span></div>
        <div><button class="btn btn-primary" type="submit">Enregistrer</button></div>
      </div></form>`;
  }

  // =========================================================
  // GOD MODE
  // =========================================================
  const GOD_TABS = [['godmode', 'eye', 'Voir en tant que'], ['godmode/fonctions', 'toggle-right', 'Fonctionnalités'], ['godmode/roles', 'key-round', 'Rôles et accès'], ['godmode/journal', 'scroll-text', 'Journal'], ['godmode/zone', 'triangle-alert', 'Zone sensible']];
  function viewGod(p) {
    const tab = p.a || '';
    const cur = tab ? 'godmode/' + tab : 'godmode';
    let content;
    if (tab === 'fonctions') content = godFlags();
    else if (tab === 'roles') content = godRoles();
    else if (tab === 'journal') content = godJournal();
    else if (tab === 'zone') content = godZone();
    else content = godViewAs();
    return `<div class="container dash">${dashSide(cur, GOD_TABS, `<a class="side-link" href="#/admin" style="margin-top:12px">${ic('layout-dashboard')}Console admin</a>`)}
      <div class="dash-main">
        <div class="god-head reveal"><span class="avatar lg gold">${ic('crown')}</span><div><h1 class="title-l">God mode</h1><p class="small muted">Tout ce qui touche au fonctionnement du site. Chaque action est inscrite au journal.</p></div></div>
        ${content}
      </div></div>`;
  }

  function godViewAs() {
    const opts = [['', 'crown', 'Moi', 'Tout voir, tout modifier.'], ['guest', 'user-round', 'Invité', 'Ce que voit quelqu\'un qui arrive pour la première fois.'], ['member', 'users', 'Membre', 'Ce que voit un membre connecté.'], ['admin', 'shield-check', 'Admin', 'Ce que voit un membre de l\'équipe.']];
    return `<section class="panel god-panel reveal"><div class="panel-head"><h2>Voir le site en tant que</h2></div>
      <p class="small muted" style="margin-bottom:16px">Change de point de vue sans te déconnecter. Le ruban en haut de l'écran te permet de revenir à tout moment.</p>
      <div class="grid-2">${opts.map(([v, i, t, d]) => `<button type="button" class="check-row ${(S.viewAs || '') === v ? 'done' : ''}" data-action="viewas" data-v="${v}" aria-pressed="${(S.viewAs || '') === v}" style="align-items:flex-start"><span class="tick">${ic('check')}</span><span><strong style="display:flex;gap:8px;align-items:center">${ic(i)}${t}</strong><span class="small muted" style="display:block;text-decoration:none">${d}</span></span></button>`).join('')}</div>
    </section>`;
  }

  function godFlags() {
    const F = [['ateliers', 'Ateliers', 'Les ateliers en direct et leurs replays'], ['exercices', 'Exercices', 'Les exercices et leur correction'], ['forum', 'Forum', 'Les salons de discussion'], ['projets', 'Projets', 'La galerie des projets des membres'], ['evenements', 'Événements', 'Le calendrier des lives'], ['classement', 'Classement', 'Les niveaux et les points'], ['membres', 'Annuaire des membres', 'La liste publique des membres'], ['accompagnement', 'Accompagnement', 'La page des formules et ses liens']];
    return `<section class="panel god-panel reveal"><div class="panel-head"><h2>Fonctionnalités</h2></div>
      <p class="small muted" style="margin-bottom:8px">Une fonction coupée disparaît de la navigation pour le public. Tu la vois toujours, signalée comme coupée.</p>
      ${F.map(([k, t, d]) => `<div class="setting"><div><strong>${t}</strong><span>${d}</span></div><label class="switch"><input type="checkbox" data-action="flag" data-k="${k}" ${S.flags[k] ? 'checked' : ''} aria-label="${t}"><span></span></label></div>`).join('')}
    </section>`;
  }

  function godRoles() {
    const cols = ['guest', 'member', 'admin', 'god'];
    return `<section class="panel god-panel reveal"><div class="panel-head"><h2>Qui peut faire quoi</h2></div>
      <div class="table-wrap"><table class="perm-table"><thead><tr><th>Permission</th>${cols.map(c => `<th>${ROLE[c].label}</th>`).join('')}</tr></thead><tbody>
        ${PERMS.map(([t, min]) => `<tr><td>${t}</td>${cols.map(c => `<td>${RANK[c] >= RANK[min] ? `<span class="perm-yes" aria-label="oui">${ic('circle-check')}</span>` : `<span class="perm-no" aria-label="non">${ic('x')}</span>`}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div></section>
      ${adminMembres(true)}`;
  }

  function godJournal() {
    return `<section class="panel god-panel reveal"><div class="panel-head"><h2>Journal d'audit</h2><span class="small muted">${plural(S.audit.length, 'entrée', 'entrées')}</span></div>
      ${S.audit.length ? `<ul class="log">${S.audit.map(a => `<li><time datetime="${new Date(a.t).toISOString()}">${new Date(a.t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time><span><strong>${esc(a.who)}</strong> ${esc(a.msg)}</span></li>`).join('')}</ul>`
      : '<p class="muted">Aucune action pour l\'instant.</p>'}</section>`;
  }

  function godZone() {
    return `<section class="panel danger-zone reveal"><div class="panel-head"><h2>Zone sensible</h2></div>
      <div class="setting"><div><strong>Vider tous les contenus</strong><span>Formations, articles, nouveautés, messages, projets, événements. Les comptes restent.</span></div><button type="button" class="btn btn-sm btn-danger" data-action="reset" data-v="content">Vider</button></div>
      <div class="setting"><div><strong>Remettre la maquette à zéro</strong><span>Efface tout ce qui est stocké dans ce navigateur, y compris ta session.</span></div><button type="button" class="btn btn-sm btn-danger" data-action="reset" data-v="all">Tout effacer</button></div>
    </section>`;
  }

  // =========================================================
  // PAGES LEGALES ET RETRACTATION
  // Sources : LCEN art. 6 (mentions legales) ; Code de la consommation L221-5, L221-18,
  // L221-21 et D221-5 (fonction de retractation obligatoire depuis le 19/06/2026,
  // ordonnance 2026-2 et decret 2026-3), L221-28 13 (contenu numerique) ; RGPD.
  // =========================================================
  const EDITEUR = {
    nom: 'Kemy Guerouine',
    statut: 'Entrepreneur individuel',
    commercial: 'OTTOM4T3',
    marque: "Formez-vous à l'IA (FVIA)",
    siret: '105 919 047 00016',
    adresse: '14 boulevard du Maréchal Leclerc, 83320 Carqueiranne, France',
    email: 'kemy.guerouine@gmail.com'
  };
  const MAJ_LEGAL = '3 octobre 2026';
  const legalNav = cur => `<nav class="legal-nav" aria-label="Informations légales">${[['mentions', 'Mentions légales'], ['cgv', 'Conditions de vente'], ['confidentialite', 'Confidentialité']].map(([k, l]) => `<a href="#/legal/${k}" ${cur === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}<a href="#/retractation" ${cur === 'retractation' ? 'aria-current="page"' : ''}>Se rétracter</a></nav>`;

  function viewLegal(p) {
    const page = p.a || 'mentions';
    const E = EDITEUR;
    const tel = S.settings.telephone ? `<li>Téléphone : ${esc(S.settings.telephone)}</li>` : '';
    let title, body;
    if (page === 'cgv') {
      title = 'Conditions générales de vente';
      body = `
        <p class="legal-intro">Ces conditions s'appliquent à toute commande passée sur kemyguerouine.com à compter de l'ouverture des ventes. Version du ${MAJ_LEGAL}.</p>
        <h2>1. Qui vend</h2>
        <p>${E.nom}, ${E.statut.toLowerCase()} (nom commercial ${E.commercial}, marque ${E.marque}), SIRET ${E.siret}, ${E.adresse}. Contact : <a href="mailto:${E.email}">${E.email}</a>.</p>
        <h2>2. Ce qui est vendu</h2>
        <p>Des packs de tokens. Les tokens permettent de débloquer des contenus numériques (cours écrits, vidéos, exercices avec correction, articles payants) et de réserver des places aux ateliers en direct. Le coût en tokens de chaque contenu est affiché avant tout déblocage. Les articles et la communauté sont accessibles sans token.</p>
        <p>Ces offres s'adressent aux particuliers. Un professionnel ou une entreprise qui souhaite acheter doit écrire à l'adresse ci-dessus.</p>
        <h2>3. Prix</h2>
        <p>Les prix sont indiqués en euros, toutes taxes comprises, sur la page des packs. Tant que l'entreprise relève de la franchise en base de TVA, la mention « TVA non applicable, article 293 B du CGI » figure sur la facture. Le prix payé est celui affiché au moment de la commande.</p>
        <h2>4. Commande et paiement</h2>
        <p>La commande se fait en ligne : choix du pack, acceptation des présentes conditions, paiement par carte bancaire auprès du prestataire de paiement sécurisé indiqué au moment de payer. Aucune donnée bancaire n'est conservée par le vendeur. Une confirmation de commande et la facture sont envoyées par email.</p>
        <h2>5. Les tokens</h2>
        <p>Les tokens sont versés sur le compte du client dès la confirmation du paiement. Ils sont personnels et ne peuvent être ni revendus ni transférés. Un contenu débloqué reste accessible depuis l'espace membre. Si le service devait cesser, le client serait prévenu par email au moins 30 jours à l'avance.</p>
        <h2>6. Ateliers en direct</h2>
        <p>Une place à un atelier se réserve avec des tokens. Le lien de connexion est communiqué au client inscrit. Le replay est inclus dans la réservation. Si un atelier est annulé par le vendeur, les tokens sont rendus.</p>
        <h2>7. Exercices et corrections</h2>
        <p>Un exercice débloqué peut être rendu par le client. La correction est écrite et rendue dans le délai indiqué sur le site au moment du rendu.</p>
        <h2>8. Droit de rétractation</h2>
        <p>Le client dispose de 14 jours à compter de l'achat pour se rétracter, sans avoir à se justifier (article L221-18 du Code de la consommation). Pour l'exercer, il utilise le bouton <a href="#/retractation">« Se rétracter du contrat ici »</a>, accessible en bas de chaque page et dans l'espace membre, ou envoie le formulaire ci-dessous par email. Un accusé de réception lui est remis avec la date et l'heure de sa demande.</p>
        <p><strong>Contenus numériques.</strong> Débloquer un contenu revient à demander son exécution immédiate. Au moment du déblocage, le client donne son accord exprès et reconnaît qu'il perd son droit de rétractation pour ce contenu (article L221-28, 13° du Code de la consommation). Les tokens non utilisés restent remboursables pendant le délai de 14 jours.</p>
        <p><strong>Remboursement.</strong> En cas de rétractation, le vendeur rembourse la valeur des tokens non utilisés (prix du pack divisé par le nombre de tokens du pack, multiplié par les tokens restants) au plus tard 14 jours après la demande, par le même moyen de paiement que celui utilisé lors de l'achat.</p>
        <div class="legal-box"><strong>Formulaire de rétractation</strong><p>À l'attention de ${E.nom}, ${E.adresse}, ${E.email} : je vous notifie par la présente ma rétractation du contrat portant sur l'achat ci-dessous. Commandé le : ... Nom du client : ... Adresse email du compte : ... Date : ... Signature (en cas d'envoi papier) : ...</p></div>
        <h2>9. Aucune promesse de résultat</h2>
        <p>Les contenus enseignent une méthode. Aucun revenu, aucun résultat financier et aucun délai de réussite ne sont promis. Le vendeur est tenu d'une obligation de moyens.</p>
        <h2>10. Propriété intellectuelle</h2>
        <p>Les contenus sont réservés à l'usage personnel du client. Toute copie, diffusion ou revente, même partielle, est interdite.</p>
        <h2>11. Données personnelles</h2>
        <p>Voir la page <a href="#/legal/confidentialite">Confidentialité</a>.</p>
        <h2>12. Réclamation et médiation</h2>
        <p>Toute réclamation peut être adressée à ${E.email}. En cas de désaccord persistant, le client peut recourir gratuitement à un médiateur de la consommation (article L612-1 du Code de la consommation). ${S.settings.mediateur ? `Médiateur désigné : ${esc(S.settings.mediateur)}.` : 'Le médiateur désigné sera indiqué ici avant l\'ouverture des ventes.'}</p>
        <h2>13. Droit applicable</h2>
        <p>Ces conditions sont soumises au droit français. Le client consommateur peut saisir le tribunal de son lieu de domicile.</p>`;
    } else if (page === 'confidentialite') {
      title = 'Confidentialité';
      body = `
        <p class="legal-intro">Ce que deviennent tes données sur kemyguerouine.com. Version du ${MAJ_LEGAL}.</p>
        <h2>Responsable du traitement</h2>
        <p>${E.nom}, ${E.statut.toLowerCase()} (${E.commercial}), ${E.adresse}. Contact : <a href="mailto:${E.email}">${E.email}</a>.</p>
        <h2>Ce qui est enregistré aujourd'hui</h2>
        <p>Ton compte, ta progression, tes messages, tes rendus d'exercices et tes tokens sont enregistrés <strong>dans ton navigateur</strong> (stockage local). Ils ne sont pas envoyés à nos serveurs. Les effacer depuis les réglages de ton navigateur supprime ces données.</p>
        <p>Si tu exerces ton droit de rétractation, les informations du formulaire (nom, email, achat concerné) nous sont transmises pour traiter ta demande, puis conservées 3 ans comme preuve.</p>
        <h2>Services tiers</h2>
        <ul>
          <li>Hébergement du site : GitHub Pages (GitHub, Inc.), qui reçoit ton adresse IP pour afficher les pages.</li>
          <li>Polices de caractères : Google Fonts (Google), qui reçoit ton adresse IP.</li>
          <li>Icônes : jsDelivr, qui reçoit ton adresse IP.</li>
        </ul>
        <h2>Cookies</h2>
        <p>Ce site n'utilise ni cookie publicitaire ni outil de mesure d'audience. Le stockage local sert uniquement au fonctionnement du site : aucun consentement n'est donc demandé.</p>
        <h2>Tes droits</h2>
        <p>Tu peux demander l'accès, la rectification, l'effacement ou la limitation de tes données, et t'opposer à leur traitement, en écrivant à ${E.email}. Tu peux aussi saisir la CNIL (cnil.fr).</p>`;
    } else {
      title = 'Mentions légales';
      body = `
        <p class="legal-intro">Informations prévues par l'article 6 de la loi pour la confiance dans l'économie numérique. Version du ${MAJ_LEGAL}.</p>
        <h2>Éditeur du site</h2>
        <ul>
          <li>${E.nom}, ${E.statut.toLowerCase()}</li>
          <li>Nom commercial : ${E.commercial}. Marque : ${E.marque}</li>
          <li>SIRET : ${E.siret}</li>
          <li>Adresse : ${E.adresse}</li>
          <li>Email : <a href="mailto:${E.email}">${E.email}</a></li>
          ${tel}
        </ul>
        <h2>Directeur de la publication</h2>
        <p>${E.nom}.</p>
        <h2>Hébergeur</h2>
        <p>GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis (service GitHub Pages).</p>
        <h2>Propriété intellectuelle</h2>
        <p>Les textes, contenus pédagogiques, éléments graphiques et la marque ${E.marque} sont protégés. Toute reproduction sans autorisation écrite est interdite.</p>
        <h2>Données personnelles</h2>
        <p>Voir la page <a href="#/legal/confidentialite">Confidentialité</a>.</p>`;
    }
    return `<article class="container legal">${legalNav(page)}<h1 class="display-m">${title}</h1>${body}</article>`;
  }

  // ---------- Fonction de retractation (L221-21 et D221-5) ----------
  let retractDone = null;
  function viewRetractation() {
    const w = S.user && role() === 'member' ? wallet() : null;
    const achats = w ? w.journal.filter(j => j.d > 0 && Date.now() - j.t < 14 * 864e5) : [];
    if (retractDone) {
      const r = retractDone;
      return `<article class="container legal">${legalNav('retractation')}
        <div class="celebrate" style="text-align:left">
          <div class="result-mark" style="margin:0 0 18px">${ic('circle-check')}</div>
          <h1 class="display-m">Ta rétractation est enregistrée.</h1>
          <div class="legal-box" style="margin-top:24px"><strong>Accusé de réception</strong>
            <p>${esc(r.nom)} (${esc(r.email)}) a déclaré se rétracter du contrat suivant : ${esc(r.contrat)}.</p>
            <p>Demande envoyée le ${new Date(r.t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à ${new Date(r.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Référence : ${esc(r.ref)}.</p>
            <p>Le remboursement des tokens non utilisés intervient au plus tard 14 jours après cette date.</p>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">
            <button type="button" class="btn btn-primary" data-action="retract-download">${ic('arrow-right')}Télécharger l'accusé de réception</button>
            <a class="btn btn-secondary" href="mailto:${EDITEUR.email}?subject=${encodeURIComponent('Rétractation ' + r.ref)}&body=${encodeURIComponent(retractText(r))}">Recevoir une copie par email</a>
          </div>
        </div></article>`;
    }
    return `<article class="container legal">${legalNav('retractation')}
      <h1 class="display-m">Se rétracter du contrat</h1>
      <p class="legal-intro">Tu as 14 jours après ton achat pour te rétracter, sans avoir à te justifier. Les tokens non utilisés te sont remboursés.</p>
      <form class="panel form-grid" data-form="retract" novalidate style="max-width:640px">
        <div class="field"><label for="rt-nom">Ton nom</label><input id="rt-nom" name="nom" class="input" required autocomplete="name" value="${S.user ? esc(S.user.name) : ''}"><span class="err">${ic('triangle-alert')}Indique ton nom.</span></div>
        <div class="field"><label for="rt-email">Email où recevoir la confirmation</label><input id="rt-email" name="email" class="input" type="email" required autocomplete="email" value="${S.user ? esc(S.user.email) : ''}"><span class="err">${ic('triangle-alert')}Cet email ne semble pas valide.</span></div>
        <div class="field"><label for="rt-contrat">Contrat concerné</label>
          ${achats.length ? `<select id="rt-contrat" name="contrat" class="select">${achats.map(j => `<option>${esc(j.l)}, acheté le ${new Date(j.t).toLocaleDateString('fr-FR')}</option>`).join('')}</select>`
            : `<input id="rt-contrat" name="contrat" class="input" required placeholder="Par exemple : pack Essentiel acheté le 2 octobre"><span class="help">Le pack et la date d'achat suffisent.</span><span class="err">${ic('triangle-alert')}Précise l'achat concerné.</span>`}
        </div>
        <button class="btn btn-primary btn-lg" type="submit">Confirmer la rétractation</button>
      </form>
      <p class="small muted" style="margin-top:16px">Tu peux aussi écrire à ${EDITEUR.email}. Les contenus déjà débloqués ne sont plus rétractables (voir les <a href="#/legal/cgv">conditions de vente</a>, article 8).</p>
    </article>`;
  }
  function retractText(r) {
    return `Accusé de réception de rétractation\n\nVendeur : ${EDITEUR.nom} (${EDITEUR.commercial}), SIRET ${EDITEUR.siret}, ${EDITEUR.adresse}\nClient : ${r.nom} (${r.email})\nContrat : ${r.contrat}\nDate et heure de la demande : ${new Date(r.t).toLocaleString('fr-FR')}\nRéférence : ${r.ref}\n\nLe remboursement des tokens non utilisés intervient au plus tard 14 jours après cette date.`;
  }

  // =========================================================
  // COUCHES : modale, tiroir, palette, toasts
  // =========================================================
  const layer = $('#layer');
  let lastFocus = null;
  let onCloseLayer = null;

  function openLayer(html, kind = 'modal', label = 'Fenêtre') {
    closeLayer(true);
    lastFocus = document.activeElement;
    const cls = kind === 'drawer' ? 'overlay drawer-overlay' : kind === 'cmd' ? 'overlay cmd-overlay' : 'overlay';
    layer.innerHTML = `<div class="${cls}" data-overlay><div class="${kind === 'drawer' ? 'drawer' : kind === 'cmd' ? 'cmd' : 'modal'}" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div></div>`;
    document.body.style.overflow = 'hidden';
    icons();
    const ov = $('[data-overlay]', layer);
    requestAnimationFrame(() => ov.classList.add('is-open'));
    const first = $('[autofocus], input:not([type=hidden]), textarea, select, button:not(.modal-close)', ov);
    setTimeout(() => first && first.focus(), 60);
  }
  function closeLayer(instant) {
    const ov = $('[data-overlay]', layer);
    if (!ov) return;
    document.body.style.overflow = '';
    const cb = onCloseLayer; onCloseLayer = null;
    if (instant) { layer.innerHTML = ''; return; }
    ov.classList.remove('is-open');
    setTimeout(() => { if (layer.contains(ov)) layer.innerHTML = ''; }, 220);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    if (cb) cb();
  }

  function toast(msg, opts = {}) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${ic(opts.icon || 'circle-check')}<span>${esc(msg)}</span>${opts.undo ? '<button type="button">Annuler</button>' : ''}`;
    box.appendChild(el);
    icons();
    if (opts.undo) $('button', el).addEventListener('click', () => { opts.undo(); dismiss(); });
    const dismiss = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); };
    setTimeout(dismiss, opts.undo ? 6000 : 3200);
  }

  // ---------- Connexion : membre, equipe, fondateur ----------
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function authModal(mode = 'login', context = '') {
    const quizDone = !!S.quiz;
    const f = (id, label, type, extra = '', help = '', err = '') => `
      <div class="field"><label for="${id}">${label}</label>
        ${type === 'password' ? `<div class="pw-wrap"><input id="${id}" name="${id.split('-')[1]}" class="input" type="password" ${extra}><button type="button" class="icon-btn" data-action="pw-toggle" aria-label="Afficher le mot de passe">${ic('eye')}</button></div>` : `<input id="${id}" name="${id.split('-')[1]}" class="input" type="${type}" ${extra}>`}
        ${help ? `<span class="help">${help}</span>` : ''}<span class="err">${ic('triangle-alert')}<span>${err}</span></span></div>`;
    let demo = `<div class="demo-box"><p><strong>Démo.</strong> Aucun serveur n'est branché : choisis un rôle pour visiter.</p>
      <div class="demo-roles">
        <button type="button" data-action="demo" data-v="member">${ic('user-round')}Membre</button>
        <button type="button" data-action="demo" data-v="admin">${ic('shield-check')}Admin</button>
        <button type="button" class="god" data-action="demo" data-v="god">${ic('crown')}God mode</button>
      </div></div>`;
    let html = `<button type="button" class="icon-btn modal-close" data-action="close" aria-label="Fermer">${ic('x')}</button>`;
    if (!DEMO) demo = '';
    if (mode === 'signup') {
      html += `<h2>${quizDone ? 'Garde ton parcours.' : 'Crée ton compte.'}</h2>
        <p class="sub">${context || (quizDone ? `${PARCOURS[S.quiz.but]}, prêt à démarrer.` : 'Gratuit. Ta progression et tes messages sont gardés.')}</p>
        <div class="endowed"><div class="row"><span>Ton démarrage</span><span>${quizDone ? '2' : '1'} étape${quizDone ? 's' : ''} sur 5</span></div><div class="progress"><i style="width:${quizDone ? 40 : 20}%"></i></div></div>
        <form class="form-grid" data-form="signup" novalidate>
          ${f('su-name', 'Prénom', 'text', 'autocomplete="given-name" required', '', 'Indique ton prénom.')}
          ${f('su-email', 'Email', 'email', 'autocomplete="email" required inputmode="email"', '', 'Cet email ne semble pas valide.')}
          ${f('su-pass', 'Mot de passe', 'password', 'autocomplete="new-password" required minlength="8"', '8 caractères minimum.', 'Il faut au moins 8 caractères.')}
          <button class="btn btn-primary btn-block btn-lg" type="submit">Créer mon compte</button>
          <p class="tiny muted" style="text-align:center">En créant un compte, tu acceptes les <a href="#/legal/cgv" style="text-decoration:underline">conditions</a> et la <a href="#/legal/confidentialite" style="text-decoration:underline">politique de confidentialité</a>.</p>
        </form>
        <div class="divider-text" style="margin:20px 0">Déjà membre ?</div>
        <button type="button" class="btn btn-quiet btn-block" data-action="login">Se connecter</button>${demo}`;
    } else if (mode === 'login') {
      html += `<h2>Content de te revoir.</h2><p class="sub">${context || 'Connecte-toi pour reprendre là où tu t\'es arrêté.'}</p>
        <form class="form-grid" data-form="login" novalidate>
          ${f('li-email', 'Email', 'email', 'autocomplete="email" required inputmode="email"', '', 'Cet email ne semble pas valide.')}
          ${f('li-pass', 'Mot de passe', 'password', 'autocomplete="current-password" required', '', 'Entre ton mot de passe.')}
          <div style="display:flex;justify-content:flex-end;margin-top:-6px"><button type="button" class="team-link" data-action="forgot">Mot de passe oublié ?</button></div>
          <button class="btn btn-primary btn-block btn-lg" type="submit">Se connecter</button>
        </form>
        <div class="divider-text" style="margin:20px 0">Pas encore de compte ?</div>
        <button type="button" class="btn btn-quiet btn-block" data-action="signup">Créer un compte</button>
        <div style="text-align:center;margin-top:12px"><button type="button" class="team-link" data-action="team">${ic('key-round')}Accès équipe</button></div>${demo}`;
    } else if (mode === 'team') {
      html += `<span class="badge badge-admin" style="margin-bottom:14px">${ic('shield-check')}Équipe</span><h2>Accès équipe</h2><p class="sub">Réservé aux administrateurs de FVIA.</p>
        <form class="form-grid" data-form="team" novalidate>
          ${f('tm-email', 'Email professionnel', 'email', 'autocomplete="username" required', '', 'Cet email ne semble pas valide.')}
          ${f('tm-pass', 'Mot de passe', 'password', 'autocomplete="current-password" required', '', 'Entre ton mot de passe.')}
          <label style="display:flex;gap:10px;align-items:center;font-size:14px;min-height:44px;cursor:pointer"><input type="checkbox" name="founder" style="width:18px;height:18px;accent-color:var(--primary)"> Compte fondateur (ouvre le god mode)</label>
          <button class="btn btn-primary btn-block btn-lg" type="submit">Continuer</button>
        </form>
        <div style="text-align:center;margin-top:12px"><button type="button" class="team-link" data-action="login">${ic('arrow-left')}Espace membre</button></div>${demo}`;
    } else if (mode === 'otp') {
      html += `<span class="badge badge-god" style="margin-bottom:14px">${ic('crown')}Fondateur</span><h2>Code de vérification</h2><p class="sub">Saisis le code à 6 chiffres de ton application d'authentification.</p>
        <form data-form="otp" novalidate>
          <div class="otp" role="group" aria-label="Code à 6 chiffres">${[0, 1, 2, 3, 4, 5].map(i => `<input inputmode="numeric" maxlength="1" autocomplete="${i === 0 ? 'one-time-code' : 'off'}" aria-label="Chiffre ${i + 1}" data-otp="${i}">`).join('')}</div>
          <p class="err small" style="color:var(--danger);margin-top:10px;display:none" id="otp-err">Le code doit contenir 6 chiffres.</p>
          <button class="btn btn-primary btn-block btn-lg" style="margin-top:20px" type="submit">Ouvrir le god mode</button>
          ${DEMO ? `<p class="tiny muted" style="margin-top:12px;text-align:center">Démo : n'importe quel code à 6 chiffres est accepté.</p>` : ''}
        </form>`;
    }
    openLayer(html, 'modal', mode === 'signup' ? 'Créer un compte' : mode === 'team' ? 'Accès équipe' : mode === 'otp' ? 'Code de vérification' : 'Connexion');
  }

  let pendingTeam = null;
  function signIn({ name, email, role: r }, isNew) {
    let m = S.members.find(x => x.email === email);
    if (!m) { m = { name, email, role: r, joined: Date.now() }; S.members.push(m); }
    else if (RANK[r] > RANK[m.role]) m.role = r;
    S.user = { name: m.name, email: m.email, role: m.role };
    if (isNew && S.settings.bienvenue > 0) { const w = wallet(m.email); w.solde += S.settings.bienvenue; w.journal.unshift({ t: Date.now(), d: S.settings.bienvenue, l: 'Offerts à l\'inscription' }); save('wallets'); }
    S.viewAs = null;
    save('user', 'members', 'viewAs');
    audit(isNew ? 'a créé son compte' : `s'est connecté (${ROLE[m.role].label})`);
    closeLayer(true);
    toast(isNew ? `Bienvenue, ${firstName(m.name)}. Ton compte est créé.` : `Content de te revoir, ${firstName(m.name)}.`, { icon: 'party-popper' });
    if (pendingAction) { const a = pendingAction; pendingAction = null; render(); a(); return; }
    const dest = m.role === 'god' ? 'godmode' : m.role === 'admin' ? 'admin' : 'espace';
    go(dest);
  }

  function validateField(input) {
    const field = input.closest('.field');
    let ok = true;
    const v = input.value.trim();
    if (input.required && !v) ok = false;
    if (ok && input.type === 'email' && v && !EMAIL_RE.test(v)) ok = false;
    if (ok && input.minLength > 0 && v.length < input.minLength) ok = false;
    if (ok && input.type === 'url' && v && !/^https?:\/\/\S+\.\S+/.test(v)) ok = false;
    if (field) field.classList.toggle('invalid', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    return ok;
  }
  function validateForm(form) {
    const inputs = $$('input.input, textarea.textarea', form);
    const results = inputs.map(validateField);
    const firstBad = inputs[results.indexOf(false)];
    if (firstBad) firstBad.focus();
    return !firstBad;
  }
  function withLoading(btn, fn, ms = 550) {
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    setTimeout(() => { btn.classList.remove('is-loading'); btn.removeAttribute('aria-busy'); fn(); }, reduceMotion() ? 0 : ms);
  }

  // ---------- Tiroir de creation ----------
  function openCreate(type, presetSalon) {
    const sc = SCHEMAS[type];
    if (!sc) return;
    if (!S.user || RANK[role()] < RANK[sc.min]) {
      if (!S.user) {
        pendingAction = () => openCreate(type, presetSalon);
        authModal('signup', type === 'posts' ? 'Crée ton compte pour publier. Ton message t\'attendra.' : 'Crée ton compte pour partager ton projet.');
      } else toast('Cette action est réservée à l\'équipe.', { icon: 'lock' });
      return;
    }
    const fields = sc.fields.map(fd => {
      const id = `cf-${fd.k}`;
      let input;
      if (fd.type === 'select') {
        const opts = fd.opts === 'salons' ? SALONS.filter(s => !s.staff || atLeast('admin')).map(s => [s.id, s.t]) : fd.opts === 'parcours' ? PARCOURS_OPTS.map(o => [o, o]) : fd.opts.map(o => [o, o]);
        input = `<select id="${id}" name="${fd.k}" class="select">${opts.map(([v, l]) => `<option value="${esc(v)}" ${presetSalon === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
      } else if (fd.type === 'textarea') input = `<textarea id="${id}" name="${fd.k}" class="textarea" rows="${fd.rows || 4}" ${fd.req ? 'required' : ''}></textarea>`;
      else input = `<input id="${id}" name="${fd.k}" class="input" type="${fd.type || 'text'}" ${fd.type === 'number' ? 'min="0" step="1" inputmode="numeric"' : ''} ${fd.req ? 'required' : ''} ${fd.ph ? `placeholder="${esc(fd.ph)}"` : ''}>`;
      return `<div class="field"><label for="${id}">${fd.l}${fd.req ? '' : ' <span class="muted" style="font-weight:400">(facultatif)</span>'}</label>${input}${fd.help ? `<span class="help">${fd.help}</span>` : ''}<span class="err">${ic('triangle-alert')}${fd.type === 'url' ? 'Le lien doit commencer par https://' : 'Ce champ est nécessaire.'}</span></div>`;
    }).join('');
    openLayer(`
      <div class="drawer-head"><h2>${sc.title}</h2><button type="button" class="icon-btn" data-action="close" aria-label="Fermer">${ic('x')}</button></div>
      <form class="form-grid" data-form="create" data-type="${type}" novalidate>
        ${fields}
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px"><button type="button" class="btn btn-quiet" data-action="close">Annuler</button><button class="btn btn-primary" type="submit">Publier</button></div>
      </form>`, 'drawer', sc.title);
  }

  // ---------- Palette de commande (Ctrl K) ----------
  let cmdIndex = 0;
  function cmdItems(q) {
    const nav = [
      ['Accueil', 'house', '#/'], ['Apprendre', 'graduation-cap', '#/apprendre'], ...LEARN.filter(learnOn).map(l => [l.t, l.icon, '#/' + l.r]), ['Nouveautés', 'sparkles', '#/nouveautes'],
      ...COMM.filter(c => S.flags[c.flag]).map(c => [c.t, c.icon, '#/' + c.r]),
      ['Packs de tokens', 'coins', '#/tarifs'],
      ...(S.flags.accompagnement ? [['Accompagnement', 'heart-handshake', '#/accompagnement']] : []),
      ...(S.user ? [['Mon espace', 'user-round', '#/espace']] : []),
      ...(atLeast('admin') ? [['Console admin', 'layout-dashboard', '#/admin']] : []),
      ...(realRole() === 'god' ? [['God mode', 'crown', '#/godmode']] : [])
    ].map(([t, i, h]) => ({ g: 'Aller à', t, i, run: () => { location.hash = h; } }));
    const acts = [
      ...(S.user ? [] : [{ t: 'Se connecter', i: 'log-in', run: () => authModal('login') }, { t: 'Créer un compte', i: 'user-plus', run: () => authModal('signup') }]),
      { t: 'Écrire dans la communauté', i: 'square-pen', run: () => openCreate('posts') },
      { t: 'Trouver mon parcours', i: 'route', run: () => startFlow() },
      ...(atLeast('admin') ? [{ t: 'Nouveau cours', i: 'plus', run: () => openCreate('cours') }, { t: 'Nouvelle vidéo', i: 'plus', run: () => openCreate('videos') }, { t: 'Nouvel atelier', i: 'plus', run: () => openCreate('ateliers') }, { t: 'Nouvel exercice', i: 'plus', run: () => openCreate('exercices') }, { t: 'Nouvel article', i: 'plus', run: () => openCreate('articles') }, { t: 'Exercices à corriger', i: 'list-checks', run: () => { location.hash = '#/admin/corrections'; } }] : []),
      ...(S.user ? [{ t: 'Se déconnecter', i: 'log-out', run: logout }] : [])
    ].map(a => ({ g: 'Actions', ...a }));
    const content = [
      ...S.data.cours.map(x => ({ g: 'Contenus', t: x.titre, i: 'book-open-text', run: () => { location.hash = '#/cour/' + x.id; } })),
      ...S.data.videos.map(x => ({ g: 'Contenus', t: x.titre, i: 'play', run: () => { location.hash = '#/video/' + x.id; } })),
      ...S.data.ateliers.map(x => ({ g: 'Contenus', t: x.titre, i: 'presentation', run: () => { location.hash = '#/atelier/' + x.id; } })),
      ...S.data.exercices.map(x => ({ g: 'Contenus', t: x.titre, i: 'list-checks', run: () => { location.hash = '#/exercice/' + x.id; } })),
      ...S.data.articles.map(x => ({ g: 'Contenus', t: x.titre, i: 'newspaper', run: () => { location.hash = '#/article/' + x.id; } })),
      ...S.data.posts.map(x => ({ g: 'Contenus', t: x.titre, i: 'message-circle', run: () => { location.hash = '#/post/' + x.id; } }))
    ];
    const all = [...nav, ...acts, ...content];
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return q ? all.filter(x => norm(x.t).includes(norm(q))) : [...nav, ...acts];
  }
  function openCmd() {
    openLayer(`
      <div class="cmd-input">${ic('search')}<input type="text" id="cmd-q" placeholder="Rechercher une page, une action, un contenu" aria-label="Rechercher" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="cmd-list"></div>
      <div class="cmd-list" id="cmd-list" role="listbox"></div>
      <div class="cmd-foot"><span><span class="kbd">↑</span> <span class="kbd">↓</span> naviguer</span><span><span class="kbd">Entrée</span> ouvrir</span><span><span class="kbd">Échap</span> fermer</span></div>`, 'cmd', 'Recherche');
    cmdIndex = 0;
    paintCmd('');
  }
  let cmdCurrent = [];
  function paintCmd(q) {
    cmdCurrent = cmdItems(q);
    const list = $('#cmd-list');
    if (!list) return;
    if (!cmdCurrent.length) { list.innerHTML = `<div class="cmd-empty">Aucun résultat pour "${esc(q)}".</div>`; return; }
    let g = '';
    list.innerHTML = cmdCurrent.map((x, i) => {
      const head = x.g !== g ? `<div class="cmd-group">${x.g}</div>` : '';
      g = x.g;
      return `${head}<button type="button" class="cmd-item" role="option" id="cmd-${i}" data-action="cmd-run" data-i="${i}" aria-selected="${i === cmdIndex}">${ic(x.i)}${esc(x.t)}${x.g === 'Aller à' ? '<span class="hint">Page</span>' : ''}</button>`;
    }).join('');
    icons();
    const q2 = $('#cmd-q');
    if (q2) q2.setAttribute('aria-activedescendant', 'cmd-' + cmdIndex);
  }
  function runCmd(i) { const x = cmdCurrent[i]; if (!x) return; closeLayer(true); document.body.style.overflow = ''; x.run(); }

  // ---------- Menus flottants ----------
  let megaTimer;
  let megaWhich = 'learn';
  function paintMega() {
    const r = realRole();
    const item = (c, i) => `<a class="mega-item" href="#/${c.r}" style="--i:${i}"><span class="mi-icon">${ic(c.icon)}</span><span><strong>${c.t}</strong><span>${c.d}</span></span></a>`;
    const learn = megaWhich === 'learn';
    const list = learn ? LEARN.filter(learnOn) : COMM.filter(c => S.flags[c.flag] || r === 'god');
    $('#mega').innerHTML = `
      <div class="container mega-inner">
        <div class="mega-intro">
          <h3>${learn ? 'Apprendre' : 'La communauté'}</h3>
          <p class="muted small measure">${learn ? 'Cinq formats qui se complètent. Commence par celui qui te ressemble.' : 'Un seul endroit pour poser tes questions, montrer ce que tu construis et suivre les autres.'}</p>
          ${learn ? `<a class="link-arrow" href="#/apprendre">Vue d'ensemble ${ic('chevron-right')}</a>` : ''}
        </div>
        <div class="mega-col">${list.slice(0, 3).map(item).join('')}</div>
        <div class="mega-col">${list.slice(3).map(item).join('')}</div>
      </div>`;
    icons();
  }
  function setMega(open, which) {
    if (which && which !== megaWhich) { megaWhich = which; paintMega(); }
    $('#mega').classList.toggle('is-open', open);
    $$('[data-action="mega"]').forEach(b => b.setAttribute('aria-expanded', String(open && b.dataset.m === megaWhich)));
  }
  function setUserMenu(open, noFocus) {
    const m = $('#user-menu');
    const b = $('[data-action="usermenu"]');
    m.classList.toggle('is-open', open);
    if (b) b.setAttribute('aria-expanded', String(open));
    if (open && !noFocus) setTimeout(() => { const f = $('.menu-item', m); f && f.focus(); }, 40);
  }
  function closeFloating() { setMega(false); setUserMenu(false); }

  // ---------- Flux "Commencer" ----------
  function startFlow() {
    const scrollToQuiz = () => {
      const q = $('#quiz');
      if (!q) return;
      q.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
      setTimeout(() => { const o = $('.option, .result-actions .btn', q); o && o.focus({ preventScroll: true }); }, 450);
    };
    if (parse().name !== '') { location.hash = '#/'; setTimeout(scrollToQuiz, 120); } else scrollToQuiz();
  }

  function logout() {
    audit("s'est déconnecté");
    S.user = null; S.viewAs = null;
    save('user', 'viewAs');
    toast('Tu es déconnecté. À bientôt.', { icon: 'log-out' });
    go('');
  }

  function menuSheet() {
    const link = (h, i, t) => `<a class="menu-item" href="#/${h}" data-action="close-nav">${ic(i)}${t}</a>`;
    openLayer(`<button type="button" class="icon-btn modal-close" data-action="close" aria-label="Fermer">${ic('x')}</button>
      <h2 style="font-size:24px;margin-bottom:12px">Toutes les rubriques</h2>
      ${link('apprendre', 'graduation-cap', 'Apprendre')}${LEARN.filter(learnOn).map(l => link(l.r, l.icon, l.t)).join('')}${link('nouveautes', 'sparkles', 'Nouveautés')}
      <div class="menu-sep"></div>${COMM.filter(c => S.flags[c.flag]).map(c => link(c.r, c.icon, c.t)).join('')}
      <div class="menu-sep"></div>${link('tarifs', 'coins', 'Packs de tokens')}${S.flags.accompagnement ? link('accompagnement', 'heart-handshake', 'Accompagnement') : ''}
      ${atLeast('admin') ? link('admin', 'layout-dashboard', 'Console admin') : ''}${realRole() === 'god' ? link('godmode', 'crown', 'God mode') : ''}
      ${S.user ? `<button type="button" class="menu-item" data-action="logout">${ic('log-out')}Se déconnecter</button>` : `<button type="button" class="btn btn-primary btn-block" style="margin-top:12px" data-action="signup">Créer un compte</button>`}`, 'modal', 'Menu');
  }

  function applyTheme() {
    const t = S.theme;
    document.documentElement.setAttribute('data-theme', t === 'system' ? 'system' : t);
    const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    $('meta[name="theme-color"]').setAttribute('content', dark ? '#0d1117' : '#ffffff');
  }

  // =========================================================
  // ACTIONS (delegation d'evenements)
  // =========================================================
  const actions = {
    start: () => { closeLayer(true); if (S.quiz && !S.user) authModal('signup'); else startFlow(); },
    login: () => authModal('login'),
    signup: () => authModal('signup'),
    team: () => authModal('team'),
    close: () => closeLayer(),
    'close-nav': () => closeLayer(true),
    cmd: () => { closeFloating(); openCmd(); },
    'cmd-run': el => runCmd(+el.dataset.i),
    'menu-sheet': menuSheet,
    logout: () => { closeFloating(); closeLayer(true); logout(); },
    mega: el => { const w = el.dataset.m; const open = !($('#mega').classList.contains('is-open') && megaWhich === w); setUserMenu(false); setMega(open, w); if (open) setTimeout(() => { const f = $('.mega-item'); f && f.focus(); }, 60); },
    usermenu: () => { const open = !$('#user-menu').classList.contains('is-open'); setMega(false); setUserMenu(open); },
    'close-announce': () => { S.announceClosed = S.settings.annonce; save('announceClosed'); renderChrome(parse().name); icons(); },
    theme: el => { S.theme = el.dataset.v; save('theme'); applyTheme(); renderChrome(parse().name); icons(); setUserMenu(true, true); },
    viewas: el => {
      S.viewAs = el.dataset.v || null; save('viewAs');
      audit(`regarde le site en tant que ${S.viewAs ? ROLE[S.viewAs].label : 'lui-même'}`);
      toast(S.viewAs ? `Tu vois le site comme un ${ROLE[S.viewAs].label.toLowerCase()}.` : 'Retour à ta vue complète.', { icon: 'eye' });
      render();
    },
    acc: el => { el.setAttribute('aria-expanded', String(el.getAttribute('aria-expanded') !== 'true')); },
    'quiz-pick': el => {
      quizAnswers[el.dataset.k] = el.dataset.v;
      $$('.option', el.parentElement).forEach(o => o.setAttribute('aria-pressed', String(o === el)));
      setTimeout(() => {
        quizStep++;
        if (quizStep >= QUIZ.length) { S.quiz = { ...quizAnswers }; save('quiz'); audit('a trouvé son parcours'); }
        refreshQuiz();
        const nxt = $('#quiz .option, #quiz .result-actions .btn');
        nxt && nxt.focus({ preventScroll: true });
      }, reduceMotion() ? 0 : 240);
    },
    'quiz-back': () => { quizStep = Math.max(0, quizStep - 1); refreshQuiz(); },
    'quiz-restart': () => { S.quiz = null; save('quiz'); quizStep = 0; quizAnswers = {}; startFlow(); },
    'quiz-reset': () => { S.quiz = null; save('quiz'); quizStep = 0; quizAnswers = {}; refreshQuiz(); const o = $('#quiz .option'); o && o.focus(); },
    filter: el => { filters[el.dataset.f] = el.dataset.v; render(); },
    'reset-filters': () => { filters = { niveau: 'Tous', parcours: 'Tous', articles: 'Tous', q: '' }; render(); },
    create: el => openCreate(el.dataset.type, el.dataset.salon),
    watch: el => {
      const k = el.dataset.k; S.watch[k] = !S.watch[k]; save('watch');
      toast(S.watch[k] ? 'C\'est noté, tu seras prévenu.' : 'Notification retirée.', { icon: S.watch[k] ? 'bell-ring' : 'bell' });
      render();
    },
    'watch-toggle': el => { S.watch[el.dataset.k] = el.checked; save('watch'); toast(el.checked ? 'Notification activée.' : 'Notification coupée.', { icon: 'bell' }); },
    rsvp: el => { const k = 'ev-' + el.dataset.id; S.watch[k] = !S.watch[k]; save('watch'); toast(S.watch[k] ? 'Tu es inscrit. Un rappel t\'attend la veille.' : 'Inscription annulée.', { icon: 'calendar-days' }); render(); },
    vote: el => {
      if (!S.user) { pendingAction = null; authModal('signup', 'Crée ton compte pour voter et faire remonter les meilleures réponses.'); return; }
      const id = el.dataset.id, v = +el.dataset.v;
      const post = S.data.posts.find(p => p.id === id);
      if (!post) return;
      const prev = S.votes[id] || 0;
      const next = prev === v ? 0 : v;
      post.score = (post.score || 0) - prev + next;
      S.votes[id] = next;
      save('data', 'votes');
      const box = el.closest('.votes');
      $('output', box).textContent = post.score;
      $$('button', box).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === next)));
    },
    pin: el => { const p = S.data.posts.find(x => x.id === el.dataset.id); if (!p) return; p.pinned = !p.pinned; save('data'); audit(`${p.pinned ? 'a épinglé' : 'a désépinglé'} "${p.titre}"`); toast(p.pinned ? 'Message épinglé en haut du salon.' : 'Message désépinglé.', { icon: 'pin' }); render(); },
    share: el => {
      const url = location.href.split('#')[0] + '#/post/' + el.dataset.id;
      const done = () => toast('Lien copié.', { icon: 'link-2' });
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done); else done();
    },
    delete: el => {
      const t = el.dataset.type, id = el.dataset.id;
      const idx = S.data[t].findIndex(x => x.id === id);
      if (idx < 0) return;
      const [item] = S.data[t].splice(idx, 1);
      save('data'); audit(`a supprimé ${TYPE_LABEL[t].toLowerCase()} "${item.titre}"`);
      const onDetail = ['cour', 'video', 'formation', 'atelier', 'exercice', 'article', 'post'].includes(parse().name);
      if (onDetail) go({ cours: 'cours', videos: 'videos', ateliers: 'ateliers', exercices: 'exercices', articles: 'articles', posts: 'communaute' }[t] || ''); else render();
      toast(`${TYPE_LABEL[t]} supprimé${t === 'videos' || t === 'nouveautes' ? 'e' : ''}.`, { icon: 'trash-2', undo: () => { S.data[t].splice(idx, 0, item); save('data'); audit(`a restauré "${item.titre}"`); render(); } });
    },
    progress: el => {
      const id = el.dataset.id; const cur = S.progress[id] || 0;
      S.progress[id] = cur > 0 ? 100 : 50; save('progress');
      if (S.progress[id] >= 100) {
        const kind = el.dataset.kind || 'videos';
        const f = S.data[kind].find(x => x.id === id);
        render();
        openLayer(`<div class="celebrate"><div class="result-mark">${ic('party-popper')}</div><h2>${kind === 'videos' ? 'Vidéo terminée.' : 'Cours terminé.'}</h2><p class="sub">"${esc(f ? f.titre : '')}" est dans ta poche. +10 points.</p>
          <div class="result-actions"><a class="btn btn-primary btn-block" href="#/exercices" data-action="close-nav">${ic('list-checks')}Passer à la pratique</a><a class="btn btn-quiet btn-block" href="#/${kind}" data-action="close-nav">${kind === 'videos' ? 'Vidéo suivante' : 'Cours suivant'}</a></div></div>`, 'modal', 'Terminé');
      } else { toast('C\'est parti. Ta progression est enregistrée.', { icon: 'play' }); render(); }
    },
    sort: el => { forumSort = el.dataset.v; render(); },
    corrfilter: el => { corrFilter = el.dataset.v; render(); },
    'retract-download': () => {
      if (!retractDone) return;
      const blob = new Blob([retractText(retractDone)], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `accuse-retractation-${retractDone.ref}.txt`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    unlock: el => {
      // Deux temps : on confirme avant de depenser (evite un clic malheureux)
      if (!el.dataset.armed) {
        el.dataset.armed = '1';
        const c = +el.dataset.cout;
        el.innerHTML = `Confirmer : ${plural(c, 'token', 'tokens')}`;
        setTimeout(() => { if (document.contains(el) && el.dataset.armed) { delete el.dataset.armed; el.innerHTML = `${ic('lock-open')}Débloquer`; icons(); } }, 4000);
        return;
      }
      const kind = el.dataset.kind;
      const item = S.data[kind].find(x => x.id === el.dataset.id);
      if (!item) return;
      const a = accessOf(kind, item);
      if (a.ok) { render(); return; }
      const w = wallet();
      if (w.solde < a.cout) { go('tarifs'); return; }
      w.solde -= a.cout; w.debloques.push(item.id);
      w.journal.unshift({ t: Date.now(), d: -a.cout, l: `Débloqué : ${item.titre}` });
      if (kind === 'ateliers') S.watch['at-' + item.id] = true;
      save('wallets', 'watch'); audit(`a débloqué "${item.titre}" (${a.cout} tokens)`);
      toast(`${kind === 'ateliers' ? 'Place réservée' : 'Débloqué'}. Il te reste ${plural(w.solde, 'token', 'tokens')}.`, { icon: 'lock-open' });
      render();
    },
    buy: el => {
      const p = S.settings.packs.find(x => x.id === el.dataset.id);
      if (!p || !S.user || !DEMO) return;
      const w = wallet();
      w.solde += p.credits; w.journal.unshift({ t: Date.now(), d: p.credits, l: `Pack ${p.nom} (démo)` });
      save('wallets'); audit(`a ajouté le pack ${p.nom} en démo`);
      toast(`${p.credits} tokens ajoutés. Tu en as ${w.solde}.`, { icon: 'coins' }); render();
    },
    gift: el => {
      const m = S.members.find(x => x.email === el.dataset.email);
      if (!m) return;
      openLayer(`<button type="button" class="icon-btn modal-close" data-action="close" aria-label="Fermer">${ic('x')}</button>
        <h2>Offrir des tokens</h2><p class="sub">À ${esc(m.name)}, qui en a ${wallet(m.email).solde}.</p>
        <form class="form-grid" data-form="gift" data-email="${esc(m.email)}" novalidate>
          <div class="field"><label for="gf-n">Nombre de tokens</label><input id="gf-n" name="n" class="input" type="number" min="1" step="1" required value="5"><span class="err">${ic('triangle-alert')}Indique un nombre.</span></div>
          <div class="field"><label for="gf-r">Raison <span class="muted" style="font-weight:400">(facultatif)</span></label><input id="gf-r" name="raison" class="input" placeholder="Par exemple : geste commercial"></div>
          <button class="btn btn-primary btn-block" type="submit">${ic('gift')}Offrir</button>
        </form>`, 'modal', 'Offrir des tokens');
    },
    'rsvp-at': el => { const k = 'at-' + el.dataset.id; S.watch[k] = !S.watch[k]; save('watch'); audit(`${S.watch[k] ? "s'est inscrit" : "s'est désinscrit"} à un atelier`); toast(S.watch[k] ? 'Tu es inscrit. Un rappel t\'attend la veille.' : 'Inscription annulée.', { icon: 'presentation' }); render(); },
    rendre: el => {
      const ex = S.data.exercices.find(x => x.id === el.dataset.id);
      if (!ex) return;
      if (!S.user) { authModal('signup', 'Crée ton compte pour rendre cet exercice et recevoir ta correction.'); return; }
      openLayer(`<div class="drawer-head"><h2>Rendre l'exercice</h2><button type="button" class="icon-btn" data-action="close" aria-label="Fermer">${ic('x')}</button></div>
        <p class="muted small">${esc(ex.titre)}</p>
        <form class="form-grid" data-form="rendu" data-id="${ex.id}" novalidate>
          <div class="field"><label for="rd-lien">Lien vers ton travail <span class="muted" style="font-weight:400">(facultatif)</span></label><input id="rd-lien" name="lien" class="input" type="url" placeholder="https://"><span class="help">Ton site, un document partagé, une capture...</span><span class="err">${ic('triangle-alert')}Le lien doit commencer par https://</span></div>
          <div class="field"><label for="rd-msg">Ton explication</label><textarea id="rd-msg" name="message" class="textarea" rows="6" required></textarea><span class="help">Ce que tu as fait, et l'endroit où tu as bloqué.</span><span class="err">${ic('triangle-alert')}Écris quelques mots sur ce que tu as fait.</span></div>
          <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn btn-quiet" data-action="close">Annuler</button><button class="btn btn-primary" type="submit">Rendre</button></div>
        </form>`, 'drawer', "Rendre l'exercice");
    },
    corriger: el => {
      const r = S.data.rendus.find(x => x.id === el.dataset.id);
      if (!r) return;
      openLayer(`<div class="drawer-head"><h2>Corriger</h2><button type="button" class="icon-btn" data-action="close" aria-label="Fermer">${ic('x')}</button></div>
        <div class="card-meta"><strong style="color:var(--fg)">${esc(r.nom)}</strong><span>${esc(r.exTitre)}</span><span>rendu ${ago(r.date)}</span></div>
        <div class="reply"><p style="white-space:pre-line">${esc(r.message)}</p>${r.lien ? `<a class="link-arrow" href="${esc(r.lien)}" target="_blank" rel="noopener">Ouvrir le travail ${ic('external-link')}</a>` : ''}</div>
        <form class="form-grid" data-form="correction" data-id="${r.id}" novalidate>
          <div class="field"><label for="co-retour">Ton retour</label><textarea id="co-retour" name="retour" class="textarea" rows="8" required>${esc(r.retour || '')}</textarea><span class="help">Ce qui marche, ce qui est à reprendre, et la prochaine étape.</span><span class="err">${ic('triangle-alert')}Écris ton retour avant d'envoyer.</span></div>
          <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn btn-quiet" data-action="close">Annuler</button><button class="btn btn-primary" type="submit">Envoyer la correction</button></div>
        </form>`, 'drawer', 'Corriger un exercice');
    },
    lb: el => { lbRange = el.dataset.v; render(); },
    cal: el => { calOffset += +el.dataset.v; render(); },
    cfilter: el => { contentFilter = el.dataset.v; render(); },
    waitlist: () => {
      if (S.user) { if (!S.waitlist.includes(S.user.email)) S.waitlist.push(S.user.email); save('waitlist'); audit("s'est inscrit à la liste d'attente"); toast('Tu es sur la liste. Tu seras prévenu en premier.', { icon: 'bell-ring' }); render(); return; }
      openLayer(`<button type="button" class="icon-btn modal-close" data-action="close" aria-label="Fermer">${ic('x')}</button>
        <h2>Être prévenu en premier.</h2><p class="sub">Un seul email, le jour de l'ouverture. Pas de relance.</p>
        <form class="form-grid" data-form="waitlist" novalidate>
          <div class="field"><label for="wl-email">Email</label><input id="wl-email" name="email" class="input" type="email" required autocomplete="email" inputmode="email"><span class="err">${ic('triangle-alert')}Cet email ne semble pas valide.</span></div>
          <button class="btn btn-primary btn-block btn-lg" type="submit">Me prévenir</button>
        </form>`, 'modal', 'Liste d\'attente');
    },
    demo: el => {
      const r = el.dataset.v;
      const who = { member: { name: 'Camille Roussel', email: 'camille@demo.fvia' }, admin: { name: 'Équipe FVIA', email: 'equipe@demo.fvia' }, god: { name: 'Kemy', email: 'kemy@demo.fvia' } }[r];
      withLoading(el, () => signIn({ ...who, role: r }, false), 350);
    },
    forgot: () => toast('Si ce compte existe, un lien de réinitialisation vient de partir.', { icon: 'mail' }),
    'pw-toggle': el => {
      const input = el.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      el.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      el.innerHTML = ic(show ? 'eye-off' : 'eye'); icons();
    },
    flag: el => { S.flags[el.dataset.k] = el.checked; save('flags'); audit(`a ${el.checked ? 'activé' : 'coupé'} la fonction ${el.dataset.k}`); toast(el.checked ? 'Fonction activée.' : 'Fonction coupée pour le public.', { icon: 'toggle-right' }); renderChrome(parse().name); icons(); },
    reset: el => {
      const all = el.dataset.v === 'all';
      openLayer(`<button type="button" class="icon-btn modal-close" data-action="close" aria-label="Fermer">${ic('x')}</button>
        <h2>${all ? 'Tout effacer ?' : 'Vider les contenus ?'}</h2>
        <p class="sub">${all ? 'Comptes, contenus, réglages et session : tout ce que ce navigateur a gardé sera effacé.' : 'Formations, articles, nouveautés, messages, projets et événements seront supprimés. Les comptes restent.'} Cette action ne peut pas être annulée.</p>
        <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn btn-quiet" data-action="close">Garder</button><button type="button" class="btn btn-danger" data-action="reset-confirm" data-v="${el.dataset.v}">${all ? 'Tout effacer' : 'Vider'}</button></div>`, 'modal', 'Confirmation');
    },
    'reset-confirm': el => {
      if (el.dataset.v === 'all') { store.clear(); location.hash = '#/'; location.reload(); return; }
      S.data = EMPTY_DATA(); S.progress = {}; S.votes = {}; save('data', 'progress', 'votes'); audit('a vidé tous les contenus');
      closeLayer(true); toast('Contenus vidés.', { icon: 'trash-2' }); render();
    }
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    // Fermer les menus flottants au clic exterieur
    if (!e.target.closest('#mega, [data-action="mega"]')) setMega(false);
    if (!e.target.closest('#user-menu, [data-action="usermenu"]')) setUserMenu(false);
    if (e.target.matches('[data-overlay]')) { closeLayer(); return; }
    if (e.target.closest('.mega-item, #user-menu a')) closeFloating();
    if (!el) return;
    const name = el.dataset.action;
    if (['set-role', 'watch-toggle', 'flag'].includes(name)) return; // geres par "change"
    const fn = actions[name];
    if (fn) { if (el.tagName === 'A' && name !== 'close-nav') e.preventDefault(); fn(el, e); }
  });

  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.action === 'set-role') {
      const m = S.members.find(x => x.email === el.dataset.email);
      if (m) { m.role = el.value; save('members'); audit(`a donné le rôle ${ROLE[m.role].label} à ${m.name}`); toast(`${m.name} est maintenant ${ROLE[m.role].label}.`, { icon: 'key-round' }); }
    } else if (el.dataset.action === 'watch-toggle' || el.dataset.action === 'flag') actions[el.dataset.action](el);
  });

  let searchT;
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.bind === 'q') {
      filters.q = el.value;
      clearTimeout(searchT);
      searchT = setTimeout(() => {
        const pos = el.selectionStart;
        render();
        const again = $('[data-bind="q"]');
        if (again) { again.focus({ preventScroll: true }); again.setSelectionRange(pos, pos); }
      }, 180);
    }
    if (el.id === 'cmd-q') { cmdIndex = 0; paintCmd(el.value); }
    if (el.dataset.otp !== undefined) {
      el.value = el.value.replace(/\D/g, '').slice(0, 1);
      if (el.value) { const n = $(`[data-otp="${+el.dataset.otp + 1}"]`); n && n.focus(); }
    }
    if (el.closest('.field.invalid')) validateField(el);
  });
  document.addEventListener('focusout', e => {
    const el = e.target;
    if (el.matches && el.matches('.input, .textarea') && el.value) validateField(el);
  });
  document.addEventListener('paste', e => {
    const el = e.target;
    if (el.dataset && el.dataset.otp !== undefined) {
      const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (digits.length > 1) { e.preventDefault(); $$('[data-otp]').forEach((i, n) => { i.value = digits[n] || ''; }); const last = $(`[data-otp="${Math.min(digits.length, 5)}"]`); last && last.focus(); }
    }
  });

  document.addEventListener('submit', e => {
    const form = e.target;
    const kind = form.dataset.form;
    if (!kind) return;
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form).entries());
    const btn = $('button[type="submit"]', form);
    if (kind === 'otp') {
      const code = $$('[data-otp]', form).map(i => i.value).join('');
      if (!/^\d{6}$/.test(code)) { $('#otp-err').style.display = 'block'; $('[data-otp="0"]', form).focus(); return; }
      withLoading(btn, () => signIn({ ...pendingTeam, role: 'god' }, false));
      return;
    }
    if (!validateForm(form)) return;
    if (kind === 'signup') withLoading(btn, () => signIn({ name: fd.name.trim(), email: fd.email.trim().toLowerCase(), role: 'member' }, true));
    else if (kind === 'login') withLoading(btn, () => {
      const email = fd.email.trim().toLowerCase();
      const m = S.members.find(x => x.email === email);
      signIn({ name: m ? m.name : email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), email, role: m ? m.role : 'member' }, false);
    });
    else if (kind === 'team' && !DEMO) withLoading(btn, () => {
      const f = $('#tm-pass', form).closest('.field');
      f.classList.add('invalid'); $('.err span', f).textContent = "L'accès équipe n'est pas encore ouvert sur ce site.";
    });
    else if (kind === 'team') withLoading(btn, () => {
      const email = fd.email.trim().toLowerCase();
      const m = S.members.find(x => x.email === email);
      const name = m ? m.name : email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      if (fd.founder) { pendingTeam = { name, email }; authModal('otp'); }
      else signIn({ name, email, role: 'admin' }, false);
    });
    else if (kind === 'rendu') withLoading(btn, () => {
      const ex = S.data.exercices.find(x => x.id === form.dataset.id);
      S.data.rendus.unshift({ id: uid(), exId: form.dataset.id, exTitre: ex ? ex.titre : '', email: S.user.email, nom: S.user.name, lien: (fd.lien || '').trim(), message: fd.message.trim(), date: Date.now(), statut: 'a-corriger' });
      save('data'); audit(`a rendu l'exercice "${ex ? ex.titre : ''}"`);
      closeLayer(true); toast('Exercice rendu. +5 points. Tu seras prévenu à la correction.', { icon: 'circle-check' }); render();
    }, 400);
    else if (kind === 'correction') {
      const r = S.data.rendus.find(x => x.id === form.dataset.id);
      if (!r) return;
      r.retour = fd.retour.trim(); r.statut = 'corrige'; r.corrigeLe = Date.now(); r.correcteur = S.user.name;
      save('data'); audit(`a corrigé l'exercice "${r.exTitre}" de ${r.nom}`);
      closeLayer(true); toast('Correction envoyée.', { icon: 'circle-check' }); render();
    }
    else if (kind === 'retract') withLoading(btn, () => {
      const r = { t: Date.now(), ref: 'R' + Date.now().toString(36).toUpperCase(), nom: fd.nom.trim(), email: fd.email.trim(), contrat: (fd.contrat || '').trim() };
      S.retractations.unshift(r); save('retractations');
      audit(`a demandé une rétractation (${r.ref})`);
      if (S.settings.webhook) { try { fetch(S.settings.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...r, date: new Date(r.t).toISOString(), vendeur: EDITEUR, texte: retractText(r) }) }).catch(() => {}); } catch (e) {} }
      retractDone = r; render();
    });
    else if (kind === 'gift') {
      const n = parseInt(fd.n, 10);
      if (!(n > 0)) return;
      const w = wallet(form.dataset.email);
      w.solde += n; w.journal.unshift({ t: Date.now(), d: n, l: (fd.raison || '').trim() || 'Tokens offerts' });
      save('wallets'); audit(`a offert ${n} tokens à ${form.dataset.email}`);
      closeLayer(true); toast(`${n} tokens offerts.`, { icon: 'gift' }); render();
    }
    else if (kind === 'waitlist') withLoading(btn, () => { S.waitlist.push(fd.email.trim().toLowerCase()); save('waitlist'); closeLayer(true); toast('C\'est noté. Un seul email, le jour de l\'ouverture.', { icon: 'bell-ring' }); });
    else if (kind === 'settings') {
      S.settings.annonce = (fd.annonce || '').trim(); S.settings.delai = (fd.delai || '').trim(); S.announceClosed = '';
      const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : d; };
      Object.keys(COUT_DEFAUT).forEach(k => { S.settings.cout[k] = num(fd['cout_' + k], S.settings.cout[k]); });
      S.settings.packs.forEach((p, i) => { p.nom = (fd[`pack_${i}_nom`] || p.nom).trim(); p.credits = Math.max(1, num(fd[`pack_${i}_credits`], p.credits)); p.prix = (fd[`pack_${i}_prix`] || '').trim(); });
      S.settings.bienvenue = num(fd.bienvenue, 0);
      S.settings.telephone = (fd.telephone || '').trim(); S.settings.mediateur = (fd.mediateur || '').trim(); S.settings.webhook = (fd.webhook || '').trim();
      save('settings', 'announceClosed'); audit('a modifié les réglages du site');
      toast('Réglages enregistrés.', { icon: 'settings' }); render();
    } else if (kind === 'reply') {
      const p = S.data.posts.find(x => x.id === form.dataset.id);
      if (!p) return;
      (p.replies = p.replies || []).push({ auteur: S.user.name, authorEmail: S.user.email, texte: fd.texte.trim(), date: Date.now() });
      save('data'); toast('Réponse publiée. +1 point.', { icon: 'reply' }); render();
    } else if (kind === 'create') {
      const type = form.dataset.type;
      const item = { id: uid(), date: Date.now(), auteur: S.user.name, authorEmail: S.user.email, score: 0, replies: [] };
      Object.keys(fd).forEach(k => { item[k] = String(fd[k]).trim(); });
      withLoading(btn, () => {
        S.data[type].unshift(item); save('data');
        audit(`a publié ${TYPE_LABEL[type].toLowerCase()} "${item.titre}"`);
        closeLayer(true);
        toast(SCHEMAS[type].done + (type === 'posts' ? '. +1 point.' : type === 'projets' ? '. +3 points.' : '.'), { icon: 'circle-check' });
        const dest = { cours: 'cour/' + item.id, videos: 'video/' + item.id, ateliers: 'atelier/' + item.id, exercices: 'exercice/' + item.id, articles: 'article/' + item.id, posts: 'post/' + item.id, projets: 'projets', evenements: 'evenements', nouveautes: 'nouveautes' }[type];
        go(dest);
      }, 400);
    }
  });

  // ---------- Clavier ----------
  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); if ($('.cmd', layer)) closeLayer(); else { closeFloating(); openCmd(); } return; }
    const ov = $('[data-overlay]', layer);
    if (e.key === 'Escape') {
      if (ov) { closeLayer(); return; }
      if ($('#mega').classList.contains('is-open') || $('#user-menu').classList.contains('is-open')) {
        const opener = $('#mega').classList.contains('is-open') ? $(`[data-action="mega"][data-m="${megaWhich}"]`) : $('[data-action="usermenu"]');
        closeFloating(); opener && opener.focus();
      }
    }
    if (ov && $('.cmd', ov) && ['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
      if (e.key === 'Enter') { e.preventDefault(); runCmd(cmdIndex); return; }
      e.preventDefault();
      cmdIndex = (cmdIndex + (e.key === 'ArrowDown' ? 1 : -1) + cmdCurrent.length) % Math.max(cmdCurrent.length, 1);
      $$('.cmd-item', ov).forEach((b, i) => b.setAttribute('aria-selected', String(i === cmdIndex)));
      const sel = $(`#cmd-${cmdIndex}`); sel && sel.scrollIntoView({ block: 'nearest' });
      $('#cmd-q').setAttribute('aria-activedescendant', 'cmd-' + cmdIndex);
    }
    if (ov && e.key === 'Backspace' && e.target.dataset.otp !== undefined && !e.target.value) { const p = $(`[data-otp="${+e.target.dataset.otp - 1}"]`); p && p.focus(); }
    // Piege de focus dans les couches
    if (ov && e.key === 'Tab') {
      const f = $$('button:not([disabled]), a[href], input, textarea, select', ov).filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Mega menu : ouverture au survol avec intention (evite les ouvertures accidentelles)
  document.addEventListener('mouseover', e => {
    if (!window.matchMedia('(hover: hover) and (min-width: 861px)').matches) return;
    const mb = e.target.closest('[data-action="mega"]');
    if (mb) { clearTimeout(megaTimer); megaTimer = setTimeout(() => setMega(true, mb.dataset.m), 120); }
    else if (e.target.closest('#mega')) clearTimeout(megaTimer);
    else if (e.target.closest('.nav-link, .brand, .nav-right') || !e.target.closest('#site-header')) { clearTimeout(megaTimer); if ($('#mega').classList.contains('is-open')) megaTimer = setTimeout(() => setMega(false), 180); }
  });

  // ---------- Demarrage ----------
  applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  if (S.quiz) quizStep = QUIZ.length;
  render();
  if (!window.lucide) window.addEventListener('load', icons);
})();
