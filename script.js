document.addEventListener('DOMContentLoaded', () => {
    // Staggered animation for links
    const links = document.querySelectorAll('.link-card');
    links.forEach((link, index) => {
        link.style.opacity = '0';
        link.style.transform = 'translateY(20px)';
        link.style.transition = 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        
        // Add hover transition back after load
        setTimeout(() => {
             link.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
        }, 1000 + (index * 100));

        setTimeout(() => {
            link.style.opacity = '1';
            link.style.transform = 'translateY(0)';
        }, 300 + (index * 100));
    });

    // Subtle tilt effect on mouse move for desktop
    const container = document.querySelector('.container');
    
    if (window.matchMedia("(min-width: 768px)").matches) {
        document.addEventListener('mousemove', (e) => {
            const x = (window.innerWidth / 2 - e.pageX) / 50;
            const y = (window.innerHeight / 2 - e.pageY) / 50;
            
            container.style.transform = `translate(${x}px, ${y}px)`; 
            // Note: This overrides the fadeIn transform, so we apply it carefully or use wrapper
            // But since fadeIn finishes, we can overwrite or better yet, apply to a wrapper inside container if needed.
            // For simplicity in this "linktree" style, a subtle parallax on the whole container works well.
        });
    }
});
