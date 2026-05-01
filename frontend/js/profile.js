// profile.js — Dedicated profile page logic

// Auth guard
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {

    // Sidebar Toggle Logic
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    function toggleSidebar() {
        sidebar.classList.toggle('sidebar-collapsed');
        mainContent.classList.toggle('expanded');
        sidebarToggle.classList.toggle('is-open');

        // Mobile overlay
        if (window.innerWidth <= 768) {
            sidebarOverlay.classList.toggle('active');
        }
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    // Close sidebar on mobile when window is resized
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            sidebarOverlay.classList.remove('active');
        }
    });

    // ── Theme ──────────────────────────────────────────────────────
    const themeSelector = document.getElementById('themeSelector');
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (themeSelector) themeSelector.value = savedTheme;
    if (themeSelector) {
        themeSelector.addEventListener('change', (e) => {
            document.documentElement.setAttribute('data-theme', e.target.value);
            localStorage.setItem('app-theme', e.target.value);
        });
    }

    // ── Load user data ─────────────────────────────────────────────
    const userJson = localStorage.getItem('user');
    const user = userJson ? JSON.parse(userJson) : {};

    // Helper
    const $ = (id) => document.getElementById(id);

    // Pre-fill form
    if ($('profileName')) $('profileName').value = user.name || '';
    if ($('profileEmail')) $('profileEmail').value = user.email || '';
    if ($('profileInstitution')) $('profileInstitution').value = user.institution || '';
    if ($('profileYear')) $('profileYear').value = user.year || 'Freshman';
    if ($('profileField')) $('profileField').value = user.field || '';
    if ($('profileStudentId')) $('profileStudentId').value = user.studentId || '';
    if ($('profileGoal')) $('profileGoal').value = user.goal || '';
    if ($('profileQuote')) $('profileQuote').value = user.quote || '';

    // Render left-panel preview from saved data
    syncLeftPanel(user);

    // ── Quote preview ──────────────────────────────────────────────
    const quoteCard = $('quoteCard');
    const quoteText = $('quoteText');
    const quoteInput = $('profileQuote');

    function updateQuotePreview(val) {
        if (val && val.trim()) {
            if (quoteText) quoteText.textContent = '"' + val.trim() + '"';
            if (quoteCard) quoteCard.style.display = 'block';
        } else {
            if (quoteCard) quoteCard.style.display = 'none';
        }
    }
    updateQuotePreview(user.quote || '');

    if (quoteInput) {
        quoteInput.addEventListener('input', () => updateQuotePreview(quoteInput.value));
    }

    // ── Live avatar / name preview ────────────────────────────────
    const nameInput = $('profileName');
    const yearInput = $('profileYear');

    function updateLivePreview() {
        const name = nameInput ? nameInput.value.trim() : '';
        const year = yearInput ? yearInput.value : '';
        const initial = (name || 'U').charAt(0).toUpperCase();

        if ($('avatarDisplay')) $('avatarDisplay').textContent = initial;
        if ($('avatarName')) $('avatarName').textContent = name || 'Student';
        if ($('avatarRole')) $('avatarRole').textContent = year || 'Freshman';
        if ($('sidebarAvatar')) $('sidebarAvatar').textContent = initial;
        if ($('sidebarName')) $('sidebarName').textContent = name || 'Student';
        if ($('sidebarStatus')) $('sidebarStatus').textContent = year || 'Freshman';
    }

    if (nameInput) nameInput.addEventListener('input', updateLivePreview);
    if (yearInput) yearInput.addEventListener('change', updateLivePreview);

    // Goal live preview
    const goalInput = $('profileGoal');
    if (goalInput) {
        goalInput.addEventListener('input', () => {
            const goalEl = $('avatarGoal');
            if (goalEl) {
                goalEl.innerHTML = goalInput.value.trim()
                    ? `<i class="fa-solid fa-bullseye"></i> ${goalInput.value.trim()}`
                    : `<i class="fa-solid fa-bullseye"></i> <em>No study goal set yet</em>`;
            }
        });
    }

    // Institution live preview
    const instInput = $('profileInstitution');
    if (instInput) {
        instInput.addEventListener('input', () => {
            const badge = $('badgeInstitution');
            if (badge) {
                badge.innerHTML = instInput.value.trim()
                    ? `<i class="fa-solid fa-university"></i> ${instInput.value.trim()}`
                    : `<i class="fa-solid fa-university"></i> —`;
            }
        });
    }

    // ── Load stats ─────────────────────────────────────────────────
    const cached = JSON.parse(localStorage.getItem('lastAnalytics') || '{}');
    if ($('statStreak')) $('statStreak').textContent = cached.streak ?? '—';
    if ($('statTasks')) $('statTasks').textContent = cached.tasksCompleted ?? '—';
    if ($('statAvgSession')) $('statAvgSession').textContent = cached.avgSessionMinutes ? `${cached.avgSessionMinutes}m` : '—';
    if ($('statFocus')) {
        const mins = cached.totalFocusMinutes ?? 0;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        $('statFocus').textContent = h > 0 ? `${h}h ${m}m` : (m > 0 ? `${m}m` : '—');
    }

    // ── Save form ─────────────────────────────────────────────────
    const profileForm = $('profileForm');
    const saveBtn = $('saveBtn');
    const savedBadge = $('savedBadge');

    if (profileForm) {
        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const existing = JSON.parse(localStorage.getItem('user') || '{}');
            const updated = {
                ...existing,
                name: ($('profileName')?.value.trim()) || existing.name,
                email: ($('profileEmail')?.value.trim()) || existing.email,
                institution: ($('profileInstitution')?.value.trim()) || existing.institution,
                year: $('profileYear')?.value || existing.year,
                status: $('profileYear')?.value || existing.status,
                field: ($('profileField')?.value.trim()) || existing.field,
                studentId: ($('profileStudentId')?.value.trim()) || existing.studentId,
                goal: ($('profileGoal')?.value.trim()) || existing.goal,
                quote: ($('profileQuote')?.value.trim()) || existing.quote,
            };

            localStorage.setItem('user', JSON.stringify(updated));
            syncLeftPanel(updated);

            // Animate save button → success
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
                saveBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                saveBtn.style.boxShadow = '0 4px 15px rgba(16,185,129,0.4)';
                saveBtn.disabled = true;
            }
            if (savedBadge) savedBadge.style.display = 'inline-flex';

            setTimeout(() => {
                if (saveBtn) {
                    saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
                    saveBtn.style.background = '';
                    saveBtn.style.boxShadow = '';
                    saveBtn.disabled = false;
                }
                if (savedBadge) savedBadge.style.display = 'none';
            }, 2500);
        });
    }

    // ── Logout ────────────────────────────────────────────────────
    function doLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }
    const logoutBtn = $('logoutBtn');
    const logoutBtnPage = $('logoutBtnPage');
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
    if (logoutBtnPage) logoutBtnPage.addEventListener('click', doLogout);

    // Profile button → already on profile page
    const profileBtn = $('profileBtn');
    if (profileBtn) profileBtn.addEventListener('click', () => window.location.href = 'profile.html');

    // ── Clear all local data ──────────────────────────────────────
    const clearDataBtn = $('clearDataBtn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', () => {
            if (!confirm('⚠️ This will clear all your locally stored profile data and settings. Continue?')) return;
            ['user', 'lastAnalytics', 'app-theme'].forEach(k => localStorage.removeItem(k));
            alert('Local data cleared. Redirecting to login...');
            window.location.href = 'login.html';
        });
    }

    // ── Helper: sync left panel preview ──────────────────────────
    function syncLeftPanel(u) {
        const initial = (u.name || 'U').charAt(0).toUpperCase();

        if ($('avatarDisplay')) $('avatarDisplay').textContent = initial;
        if ($('avatarName')) $('avatarName').textContent = u.name || 'Student';
        if ($('avatarRole')) $('avatarRole').textContent = u.year || u.status || 'Freshman';
        if ($('sidebarAvatar')) $('sidebarAvatar').textContent = initial;
        if ($('sidebarName')) $('sidebarName').textContent = u.name || 'Student';
        if ($('sidebarStatus')) $('sidebarStatus').textContent = u.year || u.status || 'Freshman';

        if ($('avatarGoal')) {
            $('avatarGoal').innerHTML = u.goal
                ? `<i class="fa-solid fa-bullseye"></i> ${u.goal}`
                : `<i class="fa-solid fa-bullseye"></i> <em>No study goal set yet</em>`;
        }
        if ($('badgeInstitution')) {
            $('badgeInstitution').innerHTML = u.institution
                ? `<i class="fa-solid fa-university"></i> ${u.institution}`
                : `<i class="fa-solid fa-university"></i> —`;
        }
    }
});
