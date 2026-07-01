/* =============================================
   marks. — exam tracker
   ============================================= */

// ---- Auth Gate ----
const session = AUTH.requireAuth();
if (!session) throw new Error('Not authenticated');

// ---- Config ----
const TERMS = [
    { id: 'term1', name: 'Term 1', tag: 'T1', sub: 'First Term Examination' },
    { id: 'term2', name: 'Term 2', tag: 'T2', sub: 'Second Term Examination' },
];

const GRAND = [
    { id: 'gt1',   name: 'Grand Test 1', tag: 'G1', sub: 'Grand Assessment I' },
    { id: 'gt2',   name: 'Grand Test 2', tag: 'G2', sub: 'Grand Assessment II' },
];

const DEFAULT_SUBJECTS = [
    { id: 'maths',     name: 'Mathematics', max: 100, css: 'maths',     removable: false },
    { id: 'physics',   name: 'Physics',     max: 85,  css: 'physics',   removable: false },
    { id: 'chemistry', name: 'Chemistry',   max: 85,  css: 'chemistry', removable: false },
];

// ---- Grading Logic ----
function getGradeFromPct(pct) {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    if (pct >= 50) return 'D';
    return 'F';
}

function getGradeColor(grade) {
    const map = { 'A+': '#a78bfa', 'A': '#34d399', 'B': '#fbbf24', 'C': '#fb923c', 'D': '#f87171', 'F': '#ef4444' };
    return map[grade] || '#fff';
}

// ---- Dynamic subjects (per user) ----
function subjectsKey() { return `marks_subjects_${session.username}`; }

function loadSubjects() {
    const saved = localStorage.getItem(subjectsKey());
    if (saved) {
        try { return JSON.parse(saved); } catch {}
    }
    return [];
}

function saveSubjects(custom) {
    localStorage.setItem(subjectsKey(), JSON.stringify(custom));
}

function getAllSubjects() {
    return [...DEFAULT_SUBJECTS, ...loadSubjects()];
}

function getSubjectMax(subject, isSlip) {
    return isSlip ? 20 : subject.max;
}

function getMaxTotal(isSlip) {
    return getAllSubjects().reduce((a, s) => a + getSubjectMax(s, isSlip), 0);
}

// ---- Dynamic Slips (per user) ----
function slipKey() { return `marks_slips_${session.username}`; }

function loadSlips() {
    const saved = localStorage.getItem(slipKey());
    if (saved) {
        try { return JSON.parse(saved); } catch {}
    }
    return [];
}

function saveSlips(slips) {
    localStorage.setItem(slipKey(), JSON.stringify(slips));
}

function getAllExams() {
    return [...TERMS, ...GRAND, ...loadSlips()];
}

// =============================================
// Smooth Scroll Engine (lerp-based)
// =============================================
class SmoothScroll {
    constructor() {
        this.current = window.scrollY;
        this.target = window.scrollY;
        this.ease = 0.08;
        this.rafId = null;
        this.isRunning = false;

        this._onWheel = this._onWheel.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._update = this._update.bind(this);
        this._onScroll = this._onScroll.bind(this);

        this.init();
    }

    init() {
        window.addEventListener('wheel', this._onWheel, { passive: false });
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('scroll', this._onScroll, { passive: true });
        this._startLoop();
    }

    _onWheel(e) {
        e.preventDefault();
        this.target += e.deltaY * 0.8;
        this._clampTarget();
    }

    _onKeyDown(e) {
        const keys = { ArrowDown: 80, ArrowUp: -80, PageDown: 400, PageUp: -400, Home: -Infinity, End: Infinity };
        if (e.key === ' ' && e.target.tagName !== 'INPUT') {
            e.preventDefault();
            this.target += e.shiftKey ? -400 : 400;
        } else if (keys[e.key] !== undefined && e.target.tagName !== 'INPUT') {
            e.preventDefault();
            if (e.key === 'Home') this.target = 0;
            else if (e.key === 'End') this.target = this._maxScroll();
            else this.target += keys[e.key];
        }
        this._clampTarget();
    }

    _onScroll() {
        if (Math.abs(window.scrollY - this.current) > 2) {
            this.current = window.scrollY;
            this.target = window.scrollY;
        }
    }

    _clampTarget() {
        this.target = Math.max(0, Math.min(this.target, this._maxScroll()));
    }

    _maxScroll() {
        return document.documentElement.scrollHeight - window.innerHeight;
    }

    _startLoop() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._update();
    }

    _update() {
        this.current += (this.target - this.current) * this.ease;
        if (Math.abs(this.target - this.current) < 0.5) this.current = this.target;
        window.scrollTo(0, this.current);
        this.rafId = requestAnimationFrame(this._update);
    }

    destroy() {
        cancelAnimationFrame(this.rafId);
        window.removeEventListener('wheel', this._onWheel);
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('scroll', this._onScroll);
        this.isRunning = false;
    }
}

// ---- State (per-user) ----
let marks = {};
let smoother = null;
let trendChart = null;

function loadMarks() {
    try {
        const raw = localStorage.getItem(AUTH.marksKey(session.username));
        if (raw) marks = JSON.parse(raw);
    } catch {}
    const subjects = getAllSubjects();
    const allExams = getAllExams();
    allExams.forEach(e => {
        if (!marks[e.id]) marks[e.id] = {};
        subjects.forEach(s => {
            if (marks[e.id][s.id] === undefined) marks[e.id][s.id] = '';
        });
    });
}

function saveMarks() {
    localStorage.setItem(AUTH.marksKey(session.username), JSON.stringify(marks));
}

// ---- User UI ----
function setupUserUI() {
    const firstName = session.name.split(' ')[0];
    const heroName = document.getElementById('heroName');
    if (heroName) heroName.textContent = firstName;
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    if (userAvatar) userAvatar.textContent = firstName.charAt(0).toUpperCase();
    if (userName) userName.textContent = firstName;
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => AUTH.logout());
}

// ---- Subject pills ----
function buildPills() {
    const container = document.getElementById('heroPills');
    container.innerHTML = '';

    const subjects = getAllSubjects();

    subjects.forEach(s => {
        const pill = document.createElement('div');
        pill.className = `pill pill-${s.css}`;

        let html = `<span class="pill-dot" style="background:${getSubjectColor(s)}; box-shadow: 0 0 8px ${getSubjectColor(s)}44"></span>`;
        html += `${s.name} <span class="pill-dim">/ ${s.max}</span>`;

        if (s.removable) {
            html += `<button class="pill-remove" data-id="${s.id}" title="Remove ${s.name}">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>`;
        }

        pill.innerHTML = html;
        container.appendChild(pill);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'pill-add';
    addBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Subject`;
    addBtn.addEventListener('click', openModal);
    container.appendChild(addBtn);

    container.querySelectorAll('.pill-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeSubject(btn.dataset.id);
        });
    });
}

function getSubjectColor(s) {
    const colors = {
        maths: '#a78bfa', physics: '#34d399', chemistry: '#fb923c',
    };
    return colors[s.id] || s.color || '#a78bfa';
}

// ---- Helpers ----
function examTotal(examId, isSlip) {
    let sum = 0, count = 0;
    getAllSubjects().forEach(s => {
        const v = marks[examId][s.id];
        if (v !== '' && v !== undefined) { sum += Number(v) || 0; count++; }
    });
    return { sum, count };
}

function animateValueHTML(el, endVal, suffix, onTick) {
    const startVal = parseFloat(el.dataset.val) || 0;
    if (startVal === endVal) {
        if (onTick) onTick(endVal.toFixed(1) + suffix);
        return;
    }
    const startTime = performance.now();
    const duration = 400;
    
    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = startVal + (endVal - startVal) * eased;
        
        el.dataset.val = current;
        if (onTick) onTick(current.toFixed(1) + suffix);
        
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ---- Build Cards ----
function renderExamCards(examList, containerId, isSlip) {
    const grid = document.getElementById(containerId);
    grid.innerHTML = '';
    const subjects = getAllSubjects();
    const maxTotal = getMaxTotal(isSlip);

    examList.forEach((exam, i) => {
        const { sum, count } = examTotal(exam.id, isSlip);
        const pct = count > 0 ? ((sum / maxTotal) * 100).toFixed(1) : null;
        const grade = pct ? getGradeFromPct(pct) : '';
        const gradeColor = getGradeColor(grade);

        const card = document.createElement('div');
        card.className = 'exam-card';
        card.dataset.exam = exam.id;
        card.dataset.isslip = isSlip;
        card.style.transitionDelay = `${i * 80}ms`;

        card.innerHTML = `
            <div class="card-accent"></div>
            <div class="card-inner">
                <div class="card-top">
                    <div class="card-label">
                        <span class="card-tag">${exam.tag}</span>
                        <div>
                            <div class="card-name">${exam.name}</div>
                            <div class="card-sub">${exam.sub}</div>
                        </div>
                    </div>
                    ${isSlip ? `
                        <button class="week-remove" data-id="${exam.id}" title="Remove week">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    ` : `
                        <div class="card-pct ${pct === null ? 'empty' : ''}" id="pct-${exam.id}" data-val="${pct || 0}">
                            <span class="pct-val" id="pct-val-${exam.id}">${pct !== null ? pct + '%' : '—'}</span>
                            <span class="grade-badge" id="grade-${exam.id}" style="color:${gradeColor}; border-color:${gradeColor}40">${grade}</span>
                        </div>
                    `}
                </div>
                <div class="card-progress">
                    <div class="card-bar" id="bar-${exam.id}" style="width:${pct ?? 0}%"></div>
                </div>
                <div class="card-subjects">
                    ${subjects.map(s => {
                        const sMax = getSubjectMax(s, isSlip);
                        return `
                        <div class="subject-row ${s.removable ? 'custom' : s.css}">
                            <div class="subject-bar" ${s.removable ? `style="background:${s.color || '#a78bfa'}"` : ''}></div>
                            <div class="subject-details">
                                <div class="subject-title">${s.name}</div>
                                <div class="subject-cap">max ${sMax}</div>
                            </div>
                            <input type="number" class="mark-field" id="f-${exam.id}-${s.id}"
                                placeholder="—" min="0" max="${sMax}"
                                value="${marks[exam.id]?.[s.id] ?? ''}"
                                data-exam="${exam.id}" data-sub="${s.id}" data-max="${sMax}" data-isslip="${isSlip}"
                                autocomplete="off"
                            >
                        </div>
                    `}).join('')}
                    <div class="total-row">
                        <div class="total-left">
                            <div class="total-icon">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"/>
                                    <line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                            </div>
                            Total
                        </div>
                        <div class="total-right" id="tot-${exam.id}">
                            ${count > 0 ? `${sum} <span class="dim">/ ${maxTotal}</span>` : `<span class="dim">— / ${maxTotal}</span>`}
                        </div>
                    </div>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });

    grid.querySelectorAll('.mark-field').forEach(f => {
        f.addEventListener('input', onInput);
        f.addEventListener('blur', onBlur);
        f.addEventListener('keydown', onKeyNav);
    });

    grid.querySelectorAll('.week-remove').forEach(btn => {
        btn.addEventListener('click', () => removeSlipWeek(btn.dataset.id));
    });
}

function buildAllCards() {
    renderExamCards(TERMS, 'termsGrid', false);
    renderExamCards(GRAND, 'grandGrid', false);

    const slips = loadSlips();
    const slipEmpty = document.getElementById('slipEmpty');
    const slipGrid = document.getElementById('slipGrid');

    if (slips.length === 0) {
        slipGrid.innerHTML = '';
        slipEmpty.classList.add('show');
    } else {
        slipEmpty.classList.remove('show');
        renderExamCards(slips, 'slipGrid', true);
    }
}

// ---- Add / Remove subjects & slips ----
function addSubject(name, max) {
    const custom = loadSubjects();
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const all = getAllSubjects();
    if (all.find(s => s.id === id || s.name.toLowerCase() === name.toLowerCase())) {
        return { ok: false, error: 'Subject already exists.' };
    }

    const palette = ['#f472b6', '#818cf8', '#fbbf24', '#34d399', '#fb923c', '#a78bfa', '#60a5fa', '#f87171'];
    const color = palette[custom.length % palette.length];

    custom.push({ id, name, max: Number(max), css: 'custom', removable: true, color });
    saveSubjects(custom);

    getAllExams().forEach(e => {
        if (!marks[e.id]) marks[e.id] = {};
        marks[e.id][id] = '';
    });
    saveMarks();

    rebuildAll();
    return { ok: true };
}

function removeSubject(subjectId) {
    let custom = loadSubjects();
    custom = custom.filter(s => s.id !== subjectId);
    saveSubjects(custom);

    getAllExams().forEach(e => { delete marks[e.id][subjectId]; });
    saveMarks();

    rebuildAll();
}

function addSlipWeek() {
    const slips = loadSlips();
    const count = slips.length + 1;
    const id = `slip_w${Date.now()}`;
    slips.push({ id, name: `Week ${count}`, tag: `W${count}`, sub: 'Weekly Slip Test' });
    saveSlips(slips);

    if (!marks[id]) marks[id] = {};
    getAllSubjects().forEach(s => {
        if (marks[id][s.id] === undefined) marks[id][s.id] = '';
    });
    saveMarks();
    rebuildAll();
}

function removeSlipWeek(id) {
    if (!confirm('Remove this week?')) return;
    let slips = loadSlips();
    slips = slips.filter(s => s.id !== id);
    slips.forEach((s, i) => {
        s.name = `Week ${i + 1}`;
        s.tag = `W${i + 1}`;
    });
    saveSlips(slips);
    delete marks[id];
    saveMarks();
    rebuildAll();
}

function rebuildAll() {
    loadMarks();
    buildPills();
    buildAllCards();
    buildSummary();
    refreshOverall();
    setupReveal();
    updateChart();
}

// ---- Modal ----
function openModal() {
    document.getElementById('modalOverlay').classList.add('open');
    document.getElementById('subjectNameInput').value = '';
    document.getElementById('subjectMaxInput').value = '100';
    document.getElementById('modalError').classList.remove('show');
    setTimeout(() => document.getElementById('subjectNameInput').focus(), 100);
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
}

function setupModal() {
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });

    document.getElementById('addSubjectForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('subjectNameInput').value.trim();
        const max = document.getElementById('subjectMaxInput').value.trim();
        const errEl = document.getElementById('modalError');

        if (!name || name.length < 2) {
            errEl.textContent = 'Name must be at least 2 characters.';
            errEl.classList.add('show');
            return;
        }
        if (!max || Number(max) < 1) {
            errEl.textContent = 'Max marks must be at least 1.';
            errEl.classList.add('show');
            return;
        }

        const result = addSubject(name, max);
        if (!result.ok) {
            errEl.textContent = result.error;
            errEl.classList.add('show');
            return;
        }

        closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// ---- Tabs ----
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const targetId = `tab${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`;
            document.getElementById(targetId).classList.add('active');
            setupReveal(); 
        });
    });

    document.getElementById('addWeekBtn').addEventListener('click', addSlipWeek);
}

// ---- Input Handling ----
function onInput(e) {
    const f = e.target;
    const { exam, sub, max: maxStr, isslip } = f.dataset;
    const max = Number(maxStr);
    f.classList.remove('shake');

    if (f.value.trim() === '') {
        marks[exam][sub] = '';
    } else {
        let n = parseInt(f.value, 10);
        if (isNaN(n) || n < 0) return;
        if (n > max) {
            n = max; f.value = max;
            f.classList.add('shake');
            setTimeout(() => f.classList.remove('shake'), 400);
        }
        marks[exam][sub] = n;
    }

    saveMarks();
    refreshCard(exam, isslip === 'true');
    refreshSummary();
    refreshOverall();
    updateChart();
}

function onBlur(e) {
    const f = e.target;
    const { exam, sub, max: maxStr, isslip } = f.dataset;
    const max = Number(maxStr);
    f.classList.remove('shake');

    if (f.value.trim() !== '') {
        let n = parseInt(f.value, 10);
        if (isNaN(n) || n < 0) n = 0;
        if (n > max) n = max;
        marks[exam][sub] = n;
        f.value = n;
    } else {
        marks[exam][sub] = '';
    }

    saveMarks();
    refreshCard(exam, isslip === 'true');
    refreshSummary();
    refreshOverall();
    updateChart();
}

function onKeyNav(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const activeTab = document.querySelector('.tab-content.active');
        const fields = [...activeTab.querySelectorAll('.mark-field')];
        const idx = fields.indexOf(e.target);
        if (idx < fields.length - 1) fields[idx + 1].focus();
    }
}

// ---- Refresh ----
function refreshCard(examId, isSlip) {
    const maxTotal = getMaxTotal(isSlip);
    const { sum, count } = examTotal(examId, isSlip);
    const pct = count > 0 ? ((sum / maxTotal) * 100).toFixed(1) : null;

    const pctEl = document.getElementById(`pct-${examId}`);
    if (pctEl) {
        if (pct !== null) {
            const finalGrade = getGradeFromPct(pct);
            animateValueHTML(pctEl, parseFloat(pct), '%', (val) => {
                document.getElementById(`pct-val-${examId}`).textContent = val;
            });
            const gradeBadge = document.getElementById(`grade-${examId}`);
            gradeBadge.textContent = finalGrade;
            gradeBadge.style.color = getGradeColor(finalGrade);
            gradeBadge.style.borderColor = getGradeColor(finalGrade) + '40';
            pctEl.classList.remove('empty');
        } else {
            document.getElementById(`pct-val-${examId}`).textContent = '—';
            pctEl.classList.add('empty');
        }
    }

    document.getElementById(`bar-${examId}`).style.width = (pct ?? 0) + '%';

    const totEl = document.getElementById(`tot-${examId}`);
    totEl.innerHTML = count > 0
        ? `${sum} <span class="dim">/ ${maxTotal}</span>`
        : `<span class="dim">— / ${maxTotal}</span>`;
}

function refreshOverall() {
    let totalM = 0, totalMax = 0;
    const subjects = getAllSubjects();
    const allExams = getAllExams();

    allExams.forEach(e => {
        const isSlip = e.id.startsWith('slip_');
        subjects.forEach(s => {
            const v = marks[e.id]?.[s.id];
            if (v !== '' && v !== undefined) {
                totalM += Number(v) || 0;
                totalMax += getSubjectMax(s, isSlip);
            }
        });
    });
    
    const el = document.getElementById('overallAvg');
    if (totalMax > 0) {
        const pct = (totalM / totalMax) * 100;
        animateValueHTML(el, pct, '%', (val) => {
            el.innerHTML = `${val} <span style="color:${getGradeColor(getGradeFromPct(pct))};font-weight:800;margin-left:4px">${getGradeFromPct(pct)}</span>`;
        });
    } else {
        el.textContent = '—';
        el.dataset.val = '0';
    }
    
    updateGoal(totalM, totalMax);
}

// ---- Summary ----
function buildSummary() {
    const grid = document.getElementById('summaryGrid');
    grid.innerHTML = '';
    const subjects = getAllSubjects();

    subjects.forEach((s, i) => {
        const card = document.createElement('div');
        card.className = `summary-card ${s.removable ? 'custom' : s.css}`;
        card.id = `sc-${s.id}`;
        card.style.transitionDelay = `${i * 80}ms`;

        const dotColor = getSubjectColor(s);

        card.innerHTML = `
            <div class="summary-card-top">
                <div class="s-dot" style="background:${dotColor}; box-shadow: 0 0 8px ${dotColor}44"></div>
                <div class="s-title">${s.name}</div>
            </div>
            <div class="s-rows" id="sr-${s.id}"></div>
        `;
        grid.appendChild(card);
    });

    refreshSummary();
}

function refreshSummary() {
    const subjects = getAllSubjects();
    const allExams = getAllExams();

    subjects.forEach(s => {
        const container = document.getElementById(`sr-${s.id}`);
        if (!container) return;

        let html = '', totalM = 0, cnt = 0;
        let sTotalMax = 0;

        allExams.forEach(e => {
            const isSlip = e.id.startsWith('slip_');
            const v = marks[e.id]?.[s.id];
            const maxForThis = getSubjectMax(s, isSlip);

            const display = (v !== '' && v !== undefined) ? v : '—';
            if (v !== '' && v !== undefined) {
                totalM += Number(v);
                cnt++;
                sTotalMax += maxForThis;
            }

            html += `<div class="s-row">
                <span class="s-row-label">${e.name}</span>
                <span class="s-row-value">${display} <span class="dim">/ ${maxForThis}</span></span>
            </div>`;
        });

        const avgPctNum = cnt > 0 ? (totalM / sTotalMax) * 100 : null;
        const avgPct = avgPctNum !== null ? avgPctNum.toFixed(1) + '%' : '';
        const gradeBadge = avgPctNum !== null ? `<span style="color:${getGradeColor(getGradeFromPct(avgPctNum))}">${getGradeFromPct(avgPctNum)}</span>` : '';

        html += `<div class="s-divider"></div>`;
        html += `<div class="s-avg-row">
            <span class="s-avg-label">Average</span>
            <span class="s-avg-value">${avgPct !== '' ? avgPct + ' ' + gradeBadge : '—'}</span>
        </div>`;

        container.innerHTML = html;
    });
}

// ---- Reset ----
function handleReset() {
    if (!confirm('Clear all marks? This cannot be undone.')) return;
    const subjects = getAllSubjects();
    getAllExams().forEach(e => subjects.forEach(s => { marks[e.id][s.id] = ''; }));
    saveMarks();
    document.querySelectorAll('.mark-field').forEach(f => { f.value = ''; f.classList.remove('shake'); });
    getAllExams().forEach(e => refreshCard(e.id, e.id.startsWith('slip_')));
    refreshSummary();
    refreshOverall();
    updateChart();
}

// ---- Goal Tracker ----
function initGoal() {
    const input = document.getElementById('goalInput');
    const saved = localStorage.getItem(`marks_goal_${session.username}`);
    if (saved) input.value = saved;

    input.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 0) val = 0;
        if (val > 100) val = 100;
        localStorage.setItem(`marks_goal_${session.username}`, val);
        refreshOverall();
    });
}

function updateGoal(currentScored, currentMaxAttempted) {
    const goalVal = parseInt(document.getElementById('goalInput').value, 10);
    const statusEl = document.getElementById('goalStatus');
    
    if (isNaN(goalVal) || goalVal <= 0) {
        statusEl.textContent = 'Enter goal to track';
        statusEl.style.color = 'var(--text-3)';
        return;
    }

    // calculate total possible max marks if user took all exams fully
    const subjects = getAllSubjects();
    const allExams = getAllExams();
    let absoluteTotalMax = 0;
    
    allExams.forEach(e => {
        const isSlip = e.id.startsWith('slip_');
        subjects.forEach(s => { absoluteTotalMax += getSubjectMax(s, isSlip); });
    });

    const targetScore = (goalVal / 100) * absoluteTotalMax;
    const marksNeeded = targetScore - currentScored;
    const marksRemaining = absoluteTotalMax - currentMaxAttempted;

    if (marksNeeded <= 0) {
        statusEl.textContent = 'Goal achieved! 🎉';
        statusEl.style.color = 'var(--green-start)';
    } else if (marksNeeded > marksRemaining) {
        statusEl.textContent = `Impossible (${marksNeeded.toFixed(0)} needed, ${marksRemaining} left)`;
        statusEl.style.color = '#ff6b6b';
    } else {
        const neededPct = (marksNeeded / marksRemaining) * 100;
        statusEl.textContent = `Need ${neededPct.toFixed(1)}% on remaining exams`;
        statusEl.style.color = 'var(--orange-warm)';
    }
}

// ---- Chart.js Trend Graph ----
function initChart() {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    Chart.defaults.color = 'rgba(255, 255, 255, 0.5)';
    Chart.defaults.font.family = "'Outfit', sans-serif";

    trendChart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
                tooltip: { backgroundColor: 'rgba(20,10,50,0.9)', titleColor: '#fff', padding: 12, cornerRadius: 12 }
            },
            scales: {
                y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            },
            tension: 0.4
        }
    });
}

function updateChart() {
    if (!trendChart) return;
    const allExams = getAllExams();
    const subjects = getAllSubjects();
    
    // Labels
    trendChart.data.labels = allExams.map(e => e.tag);

    // Dataset: Overall Average
    const overallData = allExams.map(e => {
        const isSlip = e.id.startsWith('slip_');
        const { sum, count } = examTotal(e.id, isSlip);
        const maxTotal = getMaxTotal(isSlip);
        return count > 0 ? (sum / maxTotal) * 100 : null;
    });

    const datasets = [{
        label: 'Overall Average',
        data: overallData,
        borderColor: '#43e97b',
        backgroundColor: '#43e97b',
        borderWidth: 3,
        spanGaps: true
    }];

    // Dataset for each subject
    subjects.forEach(s => {
        const sData = allExams.map(e => {
            const isSlip = e.id.startsWith('slip_');
            const v = marks[e.id]?.[s.id];
            return (v !== '' && v !== undefined) ? (Number(v) / getSubjectMax(s, isSlip)) * 100 : null;
        });
        
        const color = getSubjectColor(s);
        datasets.push({
            label: s.name,
            data: sData,
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2,
            borderDash: [5, 5],
            hidden: true, // hidden by default to keep it clean
            spanGaps: true
        });
    });

    trendChart.data.datasets = datasets;
    
    // update colors based on theme
    const isLight = document.body.getAttribute('data-theme') === 'light';
    trendChart.options.scales.y.grid.color = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    Chart.defaults.color = isLight ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)';
    
    trendChart.update();
}

// ---- Theme Toggle ----
function initTheme() {
    const btn = document.getElementById('themeToggleBtn');
    const saved = localStorage.getItem('marks_theme') || 'dark';
    document.body.setAttribute('data-theme', saved);
    
    btn.addEventListener('click', () => {
        const current = document.body.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', next);
        localStorage.setItem('marks_theme', next);
        updateChart(); // refresh grid colors
    });
}

// ---- Export to PDF ----
function initExport() {
    const btn = document.getElementById('exportBtn');
    btn.addEventListener('click', () => {
        const originalText = btn.innerHTML;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
        
        // Hide UI elements we don't want in screenshot
        document.getElementById('topbar').style.visibility = 'hidden';
        document.querySelectorAll('.mark-field').forEach(el => el.style.border = 'none');
        
        html2canvas(document.body, {
            backgroundColor: document.body.getAttribute('data-theme') === 'light' ? '#f3f4f6' : '#1a0a3e',
            scale: 2
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            
            // Generate PDF
            const { jsPDF } = window.jspdf;
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = canvas.height * imgWidth / canvas.width;
            
            const doc = new jsPDF('p', 'mm', 'a4');
            let position = 0;
            
            doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            
            let heightLeft = imgHeight - pageHeight;
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                doc.addPage();
                doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            
            doc.save(`exam-report-${session.username}.pdf`);
            
            // Restore UI
            document.getElementById('topbar').style.visibility = 'visible';
            document.querySelectorAll('.mark-field').forEach(el => el.style.border = '');
            btn.innerHTML = originalText;
        });
    });
}

// ---- Scroll Reveal ----
function setupReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.05, rootMargin: '0px 0px -60px 0px' });

    document.querySelectorAll('.tab-content.active .exam-card:not(.visible), .summary-card:not(.visible), .summary-section.reveal:not(.visible)').forEach(el => {
        observer.observe(el);
    });
}

// ---- Nav scroll ----
function setupNavScroll() {
    const nav = document.getElementById('topbar');
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                nav.classList.toggle('scrolled', window.scrollY > 20);
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
}

// ---- Page load ----
function pageEntrance() {
    document.body.classList.add('loaded');
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    setupUserUI();
    initTheme();
    loadMarks();
    buildPills();
    buildAllCards();
    buildSummary();
    
    initGoal();
    refreshOverall();
    
    initChart();
    updateChart();
    
    setupReveal();
    setupNavScroll();
    setupModal();
    setupTabs();
    initExport();
    
    document.getElementById('resetAllBtn').addEventListener('click', handleReset);

    smoother = new SmoothScroll();
    requestAnimationFrame(() => requestAnimationFrame(() => pageEntrance()));
});
