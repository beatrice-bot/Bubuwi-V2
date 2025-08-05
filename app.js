document.addEventListener('DOMContentLoaded', () => {
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

    let currentUser = null;
    let viewHistory = ['home-view'];
    let currentAnimeData = {}; // Menyimpan data anime (termasuk list episode)
    let commentsData = {}; // { 'animeUrl-episodeUrl': [...] }

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

    // --- FUNGSI OTENTIKASI & USER INFO ---
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

    // --- FUNGSI NAVIGASI ---
    function switchView(viewId, pushToHistory = true) {
        if (pushToHistory && viewHistory[viewHistory.length - 1] !== viewId) {
            viewHistory.push(viewId);
        }
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        mainContent.scrollTop = 0;
        navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewId));
    }

    navButtons.forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));

    backButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (viewHistory.length > 1) {
                viewHistory.pop();
                switchView(viewHistory[viewHistory.length - 1], false);
            }
        });
    });

    // --- FUNGSI RENDER TAMPILAN ---
    function renderLoading(container) { container.innerHTML = '<p style="text-align:center; padding: 20px;">Memuat...</p>'; }
    function renderError(container, message = "Gagal memuat data.") { container.innerHTML = `<p style="text-align:center; padding: 20px;">${message}</p>`; }
    
    function createEmptyStateCard(message) {
        return `<div class="card empty-state-card">${message}</div>`;
    }

    // --- FUNGSI UTAMA (PANGGIL SCRAPER & RENDER) ---

    async function initializeHomepage() {
        const sliderContainer = document.querySelector('.slider');
        const latestList = document.getElementById('latest-releases-list');
        const popularList = document.getElementById('popular-list');
        renderLoading(sliderContainer); renderLoading(latestList); renderLoading(popularList);
        
        try {
            const response = await fetch('/.netlify/functions/scrape?target=home');
            const data = await response.json();
            
            sliderContainer.innerHTML = data.slider.map(a => `<div class="slide" data-anime-url="${a.url}"><img src="${a.poster}" alt="${a.title}"><div class="title">${a.title}</div></div>`).join('');
            sliderContainer.querySelectorAll('.slide').forEach(s => s.addEventListener('click', () => showEpisodeList(s.dataset.animeUrl)));

            latestList.innerHTML = ''; data.latest.forEach(a => latestList.appendChild(createAnimeCard(a)));
            popularList.innerHTML = ''; data.popularWeekly.forEach(a => popularList.appendChild(createPopularItem(a)));

        } catch (error) { console.error(error); renderError(sliderContainer); renderError(latestList); renderError(popularList); }
        updateHomeHistory();
    }

    function createAnimeCard(anime) {
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.dataset.animeUrl = anime.url;
        const displayTitle = anime.episode ? `${anime.episode}` : anime.title;
        card.innerHTML = `<img src="${anime.poster}" alt="${anime.title}" loading="lazy"><div class="title">${displayTitle}</div>`;
        card.addEventListener('click', () => showEpisodeList(anime.url));
        return card;
    }

    function createPopularItem(anime) {
        const item = document.createElement('div');
        item.className = 'popular-item';
        item.dataset.animeUrl = anime.url;
        item.innerHTML = `<span class="rank">${anime.rank}</span><img src="${anime.poster}" alt="${anime.title}" loading="lazy"><div class="info"><div class="title">${anime.title}</div></div>`;
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
            const response = await fetch(`/.netlify/functions/scrape?target=search&query=${encodeURIComponent(query)}`);
            const data = await response.json();
            resultsList.innerHTML = '';
            if (data.length > 0) data.forEach(a => resultsList.appendChild(createAnimeCard(a)));
            else renderError(resultsList, 'Anime tidak ditemukan.');
        } catch (error) { console.error(error); renderError(resultsList); }
    }
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', e => e.key === 'Enter' && performSearch());

    async function showEpisodeList(animeUrl) {
        switchView('episode-list-view');
        const detailContent = document.getElementById('anime-detail-content');
        const episodeList = document.getElementById('episode-list');
        renderLoading(detailContent); renderLoading(episodeList);
        try {
            const response = await fetch(`/.netlify/functions/scrape?target=episodes&url=${encodeURIComponent(animeUrl)}`);
            const data = await response.json();
            currentAnimeData = { ...data, animeUrl }; // Simpan data, termasuk URL dasarnya

            detailContent.innerHTML = `<img src="${data.poster}" alt="${data.title}"><div class="info"><h2>${data.title}</h2><p>${data.synopsis}</p></div>`;
            episodeList.innerHTML = '';
            data.episodes.forEach(ep => {
                const epItem = document.createElement('div');
                epItem.className = 'episode-item';
                const epNum = ep.title.match(/Episode (\d+)/);
                epItem.textContent = epNum ? `Eps ${epNum[1]}` : ep.title;
                epItem.addEventListener('click', () => showWatchPage(ep.url));
                episodeList.appendChild(epItem);
            });
        } catch (error) { console.error(error); renderError(detailContent); renderError(episodeList); }
    }

    async function showWatchPage(episodeUrl) {
        switchView('watch-view');
        const videoPlayer = document.getElementById('video-player');
        const watchInfoBox = document.getElementById('watch-info-box');
        const episodeListWatch = document.getElementById('episode-list-watch');
        const prevBtn = document.getElementById('prev-episode');
        const nextBtn = document.getElementById('next-episode');

        renderLoading(watchInfoBox);
        episodeListWatch.innerHTML = '';
        videoPlayer.src = '';
        prevBtn.disabled = true;
        nextBtn.disabled = true;

        try {
            const response = await fetch(`/.netlify/functions/scrape?target=watch&url=${encodeURIComponent(episodeUrl)}`);
            const watchData = await response.json();

            videoPlayer.src = watchData.videoEmbedUrl;
            
            const currentEp = currentAnimeData.episodes.find(ep => ep.url === episodeUrl);
            watchInfoBox.innerHTML = `<h3>${currentAnimeData.title}</h3><p>${currentEp.title}</p>`;

            prevBtn.disabled = !watchData.prevEpisodeUrl;
            nextBtn.disabled = !watchData.nextEpisodeUrl;
            prevBtn.onclick = () => watchData.prevEpisodeUrl && showWatchPage(watchData.prevEpisodeUrl);
            nextBtn.onclick = () => watchData.nextEpisodeUrl && showWatchPage(watchData.nextEpisodeUrl);

            // Render "Episode Lainnya"
            currentAnimeData.episodes.forEach(ep => {
                const epItem = document.createElement('div');
                epItem.className = 'episode-item';
                epItem.classList.toggle('active', ep.url === episodeUrl);
                const epNum = ep.title.match(/Episode (\d+)/);
                epItem.textContent = epNum ? `Eps ${epNum[1]}` : ep.title;
                epItem.addEventListener('click', () => showWatchPage(ep.url));
                episodeListWatch.appendChild(epItem);
            });
            
            renderComments(episodeUrl);
            commentSubmitBtn.onclick = () => submitComment(episodeUrl);

        } catch (error) { console.error(error); renderError(watchInfoBox, 'Gagal memuat video.'); }
    }
    
    // --- FUNGSI KOMENTAR (DIPERBAIKI) ---
    commentInput.addEventListener('input', () => {
        commentSubmitBtn.disabled = commentInput.value.trim() === '';
    });

    function renderComments(episodeUrl) {
        const commentKey = episodeUrl;
        const commentsList = document.getElementById('comments-list');
        const comments = commentsData[commentKey] || [];
        
        if (comments.length === 0) {
            commentsList.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">Belum Ada Komen</p>';
            return;
        }

        commentsList.innerHTML = '';
        comments.forEach(c => {
            const commentDiv = document.createElement('div');
            commentDiv.className = 'comment';
            const escapedComment = c.comment.replace(/</g, "&lt;").replace(/>/g, "&gt;"); // Anti-XSS
            commentDiv.innerHTML = `
                <img src="${c.user.photoURL}" alt="User" class="profile-pic-comment">
                <div class="comment-content">
                    <p class="username">${c.user.displayName}</p>
                    <p>${escapedComment}</p>
                </div>`;
            commentsList.appendChild(commentDiv);
        });
    }

    function submitComment(episodeUrl) {
        const commentText = commentInput.value.trim();
        if (!commentText || !currentUser) return;

        const commentKey = episodeUrl;
        if (!commentsData[commentKey]) commentsData[commentKey] = [];

        commentsData[commentKey].unshift({
            user: { displayName: currentUser.displayName, photoURL: currentUser.photoURL },
            comment: commentText
        });
        
        commentInput.value = '';
        commentSubmitBtn.disabled = true;
        renderComments(episodeUrl);
    }
    
    // --- FUNGSI RIWAYAT & SUBSCRIBE ---
    function updateHomeHistory() {
        const homeHistoryList = document.getElementById('home-history-list');
        // Implementasi riwayat...
    }
    
    function updateHistoryPage() {
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = createEmptyStateCard('Riwayat tontonanmu masih kosong.');
    }
    
    function updateSubscribePage() {
        const subscribedList = document.getElementById('subscribed-list');
        subscribedList.innerHTML = createEmptyStateCard('Kamu belum subscribe anime apapun.');
    }
    
    document.querySelector('[data-view="history-view"]').addEventListener('click', updateHistoryPage);
    document.querySelector('[data-view="subscribe-view"]').addEventListener('click', updateSubscribePage);

    // --- PWA Service Worker ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed: ', err));
        });
    }
});
