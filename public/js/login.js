// Login and registration functionality

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        
        errorDiv.textContent = '';
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Check if user must change password
                if (data.mustChangePassword) {
                    window.location.href = '/users?mustChangePassword=true';
                } else {
                    window.location.href = '/dashboard';
                }
            } else {
                errorDiv.textContent = data.error || 'שגיאה בהתחברות';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorDiv.textContent = 'שגיאת תקשורת עם השרת';
        }
    });
});
