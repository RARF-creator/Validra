/**
 * Validra Frontend — Main Application
 * Two-view SPA: Validator (Vision Journey) + Market Intelligence
 */
import { api } from './api.js';

/* ── State ──────────────────────────────────────────────────────────────── */
const state = {
  currentView: 'validator',
  isAnalyzing: false,
  ideas: [], ideaPage: 1, ideaTotal: 0,
  trends: null,
  autocompleteTimeout: null,
  lastResults: null,
};

const DOMAINS = [
  'Agentic AI', 'Climate Tech', 'Fintech', 'HealthTech',
  'Cybersecurity', 'EdTech', 'Logistics', 'SpaceTech', 'AgriTech', 'Retail/E-commerce'
];
const DOMAIN_ICONS = {
  'Agentic AI': '🤖', 'Climate Tech': '🌿', 'Fintech': '💳',
  'HealthTech': '🩺', 'Cybersecurity': '🔐', 'EdTech': '📚',
  'Logistics': '🚚', 'SpaceTech': '🛸', 'AgriTech': '🌾',
  'Retail/E-commerce': '🛍️'
};

/* ── Utilities ───────────────────────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function showToast(msg, type = 'default') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function scoreToPercent(score) {
  return Math.round(score * 100);
}

function riskClass(riskLevel) {
  return { HIGH_RISK: 'high', MEDIUM_RISK: 'medium', CROSS_DOMAIN_SIMILAR: 'cross', LOW_RISK: 'low' }[riskLevel] || 'low';
}

function riskLabel(riskLevel) {
  return { HIGH_RISK: '⚠ High Risk', MEDIUM_RISK: '~ Medium Risk', CROSS_DOMAIN_SIMILAR: '↗ Cross-Domain', LOW_RISK: '✓ Low Risk' }[riskLevel] || riskLevel;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n) + '…' : (str || '');
}

/* ── Navigation ──────────────────────────────────────────────────────────── */
function switchView(viewId) {
  state.currentView = viewId;
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${viewId}`).classList.add('active');
  $$('[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });
  // Lazy-load data for trends view
  if (viewId === 'trends' && !state.trends) loadTrends();
  if (viewId === 'ideas') checkVaultAuth();
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-view]');
  if (btn) { switchView(btn.dataset.view); e.preventDefault(); }
});

/* ── Server Status ───────────────────────────────────────────────────────── */
async function checkHealth() {
  try {
    await api.health();
    $('#status-dot').style.background = '#3a9a5c';
    $('#status-text').textContent = 'API Connected';
  } catch {
    $('#status-dot').style.background = '#c0392b';
    $('#status-text').textContent = 'API Offline';
    showToast('Cannot reach backend. Is npm run dev running?', 'error');
  }
}

/* ── Autocomplete ────────────────────────────────────────────────────────── */
const autocompleteInput = $('#idea-title');
const autocompleteDropdown = $('#autocomplete-dropdown');

const performAutocomplete = debounce(async (val) => {
  if (!val || val.length < 2) { autocompleteDropdown.innerHTML = ''; autocompleteDropdown.classList.remove('open'); return; }
  try {
    const domain = $('#idea-domain').value;
    const res = await api.autocomplete(val, domain);
    renderAutocomplete(res.suggestions || []);
  } catch { /* silent */ }
}, 280);

function renderAutocomplete(suggestions) {
  if (!suggestions.length) { autocompleteDropdown.innerHTML = ''; return; }
  autocompleteDropdown.innerHTML = suggestions.map(s => `
    <div class="autocomplete-item" data-title="${escHtml(s.title)}" role="option">
      <span>${escHtml(s.title)}</span>
      <span class="autocomplete-item__domain">${escHtml(s.domain || '')}</span>
    </div>
  `).join('');
}

autocompleteInput?.addEventListener('input', e => performAutocomplete(e.target.value));
autocompleteDropdown?.addEventListener('click', e => {
  const item = e.target.closest('.autocomplete-item');
  if (item) { autocompleteInput.value = item.dataset.title; autocompleteDropdown.innerHTML = ''; }
});
document.addEventListener('click', e => {
  if (!e.target.closest('.autocomplete-wrap')) autocompleteDropdown.innerHTML = '';
});

/* ── Character Counter ───────────────────────────────────────────────────── */
$('#idea-description')?.addEventListener('input', function() {
  $('#desc-count').textContent = `${this.value.length}/1000`;
  performClassification();
});
$('#idea-title')?.addEventListener('input', () => performClassification());

/* ── AI Domain classification ───────────────────────────────────────────── */
const performClassification = debounce(async () => {
  const industryInput = $('#idea-title'); // Now used for domain selection
  const desc = $('#idea-description').value.trim();
  const container = $('#domain-suggestion-container');

  if (!container || !industryInput) return;
  if (!desc || desc.length < 15) { container.innerHTML = ''; return; }

  container.innerHTML = '<div class="suggestion-loading">AI analyzing domain…</div>';

  try {
    const res = await api.classify('', desc);
    renderClassificationChips(res.suggestions || []);
  } catch {
    container.innerHTML = '';
  }
}, 800);

function renderClassificationChips(suggestions) {
  const container = $('#domain-suggestion-container');
  if (!suggestions.length) { container.innerHTML = ''; return; }

  const best = suggestions[0];
  if (best.score < 0.2) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <button type="button" class="suggestion-chip" id="suggest-chip-btn" data-domain="${escHtml(best.domain)}">
      ✨ Match: ${escHtml(best.domain)} <span>(${Math.round(best.score * 100)}% confidence)</span>
    </button>
  `;

  $('#suggest-chip-btn')?.addEventListener('click', function() {
    const industryInput = $('#idea-title');
    if (industryInput) {
      industryInput.value = this.dataset.domain;
      showToast(`Set industry to ${this.dataset.domain}`, 'success');
      this.remove();
    }
  });
}

/* ── Domain Selector Population ─────────────────────────────────────────── */
function populateDomainSelect() {
  const sel = $('#idea-domain');
  if (!sel) return;
  DOMAINS.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = `${DOMAIN_ICONS[d] || ''} ${d}`;
    sel.appendChild(opt);
  });
}

/* ── Validator Form Submit ───────────────────────────────────────────────── */
$('#validator-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (state.isAnalyzing) return;

  const description = $('#idea-description').value.trim();
  const domain      = $('#idea-title').value.trim(); // Mapping "Target Industry" to domain
  const size        = $('#company-size').value.trim();

  // Extract a title from the first line or first 50 chars of description
  const title = description.split('\n')[0].slice(0, 50);

  if (!description || !domain) { showToast('Concept and Target Industry are required.', 'error'); return; }
  if (description.length < 20) { showToast('Please provide a more detailed concept.', 'error'); return; }

  state.isAnalyzing = true;
  const submitBtn = $('#analyze-btn');
  submitBtn.disabled = true;
  const originalBtnText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="spinner"></span> Running Simulation…';

  const resultsArea = $('#results-area');
  const simulatingModule = $('#simulating-section');

  // Show simulating state (visual polish)
  simulatingModule.scrollIntoView({ behavior: 'smooth', block: 'center' });

  try {
    const data = await api.findSimilar(title, description, domain);
    state.lastResults = data;

    // Wait a bit to simulate the analysis for UX feel matching the mockup
    setTimeout(() => {
      resultsArea.style.display = 'block';
      renderResults(data, title, domain, description);
      resultsArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 1200);

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    state.isAnalyzing = false;
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }
});

function renderResults(data, title, domain, description) {
  const { verdict, similar_ideas, query } = data;

  // 1. Uniqueness Score Calculation & Animation
  const topScore = similar_ideas[0]?.similarity_score || 0;
  const uniqueness = Math.round((1 - topScore) * 100);

  const gaugeCircle = $('#gauge-fill-circle');
  const scoreValue = $('#gauge-score-value');

  if (gaugeCircle && scoreValue) {
    // Circumference = 2 * PI * R = 2 * 3.14 * 45 ≈ 283
    const offset = 283 - (uniqueness / 100) * 283;
    gaugeCircle.style.strokeDasharray = `283`;
    gaugeCircle.style.strokeDashoffset = `283`;
    // Trigger animation
    requestAnimationFrame(() => {
      gaugeCircle.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
      gaugeCircle.style.strokeDashoffset = offset;
    });

    // Counter animation
    let count = 0;
    const interval = setInterval(() => {
      if (count >= uniqueness) { scoreValue.textContent = uniqueness; clearInterval(interval); }
      else { count++; scoreValue.textContent = count; }
    }, 15);
  }

  // 2. Competitor List Rendering
  const compList = $('#competitor-list');
  const compCount = $('#competitor-count');

  if (compList) {
    compCount.textContent = `${similar_ideas.length} Platforms Found`;
    compList.innerHTML = similar_ideas.map((idea, i) => {
      const isHigh = idea.similarity_score > 0.85;
      const tag = isHigh ? 'DISRUPTED' : 'POTENTIAL';
      const tagClass = isHigh ? 'competitor-tag--disrupted' : 'competitor-tag--acquired';

      return `
        <div class="competitor-card ${isHigh ? 'high-proximity' : ''}" style="animation: fadeUp 0.3s ease ${i*0.1}s both">
          <div class="competitor-card__info">
            <h5>${escHtml(truncate(idea.title, 25))}</h5>
            <p>${escHtml(truncate(idea.description, 60))}</p>
          </div>
          <div class="competitor-tag ${tagClass}">${tag}</div>
        </div>
      `;
    }).join('') || '<p style="color:var(--on-surface-variant);font-size:0.85rem">No direct competitors found in this vector space.</p>';
  }

  // 3. Momentum Chart Mock
  const momentumBars = $$('.bar', $('#momentum-bar-chart'));
  momentumBars.forEach((bar, i) => {
    const val = [20, 35, 30, 60, 85][i] || 50;
    bar.style.height = '0%';
    setTimeout(() => {
      bar.style.height = `${val}%`;
    }, 500 + i * 100);
  });

  // 4. Action Buttons
  const resultsActions = $('#results-actions');
  if (resultsActions) {
    resultsActions.style.display = 'flex';

    const vaultBtn = $('#save-vault-btn');
    if (vaultBtn) {
      vaultBtn.disabled = false;
      vaultBtn.textContent = '🔒 Save to Private Vault';
      vaultBtn.onclick = async () => {
        // Use the description captured at render-time, not from DOM (which may be empty)
        const desc = description || $('#idea-description').value || '';
        if (!desc) { showToast('Description is empty — please re-run validation.', 'error'); return; }
        try {
          await saveToVault(title || desc.slice(0, 50), desc, domain);
          vaultBtn.disabled = true;
          vaultBtn.textContent = '✓ Vault Saved';
        } catch (err) {
          // Toast is already shown in saveToVault, just prevent the button from updating
          console.error("Vault save failed:", err);
        }
      };
    }

    const launchBtn = $('#proceed-launch-btn');
    if (launchBtn) {
      launchBtn.onclick = () => {
        // Store the idea context for the launch page
        state.launchIdea = { title, domain, description: description || $('#idea-description').value };
        switchView('launch');
        // Show idea banner on launch page
        const banner = $('#launch-idea-banner');
        if (banner) {
          banner.innerHTML = `<div class="launch-idea-chip">🎯 Launching: ${escHtml(title)} · ${escHtml(domain)}</div>`;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    }
  }
}

/* ── Save Idea (Public) ─────────────────────────────────────────────────── */
async function saveIdea(title, description, domain) {
  try {
    await api.createIdea(title, description, domain);
    showToast('Idea saved to Public Archive!', 'success');
    state.ideas = []; state.ideaTotal = 0;
  } catch (err) {
    showToast(err.message || 'Failed to save idea.', 'error');
  }
}

/* ── Save Idea (Private Vault) ──────────────────────────────────────────── */
async function saveToVault(title, description, domain) {
  const token = localStorage.getItem('validra_token');
  if (!token) {
    showToast('⚠️ You must be logged in first. Click 🔒 Vault in the nav to sign in.', 'error');
    return;
  }

  // Ensure title and description are never blank (backend requires all three)
  const safeDescription = (description || '').trim();
  const safeTitle       = (title || safeDescription.split('\n')[0]).slice(0, 60).trim() || 'Untitled Idea';

  if (!safeDescription) {
    showToast('Cannot save — description is empty. Please re-run the validation.', 'error');
    return;
  }

  // Resolve domain to a canonical value the backend accepts.
  // The user-typed "Target Industry" is free text — map it via classify API.
  const CANONICAL = [
    'Agentic AI','Climate Tech','Fintech','HealthTech',
    'Cybersecurity','EdTech','Logistics','SpaceTech','AgriTech','Retail/E-commerce'
  ];

  let resolvedDomain = CANONICAL.find(
    d => d.toLowerCase() === (domain || '').toLowerCase().trim()
  );

  if (!resolvedDomain) {
    // Try to classify the description to get a valid domain
    try {
      const cls = await api.classify(title, description);
      if (cls.suggestions && cls.suggestions.length > 0 && cls.suggestions[0].score > 0.1) {
        resolvedDomain = cls.suggestions[0].domain;
      }
    } catch (_) { /* ignore classify errors */ }
  }

  // If still no match, use best-effort fallback
  if (!resolvedDomain) resolvedDomain = 'Agentic AI';

  try {
    console.log("Saving to vault payload:", { safeTitle, safeDescription, resolvedDomain });
    await api.createPrivateIdea(token, safeTitle, safeDescription, resolvedDomain);
    showToast(`🔒 "${safeTitle}" saved to Vault under "${resolvedDomain}"!`, 'success');
  } catch (err) {
    showToast(err.message || 'Failed to save to vault.', 'error');
    throw err; // Re-throw so caller knows it failed
  }
}

/* ── Trends View ─────────────────────────────────────────────────────────── */
async function loadTrends() {
  const container = $('#trends-container');
  const insightContainer = $('#insights-container');
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><p>Loading market intelligence…</p></div>`;

  try {
    const data = await api.trends();
    state.trends = data;
    renderInsights(data);
    renderDomainCards(data.domains);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state__icon">⚠️</span><h3>Could not load trends</h3><p>${escHtml(err.message)}</p></div>`;
  }
}

function renderInsights(data) {
  $('#insights-container').innerHTML = `
    <div class="insight-cards">
      <div class="insight-card insight-card--hot">
        <div class="insight-card__emoji">🔥</div>
        <div class="insight-card__label">Hottest Domain</div>
        <div class="insight-card__value">${escHtml(data.hottest_domain || '—')}</div>
        <div class="insight-card__sub">Most startup activity</div>
      </div>
      <div class="insight-card insight-card--opp">
        <div class="insight-card__emoji">💡</div>
        <div class="insight-card__label">Opportunity Gap</div>
        <div class="insight-card__value">${escHtml(data.opportunity_domain || '—')}</div>
        <div class="insight-card__sub">Least crowded, most room</div>
      </div>
      <div class="insight-card insight-card--total">
        <div class="insight-card__emoji">📊</div>
        <div class="insight-card__label">Total Ideas</div>
        <div class="insight-card__value">${data.grand_total || 0}</div>
        <div class="insight-card__sub">Across all domains</div>
      </div>
    </div>
  `;
}

function renderDomainCards(domains) {
  const max = domains[0]?.total || 1;
  $('#trends-container').innerHTML = `
    <div class="section__header">
      <h2>Domain Intelligence</h2>
      <p>Real-time idea density and crowdedness across the 10 booming sectors.</p>
    </div>
    <div class="grid-4" id="domain-cards-grid">
      ${domains.map((d, i) => {
        const pct = Math.round((d.total / max) * 100);
        const icon = DOMAIN_ICONS[d.domain] || '📌';
        const crowd = d.percentage > 15 ? 'High' : d.percentage > 8 ? 'Medium' : 'Low';
        const crowdClass = crowd === 'High' ? 'chip--error' : crowd === 'Medium' ? 'chip--warn' : 'chip--success';
        return `
          <div class="domain-card" style="animation:fadeUp 0.35s ease ${i*0.05}s both">
            <span class="domain-card__rank">#${d.rank}</span>
            <span class="domain-card__icon">${icon}</span>
            <div class="domain-card__name">${escHtml(d.domain)}</div>
            <div class="domain-card__count">${d.total}</div>
            <div class="domain-card__sub">${d.percentage}% of total · ${d.recent_7d} this week</div>
            <div class="domain-card__bar-wrap">
              <div class="domain-card__bar" style="width:${pct}%"></div>
            </div>
            <div style="margin-top:0.75rem;display:flex;gap:0.4rem;flex-wrap:wrap;">
              <span class="chip ${crowdClass}" style="font-size:0.7rem">${crowd} Density</span>
              ${d.user_submitted ? `<span class="chip" style="font-size:0.7rem">👤 ${d.user_submitted} user</span>` : ''}
            </div>
          </div>`;
      }).join('')}
    </div>
  `;
}

/* ── Ideas Feed ──────────────────────────────────────────────────────────── */
async function loadIdeas(page = 1) {
  state.ideaPage = page;
  const container = $('#ideas-container');
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><p>Loading ideas…</p></div>`;

  try {
    const data = await api.listIdeas(page, 15);
    state.ideas = data.ideas;
    state.ideaTotal = data.total;
    renderIdeasTable(data);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state__icon">⚠️</span><h3>Failed to load</h3><p>${escHtml(err.message)}</p></div>`;
  }
}

function renderIdeasTable({ ideas, total, page, limit }) {
  const container = $('#ideas-container');
  if (!ideas.length) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state__icon">💡</span><h3>No ideas yet</h3><p>Submit your first idea using the Validator.</p></div>`;
    return;
  }

  const totalPages = Math.ceil(total / limit);
  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="ideas-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Title & Description</th>
            <th>Domain</th>
            <th>Source</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${ideas.map((idea, i) => `
            <tr>
              <td style="color:var(--on-surface-variant);font-size:0.82rem">${(page-1)*limit + i + 1}</td>
              <td>
                <span class="idea-title">${escHtml(idea.title)}</span>
                <span class="idea-desc">${escHtml(idea.description || '')}</span>
              </td>
              <td><span class="chip">${DOMAIN_ICONS[idea.domain] || ''} ${escHtml(idea.domain || '—')}</span></td>
              <td><span class="chip ${idea.source === 'user' ? 'chip--primary' : ''}">${idea.source === 'user' ? '👤 User' : idea.source === 'real-world-migration' ? '🌐 Migration' : '📦 Seed'}</span></td>
              <td style="color:var(--on-surface-variant);font-size:0.82rem;white-space:nowrap">${formatDate(idea.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="pagination" id="pagination">
      <button ${page <= 1 ? 'disabled' : ''} onclick="window.loadPage(${page - 1})">‹</button>
      ${Array.from({length: Math.min(totalPages, 7)}, (_, i) => {
        const p = i + 1;
        return `<button class="${p === page ? 'active' : ''}" onclick="window.loadPage(${p})">${p}</button>`;
      }).join('')}
      <button ${page >= totalPages ? 'disabled' : ''} onclick="window.loadPage(${page + 1})">›</button>
    </div>
    <p style="text-align:center;color:var(--on-surface-variant);font-size:0.82rem;margin-top:0.75rem">${total} total ideas</p>
  `;
}
window.loadPage = (p) => loadIdeas(p);

/* ── Vault Auth Gate Logic ──────────────────────────────────────────────── */
const vaultAuthGate = $('#vault-auth-gate');
const vaultUnlockedContent = $('#vault-unlocked-content');

function checkVaultAuth() {
  const token = localStorage.getItem('validra_token');
  if (!token) {
    vaultAuthGate.style.display = 'block';
    vaultUnlockedContent.style.display = 'none';
    return;
  }
  vaultAuthGate.style.display = 'none';
  vaultUnlockedContent.style.display = 'block';
  loadPrivateIdeas(token);
}

$('#vault-login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#vault-email').value;
  const password = $('#vault-password').value;
  const btn = $('#vault-login-btn');
  const ogText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Authenticating…';
  btn.disabled = true;
  try {
    const res = await api.login(email, password);
    localStorage.setItem('validra_token', res.token);
    localStorage.setItem('validra_user', JSON.stringify(res.user));
    showToast('Vault Unlocked', 'success');
    renderNavAuth();
    checkVaultAuth();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.innerHTML = ogText;
    btn.disabled = false;
  }
});

/* ── Auth Tab Switching ─────────────────────────────────────────────────── */
window.switchAuthTab = function(tab) {
  const loginForm = $('#vault-login-form');
  const registerForm = $('#vault-register-form');
  const loginBtn = $('#tab-login-btn');
  const registerBtn = $('#tab-register-btn');
  if (!loginForm || !registerForm) return;

  if (tab === 'login') {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    loginBtn.style.borderBottom = '2px solid var(--primary)';
    loginBtn.style.color = 'var(--primary)';
    loginBtn.style.fontWeight = '600';
    registerBtn.style.borderBottom = '2px solid transparent';
    registerBtn.style.color = 'var(--on-surface-variant)';
    registerBtn.style.fontWeight = '500';
  } else {
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
    registerBtn.style.borderBottom = '2px solid var(--primary)';
    registerBtn.style.color = 'var(--primary)';
    registerBtn.style.fontWeight = '600';
    loginBtn.style.borderBottom = '2px solid transparent';
    loginBtn.style.color = 'var(--on-surface-variant)';
    loginBtn.style.fontWeight = '500';
  }
};

/* ── Register Form Submit ───────────────────────────────────────────────── */
$('#vault-register-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#reg-name').value.trim();
  const email = $('#reg-email').value.trim();
  const password = $('#reg-password').value;
  const btn = $('#vault-register-btn');
  const ogText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Creating account…';
  btn.disabled = true;
  try {
    const res = await api.register(name, email, password);
    localStorage.setItem('validra_token', res.token);
    localStorage.setItem('validra_user', JSON.stringify(res.user));
    showToast(`Welcome, ${res.user.name}! Your Vault is ready. 🔒`, 'success');
    renderNavAuth();
    checkVaultAuth();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.innerHTML = ogText;
    btn.disabled = false;
  }
});

$('#vault-logout-btn')?.addEventListener('click', () => {
  localStorage.removeItem('validra_token');
  localStorage.removeItem('validra_user');
  showToast('Vault locked.', 'default');
  renderNavAuth();
  checkVaultAuth();
});

$('#refresh-vault')?.addEventListener('click', () => {
  const token = localStorage.getItem('validra_token');
  if (token) loadPrivateIdeas(token);
});

async function loadPrivateIdeas(token) {
  const list = $('#private-ideas-list');
  list.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><p>Decrypting vault…</p></div>`;
  try {
    const res = await api.listPrivateIdeas(token);
    const ideas = res.ideas;
    if (!ideas.length) {
      list.innerHTML = `<div class="empty-state"><span class="empty-state__icon">🔒</span><h3>Vault is Empty</h3><p>Your private ideas will appear here once you save them from the Validator.</p></div>`;
      return;
    }
    list.innerHTML = ideas.map(idea => `
      <div class="competitor-card" style="border-left-color: ${idea.patent_warning ? '#c0392b' : 'var(--primary)'}">
        <div class="competitor-card__info">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.25rem;flex-wrap:wrap;">
            <h5>${escHtml(idea.title)}</h5>
            ${idea.patent_warning ? '<span class="competitor-tag competitor-tag--disrupted">⚠️ PATENT WARNING</span>' : '<span class="competitor-tag" style="background:#e8f5ee;color:#2a6e47;">SECURE</span>'}
          </div>
          <p>${escHtml(idea.description)}</p>
          <div style="margin-top:0.5rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
            <span class="chip">${DOMAIN_ICONS[idea.domain] || ''} ${escHtml(idea.domain)}</span>
            <span class="chip" style="font-size:0.7rem;opacity:0.7">${formatDate(idea.created_at)}</span>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><span class="empty-state__icon">⚠️</span><h3>Decryption Error</h3><p>${escHtml(err.message)}</p></div>`;
    if (err.message.includes('token') || err.message.includes('auth') || err.message.includes('jwt')) {
      localStorage.removeItem('validra_token');
      checkVaultAuth();
    }
  }
}

/* ── Refresh Trends Button ───────────────────────────────────────────────── */
$('#refresh-trends')?.addEventListener('click', () => { state.trends = null; loadTrends(); });

/* ── Clear Form Button ───────────────────────────────────────────────────── */
$('#clear-form')?.addEventListener('click', () => {
  $('#validator-form').reset();
  $('#results-area').style.display = 'none';
  $('#desc-count').textContent = '0/1000';
  autocompleteDropdown.innerHTML = '';
});

/* ── HTML Escape ─────────────────────────────────────────────────────────── */
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Stats Strip ────────────────────────────────────────────────────────── */
async function loadStatsStrip() {
  try {
    const data = await api.trends();
    const total = $('#strip-total'); if (total) total.textContent = data.grand_total || '—';
    const hot   = $('#strip-hottest'); if (hot) hot.textContent = data.hottest_domain || '—';
    const opp   = $('#strip-opportunity'); if (opp) opp.textContent = data.opportunity_domain || '—';
  } catch { /* silent */ }
}

/* ── User Auth Chip ──────────────────────────────────────────────────────── */
function renderNavAuth() {
  const area  = $('#nav-auth-area');
  if (!area) return;
  const token = localStorage.getItem('validra_token');
  const user  = JSON.parse(localStorage.getItem('validra_user') || 'null');
  if (token && user) {
    const initials = user.name ? user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : '?';
    area.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <button class="user-chip" id="logout-btn">
          <div class="user-avatar">${escHtml(initials)}</div>
          ${escHtml(user.name.split(' ')[0])}
        </button>
      </div>`;
    $('#logout-btn')?.addEventListener('click', () => {
      localStorage.removeItem('validra_token');
      localStorage.removeItem('validra_user');
      showToast('Signed out.', 'default');
      renderNavAuth();
      // If on vault view, re-gate it
      if (state.currentView === 'ideas') checkVaultAuth();
    });
  } else {
    area.innerHTML = `
      <div class="nav-auth-btns">
        <a href="/auth.html" class="btn btn--ghost btn--sm">Sign In</a>
        <a href="/auth.html" class="btn btn--primary btn--sm">Register</a>
      </div>`;
  }
}

/* ── Version History ────────────────────────────────────────────────────── */
async function loadVersionHistory() {
  const container = $('#view-validator');
  if (!container) return;

  // Ensure timeline area exists
  let timelineArea = $('#version-history-area');
  if (!timelineArea) {
    timelineArea = document.createElement('div');
    timelineArea.id = 'version-history-area';
    timelineArea.className = 'timeline';
    container.appendChild(timelineArea);
  }

  try {
    const res = await api.listIdeas(1, 4); // Show latest 4
    const userIdeas = res.ideas.filter(i => i.source === 'user');

    if (!userIdeas.length) {
      timelineArea.innerHTML = '';
      return;
    }

    timelineArea.innerHTML = `
      <div class="section__header" style="margin-top: 6rem;">
        <div class="badge-label">LOGS</div>
        <h2>Version History</h2>
        <p>A persistent record of your vision evolution and market pivots.</p>
      </div>
      ${userIdeas.map((idea, i) => `
        <div class="timeline-item" style="animation: fadeUp 0.3s ease ${i*0.1}s both">
          <div class="timeline-marker"></div>
          <div class="timeline-content">
            <div class="timeline-card">
              <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;">
                <h5>V1.${userIdeas.length - i} — ${escHtml(truncate(idea.title, 35))}</h5>
                <span style="font-size:0.7rem;color:var(--on-surface-variant)">${formatDate(idea.created_at)}</span>
              </div>
              <p>${escHtml(truncate(idea.description, 120))}</p>
              <div style="margin-top:0.75rem;">
                <span class="chip chip--primary">${escHtml(idea.domain)}</span>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    `;
  } catch { /* silent */ }
}

/* ── Init ────────────────────────────────────────────────────────────────── */
async function init() {
  populateDomainSelect();
  renderNavAuth();
  await checkHealth();
  loadStatsStrip();
  loadVersionHistory();
  loadIdeas(1); // Load public ideas on validator page
  switchView('validator');
}

init();
