document.addEventListener('DOMContentLoaded', () => {
    initializePage('home');
    const content = document.getElementById('app-content');
    content.innerHTML = `<div class="loader"></div>`;
    
    apiService.fetchHomepage().then(data => {
        content.innerHTML = `
            <div class="swiper-container"><div class="swiper-wrapper">${data.slider.map(templates.animeCard).join('')}</div></div>
            <div class="section-title">Update Terbaru</div>
            <div class="anime-grid">${data.latest.map(templates.animeCard).join('')}</div>
        `;
        new Swiper('.swiper-container', { loop: true, autoplay: { delay: 3000 } });
    });
});
