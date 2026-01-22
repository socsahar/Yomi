// User Management JavaScript

let currentUserId = null;
let deleteUserId = null;
let resetUserId = null;

// Check authentication and load users
async function init() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = '/';
            return;
        }
        
        document.getElementById('username-display').textContent = data.user.username;
        currentUserId = data.user.id;
        
        // Check if we need to redirect to password change
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mustChangePassword') === 'true') {
            showPasswordChange();
            return;
        }
        
        loadUsers();
    } catch (error) {
        console.error('Error checking authentication:', error);
        window.location.href = '/';
    }
}

// Show password change form
function showPasswordChange() {
    document.getElementById('usersManagement').style.display = 'none';
    document.getElementById('changePasswordContainer').style.display = 'block';
}

// Load all users
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';
        
        if (data.users && data.users.length > 0) {
            data.users.forEach(user => {
                const row = createUserRow(user);
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">לא נמצאו משתמשים</td></tr>';
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showError('שגיאה בטעינת משתמשים');
    }
}

// Create user table row
function createUserRow(user) {
    const tr = document.createElement('tr');
    
    const username = document.createElement('td');
    username.textContent = user.username;
    tr.appendChild(username);
    
    const createdAt = document.createElement('td');
    createdAt.textContent = formatDate(user.created_at);
    tr.appendChild(createdAt);
    
    const lastActivity = document.createElement('td');
    lastActivity.textContent = user.last_activity ? formatDate(user.last_activity) : 'אף פעם';
    tr.appendChild(lastActivity);
    
    const status = document.createElement('td');
    if (user.is_temp_password || user.must_change_password) {
        status.innerHTML = '<span class="status-badge status-temp">סיסמה זמנית</span>';
    } else {
        status.innerHTML = '<span class="status-badge status-active">פעיל</span>';
    }
    tr.appendChild(status);
    
    const actions = document.createElement('td');
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'user-actions';
    
    // Reset password button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-warning btn-small';
    resetBtn.textContent = '🔄 איפוס סיסמה';
    resetBtn.onclick = () => showResetPasswordConfirm(user.id, user.username);
    actionsDiv.appendChild(resetBtn);
    
    // Delete button (can't delete yourself)
    if (user.id !== currentUserId) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger btn-small';
        deleteBtn.textContent = '🗑️ מחק';
        deleteBtn.onclick = () => showDeleteConfirm(user.id, user.username);
        actionsDiv.appendChild(deleteBtn);
    }
    
    actions.appendChild(actionsDiv);
    tr.appendChild(actions);
    
    return tr;
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'לא זמין';
    const date = new Date(dateString);
    return date.toLocaleString('he-IL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show create user modal
function showCreateUserModal() {
    document.getElementById('createUserModal').classList.add('active');
    document.getElementById('new-username').value = '';
    document.getElementById('create-user-error').textContent = '';
}

// Hide create user modal
function hideCreateUserModal() {
    document.getElementById('createUserModal').classList.remove('active');
}

// Create new user
async function createUser() {
    const username = document.getElementById('new-username').value.trim();
    const errorDiv = document.getElementById('create-user-error');
    
    errorDiv.textContent = '';
    
    if (!username) {
        errorDiv.textContent = 'שם משתמש נדרש';
        return;
    }
    
    if (username.length < 3) {
        errorDiv.textContent = 'שם משתמש חייב להכיל לפחות 3 תווים';
        return;
    }
    
    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            hideCreateUserModal();
            showPasswordModal(data.user.username, data.user.temporaryPassword);
            loadUsers();
        } else {
            errorDiv.textContent = data.error || 'שגיאה ביצירת משתמש';
        }
    } catch (error) {
        console.error('Error creating user:', error);
        errorDiv.textContent = 'שגיאה ביצירת משתמש';
    }
}

// Show password modal
function showPasswordModal(username, password) {
    document.getElementById('created-username').textContent = username;
    document.getElementById('temp-password').textContent = password;
    document.getElementById('passwordModal').classList.add('active');
}

// Hide password modal
function hidePasswordModal() {
    document.getElementById('passwordModal').classList.remove('active');
}

// Copy password to clipboard
async function copyPassword(passwordId) {
    const passwordText = document.getElementById(passwordId).textContent;
    
    try {
        await navigator.clipboard.writeText(passwordText);
        showSuccess('הסיסמה הועתקה ללוח');
    } catch (error) {
        console.error('Error copying password:', error);
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = passwordText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showSuccess('הסיסמה הועתקה ללוח');
    }
}

// Show delete confirmation
function showDeleteConfirm(userId, username) {
    deleteUserId = userId;
    document.getElementById('delete-username').textContent = username;
    document.getElementById('deleteModal').classList.add('active');
}

// Hide delete modal
function hideDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    deleteUserId = null;
}

// Delete user
async function deleteUser() {
    if (!deleteUserId) return;
    
    try {
        const response = await fetch(`/api/users/${deleteUserId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('המשתמש נמחק בהצלחה');
            hideDeleteModal();
            loadUsers();
        } else {
            showError(data.error || 'שגיאה במחיקת משתמש');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showError('שגיאה במחיקת משתמש');
    }
}

// Show reset password confirmation
function showResetPasswordConfirm(userId, username) {
    resetUserId = userId;
    resetPassword(userId, username);
}

// Reset password
async function resetPassword(userId, username) {
    try {
        const response = await fetch(`/api/users/${userId}/reset-password`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('reset-username').textContent = username;
            document.getElementById('reset-password').textContent = data.temporaryPassword;
            document.getElementById('resetPasswordModal').classList.add('active');
            loadUsers();
        } else {
            showError(data.error || 'שגיאה באיפוס סיסמה');
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        showError('שגיאה באיפוס סיסמה');
    }
}

// Hide reset password modal
function hideResetPasswordModal() {
    document.getElementById('resetPasswordModal').classList.remove('active');
}

// Change password (for first-time login)
async function changePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorDiv = document.getElementById('change-password-error');
    
    errorDiv.textContent = '';
    
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'הסיסמאות אינן תואמות';
        return;
    }
    
    if (newPassword.length < 6) {
        errorDiv.textContent = 'סיסמה חדשה חייבת להכיל לפחות 6 תווים';
        return;
    }
    
    try {
        const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('הסיסמה שונתה בהצלחה');
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1500);
        } else {
            errorDiv.textContent = data.error || 'שגיאה בשינוי סיסמה';
        }
    } catch (error) {
        console.error('Error changing password:', error);
        errorDiv.textContent = 'שגיאה בשינוי סיסמה';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    init();
    
    // Create user button
    document.getElementById('createUserBtn').addEventListener('click', showCreateUserModal);
    
    // Create user form
    document.getElementById('submitCreateBtn').addEventListener('click', createUser);
    document.getElementById('cancelCreateBtn').addEventListener('click', hideCreateUserModal);
    document.getElementById('createUserForm').addEventListener('submit', (e) => {
        e.preventDefault();
        createUser();
    });
    
    // Password modal
    document.getElementById('closePasswordModalBtn').addEventListener('click', hidePasswordModal);
    document.getElementById('copyPasswordBtn').addEventListener('click', () => copyPassword('temp-password'));
    
    // Delete modal
    document.getElementById('cancelDeleteBtn').addEventListener('click', hideDeleteModal);
    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteUser);
    
    // Reset password modal
    document.getElementById('closeResetModalBtn').addEventListener('click', hideResetPasswordModal);
    document.getElementById('copyResetPasswordBtn').addEventListener('click', () => copyPassword('reset-password'));
    
    // Change password form
    document.getElementById('changePasswordForm').addEventListener('submit', changePassword);
    
    // Logout is handled by common.js
    
    // Hamburger menu
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navMenu = document.getElementById('navMenu');
    
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
});
