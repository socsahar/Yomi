// Activity Log Page - Frontend JavaScript

let currentPage = 1;
let totalPages = 1;
let currentFilters = {
    actionType: '',
    entityType: ''
};

// Load activity logs
async function loadActivityLogs(page = 1) {
    try {
        const activityLog = document.getElementById('activityLog');
        activityLog.innerHTML = '<div class="loading">טוען יומן פעילות...</div>';

        const queryParams = new URLSearchParams({
            page: page,
            limit: 20
        });

        const response = await fetch(`/api/activity/logs?${queryParams}`);
        
        if (!response.ok) {
            throw new Error('Failed to load activity logs');
        }

        const data = await response.json();
        
        currentPage = data.pagination.page;
        totalPages = data.pagination.totalPages;

        displayActivityLogs(data.logs);
        updatePagination(data.pagination);

    } catch (error) {
        console.error('Error loading activity logs:', error);
        document.getElementById('activityLog').innerHTML = 
            '<div class="no-data"><h3>שגיאה בטעינת יומן הפעילות</h3><p>אנא נסה שוב מאוחר יותר</p></div>';
    }
}

// Display activity logs
function displayActivityLogs(logs) {
    const activityLog = document.getElementById('activityLog');

    if (!logs || logs.length === 0) {
        activityLog.innerHTML = '<div class="no-data"><h3>אין פעילות להצגה</h3><p>כאשר יבוצעו פעולות במערכת, הן יופיעו כאן</p></div>';
        return;
    }

    let html = '';
    logs.forEach(log => {
        const actionClass = `action-${log.action_type}`;
        const actionText = getActionText(log.action_type);
        const entityText = getEntityText(log.entity_type);
        const timeText = formatDateTime(log.created_at);
        
        html += `
            <div class="activity-item">
                <div class="activity-header">
                    <div>
                        <span class="activity-user">${escapeHtml(log.username)}</span>
                        <span class="activity-action ${actionClass}">${actionText}</span>
                    </div>
                    <span class="activity-time">${timeText}</span>
                </div>
                <div class="activity-description">
                    <strong>${entityText}</strong>: ${escapeHtml(log.description)}
                </div>
                ${log.metadata ? formatMetadata(log.metadata) : ''}
            </div>
        `;
    });

    activityLog.innerHTML = html;
}

// Format metadata
function formatMetadata(metadata) {
    if (typeof metadata === 'string') {
        try {
            metadata = JSON.parse(metadata);
        } catch (e) {
            return '';
        }
    }

    if (!metadata || Object.keys(metadata).length === 0) {
        return '';
    }

    let html = '<div class="activity-metadata">';
    html += '<strong>פרטים נוספים:</strong> ';
    
    const details = [];
    for (const [key, value] of Object.entries(metadata)) {
        if (value !== null && value !== undefined) {
            details.push(`${key}: ${escapeHtml(String(value))}`);
        }
    }
    
    html += details.join(' | ');
    html += '</div>';
    
    return html;
}

// Get action text in Hebrew
function getActionText(actionType) {
    const actionMap = {
        'create': 'יצר',
        'update': 'עדכן',
        'delete': 'מחק',
        'publish': 'פרסם',
        'login': 'התחבר',
        'logout': 'התנתק',
        'export': 'ייצא',
        'import': 'יבא'
    };
    return actionMap[actionType] || actionType;
}

// Get entity text in Hebrew
function getEntityText(entityType) {
    const entityMap = {
        'schedule': 'סידור עבודה',
        'employee': 'עובד',
        'shift': 'משמרת',
        'user': 'משתמש',
        'report': 'דוח',
        'system': 'מערכת'
    };
    return entityMap[entityType] || entityType;
}

// Format date and time with full timestamp
function formatDateTime(dateString) {
    // Parse the UTC date string and convert to local time
    const date = new Date(dateString);
    
    // Format full date and time
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    const fullTime = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    
    // Calculate relative time
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let relativeTime = '';
    if (diffMins < 1) relativeTime = 'הרגע';
    else if (diffMins < 60) relativeTime = `לפני ${diffMins} דקות`;
    else if (diffHours < 24) relativeTime = `לפני ${diffHours} שעות`;
    else if (diffDays < 7) relativeTime = `לפני ${diffDays} ימים`;
    else relativeTime = `לפני ${diffDays} ימים`;

    return `${fullTime} (${relativeTime})`;
}

// Update pagination
function updatePagination(pagination) {
    const paginationDiv = document.getElementById('pagination');
    const paginationInfo = document.getElementById('paginationInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    if (pagination.totalPages <= 1) {
        paginationDiv.style.display = 'none';
        return;
    }

    paginationDiv.style.display = 'flex';
    paginationInfo.textContent = `עמוד ${pagination.page} מתוך ${pagination.totalPages}`;

    prevBtn.disabled = pagination.page <= 1;
    nextBtn.disabled = pagination.page >= pagination.totalPages;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Apply filters
function applyFilters() {
    currentFilters.actionType = document.getElementById('actionTypeFilter').value;
    currentFilters.entityType = document.getElementById('entityTypeFilter').value;
    
    // For now, reload all logs and filter client-side
    // In a production app, you'd want to filter server-side
    loadActivityLogs(1);
}

// Reset filters
function resetFilters() {
    document.getElementById('actionTypeFilter').value = '';
    document.getElementById('entityTypeFilter').value = '';
    currentFilters = { actionType: '', entityType: '' };
    loadActivityLogs(1);
}

// Refresh logs
function refreshLogs() {
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.classList.add('spinning');
    
    loadActivityLogs(currentPage).finally(() => {
        setTimeout(() => {
            refreshBtn.classList.remove('spinning');
        }, 500);
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Load initial activity logs
    loadActivityLogs(1);

    // Filter buttons
    document.getElementById('applyFiltersBtn').addEventListener('click', applyFilters);
    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);

    // Pagination buttons
    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            loadActivityLogs(currentPage - 1);
        }
    });

    document.getElementById('nextPageBtn').addEventListener('click', () => {
        if (currentPage < totalPages) {
            loadActivityLogs(currentPage + 1);
        }
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', refreshLogs);

    // Auto-refresh every 30 seconds
    setInterval(() => {
        if (currentPage === 1) {
            loadActivityLogs(1);
        }
    }, 30000);
});
