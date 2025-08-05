document.addEventListener('DOMContentLoaded', () => {
    // --- KONFIGURASI FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyD8HjXwynugy5q-_KlqLajw27PDgUJ4QUk",
        authDomain: "bubuwi-pro.firebaseapp.com",
        projectId: "bubuwi-pro",
        storageBucket: "bubuwi-pro.appspot.com",
        messagingSenderId: "741891119074",
        appId: "1:741891119074:web:93cc65fb2cd94033aa4bbb"
    };
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();

    // --- STATE APLIKASI ---
    let currentUser = null;
    let viewHistory = ['home-view']; // Untuk handle tombol kembali
    let currentAnimeData = {}; // Menyimpan data anime yang sedang dilihat

    // --- ELEMEN DOM ---
    const loginPage = document.getElementById('login-page');
    const appContainer = document.getElementById('app-container');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const mainContent = document.getElementById('main-content');
    const navButtons = document.querySelectorAll('.nav-button');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const backButtons = document.querySelectorAll('.back-button');
    const commentInput = document.getElementById('comment-input');
    const commentSubmitBtn = document.getElementById('comment-submit-btn');
    
    // --- FUNGSI OTENTIKASI ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loginPage.style.display = 'none';
            appContainer.style.display = 'flex';
            updateUserInfo(user);
            initializeHomepage();
        } else {
            currentUser = null;
            loginPage.style.display = 'flex';
            appContainer.style.display = 'none';
        }
    });

    loginBtn.addEventListener('click', () => auth.signInWithPopup(provider).catch(console.error));
    logoutBtn.addEventListener('click', () => auth.signOut());

    function updateUserInfo(user) {
        document.getElementById('user-pic').src = user.photoURL;
        document.getElementById('user-name').textContent = user.displayName;
        document.getElementById('user-email').textContent = user.email;
        document.getElementById('comment-user-pic').src = user.photoURL;
    }

    // --- FUNGSI NAVIGASI & VIEW ---
    function switchView(viewId, pushToHistory = true) {
        if (pushToHistory) {
            viewHistory.push(viewId);
        }
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        mainContent.scrollTop = 0;

        navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewId);
        });
    }

    navButtons.forEach(button => {
        button.addEventListener('click', () => switchView(button.dataset.view));
    });

    backButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (viewHistory.length > 1) {
                viewHistory.pop();
                switchView(viewHistory[viewHistory.length - 1], false);
            }
        });
    });

    // --- FUNGSI RENDER KONTEN ---
    function renderLoading(container) {
        container.innerHTML = '<p>Loading...</p>';
    }

    function renderError(container, message = "Gagal memuat data.") {
        container.innerHTML = `<p>${message}</p>`;
    }
    
    // --- FUNGSI SCRAPER CALLS & RENDER ---

    async function initializeHomepage() {
        const sliderContainer = document.querySelector('.slider');
        const latestList = document.getElementById('latest-releases-list');
        const popularList = document.getElementById('popular-list');
        
        renderLoading(sliderContainer);
        renderLoading(latestList);
        renderLoading(popularList);
        
        try {
            const response = await fetch('/.netlify/functions/scrape?target=home');
            const data = await response.json();

            // Render Slider
            sliderContainer.innerHTML = data.slider.map(anime => `
                <div class="slide" data-anime-url="${anime.url}">
                    <img src="${anime.poster}" alt="${anime.title}">
                    <div class="title">${anime.title}</div>
                </div>
            `).join('');
            sliderContainer.querySelectorAll('.slide').forEach(slide => {
                 slide.addEventListener('click', () => showEpisodeList(slide.dataset.animeUrl));
            });

            // Render Latest Release
            latestList.innerHTML = '';
            data.latest.forEach(anime => latestList.appendChild(createAnimeCard(anime)));

            // Render Popular Weekly
            popularList.innerHTML = '';
            data.popularWeekly.forEach(anime => popularList.appendChild(createPopularItem(anime)));

        } catch (error) {
            console.error(error);
            renderError(sliderContainer);
            renderError(latestList);
            renderError(popularList);
        }
    }

    function createAnimeCard(anime) {
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.dataset.animeUrl = anime.url;
        const displayTitle = anime.episode ? `${anime.title} - ${anime.episode}` : anime.title;
        card.innerHTML = `
            <img src="${anime.poster}" alt="${anime.title}" loading="lazy">
            <div class="title">${displayTitle}</div>`;
        card.addEventListener('click', () => showEpisodeList(anime.url));
        return card;
    }

    function createPopularItem(anime) {
        const item = document.createElement('div');
        item.className = 'popular-item';
        item.dataset.animeUrl = anime.url;
        item.innerHTML = `
            <span class="rank">${anime.rank}</span>
            <img src="${anime.poster}" alt="${anime.title}" loading="lazy">
            <div class="info"><div class="title">${anime.title}</div></div>`;
        item.addEventListener('click', () => showEpisodeList(anime.url));
        return item;
    }

    async function performSearch() {
        const query = searchInput.value.trim();
        if (!query) return;
        switchView('search-results-view');
        const resultsList = document.getElementById('search-results-list');
        renderLoading(resultsList);
        try {
            const response = await fetch(`/.netlify/functions/scrape?target=search&query=${query}`);
            const data = await response.json();
            resultsList.innerHTML = '';
            if (data.length > 0) {
                data.forEach(anime => resultsList.appendChild(createAnimeCard(anime)));
            } else {
                renderError(resultsList, 'Anime tidak ditemukan.');
            }
        } catch (error) {
            console.error(error);
            renderError(resultsList);
        }
    }

    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', e => e.key === 'Enter' && performSearch());

    async function showEpisodeList(animeUrl) {
        switchView('episode-list-view');
        const detailContent = document.getElementById('anime-detail-content');
        const episodeList = document.getElementById('episode-list');
        renderLoading(detailContent);
        renderLoading(episodeList);
        try {
            const response = await fetch(`/.netlify/functions/scrape?target=episodes&url=${encodeURIComponent(animeUrl)}`);
            currentAnimeData = await response.json(); // Simpan data anime saat ini
            
            detailContent.innerHTML = `
                <img src="${currentAnimeData.poster}" alt="${currentAnimeData.title}">
                <div class="info">
                    <h2>${currentAnimeData.title}</h2>
                    <p>${currentAnimeData.synopsis}</p>
                </div>`;
            
            episodeList.innerHTML = '';
            currentAnimeData.episodes.forEach(ep => {
                const epItem = document.createElement('div');
                epItem.className = 'episode-item';
                // Ekstrak nomor episode dari judul
                const epNum = ep.title.match(/Episode (\d+)/);
                epItem.textContent = epNum ? `Eps ${epNum[1]}` : ep.title;
                epItem.addEventListener('click', () => showWatchPage(ep.url));
                episodeList.appendChild(epItem);
            });
        } catch (error) {
            console.error(error);
            renderError(detailContent);
            renderError(episodeList);
        }
    }

    async function showWatchPage(episodeUrl) {
        switchView('watch-view');
        const videoPlayer = document.getElementById('video-player');
        const watchInfo = document.querySelector('.video-info');
        renderLoading(watchInfo);
        videoPlayer.src = '';

        try {
            const response = await fetch(`/.netlify/functions/scrape?target=watch&url=${encodeURIComponent(episodeUrl)}`);
            const watchData = await response.json();

            videoPlayer.src = watchData.videoEmbedUrl;
            
            document.getElementById('watch-anime-poster').src = currentAnimeData.poster;
            document.getElementById('watch-anime-title').textContent = currentAnimeData.title;
            // Dapatkan judul episode dari URL
            const currentEp = currentAnimeData.episodes.find(ep => ep.url === episodeUrl);
            document.getElementById('watch-episode-number').textContent = currentEp.title;

            const prevBtn = document.getElementById('prev-episode');
            const nextBtn = document.getElementById('next-episode');

            prevBtn.disabled = !watchData.prevEpisodeUrl;
            nextBtn.disabled = !watchData.nextEpisodeUrl;

            prevBtn.onclick = () => watchData.prevEpisodeUrl && showWatchPage(watchData.prevEpisodeUrl);
            nextBtn.onclick = () => watchData.nextEpisodeUrl && showWatchPage(watchData.nextEpisodeUrl);

        } catch (error) {
            console.error(error);
            renderError(watchInfo);
        }
    }
    
    // --- PWA Service Worker ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed: ', err));
        });
    }
});
