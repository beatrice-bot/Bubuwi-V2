document.addEventListener('DOMContentLoaded', () => {
    // ##################################################################
    // ## PENTING! PASTE KODE firebaseConfig DARI FIREBASE DI SINI! ##
    // ##################################################################
    const firebaseConfig = {
      apiKey: "AIzaSyD8HjXwynugy5q-_KlqLajw27PDgUJ4QUk",
      authDomain: "bubuwi-pro.firebaseapp.com",
      projectId: "bubuwi-pro",
      storageBucket: "bubuwi-pro.appspot.com",
      messagingSenderId: "741891119074",
      appId: "1:741891119074:web:93cc65fb2cd94033aa4bbb"
    };
    // ##################################################################
    // ## PENTING! GANTI URL NETLIFY SCRAPER-MU DI SINI! ##
    // ##################################################################
    const API_URL = "https://bubuwi-v2.netlify.app/api/scrape";
    // ##################################################################

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const provider = new firebase.auth.GoogleAuthProvider();

    const app = document.getElementById('app');
    let state = {
        currentUser: null,
        currentAnimeDetail: null,
        commentsListener: null,
    };

    function escapeHTML(str) {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    }
    
    const firebaseService = {
        handleUserProfile: (user) => {
            const userRef = db.collection('profiles').doc(user.uid);
            userRef.get().then(doc => {
                if (!doc.exists) {
                    userRef.set({
                        username: user.displayName, email: user.email, avatar_url: user.photoURL,
                        created_at: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            });
        },
        getSubscriptions: async () => {
            if (!state.currentUser) return [];
            const subs = await db.collection('subscriptions').where('user_id', '==', state.currentUser.uid).get();
            return subs.docs.map(doc => doc.data());
        },
        isSubscribed: async (animeLink) => {
            if (!state.currentUser) return false;
            const sub = await db.collection('subscriptions').where('user_id', '==', state.currentUser.uid).where('anime_link', '==', animeLink).limit(1).get();
            return !sub.empty;
        },
        toggleSubscription: async (animeData) => {
            if (!state.currentUser) { alert('Silakan login untuk subscribe!'); return; }
            const isSubbed = await firebaseService.isSubscribed(animeData.link);
            const subsRef = db.collection('subscriptions');
            if (isSubbed) {
                const snapshot = await subsRef.where('user_id', '==', state.currentUser.uid).where('anime_link', '==', animeData.link).get();
                snapshot.forEach(doc => doc.ref.delete());
            } else {
                subsRef.add({
                    user_id: state.currentUser.uid, anime_title: animeData.title, anime_link: animeData.link,
                    anime_thumbnail: animeData.thumbnail, created_at: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        },
        postComment: async (episodeLink, commentText) => {
            if (!state.currentUser) { alert('Silakan login untuk berkomentar!'); return; }
            if (commentText.trim() === '') return;
            await db.collection('comments').add({
                user_id: state.currentUser.uid, username: state.currentUser.displayName,
                avatar_url: state.currentUser.photoURL, episode_link: episodeLink,
                comment_text: commentText, created_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        },
        getComments: (episodeLink, callback) => {
            if (state.commentsListener) state.commentsListener();
            state.commentsListener = db.collection('comments').where('episode_link', '==', episodeLink)
                .orderBy('created_at', 'desc').limit(20)
                .onSnapshot(snapshot => {
                    const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    callback(comments);
                });
        }
    };

    const apiService = {
        fetchData: async (endpoint = '') => {
            try {
                const response = await fetch(`${API_URL}${endpoint}`);
                if (!response.ok) throw new Error('Network response was not ok');
                return await response.json();
            } catch (error) { console.error("API Fetch Error:", error); return null; }
        },
        fetchHomepage: () => apiService.fetchData(),
        fetchSearch: (query) => apiService.fetchData(`?search=${encodeURIComponent(query)}`),
        fetchDetail: (url) => apiService.fetchData(`?animePage=${encodeURIComponent(url)}`),
        fetchWatch: (url) => apiService.fetchData(`?url=${encodeURIComponent(url)}`)
    };

    const templates = {
        loader: () => `<div class="loader"></div>`,
        loginPage: () => `<div class="profile-card" style="margin-top: 20vh;"><h2>Selamat Datang di Bubuwi</h2><p>Silakan login dengan Google untuk melanjutkan.</p><button id="login-button" class="button">Login dengan Google</button></div>`,
        bottomNav: (activePage) => `
            <nav class="bottom-nav">
                <button data-page="home" class="nav-button ${activePage === 'home' ? 'active' : ''}"><svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg><span>Beranda</span></button>
                <button data-page="subscribe" class="nav-button ${activePage === 'subscribe' ? 'active' : ''}"><svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3l7 3V5c0-1.1-.9-2-2-2m0 15l-5-2.18L7 18V5h10v13Z"/></svg><span>Subscribe</span></button>
                <button data-page="history" class="nav-button ${activePage === 'history' ? 'active' : ''}"><svg viewBox="0 0 24 24"><path d="M12 20a8 8 0 1 0-8-8a8 8 0 0 0 8 8m0-18C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m-1 7v6l5 3l-1-2l-4-2V9Z"/></svg><span>Riwayat</span></button>
                <button data-page="account" class="nav-button ${activePage === 'account' ? 'active' : ''}"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6m0 13c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5Z"/></svg><span>Akun</span></button>
            </nav>`,
        homePage: (sliderData, latestData) => `
            <div class="swiper-container"><div class="swiper-wrapper">${sliderData.map(anime => `<a href="#" class="swiper-slide" data-link="${anime.link}" data-title="${anime.title}" data-thumbnail="${anime.thumbnail}" style="background-image: url(${anime.thumbnail})"><div class="title">${anime.title}</div></a>`).join('')}</div></div>
            <div class="install-prompt">Install Aplikasi Bubuwi ke Homescreen</div>
            <form id="search-form"><input type="search" id="search-input" placeholder="Cari anime..."></form>
            <div class="section-title">Update Terbaru</div>
            <div class="anime-grid">${latestData.map(anime => templates.animeCard(anime)).join('')}</div>`,
        animeCard: (anime) => `<a href="#" class="anime-card" data-link="${anime.link || anime.anime_link}" data-title="${anime.seriesTitle || anime.anime_title}" data-thumbnail="${anime.thumbnail || anime.anime_thumbnail}"><img src="${anime.thumbnail || anime.anime_thumbnail}" alt=""><div class="title">${anime.seriesTitle || anime.anime_title}</div></a>`,
        accountPage: (user) => `
            <div class="page-title">Akun Saya</div>
            <div class="profile-card">
                <img src="${user.photoURL}" alt="Foto Profil" class="profile-pic">
                <h2>${user.displayName}</h2><p>${user.email}</p>
                <button id="logout-button" class="button">Logout</button>
            </div>
            <div class="section-title">Kontak Developer</div>
            <a href="https://instagram.com/adnanmwa" target="_blank">IG: @adnanmwa</a><br>
            <a href="https://tiktok.com/@adnansagiri" target="_blank">TikTok: @adnansagiri</a>`,
        watchPage: (data, detailData, episodeLink) => `
            <div class="video-container"><iframe src="${data.videoFrames[0] || ''}" allowfullscreen></iframe></div>
            <div class="episode-nav">
                <button class="button prev-ep-btn">‹ Prev</button>
                <a href="${data.downloadLink || '#'}" target="_blank" class="button">Download</a>
                <button class="button next-ep-btn">Next ›</button>
            </div>
            <div class="section-title">Episode List</div>
            <div class="episode-selector">${detailData.episodes.map((ep, index) => `<a href="#" class="ep-button ${ep.link === episodeLink ? 'active' : ''}" data-link="${ep.link}">${index + 1}</a>`).join('')}</div>
            <div class="section-title">Komentar</div>
            <div class="comment-section">
                <form id="comment-form"><input type="text" id="comment-input" placeholder="Tulis komentar..." required><button type="submit" class="button">Kirim</button></form>
                <div id="comment-list"></div>
            </div>`,
        commentItem: (comment) => `
            <div class="comment">
                <img src="${comment.avatar_url}" alt="${comment.username}">
                <div class="comment-body">
                    <div class="username">${escapeHTML(comment.username)}</div>
                    <div class="text">${escapeHTML(comment.comment_text)}</div>
                </div>
            </div>`
    };

    const router = {
        render: async (page, params = null) => {
            // ... (logika router yang kompleks akan ada di sini)
        }
    };

    auth.onAuthStateChanged(user => {
        state.currentUser = user;
        app.innerHTML = templates.loader();
        if (user) {
            firebaseService.handleUserProfile(user);
            renderApp(user);
        } else {
            renderLogin();
        }
    });
});
