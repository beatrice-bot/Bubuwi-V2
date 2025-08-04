document.addEventListener('DOMContentLoaded', () => {
    // =================================================================================
    // KONFIGURASI PENTING
    // =================================================================================

    // ##################################################################
    // ## PENTING! PASTE KODE firebaseConfig DARI FIREBASE DI SINI! ##
    // ##################################################################
    const firebaseConfig = {
      apiKey: "AIzaSyD8HjXwynugy5q-_KlqLajw27PDgUJ4QUk",
      authDomain: "bubuwi-pro.firebaseapp.com",
      projectId: "bubuwi-pro",
      storageBucket: "bubuwi-pro.firebasestorage.app",
      messagingSenderId: "741891119074",
      appId: "1:741891119074:web:93cc65fb2cd94033aa4bbb"
    };
    // ##################################################################
    // ## PENTING! GANTI URL NETLIFY SCRAPER-MU DI SINI! ##
    // ##################################################################
    const API_URL = "https://bubuwi-v2.netlify.app/api/scrape";
    // ##################################################################


    // =================================================================================
    // INISIALISASI & STATE APLIKASI
    // =================================================================================
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const provider = new firebase.auth.GoogleAuthProvider();

    const app = document.getElementById('app');
    let state = {
        currentUser: null,
        currentPage: 'home',
        currentAnimeDetail: null,
        commentsListener: null, // Untuk menyimpan listener komentar agar bisa dilepas
    };

    // =================================================================================
    // FUNGSI BANTU (UTILITIES)
    // =================================================================================
    
    // Fungsi keamanan untuk mencegah serangan XSS
    function escapeHTML(str) {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    }

    // =================================================================================
    // LOGIKA FIREBASE (DATABASE & AUTH)
    // =================================================================================
    
    const firebaseService = {
        handleUserProfile: (user) => {
            const userRef = db.collection('profiles').doc(user.uid);
            userRef.get().then(doc => {
                if (!doc.exists) {
                    userRef.set({
                        username: user.displayName,
                        email: user.email,
                        avatar_url: user.photoURL,
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
            const sub = await db.collection('subscriptions')
                .where('user_id', '==', state.currentUser.uid)
                .where('anime_link', '==', animeLink)
                .limit(1).get();
            return !sub.empty;
        },
        toggleSubscription: async (animeData) => {
            if (!state.currentUser) { alert('Silakan login untuk subscribe!'); return; }
            const isSubbed = await firebaseService.isSubscribed(animeData.link);
            const subsRef = db.collection('subscriptions');
            
            if (isSubbed) {
                // Unsubscribe
                const snapshot = await subsRef.where('user_id', '==', state.currentUser.uid).where('anime_link', '==', animeData.link).get();
                snapshot.forEach(doc => doc.ref.delete());
            } else {
                // Subscribe
                subsRef.add({
                    user_id: state.currentUser.uid,
                    anime_title: animeData.title,
                    anime_link: animeData.link,
                    anime_thumbnail: animeData.thumbnail,
                    created_at: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        },
        postComment: async (episodeLink, commentText) => {
            if (!state.currentUser) { alert('Silakan login untuk berkomentar!'); return; }
            if (commentText.trim() === '') return;
            
            await db.collection('comments').add({
                user_id: state.currentUser.uid,
                username: state.currentUser.displayName,
                avatar_url: state.currentUser.photoURL,
                episode_link: episodeLink,
                comment_text: commentText, // Teks asli disimpan
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        },
        getComments: (episodeLink, callback) => {
            // Hentikan listener lama jika ada
            if (state.commentsListener) state.commentsListener();

            // Buat listener baru
            state.commentsListener = db.collection('comments')
                .where('episode_link', '==', episodeLink)
                .orderBy('created_at', 'desc')
                .onSnapshot(snapshot => {
                    const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    callback(comments);
                });
        }
    };


    // =================================================================================
    // LOGIKA SCRAPER API
    // =================================================================================

    const apiService = {
        fetchData: async (endpoint = '') => {
            try {
                const response = await fetch(`${API_URL}${endpoint}`);
                if (!response.ok) throw new Error('Network response was not ok');
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
    // TEMPLATES HTML
    // =================================================================================

    const templates = {
        loader: () => `<div class="loader"></div>`,
        loginPage: () => `
            <div class="profile-card" style="margin-top: 20vh;">
                <h2>Selamat Datang di Bubuwi</h2>
                <p>Silakan login dengan Google untuk melanjutkan.</p>
                <button id="login-button" class="button">Login dengan Google</button>
            </div>
        `,
        bottomNav: (activePage) => `
            <nav class="bottom-nav">
                <button data-page="home" class="nav-button ${activePage === 'home' ? 'active' : ''}">Home</button>
                <button data-page="subscribe" class="nav-button ${activePage === 'subscribe' ? 'active' : ''}">Subscribe</button>
                <button data-page="history" class="nav-button ${activePage === 'history' ? 'active' : ''}">Riwayat</button>
                <button data-page="account" class="nav-button ${activePage === 'account' ? 'active' : ''}">Akun</button>
            </nav>
        `,
        homePage: (sliderData, latestData) => `
            <div class="swiper-container">
                <div class="swiper-wrapper">
                    ${sliderData.map(anime => `
                        <a href="#" class="swiper-slide" data-link="${anime.link}" data-title="${anime.title}" data-thumbnail="${anime.thumbnail}" style="background-image: url(${anime.thumbnail})">
                            <div class="title">${anime.title}</div>
                        </a>
                    `).join('')}
                </div>
            </div>
            <div class="install-prompt">Install Aplikasi Bubuwi</div>
            <div class="section-title">Riwayat Tontonan</div>
            <div id="history-list"></div>
            <div class="section-title">Update Terbaru</div>
            <div class="anime-grid">
                ${latestData.map(anime => templates.animeCard(anime)).join('')}
            </div>
        `,
        animeCard: (anime) => `
            <a href="#" class="anime-card" data-link="${anime.link || anime.anime_link}" data-title="${anime.seriesTitle || anime.anime_title}" data-thumbnail="${anime.thumbnail || anime.anime_thumbnail}">
                <img src="${anime.thumbnail || anime.anime_thumbnail}" alt="">
                <div class="title">${anime.seriesTitle || anime.anime_title}</div>
            </a>`,
        accountPage: (user) => `
            <div class="page-title">Akun Saya</div>
            <div class="profile-card">
                <img src="${user.photoURL}" alt="Foto Profil" class="profile-pic">
                <h2>${user.displayName}</h2>
                <p>${user.email}</p>
                <button id="logout-button" class="button">Logout</button>
            </div>
            <div class="section-title">Kontak Developer</div>
            // ... (kontak developer di sini)
        `,
        watchPage: (data, detailData, episodeLink) => `
            <h2 class="watch-title">${data.title}</h2>
            <div class="video-container"><iframe src="${data.videoFrames[0] || ''}" allowfullscreen></iframe></div>
            <div class="episode-nav">
                <button class="button prev-ep-btn">‹ Episode Sebelumnya</button>
                <button class="button next-ep-btn">Episode Selanjutnya ›</button>
            </div>
            <div class="section-title">Episode List</div>
            <div class="episode-selector">
                ${detailData.episodes.map((ep, index) => `
                    <a href="#" class="ep-button ${ep.link === episodeLink ? 'active' : ''}" data-link="${ep.link}">${index + 1}</a>
                `).join('')}
            </div>
            <div class="section-title">Komentar</div>
            <div class="comment-section">
                <form id="comment-form">
                    <input type="text" id="comment-input" placeholder="Tulis komentar..." required>
                    <button type="submit" class="button">Kirim</button>
                </form>
                <div id="comment-list"></div>
            </div>
        `,
        commentItem: (comment) => `
            <div class="comment">
                <img src="${comment.avatar_url}" alt="${comment.username}">
                <div class="comment-body">
                    <span class="username">${escapeHTML(comment.username)}</span>
                    <p class="text">${escapeHTML(comment.comment_text)}</p>
                </div>
            </div>
        `
    };

    // =================================================================================
    // ROUTER & RENDER LOGIC
    // =================================================================================

    const router = {
        render: async (page, params = null) => {
            state.currentPage = page;
            const contentContainer = document.createElement('div');
            contentContainer.innerHTML = templates.loader();
            
            // Hapus listener komentar lama setiap ganti halaman
            if (state.commentsListener) {
                state.commentsListener();
                state.commentsListener = null;
            }

            try {
                if (page === 'home') {
                    const data = await apiService.fetchHomepage();
                    contentContainer.innerHTML = templates.homePage(data.slider, data.latest);
                    new Swiper('.swiper-container', { loop: true, autoplay: { delay: 3000 } });
                } else if (page === 'account') {
                    contentContainer.innerHTML = templates.accountPage(state.currentUser);
                } else if (page === 'detail') {
                    // ... (logika untuk render halaman detail)
                } else if (page === 'watch') {
                    state.currentAnimeDetail = await apiService.fetchDetail(params.animeLink);
                    const watchData = await apiService.fetchWatch(params.episodeLink);
                    contentContainer.innerHTML = templates.watchPage(watchData, state.currentAnimeDetail, params.episodeLink);
                    
                    firebaseService.getComments(params.episodeLink, (comments) => {
                        const commentList = document.getElementById('comment-list');
                        if (commentList) {
                            commentList.innerHTML = comments.map(templates.commentItem).join('');
                        }
                    });
                }
                
                app.innerHTML = ''; // Hapus loader
                app.appendChild(contentContainer);
                app.insertAdjacentHTML('beforeend', templates.bottomNav(page));

            } catch (error) {
                app.innerHTML = `<p>Gagal memuat halaman. Coba lagi nanti.</p>`;
            }
        }
    };
    

    // =================================================================================
    // EVENT LISTENERS
    // =================================================================================
    
    document.body.addEventListener('click', (e) => {
        // Navigasi
        const navButton = e.target.closest('.nav-button');
        if (navButton) {
            router.render(navButton.dataset.page);
        }
        
        // Logout
        const logoutButton = e.target.closest('#logout-button');
        if(logoutButton) {
            auth.signOut();
        }

        // Klik kartu anime
        const animeCard = e.target.closest('.anime-card, .swiper-slide');
        if(animeCard) {
            e.preventDefault();
            router.render('detail', {
                link: animeCard.dataset.link,
                title: animeCard.dataset.title,
                thumbnail: animeCard.dataset.thumbnail
            });
        }
        
        // Klik episode
        const epButton = e.target.closest('.ep-button');
        if(epButton) {
            e.preventDefault();
            router.render('watch', {
                episodeLink: epButton.dataset.link,
                animeLink: state.currentAnimeDetail.link // Asumsi kita simpan ini di state
            });
        }
    });

    document.body.addEventListener('submit', e => {
        // Form komentar
        if (e.target.id === 'comment-form') {
            e.preventDefault();
            const input = e.target.querySelector('#comment-input');

            // Dapatkan episodeLink dari state atau dari elemen di halaman
            // Ini contoh, perlu disesuaikan
            const currentEpisodeLink = document.querySelector('.ep-button.active')?.dataset.link;
            
            if (currentEpisodeLink && input.value) {
                firebaseService.postComment(currentEpisodeLink, input.value);
                input.value = '';
            }
        }
    });
});