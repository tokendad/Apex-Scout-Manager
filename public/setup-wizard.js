/**
 * Setup Wizard JavaScript
 * Handles first-time system administration account creation
 */

// ============================================================================
// State Management
// ============================================================================

let currentStep = 1;
const totalSteps = 3;

// Password validation rules
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REQUIREMENTS = {
    length: /^.{8,}$/,
    uppercase: /[A-Z]/,
    lowercase: /[a-z]/,
    number: /[0-9]/
};

// ============================================================================
// Step Navigation
// ============================================================================

/**
 * Show a specific step
 */
function goToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > totalSteps) {
        return;
    }

    // Hide all steps
    for (let i = 1; i <= totalSteps; i++) {
        const step = document.getElementById(`step-${i}`);
        const dot = document.getElementById(`dot-${i}`);
        step.classList.remove('active');
        dot.classList.remove('active');
    }

    // Show selected step
    const step = document.getElementById(`step-${stepNumber}`);
    const dot = document.getElementById(`dot-${stepNumber}`);
    step.classList.add('active');
    dot.classList.add('active');

    // Update button visibility and state
    updateButtons(stepNumber);

    currentStep = stepNumber;

    // Clear alerts when changing steps
    hideAlert();
}

/**
 * Move to next step
 */
function nextStep() {
    // Validate current step before moving next
    if (currentStep === 2) {
        if (!validateForm()) {
            return; // Stay on current step if validation fails
        }
        // Submit the form
        submitAdminCreation();
        return;
    }

    if (currentStep < totalSteps) {
        goToStep(currentStep + 1);
    }
}

/**
 * Move to previous step
 */
function previousStep() {
    if (currentStep > 1) {
        goToStep(currentStep - 1);
    }
}

/**
 * Update button visibility and state based on current step
 */
function updateButtons(stepNumber) {
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');

    if (stepNumber === 1) {
        btnPrev.style.display = 'none';
        btnNext.textContent = 'Next';
    } else if (stepNumber === 2) {
        btnPrev.style.display = 'block';
        btnNext.textContent = 'Create Account';
    } else if (stepNumber === 3) {
        btnPrev.style.display = 'none';
        btnNext.style.display = 'none';
    }
}

// ============================================================================
// Form Validation
// ============================================================================

/**
 * Validate email format
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Check password strength
 */
function checkPasswordStrength(password) {
    let strength = 0;

    if (PASSWORD_REQUIREMENTS.length.test(password)) strength++;
    if (PASSWORD_REQUIREMENTS.uppercase.test(password)) strength++;
    if (PASSWORD_REQUIREMENTS.lowercase.test(password)) strength++;
    if (PASSWORD_REQUIREMENTS.number.test(password)) strength++;

    return strength;
}

/**
 * Update password strength indicator
 */
function updatePasswordStrength() {
    const password = document.getElementById('password').value;
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');

    if (!password) {
        strengthFill.className = 'strength-fill';
        strengthText.textContent = 'Password strength: Weak';
        return;
    }

    const strength = checkPasswordStrength(password);

    // Remove all strength classes
    strengthFill.classList.remove('weak', 'fair', 'good', 'strong');

    if (strength <= 1) {
        strengthFill.classList.add('weak');
        strengthText.textContent = 'Password strength: Weak';
    } else if (strength === 2) {
        strengthFill.classList.add('fair');
        strengthText.textContent = 'Password strength: Fair';
    } else if (strength === 3) {
        strengthFill.classList.add('good');
        strengthText.textContent = 'Password strength: Good';
    } else if (strength === 4) {
        strengthFill.classList.add('strong');
        strengthText.textContent = 'Password strength: Strong';
    }
}

/**
 * Clear form errors
 */
function clearErrors() {
    document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('error');
    });
    document.querySelectorAll('.form-error').forEach(error => {
        error.textContent = '';
    });
}

/**
 * Set form error
 */
function setError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(fieldId + 'Error');

    if (field && errorElement) {
        field.parentElement.classList.add('error');
        errorElement.textContent = message;
    }
}

/**
 * Validate the admin creation form
 */
function validateForm() {
    clearErrors();
    let isValid = true;

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validate email
    if (!email) {
        setError('email', 'Email is required');
        isValid = false;
    } else if (!validateEmail(email)) {
        setError('email', 'Please enter a valid email address');
        isValid = false;
    }

    // Validate password
    if (!password) {
        setError('password', 'Password is required');
        isValid = false;
    } else if (password.length < PASSWORD_MIN_LENGTH) {
        setError('password', `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
        isValid = false;
    } else if (!PASSWORD_REQUIREMENTS.uppercase.test(password)) {
        setError('password', 'Password must contain an uppercase letter');
        isValid = false;
    } else if (!PASSWORD_REQUIREMENTS.lowercase.test(password)) {
        setError('password', 'Password must contain a lowercase letter');
        isValid = false;
    } else if (!PASSWORD_REQUIREMENTS.number.test(password)) {
        setError('password', 'Password must contain a number');
        isValid = false;
    }

    // Validate confirm password
    if (!confirmPassword) {
        setError('confirmPassword', 'Please confirm your password');
        isValid = false;
    } else if (password !== confirmPassword) {
        setError('confirmPassword', 'Passwords do not match');
        isValid = false;
    }

    return isValid;
}

// ============================================================================
// Form Submission
// ============================================================================

/**
 * Submit admin creation request
 */
async function submitAdminCreation() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Disable button to prevent double submission
    const btnNext = document.getElementById('btnNext');
    const originalText = btnNext.textContent;
    btnNext.disabled = true;
    btnNext.innerHTML = '<span class="loading"></span>Creating...';

    try {
        // Call bootstrap endpoint
        const response = await fetch('/api/system/bootstrap', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            showAlert(data.error || 'Failed to create admin account', 'error');
            btnNext.disabled = false;
            btnNext.textContent = originalText;
            return;
        }

        // Success! Show confirmation and redirect
        document.getElementById('confirmEmail').textContent = email;
        goToStep(3);

        // Redirect after 3 seconds
        setTimeout(() => {
            window.location.href = '/admin';
        }, 3000);
    } catch (error) {
        console.error('Setup error:', error);
        showAlert('An unexpected error occurred. Please try again.', 'error');
        btnNext.disabled = false;
        btnNext.textContent = originalText;
    }
}

// ============================================================================
// Alert Messages
// ============================================================================

/**
 * Show alert message
 */
function showAlert(message, type = 'info') {
    const alert = document.getElementById('formAlert');
    alert.className = `alert ${type}`;
    alert.textContent = message;
    alert.style.display = 'block';

    // Auto-hide success and info alerts after 5 seconds
    if (type === 'success' || type === 'info') {
        setTimeout(hideAlert, 5000);
    }
}

/**
 * Hide alert message
 */
function hideAlert() {
    const alert = document.getElementById('formAlert');
    alert.style.display = 'none';
}

// ============================================================================
// Event Listeners
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Password strength indicator
    document.getElementById('password').addEventListener('input', updatePasswordStrength);

    // Initial button setup
    updateButtons(1);

    // Check bootstrap status on load
    checkBootstrapStatus();
});

// ============================================================================
// Bootstrap Status Check
// ============================================================================

/**
 * Check if bootstrap is already complete
 */
async function checkBootstrapStatus() {
    try {
        const response = await fetch('/api/system/bootstrap-status', {
            credentials: 'include'
        });

        if (!response.ok) {
            console.error('Failed to check bootstrap status');
            return;
        }

        const data = await response.json();

        if (!data.needsBootstrap) {
            // Bootstrap already complete, redirect to admin panel
            window.location.href = '/admin';
        }
    } catch (error) {
        console.error('Bootstrap status check failed:', error);
    }
}
