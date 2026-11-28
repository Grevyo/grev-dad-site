// Log in and sign up. After signing in, go back to where you were heading (?next=) or Home.
(() => {
  const next = () => {
    const value = new URLSearchParams(location.search).get('next');
    return value && value.startsWith('/') && !value.startsWith('//') ? value : '/home';
  };
  const message = document.getElementById('message');
  const wire = (id, endpoint, build, fallback) => {
    const form = document.getElementById(id);
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type=submit]');
      button.disabled = true; message.textContent = '';
      try {
        const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(build(new FormData(form))) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.message || fallback);
        location.replace(next());
      } catch (error) {
        message.textContent = error.message === 'Failed to fetch' ? "Couldn't reach grev.dad. Check your connection." : error.message;
        button.disabled = false;
      }
    });
  };
  wire('login-form', '/api/auth/login', f => ({ identifier: f.get('identifier'), password: f.get('password'), rememberMe: f.get('rememberMe') === 'on' }), 'Login failed.');
  wire('signup-form', '/api/auth/signup', f => Object.fromEntries(f), 'Sign-up failed.');
})();
