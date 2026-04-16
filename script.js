document.addEventListener('DOMContentLoaded', () => {
    // 1. Apple-Style 3D Tilt Effect on the Prompt Box
    const promptBox = document.getElementById('tilt-box');

    promptBox.addEventListener('mousemove', (e) => {
        const rect = promptBox.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Calculate refined rotation (inverted for natural tracking)
        const rotateY = ((x / rect.width) - 0.5) * 8;
        const rotateX = ((y / rect.height) - 0.5) * -8;

        // Apply transform and dynamic light shadow
        promptBox.style.transition = 'none';
        promptBox.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        promptBox.style.boxShadow = `${-rotateY}px ${-rotateX}px 30px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.6)`;
    });

    promptBox.addEventListener('mouseleave', () => {
        // Smooth cubic-bezier reset back to default resting state
        promptBox.style.transition = 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
        promptBox.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
        promptBox.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.06), inset 0 0 0 1px rgba(255, 255, 255, 0.5)';
    });

    // --- NEW: AUTO-EXPANDING TEXTAREA LOGIC ---
    const textarea = document.querySelector('.prompt-box textarea');
    
    textarea.addEventListener('input', function() {
        this.style.height = 'auto'; // Reset height first
        this.style.height = this.scrollHeight + 'px'; // Set to actual scroll height
    });
    // Trigger it once on load to ensure proper default height
    textarea.dispatchEvent(new Event('input'));

    // 2. Navbar button interaction
    const navButtons = document.querySelectorAll('.nav-buttons .icon-btn');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Tiny scale bounce effect
            btn.style.transform = 'scale(0.9)';
            setTimeout(() => {
                btn.style.transform = 'scale(1)';
            }, 150);
        });
    });

    // 3. Optional: Simulate active users fluctuating slightly
    const userCountElement = document.getElementById('user-count');
    let currentUsers = 12480;

    setInterval(() => {
        // Randomly add or subtract between 1 and 5 users
        const change = Math.floor(Math.random() * 9) - 4;
        currentUsers += change;

        // Format with comma
        userCountElement.textContent = currentUsers.toLocaleString();
    }, 4500); // Update every 4.5 seconds
});