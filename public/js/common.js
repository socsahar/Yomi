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
