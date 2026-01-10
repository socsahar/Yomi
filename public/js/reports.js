// Reports and Statistics functionality

let currentStartDate = null;
let currentEndDate = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
    document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
    
    currentStartDate = startDate.toISOString().split('T')[0];
    currentEndDate = endDate.toISOString().split('T')[0];
    
    // Load initial data
    await loadAllReports();
    
    // Event listeners
    document.getElementById('filterBtn').addEventListener('click', async () => {
        currentStartDate = document.getElementById('startDate').value;
        currentEndDate = document.getElementById('endDate').value;
        await loadAllReports();
    });
    
    document.getElementById('resetBtn').addEventListener('click', async () => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
        document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
        
        currentStartDate = startDate.toISOString().split('T')[0];
        currentEndDate = endDate.toISOString().split('T')[0];
        
        await loadAllReports();
    });
});

/**
 * Load all reports data
 */
async function loadAllReports() {
    try {
        const params = new URLSearchParams();
        if (currentStartDate) params.append('startDate', currentStartDate);
        if (currentEndDate) params.append('endDate', currentEndDate);
        
        const data = await apiRequest(`/api/reports/statistics?${params.toString()}`);
        
        // Update statistics cards
        document.getElementById('totalSchedules').textContent = data.summary.totalSchedules || 0;
        document.getElementById('totalAssignments').textContent = data.summary.totalAssignments || 0;
        document.getElementById('uniqueAmbulances').textContent = data.summary.uniqueAmbulances || 0;
        document.getElementById('avgAssignments').textContent = 
            data.summary.totalSchedules > 0 
                ? (data.summary.totalAssignments / data.summary.totalSchedules).toFixed(1)
                : '0';
        
        // Load tables
        displayTopEmployees(data.topEmployees);
        displayStationStats(data.stationStats);
        displayShiftStats(data.shiftStats);
        displayScheduleStatus(data.recentSchedules);
        
    } catch (error) {
        console.error('Error loading reports:', error);
        showError('שגיאה בטעינת דוחות');
    }
}

/**
 * Display top employees table
 */
function displayTopEmployees(employees) {
    const container = document.getElementById('topEmployees');
    
    if (!employees || employees.length === 0) {
        container.innerHTML = '<p class="text-center">אין נתונים להצגה</p>';
        return;
    }
    
    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>שם העובד</th>
                    <th>מספר שיבוצים</th>
                    <th>תפקידים שונים</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    employees.forEach((emp, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${emp.employee_name || 'לא ידוע'}</td>
                <td>${emp.assignment_count}</td>
                <td>${emp.unique_roles || '-'}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

/**
 * Display station statistics
 */
function displayStationStats(stations) {
    const container = document.getElementById('stationStats');
    
    if (!stations || stations.length === 0) {
        container.innerHTML = '<p class="text-center">אין נתונים להצגה</p>';
        return;
    }
    
    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>תחנה</th>
                    <th>סידורים</th>
                    <th>שיבוצים</th>
                    <th>ממוצע שיבוצים</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    stations.forEach(station => {
        const avg = station.schedule_count > 0 
            ? (station.assignment_count / station.schedule_count).toFixed(1)
            : '0';
        
        html += `
            <tr>
                <td><strong>${station.station}</strong></td>
                <td>${station.schedule_count}</td>
                <td>${station.assignment_count}</td>
                <td>${avg}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

/**
 * Display shift statistics
 */
function displayShiftStats(shifts) {
    const container = document.getElementById('shiftStats');
    
    if (!shifts || shifts.length === 0) {
        container.innerHTML = '<p class="text-center">אין נתונים להצגה</p>';
        return;
    }
    
    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>משמרת</th>
                    <th>מספר משמרות</th>
                    <th>יחידות</th>
                    <th>תפקידים</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    shifts.forEach(shift => {
        html += `
            <tr>
                <td><strong>${shift.shift_name}</strong></td>
                <td>${shift.shift_count}</td>
                <td>${shift.unit_count || 0}</td>
                <td>${shift.role_count || 0}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

/**
 * Display schedule status table
 */
function displayScheduleStatus(schedules) {
    const container = document.getElementById('scheduleStatus');
    
    if (!schedules || schedules.length === 0) {
        container.innerHTML = '<p class="text-center">אין נתונים להצגה</p>';
        return;
    }
    
    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>תאריך</th>
                    <th>תחנה</th>
                    <th>סטטוס</th>
                    <th>משמרות</th>
                    <th>שיבוצים</th>
                    <th>פעולות</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    schedules.forEach(schedule => {
        const statusText = getStatusText(schedule.status);
        const statusClass = schedule.status;
        
        html += `
            <tr>
                <td>${formatDate(schedule.schedule_date)}</td>
                <td>${schedule.station}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${schedule.shift_count || 0}</td>
                <td>${schedule.assignment_count || 0}</td>
                <td>
                    <button class="btn btn-small btn-primary" onclick="viewSchedule(${schedule.id})">
                        צפייה
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
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
 * View schedule
 */
function viewSchedule(scheduleId) {
    window.location.href = `/schedule?id=${scheduleId}`;
}

/**
 * Show error message
 */
function showError(message) {
    alert(message);
}
