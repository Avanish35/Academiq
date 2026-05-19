const API_BASE_URL = 'http://localhost:5000/api';

document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('authForm');
    const toggleAuth = document.getElementById('toggleAuth');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const togglePrompt = document.getElementById('togglePrompt');
    const nameGroup = document.getElementById('nameGroup');
    
    let isLogin = true;

    // Check if already logged in
    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = 'index.html';
    }

    toggleAuth.addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;

        if (isLogin) {
            authTitle.textContent = 'Welcome Back';
            authSubtitle.textContent = 'Log in to continue your academic journey.';
            btnText.textContent = 'Sign In';
            togglePrompt.innerHTML = 'Don\'t have an account? <a href="#" id="toggleAuth">Create Account</a>';
            nameGroup.style.display = 'none';
        } else {
            authTitle.textContent = 'Create Account';
            authSubtitle.textContent = 'Join Academiq and start optimizing today.';
            btnText.textContent = 'Sign Up';
            togglePrompt.innerHTML = 'Already have an account? <a href="#" id="toggleAuth">Log In</a>';
            nameGroup.style.display = 'block';
        }

        // Re-attach listener to the new link
        document.getElementById('toggleAuth').addEventListener('click', (e) => {
            e.preventDefault();
            toggleAuth.click();
        });
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const name = document.getElementById('name').value;

        const endpoint = isLogin ? '/auth/login' : '/auth/register';
        const body = isLogin ? { email, password } : { name, email, password };

        try {
            submitBtn.disabled = true;
            btnText.textContent = isLogin ? 'Signing In...' : 'Creating Account...';

            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (response.ok) {
                if (isLogin) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = 'index.html';
                } else {
                    alert('Account created successfully! Please log in.');
                    isLogin = true;
                    toggleAuth.click();
                }
            } else {
                alert(data.message || 'Authentication failed');
            }
        } catch (err) {
            console.error('Auth error:', err);
            alert('Server connection failed. Please make sure the backend is running.');
        } finally {
            submitBtn.disabled = false;
            btnText.textContent = isLogin ? 'Sign In' : 'Sign Up';
        }
    });

    // Mantra Rotation Logic
    const mantras = [
        "Success is the sum of small efforts repeated daily.",
        "Your only limit is your mind.",
        "Focus on being productive, not busy.",
        "Plan your work and work your plan.",
        "The best way to predict your future is to create it.",
        "Excellence is not an act, but a habit.",
        "Small steps every day lead to big results.",
        "Don't stop until you're proud."
    ];

    const mantraText = document.getElementById('mantraText');
    let mantraIndex = 0;

    function rotateMantra() {
        if (!mantraText) return;
        
        // Fade out
        mantraText.classList.remove('fade-in');
        
        // Wait for fade out, then change text and fade in
        setTimeout(() => {
            mantraText.textContent = mantras[mantraIndex];
            mantraText.classList.add('fade-in');
            mantraIndex = (mantraIndex + 1) % mantras.length;
        }, 1000);
    }

    if (mantraText) {
        rotateMantra(); // Initial call
        setInterval(rotateMantra, 6000); // Rotate every 6s
    }
});
