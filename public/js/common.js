// Common utility functions and authentication checks

/**
 * Check if user is authenticated
 */
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = '/';
            return null;
        }
        
        return data.user;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/';
        return null;
    }
}

/**
 * Logout user
 */
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

/**
 * Show error message
 */
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
    }
}

/**
 * Hide error message
 */
function hideError(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = '';
        element.style.display = 'none';
    }
}

/**
 * Format date to Hebrew locale
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format date for input field (YYYY-MM-DD)
 */
function formatDateForInput(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Show modal
 */
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    }
}

/**
 * Hide modal
 */
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

/**
 * API request helper
 */
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'שגיאה בשרת');
        }
        
        return data;
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

// Initialize common functionality
document.addEventListener('DOMContentLoaded', async () => {
    // Set up logout button if it exists
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('האם אתה בטוח שברצונך להתנתק?')) {
                logout();
            }
        });
    }
    
    // Check authentication and display username
    const user = await checkAuth();
    if (user) {
        const usernameDisplay = document.getElementById('username-display');
        if (usernameDisplay) {
            usernameDisplay.textContent = user.username;
        }
    }
    
    // Initialize notifications system
    initNotifications();
    
    // Initialize online users widget
    initOnlineUsers();
    
    // Hamburger menu toggle
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navMenu = document.getElementById('navMenu');
    
    if (hamburgerBtn && navMenu) {
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hamburgerBtn.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!navMenu.contains(e.target) && !hamburgerBtn.contains(e.target)) {
                hamburgerBtn.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });

        // Close menu when clicking a nav link
        navMenu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburgerBtn.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('show');
        }
    });
    
    // Close modals when clicking close button
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').classList.remove('show');
        });
    });
});

// Notification System
let lastNotificationTime = new Date().toISOString();
let notificationQueue = [];
let isShowingNotification = false;

function initNotifications() {
    // Create notification container
    if (!document.getElementById('notificationContainer')) {
        const container = document.createElement('div');
        container.id = 'notificationContainer';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
            direction: rtl;
        `;
        
        // Hide on mobile devices
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        if (mediaQuery.matches) {
            container.style.display = 'none';
        }
        
        // Listen for screen size changes
        mediaQuery.addEventListener('change', (e) => {
            container.style.display = e.matches ? 'none' : 'block';
        });
        
        document.body.appendChild(container);
    }

    // Poll for new activities every 10 seconds
    setInterval(checkForNewActivities, 10000);
}

// Show immediate notification for current user's action
function showImmediateNotification(actionType, entityType, description) {
    // Don't show on mobile
    if (window.matchMedia('(max-width: 768px)').matches) {
        return;
    }
    
    const username = document.getElementById('username-display')?.textContent || 'אתה';
    const log = {
        username: username,
        action_type: actionType,
        entity_type: entityType,
        description: description,
        created_at: new Date().toISOString()
    };
    
    showNotification(log);
}

async function checkForNewActivities() {
    try {
        const response = await fetch(`/api/activity/recent?since=${lastNotificationTime}&limit=5`);
        if (!response.ok) return;

        const data = await response.json();
        
        if (data.logs && data.logs.length > 0) {
            // Update last notification time
            lastNotificationTime = new Date().toISOString();
            
            // Show notifications for new activities (excluding current user's own actions)
            data.logs.reverse().forEach(log => {
                // Don't show notification for the current user's own actions
                const currentUsername = document.getElementById('username-display')?.textContent;
                if (log.username !== currentUsername) {
                    showNotification(log);
                }
            });
        }
    } catch (error) {
        console.error('Error checking for new activities:', error);
    }
}

function showNotification(log) {
    notificationQueue.push(log);
    if (!isShowingNotification) {
        processNotificationQueue();
    }
}

function processNotificationQueue() {
    if (notificationQueue.length === 0) {
        isShowingNotification = false;
        return;
    }

    isShowingNotification = true;
    const log = notificationQueue.shift();

    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = 'notification-toast';
    notification.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border-left: 4px solid #007bff;
        animation: slideIn 0.3s ease-out;
        cursor: pointer;
        transition: transform 0.2s;
    `;

    const actionColor = {
        'create': '#28a745',
        'update': '#ffc107',
        'delete': '#dc3545',
        'publish': '#17a2b8',
        'login': '#6f42c1'
    }[log.action_type] || '#007bff';

    notification.style.borderLeftColor = actionColor;

    const actionText = getActionText(log.action_type);
    const entityText = getEntityText(log.entity_type);

    notification.innerHTML = `
        <div style="font-weight: bold; color: #2c3e50; margin-bottom: 4px;">
            ${escapeHtml(log.username)} ${actionText}
        </div>
        <div style="font-size: 14px; color: #495057;">
            ${entityText}: ${escapeHtml(log.description)}
        </div>
        <div style="font-size: 12px; color: #6c757d; margin-top: 4px;">
            ${formatTimeAgo(log.created_at)}
        </div>
    `;

    // Add hover effect
    notification.addEventListener('mouseenter', () => {
        notification.style.transform = 'translateX(-5px)';
    });

    notification.addEventListener('mouseleave', () => {
        notification.style.transform = 'translateX(0)';
    });

    // Click to go to activity log
    notification.addEventListener('click', () => {
        window.location.href = '/activity';
    });

    container.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
            processNotificationQueue();
        }, 300);
    }, 5000);
}

function getActionText(actionType) {
    const actionMap = {
        'create': 'יצר',
        'update': 'עדכן',
        'delete': 'מחק',
        'publish': 'פרסם',
        'login': 'התחבר'
    };
    return actionMap[actionType] || actionType;
}

function getEntityText(entityType) {
    const entityMap = {
        'schedule': 'סידור עבודה',
        'employee': 'עובד',
        'shift': 'משמרת',
        'user': 'משתמש'
    };
    return entityMap[entityType] || entityType;
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'הרגע';
    if (diffMins < 60) return `לפני ${diffMins} דקות`;
    
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `לפני ${diffHours} שעות`;
    
    return 'היום';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
    
    /* Hide notification container on mobile devices */
    @media (max-width: 768px) {
        #notificationContainer {
            display: none !important;
        }
    }
`;
document.head.appendChild(style);

// Online Users Widget
let onlineUsersData = [];
let isOnlineWidgetMinimized = localStorage.getItem('onlineWidgetMinimized') === 'true';

function initOnlineUsers() {
    // Don't show on mobile
    if (window.matchMedia('(max-width: 768px)').matches) {
        return;
    }
    
    // Create online users widget
    if (!document.getElementById('onlineUsersWidget')) {
        const widget = document.createElement('div');
        widget.id = 'onlineUsersWidget';
        widget.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            min-width: 200px;
            max-width: 250px;
            overflow: hidden;
            transition: all 0.3s ease;
        `;
        
        widget.innerHTML = `
            <div style="background: linear-gradient(135deg, #E74C3C 0%, #C0392B 100%); padding: 12px 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" id="onlineUsersHeader">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="color: white; font-size: 18px;">👥</span>
                    <span style="color: white; font-weight: 600; font-size: 14px;">משתמשים מחוברים</span>
                    <span id="onlineUsersCount" style="background: rgba(255,255,255,0.25); color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: bold;">0</span>
                </div>
                <span id="onlineUsersToggle" style="color: white; font-size: 16px; transition: transform 0.3s;">▼</span>
            </div>
            <div id="onlineUsersList" style="max-height: 300px; overflow-y: auto; padding: 8px;">
                <div style="text-align: center; padding: 20px; color: #999;">טוען...</div>
            </div>
        `;
        
        document.body.appendChild(widget);
        
        // Toggle minimize/maximize
        document.getElementById('onlineUsersHeader').addEventListener('click', toggleOnlineWidget);
        
        // Apply saved state
        if (isOnlineWidgetMinimized) {
            document.getElementById('onlineUsersList').style.display = 'none';
            document.getElementById('onlineUsersToggle').style.transform = 'rotate(-90deg)';
        }
    }
    
    // Load online users immediately
    loadOnlineUsers();
    
    // Send heartbeat immediately on load
    sendHeartbeat();
    
    // Send heartbeat every 30 seconds to keep user as "online"
    setInterval(sendHeartbeat, 30 * 1000);
    
    // Poll for online users every 10 seconds
    setInterval(loadOnlineUsers, 10000);
}

function toggleOnlineWidget() {
    const list = document.getElementById('onlineUsersList');
    const toggle = document.getElementById('onlineUsersToggle');
    
    isOnlineWidgetMinimized = !isOnlineWidgetMinimized;
    localStorage.setItem('onlineWidgetMinimized', isOnlineWidgetMinimized);
    
    if (isOnlineWidgetMinimized) {
        list.style.display = 'none';
        toggle.style.transform = 'rotate(-90deg)';
    } else {
        list.style.display = 'block';
        toggle.style.transform = 'rotate(0deg)';
    }
}

async function loadOnlineUsers() {
    try {
        const response = await fetch('/api/auth/online-users');
        if (!response.ok) return;
        
        const data = await response.json();
        onlineUsersData = data.users || [];
        
        displayOnlineUsers(onlineUsersData);
    } catch (error) {
        console.error('Error loading online users:', error);
    }
}

function displayOnlineUsers(users) {
    const countEl = document.getElementById('onlineUsersCount');
    const listEl = document.getElementById('onlineUsersList');
    
    if (!countEl || !listEl) return;
    
    countEl.textContent = users.length;
    
    if (users.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">אין משתמשים מחוברים</div>';
        return;
    }
    
    const currentUsername = document.getElementById('username-display')?.textContent;
    
    let html = '';
    users.forEach(user => {
        const isCurrentUser = user.username === currentUsername;
        const lastActive = new Date(user.last_activity);
        const now = new Date();
        const diffMinutes = Math.floor((now - lastActive) / 60000);
        
        let statusColor, statusText;
        if (diffMinutes < 2) {
            statusColor = '#10b981'; // Green
            statusText = 'פעיל עכשיו';
        } else if (diffMinutes < 10) {
            statusColor = '#3b82f6'; // Blue
            statusText = `פעיל לפני ${diffMinutes} דקות`;
        } else if (diffMinutes < 30) {
            statusColor = '#f59e0b'; // Orange
            statusText = `פעיל לפני ${diffMinutes} דקות`;
        } else {
            statusColor = '#6c757d'; // Gray
            statusText = `פעיל לפני ${diffMinutes} דקות`;
        }
        
        html += `
            <div style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 10px; ${isCurrentUser ? 'background: #f0f9ff;' : ''}">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor}; flex-shrink: 0;"></div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: ${isCurrentUser ? '600' : '500'}; color: #2c3e50; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${escapeHtml(user.username)}${isCurrentUser ? ' (אתה)' : ''}
                    </div>
                    <div style="font-size: 11px; color: #6c757d;">
                        ${statusText}
                    </div>
                </div>
            </div>
        `;
    });
    
    listEl.innerHTML = html;
}

async function sendHeartbeat() {
    try {
        await fetch('/api/auth/heartbeat', { method: 'POST' });
    } catch (error) {
        console.error('Error sending heartbeat:', error);
    }
}

