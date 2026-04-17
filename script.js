document.addEventListener('DOMContentLoaded', () => {
    // --- SHARED DOM ELEMENTS ---
    const promptBox = document.getElementById('tilt-box');
    const textarea = document.querySelector('.prompt-box textarea');
    const sendBtn = document.getElementById('send-btn');
    const resultsContainer = document.getElementById('results');
    const taskList = document.getElementById('task-list');
    const energyScore = document.getElementById('energy-score');

    // Hide results container initially
    if(resultsContainer) {
        resultsContainer.style.display = 'none';
        resultsContainer.style.marginTop = '20px';
        resultsContainer.style.padding = '20px';
        resultsContainer.style.borderRadius = '24px';
    }

    // --- 1. APPLE-STYLE 3D TILT EFFECT ---
    promptBox.addEventListener('mousemove', (e) => {
        const rect = promptBox.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const rotateY = ((x / rect.width) - 0.5) * 8;
        const rotateX = ((y / rect.height) - 0.5) * -8;

        promptBox.style.transition = 'none';
        promptBox.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        promptBox.style.boxShadow = `${-rotateY}px ${-rotateX}px 30px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.6)`;
    });

    promptBox.addEventListener('mouseleave', () => {
        promptBox.style.transition = 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
        promptBox.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
        promptBox.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.06), inset 0 0 0 1px rgba(255, 255, 255, 0.5)';
    });

    // --- 2. AUTO-EXPANDING TEXTAREA LOGIC ---
    textarea.addEventListener('input', function() {
        this.style.height = 'auto'; // Reset height first
        this.style.height = this.scrollHeight + 'px'; // Set to actual scroll height
    });
    // Trigger it once on load to ensure proper default height
    textarea.dispatchEvent(new Event('input'));

    // --- 3. NAVBAR BUTTON INTERACTION ---
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

    // --- 4. SIMULATE ACTIVE USERS ---
    const userCountElement = document.getElementById('user-count');
    let currentUsers = 12480;
    setInterval(() => {
        const change = Math.floor(Math.random() * 9) - 4;
        currentUsers += change;
        userCountElement.textContent = currentUsers.toLocaleString();
    }, 4500); 

    // --- 5. ENGINE CONNECTION (THE AI BRAIN) ---
    sendBtn.addEventListener('click', async () => {
        console.log("🔥 STEP 1: Send button was clicked!");
        
        const promptText = textarea.value.trim();
        console.log("📝 STEP 2: Captured text ->", promptText);

        if (!promptText) {
            console.log("🛑 STEP 3: Text was empty, stopping here.");
            return;
        }

        console.log("⏳ STEP 4: Changing button icon to spinner...");
        const originalIcon = sendBtn.innerHTML;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            console.log("🚀 STEP 5: Firing fetch request to /api/decompose...");
            const response = await fetch('/api/decompose', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: promptText })
            });

            console.log("📥 STEP 6: Received response status ->", response.status);

            if (!response.ok) {
                console.error("❌ STEP 7: API Response was NOT ok. Status:", response.status);
                throw new Error(`API returned status: ${response.status}`);
            }

            const data = await response.json();
            console.log("🧠 STEP 8: Successfully parsed AI data ->", data);
            
            // 1. Build the new DOM elements first (so they are ready before showing)
            taskList.innerHTML = '';
            
            if(energyScore) {
                energyScore.textContent = `${data.energy_score}/10`;
            }

            data.tasks.forEach(task => {
                const li = document.createElement('li');
                li.style.padding = '12px 15px';
                li.style.margin = '10px 0';
                li.style.borderRadius = '12px';
                li.style.background = 'rgba(255, 255, 255, 0.5)';
                li.style.border = '1px solid rgba(255, 255, 255, 0.8)';
                li.style.listStyle = 'none';
                li.style.display = 'flex';
                li.style.alignItems = 'center';

                if (task.isMVE) {
                    li.style.background = 'rgba(0, 102, 255, 0.1)';
                    li.style.border = '1px solid rgba(0, 102, 255, 0.3)';
                    li.innerHTML = `<i class="fas fa-bolt" style="color: var(--primary-blue); margin-right: 12px; font-size: 1.2rem;"></i> 
                                    <span><strong>MVE (1% Rule):</strong> ${task.step}</span>`;
                } else {
                    li.innerHTML = `<i class="far fa-circle" style="color: #666; margin-right: 12px; font-size: 1.2rem;"></i> 
                                    <span>${task.step}</span>`;
                }
                
                taskList.appendChild(li);
            });

            // 2. Trigger Outgoing Animation for the Prompt Box
            // Clear the 3D tilt transforms first so they don't override the CSS animation
            promptBox.style.transform = ''; 
            promptBox.style.transition = '';
            promptBox.classList.add('hide-animated');

            // 3. Wait for the fade-out to finish, then swap elements and fade-in results
            setTimeout(() => {
                promptBox.style.display = 'none';
                
                resultsContainer.style.display = 'block';
                resultsContainer.classList.add('show-animated');
                
                resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                console.log("✅ STEP 9: UI updated successfully with animations!");
            }, 400); // 400ms matches the slideOutTop animation duration

        } catch (error) {
            console.error("💥 STEP 10 (ERROR): Engine failure caught ->", error);
            alert("The AI brain didn't respond. Check the console!");
        } finally {
            console.log("🔄 STEP 11: Resetting UI state.");
            sendBtn.innerHTML = originalIcon;
            textarea.value = '';
            textarea.style.height = 'auto';
        }
    });
});