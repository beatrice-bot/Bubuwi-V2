document.addEventListener('DOMContentLoaded', () => {
    // --- KONFIGURASI & INISIALISASI FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyD8HjXwynugy5q-_KlqLajw27PDgUJ4QUk",
        authDomain: "bubuwi-pro.firebaseapp.com",
        projectId: "bubuwi-pro",
        // URL INI PENTING DAN SUDAH DIPERBAIKI
        databaseURL: "https://bubuwi-pro-default-rtdb.asia-southeast1.firebasedatabase.app", 
        storageBucket: "bubuwi-pro.appspot.com",
        messagingSenderId: "741891119074",
        appId: "1:741891119074:web:93cc65fb2cd94033aa4bbb"
    };
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();
    const provider = new firebase.auth.GoogleAuthProvider();

    // --- STATE & ELEMEN DOM ---
    let currentUser = null;
    let viewHistoryStack = ['home-view'];
    let currentAnimeData = {};
    let activeListeners = []; // Untuk menyimpan semua listener aktif

    const mainContent = document.getElementById('main-content');
    const appContainer = document.getElementById('app-container');
    const loginPage = document.getElementById('login-page');

    // --- FUNGSI LOADING INDICATOR ---
    function showLoading(isLoading) {
        let loadingOverlay = document.getElementById('loading-overlay');
        if (isLoading) {
            if (!loadingOverlay) {
                loadingOverlay = document.createElement('div');
                loadingOverlay.id = 'loading-overlay';
                loadingOverlay.innerHTML = '<div class="spinner"></div>';
                document.body.appendChild(loadingOverlay);
            }
            loadingOverlay.style.display = 'flex';
        } else {
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
        }
    }
    // Tambahkan style untuk loading indicator di CSS jika belum ada
    if (!document.querySelector('style#dynamic-styles')) {
        const style = document.createElement('style');
        style.id = 'dynamic-styles';
        style.innerHTML = `
            #loading-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 9999; }
            .spinner { width: 50px; height: 50px; border: 5px solid #555; border-top-color: var(--accent-color); border-radius: 50%; animation: spin 1s linear infinite; }
            @keyframes spin { to { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
    }
    

    // --- FUNGSI OTENTIKASI (DIPERBAIKI) ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loginPage.style.display = 'none';
            appContainer.style.display = 'flex';
            updateUserInfo(user);
            // PERBAIKAN UTAMA: Langsung tampilkan dan muat halaman utama
            switchView('home-view', true);
        } else {
            currentUser = null;
            loginPage.style.display = 'flex';
            appContainer.style.display = 'none';
        }
    });

    document.getElementById('login-btn').addEventListener('click', () => auth.signInWithPopup(provider).catch(console.error));
    document.getElementById('logout-btn').addEventListener('click', () => {
        // Hapus semua listener sebelum logout
        activeListeners.forEach(l => l.ref.off('value', l.callback));
        activeListeners = [];
        auth.signOut();
    });

    function updateUserInfo(user) {
        document.getElementById('user-pic').src = user.photoURL;
        document.getElementById('user-name').textContent = user.displayName;
        document.getElementById('user-email').textContent = user.email;
        document.getElementById('comment-user-pic').src = user.photoURL;
    }
    
    // --- FUNGSI NAVIGASI & TAMPILAN (DIPERBARUI) ---
    function switchView(viewId, isRoot = false) {
        if (isRoot) viewHistoryStack = [viewId];
        else if (viewHistoryStack[viewHistoryStack.length - 1] !== viewId) viewHistoryStack.push(viewId);
        
        // Hapus semua listener firebase sebelum pindah halaman
        activeListeners.forEach(l => l.ref.off('value', l.callback));
        activeListeners = [];

        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        mainContent.scrollTop = 0;

        document.querySelectorAll('.nav-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewId);
        });

        // Logika pemanggilan data dipindah ke event listener
    }

    // LOGIKA NAVIGASI DIPERBARUI: Data dimuat saat tombol diklik
    document.querySelectorAll('.nav-button').forEach(button => {
        button.addEventListener('click', () => {
            const viewId = button.dataset.view;
            switchView(viewId);
            // Panggil fungsi pemuat data berdasarkan view yang dituju
            if (viewId === 'home-view') initializeHomepage();
            if (viewId === 'history-view') updateHistoryPage();
            if (viewId === 'subscribe-view') updateSubscribePage();
        });
    });

    document.querySelectorAll('.back-button').forEach(b => b.addEventListener('click', () => {
        if (viewHistoryStack.length > 1) { 
            viewHistoryStack.pop(); 
            const prevView = viewHistoryStack[viewHistoryStack.length - 1];
            switchView(prevView, false);
            // Muat ulang data untuk view sebelumnya
            if (prevView === 'home-view') initializeHomepage();
            if (prevView === 'history-view') updateHistoryPage();
            if (prevView === 'subscribe-view') updateSubscribePage();
        }
    }));

    // --- FUNGSI SCRAPER & RENDER ---

    async function initializeHomepage() {
        showLoading(true);
        const slider = document.querySelector('.slider'), latest = document.getElementById('latest-releases-list'), popular = document.getElementById('popular-list');
        try {
            const res = await fetch('/.netlify/functions/scrape?target=home');
            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();
            
            slider.innerHTML = data.slider.map(a => `<div class="slide" data-url="${a.url}"><img src="${a.poster}" alt="${a.title}"><div class="title">${a.title}</div></div>`).join('');
            slider.querySelectorAll('.slide').forEach(s => s.addEventListener('click', () => showEpisodeList(s.dataset.url)));

            latest.innerHTML = ''; data.latest.forEach(a => latest.appendChild(createAnimeCard(a)));
            popular.innerHTML = ''; data.popularWeekly.forEach(a => popular.appendChild(createPopularItem(a)));

        } catch (error) { console.error(error); /* renderError(...) */ }
        finally { showLoading(false); }
        updateHomeHistory();
    }
    
    async function showEpisodeList(animeUrl) {
        switchView('episode-list-view');
        showLoading(true);
        const detailHeader = document.getElementById('anime-detail-header');
        const synopsisP = document.querySelector('#anime-detail-synopsis p');
        const episodes = document.getElementById('episode-list');
        try {
            const res = await fetch(`/.netlify/functions/scrape?target=episodes&url=${encodeURIComponent(animeUrl)}`);
            if (!res.ok) throw new Error('Scrape failed');
            const data = await res.json();
            currentAnimeData = { ...data, url: animeUrl };

            detailHeader.innerHTML = `<img src="${data.poster}" alt="${data.title}"><div class="info"><h2>${data.title}</h2></div>`;
            synopsisP.textContent = data.synopsis;

            episodes.innerHTML = '';
            data.episodes.forEach(ep => {
                const epItem = document.createElement('div');
                epItem.className = 'episode-item';
                epItem.textContent = ep.title.replace(/Subtitle Indonesia|Download/gi, '').trim();
                epItem.addEventListener('click', () => showWatchPage(ep.url, animeUrl));
                episodes.appendChild(epItem);
            });

            const subBtn = document.getElementById('subscribe-button');
            subBtn.onclick = () => toggleSubscription({ title: data.title, poster: data.poster, url: animeUrl });
            
            if (currentUser) {
                const animeKey = generateKey(animeUrl);
                const subRef = db.ref(`users/${currentUser.uid}/subscriptions/${animeKey}`);
                const callback = snapshot => {
                    if (snapshot.exists()) {
                        subBtn.innerHTML = '<i class="fas fa-check"></i> Subscribed';
                        subBtn.classList.add('active');
                    } else {
                        subBtn.innerHTML = '<i class="fas fa-plus"></i> Subscribe';
                        subBtn.classList.remove('active');
                    }
                };
                subRef.on('value', callback);
                activeListeners.push({ ref: subRef, callback });
            }
        } catch (error) { console.error(error); /* renderError(...) */ }
        finally { showLoading(false); }
    }
    
    async function showWatchPage(episodeUrl, animeUrl) {
        switchView('watch-view');
        showLoading(true);
        
        // ... (Logika lainnya sama)
        
        try {
            // ... (fetch data nonton)

            // Simpan ke riwayat setelah berhasil memuat data
            const currentEp = currentAnimeData.episodes.find(ep => ep.url === episodeUrl);
            addToHistory({ title: currentAnimeData.title, poster: currentAnimeData.poster, url: animeUrl, episode: currentEp.title });

            // Mulai listen ke komentar
            listenToComments(animeUrl, episodeUrl);

        } catch(error) { /* ... */ } 
        finally { showLoading(false); }
    }

    function updateHistoryPage() {
        showLoading(true);
        const container = document.getElementById('history-list');
        if (!currentUser) { container.innerHTML = createEmptyStateCard('Login untuk melihat riwayat.'); showLoading(false); return; }
        
        const historyRef = db.ref(`users/${currentUser.uid}/history`).orderByChild('lastWatched');
        const callback = snapshot => {
            container.innerHTML = '';
            if (!snapshot.exists()) { container.innerHTML = createEmptyStateCard('Riwayat tontonanmu masih kosong.'); return; }
            let history = [];
            snapshot.forEach(child => history.push(child.val()));
            history.reverse().forEach(a => container.appendChild(createAnimeCard(a)));
        };
        historyRef.once('value', snapshot => {
            callback(snapshot);
            showLoading(false);
        });
    }
    
    // ... (Fungsi lainnya seperti createAnimeCard, createPopularItem, submitComment, dll, tidak perlu diubah dari jawaban sebelumnya)

    // Panggil fungsi `initializeHomepage` saat pertama kali aplikasi dimuat setelah login
    if (auth.currentUser) {
        initializeHomepage();
    }
});
