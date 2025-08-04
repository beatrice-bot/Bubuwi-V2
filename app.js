document.addEventListener('DOMContentLoaded', () => {
    // =================================================================================
    // KONFIGURASI PENTING
    // =================================================================================
    
    // ##################################################################
    // ## PENTING! GANTI URL DI BAWAH INI DENGAN URL NETLIFY-MU! ##
    // ##################################################################
    const API_URL = "https://bubuwi-v2.netlify.app/api/scrape"; // GANTI DENGAN URL-MU
    // ##################################################################

    const app = document.getElementById('app');
    let state = {
        currentAnimeDetail: null, // Untuk menyimpan data detail anime saat ini
    };

    // =================================================================================
    // LAYANAN DATA LOKAL (localStorage)
    // =================================================================================
    const localData = {
        getSubscriptions: () => JSON.parse(localStorage.getItem('bubuwi_subs')) || [],
        addSubscription: (anime) => {
            const subs = localData.getSubscriptions();
            if (!subs.find(s => s.link === anime.link)) {
                localStorage.setItem('bubuwi_subs', JSON.stringify([anime, ...subs]));
            }
        },
        removeSubscription: (animeLink) => {
            let subs = localData.getSubscriptions();
            subs = subs.filter(s => s.link !== animeLink);
            localStorage.setItem('bubuwi_subs', JSON.stringify(subs));
        },
        isSubscribed: (animeLink) => localData.getSubscriptions().some(s => s.link === animeLink),
        getHistory: () => JSON.parse(localStorage.getItem('bubuwi_history')) || [],
        addToHistory: (episode) => {
            let history = localData.getHistory();
            history = history.filter(item => item.episode_link !== episode.episode_link);
            history.unshift(episode);
            localStorage.setItem('bubuwi_history', JSON.stringify(history.slice(0, 12))); // Simpan 12 riwayat terakhir
        }
    };

    // =================================================================================
    // LAYANAN API (SCRAPER)
    // =================================================================================
    const apiService = {
        fetchData: async (endpoint = '') => {
            try {
                const response = await fetch(`${API_URL}${endpoint}`);
                if (!response.ok) throw new Error('API Gagal merespon');
                return await response.json();
            } catch (error) {
                console.error("API Fetch Error:", error);
                return null;
            }
        },
        fetchHomepage: () => apiService.fetchData(),
        fetchSearch: (query) => apiService.fetchData(`?search=${encodeURIComponent(query)}`),
        fetchDetail: (url) => apiService.fetchData(`?animePage=${encodeURIComponent(url)}`),
        fetchWatch: (url) => apiService.fetchData(`?url=${encodeURIComponent(url)}`)
    };

    // =================================================================================
    // TEMPLATES HTML (KERANGKA TAMPILAN)
    // =================================================================================
    const templates = {
        loader: () => `<div class="loader"></div>`,
        bottomNav: (activePage) => `
            <nav class="bottom-nav">
                <button data-page="home" class="nav-button ${activePage === 'home' ? 'active' : ''}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg><span>Beranda</span></button>
                <button data-page="subscribe" class="nav-button ${activePage === 'subscribe' ? 'active' : ''}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3l7 3V5c0-1.1-.9-2-2-2m0 15l-5-2.18L7 18V5h10v13Z"/></svg><span>Subscribe</span></button>
                <button data-page="history" class="nav-button ${activePage === 'history' ? 'active' : ''}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 20a8 8 0 1 0-8-8a8 8 0 0 0 8 8m0-18C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m-1 7v6l5 3l-1-2l-4-2V9Z"/></svg><span>Riwayat</span></button>
                <button data-page="contact" class="nav-button ${activePage === 'contact' ? 'active' : ''}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6m0 13c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5Z"/></svg><span>Kontak</span></button>
            </nav>`,
        homePage: (sliderData, latestData, historyData) => `
            <div class="swiper-container"><div class="swiper-wrapper">${sliderData.map(anime => `<a href="#" class="swiper-slide" data-link="${anime.link}" data-title="${anime.title}" data-thumbnail="${anime.thumbnail}" style="background-image: url(${anime.thumbnail})"><div class="title">${anime.title}</div></a>`).join('')}</div></div>
            <div class="install-prompt">Install Aplikasi Bubuwi-V2 ke Homescreen</div>
            <form id="search-form"><input type="search" id="search-input" placeholder="Cari anime..."></form>
            ${historyData.length > 0 ? `<div class="section-title">Terakhir Ditonton</div><div class="anime-grid">${historyData.map(templates.animeCard).join('')}</div>` : ''}
            <div class="section-title">Update Terbaru</div>
            <div class="anime-grid">${latestData.map(templates.animeCard).join('')}</div>`,
        animeCard: (anime) => `<a href="#" class="anime-card" data-link="${anime.link || anime.anime_link}" data-title="${anime.seriesTitle || anime.anime_title}" data-thumbnail="${anime.thumbnail || anime.anime_thumbnail}"><img src="${anime.thumbnail || anime.anime_thumbnail}" alt=""><div class="title">${anime.seriesTitle || anime.anime_title}</div></a>`,
        searchPage: (results = []) => `
            <div class="page-title">Pencarian</div>
            <form id="search-form"><input type="search" id="search-input" placeholder="Ketik judul anime..."></form>
            <div id="search-results" class="anime-grid">${results.map(templates.animeCard).join('')}</div>`,
        subscribePage: () => {
            const subs = localData.getSubscriptions();
            return `<div class="page-title">Anime yang Kamu Subscribe</div>
                    <div class="anime-grid">${subs.length > 0 ? subs.map(templates.animeCard).join('') : '<p>Kamu belum subscribe anime apapun.</p>'}</div>`;
        },
        historyPage: () => {
            const history = localData.getHistory();
            return `<div class="page-title">Riwayat Tontonan</div>
                    <div class="anime-grid">${history.length > 0 ? history.map(templates.animeCard).join('') : '<p>Riwayat tontonanmu kosong.</p>'}</div>`;
        },
        contactPage: () => `
            <div class="contact-container">
                <div class="page-title">Kontak Developer</div>
                <img src="https://i.imgur.com/9uK2OPw.png" alt="Logo Bubuwi" class="contact-page-logo">
                <a href="https://www.instagram.com/adnanmwa" target="_blank" class="contact-link">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" alt="Instagram">
                    <span>@adnanmwa</span>
                </a>
                <a href="https://www.tiktok.com/@adnansagiri" target="_blank" class="contact-link">
                    <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQNxuydAoOVzXmO6EXy6vZhaJ17jCGvYKITEzu7BNMYkEaux6HqKvnQax0Q&s=10" alt="TikTok">
                    <span>@adnansagiri</span>
                </a>
            </div>`,
        detailPage: (detailData, animeInfo) => {
            const isSubscribed = localData.isSubscribed(animeInfo.link);
            return `
                <div class="detail-header">
                    <img src="${animeInfo.thumbnail}" alt="${animeInfo.title}">
                    <div class="detail-info"><h2>${animeInfo.title}</h2><p>Total Episode: ${detailData.episodes.length}</p></div>
                </div>
                <button class="button subscribe-button ${isSubscribed ? 'subscribed' : ''}">${isSubscribed ? '✔ Unsubscribe' : '➕ Subscribe'}</button>
                <div class="episode-list">${detailData.episodes.map(ep => `<a href="#" class="ep-button" data-link="${ep.link}">${ep.title.split(' ').pop()}</a>`).join('')}</div>`;
        },
        watchPage: (watchData, detailData, currentEpisodeLink, animeInfo) => {
            const currentIdx = detailData.episodes.findIndex(ep => ep.link === currentEpisodeLink);
            return `
                <div class="video-container"><iframe src="${watchData.videoFrames[0] || ''}" allowfullscreen></iframe></div>
                <div class="episode-nav">
                    <button class="button prev-ep-btn" ${currentIdx === 0 ? 'disabled' : ''}>‹ Prev</button>
                    <a href="${watchData.downloadLink || '#'}" target="_blank" class="button">Download</a>
                    <button class="button next-ep-btn" ${currentIdx === detailData.episodes.length - 1 ? 'disabled' : ''}>Next ›</button>
                </div>
                <div class="section-title">Episode List</div>
                <div class="episode-selector">${detailData.episodes.map((ep, index) => `<a href="#" class="ep-button ${ep.link === currentEpisodeLink ? 'active' : ''}" data-link="${ep.link}">${index + 1}</a>`).join('')}</div>
                <div class="detail-header">
                    <img src="${animeInfo.thumbnail}" alt="${animeInfo.title}" style="width: 50px; border-radius: 4px;">
                    <div class="detail-info"><h2 style="font-size: 1.2rem;">${animeInfo.title}</h2><p style="margin: 0;">${watchData.title}</p></div>
                </div>
            `;
        }
    };
    
    // =================================================================================
    // ROUTER UTAMA APLIKASI
    // =================================================================================
    
    const router = {
        render: async (page, params = null) => {
            app.innerHTML = templates.loader() + templates.bottomNav(page);
            try {
                let content = '';
                if (page === 'home') {
                    const data = await apiService.fetchHomepage();
                    const history = localData.getHistory();
                    content = templates.homePage(data.slider, data.latest, history);
                } else if (page === 'search') {
                    content = templates.searchPage();
                } else if (page === 'subscribe') {
                    content = templates.subscribePage();
                } else if (page === 'history') {
                    content = templates.historyPage();
                } else if (page === 'contact') {
                    content = templates.contactPage();
                }
                app.innerHTML = content + templates.bottomNav(page);
                if (page === 'home') new Swiper('.swiper-container', { loop: true, autoplay: { delay: 3000 } });
            } catch (e) { app.innerHTML = `<p>Gagal memuat. Periksa koneksi atau coba lagi nanti.</p>` + templates.bottomNav(page); }
        }
    };

    // =================================================================================
    // FUNGSI HANDLER UNTUK AKSI PENGGUNA
    // =================================================================================

    async function handleSearch(query) {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;
        resultsContainer.innerHTML = templates.loader();
        const data = await apiService.fetchSearch(query);
        resultsContainer.innerHTML = (data.results || []).map(templates.animeCard).join('');
    }

    async function handleDetail(link, title, thumbnail) {
        app.innerHTML = templates.loader() + templates.bottomNav('home'); // Tampilkan nav saat loading
        const data = await apiService.fetchDetail(link);
        state.currentAnimeDetail = { ...data, link, title, thumbnail }; // Simpan data lengkap
        app.innerHTML = templates.detailPage(data, { link, title, thumbnail }) + templates.bottomNav('home');
    }

    async function handleWatch(episodeLink, animeInfo) {
        app.innerHTML = templates.loader() + templates.bottomNav('home');
        if (!state.currentAnimeDetail || state.currentAnimeDetail.link !== animeInfo.link) {
            state.currentAnimeDetail = await apiService.fetchDetail(animeInfo.link);
            state.currentAnimeDetail = { ...state.currentAnimeDetail, ...animeInfo };
        }
        const watchData = await apiService.fetchWatch(episodeLink);
        app.innerHTML = templates.watchPage(watchData, state.currentAnimeDetail, episodeLink, animeInfo) + templates.bottomNav('home');
        localData.addToHistory({ ...animeInfo, episode_link: episodeLink });
    }

    // =================================================================================
    // EVENT LISTENER UTAMA
    // =================================================================================

    document.body.addEventListener('click', async e => {
        const navButton = e.target.closest('.nav-button');
        if (navButton) {
            e.preventDefault();
            router.render(navButton.dataset.page);
            return;
        }

        const animeCard = e.target.closest('.anime-card, .swiper-slide');
        if (animeCard) {
            e.preventDefault();
            handleDetail(animeCard.dataset.link, animeCard.dataset.title, animeCard.dataset.thumbnail);
            return;
        }

        const epButton = e.target.closest('.ep-button');
        if (epButton) {
            e.preventDefault();
            handleWatch(epButton.dataset.link, state.currentAnimeDetail);
            return;
        }

        const subscribeButton = e.target.closest('.subscribe-button');
        if (subscribeButton) {
            e.preventDefault();
            localData.toggleSubscription(state.currentAnimeDetail);
            subscribeButton.textContent = localData.isSubscribed(state.currentAnimeDetail.link) ? '✔ Unsubscribe' : '➕ Subscribe';
            subscribeButton.classList.toggle('subscribed', localData.isSubscribed(state.currentAnimeDetail.link));
            return;
        }
    });

    document.body.addEventListener('submit', e => {
        if (e.target.id === 'search-form') {
            e.preventDefault();
            const query = e.target.querySelector('#search-input').value.trim();
            if (query) handleSearch(query);
        }
    });

    // Jalankan aplikasi
    router.render('home');
});
