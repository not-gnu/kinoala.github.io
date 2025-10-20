document.addEventListener('DOMContentLoaded', () => {
    // Typing effect on blog card hover (unchanged)
    document.querySelectorAll('.blog-card').forEach(card => {
        const titleElement = card.querySelector('.post-title');
        const originalTitle = titleElement.textContent;
  
        let typingTimer;
  
        card.addEventListener('mouseenter', () => {
            clearInterval(typingTimer);
            let i = 0;
            titleElement.textContent = '';
            typingTimer = setInterval(() => {
                if (i < originalTitle.length) {
                    titleElement.textContent += originalTitle.charAt(i);
                    i++;
                } else {
                    clearInterval(typingTimer);
                }
            }, 50);
        });
  
        card.addEventListener('mouseleave', () => {
            clearInterval(typingTimer);
            titleElement.textContent = originalTitle;
        });
    });
  
    // Falling leaves animation
    function createLeaf() {
        const leaf = document.createElement('div');
        leaf.classList.add('leaf');
  
        // Random size between 10 and 25 px
        const size = Math.random() * 15 + 10;
        leaf.style.width = `${size}px`;
        leaf.style.height = `${size}px`;
  
        // Random horizontal start position (0 to 100vw)
        leaf.style.left = `${Math.random() * 100}vw`;
  
        // Start slightly above viewport (already done by CSS top:-40px)
  
        // Random animation duration between 7s and 15s (longer for natural fall)
        const duration = Math.random() * 8 + 7;
  
        // Random horizontal drift for fall (from 0 to ±15px)
        const driftX = (Math.random() - 0.5) * 30; // -15 to +15 px
  
        // Apply fall animation with driftX included inside the animation (via JS)
        leaf.style.animation = `fall ${duration}s linear forwards`;
  
        // For rotation, we apply a separate CSS animation with random speed and direction
        const rotateDuration = Math.random() * 6 + 4; // 4s to 10s rotation speed
        const rotateDirection = Math.random() > 0.5 ? 'normal' : 'reverse';
        leaf.style.animation += `, rotateLeaf ${rotateDuration}s linear infinite`;
        leaf.style.animationDirection = `${rotateDirection}, ${rotateDirection}`;
  
        // Adjust leaf horizontal position drift using JS animation frame
        // We'll manually update translateX to create smooth left-right sway
  
        let startTime = null;
        function animateLeaf(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
  
            // Calculate swayX using sine wave for smooth horizontal oscillation
            const swayX = Math.sin(elapsed / 500) * (Math.abs(driftX) / 2);
  
            // Move leaf down linearly based on elapsed time
            const progress = Math.min(elapsed / (duration * 1000), 1);
            const translateY = progress * window.innerHeight * 1.1; // 110vh
  
            leaf.style.transform = `translate(${swayX}px, ${translateY}px) rotate(${(elapsed / 1000) * 360 / rotateDuration * (rotateDirection === 'reverse' ? -1 : 1)}deg)`;
  
            if (progress < 1) {
                requestAnimationFrame(animateLeaf);
            } else {
                leaf.remove();
            }
        }
        requestAnimationFrame(animateLeaf);
  
        // Append leaf to leaves container
        document.getElementById('leaves-container').appendChild(leaf);
    }
  
    // Create a new leaf every 500 milliseconds for more leaves
    setInterval(createLeaf, 500);
  });
  