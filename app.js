document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');

    // ##################################################################
    // ## PENTING! GANTI URL DI BAWAH INI DENGAN URL NETLIFY-MU! ##
    // ##################################################################
    const API_URL = "https://bubuwi-v2.netlify.app/api/scrape"; // GANTI DENGAN URL-MU
    // ##################################################################
    
    let state = { currentAnimeDetail: null, historyStack: [] };

    const localData = {
        getSubscriptions: () => JSON.parse(localStorage.getItem('bubuwi_subs')) || [],
        addSubscription: (anime) => {
            const subs = localData.getSubscriptions();
            if (!subs.find(s => s.link === anime.link)) {
                // Standarkan data yang disimpan
                const dataToSave = {
                    link: anime.link,
                    seriesTitle: anime.title,
                    thumbnail: anime.thumbnail
                };
                localStorage.setItem('bubuwi_subs', JSON.stringify([dataToSave, ...subs]));
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
            history = history.filter(item => item.link !== episode.link);
            // Standarkan data yang disimpan
            const dataToSave = {
                link: episode.link,
                seriesTitle: episode.title,
                thumbnail: episode.thumbnail
            };
            history.unshift(dataToSave);
            localStorage.setItem('bubuwi_history', JSON.stringify(history.slice(0, 12)));
        }
    };

    const apiService = {
        fetchData: async (endpoint = '') => {
            try {
                app.querySelector('#app-content').innerHTML = templates.loader();
                const response = await fetch(`${API_URL}${endpoint}`);
                if (!response.ok) throw new Error('API Gagal merespon');
                const data = await response.json();
                if (!data) throw new Error('Data API kosong');
                return data;
            } catch (error) { 
                console.error("API Fetch Error:", error);
                app.querySelector('#app-content').innerHTML = `<p style="padding: 1rem;">Gagal memuat. Periksa koneksi atau coba lagi nanti.</p>`;
                return null;
            }
        }
    };

    const templates = {
        loader: () => `<div class="loader"></div>`,
        bottomNav: (activePage) => {
            const pages = { home: 'Beranda', subscribe: 'Subscribe', history: 'Riwayat', contact: 'Kontak' };
            const icons = {
                home: `<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`,
                subscribe: `<svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3l7 3V5c0-1.1-.9-2-2-2m0 15l-5-2.18L7 18V5h10v13Z"/></svg>`,
                history: `<svg viewBox="0 0 24 24"><path d="M12 20a8 8 0 1 0-8-8a8 8 0 0 0 8 8m0-18C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m-1 7v6l5 3l-1-2l-4-2V9Z"/></svg>`,
                contact: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6m0 13c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5Z"/></svg>`
            };
            const nav = document.querySelector('.bottom-nav');
            nav.innerHTML = Object.keys(pages).map(p => `<button data-page="${p}" class="nav-button ${activePage === p ? 'active' : ''}">${icons[p]}<span>${pages[p]}</span></button>`).join('');
        },
        homePage: (sliderData, latestData, historyData) => `
            <div class="swiper-container"><div class="swiper-wrapper">${sliderData.map(anime => templates.animeCard(anime, false)).join('')}</div></div>
            ${historyData.length > 0 ? `<div class="section-title">Terakhir Ditonton</div><div class="anime-grid">${historyData.map(anime => templates.animeCard(anime, false)).join('')}</div>` : ''}
            <div class="section-title">Update Terbaru</div>
            <div class="anime-grid">${latestData.map(anime => templates.animeCard(anime, true)).join('')}</div>`,
        animeCard: (anime, isEpisode) => `
            <a href="#" class="anime-card" data-link="${anime.link || anime.anime_link}" data-title="${anime.seriesTitle || anime.title}" data-thumbnail="${anime.thumbnail || anime.anime_thumbnail}" data-is-episode="${isEpisode || false}">
                <img src="${anime.thumbnail || anime.anime_thumbnail}" alt="">
                <div class="title">${anime.seriesTitle || anime.title}</div>
                ${isEpisode && anime.episode ? `<div class="episode-badge">${anime.episode}</div>` : ''}
            </a>`,
        searchPage: (results = []) => `<div class="page-title">Pencarian</div><form id="search-form"><input type="search" id="search-input" placeholder="Ketik judul anime..."></form><div class="anime-grid">${results.length > 0 ? results.map(anime => templates.animeCard(anime, false)).join('') : '<p>Ketik sesuatu untuk memulai pencarian.</p>'}</div>`,
        subscribePage: () => {
            const subs = localData.getSubscriptions();
            return `<div class="page-title">Anime yang Kamu Subscribe</div><div class="anime-grid">${subs.length > 0 ? subs.map(anime => templates.animeCard(anime, false)).join('') : '<p style="padding: 0 1rem;">Kamu belum subscribe anime apapun.</p>'}</div>`;
        },
        historyPage: () => {
            const history = localData.getHistory();
            return `<div class="page-title">Riwayat Tontonan</div><div class="anime-grid">${history.length > 0 ? history.map(anime => templates.animeCard(anime, false)).join('') : '<p style="padding: 0 1rem;">Riwayat tontonanmu kosong.</p>'}</div>`;
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
                <div class="info-box detail-header">
                    <img src="${animeInfo.thumbnail}" alt="${animeInfo.title}">
                    <div class="detail-info"><h2>${animeInfo.title}</h2><p>Total Episode: ${detailData.episodes.length}</p></div>
                </div>
                <button class="button subscribe-button ${isSubscribed ? 'subscribed' : ''}">${isSubscribed ? '✔ Unsubscribe' : '➕ Subscribe'}</button>
                <div class="episode-list-styled">${detailData.episodes.map(ep => `<a href="#" class="episode-card" data-link="${ep.link}"><h3>${ep.title}</h3></a>`).join('')}</div>`;
        },
        watchPage: (watchData, detailData, currentEpisodeLink, animeInfo) => {
            const currentIdx = detailData.episodes.findIndex(ep => ep.link === currentEpisodeLink);
            const prevEp = currentIdx > 0 ? detailData.episodes[currentIdx - 1] : null;
            const nextEp = currentIdx < detailData.episodes.length - 1 ? detailData.episodes[currentIdx + 1] : null;
            return `
                <div class="video-container"><iframe src="${watchData.videoFrames[0] || ''}" allowfullscreen></iframe></div>
                <div class="info-box watch-info-box">
                    <div class="detail-header">
                        <img src="${animeInfo.thumbnail}" alt="${animeInfo.title}" style="width: 50px; border-radius: 4px;">
                        <div class="detail-info"><h2 style="font-size: 1.2rem;">${animeInfo.title}</h2><p style="margin: 0;">${watchData.title}</p></div>
                    </div>
                </div>
                <div class="episode-nav">
                    <button class="button prev-ep-btn" data-link="${prevEp?.link}" ${!prevEp ? 'disabled' : ''}>‹ Prev</button>
                    <button class="button next-ep-btn" data-link="${nextEp?.link}" ${!nextEp ? 'disabled' : ''}>Next ›</button>
                </div>
                <div class="section-title">Episode List</div>
                <div class="episode-selector">${detailData.episodes.map((ep, index) => `<a href="#" class="ep-button ${ep.link === currentEpisodeLink ? 'active' : ''}" data-link="${ep.link}">${index + 1}</a>`).join('')}</div>`;
        }
    };
    
    const router = async (page, params = null) => {
        appContent.innerHTML = templates.loader();
        templates.bottomNav(page);
        
        state.historyStack.push({page, params});

        try {
            if (page === 'home') {
                const data = await apiService.fetchData();
                const history = localData.getHistory();
                appContent.innerHTML = templates.homePage(data.slider, data.latest, history);
                new Swiper('.swiper-container', { loop: true, autoplay: { delay: 3000 }, slidesPerView: 'auto', spaceBetween: 16 });
            } else if (page === 'search') {
                appContent.innerHTML = templates.searchPage();
            } else if (page === 'subscribe') {
                appContent.innerHTML = templates.subscribePage();
            } else if (page === 'history') {
                appContent.innerHTML = templates.historyPage();
            } else if (page === 'contact') {
                appContent.innerHTML = templates.contactPage();
            } else if (page === 'detail') {
                let detailLink = params.link;
                if (params.isEpisode === "true") {
                    const searchData = await apiService.fetchData(`?search=${encodeURIComponent(params.title)}`);
                    if (searchData.results && searchData.results.length > 0) {
                        detailLink = searchData.results[0].link;
                    }
                }
                const data = await apiService.fetchData(`?animePage=${encodeURIComponent(detailLink)}`);
                state.currentAnimeDetail = { ...data, link: detailLink, title: params.title, thumbnail: params.thumbnail };
                appContent.innerHTML = templates.detailPage(data, state.currentAnimeDetail);
            } else if (page === 'watch') {
                const watchData = await apiService.fetchData(`?url=${encodeURIComponent(params.link)}`);
                appContent.innerHTML = templates.watchPage(watchData, state.currentAnimeDetail, params.link, state.currentAnimeDetail);
                localData.addToHistory({ ...state.currentAnimeDetail });
            }
        } catch (e) { appContent.innerHTML = `<p>Gagal memuat halaman. Coba lagi nanti.</p>`; }
    };
    
    document.body.addEventListener('click', e => {
        const navButton = e.target.closest('.nav-button');
        if (navButton) { e.preventDefault(); router(navButton.dataset.page); return; }

        const card = e.target.closest('.anime-card, .swiper-slide');
        if (card) {
            e.preventDefault();
            router('detail', { 
                link: card.dataset.link, 
                title: card.dataset.title, 
                thumbnail: card.dataset.thumbnail,
                isEpisode: card.dataset.isEpisode
            });
            return;
        }
        
        const epButton = e.target.closest('.episode-card, .ep-button, .prev-ep-btn, .next-ep-btn');
        if (epButton && epButton.dataset.link && epButton.dataset.link !== 'null') {
            e.preventDefault();
            router('watch', { link: epButton.dataset.link });
            return;
        }
        
        const subscribeButton = e.target.closest('.subscribe-button');
        if (subscribeButton) {
            e.preventDefault();
            const isSubscribed = localData.isSubscribed(state.currentAnimeDetail.link);
            if (isSubscribed) localData.removeSubscription(state.currentAnimeDetail.link);
            else localData.addSubscription(state.currentAnimeDetail);
            
            const isNowSubscribed = localData.isSubscribed(state.currentAnimeDetail.link);
            subscribeButton.textContent = isNowSubscribed ? '✔ Unsubscribe' : '➕ Subscribe';
            subscribeButton.classList.toggle('subscribed', isNowSubscribed);
            return;
        }
    });

    document.body.addEventListener('submit', async e => {
        if (e.target.id === 'search-form') {
            e.preventDefault();
            const query = e.target.querySelector('#search-input').value.trim();
            if(query) {
                const resultsContainer = document.getElementById('search-results');
                resultsContainer.innerHTML = templates.loader();
                const data = await apiService.fetchData(`?search=${encodeURIComponent(query)}`);
                resultsContainer.innerHTML = (data.results || []).map(anime => templates.animeCard(anime, false)).join('');
            }
        }
    });

    router('home');
});
