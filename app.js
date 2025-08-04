document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');

    // ##################################################################
    // ## PENTING! GANTI URL DI BAWAH INI DENGAN URL NETLIFY-MU! ##
    // ##################################################################
    const API_URL = "https://bubuwi-v2.netlify.app/api/scrape"; // GANTI DENGAN URL-MU
    // ##################################################################

    let state = {
        currentAnimeDetail: null, // Menyimpan detail anime (judul, thumbnail, semua episode) saat dibuka
        historyStack: [], // Menyimpan riwayat navigasi untuk tombol kembali
    };

    // --- MANAJEMEN DATA LOKAL (di HP Pengguna) ---
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
            // Hapus duplikat anime yang sama, lalu tambahkan yang baru di paling atas
            history = history.filter(item => item.anime_link !== episode.anime_link);
            history.unshift(episode);
            // Simpan hanya 12 riwayat terakhir agar tidak penuh
            localStorage.setItem('bubuwi_history', JSON.stringify(history.slice(0, 12)));
        }
    };

    // --- LAYANAN API (untuk memanggil scraper) ---
    const apiService = {
        fetchData: async (endpoint = '') => {
            try {
                const response = await fetch(`${API_URL}${endpoint}`);
                if (!response.ok) throw new Error('API Gagal merespon');
                const data = await response.json();
                if (!data) throw new Error('Data API kosong');
                return data;
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

    // --- TEMPLATES HTML (untuk membuat tampilan) ---
    const templates = {
        loader: () => `<div id="app-content" class="loader"></div>`,
        bottomNav: (activePage) => `
            <nav class="bottom-nav">
                <button data-page="home" class="nav-button ${activePage === 'home' ? 'active' : ''}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg><span>Beranda</span></button>
                <button data-page="subscribe" class="nav-button ${activePage === 'subscribe' ? 'active' : ''}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3l7 3V5c0-1.1-.9-2-2-2m0 15l-5-2.18L7 18V5h10v13Z"/></svg><span>Subscribe</span></button>
                <button data-page="history" class="nav-button ${activePage === 'history' ? 'active' : ''}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 20a8 8 0 1 0-8-8a8 8 0 0 0 8 8m0-18C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m-1 7v6l5 3l-1-2l-4-2V9Z"/></svg><span>Riwayat</span></button>
                <button data-page="contact" class="nav-button ${activePage === 'contact' ? 'active' : ''}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6m0 13c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5Z"/></svg><span>Kontak</span></button>
            </nav>`,
        homePage: (sliderData, latestData, historyData) => `
            <div class="swiper-container"><div class="swiper-wrapper">${sliderData.map(anime => templates.animeCard(anime, false)).join('')}</div></div>
            <div style="padding: 0 1rem;"><form id="search-form"><input type="search" id="search-input" placeholder="Cari anime..."></form></div>
            ${historyData.length > 0 ? `<div class="section-title">Terakhir Ditonton</div><div class="anime-grid">${historyData.map(anime => templates.animeCard(anime, false)).join('')}</div>` : ''}
            <div class="section-title">Update Terbaru</div>
            <div class="anime-grid">${latestData.map(anime => templates.animeCard(anime, true)).join('')}</div>`,
        animeCard: (anime, isEpisode) => `
            <a href="#" class="anime-card" data-link="${anime.link || anime.anime_link}" data-title="${anime.seriesTitle || anime.anime_title}" data-thumbnail="${anime.thumbnail || anime.anime_thumbnail}">
                <img src="${anime.thumbnail || anime.anime_thumbnail}" alt="">
                <div class="title">${anime.seriesTitle || anime.anime_title}</div>
                ${isEpisode && anime.episode ? `<div class="episode-badge">${anime.episode}</div>` : ''}
            </a>`,
        searchPage: (results = []) => `
            <div class="page-title">Pencarian</div>
            <form id="search-form"><input type="search" id="search-input" placeholder="Ketik judul anime..."></form>
            <div class="anime-grid">${results.length > 0 ? results.map(anime => templates.animeCard(anime, false)).join('') : '<p>Tidak ada hasil.</p>'}</div>`,
        subscribePage: () => {
            const subs = localData.getSubscriptions();
            return `<div class="page-title">Anime yang Kamu Subscribe</div>
                    <div class="anime-grid">${subs.length > 0 ? subs.map(anime => templates.animeCard(anime, false)).join('') : '<p style="padding: 0 1rem;">Kamu belum subscribe anime apapun.</p>'}</div>`;
        },
        historyPage: () => {
            const history = localData.getHistory();
            return `<div class="page-title">Riwayat Tontonan</div>
                    <div class="anime-grid">${history.length > 0 ? history.map(anime => templates.animeCard(anime, false)).join('') : '<p style="padding: 0 1rem;">Riwayat tontonanmu kosong.</p>'}</div>`;
        },
        contactPage: () => `
            <div class="contact-container">
                <div class="page-title">Kontak Developer</div>
                <img src="https://i.imgur.com/9uK2OPw.png" alt="Logo Bubuwi" class="contact-page-logo">
                <a href="https://www.instagram.com/adnanmwa" target="_blank" class="contact-link"><img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png"><span>@adnanmwa</span></a>
                <a href="https://www.tiktok.com/@adnansagiri" target="_blank" class="contact-link"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQNxuydAoOVzXmO6EXy6vZhaJ17jCGvYKITEzu7BNMYkEaux6HqKvnQax0Q&s=10"><span>@adnansagiri</span></a>
            </div>`,
        detailPage: (detailData, animeInfo) => {
            const isSubscribed = localData.isSubscribed(animeInfo.link);
            return `
                <div class="detail-header">
                    <img src="${animeInfo.thumbnail}" alt="${animeInfo.title}">
                    <div class="detail-info"><h2>${animeInfo.title}</h2><p>Total Episode: ${detailData.episodes.length}</p></div>
                </div>
                <button class="button subscribe-button ${isSubscribed ? 'subscribed' : ''}">${isSubscribed ? '✔ Unsubscribe' : '➕ Subscribe'}</button>
                <div class="episode-list">${detailData.episodes.map(ep => `<a href="#" class="episode-card" data-link="${ep.link}"><h3>${ep.title}</h3></a>`).join('')}</div>`;
        },
        watchPage: (watchData, detailData, currentEpisodeLink, animeInfo) => {
            const currentIdx = detailData.episodes.findIndex(ep => ep.link === currentEpisodeLink);
            const prevEp = currentIdx > 0 ? detailData.episodes[currentIdx - 1] : null;
            const nextEp = currentIdx < detailData.episodes.length - 1 ? detailData.episodes[currentIdx + 1] : null;

            return `
                <div class="video-container"><iframe src="${watchData.videoFrames[0] || ''}" allowfullscreen></iframe></div>
                <div class="episode-nav">
                    <button class="button prev-ep-btn" data-link="${prevEp?.link}" ${!prevEp ? 'disabled' : ''}>‹ Prev</button>
                    <button class="button next-ep-btn" data-link="${nextEp?.link}" ${!nextEp ? 'disabled' : ''}>Next ›</button>
                </div>
                <div class="section-title">Episode List</div>
                <div class="episode-selector">${detailData.episodes.map((ep, index) => `<a href="#" class="ep-button ${ep.link === currentEpisodeLink ? 'active' : ''}" data-link="${ep.link}">${index + 1}</a>`).join('')}</div>
                <div class="detail-header">
                    <img src="${animeInfo.thumbnail}" alt="${animeInfo.title}" style="width: 50px; border-radius: 4px;">
                    <div class="detail-info"><h2 style="font-size: 1.2rem;">${animeInfo.title}</h2><p style="margin: 0;">${watchData.title}</p></div>
                </div>`;
        }
    };
    
    const router = {
        render: async (page, params = null) => {
            app.innerHTML = templates.loader();
            app.insertAdjacentHTML('afterend', templates.bottomNav(page));

            try {
                if (page === 'home') {
                    const data = await apiService.fetchHomepage();
                    const history = localData.getHistory();
                    app.innerHTML = templates.homePage(data.slider, data.latest, history);
                    new Swiper('.swiper-container', { loop: true, autoplay: { delay: 3000 }, slidesPerView: 1 });
                } else if (page === 'search') {
                    app.innerHTML = templates.searchPage();
                } else if (page === 'subscribe') {
                    app.innerHTML = templates.subscribePage();
                } else if (page === 'history') {
                    app.innerHTML = templates.historyPage();
                } else if (page === 'contact') {
                    app.innerHTML = templates.contactPage();
                } else if (page === 'detail') {
                    const data = await apiService.fetchDetail(params.link);
                    state.currentAnimeDetail = { ...data, ...params };
                    app.innerHTML = templates.detailPage(data, params);
                } else if (page === 'watch') {
                    const watchData = await apiService.fetchWatch(params.link);
                    app.innerHTML = templates.watchPage(watchData, state.currentAnimeDetail, params.link, state.currentAnimeDetail);
                    localData.addToHistory({ anime_link: state.currentAnimeDetail.link, ...state.currentAnimeDetail });
                }
            } catch (e) { app.innerHTML = `<p>Gagal memuat. Periksa URL API di app.js atau coba lagi.</p>`; }
        }
    };
    
    document.body.addEventListener('click', e => {
        const navButton = e.target.closest('.nav-button');
        if (navButton) {
            e.preventDefault();
            router.render(navButton.dataset.page);
            return;
        }

        const card = e.target.closest('.anime-card, .swiper-slide');
        if (card) {
            e.preventDefault();
            router.render('detail', { link: card.dataset.link, title: card.dataset.title, thumbnail: card.dataset.thumbnail });
            return;
        }
        
        const epCardOrButton = e.target.closest('.episode-card, .ep-button, .prev-ep-btn, .next-ep-btn');
        if (epCardOrButton && epCardOrButton.dataset.link) {
            e.preventDefault();
            router.render('watch', { link: epCardOrButton.dataset.link });
            return;
        }

        const subscribeButton = e.target.closest('.subscribe-button');
        if (subscribeButton) {
            e.preventDefault();
            const isSubscribed = localData.isSubscribed(state.currentAnimeDetail.link);
            if (isSubscribed) {
                localData.removeSubscription(state.currentAnimeDetail.link);
            } else {
                localData.addSubscription(state.currentAnimeDetail);
            }
            subscribeButton.textContent = localData.isSubscribed(state.currentAnimeDetail.link) ? '✔ Unsubscribe' : '➕ Subscribe';
            subscribeButton.classList.toggle('subscribed', localData.isSubscribed(state.currentAnimeDetail.link));
            return;
        }
    });

    document.body.addEventListener('submit', async e => {
        if (e.target.id === 'search-form') {
            e.preventDefault();
            const query = e.target.querySelector('#search-input').value.trim();
            if(query) {
                const resultsContainer = document.getElementById('search-results') || app;
                resultsContainer.innerHTML = templates.loader();
                const data = await apiService.fetchSearch(query);
                resultsContainer.innerHTML = `<div class="anime-grid">${(data.results || []).map(templates.animeCard).join('')}</div>`;
            }
        }
    });

    router.render('home');
});
