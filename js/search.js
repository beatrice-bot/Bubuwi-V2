document.addEventListener('DOMContentLoaded', () => {
    initializePage('search');
    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="page-title">Pencarian</div>
        <form id="search-form"><input type="search" id="search-input" placeholder="Ketik judul anime..."></form>
        <div id="search-results" class="anime-grid"></div>`;
    
    document.getElementById('search-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('search-input').value.trim();
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.innerHTML = `<div class="loader"></div>`;
        apiService.fetchSearch(query).then(data => {
            resultsContainer.innerHTML = (data.results || []).map(templates.animeCard).join('');
        });
    });
});
