// profile.js — Dedicated profile page logic (fully persistent backend updates)

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : `${window.location.protocol}//${window.location.hostname}:5000/api`;

// Security: Escape HTML to protect against Cross-Site Scripting (XSS)
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


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

    // ── State Variables ─────────────────────────────────────────────
    let currentAvatarData = ''; // Holds local image URL (resolved backend path or local state)
    const $ = (id) => document.getElementById(id);

    // ── API Fetch Helper ──────────────────────────────────────────
    async function apiFetch(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, mergedOptions);
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || 'API request failed');
            }
            return await response.json();
        } catch (err) {
            console.error(`API Error on ${endpoint}:`, err);
            throw err;
        }
    }

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

        if (currentAvatarData) {
            if ($('avatarDisplay')) {
                $('avatarDisplay').style.backgroundImage = `url(${currentAvatarData})`;
                $('avatarDisplay').textContent = '';
            }
            if ($('sidebarAvatar')) {
                $('sidebarAvatar').style.backgroundImage = `url(${currentAvatarData})`;
                $('sidebarAvatar').style.backgroundSize = 'cover';
                $('sidebarAvatar').style.backgroundPosition = 'center';
                $('sidebarAvatar').textContent = '';
            }
        } else {
            if ($('avatarDisplay')) {
                $('avatarDisplay').style.backgroundImage = '';
                $('avatarDisplay').textContent = initial;
            }
            if ($('sidebarAvatar')) {
                $('sidebarAvatar').style.backgroundImage = '';
                $('sidebarAvatar').textContent = initial;
            }
        }

        if ($('avatarName')) $('avatarName').textContent = name || 'Student';
        if ($('avatarRole')) $('avatarRole').textContent = year || 'Freshman';
        if ($('sidebarName')) $('sidebarName').textContent = name || 'Student';
        if ($('sidebarStatus')) $('sidebarStatus').textContent = year || 'Freshman';
    }

    // ── Avatar Upload and Preview ─────────────────────────────────
    const avatarDisplay = $('avatarDisplay');
    const avatarUploadTrigger = $('avatarUploadTrigger');
    const avatarUpload = $('avatarUpload');
    const avatarLightbox = $('avatarLightbox');
    const lightboxImg = $('lightboxImg');
    const lightboxClose = $('lightboxClose');

    if (avatarDisplay) {
        avatarDisplay.addEventListener('click', (e) => {
            if (currentAvatarData) {
                // Open Lightbox
                if (avatarLightbox && lightboxImg) {
                    lightboxImg.src = currentAvatarData;
                    avatarLightbox.style.display = 'flex';
                    setTimeout(() => {
                        avatarLightbox.classList.add('active');
                    }, 10);
                }
            } else {
                if (avatarUpload) avatarUpload.click();
            }
        });
    }

    // Avatar Upload Trigger Button
    if (avatarUploadTrigger && avatarUpload) {
        avatarUploadTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            avatarUpload.click();
        });
        
        avatarUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const formData = new FormData();
                formData.append('avatar', file);

                try {
                    if ($('savedBadge')) {
                        $('savedBadge').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading photo...';
                        $('savedBadge').style.display = 'inline-flex';
                    }

                    const response = await fetch(`${API_BASE_URL}/profile/avatar`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: formData
                    });

                    const data = await response.json();

                    if (response.ok && data.avatarUrl) {
                        currentAvatarData = `http://localhost:5000${data.avatarUrl}`;
                        
                        // Sync local storage user details
                        const localUser = JSON.parse(localStorage.getItem('user') || '{}');
                        localUser.avatar = data.avatarUrl;
                        localStorage.setItem('user', JSON.stringify(localUser));

                        updateLivePreview();

                        if ($('savedBadge')) {
                            $('savedBadge').innerHTML = '<i class="fa-solid fa-camera"></i> Photo uploaded!';
                            $('savedBadge').style.display = 'inline-flex';
                            setTimeout(() => $('savedBadge').style.display = 'none', 2000);
                        }
                    } else {
                        alert(data.error || 'Avatar upload failed');
                        if ($('savedBadge')) $('savedBadge').style.display = 'none';
                    }
                } catch (uploadErr) {
                    console.error('Avatar upload network error:', uploadErr);
                    alert('Avatar upload failed. Server connection error.');
                    if ($('savedBadge')) $('savedBadge').style.display = 'none';
                }
            }
        });
    }

    // Close Lightbox
    if (avatarLightbox && lightboxClose) {
        const closeLightbox = () => {
            avatarLightbox.classList.remove('active');
            setTimeout(() => {
                avatarLightbox.style.display = 'none';
            }, 300);
        };
        
        lightboxClose.addEventListener('click', closeLightbox);
        avatarLightbox.addEventListener('click', (e) => {
            if (e.target === avatarLightbox) {
                closeLightbox();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && avatarLightbox.classList.contains('active')) {
                closeLightbox();
            }
        });
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
                    ? `<i class="fa-solid fa-bullseye"></i> ${escapeHTML(goalInput.value.trim())}`
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
                    ? `<i class="fa-solid fa-university"></i> ${escapeHTML(instInput.value.trim())}`
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

    // ── Save Form Submission ──────────────────────────────────────
    const profileForm = $('profileForm');
    const saveBtn = $('saveBtn');
    const savedBadge = $('savedBadge');

    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = $('profileName')?.value.trim();
            const email = $('profileEmail')?.value.trim();
            const institution = $('profileInstitution')?.value.trim();
            const year = $('profileYear')?.value;
            const field = $('profileField')?.value.trim();
            const studentId = $('profileStudentId')?.value.trim();
            const goal = $('profileGoal')?.value.trim();
            const quote = $('profileQuote')?.value.trim();

            try {
                if (saveBtn) {
                    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
                    saveBtn.disabled = true;
                }

                const res = await apiFetch('/profile', {
                    method: 'PUT',
                    body: JSON.stringify({
                        name,
                        email,
                        institution,
                        year,
                        field,
                        studentId,
                        goal,
                        quote
                    })
                });

                if (res) {
                    const relativeAvatar = currentAvatarData ? currentAvatarData.replace('http://localhost:5000', '') : '';
                    
                    // Sync localStorage user object to sync layout sidebar
                    const existingLocal = JSON.parse(localStorage.getItem('user') || '{}');
                    const updatedLocal = {
                        ...existingLocal,
                        name,
                        email,
                        institution,
                        year,
                        status: year,
                        field,
                        studentId,
                        goal,
                        quote,
                        avatar: relativeAvatar
                    };
                    localStorage.setItem('user', JSON.stringify(updatedLocal));
                    syncLeftPanel(updatedLocal);

                    // Animate save button to checkmark
                    if (saveBtn) {
                        saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
                        saveBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                        saveBtn.style.boxShadow = '0 4px 15px rgba(16,185,129,0.4)';
                    }
                    if (savedBadge) {
                        savedBadge.innerHTML = '<i class="fa-solid fa-check"></i> Profile saved!';
                        savedBadge.style.display = 'inline-flex';
                    }
                }
            } catch (err) {
                console.error('Failed to submit profile changes:', err);
                alert(err.message || 'Failed to save changes. Please try again.');
                if (saveBtn) {
                    saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
                    saveBtn.disabled = false;
                }
            }

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
        let avatarUrl = u.avatar || '';
        
        if (avatarUrl && avatarUrl.startsWith('/uploads/')) {
            avatarUrl = `http://localhost:5000${avatarUrl}`;
        }

        if (avatarUrl) {
            if ($('avatarDisplay')) {
                $('avatarDisplay').style.backgroundImage = `url(${avatarUrl})`;
                $('avatarDisplay').textContent = '';
            }
            if ($('sidebarAvatar')) {
                $('sidebarAvatar').style.backgroundImage = `url(${avatarUrl})`;
                $('sidebarAvatar').style.backgroundSize = 'cover';
                $('sidebarAvatar').style.backgroundPosition = 'center';
                $('sidebarAvatar').textContent = '';
            }
        } else {
            if ($('avatarDisplay')) {
                $('avatarDisplay').style.backgroundImage = '';
                $('avatarDisplay').textContent = initial;
            }
            if ($('sidebarAvatar')) {
                $('sidebarAvatar').style.backgroundImage = '';
                $('sidebarAvatar').textContent = initial;
            }
        }

        if ($('avatarName')) $('avatarName').textContent = u.name || 'Student';
        if ($('avatarRole')) $('avatarRole').textContent = u.year || u.status || 'Freshman';
        if ($('sidebarName')) $('sidebarName').textContent = u.name || 'Student';
        if ($('sidebarStatus')) $('sidebarStatus').textContent = u.year || u.status || 'Freshman';

        if ($('avatarGoal')) {
            $('avatarGoal').innerHTML = u.goal
                ? `<i class="fa-solid fa-bullseye"></i> ${escapeHTML(u.goal)}`
                : `<i class="fa-solid fa-bullseye"></i> <em>No study goal set yet</em>`;
        }
        if ($('badgeInstitution')) {
            $('badgeInstitution').innerHTML = u.institution
                ? `<i class="fa-solid fa-university"></i> ${escapeHTML(u.institution)}`
                : `<i class="fa-solid fa-university"></i> —`;
        }
    }

    // ── Load Real Profile Data from Server on Startup ─────────────
    async function loadUserProfile() {
        try {
            const profile = await apiFetch('/profile');
            if (profile) {
                if (profile.avatar) {
                    currentAvatarData = profile.avatar.startsWith('/uploads/') 
                        ? `http://localhost:5000${profile.avatar}`
                        : profile.avatar;
                } else {
                    currentAvatarData = '';
                }

                // Pre-fill fields
                if ($('profileName')) $('profileName').value = profile.name || '';
                if ($('profileEmail')) $('profileEmail').value = profile.email || '';
                if ($('profileInstitution')) $('profileInstitution').value = profile.institution || '';
                if ($('profileYear')) $('profileYear').value = profile.year || 'Freshman';
                if ($('profileField')) $('profileField').value = profile.field || '';
                if ($('profileStudentId')) $('profileStudentId').value = profile.studentId || '';
                if ($('profileGoal')) $('profileGoal').value = profile.goal || '';
                if ($('profileQuote')) $('profileQuote').value = profile.quote || '';

                // Populate local storage user model for sync consistency
                const localUser = {
                    ...profile,
                    status: profile.year,
                    avatar: profile.avatar || ''
                };
                localStorage.setItem('user', JSON.stringify(localUser));

                // Re-render display preview cards
                syncLeftPanel(localUser);
                updateQuotePreview(profile.quote || '');
                updateLivePreview();
            }
        } catch (err) {
            console.error('API Profile load failed, falling back to local storage...', err);
            // Local Storage fallback
            const userJson = localStorage.getItem('user');
            const localUser = userJson ? JSON.parse(userJson) : {};
            currentAvatarData = localUser.avatar ? (localUser.avatar.startsWith('/uploads/') ? `http://localhost:5000${localUser.avatar}` : localUser.avatar) : '';
            syncLeftPanel(localUser);
            updateQuotePreview(localUser.quote || '');
            updateLivePreview();
        }
    }

    // Start profile initialization
    loadUserProfile();
});
