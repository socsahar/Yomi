// Employees management functionality

let employees = [];
let currentEmployeeId = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadEmployees();
    setupEventListeners();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Add employee button
    document.getElementById('addEmployeeBtn').addEventListener('click', () => {
        currentEmployeeId = null;
        document.getElementById('modalTitle').textContent = 'הוסף עובד';
        document.getElementById('employeeForm').reset();
        document.getElementById('employeeId').value = '';
        showModal('employeeModal');
    });
    
    // Employee form submission
    document.getElementById('employeeForm').addEventListener('submit', handleEmployeeFormSubmit);
    
    // Cancel button
    document.getElementById('cancelBtn').addEventListener('click', () => {
        hideModal('employeeModal');
    });
    
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', (e) => {
        filterEmployees(e.target.value);
    });
    
    // Import employees button
    document.getElementById('importEmployeesBtn').addEventListener('click', () => {
        showModal('importModal');
    });
    
    // Close import modal
    document.querySelectorAll('#importModal .close').forEach(btn => {
        btn.addEventListener('click', () => {
            hideModal('importModal');
        });
    });
}

/**
 * Load all employees
 */
async function loadEmployees() {
    const tbody = document.getElementById('employeesTableBody');
    
    try {
        employees = await apiRequest('/api/employees');
        displayEmployees(employees);
    } catch (error) {
        console.error('Error loading employees:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">שגיאה בטעינת עובדים</td></tr>';
    }
}

/**
 * Display employees in table
 */
function displayEmployees(employeesData) {
    const tbody = document.getElementById('employeesTableBody');
    
    if (!employeesData || employeesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">אין עובדים במערכת</td></tr>';
        return;
    }
    
    tbody.innerHTML = employeesData.map(emp => `
        <tr>
            <td>${emp.first_name}</td>
            <td>${emp.last_name}</td>
            <td>${emp.employee_id || '-'}</td>
            <td>${emp.position || '-'}</td>
            <td>${emp.station || '-'}</td>
            <td>${emp.phone || '-'}</td>
            <td class="table-actions">
                <button class="btn btn-secondary btn-small" onclick="editEmployee(${emp.id})">ערוך</button>
                <button class="btn btn-secondary btn-small" onclick="deleteEmployee(${emp.id})">מחק</button>
            </td>
        </tr>
    `).join('');
}

/**
 * Filter employees based on search query
 */
function filterEmployees(query) {
    const filtered = employees.filter(emp => {
        const searchText = query.toLowerCase();
        return (
            emp.first_name.toLowerCase().includes(searchText) ||
            emp.last_name.toLowerCase().includes(searchText) ||
            (emp.employee_id && emp.employee_id.toLowerCase().includes(searchText)) ||
            (emp.position && emp.position.toLowerCase().includes(searchText)) ||
            (emp.station && emp.station.toLowerCase().includes(searchText))
        );
    });
    
    displayEmployees(filtered);
}

/**
 * Edit employee
 */
function editEmployee(id) {
    const employee = employees.find(e => e.id === id);
    if (!employee) return;
    
    currentEmployeeId = id;
    document.getElementById('modalTitle').textContent = 'ערוך עובד';
    document.getElementById('employeeId').value = id;
    document.getElementById('firstName').value = employee.first_name;
    document.getElementById('lastName').value = employee.last_name;
    document.getElementById('employeeIdField').value = employee.employee_id || '';
    document.getElementById('phone').value = employee.phone || '';
    document.getElementById('email').value = employee.email || '';
    document.getElementById('position').value = employee.position || '';
    document.getElementById('station').value = employee.station || '';
    
    showModal('employeeModal');
}

/**
 * Delete employee
 */
async function deleteEmployee(id) {
    showConfirm(
        'מחיקת עובד',
        'האם אתה בטוח שברצונך למחוק עובד זה?',
        async () => {
            try {
                await apiRequest(`/api/employees/${id}`, { method: 'DELETE' });
                await loadEmployees();
                showSuccess('עובד נמחק בהצלחה');
            } catch (error) {
                console.error('Error deleting employee:', error);
                showError('שגיאה במחיקת עובד');
            }
        }
    );
}

/**
 * Handle employee form submission
 */
async function handleEmployeeFormSubmit(e) {
    e.preventDefault();
    
    const formData = {
        first_name: document.getElementById('firstName').value,
        last_name: document.getElementById('lastName').value,
        employee_id: document.getElementById('employeeIdField').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value,
        position: document.getElementById('position').value,
        station: document.getElementById('station').value
    };
    
    try {
        if (currentEmployeeId) {
            // Update existing employee
            await apiRequest(`/api/employees/${currentEmployeeId}`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            
            // Show immediate notification
            if (typeof showImmediateNotification === 'function') {
                showImmediateNotification(
                    'update',
                    'employee',
                    `עדכן פרטי עובד: ${formData.first_name} ${formData.last_name}`
                );
            }
        } else {
            // Create new employee
            await apiRequest('/api/employees', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            // Show immediate notification
            if (typeof showImmediateNotification === 'function') {
                showImmediateNotification(
                    'create',
                    'employee',
                    `הוסיף עובד חדש: ${formData.first_name} ${formData.last_name}`
                );
            }
        }
        
        hideModal('employeeModal');
        await loadEmployees();
        showSuccess('העובד נשמר בהצלחה');
        
    } catch (error) {
        console.error('Error saving employee:', error);
        const errorMsg = error.message || 'שגיאה בשמירת עובד';
        showError(errorMsg);
        showErrorField('formError', errorMsg);
    }
}

// Make functions globally accessible
window.editEmployee = editEmployee;
window.deleteEmployee = deleteEmployee;
