const API_BASE_URL = 'http://localhost:5000/api';

// Check Authentication on Page Load
const token = localStorage.getItem('token');
if (!token && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    // Populate User Info from localStorage
    const userJson = localStorage.getItem('user');
    if (userJson) {
        const user = JSON.parse(userJson);
        const nameElements = document.querySelectorAll('.name, .highlight');
        nameElements.forEach(el => el.textContent = user.name);
        const statusElement = document.querySelector('.status');
        if (statusElement) statusElement.textContent = user.status;
    }

    // API Helper Function
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
                // Token expired or invalid
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            return await response.json();
        } catch (err) {
            console.error('API Error:', err);
            throw err;
        }
    }

    // Logout Functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });
    }

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

    // --- Global Refresh ---

    async function refreshAllData() {
        await Promise.all([
            loadDashboardData(),
            loadTasksPage(),
            loadPlannerData(),
            loadAnalyticsData()
        ]);
    }

    // --- Data Rendering Functions ---

    async function loadDashboardData() {
        try {
            const [tasks, habits, overview, todaySessions] = await Promise.all([
                apiFetch('/tasks'),
                apiFetch('/habits'),
                apiFetch('/analytics/overview'),
                apiFetch('/focus/today')
            ]);

            if (Array.isArray(tasks)) {
                const pendingTasks = tasks.filter(t => t.status !== 'Completed');
                renderDashboardTasks(pendingTasks.slice(0, 3));

                // Check for high priority or today tasks
                const today = new Date().toISOString().split('T')[0];
                pendingTasks.forEach(task => {
                    if (task.priority === 'High' || task.due_date === today) {
                        addNotification('Task Reminder', `Don't forget: "${task.title}" is due.`, 'task');
                    }
                });
            }

            if (Array.isArray(habits)) {
                renderDashboardHabits(habits);
            } else if (habits && habits.error) {
                const container = document.getElementById('dashboardHabitList');
                if (container) container.innerHTML = `<p style="color:var(--danger); font-size:0.8rem; text-align:center;">Error: ${habits.error}</p>`;
            }

            if (overview) {
                updateStatsUI(overview);
                runSmartAlerts(tasks, habits, overview);
            }

            // Burnout is based on TODAY's focus only — not all-time
            const todayFocusMinutes = (todaySessions || [])
                .filter(s => s.type === 'Focus')
                .reduce((sum, s) => sum + (Number(s.duration) || 0), 0);

            calculateBurnout(todayFocusMinutes);
            updateKnowledgeTree(overview.totalFocusMinutes || 0);

        } catch (err) {
            console.error('Failed to load dashboard data');
        }
    }

    function updateStatsUI(data) {
        const streak = data.streak ?? 0;
        const minutes = data.totalFocusMinutes ?? 0;
        const tasks = data.tasksCompleted ?? 0;

        const streakEl = document.getElementById('dashStreakValue');
        const focusEl = document.getElementById('dashFocusValue');
        const tasksEl = document.getElementById('dashTasksValue');

        if (streakEl) streakEl.textContent = `${streak} Days`;

        if (focusEl) {
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            focusEl.innerHTML = `${h}h ${m}m <span class="trend up"><i class="fa-solid fa-arrow-trend-up"></i> +${h}h</span>`;
        }

        if (tasksEl) tasksEl.innerHTML = `${tasks} <span class="trend text-muted">Total</span>`;
    }

    function calculateBurnout(minutes) {
        minutes = minutes ?? 0;
        const valEl = document.getElementById('burnoutValue');
        const actionEl = document.getElementById('burnoutAction');
        if (!valEl || !actionEl) return;

        let level = 'Low';
        let action = 'Keep going';
        let colorClass = '';

        if (minutes > 300) {
            level = 'High'; action = 'Urgent break needed!'; colorClass = 'danger';
        } else if (minutes > 120) {
            level = 'Medium'; action = 'Take a breather'; colorClass = 'warning';
        }

        valEl.className = `value ${colorClass}`;
        // Rebuild inner content cleanly
        valEl.innerHTML = `${level} <span class="trend" id="burnoutAction">${action}</span>`;
    }

    async function loadTasksPage() {
        try {
            const tasks = await apiFetch('/tasks');
            if (tasks) {
                renderKanban(tasks);
                updateKanbanCounters(tasks);
            }
        } catch (err) {
            console.error('Failed to load tasks');
        }
    }

    function updateKanbanCounters(tasks) {
        const todo = tasks.filter(t => t.status === 'To Do').length;
        const progress = tasks.filter(t => t.status === 'In Progress').length;
        const done = tasks.filter(t => t.status === 'Completed').length;

        document.getElementById('todoCount').textContent = todo;
        document.getElementById('inprogressCount').textContent = progress;
        document.getElementById('completedCount').textContent = done;
    }

    function renderDashboardTasks(tasks) {
        const container = document.getElementById('dashboardTaskList');
        if (!container) return;

        container.innerHTML = tasks.length ? '' : '<p class="text-muted">No upcoming tasks</p>';
        tasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'schedule-item';
            const priorityClass = task.priority.toLowerCase() === 'high' ? 'high-priority' :
                task.priority.toLowerCase() === 'medium' ? 'med-priority' : 'low-priority';

            item.innerHTML = `
                <div class="time">${task.scheduled_time || '--:--'}</div>
                <div class="details">
                    <h4>${task.title}</h4>
                    <span class="tag ${priorityClass}">${task.priority}</span>
                </div>
            `;
            container.appendChild(item);
        });
    }

    function renderDashboardHabits(habits) {
        const container = document.getElementById('dashboardHabitList');
        if (!container) return;

        container.innerHTML = '';

        if (!habits || !Array.isArray(habits) || habits.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding: 1.5rem 0; color: var(--text-muted);">
                    <i class="fa-regular fa-calendar-check" style="font-size: 1.5rem; margin-bottom: 0.5rem; display:block;"></i>
                    <p style="font-size: 0.85rem;">No habits yet. Click <strong>+</strong> to add one!</p>
                </div>`;
            return;
        }

        const completedCount = habits.filter(h => h.completedToday).length;

        // Progress header
        const header = document.createElement('div');
        header.className = 'habits-progress-header';
        const pct = habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0;
        header.innerHTML = `
            <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">
                ${completedCount}/${habits.length} done today
            </span>
            <div class="habit-progress-bar">
                <div class="habit-progress-fill" style="width: ${pct}%"></div>
            </div>
        `;
        container.appendChild(header);

        habits.forEach(habit => {
            const item = document.createElement('label');
            item.className = `habit-item ${habit.completedToday ? 'completed' : ''}`;
            item.dataset.id = habit.id;
            item.draggable = true;
            item.innerHTML = `
                <span class="drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>
                <input type="checkbox" ${habit.completedToday ? 'checked' : ''} data-id="${habit.id}">
                <span class="habit-text">${habit.title}</span>
                <span class="habit-freq">${habit.frequency || 'Daily'}</span>
                <button class="habit-delete-btn" title="Delete habit" data-id="${habit.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;

            // Toggle on checkbox change
            item.querySelector('input').addEventListener('change', async (e) => {
                try {
                    const res = await apiFetch(`/habits/${habit.id}/toggle`, { method: 'POST' });
                    if (res) {
                        item.classList.toggle('completed', res.completed);
                        const updated = await apiFetch('/habits');
                        if (updated) renderDashboardHabits(updated);
                    }
                } catch (err) {
                    console.error('Failed to toggle habit');
                    e.target.checked = !e.target.checked;
                }
            });

            // Delete button
            item.querySelector('.habit-delete-btn').addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!confirm(`Delete "${habit.title}"?`)) return;
                try {
                    await apiFetch(`/habits/${habit.id}`, { method: 'DELETE' });
                    const updated = await apiFetch('/habits');
                    if (updated) renderDashboardHabits(updated);
                } catch (err) {
                    console.error('Failed to delete habit');
                }
            });

            // --- Drag-to-reorder for habits ---
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', habit.id);
                item.classList.add('dragging');
                setTimeout(() => item.classList.add('drag-ghost'), 0);
            });
            item.addEventListener('dragend', async () => {
                item.classList.remove('dragging', 'drag-ghost');
                container.querySelectorAll('.habit-item').forEach(h => h.classList.remove('drag-over'));

                // Collect new order from DOM and save to DB
                const orderedIds = [...container.querySelectorAll('.habit-item[data-id]')]
                    .map(el => el.dataset.id);
                if (orderedIds.length > 0) {
                    try {
                        await apiFetch('/habits/reorder', {
                            method: 'PUT',
                            body: JSON.stringify({ orderedIds })
                        });
                    } catch (err) {
                        console.error('Failed to save habit order');
                    }
                }
            });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const dragging = container.querySelector('.dragging');
                if (dragging && dragging !== item) {
                    container.querySelectorAll('.habit-item').forEach(h => h.classList.remove('drag-over'));
                    item.classList.add('drag-over');
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        container.insertBefore(dragging, item);
                    } else {
                        container.insertBefore(dragging, item.nextSibling);
                    }
                }
            });
            item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
            });

            container.appendChild(item);
        });
    }


    function renderKanban(tasks) {
        const todoCont = document.getElementById('todoTasks');
        const progressCont = document.getElementById('inprogressTasks');
        const doneCont = document.getElementById('completedTasks');

        if (!todoCont || !progressCont || !doneCont) return;

        todoCont.innerHTML = '';
        progressCont.innerHTML = '';
        doneCont.innerHTML = '';

        // Status → column map
        const colMap = {
            'To Do': todoCont,
            'In Progress': progressCont,
            'Completed': doneCont
        };

        // Next status map for arrow button
        const nextStatus = {
            'To Do': 'In Progress',
            'In Progress': 'Completed',
            'Completed': null
        };

        tasks.forEach(task => {
            const card = document.createElement('div');
            card.className = `task-card ${task.status === 'Completed' ? 'done' : ''}`;
            card.draggable = true;
            card.dataset.taskId = task.id;
            card.dataset.status = task.status;

            const priorityClass = task.priority.toLowerCase() === 'high' ? 'high-priority' :
                task.priority.toLowerCase() === 'medium' ? 'med-priority' : 'low-priority';

            const next = nextStatus[task.status];

            card.innerHTML = `
                <div class="task-card-top">
                    <span class="drag-handle" title="Drag to move"><i class="fa-solid fa-grip-vertical"></i></span>
                    <div class="task-actions">
                        <button class="task-action-btn delete" title="Delete" onclick="event.stopPropagation(); window.deleteTask(${task.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                        ${next ? `
                        <button class="task-action-btn move" title="Move to ${next}" onclick="event.stopPropagation(); window.moveTask(${task.id}, '${next}')">
                            <i class="fa-solid fa-arrow-right"></i>
                        </button>` : ''}
                    </div>
                </div>
                <div class="task-labels"><span class="tag ${priorityClass}">${task.priority}</span></div>
                <h4>${task.title}</h4>
                <div class="task-description-wrapper">
                    ${(() => {
                        try {
                            const meta = JSON.parse(task.description);
                            if (meta && typeof meta === 'object') {
                                const subtasks = meta.subtasks || [];
                                const doneCount = subtasks.filter(s => s.done).length;
                                const subtaskInfo = subtasks.length > 0 ? 
                                    `<div class="subtask-progress">
                                        <i class="fa-solid fa-list-check"></i> ${doneCount}/${subtasks.length} steps
                                    </div>` : '';
                                
                                return `
                                    <div class="task-meta-info">
                                        ${meta.category ? `<span class="category-tag">${meta.category}</span>` : ''}
                                        ${meta.duration ? `<span class="duration-tag"><i class="fa-regular fa-clock"></i> ${meta.duration}m</span>` : ''}
                                    </div>
                                    ${subtaskInfo}
                                `;
                            }
                        } catch (e) {
                            return `<p class="text-muted" style="font-size:0.82rem; margin: 0.25rem 0 0.5rem;">${task.description || ''}</p>`;
                        }
                        return `<p class="text-muted" style="font-size:0.82rem; margin: 0.25rem 0 0.5rem;">${task.description || ''}</p>`;
                    })()}
                </div>
                <div class="task-meta">
                    <i class="fa-regular fa-clock"></i>
                    ${task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No due date'}
                </div>
            `;

            // --- Drag events ---
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('taskId', task.id);
                e.dataTransfer.setData('status', task.status);
                card.classList.add('dragging');
                setTimeout(() => card.classList.add('drag-ghost'), 0);
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging', 'drag-ghost');
                document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drop-target'));
            });

            colMap[task.status]?.appendChild(card);
        });

        // Make columns drop zones
        document.querySelectorAll('.kanban-col').forEach(col => {
            const colStatus = col.dataset.status;
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drop-target'));
                col.classList.add('drop-target');
            });
            col.addEventListener('dragleave', (e) => {
                if (!col.contains(e.relatedTarget)) col.classList.remove('drop-target');
            });
            col.addEventListener('drop', async (e) => {
                e.preventDefault();
                col.classList.remove('drop-target');
                const taskId = e.dataTransfer.getData('taskId');
                const oldStatus = e.dataTransfer.getData('status');
                if (!taskId || oldStatus === colStatus) return;
                try {
                    await apiFetch(`/tasks/${taskId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ status: colStatus })
                    });
                    refreshAllData();
                    
                    // Celebration!
                    if (colStatus === 'Completed') {
                        confetti({
                            particleCount: 150,
                            spread: 70,
                            origin: { y: 0.6 },
                            colors: ['#2563eb', '#10b981', '#f59e0b']
                        });
                    }
                } catch (err) {
                    console.error('Drag-drop move failed', err);
                }
            });
        });
    }

    // Task Actions
    window.moveTask = async (id, newStatus) => {
        try {
            await apiFetch(`/tasks/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            refreshAllData();

            // Celebration!
            if (newStatus === 'Completed') {
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#2563eb', '#10b981', '#f59e0b']
                });
            }
        } catch (err) {
            console.error('Failed to move task');
        }
    };

    window.deleteTask = async (id) => {
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
            refreshAllData();
        } catch (err) {
            console.error('Failed to delete task');
        }
    };

    // --- Modal Variables (all declared once here) ---
    const addHabitBtn = document.getElementById('addHabitBtn');
    const habitModal = document.getElementById('habitModal');
    const closeHabitModal = document.getElementById('closeHabitModalBtn');
    const habitForm = document.getElementById('habitForm');

    if (addHabitBtn) {
        addHabitBtn.addEventListener('click', () => {
            habitModal.style.display = 'flex';
        });
    }

    if (closeHabitModal) {
        closeHabitModal.addEventListener('click', () => {
            habitModal.style.display = 'none';
        });
    }

    if (habitForm) {
        habitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('habitTitle').value;
            const frequency = document.getElementById('habitFrequency').value;

            try {
                const res = await apiFetch('/habits', {
                    method: 'POST',
                    body: JSON.stringify({ title, frequency })
                });

                if (res) {
                    habitModal.style.display = 'none';
                    habitForm.reset();
                    refreshAllData();
                }
            } catch (err) {
                alert('Failed to create habit');
            }
        });
    }

    // Initial Data Load
    loadDashboardData();
    initVisualEffects();

    // --- Visual Effects (Glow, Confetti, Tree) ---

    function initVisualEffects() {
        // Cursor Glow
        document.addEventListener('mousemove', (e) => {
            const cards = document.querySelectorAll('.glass');
            cards.forEach(card => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
            });
        });
    }

    function updateKnowledgeTree(totalMinutes) {
        const trunk = document.getElementById('treePath');
        const leaves = document.getElementById('leavesGroup');
        const status = document.getElementById('treeStatus');
        const progressFill = document.getElementById('treeProgress');
        const nextLevel = document.getElementById('treeNextLevel');
        
        if (!trunk || !leaves) return;

        const totalHours = totalMinutes / 60;
        let level = 1;
        let height = 0;
        let leafCount = 0;
        let levelName = 'Seedling';
        let nextLevelInfo = 'Next: Sprout (2h)';
        let progressPct = 0;

        if (totalHours >= 25) {
            level = 4; height = 50; leafCount = 12; levelName = 'Ancient Oak'; nextLevelInfo = 'Max Level Reached! 🌳'; progressPct = 100;
        } else if (totalHours >= 10) {
            level = 3; height = 40; leafCount = 8; levelName = 'Young Tree'; nextLevelInfo = 'Next: Ancient Oak (25h)'; progressPct = ((totalHours - 10) / 15) * 100;
        } else if (totalHours >= 2) {
            level = 2; height = 25; leafCount = 4; levelName = 'Sprout'; nextLevelInfo = 'Next: Young Tree (10h)'; progressPct = ((totalHours - 2) / 8) * 100;
        } else {
            level = 1; height = 5; leafCount = 0; levelName = 'Seedling'; nextLevelInfo = 'Next: Sprout (2h)'; progressPct = (totalHours / 2) * 100;
        }

        // Update UI
        status.textContent = `Level ${level}: ${levelName}`;
        nextLevel.textContent = nextLevelInfo;
        progressFill.style.width = `${progressPct}%`;

        // Update SVG Tree
        trunk.setAttribute('d', `M50,85 L50,${85 - height}`);
        
        // Render Leaves
        leaves.innerHTML = '';
        const leafColors = ['#10b981', '#059669', '#34d399'];
        for (let i = 0; i < leafCount; i++) {
            const angle = (i / leafCount) * Math.PI * 2;
            const radius = 10 + (Math.random() * 10);
            const lx = 50 + Math.cos(angle) * radius;
            const ly = (85 - height) + Math.sin(angle) * radius;
            
            const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            leaf.setAttribute('cx', lx);
            leaf.setAttribute('cy', ly);
            leaf.setAttribute('r', 4 + Math.random() * 3);
            leaf.setAttribute('class', 'leaf');
            leaf.setAttribute('fill', leafColors[i % leafColors.length]);
            leaf.style.animationDelay = `${Math.random() * 2}s`;
            leaves.appendChild(leaf);
        }
    }

    // --- Advanced Task Modal Logic ---
    const newTaskBtn = document.getElementById('newTaskHeaderBtn');
    const taskModal = document.getElementById('taskModal');
    const closeTaskModal = document.getElementById('closeTaskModal');
    const taskForm = document.getElementById('taskForm');

    // Matrix Helper State
    let isUrgent = false;
    let isImportant = false;

    // Sub-tasks State
    let subtasks = [];

    if (newTaskBtn && taskModal) {
        newTaskBtn.addEventListener('click', () => {
            taskModal.style.display = 'flex';
            resetTaskForm();
        });
    }

    if (closeTaskModal) {
        closeTaskModal.addEventListener('click', () => taskModal.style.display = 'none');
    }

    function resetTaskForm() {
        taskForm.reset();
        isUrgent = false;
        isImportant = false;
        subtasks = [];
        updatePriorityUI();
        renderSubtasks();
    }

    // Priority Matrix Logic
    const urgentBtn = document.getElementById('urgentBtn');
    const importantBtn = document.getElementById('importantBtn');
    const priorityBadge = document.getElementById('priorityBadge');
    const taskPriorityHidden = document.getElementById('taskPriority');

    function updatePriorityUI() {
        if (!urgentBtn || !importantBtn) return;

        urgentBtn.classList.toggle('active', isUrgent);
        importantBtn.classList.toggle('active', isImportant);

        let priority = 'Medium';
        let colorClass = 'med';

        if (isUrgent && isImportant) { priority = 'High'; colorClass = 'high'; }
        else if (!isUrgent && !isImportant) { priority = 'Low'; colorClass = 'low'; }

        priorityBadge.textContent = priority;
        priorityBadge.className = `priority-badge ${colorClass}`;
        taskPriorityHidden.value = priority;
    }

    if (urgentBtn) {
        urgentBtn.addEventListener('click', () => {
            isUrgent = !isUrgent;
            updatePriorityUI();
        });
    }
    if (importantBtn) {
        importantBtn.addEventListener('click', () => {
            isImportant = !isImportant;
            updatePriorityUI();
        });
    }

    // Sub-tasks Logic
    const generateBtn = document.getElementById('generateSubtasksBtn');
    const addSubBtn = document.getElementById('addSubtaskBtn');
    const subInput = document.getElementById('newSubtaskInput');
    const subList = document.getElementById('subtasksList');

    function renderSubtasks() {
        if (!subList) return;
        if (subtasks.length === 0) {
            subList.innerHTML = '<p class="text-muted" style="font-size: 0.75rem; text-align: center; padding: 1rem;">No sub-tasks yet.</p>';
            return;
        }
        subList.innerHTML = subtasks.map((s, i) => `
            <div class="subtask-item">
                <input type="checkbox" ${s.done ? 'checked' : ''}>
                <span>${s.text}</span>
                <button type="button" class="remove-subtask" onclick="removeSubtask(${i})"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `).join('');
    }

    window.removeSubtask = (index) => {
        subtasks.splice(index, 1);
        renderSubtasks();
    };

    if (addSubBtn) {
        addSubBtn.addEventListener('click', () => {
            const text = subInput.value.trim();
            if (text) {
                subtasks.push({ text, done: false });
                subInput.value = '';
                renderSubtasks();
            }
        });
    }

    // AI Mock Logic
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const title = document.getElementById('taskTitle').value.toLowerCase();
            if (!title) {
                alert('Please enter a task title first!');
                return;
            }

            let suggested = ['Break into smaller parts', 'Review resources', 'Complete final check'];

            if (title.includes('study') || title.includes('read')) {
                suggested = ['Skim the chapter', 'Highlight key terms', 'Create flashcards', 'Take a practice quiz'];
            } else if (title.includes('project') || title.includes('build')) {
                suggested = ['Define requirements', 'Draft initial design', 'Core implementation', 'Testing & Debugging'];
            } else if (title.includes('exam') || title.includes('test')) {
                suggested = ['Organize study notes', 'Solve past papers', 'Memorize formulas', 'Time-limited mock test'];
            }

            subtasks = suggested.map(text => ({ text, done: false }));
            renderSubtasks();
            addNotification('AI Assistant', 'Sub-tasks generated based on your title! ✨', 'focus');
        });
    }

    if (taskForm) {
        taskForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('taskTitle').value.trim();
            const priority = document.getElementById('taskPriority').value;
            const date = document.getElementById('taskDate').value;
            const time = document.getElementById('taskTime').value;
            const duration = document.getElementById('taskDuration').value;
            const category = document.getElementById('taskCategory').value;
            const addToPlanner = document.getElementById('addToPlanner').checked;

            // Pack duration and subtasks into description
            const description = JSON.stringify({
                category,
                duration,
                subtasks
            });

            try {
                await apiFetch('/tasks', {
                    method: 'POST',
                    body: JSON.stringify({
                        title,
                        description,
                        priority,
                        due_date: date,
                        scheduled_time: time,
                        addToPlanner
                    })
                });

                taskModal.style.display = 'none';
                addNotification('Task Created', `"${title}" has been added successfully.`, 'task');
                refreshAllData();
            } catch (err) {
                alert('Failed to create task. Make sure the server is running.');
                console.error(err);
            }
        });
    }

    // Basic navigation logic
    const navLinks = document.querySelectorAll('.nav-links li a');
    const pages = document.querySelectorAll('.page');

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
            this.parentElement.classList.add('active');

            pages.forEach(page => {
                page.style.display = 'none';
                page.classList.remove('active');
            });

            const targetId = this.getAttribute('href').substring(1);
            const targetPage = document.getElementById(targetId);
            if (targetPage) {
                targetPage.style.display = 'block';
                setTimeout(() => targetPage.classList.add('active'), 10);

                // Refresh data based on page
                if (targetId === 'dashboard') loadDashboardData();
                if (targetId === 'tasks') loadTasksPage();
                if (targetId === 'analytics') loadAnalyticsData();
                if (targetId === 'planner') loadPlannerData();
                if (targetId === 'focus') loadFocusPageData();
            }
        });
    });

    // --- Focus Page Logic ---

    async function loadFocusPageData() {
        try {
            const sessions = await apiFetch('/focus/today');
            const tasks = await apiFetch('/tasks');

            if (sessions) renderFocusLog(sessions);
            if (tasks) {
                const activeTask = tasks.find(t => t.status === 'In Progress') || tasks.find(t => t.status === 'To Do');
                const taskNameEl = document.getElementById('timerCurrentTask');
                if (taskNameEl) {
                    taskNameEl.textContent = activeTask ? activeTask.title : 'No active task';
                    taskNameEl.dataset.id = activeTask ? activeTask.id : '';
                }
            }
        } catch (err) {
            console.error('Failed to load focus data');
        }
    }

    function renderFocusLog(sessions) {
        const container = document.getElementById('focusSessionLog');
        if (!container) return;

        container.innerHTML = sessions.length ? '' : '<p class="text-muted">No sessions today</p>';
        sessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'log-item';
            const time = new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const typeClass = session.type === 'Focus' ? 'bg-blue' : 'bg-green';

            item.innerHTML = `
                <span class="log-time">${time}</span>
                <span class="log-task">${session.task_title || session.type}</span>
                <span class="log-duration tag ${typeClass}">${session.duration}m</span>
            `;
            container.appendChild(item);
        });
    }

    // --- Smart Planner Logic ---
    const autoScheduleBtn = document.getElementById('autoScheduleBtn');
    if (autoScheduleBtn) {
        autoScheduleBtn.addEventListener('click', async () => {
            autoScheduleBtn.disabled = true;
            autoScheduleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scheduling...';
            try {
                const res = await apiFetch('/schedule/auto', { method: 'POST' });
                if (res) {
                    alert(res.message);
                    loadPlannerData();
                }
            } catch (err) {
                alert('Failed to auto-schedule');
            } finally {
                autoScheduleBtn.disabled = false;
                autoScheduleBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI Auto-Schedule';
            }
        });
    }

    // --- Edit Schedule Modal Logic ---
    const editScheduleModal = document.getElementById('editScheduleModal');
    const editScheduleForm = document.getElementById('editScheduleForm');
    const closeEditScheduleModal = document.getElementById('closeEditScheduleModal');
    const deleteScheduleBtn = document.getElementById('deleteScheduleBtn');

    if (closeEditScheduleModal) {
        closeEditScheduleModal.addEventListener('click', () => editScheduleModal.style.display = 'none');
    }

    if (editScheduleForm) {
        editScheduleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editScheduleId').value;
            const title = document.getElementById('editScheduleTitle').value;
            const day = document.getElementById('editScheduleDay').value;
            const start = document.getElementById('editScheduleStart').value;
            const important = document.getElementById('editScheduleImportant').checked;

            try {
                await apiFetch(`/schedule/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        title,
                        day_of_week: day,
                        start_time: start,
                        is_important: important
                    })
                });
                editScheduleModal.style.display = 'none';
                loadPlannerData();
            } catch (err) {
                alert('Failed to update study block');
            }
        });
    }

    if (deleteScheduleBtn) {
        deleteScheduleBtn.addEventListener('click', async () => {
            const id = document.getElementById('editScheduleId').value;
            if (!confirm('Are you sure you want to delete this study block?')) return;
            try {
                await apiFetch(`/schedule/${id}`, { method: 'DELETE' });
                editScheduleModal.style.display = 'none';
                loadPlannerData();
            } catch (err) {
                alert('Failed to delete study block');
            }
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === editScheduleModal) editScheduleModal.style.display = 'none';
    });

    async function loadPlannerData() {
        try {
            const blocks = await apiFetch('/schedule');
            if (blocks) renderPlanner(blocks);
        } catch (err) {
            console.error('Failed to load planner');
        }
    }

    function renderPlanner(blocks) {
        // Clear all days first
        document.querySelectorAll('.day-blocks').forEach(col => {
            col.innerHTML = '';
            // Make columns drop zones
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                col.classList.add('drag-over');
            });
            col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
            col.addEventListener('drop', async (e) => {
                e.preventDefault();
                col.classList.remove('drag-over');
                const blockId = e.dataTransfer.getData('blockId');
                const targetDay = col.closest('.day-col').dataset.day;
                if (blockId && targetDay) {
                    try {
                        await apiFetch(`/schedule/${blockId}`, {
                            method: 'PUT',
                            body: JSON.stringify({ day_of_week: targetDay })
                        });
                        loadPlannerData();
                    } catch (err) {
                        console.error('Failed to move block');
                    }
                }
            });
        });

        blocks.forEach(block => {
            const dayCol = document.querySelector(`.day-col[data-day="${block.day_of_week}"] .day-blocks`);
            if (!dayCol) return;

            const item = document.createElement('div');
            item.className = `study-block bg-${block.color || 'blue'} ${block.is_important ? 'important' : ''}`;
            item.draggable = true;

            // Format time for display (e.g. 10:00:00 -> 10 AM)
            const timeStr = formatTimeDisplay(block.start_time);

            item.innerHTML = `
                <div class="block-content">
                    ${block.is_important ? '<i class="fa-solid fa-circle-exclamation important-icon"></i>' : ''}
                    ${block.title}
                    <span class="time">${timeStr}</span>
                </div>
            `;

            // Open edit modal on click
            item.addEventListener('click', () => {
                const modal = document.getElementById('editScheduleModal');
                document.getElementById('editScheduleId').value = block.id;
                document.getElementById('editScheduleTitle').value = block.title;
                document.getElementById('editScheduleDay').value = block.day_of_week;
                document.getElementById('editScheduleStart').value = block.start_time.substring(0, 5);
                document.getElementById('editScheduleImportant').checked = !!block.is_important;
                modal.style.display = 'flex';
            });

            // Drag start
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('blockId', block.id);
                item.classList.add('dragging');
            });
            item.addEventListener('dragend', () => item.classList.remove('dragging'));

            dayCol.appendChild(item);
        });
    }

    function formatTimeDisplay(timeStr) {
        if (!timeStr) return '';
        const [hours, mins] = timeStr.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        return `${displayH}:${mins} ${ampm}`;
    }

    // --- Analytics Rendering Functions ---

    async function loadAnalyticsData() {
        try {
            const [overview, trends, tasks] = await Promise.all([
                apiFetch('/analytics/overview'),
                apiFetch('/analytics/trends'),
                apiFetch('/tasks')
            ]);

            if (overview) {
                // Cache for profile modal stats
                localStorage.setItem('lastAnalytics', JSON.stringify(overview));

                const mins = overview.totalFocusMinutes ?? 0;
                const h = Math.floor(mins / 60);
                const m = mins % 60;

                const el = (id) => document.getElementById(id);
                if (el('analyticsTotalTime')) el('analyticsTotalTime').textContent = `${h}h ${m}m`;
                if (el('analyticsStreak')) el('analyticsStreak').textContent = `${overview.streak ?? 0} Days`;
                if (el('analyticsAvgSession')) el('analyticsAvgSession').textContent = `${overview.avgSessionMinutes ?? 0}m`;
                if (el('analyticsTasksDone')) el('analyticsTasksDone').textContent = overview.tasksCompleted ?? 0;

                // Weekly label
                const labelEl = document.getElementById('chartTotalLabel');
                if (labelEl) labelEl.textContent = `${h}h ${m}m total this week`;
            }

            if (trends) {
                renderBarChart(trends);
                renderBreakdownTable(trends);
            }

            if (tasks) renderTaskRing(tasks);

            renderHeatmap();
        } catch (err) {
            console.error('Failed to load analytics data', err);
        }
    }

    function renderBarChart(trends) {
        const container = document.getElementById('focusBarChart');
        if (!container) return;

        container.innerHTML = '';
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        // Build a map of date->minutes from trends
        const dataMap = {};
        trends.forEach(t => { dataMap[t.date] = Number(t.minutes) || 0; });

        // Build last-7-days array
        const today = new Date();
        const week = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() - 6 + i);
            const key = d.toISOString().split('T')[0];
            return { day: days[d.getDay()], minutes: dataMap[key] || 0, date: key };
        });

        const maxMins = Math.max(...week.map(d => d.minutes), 30);

        week.forEach(dayData => {
            const pct = maxMins > 0 ? (dayData.minutes / maxMins) * 100 : 0;
            const h = Math.floor(dayData.minutes / 60);
            const m = dayData.minutes % 60;
            const label = dayData.minutes > 0 ? (h > 0 ? `${h}h ${m}m` : `${m}m`) : '—';
            const isToday = dayData.date === today.toISOString().split('T')[0];

            const col = document.createElement('div');
            col.className = 'bar-col';
            col.innerHTML = `
                <span class="bar-value">${label}</span>
                <div class="bar-track">
                    <div class="bar-fill ${isToday ? 'bar-today' : ''}" style="height: ${Math.max(pct, 2)}%;"
                         title="${dayData.minutes} min"></div>
                </div>
                <span class="bar-label ${isToday ? 'bar-label-today' : ''}">${dayData.day}</span>
            `;
            container.appendChild(col);
        });
    }

    function renderBreakdownTable(trends) {
        const tbody = document.getElementById('analyticsBreakdownBody');
        if (!tbody) return;

        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const today = new Date();
        const week = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() - 6 + i);
            const key = d.toISOString().split('T')[0];
            return { day: days[d.getDay()], date: key };
        });

        const dataMap = {};
        trends.forEach(t => { dataMap[t.date] = t; });

        const rows = week.map(({ day, date }) => {
            const t = dataMap[date];
            if (!t || !t.minutes) return '';
            const h = Math.floor(t.minutes / 60);
            const m = t.minutes % 60;
            const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
            const pct = Math.min(Math.round((t.minutes / 120) * 100), 100); // 2h = 100%
            return `<tr>
                <td><strong>${day}</strong> <small class="text-muted">${date}</small></td>
                <td>${timeStr}</td>
                <td>${t.sessions ?? '—'}</td>
                <td>
                    <div class="progress-bar-wrap">
                        <div class="progress-bar-fill" style="width: ${pct}%"></div>
                    </div>
                    <small class="text-muted">${pct}%</small>
                </td>
            </tr>`;
        }).filter(Boolean).join('');

        tbody.innerHTML = rows || `<tr><td colspan="4" class="text-muted" style="text-align:center; padding: 1rem;">
            No focus sessions this week yet!</td></tr>`;
    }

    function renderTaskRing(tasks) {
        const todo = tasks.filter(t => t.status === 'To Do').length;
        const progress = tasks.filter(t => t.status === 'In Progress').length;
        const done = tasks.filter(t => t.status === 'Completed').length;
        const total = todo + progress + done;
        const circ = 2 * Math.PI * 50; // ~314

        const centerEl = document.getElementById('ringCenterText');
        if (centerEl) centerEl.innerHTML = `${total}<br><span>Tasks</span>`;

        function seg(count, offset) {
            if (total === 0) return { da: `0 ${circ}`, off: offset };
            const len = (count / total) * circ;
            return { da: `${len} ${circ - len}`, off: offset };
        }

        const todoSeg = seg(todo, 0);
        const progSeg = seg(progress, todoSeg.off + (total > 0 ? (todo / total) * circ : 0));
        const doneSeg = seg(done, progSeg.off + (total > 0 ? (progress / total) * circ : 0));

        const ringTodo = document.getElementById('ringTodo');
        const ringProg = document.getElementById('ringProgress');
        const ringDone = document.getElementById('ringDone');

        if (ringTodo) { ringTodo.style.strokeDasharray = todoSeg.da; ringTodo.style.strokeDashoffset = -todoSeg.off; }
        if (ringProg) { ringProg.style.strokeDasharray = progSeg.da; ringProg.style.strokeDashoffset = -progSeg.off; }
        if (ringDone) { ringDone.style.strokeDasharray = doneSeg.da; ringDone.style.strokeDashoffset = -doneSeg.off; }

        const legendEl = document.getElementById('ringLegend');
        if (legendEl) {
            legendEl.innerHTML = `
                <div class="ring-legend-item"><span class="ring-dot" style="background:#6366f1"></span>To Do (${todo})</div>
                <div class="ring-legend-item"><span class="ring-dot" style="background:#0ea5e9"></span>In Progress (${progress})</div>
                <div class="ring-legend-item"><span class="ring-dot" style="background:#10b981"></span>Done (${done})</div>
            `;
        }
    }

    function renderHeatmap() {
        const heatmapGrid = document.getElementById('activityHeatmap');
        if (!heatmapGrid) return;
        heatmapGrid.innerHTML = '';
        for (let i = 0; i < 70; i++) {
            const box = document.createElement('div');
            box.classList.add('heat-box');
            const lvl = Math.floor(Math.random() * 5);
            if (lvl > 0) box.classList.add(`lvl-${lvl}`);
            box.title = `${lvl * 30} min`;
            heatmapGrid.appendChild(box);
        }
    }


    // Simulated real-time updates for focus timer trend
    const trendElement = document.querySelector('.trend.up');
    if (trendElement) {
        setInterval(() => {
            // Just a visual simulation for the prototype
            trendElement.style.transform = 'scale(1.05)';
            setTimeout(() => {
                trendElement.style.transform = 'scale(1)';
            }, 200);
        }, 5000);
    }

    // Focus Timer Logic
    let timerInterval;
    let focusDuration = 25;
    let shortBreakDuration = 5;
    let longBreakDuration = 15;
    let timeLeft = focusDuration * 60;
    let isRunning = false;

    const minDisplay = document.getElementById('minutes');
    const secDisplay = document.getElementById('seconds');
    const startBtn = document.getElementById('startTimer');
    const resetBtn = document.getElementById('resetTimer');
    const timerTabs = document.querySelectorAll('.timer-tab');

    // Settings Elements
    const toggleSettingsBtn = document.getElementById('toggleTimerSettings');
    const settingsPanel = document.getElementById('timerSettingsPanel');
    const techniqueSelector = document.getElementById('techniqueSelector');
    const saveSettingsBtn = document.getElementById('saveTimerSettings');
    const focusInput = document.getElementById('focusTimeInput');
    const shortBreakInput = document.getElementById('shortBreakInput');
    const longBreakInput = document.getElementById('longBreakInput');

    function updateDisplay() {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        minDisplay.textContent = mins.toString().padStart(2, '0');
        secDisplay.textContent = secs.toString().padStart(2, '0');
    }

    let sessionStartTime;

    async function logSession() {
        const activeTab = document.querySelector('.timer-tab.active');
        const mode = activeTab.getAttribute('data-mode');
        const duration = mode === 'focus' ? focusDuration : (mode === 'shortBreak' ? shortBreakDuration : longBreakDuration);

        try {
            const activeTab = document.querySelector('.timer-tab.active');
            const mode = activeTab.getAttribute('data-mode');
            const duration = mode === 'focus' ? focusDuration : (mode === 'shortBreak' ? shortBreakDuration : longBreakDuration);

            if (mode === 'focus') {
                addNotification('Focus Session Done', `Well done! You completed a ${duration} min focus block.`, 'focus');
            }

            await apiFetch('/focus/log', {
                method: 'POST',
                body: JSON.stringify({
                    start_time: sessionStartTime || new Date(Date.now() - duration * 60000).toISOString(),
                    end_time: new Date().toISOString(),
                    duration: duration,
                    type: mode === 'focus' ? 'Focus' : (mode === 'shortBreak' ? 'Short Break' : 'Long Break')
                })
            });
            console.log('Session logged successfully');
        } catch (err) {
            console.error('Failed to log session');
        }
        sessionStartTime = null;
    }

    function toggleTimer() {
        if (isRunning) {
            clearInterval(timerInterval);
            startBtn.textContent = 'Resume';
            isRunning = false;
        } else {
            if (!sessionStartTime) sessionStartTime = new Date().toISOString();
            startBtn.textContent = 'Pause';
            isRunning = true;
            timerInterval = setInterval(() => {
                timeLeft--;
                updateDisplay();
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    isRunning = false;
                    startBtn.textContent = 'Start Focus';
                    logSession();
                    alert('Session complete! Time for a break.');
                }
            }, 1000);
        }
    }

    function resetTimer() {
        clearInterval(timerInterval);
        isRunning = false;
        startBtn.textContent = 'Start Focus';
        // Check which tab is active to reset to correct time
        const activeTab = document.querySelector('.timer-tab.active').getAttribute('data-mode');
        if (activeTab === 'focus') timeLeft = focusDuration * 60;
        else if (activeTab === 'shortBreak') timeLeft = shortBreakDuration * 60;
        else if (activeTab === 'longBreak') timeLeft = longBreakDuration * 60;
        updateDisplay();
    }

    if (startBtn && resetBtn) {
        startBtn.addEventListener('click', toggleTimer);
        resetBtn.addEventListener('click', resetTimer);
    }

    timerTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            timerTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            resetTimer(); // resets and sets time based on new active tab
        });
    });

    // Settings Event Listeners
    if (toggleSettingsBtn) {
        toggleSettingsBtn.addEventListener('click', () => {
            settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (techniqueSelector) {
        techniqueSelector.addEventListener('change', (e) => {
            const tech = e.target.value;
            if (tech === 'pomodoro') {
                focusInput.value = 25; shortBreakInput.value = 5; longBreakInput.value = 15;
            } else if (tech === 'rule5217') {
                focusInput.value = 52; shortBreakInput.value = 17; longBreakInput.value = 17;
            } else if (tech === 'block90') {
                focusInput.value = 90; shortBreakInput.value = 20; longBreakInput.value = 30;
            }
        });
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            focusDuration = parseInt(focusInput.value) || 25;
            shortBreakDuration = parseInt(shortBreakInput.value) || 5;
            longBreakDuration = parseInt(longBreakInput.value) || 15;

            settingsPanel.style.display = 'none';
            resetTimer(); // Apply new times immediately to the active tab
        });
    }

    // ── Notifications Logic ───────────────────────────────────────
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationList = document.getElementById('notificationList');
    const notificationBadge = document.getElementById('notificationBadge');
    const markAllReadBtn = document.getElementById('markAllReadBtn');

    // Load notifications from localStorage or start empty
    let notifications = JSON.parse(localStorage.getItem('user_notifications') || '[]');

    function saveNotifications() {
        localStorage.setItem('user_notifications', JSON.stringify(notifications));
    }

    /**
     * @param {string} title 
     * @param {string} desc 
     * @param {string} type 
     * @param {string} uniqueKey - Optional. If provided, notification only shows once per day per key.
     */
    function addNotification(title, desc, type, uniqueKey = null) {
        if (uniqueKey) {
            const lastShown = JSON.parse(localStorage.getItem('notified_keys') || '{}');
            const today = new Date().toISOString().split('T')[0];
            if (lastShown[uniqueKey] === today) return; // Already shown today

            lastShown[uniqueKey] = today;
            localStorage.setItem('notified_keys', JSON.stringify(lastShown));
        }

        // Prevent exact duplicate notifications in the same session
        const isDuplicate = notifications.some(n => n.title === title && n.desc === desc);
        if (isDuplicate) return;

        const newNoti = {
            id: Date.now(),
            title: title,
            desc: desc,
            type: type,
            time: 'Just now',
            unread: true,
            timestamp: new Date().getTime()
        };
        notifications.unshift(newNoti);
        if (notifications.length > 20) notifications.pop();

        saveNotifications();
        renderNotifications();
    }

    function renderNotifications() {
        if (!notificationList) return;

        const unreadCount = notifications.filter(n => n.unread).length;
        if (notificationBadge) {
            notificationBadge.style.display = unreadCount > 0 ? 'block' : 'none';
        }

        if (notifications.length === 0) {
            notificationList.innerHTML = '<div class="noti-empty">No new notifications</div>';
            return;
        }

        notificationList.innerHTML = notifications.map(noti => {
            const timeAgo = formatNotiTime(noti.timestamp);
            return `
                <div class="noti-item ${noti.unread ? 'unread' : ''}" data-id="${noti.id}">
                    <div class="noti-icon ${noti.type}">
                        <i class="fa-solid ${getNotiIcon(noti.type)}"></i>
                    </div>
                    <div class="noti-content">
                        <div class="noti-title">${noti.title}</div>
                        <div class="noti-desc">${noti.desc}</div>
                        <span class="noti-time">${timeAgo}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Add click listeners to items
        document.querySelectorAll('.noti-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.id);
                const noti = notifications.find(n => n.id === id);
                if (noti) noti.unread = false;
                saveNotifications();
                renderNotifications();
            });
        });
    }

    function formatNotiTime(timestamp) {
        if (!timestamp) return 'Sometime ago';
        const diff = new Date().getTime() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    function runSmartAlerts(tasks, habits, overview) {
        // 1. Morning Motivation / Goal Reminder
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.goal) {
            addNotification('Morning Motivation', `Ready to work on your goal: "${user.goal}"? 🚀`, 'streak', 'morning_goal');
        }

        // 2. Burnout Warning (> 4 hours today)
        const todayFocus = overview.totalFocusMinutes || 0;
        if (todayFocus > 240) {
            addNotification('Burnout Warning ⚠️', "You've focused for over 4 hours today. Please take a long break! 🧘", 'focus', 'burnout_alert');
        }

        // 3. Habit Reminder
        if (Array.isArray(habits)) {
            const incomplete = habits.filter(h => h.streak === 0).length; // Simple check for demo
            if (incomplete > 0) {
                addNotification('Habit Nudge', `You have ${incomplete} habits remaining for today. Keep the streak! 🔥`, 'streak', 'habit_nudge');
            }
        }

        // 4. Rank Up System
        const totalHours = Math.floor((overview.totalFocusMinutes || 0) / 60);
        let rank = 'Novice Learner';
        if (totalHours >= 100) rank = 'Productivity Ninja 🥷';
        else if (totalHours >= 50) rank = 'Focus Master 🏆';
        else if (totalHours >= 20) rank = 'Academic Scholar 🎓';
        else if (totalHours >= 5) rank = 'Study Apprentice 📚';

        addNotification('Current Rank', `You are currently a ${rank}. Keep going!`, 'streak', `rank_${rank}`);

        // 5. Weekly Summary (Simplified)
        if (new Date().getDay() === 1) { // Monday
            addNotification('Weekly Report 📊', `Last week summary: ${overview.tasksCompleted} tasks done & ${totalHours}h focused.`, 'task', 'weekly_report');
        }
    }

    function getNotiIcon(type) {
        switch (type) {
            case 'focus': return 'fa-stopwatch';
            case 'task': return 'fa-list-check';
            case 'streak': return 'fa-fire';
            default: return 'fa-bell';
        }
    }

    if (notificationBtn) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = notificationDropdown.style.display === 'flex';
            notificationDropdown.style.display = isVisible ? 'none' : 'flex';
        });
    }

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifications.forEach(n => n.unread = false);
            saveNotifications();
            renderNotifications();
        });
    }

    // Close dropdown on click outside
    window.addEventListener('click', () => {
        if (notificationDropdown) notificationDropdown.style.display = 'none';
    });

    if (notificationDropdown) {
        notificationDropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    // Initial render
    renderNotifications();

    // Theme Switcher Logic
    const themeSelector = document.getElementById('themeSelector');

    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (themeSelector) {
        themeSelector.value = savedTheme;
    }

    // Listen for theme changes
    if (themeSelector) {
        themeSelector.addEventListener('change', function (e) {
            const selectedTheme = e.target.value;
            document.documentElement.setAttribute('data-theme', selectedTheme);
            localStorage.setItem('app-theme', selectedTheme);
        });
    }
});
