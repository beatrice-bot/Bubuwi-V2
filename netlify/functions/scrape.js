const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://samehadaku.li';

// Helper function untuk response
const createResponse = (body, statusCode = 200) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body),
});

// --- Fungsi-fungsi Scraping ---

async function scrapeHomepage() {
    const { data } = await axios.get(BASE_URL);
    const $ = cheerio.load(data);

    // 1. Scrape Slider
    const slider = [];
    $('.slidtop .loop .slide-item').each((i, el) => {
        const title = $(el).find('.info-left .title a').text().trim();
        const url = $(el).find('.poster a').attr('href');
        const poster = $(el).find('.poster img').attr('src');
        if (title && url && poster) {
            slider.push({ title, url, poster });
        }
    });

    // 2. Scrape Rilis Terbaru
    const latest = [];
    $('.listupd.normal .bs').each((i, el) => {
        const animeElement = $(el).find('.bsx a');
        const title = animeElement.attr('title');
        const url = animeElement.attr('href');
        const poster = animeElement.find('img').attr('src');
        const episode = animeElement.find('.epx').text().trim();
        if (title && url && poster) {
            latest.push({ title, url, poster, episode });
        }
    });

    // 3. Scrape Populer Mingguan
    const popularWeekly = [];
    $('#wpop-items .wpop-weekly ul li').each((i, el) => {
        const rank = $(el).find('.ctr').text().trim();
        const title = $(el).find('.leftseries h4 a').text().trim();
        const url = $(el).find('a.series').attr('href');
        const poster = $(el).find('.imgseries img').attr('src');
        if (rank && title && url && poster) {
            popularWeekly.push({ rank, title, url, poster });
        }
    });

    return { slider, latest, popularWeekly };
}

async function scrapeSearch(query) {
    const { data } = await axios.get(`${BASE_URL}/?s=${query}`);
    const $ = cheerio.load(data);
    const searchResults = [];
    $('.listupd .bs').each((i, el) => {
        const animeElement = $(el).find('.bsx a');
        const title = animeElement.attr('title');
        const url = animeElement.attr('href');
        const poster = animeElement.find('img').attr('src');
        if (title && url && poster) {
            searchResults.push({ title, url, poster });
        }
    });
    return searchResults;
}

async function scrapeEpisodes(url) {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    
    const title = $('.single-info .infox .infolimit h2').text().trim();
    const poster = $('.single-info .thumb img').attr('src');
    const synopsis = $('.desc.mindes').text().trim();
    
    const episodes = [];
    $('#mainepisode .episodelist ul li').each((i, el) => {
        const episodeTitle = $(el).find('.playinfo h3').text().trim();
        const episodeUrl = $(el).find('a').attr('href');
        if (episodeTitle && episodeUrl) {
            episodes.push({ title: episodeTitle, url: episodeUrl });
        }
    });

    return { title, poster, synopsis, episodes: episodes.reverse() }; // Reverse agar episode 1 di awal
}

async function scrapeWatch(url) {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    
    const videoEmbedUrl = $('#pembed iframe').attr('src');
    const prevEpisodeUrl = $('.naveps .nvs a[rel="prev"]').attr('href');
    const nextEpisodeUrl = $('.naveps .nvs a[rel="next"]').attr('href');
    const allEpisodesUrl = $('.naveps .nvsc a').attr('href');
    
    return { videoEmbedUrl, prevEpisodeUrl, nextEpisodeUrl, allEpisodesUrl };
}


// --- Handler Utama ---

exports.handler = async (event) => {
  const { target, url, query } = event.queryStringParameters;

  try {
    switch (target) {
      case 'home':
        const homeData = await scrapeHomepage();
        return createResponse(homeData);
      
      case 'search':
        if (!query) return createResponse({ error: 'Query parameter is required' }, 400);
        const searchData = await scrapeSearch(query);
        return createResponse(searchData);

      case 'episodes':
        if (!url) return createResponse({ error: 'URL parameter is required' }, 400);
        const episodeData = await scrapeEpisodes(url);
        return createResponse(episodeData);

      case 'watch':
        if (!url) return createResponse({ error: 'URL parameter is required' }, 400);
        const watchData = await scrapeWatch(url);
        return createResponse(watchData);

      default:
        return createResponse({ error: 'Invalid target specified' }, 400);
    }
  } catch (error) {
    console.error(`Error during scraping for target "${target}":`, error.message);
    return createResponse({ error: 'Failed to scrape data.' }, 500);
  }
};
