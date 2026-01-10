// Login and registration functionality

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            // Update active tab button
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show corresponding form
            document.getElementById('login-form').classList.remove('active');
            document.getElementById('register-form').classList.remove('active');
            document.getElementById(`${tab}-form`).classList.add('active');
            
            // Clear error messages
            document.getElementById('login-error').textContent = '';
            document.getElementById('register-error').textContent = '';
        });
    });
    
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
                window.location.href = '/dashboard';
            } else {
                errorDiv.textContent = data.error || 'שגיאה בהתחברות';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorDiv.textContent = 'שגיאת תקשורת עם השרת';
        }
    });
    
    // Register form submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const passwordConfirm = document.getElementById('register-password-confirm').value;
        const errorDiv = document.getElementById('register-error');
        
        errorDiv.textContent = '';
        
        // Validate passwords match
        if (password !== passwordConfirm) {
            errorDiv.textContent = 'הסיסמאות אינן תואמות';
            return;
        }
        
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                window.location.href = '/dashboard';
            } else {
                errorDiv.textContent = data.error || 'שגיאה בהרשמה';
            }
        } catch (error) {
            console.error('Registration error:', error);
            errorDiv.textContent = 'שגיאת תקשורת עם השרת';
        }
    });
});
