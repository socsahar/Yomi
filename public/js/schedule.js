// Schedule editor with drag and drop functionality

let currentSchedule = null;
let allEmployees = [];
let schedulesList = [];
let activeStationFilters = ['ירקון דרום', 'ירקון צפון']; // Both active by default

// Realtime collaboration
let supabaseClient = null;
let realtimeChannel = null;
let currentUser = null;
let isUpdatingFromRealtime = false;

/**
 * Custom prompt function
 */
function customPrompt(message, defaultValue = '', title = 'הזן מידע') {
    return new Promise((resolve) => {
        const modal = document.getElementById('customPromptModal');
        const titleEl = document.getElementById('promptTitle');
        const messageEl = document.getElementById('promptMessage');
        const input = document.getElementById('promptInput');
        const confirmBtn = document.getElementById('promptConfirm');
        const cancelBtn = document.getElementById('promptCancel');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        input.value = defaultValue;
        input.style.display = 'block';
        document.getElementById('promptSelect').style.display = 'none';
        
        modal.style.display = 'block';
        input.focus();
        
        const handleConfirm = () => {
            const value = input.value;
            modal.style.display = 'none';
            cleanup();
            resolve(value); // Return empty string as-is, don't convert to null
        };
        
        const handleCancel = () => {
            modal.style.display = 'none';
            cleanup();
            resolve(null);
        };
        
        const handleKeyPress = (e) => {
            if (e.key === 'Enter') handleConfirm();
            if (e.key === 'Escape') handleCancel();
        };
        
        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            input.removeEventListener('keypress', handleKeyPress);
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        input.addEventListener('keypress', handleKeyPress);
    });
}

/**
 * Custom prompt with select dropdown
 */
function customSelect(message, options, title = 'בחר אפשרות') {
    return new Promise((resolve) => {
        const modal = document.getElementById('customPromptModal');
        const titleEl = document.getElementById('promptTitle');
        const messageEl = document.getElementById('promptMessage');
        const select = document.getElementById('promptSelect');
        const confirmBtn = document.getElementById('promptConfirm');
        const cancelBtn = document.getElementById('promptCancel');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        document.getElementById('promptInput').style.display = 'none';
        select.style.display = 'block';
        
        // Populate select options - handle both string array and object array
        select.innerHTML = '<option value="">בחר...</option>' + 
            options.map((opt, index) => {
                if (typeof opt === 'string') {
                    return `<option value="${index}">${opt}</option>`;
                } else {
                    return `<option value="${opt.value}">${opt.label}</option>`;
                }
            }).join('');
        
        modal.style.display = 'block';
        select.focus();
        
        const handleConfirm = () => {
            const value = select.value;
            modal.style.display = 'none';
            cleanup();
            // For string arrays, convert value back to number (index)
            // For object arrays, keep value as is
            const result = value === '' ? null : (isNaN(value) ? value : parseInt(value));
            resolve(result);
        };
        
        const handleCancel = () => {
            modal.style.display = 'none';
            cleanup();
            resolve(null);
        };
        
        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

/**
 * Custom alert function (replaced with toast notifications)
 */
function customAlert(message, title = 'הודעה') {
    // Determine type based on title
    let type = 'info';
    if (title === 'שגיאה' || title.includes('שגיאה')) {
        type = 'error';
    } else if (title === 'הצלחה' || title.includes('הצלחה')) {
        type = 'success';
    } else if (title === 'שמירה' || title.includes('שמירה')) {
        type = 'success';
    }
    
    showToast(message, type);
    return Promise.resolve();
}


/**
 * Custom confirm function
 */
function customConfirm(message, title = 'אישור') {
    return new Promise((resolve) => {
        const modal = document.getElementById('customConfirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.style.display = 'block';
        
        const handleYes = () => {
            modal.style.display = 'none';
            cleanup();
            resolve(true);
        };
        
        const handleNo = () => {
            modal.style.display = 'none';
            cleanup();
            resolve(false);
        };
        
        const cleanup = () => {
            yesBtn.removeEventListener('click', handleYes);
            noBtn.removeEventListener('click', handleNo);
        };
        
        yesBtn.addEventListener('click', handleYes);
        noBtn.addEventListener('click', handleNo);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize realtime collaboration
    await initializeRealtime();
    
    await loadEmployees();
    await loadSchedules();
    setupEventListeners();
    
    // Check if editing specific schedule from URL
    const urlParams = new URLSearchParams(window.location.search);
    const scheduleId = urlParams.get('id');
    if (scheduleId) {
        await loadScheduleEditor(scheduleId);
    }
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // New schedule button
    document.getElementById('newScheduleBtn').addEventListener('click', () => {
        showModal('newScheduleModal');
    });
    
    // New schedule form
    document.getElementById('newScheduleForm').addEventListener('submit', handleNewSchedule);
    
    // Cancel new schedule
    document.getElementById('cancelNewScheduleBtn').addEventListener('click', () => {
        hideModal('newScheduleModal');
    });
    
    // Close editor
    document.getElementById('closeEditorBtn').addEventListener('click', () => {
        unsubscribeFromSchedule();
        hideShiftNavigation();
        document.getElementById('scheduleEditor').style.display = 'none';
        document.getElementById('scheduleSelection').style.display = 'block';
        currentSchedule = null;
    });
    
    // Save schedule button
    document.getElementById('saveScheduleBtn').addEventListener('click', () => {
        customAlert('השינויים נשמרו אוטומטית', 'שמירה');
    });
    
    // Delete schedule button
    document.getElementById('deleteScheduleBtn').addEventListener('click', deleteSchedule);
    
    // Export button
    document.getElementById('exportHtmlBtn').addEventListener('click', exportToHtml);
    
    // Toggle employees sidebar button
    document.getElementById('toggleEmployeesBtn').addEventListener('click', () => {
        document.getElementById('employeesSidebar').classList.toggle('open');
    });
    
    // Add note button
    document.getElementById('addNoteBtn').addEventListener('click', addNote);
    
    // Allow Enter key to add note
    document.getElementById('newNoteInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addNote();
        }
    });
    
    // Add extra ambulance button
    document.getElementById('addExtraAmbulanceBtn').addEventListener('click', addExtraAmbulance);
    
    // Add extra mission button
    document.getElementById('addExtraMissionBtn').addEventListener('click', addExtraMission);
    
    // Close sidebar
    document.querySelector('.close-sidebar').addEventListener('click', () => {
        document.getElementById('employeesSidebar').classList.remove('open');
    });
    
    // Employee search
    document.getElementById('employeeSearch').addEventListener('input', (e) => {
        filterEmployeesSidebar(e.target.value);
    });
    
    // Station filter buttons
    document.querySelectorAll('.station-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const station = e.target.dataset.station;
            
            // Toggle active state
            e.target.classList.toggle('active');
            
            // Update active filters
            if (e.target.classList.contains('active')) {
                if (!activeStationFilters.includes(station)) {
                    activeStationFilters.push(station);
                }
            } else {
                activeStationFilters = activeStationFilters.filter(s => s !== station);
            }
            
            // Re-filter employees
            const searchQuery = document.getElementById('employeeSearch').value;
            filterEmployeesSidebar(searchQuery);
        });
    });
    
    // Edit schedule date
    document.getElementById('scheduleDate').addEventListener('click', editScheduleDate);
    
    // Edit schedule status
    document.getElementById('scheduleStatus').addEventListener('click', editScheduleStatus);
}

/**
 * Load all employees
 */
async function loadEmployees() {
    try {
        allEmployees = await apiRequest('/api/employees');
        displayEmployeesSidebar(allEmployees);
    } catch (error) {
        console.error('Error loading employees:', error);
    }
}

/**
 * Display employees in sidebar
 */
function displayEmployeesSidebar(employees) {
    const list = document.getElementById('employeesList');
    
    if (!employees || employees.length === 0) {
        list.innerHTML = '<p class="text-center">אין עובדים במערכת</p>';
        return;
    }
    
    list.innerHTML = employees.map(emp => `
        <div class="employee-item" draggable="true" data-employee-id="${emp.id}">
            <div class="employee-name">${emp.first_name} ${emp.last_name}</div>
            <div class="employee-details">
                ${emp.position || ''} ${emp.station ? '• ' + emp.station : ''}
            </div>
        </div>
    `).join('');
    
    // Setup drag and drop for employee items
    setupEmployeeDragDrop();
}

/**
 * Filter employees in sidebar
 */
function filterEmployeesSidebar(query) {
    const filtered = allEmployees.filter(emp => {
        const searchText = query.toLowerCase();
        const matchesSearch = (
            emp.first_name.toLowerCase().includes(searchText) ||
            emp.last_name.toLowerCase().includes(searchText) ||
            (emp.position && emp.position.toLowerCase().includes(searchText))
        );
        
        // Filter by station - if no stations are active, show none
        const matchesStation = activeStationFilters.length === 0 ? false :
            (emp.station && activeStationFilters.includes(emp.station)) || 
            (!emp.station && activeStationFilters.length > 0); // Show employees without station when any filter is active
        
        return matchesSearch && matchesStation;
    });
    
    displayEmployeesSidebar(filtered);
}

/**
 * Load all schedules
 */
async function loadSchedules() {
    const listContainer = document.getElementById('schedulesList');
    
    try {
        schedulesList = await apiRequest('/api/schedules');
        
        if (!schedulesList || schedulesList.length === 0) {
            listContainer.innerHTML = '<p class="text-center">אין סידורי עבודה. צור סידור חדש</p>';
            return;
        }
        
        listContainer.innerHTML = schedulesList.map(schedule => {
            const date = new Date(schedule.schedule_date);
            const dayOfWeek = date.toLocaleDateString('he-IL', { weekday: 'long' });
            
            return `
            <div class="schedule-item">
                <div class="schedule-item-info" onclick="loadScheduleEditor(${schedule.id})" style="cursor: pointer;">
                    <h4>${dayOfWeek}</h4>
                    <p>${formatDate(schedule.schedule_date)}</p>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="status-badge ${schedule.status}">${getStatusText(schedule.status)}</span>
                    <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteScheduleFromList(${schedule.id});"
                            title="מחק סידור">מחק</button>
                </div>
            </div>
        `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading schedules:', error);
        listContainer.innerHTML = '<p class="text-center">שגיאה בטעינת סידורים</p>';
    }
}

/**
 * Get status text in Hebrew
 */
function getStatusText(status) {
    const statusMap = {
        'draft': 'טיוטה',
        'published': 'פורסם',
        'archived': 'בארכיון'
    };
    return statusMap[status] || status;
}

/**
 * Load schedule editor
 */
async function loadScheduleEditor(scheduleId) {
    try {
        // Show loading state immediately
        const editor = document.getElementById('scheduleEditor');
        const selection = document.getElementById('scheduleSelection');
        const shiftsContainer = document.getElementById('shiftsContainer');
        
        shiftsContainer.innerHTML = '<p class="loading">טוען סידור...</p>';
        selection.style.display = 'none';
        editor.style.display = 'block';
        
        // Fetch schedule data
        currentSchedule = await apiRequest(`/api/schedules/${scheduleId}`);
        
        // Update schedule info
        document.getElementById('scheduleDate').textContent = formatDate(currentSchedule.schedule_date);

        document.getElementById('scheduleStatus').textContent = getStatusText(currentSchedule.status);
        document.getElementById('scheduleStatus').className = `status-badge ${currentSchedule.status}`;
        
        // Enable export button
        document.getElementById('exportHtmlBtn').disabled = false;
        
        // Load notes
        loadScheduleNotes();
        
        // Load extra missions
        loadExtraMissions();
        
        // Load extra ambulances
        loadExtraAmbulances();
        
        // Display shifts
        displayShifts();
        
        // Subscribe to realtime updates for this schedule
        subscribeToSchedule(scheduleId);
        
        // Show editor, hide selection
        document.getElementById('scheduleSelection').style.display = 'none';
        document.getElementById('scheduleEditor').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading schedule:', error);
        await customAlert('שגיאה בטעינת סידור עבודה', 'שגיאה');
    }
}

/**
 * Display shifts in editor
 */
function displayShifts() {
    const container = document.getElementById('shiftsContainer');
    
    if (!currentSchedule.shifts || currentSchedule.shifts.length === 0) {
        container.innerHTML = '<p class="text-center">אין משמרות. הוסף משמרת חדשה</p>';
        hideShiftNavigation();
        return;
    }
    
    // Sort shifts: לילה, בוקר, ערב (ensure correct order)
    const shiftOrder = { 'לילה': 0, 'בוקר': 1, 'ערב': 2 };
    console.log('Before sort:', currentSchedule.shifts.map(s => `"${s.shift_name}" (order: ${shiftOrder[s.shift_name] ?? 'unknown'})`));
    currentSchedule.shifts.sort((a, b) => {
        const orderA = shiftOrder[a.shift_name] ?? 999;
        const orderB = shiftOrder[b.shift_name] ?? 999;
        console.log(`Comparing "${a.shift_name}" (${orderA}) vs "${b.shift_name}" (${orderB})`);
        return orderA - orderB;
    });
    console.log('After sort:', currentSchedule.shifts.map(s => `"${s.shift_name}" (order: ${shiftOrder[s.shift_name] ?? 'unknown'})`));
    
    container.innerHTML = currentSchedule.shifts.map(shift => `
        <div class="shift-section" id="shift-section-${shift.id}" data-shift-id="${shift.id}" data-shift-name="${shift.shift_name}">
            <div class="shift-header">
                <h3>משמרת ${shift.shift_name}</h3>
                <div class="shift-actions">
                    <button class="btn btn-secondary btn-small" onclick="addUnit(${shift.id})">הוסף תחנה</button>
                    <button class="btn btn-secondary btn-small" onclick="deleteShift(${shift.id})">מחק משמרת</button>
                </div>
            </div>
            <div class="units-container" id="units-${shift.id}">
                ${displayUnits(shift.units || [])}
            </div>
        </div>
    `).join('');
    
    // Setup drag and drop after rendering shifts
    setupEmployeeDragDrop();
    
    // Show floating shift navigation
    showShiftNavigation();
}

/**
 * Display units
 */
function displayUnits(units) {
    if (!units || units.length === 0) {
        return '<p class="text-center">אין יחידות. הוסף יחידה חדשה</p>';
    }
    
    return units.map(unit => `
        <div class="unit-card" data-unit-id="${unit.id}">
            <div class="unit-header">
                <h4>🚑 ${unit.unit_name}${unit.unit_type ? ' - ' + unit.unit_type : ''}</h4>
                <div class="unit-actions">
                    <button class="btn btn-secondary btn-small" onclick="addRole(${unit.id})">הוסף משימה/תפקיד</button>
                    <button class="btn btn-secondary btn-small" onclick="deleteUnit(${unit.id})">מחק</button>
                </div>
            </div>
            <div class="roles-list">
                ${displayRoles(unit.roles || [])}
            </div>
        </div>
    `).join('');
}

/**
 * Display roles
 */
function displayRoles(roles) {
    if (!roles || roles.length === 0) {
        return '<p class="text-center">אין תפקידים</p>';
    }
    
    return roles.map(role => {
        const hasEmployee = role.assignment && (role.assignment.employees || role.assignment.manual_employee_name);
        let employeeName = 'לא משובץ';
        let isManual = false;
        
        if (role.assignment) {
            if (role.assignment.employees) {
                employeeName = `${role.assignment.employees.first_name} ${role.assignment.employees.last_name}`;
            } else if (role.assignment.manual_employee_name) {
                employeeName = role.assignment.manual_employee_name;
                isManual = true;
            }
        }
        
        return `
            <div class="role-item ${hasEmployee ? 'has-employee' : ''}" 
                 data-role-id="${role.id}"
                 data-assignment-id="${role.assignment ? role.assignment.id : ''}">
                <div class="role-info">
                    <div class="role-name editable" onclick="editRoleName(${role.id}, '${role.role_name.replace(/'/g, "\\'")}')"
                         title="לחץ לעריכת שם התפקיד">✏️ ${role.role_name}</div>
                    <div class="ambulance-number editable" onclick="editAmbulanceNumber(${role.id}, '${role.ambulance_number || ''}')"
                         title="לחץ לעריכת מספר אמבולנס">
                        ${role.ambulance_number ? `🚑 ${role.ambulance_number}` : '🚑 [הוסף אמבולנס]'}
                    </div>
                    <div class="assigned-employee" ${isManual ? 'style="font-style: italic;" title="שיבוץ ידני (לא מרשימת העובדים)"' : ''}>${employeeName}</div>
                </div>
                <div class="role-actions">
                    ${hasEmployee ? `<button class="btn btn-secondary btn-small" onclick="removeAssignment(${role.assignment.id}, ${role.id})">הסר</button>` : ''}
                    <button class="btn btn-primary btn-small" onclick="manuallyAssignEmployee(${role.id})">שיבוץ ידני</button>
                    <button class="btn btn-secondary btn-small" onclick="deleteRole(${role.id})">מחק תפקיד</button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Station configuration - defines roles for each station and shift
 */
function getStationConfiguration() {
    // Default shift hours
    const defaultHours = {
        'בוקר': { start: '07:00', end: '15:00' },
        'ערב': { start: '15:00', end: '23:00' },
        'לילה': { start: '23:00', end: '07:00' }
    };
    
    // Helper to create אטן roles
    const createAten = (hours = null) => ({
        type: 'אטן',
        roles: ['נהג אטן', 'פרמדיק', 'טיוטר'],
        hours: hours
    });
    
    // Helper to create רגיל תקן roles
    const createRegular = (num, hours = null) => ({
        type: `רגיל תקן ${num}`,
        roles: [`רגיל תקן ${num}`],
        hours: hours
    });
    
    // Configuration for each station
    return {
        'פתח תקווה': {
            'לילה': [
                createAten(),
                createRegular(1)
            ],
            'בוקר': [
                createAten(),
                createRegular(1),
                createRegular(2),
                { type: 'תגבור', roles: ['תגבור'], hours: { start: '08:00', end: '16:00' } }
            ],
            'ערב': [
                createAten(),
                createRegular(1),
                createRegular(2)
            ]
        },
        'קריית אונו': {
            'לילה': [createAten()],
            'בוקר': [createAten()],
            'ערב': [createAten()]
        },
        'שהם': {
            'לילה': [createAten()],
            'בוקר': [
                createAten(),
                createRegular(1, { start: '09:00', end: '17:00' })
            ],
            'ערב': [createAten()]
        },
        'ראש העין': {
            'לילה': [createAten()],
            'בוקר': [createAten(), createRegular(1)],
            'ערב': [createAten(), createRegular(1)]
        },
        'אריאל': {
            'לילה': [createAten()],
            'בוקר': [
                createAten(),
                createRegular(1, { start: '09:00', end: '19:00' })
            ],
            'ערב': [createAten()]
        },
        'קריית נטפים': {
            'לילה': [],
            'בוקר': [createRegular(1, { start: '07:00', end: '19:00' })],
            'ערב': []
        },
        'אלקנה': {
            'לילה': [],
            'בוקר': [createRegular(1, { start: '08:00', end: '16:00' })],
            'ערב': []
        },
        'אלעד': {
            'לילה': [createAten()],
            'בוקר': [createAten()],
            'ערב': [createAten()]
        },
        'בית אריה': {
            'לילה': [],
            'בוקר': [createRegular(1, { start: '07:00', end: '19:00' })],
            'ערב': []
        },
        'סביון': {
            'לילה': [],
            'בוקר': [createRegular(1, { start: '09:00', end: '17:00' })],
            'ערב': []
        },
        'גבעת שמואל': {
            'לילה': [],
            'בוקר': [createAten({ start: '08:00', end: '16:00' })],
            'ערב': [createRegular(1)]
        },
        'אור יהודה': {
            'לילה': [createAten()],
            'בוקר': [createAten(), createRegular(1)],
            'ערב': [createAten(), createRegular(1)]
        },
        'יהוד': {
            'לילה': [createRegular(1)],
            'בוקר': [
                createRegular(1),
                createRegular(2, { start: '09:00', end: '17:00' })
            ],
            'ערב': [createRegular(1)]
        },
        'כפר סבא': {
            'לילה': [createAten(), createRegular(1)],
            'בוקר': [createAten(), createRegular(1)],
            'ערב': [createAten(), createRegular(1)]
        },
        'הרצליה': {
            'לילה': [createAten(), createRegular(1)],
            'בוקר': [createAten(), createRegular(1)],
            'ערב': [createAten(), createRegular(1)]
        },
        'רמת השרון': {
            'לילה': [createAten()],
            'בוקר': [createAten(), createRegular(1)],
            'ערב': [createAten(), createRegular(1)]
        },
        'קרני שומרון': {
            'לילה': [createAten()],
            'בוקר': [createAten()],
            'ערב': [createAten()]
        },
        'רעננה': {
            'לילה': [createRegular(1)],
            'בוקר': [createRegular(1), createRegular(2)],
            'ערב': [createRegular(1), createRegular(2)]
        },
        'נווה ימין': {
            'לילה': [],
            'בוקר': [createRegular(1)],
            'ערב': [createRegular(1)]
        },
        'לב השרון - עין שריד': {
            'לילה': [],
            'בוקר': [createRegular(1, { start: '10:00', end: '18:00' })],
            'ערב': []
        },
        'הוד השרון': {
            'לילה': [createAten()],
            'בוקר': [createAten()],
            'ערב': [createAten()]
        },
        'הרצליה מערב': {
            'לילה': [],
            'בוקר': [createAten({ start: '08:00', end: '16:00' })],
            'ערב': [createAten({ start: '14:00', end: '22:00' })]
        },
        'שבי שומרון': {
            'לילה': [],
            'בוקר': [createRegular(1, { start: '07:00', end: '19:00' })],
            'ערב': []
        },
        'אלפי מנשה': {
            'לילה': [],
            'בוקר': [createRegular(1, { start: '07:00', end: '19:00' })],
            'ערב': []
        },
        'כוכב יאיר': {
            'לילה': [],
            'בוקר': [createRegular(1, { start: '08:00', end: '16:00' })],
            'ערב': []
        }
    };
}

/**
 * Create new schedule
 */
async function handleNewSchedule(e) {
    e.preventDefault();
    
    const date = document.getElementById('scheduleDateInput').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    // Disable button and show loading
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'יוצר סידור...';
    }
    
    try {
        // All three shifts
        const allShifts = ['בוקר', 'ערב', 'לילה'];
    
    // All stations that are automatically included in every schedule
    // All stations that are automatically included in every schedule
    const allStations = [
        'פתח תקווה',
        'קריית אונו',
        'שהם',
        'ראש העין',
        'אריאל',
        'קריית נטפים',
        'אלקנה',
        'אלעד',
        'בית אריה',
        'סביון',
        'גבעת שמואל',
        'אור יהודה',
        'יהוד',
        'כפר סבא',
        'הרצליה',
        'רמת השרון',
        'קרני שומרון',
        'רעננה',
        'נווה ימין',
        'לב השרון - עין שריד',
        'הוד השרון',
        'הרצליה מערב',
        'שבי שומרון',
        'אלפי מנשה',
        'כוכב יאיר'
    ];
    
    // Default shift hours
    const defaultHours = {
        'בוקר': { start: '07:00', end: '15:00' },
        'ערב': { start: '15:00', end: '23:00' },
        'לילה': { start: '23:00', end: '07:00' }
    };
    
        // Get station configuration
        const stationConfig = getStationConfiguration();
        
        const shifts = allShifts.map((shiftName, shiftIndex) => {
            const units = [];
            let unitOrder = 0;
            
            // Iterate through all stations in order
            for (const stationName of allStations) {
                const shiftConfigs = stationConfig[stationName];
                if (!shiftConfigs) continue;
                
                const shiftConfig = shiftConfigs[shiftName];
                
                if (!shiftConfig || shiftConfig.length === 0) continue;
                
                // Create roles for this station
                const roles = [];
                let roleOrder = 0;
                
                // For each unit type in this station/shift
                for (const unitConfig of shiftConfig) {
                    // Add all roles for this unit type
                    for (const roleName of unitConfig.roles) {
                        roles.push({
                            role_name: roleName,
                            role_order: roleOrder++
                        });
                    }
                }
                
                units.push({
                    unit_name: stationName,
                    unit_type: '',
                    unit_order: unitOrder++,
                    roles: roles
                });
            }
            
            return {
                shift_name: shiftName,
                shift_order: shiftIndex,
                start_time: defaultHours[shiftName].start,
                end_time: defaultHours[shiftName].end,
                units: units
            };
        });
        
        // Get Hebrew day name from date
        const scheduleDate = new Date(date);
        const dayNames = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת'];
        const dayName = dayNames[scheduleDate.getDay()];
        
        const newSchedule = await apiRequest('/api/schedules', {
            method: 'POST',
            body: JSON.stringify({
                schedule_date: date,
                station: dayName,
                shifts: shifts
            })
        });
        
        // Show immediate notification
        if (typeof showImmediateNotification === 'function') {
            showImmediateNotification(
                'create',
                'schedule',
                `יצר סידור עבודה חדש לתאריך ${date}`
            );
        }
        
        hideModal('newScheduleModal');
        await loadSchedules();
        await loadScheduleEditor(newSchedule.id);
        
    } catch (error) {
        console.error('Error creating schedule:', error);
        
        // Check for duplicate schedule error
        if (error.message && (error.message.includes('כבר קיים') || error.message.includes('duplicate'))) {
            await customAlert(
                `סידור עבודה לתאריך ${date} כבר קיים במערכת.\n\nאנא בחר תאריך אחר או מחק את הסידור הקיים.`,
                'סידור קיים'
            );
        } else {
            showError('newScheduleError', error.message || 'שגיאה ביצירת סידור');
        }
    } finally {
        // Re-enable button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'צור סידור';
        }
    }
}

/**
 * Add shift to current schedule
 */
async function addShift() {
    const shiftName = await customPrompt('', '', 'שם המשמרת');
    if (!shiftName) return;
    
    try {
        await apiRequest(`/api/schedules/${currentSchedule.id}/shifts`, {
            method: 'POST',
            body: JSON.stringify({
                shift_name: shiftName,
                shift_order: currentSchedule.shifts.length
            })
        });
        
        await loadScheduleEditor(currentSchedule.id);
    } catch (error) {
        console.error('Error adding shift:', error);
        await customAlert('שגיאה בהוספת משמרת', 'שגיאה');
    }
}

/**
 * Add unit to shift (ambulance or team)
 */
async function addUnit(shiftId) {
    const unitName = await customPrompt('', '', 'שם התחנה');
    if (!unitName) return;
    
    // Ask which shifts to add the station to (allow multiple)
    const shifts = currentSchedule.shifts || [];
    
    // Create checkboxes HTML
    const checkboxesHtml = shifts.map((shift, index) => `
        <label style="display: block; margin: 10px 0; cursor: pointer; font-size: 16px;">
            <input type="checkbox" value="${shift.id}" class="shift-checkbox" style="margin-left: 10px;">
            משמרת ${shift.shift_name}
        </label>
    `).join('');
    
    // Use the existing modal
    return new Promise((resolve) => {
        const modal = document.getElementById('customConfirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');
        
        titleEl.textContent = 'בחירת משמרות';
        messageEl.innerHTML = `
            <div style="text-align: right; margin: 15px 0;">
                <p style="margin-bottom: 15px; font-size: 16px;">לאילו משמרות להוסיף את התחנה?</p>
                <div id="shift-checkboxes-container">
                    ${checkboxesHtml}
                </div>
            </div>
        `;
        yesBtn.textContent = 'הוסף';
        noBtn.textContent = 'ביטול';
        modal.style.display = 'block';
        
        const handleYes = async () => {
            const checkboxes = messageEl.querySelectorAll('.shift-checkbox:checked');
            if (checkboxes.length === 0) {
                await customAlert('יש לבחור לפחות משמרת אחת', 'שגיאה');
                modal.style.display = 'none';
                cleanup();
                resolve();
                return;
            }
            
            const selectedShiftIds = Array.from(checkboxes).map(cb => cb.value);
            modal.style.display = 'none';
            cleanup();
            
            try {
                // Add unit to each selected shift
                for (const shiftId of selectedShiftIds) {
                    await apiRequest(`/api/schedules/shifts/${shiftId}/units`, {
                        method: 'POST',
                        body: JSON.stringify({
                            unit_name: unitName,
                            unit_type: '',
                            unit_order: 0
                        })
                    });
                }
                
                await loadScheduleEditor(currentSchedule.id);
            } catch (error) {
                console.error('Error adding unit:', error);
                await customAlert('שגיאה בהוספת תחנה', 'שגיאה');
            }
            resolve();
        };
        
        const handleNo = () => {
            modal.style.display = 'none';
            cleanup();
            resolve();
        };
        
        const cleanup = () => {
            yesBtn.removeEventListener('click', handleYes);
            noBtn.removeEventListener('click', handleNo);
            yesBtn.textContent = 'כן';
            noBtn.textContent = 'לא';
        };
        
        yesBtn.addEventListener('click', handleYes);
        noBtn.addEventListener('click', handleNo);
    });
}

/**
 * Add role to unit (employee's job/task)
 */
async function addRole(unitId) {
    const roles = [
        'אטן',
        'רגיל תקן 1',
        'רגיל תקן 2',
        'רגיל תקן 3',
        'תגבור',
        'נהג אטן',
        'פרמדיק',
        'טיוטר',
        'חובש מלווה',
        'אחר'
    ];
    
    const choice = await customSelect('בחר תפקיד מהרשימה:', roles, 'הוספת תפקיד');
    
    if (choice === null || choice === undefined) return;
    
    let roleName = roles[choice];
    
    if (!roleName) return;
    
    if (roleName === 'אחר') {
        roleName = await customPrompt('', '', 'שם המשימה המותאמת אישית');
        if (!roleName || roleName.trim() === '') return;
    }
    
    // Find the unit and calculate the next role_order
    let maxRoleOrder = -1;
    for (const shift of currentSchedule.shifts) {
        const unit = shift.units.find(u => u.id === unitId);
        if (unit && unit.roles) {
            for (const role of unit.roles) {
                if (role.role_order > maxRoleOrder) {
                    maxRoleOrder = role.role_order;
                }
            }
            break;
        }
    }
    const nextRoleOrder = maxRoleOrder + 1;
    
    try {
        await apiRequest(`/api/schedules/units/${unitId}/roles`, {
            method: 'POST',
            body: JSON.stringify({
                role_name: roleName.trim(),
                role_order: nextRoleOrder
            })
        });
        
        await loadScheduleEditor(currentSchedule.id);
    } catch (error) {
        console.error('Error adding role:', error);
        await customAlert('שגיאה בהוספת תפקיד', 'שגיאה');
    }
}

/**
 * Delete shift
 */
async function deleteShift(shiftId) {
    if (!await customConfirm('האם למחוק את המשמרת?', 'מחיקת משמרת')) return;
    
    try {
        await apiRequest(`/api/schedules/shifts/${shiftId}`, {
            method: 'DELETE'
        });
        
        await loadScheduleEditor(currentSchedule.id);
    } catch (error) {
        console.error('Error deleting shift:', error);
        await customAlert('שגיאה במחיקת משמרת', 'שגיאה');
    }
}

/**
 * Delete unit
 */
async function deleteUnit(unitId) {
    if (!await customConfirm('האם למחוק את היחידה?', 'מחיקת יחידה')) return;
    
    try {
        await apiRequest(`/api/schedules/units/${unitId}`, {
            method: 'DELETE'
        });
        
        await loadScheduleEditor(currentSchedule.id);
    } catch (error) {
        console.error('Error deleting unit:', error);
        await customAlert('שגיאה במחיקת יחידה', 'שגיאה');
    }
}

/**
 * Edit ambulance number
 */
async function editAmbulanceNumber(roleId, currentNumber) {
    const newNumber = await customPrompt('הזן מספר אמבולנס (השאר ריק כדי למחוק)', currentNumber || '', 'מספר אמבולנס');
    if (newNumber === null) return; // User cancelled
    
    // Allow empty string to delete the ambulance number
    const ambulanceValue = newNumber.trim() === '' ? null : newNumber.trim();
    
    try {
        const response = await apiRequest(`/api/schedules/roles/${roleId}`, {
            method: 'PUT',
            body: JSON.stringify({ ambulance_number: ambulanceValue })
        });
        
        // Response might be a single role or array of roles (for אטן units)
        const updatedRoles = Array.isArray(response) ? response : [response];
        
        // Update DOM for all affected roles
        updatedRoles.forEach(role => {
            const roleItem = document.querySelector(`.role-item[data-role-id="${role.id}"]`);
            if (roleItem) {
                const ambulanceSpan = roleItem.querySelector('.ambulance-number');
                if (ambulanceSpan) {
                    ambulanceSpan.textContent = role.ambulance_number ? `🚑 ${role.ambulance_number}` : '🚑 [הוסף אמבולנס]';
                    ambulanceSpan.onclick = () => editAmbulanceNumber(role.id, role.ambulance_number);
                }
            }
        });
    } catch (error) {
        console.error('Error updating ambulance number:', error);
        await customAlert('שגיאה בעדכון מספר אמבולנס', 'שגיאה');
    }
}

/**
 * Edit role name
 */
async function editRoleName(roleId, currentName) {
    const newName = await customPrompt('', currentName, 'ערוך שם תפקיד');
    if (!newName || newName === currentName) return;
    
    try {
        await apiRequest(`/api/schedules/roles/${roleId}`, {
            method: 'PUT',
            body: JSON.stringify({ role_name: newName })
        });
        
        await loadScheduleEditor(currentSchedule.id);
    } catch (error) {
        console.error('Error updating role:', error);
        await customAlert('שגיאה בעדכון תפקיד', 'שגיאה');
    }
}

/**
 * Delete role
 */
async function deleteRole(roleId) {
    if (!await customConfirm('האם למחוק את התפקיד?', 'מחיקת תפקיד')) return;
    
    try {
        await apiRequest(`/api/schedules/roles/${roleId}`, {
            method: 'DELETE'
        });
        
        await loadScheduleEditor(currentSchedule.id);
    } catch (error) {
        console.error('Error deleting role:', error);
        await customAlert('שגיאה במחיקת תפקיד', 'שגיאה');
    }
}

/**
 * Remove assignment
 */
async function removeAssignment(assignmentId, roleId) {
    console.log('🗑️ Removing assignment:', { assignmentId, roleId });
    try {
        const response = await apiRequest(`/api/schedules/assignments/${assignmentId}`, {
            method: 'DELETE'
        });
        console.log('✅ Assignment removed successfully:', response);
        
        // Update DOM directly
        const roleItem = document.querySelector(`.role-item[data-role-id="${roleId}"]`);
        if (roleItem) {
            const assignedEmployeeDiv = roleItem.querySelector('.assigned-employee');
            const roleActionsDiv = roleItem.querySelector('.role-actions');
            
            // Update employee name to "לא משובץ"
            if (assignedEmployeeDiv) {
                assignedEmployeeDiv.textContent = 'לא משובץ';
            }
            
            // Remove "has-employee" class
            roleItem.classList.remove('has-employee');
            
            // Clear assignment ID
            roleItem.dataset.assignmentId = '';
            
            // Remove the "הסר" button
            if (roleActionsDiv) {
                const removeBtn = roleActionsDiv.querySelector('button:first-child');
                const deleteBtn = roleActionsDiv.querySelector('button:last-child');
                if (removeBtn && removeBtn !== deleteBtn) {
                    removeBtn.remove();
                }
            }
        }
    } catch (error) {
        console.error('❌ Error removing assignment:', error);
        await customAlert('שגיאה בהסרת שיבוץ', 'שגיאה');
    }
}

/**
 * Setup drag and drop for employees
 */
function setupEmployeeDragDrop() {
    const employeeItems = document.querySelectorAll('.employee-item');
    const roleItems = document.querySelectorAll('.role-item');
    
    employeeItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('employeeId', item.dataset.employeeId);
            item.classList.add('dragging');
        });
        
        item.addEventListener('dragend', (e) => {
            item.classList.remove('dragging');
        });
    });
    
    roleItems.forEach(item => {
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            item.classList.add('drag-over');
        });
        
        item.addEventListener('dragleave', (e) => {
            item.classList.remove('drag-over');
        });
        
        item.addEventListener('drop', async (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            
            const employeeId = e.dataTransfer.getData('employeeId');
            const roleId = item.dataset.roleId;
            
            await assignEmployee(roleId, employeeId);
        });
    });
}

/**
 * Manually assign employee (by name) to role
 */
async function manuallyAssignEmployee(roleId) {
    try {
        const employeeName = await customPrompt('הזן שם העובד לשיבוץ:', '', 'שיבוץ ידני');
        
        if (!employeeName || employeeName.trim() === '') {
            return;
        }
        
        // Check if this name matches an existing employee
        const matchingEmployee = allEmployees.find(e => 
            `${e.first_name} ${e.last_name}`.trim() === employeeName.trim() ||
            `${e.last_name} ${e.first_name}`.trim() === employeeName.trim()
        );
        
        if (matchingEmployee) {
            // Use regular assignment for existing employees
            await assignEmployee(roleId, matchingEmployee.id);
        } else {
            // Manual assignment for non-existing employee
            const response = await apiRequest('/api/schedules/assignments', {
                method: 'POST',
                body: JSON.stringify({
                    role_id: parseInt(roleId),
                    employee_id: null, // null for manual assignment
                    manual_employee_name: employeeName.trim(),
                    schedule_id: currentSchedule.id
                })
            });
            
            console.log('Manual assignment successful:', response);
            
            // Update the DOM directly
            const roleItem = document.querySelector(`.role-item[data-role-id="${roleId}"]`);
            if (roleItem) {
                const assignedEmployeeDiv = roleItem.querySelector('.assigned-employee');
                const roleActionsDiv = roleItem.querySelector('.role-actions');
                
                // Update employee name
                if (assignedEmployeeDiv) {
                    assignedEmployeeDiv.textContent = employeeName.trim();
                    assignedEmployeeDiv.style.fontStyle = 'italic'; // Indicate it's a manual entry
                    assignedEmployeeDiv.title = 'שיבוץ ידני (לא מרשימת העובדים)';
                }
                
                // Add "has-employee" class
                roleItem.classList.add('has-employee');
                
                // Update assignment ID
                roleItem.dataset.assignmentId = response.id;
                
                // Add remove button if not exists
                if (roleActionsDiv) {
                    const existingRemoveBtn = roleActionsDiv.querySelector('button:first-child');
                    const deleteBtn = roleActionsDiv.querySelector('button:last-child');
                    
                    if (!existingRemoveBtn || existingRemoveBtn.textContent !== 'הסר') {
                        const newRemoveBtn = document.createElement('button');
                        newRemoveBtn.className = 'btn btn-secondary btn-small';
                        newRemoveBtn.textContent = 'הסר';
                        newRemoveBtn.onclick = () => removeAssignment(response.id, roleId);
                        roleActionsDiv.insertBefore(newRemoveBtn, roleActionsDiv.firstChild);
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('Error manually assigning employee:', error);
        await customAlert('שגיאה בשיבוץ ידני: ' + (error.message || 'שגיאה לא ידועה'), 'שגיאה');
    }
}

/**
 * Assign employee to role
 */
async function assignEmployee(roleId, employeeId) {
    try {
        console.log('Assigning employee:', { roleId, employeeId, scheduleId: currentSchedule.id });
        
        // Check if employee is already assigned in this schedule
        const existingAssignments = [];
        document.querySelectorAll('.role-item').forEach(item => {
            const assignmentId = item.dataset.assignmentId;
            if (assignmentId && assignmentId !== '') {
                const roleIdAttr = item.dataset.roleId;
                const assignedEmployeeText = item.querySelector('.assigned-employee')?.textContent;
                const employee = allEmployees.find(e => 
                    assignedEmployeeText === `${e.first_name} ${e.last_name}` && e.id == employeeId
                );
                if (employee) {
                    existingAssignments.push({ roleId: roleIdAttr, assignmentId });
                }
            }
        });
        
        if (existingAssignments.length > 0) {
            // Employee already assigned, ask user what to do
            const choice = await customSelect(
                'העובד כבר משובץ בסידור זה. מה תרצה לעשות?',
                [
                    { value: 'both', label: 'שיבוץ גם לתפקיד השני (שתי משימות)' },
                    { value: 'move', label: 'העבר לתפקיד החדש (הסר מהראשון)' },
                    { value: 'cancel', label: 'ביטול' }
                ],
                'עובד כבר משובץ'
            );
            
            if (choice === 'cancel' || !choice) return;
            
            if (choice === 'move') {
                // Remove from existing assignments
                for (const existing of existingAssignments) {
                    await apiRequest(`/api/schedules/assignments/${existing.assignmentId}`, {
                        method: 'DELETE'
                    });
                    
                    // Update DOM for removed assignment
                    const oldRoleItem = document.querySelector(`.role-item[data-role-id="${existing.roleId}"]`);
                    if (oldRoleItem) {
                        const assignedEmployeeDiv = oldRoleItem.querySelector('.assigned-employee');
                        if (assignedEmployeeDiv) {
                            assignedEmployeeDiv.textContent = 'לא משובץ';
                        }
                        oldRoleItem.classList.remove('has-employee');
                        oldRoleItem.dataset.assignmentId = '';
                        
                        const roleActionsDiv = oldRoleItem.querySelector('.role-actions');
                        if (roleActionsDiv) {
                            const removeBtn = roleActionsDiv.querySelector('button:first-child');
                            const deleteBtn = roleActionsDiv.querySelector('button:last-child');
                            if (removeBtn && removeBtn !== deleteBtn) {
                                removeBtn.remove();
                            }
                        }
                    }
                }
            }
            // If 'both', just continue to assign
        }
        
        const response = await apiRequest('/api/schedules/assignments', {
            method: 'POST',
            body: JSON.stringify({
                role_id: parseInt(roleId),
                employee_id: parseInt(employeeId),
                schedule_id: currentSchedule.id
            })
        });
        
        console.log('Assignment successful:', response);
        
        // Find the employee data
        const employee = allEmployees.find(e => e.id == employeeId);
        if (!employee) return;
        
        // Update the DOM directly instead of reloading
        const roleItem = document.querySelector(`.role-item[data-role-id="${roleId}"]`);
        if (roleItem) {
            const assignedEmployeeDiv = roleItem.querySelector('.assigned-employee');
            const roleActionsDiv = roleItem.querySelector('.role-actions');
            
            // Update employee name
            if (assignedEmployeeDiv) {
                assignedEmployeeDiv.textContent = `${employee.first_name} ${employee.last_name}`;
            }
            
            // Add "has-employee" class
            roleItem.classList.add('has-employee');
            
            // Update assignment ID
            roleItem.dataset.assignmentId = response.id;
            
            // Add remove button if not exists
            if (roleActionsDiv) {
                const deleteBtn = roleActionsDiv.querySelector('button:last-child');
                const removeBtn = roleActionsDiv.querySelector('button:first-child');
                
                if (!removeBtn || removeBtn === deleteBtn) {
                    const newRemoveBtn = document.createElement('button');
                    newRemoveBtn.className = 'btn btn-secondary btn-small';
                    newRemoveBtn.textContent = 'הסר';
                    newRemoveBtn.onclick = () => removeAssignment(response.id, roleId);
                    roleActionsDiv.insertBefore(newRemoveBtn, deleteBtn);
                }
            }
        }
        
    } catch (error) {
        console.error('Error assigning employee:', error);
        await customAlert('שגיאה בשיבוץ עובד: ' + (error.message || 'שגיאה לא ידועה'), 'שגיאה');
    }
}

/**
 * Edit schedule date
 */
async function editScheduleDate() {
    if (!currentSchedule) return;
    
    const currentDate = currentSchedule.schedule_date;
    const newDate = await customPrompt('תאריך בפורמט YYYY-MM-DD', currentDate, 'עדכון תאריך');
    
    if (!newDate || newDate === currentDate) return;
    
    try {
        await apiRequest(`/api/schedules/${currentSchedule.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                schedule_date: newDate,
                station: newDate, // Use date as identifier
                status: currentSchedule.status
            })
        });
        
        currentSchedule.schedule_date = newDate;
        document.getElementById('scheduleDate').textContent = formatDate(newDate);
        await loadSchedules();
    } catch (error) {
        console.error('Error updating date:', error);
        await customAlert('שגיאה בעדכון תאריך', 'שגיאה');
    }
}

/**
 * Edit schedule status
 */
async function editScheduleStatus() {
    if (!currentSchedule) return;
    
    const statuses = [
        { value: 'draft', label: 'טיוטה' },
        { value: 'published', label: 'פורסם' },
        { value: 'archived', label: 'בארכיון' }
    ];
    
    const statusLabels = statuses.map(s => s.label);
    const currentStatus = getStatusText(currentSchedule.status);
    
    const choice = await customSelect(`סטטוס נוכחי: ${currentStatus}`, statusLabels, 'עדכון סטטוס');
    
    if (choice === null) return;
    
    const newStatus = statuses[choice].value;
    if (newStatus === currentSchedule.status) return;
    
    try {
        await apiRequest(`/api/schedules/${currentSchedule.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                schedule_date: currentSchedule.schedule_date,
                station: currentSchedule.schedule_date, // Use date as identifier
                status: newStatus
            })
        });
        
        currentSchedule.status = newStatus;
        document.getElementById('scheduleStatus').textContent = getStatusText(newStatus);
        document.getElementById('scheduleStatus').className = `status-badge ${newStatus} editable`;
        await loadSchedules();
    } catch (error) {
        console.error('Error updating status:', error);
        await customAlert('שגיאה בעדכון סטטוס', 'שגיאה');
    }
}

/**
 * Delete schedule from list view
 */
async function deleteScheduleFromList(scheduleId) {
    const confirmed = await customConfirm('האם אתה בטוח שברצונך למחוק סידור עבודה זה?', 'מחיקת סידור');
    if (!confirmed) return;
    
    try {
        await apiRequest(`/api/schedules/${scheduleId}`, {
            method: 'DELETE'
        });
        
        // Reload schedules list
        await loadSchedules();
        
        await customAlert('סידור נמחק בהצלחה', 'הצלחה');
    } catch (error) {
        console.error('Error deleting schedule:', error);
        await customAlert('שגיאה במחיקת סידור', 'שגיאה');
    }
}

/**
 * Load and display schedule notes
 */
function loadScheduleNotes() {
    if (!currentSchedule) return;
    
    let notes = [];
    try {
        notes = currentSchedule.notes ? JSON.parse(currentSchedule.notes) : [];
        if (!Array.isArray(notes)) {
            // If notes is a string (old format), convert to array
            notes = currentSchedule.notes ? [currentSchedule.notes] : [];
        }
    } catch (e) {
        // If parsing fails, treat as single note
        notes = currentSchedule.notes ? [currentSchedule.notes] : [];
    }
    
    renderNotesList(notes);
}

/**
 * Render notes list
 */
function renderNotesList(notes) {
    const container = document.getElementById('notesList');
    
    console.log('Rendering notes:', notes);
    
    if (!notes || notes.length === 0) {
        container.innerHTML = '<p style="color: #999; font-style: italic;">אין הערות</p>';
        return;
    }
    
    container.innerHTML = notes.map((note, index) => `
        <div style="display: flex; gap: 10px; align-items: center; padding: 8px; background: white; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 5px;">
            <span style="flex: 1;">${note}</span>
            <button onclick="deleteNote(${index})" class="btn btn-danger btn-small" style="padding: 4px 8px; font-size: 12px;">מחק</button>
        </div>
    `).join('');
}

/**
 * Add new note
 */
async function addNote() {
    if (!currentSchedule) return;
    
    const input = document.getElementById('newNoteInput');
    const noteText = input.value.trim();
    
    if (!noteText) {
        await customAlert('נא להזין טקסט להערה', 'שגיאה');
        return;
    }
    
    try {
        let notes = [];
        try {
            notes = currentSchedule.notes ? JSON.parse(currentSchedule.notes) : [];
            if (!Array.isArray(notes)) {
                notes = currentSchedule.notes ? [currentSchedule.notes] : [];
            }
        } catch (e) {
            notes = currentSchedule.notes ? [currentSchedule.notes] : [];
        }
        
        console.log('Current notes before add:', notes);
        notes.push(noteText);
        console.log('Notes after add:', notes);
        
        const response = await apiRequest(`/api/schedules/${currentSchedule.id}`, {
            method: 'PUT',
            body: JSON.stringify({ notes: JSON.stringify(notes) })
        });
        
        console.log('API response:', response);
        
        currentSchedule.notes = JSON.stringify(notes);
        input.value = '';
        renderNotesList(notes);
    } catch (error) {
        console.error('Error adding note:', error);
        await customAlert('שגיאה בהוספת הערה', 'שגיאה');
    }
}

/**
 * Delete note
 */
async function deleteNote(index) {
    if (!currentSchedule) return;
    
    const confirmed = await customConfirm('האם למחוק הערה זו?', 'מחיקת הערה');
    if (!confirmed) return;
    
    try {
        let notes = [];
        try {
            notes = currentSchedule.notes ? JSON.parse(currentSchedule.notes) : [];
            if (!Array.isArray(notes)) {
                notes = currentSchedule.notes ? [currentSchedule.notes] : [];
            }
        } catch (e) {
            notes = currentSchedule.notes ? [currentSchedule.notes] : [];
        }
        
        notes.splice(index, 1);
        
        await apiRequest(`/api/schedules/${currentSchedule.id}`, {
            method: 'PUT',
            body: JSON.stringify({ notes: JSON.stringify(notes) })
        });
        
        currentSchedule.notes = JSON.stringify(notes);
        renderNotesList(notes);
    } catch (error) {
        console.error('Error deleting note:', error);
        await customAlert('שגיאה במחיקת הערה', 'שגיאה');
    }
}

/**
 * Load and display extra missions (משימות מחוץ למשמרת)
 */
async function loadExtraMissions() {
    if (!currentSchedule) return;
    
    try {
        const extraMissions = await apiRequest(`/api/schedules/${currentSchedule.id}/extra-missions`);
        renderExtraMissionsList(extraMissions || []);
    } catch (error) {
        console.error('Error loading extra missions:', error);
        renderExtraMissionsList([]);
    }
}

/**
 * Render extra missions list
 */
function renderExtraMissionsList(extraMissions) {
    const container = document.getElementById('extraMissionsList');
    
    if (!extraMissions || extraMissions.length === 0) {
        container.innerHTML = '<p style="color: #999; font-style: italic;">אין משימות נוספות</p>';
        return;
    }
    
    container.innerHTML = extraMissions.map((item, index) => `
        <div data-mission-id="${item.id}" style="padding: 12px; background: white; border: 2px solid #2196F3; border-radius: 4px; margin-bottom: 10px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 8px;">
                <div><strong>שעות:</strong> ${item.hours}</div>
                <div><strong>מיקום:</strong> ${item.location}</div>
                <div><strong>רכב:</strong> ${item.vehicle || '-'}</div>
                <div><strong>נהג:</strong> ${item.driver_name || '-'}</div>
            </div>
            ${item.notes ? `<div style="margin-bottom: 8px;"><strong>הערות:</strong> ${item.notes}</div>` : ''}
            <div style="display: flex; gap: 5px;">
                <button onclick="editExtraMission(${item.id}, '${item.hours.replace(/'/g, "\\'")}', '${item.location.replace(/'/g, "\\'")}', '${(item.vehicle || '').replace(/'/g, "\\'")}', '${(item.driver_name || '').replace(/'/g, "\\'")}', '${(item.notes || '').replace(/'/g, "\\'")}')\" class="btn btn-secondary btn-small" style="padding: 4px 8px; font-size: 12px;">ערוך</button>
                <button onclick="deleteExtraMission(${item.id})" class="btn btn-danger btn-small" style="padding: 4px 8px; font-size: 12px;">מחק</button>
            </div>
        </div>
    `).join('');
}

/**
 * Add new extra mission
 */
async function addExtraMission() {
    if (!currentSchedule) return;
    
    const hours = document.getElementById('missionHours').value.trim();
    const location = document.getElementById('missionLocation').value.trim();
    const vehicle = document.getElementById('missionVehicle').value.trim();
    const driverName = document.getElementById('missionDriverName').value.trim();
    const notes = document.getElementById('missionNotes').value.trim();
    
    if (!hours || !location) {
        await customAlert('נא למלא לפחות שעות ומיקום', 'שגיאה');
        return;
    }
    
    try {
        await apiRequest(`/api/schedules/${currentSchedule.id}/extra-missions`, {
            method: 'POST',
            body: JSON.stringify({
                hours: hours,
                location: location,
                vehicle: vehicle,
                driver_name: driverName,
                notes: notes
            })
        });
        
        // Clear inputs
        document.getElementById('missionHours').value = '';
        document.getElementById('missionLocation').value = '';
        document.getElementById('missionVehicle').value = '';
        document.getElementById('missionDriverName').value = '';
        document.getElementById('missionNotes').value = '';
        
        await loadExtraMissions();
    } catch (error) {
        console.error('Error adding extra mission:', error);
        await customAlert('שגיאה בהוספת משימה נוספת', 'שגיאה');
    }
}

/**
 * Edit extra mission - inline editing
 */
function editExtraMission(id, currentHours, currentLocation, currentVehicle, currentDriver, currentNotes) {
    const container = document.getElementById('extraMissionsList');
    const cards = container.querySelectorAll('div[data-mission-id]');
    
    let targetCard = null;
    cards.forEach(card => {
        if (parseInt(card.dataset.missionId) === id) {
            targetCard = card;
        }
    });
    
    if (!targetCard) return;
    
    // Store original content
    targetCard.dataset.originalContent = targetCard.innerHTML;
    
    // Create inline edit form
    targetCard.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">שעות:</label>
                <input type="text" id="edit-mission-hours-${id}" value="${currentHours}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px;">
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">מיקום:</label>
                <input type="text" id="edit-mission-location-${id}" value="${currentLocation}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px;">
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">רכב:</label>
                <input type="text" id="edit-mission-vehicle-${id}" value="${currentVehicle}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px;">
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">שם נהג:</label>
                <input type="text" id="edit-mission-driver-${id}" value="${currentDriver}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px;">
            </div>
        </div>
        <div style="margin-bottom: 10px;">
            <label style="font-weight: bold; display: block; margin-bottom: 5px;">הערות:</label>
            <input type="text" id="edit-mission-notes-${id}" value="${currentNotes}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px;">
        </div>
        <div style="display: flex; gap: 5px;">
            <button onclick="saveExtraMissionEdit(${id})" class="btn btn-primary btn-small" style="padding: 6px 12px; font-size: 12px;">שמור</button>
            <button onclick="cancelExtraMissionEdit(${id})" class="btn btn-secondary btn-small" style="padding: 6px 12px; font-size: 12px;">ביטול</button>
        </div>
    `;
}

/**
 * Save extra mission edits
 */
async function saveExtraMissionEdit(id) {
    const hours = document.getElementById(`edit-mission-hours-${id}`).value.trim();
    const location = document.getElementById(`edit-mission-location-${id}`).value.trim();
    const vehicle = document.getElementById(`edit-mission-vehicle-${id}`).value.trim();
    const driverName = document.getElementById(`edit-mission-driver-${id}`).value.trim();
    const notes = document.getElementById(`edit-mission-notes-${id}`).value.trim();
    
    if (!hours || !location) {
        await customAlert('נא למלא לפחות שעות ומיקום', 'שגיאה');
        return;
    }
    
    try {
        await apiRequest(`/api/schedules/extra-missions/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                hours: hours,
                location: location,
                vehicle: vehicle,
                driver_name: driverName,
                notes: notes
            })
        });
        
        await loadExtraMissions();
    } catch (error) {
        console.error('Error editing extra mission:', error);
        await customAlert('שגיאה בעריכת משימה נוספת', 'שגיאה');
    }
}

/**
 * Cancel extra mission edit
 */
function cancelExtraMissionEdit(id) {
    const container = document.getElementById('extraMissionsList');
    const cards = container.querySelectorAll('div[data-mission-id]');
    
    cards.forEach(card => {
        if (parseInt(card.dataset.missionId) === id && card.dataset.originalContent) {
            card.innerHTML = card.dataset.originalContent;
            delete card.dataset.originalContent;
        }
    });
}

/**
 * Delete extra mission
 */
async function deleteExtraMission(id) {
    const confirmed = await customConfirm('האם למחוק משימה זו?', 'מחיקת משימה נוספת');
    if (!confirmed) return;
    
    try {
        await apiRequest(`/api/schedules/extra-missions/${id}`, {
            method: 'DELETE'
        });
        
        await loadExtraMissions();
    } catch (error) {
        console.error('Error deleting extra mission:', error);
        await customAlert('שגיאה במחיקת משימה נוספת', 'שגיאה');
    }
}

/**
 * Load and display extra ambulances (מעל התקן)
 */
async function loadExtraAmbulances() {
    if (!currentSchedule) return;
    
    try {
        const extraAmbulances = await apiRequest(`/api/schedules/${currentSchedule.id}/extra-ambulances`);
        renderExtraAmbulancesList(extraAmbulances || []);
    } catch (error) {
        console.error('Error loading extra ambulances:', error);
        renderExtraAmbulancesList([]);
    }
}

/**
 * Render extra ambulances list
 */
function renderExtraAmbulancesList(extraAmbulances) {
    const container = document.getElementById('extraAmbulancesList');
    
    if (!extraAmbulances || extraAmbulances.length === 0) {
        container.innerHTML = '<p style="color: #999; font-style: italic;">אין מעל התקן</p>';
        return;
    }
    
    container.innerHTML = extraAmbulances.map((item, index) => `
        <div data-ambulance-id="${item.id}" style="padding: 12px; background: white; border: 2px solid #ffc107; border-radius: 4px; margin-bottom: 10px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 8px;">
                <div><strong>שעות:</strong> ${item.working_hours}</div>
                <div><strong>תחנה:</strong> ${item.station}</div>
                <div><strong>אמבולנס:</strong> ${item.ambulance_number || '-'}</div>
                <div><strong>נהג:</strong> ${item.driver_name || '-'}</div>
            </div>
            ${item.notes ? `<div style="margin-bottom: 8px;"><strong>הערות:</strong> ${item.notes}</div>` : ''}
            <div style="display: flex; gap: 5px;">
                <button onclick="editExtraAmbulance(${item.id}, '${item.working_hours.replace(/'/g, "\\'")}',' ${item.station.replace(/'/g, "\\'")}',' ${(item.ambulance_number || '').replace(/'/g, "\\'")}',' ${(item.driver_name || '').replace(/'/g, "\\'")}',' ${(item.notes || '').replace(/'/g, "\\'")}')" class="btn btn-secondary btn-small" style="padding: 4px 8px; font-size: 12px;">ערוך</button>
                <button onclick="deleteExtraAmbulance(${item.id})" class="btn btn-danger btn-small" style="padding: 4px 8px; font-size: 12px;">מחק</button>
            </div>
        </div>
    `).join('');
}

/**
 * Add new extra ambulance
 */
async function addExtraAmbulance() {
    if (!currentSchedule) return;
    
    const workingHours = document.getElementById('extraWorkingHours').value.trim();
    const station = document.getElementById('extraStation').value.trim();
    const ambulanceNumber = document.getElementById('extraAmbulanceNumber').value.trim();
    const driverName = document.getElementById('extraDriverName').value.trim();
    const notes = document.getElementById('extraNotes').value.trim();
    
    if (!workingHours || !station) {
        await customAlert('נא למלא לפחות שעות עבודה ותחנה', 'שגיאה');
        return;
    }
    
    try {
        await apiRequest(`/api/schedules/${currentSchedule.id}/extra-ambulances`, {
            method: 'POST',
            body: JSON.stringify({
                working_hours: workingHours,
                station: station,
                ambulance_number: ambulanceNumber,
                driver_name: driverName,
                notes: notes
            })
        });
        
        // Clear inputs
        document.getElementById('extraWorkingHours').value = '';
        document.getElementById('extraStation').value = '';
        document.getElementById('extraAmbulanceNumber').value = '';
        document.getElementById('extraDriverName').value = '';
        document.getElementById('extraNotes').value = '';
        
        await loadExtraAmbulances();
    } catch (error) {
        console.error('Error adding extra ambulance:', error);
        await customAlert('שגיאה בהוספת מעל התקן', 'שגיאה');
    }
}

/**
 * Edit extra ambulance - inline editing
 */
function editExtraAmbulance(id, currentHours, currentStation, currentNumber, currentDriver, currentNotes) {
    const container = document.getElementById('extraAmbulancesList');
    const cards = container.querySelectorAll('div[data-ambulance-id]');
    
    let targetCard = null;
    cards.forEach(card => {
        if (parseInt(card.dataset.ambulanceId) === id) {
            targetCard = card;
        }
    });
    
    if (!targetCard) return;
    
    // Store original content
    targetCard.dataset.originalContent = targetCard.innerHTML;
    
    // Create inline edit form
    targetCard.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">שעות:</label>
                <input type="text" id="edit-ambulance-hours-${id}" value="${currentHours}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px;">
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">תחנה:</label>
                <input type="text" id="edit-ambulance-station-${id}" value="${currentStation}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px;">
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">אמבולנס:</label>
                <input type="text" id="edit-ambulance-number-${id}" value="${currentNumber}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px;">
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">שם נהג:</label>
                <input type="text" id="edit-ambulance-driver-${id}" value="${currentDriver}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px;">
            </div>
        </div>
        <div style="margin-bottom: 10px;">
            <label style="font-weight: bold; display: block; margin-bottom: 5px;">הערות:</label>
            <input type="text" id="edit-ambulance-notes-${id}" value="${currentNotes}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px;">
        </div>
        <div style="display: flex; gap: 5px;">
            <button onclick="saveExtraAmbulanceEdit(${id})" class="btn btn-primary btn-small" style="padding: 6px 12px; font-size: 12px;">שמור</button>
            <button onclick="cancelExtraAmbulanceEdit(${id})" class="btn btn-secondary btn-small" style="padding: 6px 12px; font-size: 12px;">ביטול</button>
        </div>
    `;
}

/**
 * Save extra ambulance edits
 */
async function saveExtraAmbulanceEdit(id) {
    const workingHours = document.getElementById(`edit-ambulance-hours-${id}`).value.trim();
    const station = document.getElementById(`edit-ambulance-station-${id}`).value.trim();
    const ambulanceNumber = document.getElementById(`edit-ambulance-number-${id}`).value.trim();
    const driverName = document.getElementById(`edit-ambulance-driver-${id}`).value.trim();
    const notes = document.getElementById(`edit-ambulance-notes-${id}`).value.trim();
    
    if (!workingHours || !station) {
        await customAlert('נא למלא לפחות שעות עבודה ותחנה', 'שגיאה');
        return;
    }
    
    try {
        await apiRequest(`/api/schedules/extra-ambulances/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                working_hours: workingHours,
                station: station,
                ambulance_number: ambulanceNumber,
                driver_name: driverName,
                notes: notes
            })
        });
        
        await loadExtraAmbulances();
    } catch (error) {
        console.error('Error editing extra ambulance:', error);
        await customAlert('שגיאה בעריכת מעל התקן', 'שגיאה');
    }
}

/**
 * Cancel extra ambulance edit
 */
function cancelExtraAmbulanceEdit(id) {
    const container = document.getElementById('extraAmbulancesList');
    const cards = container.querySelectorAll('div[data-ambulance-id]');
    
    cards.forEach(card => {
        if (parseInt(card.dataset.ambulanceId) === id && card.dataset.originalContent) {
            card.innerHTML = card.dataset.originalContent;
            delete card.dataset.originalContent;
        }
    });
}

/**
 * Delete extra ambulance
 */
async function deleteExtraAmbulance(id) {
    const confirmed = await customConfirm('האם למחוק רשומה זו?', 'מחיקת מעל התקן');
    if (!confirmed) return;
    
    try {
        await apiRequest(`/api/schedules/extra-ambulances/${id}`, {
            method: 'DELETE'
        });
        
        await loadExtraAmbulances();
    } catch (error) {
        console.error('Error deleting extra ambulance:', error);
        await customAlert('שגיאה במחיקת מעל התקן', 'שגיאה');
    }
}

/**
 * Delete current schedule
 */
/**
 * Delete schedule
 */
async function deleteSchedule() {
    if (!currentSchedule) return;
    
    const confirmed = await customConfirm(
        `האם אתה בטוח שברצונך למחוק את סידור העבודה?\n\nתחנה: ${currentSchedule.station}\nתאריך: ${formatDate(currentSchedule.schedule_date)}\n\nפעולה זו לא ניתנת לביטול!`,
        'מחיקת סידור עבודה'
    );
    
    if (!confirmed) return;
    
    try {
        await apiRequest(`/api/schedules/${currentSchedule.id}`, {
            method: 'DELETE'
        });
        
        await customAlert('סידור העבודה נמחק בהצלחה', 'הצלחה');
        
        // Close editor and reload schedules list
        document.getElementById('scheduleEditor').style.display = 'none';
        document.getElementById('scheduleSelection').style.display = 'block';
        currentSchedule = null;
        
        await loadSchedules();
    } catch (error) {
        console.error('Error deleting schedule:', error);
        await customAlert('שגיאה במחיקת סידור עבודה', 'שגיאה');
    }
}

/**
 * Export to HTML
 */
function exportToHtml() {
    if (!currentSchedule) return;
    window.open(`/api/export/html/${currentSchedule.id}`, '_blank');
}

/**
 * Export to PDF
 */
function exportToPdf() {
    if (!currentSchedule) return;
    window.open(`/api/export/pdf/${currentSchedule.id}`, '_blank');
}

/**
 * Initialize Supabase realtime collaboration
 */
async function initializeRealtime() {
    try {
        console.log('🔵 Initializing realtime...');
        
        // Get current user
        const userResponse = await apiRequest('/api/auth/status');
        currentUser = userResponse.user;
        console.log('✅ User:', currentUser);
        
        // Get Supabase config
        const config = await apiRequest('/api/auth/supabase-config');
        console.log('✅ Config received:', { url: config.url, hasKey: !!config.anonKey });
        
        // Check if Supabase library is loaded
        if (typeof window.supabase === 'undefined') {
            console.error('❌ Supabase library not loaded - check CDN');
            return;
        }
        console.log('✅ Supabase library loaded:', typeof window.supabase);
        
        // Initialize Supabase client with service_role key (full permissions)
        supabaseClient = window.supabase.createClient(config.url, config.anonKey);
        console.log('✅ Supabase client created with service_role key:', !!supabaseClient);
        console.log('✅ Realtime collaboration initialized');
    } catch (error) {
        console.error('❌ Error initializing realtime:', error);
    }
}

/**
 * Subscribe to realtime changes for a schedule
 */
function subscribeToSchedule(scheduleId) {
    if (!supabaseClient || !scheduleId) {
        console.error('❌ Cannot subscribe - missing client or scheduleId:', { client: !!supabaseClient, scheduleId });
        return;
    }
    
    console.log('🔵 Subscribing to schedule:', scheduleId);
    
    // Unsubscribe from previous channel
    if (realtimeChannel) {
        console.log('🟡 Removing previous channel');
        supabaseClient.removeChannel(realtimeChannel);
    }
    
    // Create channel for this schedule
    realtimeChannel = supabaseClient.channel(`schedule-${scheduleId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'schedules',
            filter: `id=eq.${scheduleId}`
        }, (payload) => {
            console.log('📡 RAW EVENT - schedules:', payload);
            handleScheduleChange(payload);
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'shifts',
            filter: `schedule_id=eq.${scheduleId}`
        }, (payload) => {
            console.log('📡 RAW EVENT - shifts:', payload);
            handleShiftChange(payload);
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'units'
        }, (payload) => {
            console.log('📡 RAW EVENT - units:', payload);
            handleUnitChange(payload, scheduleId);
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'roles'
        }, (payload) => {
            console.log('📡 RAW EVENT - roles:', payload);
            handleRoleChange(payload, scheduleId);
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'assignments',
            filter: `schedule_id=eq.${scheduleId}`
        }, (payload) => {
            console.log('📡 RAW EVENT - assignments:', payload);
            handleAssignmentChange(payload);
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'employees'
        }, (payload) => {
            console.log('📡 RAW EVENT - employees:', payload);
            handleEmployeeChange(payload);
        })
        .subscribe((status) => {
            console.log('🔴 Subscription status:', status);
            console.log('🔴 Channel object:', realtimeChannel);
            console.log('🔴 Active listeners:', {
                schedules: 'schedules',
                shifts: 'shifts',
                units: 'units',
                roles: 'roles',
                assignments: 'assignments',
                employees: 'employees'
            });
            if (status === 'SUBSCRIBED') {
                console.log('✅ Live collaboration active for schedule:', scheduleId);
                console.log('✅ Waiting for database changes... Make a change in another tab to test!');
                showRealtimeIndicator(true);
            } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ Realtime connection error');
                showRealtimeIndicator(false);
            } else if (status === 'TIMED_OUT') {
                console.error('⏱️ Realtime connection timeout');
                showRealtimeIndicator(false);
            } else if (status === 'CLOSED') {
                console.log('🟡 Channel closed');
                showRealtimeIndicator(false);
            }
        });
}

/**
 * Unsubscribe from realtime
 */
function unsubscribeFromSchedule() {
    if (realtimeChannel && supabaseClient) {
        supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
        showRealtimeIndicator(false);
        console.log('⚫ Live collaboration paused');
    }
}

/**
 * Handle schedule changes (status, date, etc.)
 */
async function handleScheduleChange(payload) {
    console.log('📡 REALTIME EVENT - Schedule:', payload.eventType, payload);
    if (isUpdatingFromRealtime || !currentSchedule) {
        console.log('⏭️ Skipping - already updating or no schedule');
        return;
    }
    
    console.log('🔄 Schedule changed:', payload.eventType);
    isUpdatingFromRealtime = true;
    
    try {
        const updatedSchedule = await apiRequest(`/api/schedules/${currentSchedule.id}`);
        currentSchedule = updatedSchedule;
        
        // Update schedule info
        document.getElementById('scheduleDate').textContent = formatDate(currentSchedule.schedule_date);
        document.getElementById('scheduleStatus').textContent = getStatusText(currentSchedule.status);
        document.getElementById('scheduleStatus').className = `status-badge ${currentSchedule.status}`;
        
        displayShifts();
        showRealtimeNotification('עדכון פרטי סידור');
    } catch (error) {
        console.error('Error handling schedule change:', error);
    } finally {
        isUpdatingFromRealtime = false;
    }
}

/**
 * Handle shift changes
 */
async function handleShiftChange(payload) {
    console.log('📡 REALTIME EVENT - Shift:', payload.eventType, payload);
    if (isUpdatingFromRealtime || !currentSchedule) {
        console.log('⏭️ Skipping - already updating or no schedule');
        return;
    }
    
    console.log('🔄 Shift changed:', payload.eventType);
    isUpdatingFromRealtime = true;
    
    try {
        // Reload the schedule to get fresh data
        const updatedSchedule = await apiRequest(`/api/schedules/${currentSchedule.id}`);
        currentSchedule = updatedSchedule;
        displayShifts();
        showRealtimeNotification('שינויים במשמרת');
    } catch (error) {
        console.error('Error handling shift change:', error);
    } finally {
        isUpdatingFromRealtime = false;
    }
}

/**
 * Handle unit changes
 */
async function handleUnitChange(payload, scheduleId) {
    console.log('📡 REALTIME EVENT - Unit:', payload.eventType, payload);
    if (isUpdatingFromRealtime || !currentSchedule) {
        console.log('⏭️ Skipping - already updating or no schedule');
        return;
    }
    
    // Check if this unit belongs to a shift in our schedule
    if (payload.new && payload.new.shift_id) {
        const shift = currentSchedule.shifts?.find(s => s.id === payload.new.shift_id);
        if (!shift) return; // Not our schedule
    }
    
    console.log('🔄 Unit changed:', payload.eventType);
    isUpdatingFromRealtime = true;
    
    try {
        const updatedSchedule = await apiRequest(`/api/schedules/${currentSchedule.id}`);
        currentSchedule = updatedSchedule;
        displayShifts();
        showRealtimeNotification('עדכון יחידה');
    } catch (error) {
        console.error('Error handling unit change:', error);
    } finally {
        isUpdatingFromRealtime = false;
    }
}

/**
 * Handle role changes
 */
async function handleRoleChange(payload, scheduleId) {
    console.log('📡 REALTIME EVENT - Role:', payload.eventType, payload);
    if (isUpdatingFromRealtime || !currentSchedule) {
        console.log('⏭️ Skipping - already updating or no schedule');
        return;
    }
    
    // Check if this role belongs to a unit in our schedule
    if (payload.new && payload.new.unit_id) {
        let belongsToSchedule = false;
        for (const shift of currentSchedule.shifts || []) {
            if (shift.units?.some(u => u.id === payload.new.unit_id)) {
                belongsToSchedule = true;
                break;
            }
        }
        if (!belongsToSchedule) return; // Not our schedule
    }
    
    console.log('🔄 Role changed:', payload.eventType);
    isUpdatingFromRealtime = true;
    
    try {
        const updatedSchedule = await apiRequest(`/api/schedules/${currentSchedule.id}`);
        currentSchedule = updatedSchedule;
        displayShifts();
        showRealtimeNotification('עדכון תפקיד');
    } catch (error) {
        console.error('Error handling role change:', error);
    } finally {
        isUpdatingFromRealtime = false;
    }
}

/**
 * Handle assignment changes
 */
async function handleAssignmentChange(payload) {
    console.log('📡 REALTIME EVENT - Assignment:', payload.eventType, payload);
    if (isUpdatingFromRealtime || !currentSchedule) {
        console.log('⏭️ Skipping - already updating or no schedule');
        return;
    }
    
    console.log('🔄 Assignment changed:', payload.eventType);
    isUpdatingFromRealtime = true;
    
    try {
        const updatedSchedule = await apiRequest(`/api/schedules/${currentSchedule.id}`);
        currentSchedule = updatedSchedule;
        displayShifts();
        showRealtimeNotification('עדכון שיבוץ עובד');
    } catch (error) {
        console.error('Error handling assignment change:', error);
    } finally {
        isUpdatingFromRealtime = false;
    }
}

/**
 * Handle employee changes (delete, update)
 */
async function handleEmployeeChange(payload) {
    console.log('📡 REALTIME EVENT - Employee:', payload.eventType, payload);
    if (isUpdatingFromRealtime || !currentSchedule) {
        console.log('⏭️ Skipping - already updating or no schedule');
        return;
    }
    
    console.log('🔄 Employee changed:', payload.eventType);
    isUpdatingFromRealtime = true;
    
    try {
        // Reload employees list
        allEmployees = await apiRequest('/api/employees');
        displayEmployeesSidebar(allEmployees);
        
        // Reload schedule to update employee info in assignments
        const updatedSchedule = await apiRequest(`/api/schedules/${currentSchedule.id}`);
        currentSchedule = updatedSchedule;
        displayShifts();
        
        const action = payload.eventType === 'DELETE' ? 'נמחק עובד' : 'עודכן עובד';
        showRealtimeNotification(action);
    } catch (error) {
        console.error('Error handling employee change:', error);
    } finally {
        isUpdatingFromRealtime = false;
    }
}

/**
 * Show realtime indicator
 */
function showRealtimeIndicator(active) {
    let indicator = document.getElementById('realtimeIndicator');
    
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'realtimeIndicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            padding: 10px 20px;
            background: ${active ? '#27AE60' : '#95A5A6'};
            color: white;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            z-index: 9999;
            display: none;
            align-items: center;
            gap: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(indicator);
    }
    
    if (active) {
        indicator.style.background = '#27AE60';
        indicator.innerHTML = '🔴 עריכה משותפת פעילה';
    } else {
        indicator.style.background = '#95A5A6';
        indicator.innerHTML = '⚫ לא מחובר';
    }
}

/**
 * Show realtime notification
 */
function showRealtimeNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 15px 25px;
        background: #3498DB;
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = `🔄 ${message}`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

/**
 * Show floating shift navigation
 */
function showShiftNavigation() {
    // Remove existing navigation
    hideShiftNavigation();
    
    if (!currentSchedule || !currentSchedule.shifts || currentSchedule.shifts.length === 0) return;
    
    // Create toggle button if it doesn't exist
    createToggleButton();
    
    const nav = document.createElement('div');
    nav.id = 'shiftNavigation';
    nav.style.cssText = `
        position: fixed;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 9998;
    `;
    
    currentSchedule.shifts.forEach(shift => {
        const button = document.createElement('button');
        button.className = 'shift-nav-btn';
        button.textContent = shift.shift_name;
        button.title = `עבור למשמרת ${shift.shift_name}`;
        button.onclick = () => scrollToShift(shift.id);
        button.style.cssText = `
            padding: 12px 20px;
            background: var(--primary-red);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            min-width: 80px;
        `;
        
        button.onmouseenter = function() {
            this.style.background = 'var(--dark-red)';
            this.style.transform = 'scale(1.05)';
        };
        
        button.onmouseleave = function() {
            this.style.background = 'var(--primary-red)';
            this.style.transform = 'scale(1)';
        };
        
        nav.appendChild(button);
    });
    
    // Add notes button
    const notesButton = document.createElement('button');
    notesButton.className = 'shift-nav-btn';
    notesButton.textContent = 'הערות';
    notesButton.title = 'עבור להערות';
    notesButton.onclick = () => {
        const notesSection = document.querySelector('.notes-section');
        if (notesSection) {
            notesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };
    notesButton.style.cssText = `
        padding: 12px 20px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
        min-width: 80px;
        margin-top: 10px;
    `;
    
    notesButton.onmouseenter = function() {
        this.style.background = '#45a049';
        this.style.transform = 'scale(1.05)';
    };
    
    notesButton.onmouseleave = function() {
        this.style.background = '#4CAF50';
        this.style.transform = 'scale(1)';
    };
    
    nav.appendChild(notesButton);
    
    // Add extra missions button
    const missionsButton = document.createElement('button');
    missionsButton.className = 'shift-nav-btn';
    missionsButton.textContent = 'משימות נוספות';
    missionsButton.title = 'עבור למשימות נוספות';
    missionsButton.onclick = () => {
        const missionsSection = document.querySelector('.extra-missions-section');
        if (missionsSection) {
            missionsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };
    missionsButton.style.cssText = `
        padding: 12px 20px;
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
        min-width: 80px;
        margin-top: 5px;
    `;
    
    missionsButton.onmouseenter = function() {
        this.style.background = '#1976D2';
        this.style.transform = 'scale(1.05)';
    };
    
    missionsButton.onmouseleave = function() {
        this.style.background = '#2196F3';
        this.style.transform = 'scale(1)';
    };
    
    nav.appendChild(missionsButton);
    
    // Add extra ambulances button
    const extraButton = document.createElement('button');
    extraButton.className = 'shift-nav-btn';
    extraButton.textContent = 'מעל התקן';
    extraButton.title = 'עבור למעל התקן';
    extraButton.onclick = () => {
        const extraSection = document.querySelector('.extra-ambulances-section');
        if (extraSection) {
            extraSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };
    extraButton.style.cssText = `
        padding: 12px 20px;
        background: #ff9800;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
        min-width: 80px;
        margin-top: 5px;
    `;
    
    extraButton.onmouseenter = function() {
        this.style.background = '#f57c00';
        this.style.transform = 'scale(1.05)';
    };
    
    extraButton.onmouseleave = function() {
        this.style.background = '#ff9800';
        this.style.transform = 'scale(1)';
    };
    
    nav.appendChild(extraButton);
    
    document.body.appendChild(nav);
}

/**
 * Hide floating shift navigation
 */
function hideShiftNavigation() {
    const existing = document.getElementById('shiftNavigation');
    if (existing) {
        existing.remove();
    }
    const toggleBtn = document.getElementById('toggleFloatingNavBtn');
    if (toggleBtn) {
        toggleBtn.remove();
    }
}

/**
 * Create toggle button for mobile view
 */
function createToggleButton() {
    // Remove existing toggle button
    const existing = document.getElementById('toggleFloatingNavBtn');
    if (existing) return;
    
    console.log('Creating toggle button for mobile navigation');
    
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'toggleFloatingNavBtn';
    toggleBtn.innerHTML = '☰';
    toggleBtn.title = 'הצג/הסתר ניווט';
    toggleBtn.setAttribute('aria-label', 'Toggle navigation');
    
    toggleBtn.onclick = () => {
        const nav = document.getElementById('shiftNavigation');
        console.log('Toggle button clicked, nav element:', nav);
        if (nav) {
            nav.classList.toggle('visible');
            // Change icon based on visibility
            if (nav.classList.contains('visible')) {
                toggleBtn.innerHTML = '✕';
                console.log('Navigation shown');
            } else {
                toggleBtn.innerHTML = '☰';
                console.log('Navigation hidden');
            }
        }
    };
    
    document.body.appendChild(toggleBtn);
    console.log('Toggle button appended to body');
}

/**
 * Scroll to specific shift
 */
function scrollToShift(shiftId) {
    const shiftElement = document.getElementById(`shift-section-${shiftId}`);
    if (shiftElement) {
        shiftElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start'
        });
        
        // Highlight briefly
        shiftElement.style.transition = 'background-color 0.3s ease';
        const originalBg = shiftElement.style.backgroundColor;
        shiftElement.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
        setTimeout(() => {
            shiftElement.style.backgroundColor = originalBg;
        }, 1000);
    }
}

// Make functions globally accessible
window.loadScheduleEditor = loadScheduleEditor;
window.addUnit = addUnit;
window.addRole = addRole;
window.deleteShift = deleteShift;
window.deleteUnit = deleteUnit;
window.deleteRole = deleteRole;
window.removeAssignment = removeAssignment;
window.deleteNote = deleteNote;
window.editExtraMission = editExtraMission;
window.deleteExtraMission = deleteExtraMission;
window.editExtraAmbulance = editExtraAmbulance;
window.deleteExtraAmbulance = deleteExtraAmbulance;
