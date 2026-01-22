// Dashboard functionality

document.addEventListener('DOMContentLoaded', async () => {
    await loadRecentSchedules();
});

/**
 * Load recent schedules
 */
async function loadRecentSchedules() {
    const listContainer = document.getElementById('recent-schedules-list');
    
    try {
        const schedules = await apiRequest('/api/schedules');
        
        if (!schedules || schedules.length === 0) {
            listContainer.innerHTML = '<p class="text-center">אין סידורי עבודה</p>';
            return;
        }
        
        // Show only last 5 schedules
        const recentSchedules = schedules.slice(0, 5);
        
        listContainer.innerHTML = recentSchedules.map(schedule => {
            const date = new Date(schedule.schedule_date);
            const dayOfWeek = date.toLocaleDateString('he-IL', { weekday: 'long' });
            
            return `
            <div class="schedule-item" onclick="openSchedule(${schedule.id})">
                <div class="schedule-item-info">
                    <h4>${dayOfWeek}</h4>
                    <p>${formatDate(schedule.schedule_date)}</p>
                </div>
                <span class="status-badge ${schedule.status}">${getStatusText(schedule.status)}</span>
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
 * Open schedule editor
 */
function openSchedule(scheduleId) {
    window.location.href = `/schedule?id=${scheduleId}`;
}
