// File: js/app.js

const API_URL = "https://bubuwi-v2.netlify.app/api/scrape"; // GANTI DENGAN URL-MU

const localData = {
    // ... (Logika localStorage untuk subscribe & history dari jawaban sebelumnya)
};

const templates = {
    header: () => `
        <header class="main-header">
            <img src="https://i.imgur.com/9uK2OPw.png" alt="Logo Bubuwi" class="header-logo">
            <h1>Bubuwi-V2</h1>
        </header>`,
    bottomNav: (activePage) => `
        <nav class="bottom-nav">
            <a href="index.html" class="nav-button ${activePage === 'home' ? 'active' : ''}">Home</a>
            <a href="subscribe.html" class="nav-button ${activePage === 'subscribe' ? 'active' : ''}">Subscribe</a>
            <a href="history.html" class="nav-button ${activePage === 'history' ? 'active' : ''}">Riwayat</a>
            <a href="contact.html" class="nav-button ${activePage === 'contact' ? 'active' : ''}">Kontak</a>
        </nav>`,
    // ... (Template lainnya seperti animeCard, detailPage, watchPage)
};

// Fungsi ini akan dijalankan di setiap halaman
function initializePage(activePage) {
    const container = document.getElementById('app-container');
    container.insertAdjacentHTML('afterbegin', templates.header());
    container.insertAdjacentHTML('beforeend', templates.bottomNav(activePage));
}
