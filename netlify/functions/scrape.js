const axios = require('axios');
const cheerio = require('cheerio');
const { parseStringPromise } = require('xml2js');

const BASE_URL = 'https://samehadaku.li';

exports.handler = async function (event, context) {
    const { url, search, animePage } = event.queryStringParameters;
    try {
        let data;
        if (search) { data = await scrapeSearchFeed(search); } 
        else if (animePage) { data = await scrapeAnimePage(animePage); }
        else if (url) { data = await scrapeEpisodePage(url); }
        else { data = await scrapeHomePage(); }
        return { statusCode: 200, body: JSON.stringify(data) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

async function scrapeHomePage() {
    const { data } = await axios.get(BASE_URL);
    const $ = cheerio.load(data);
    const latestReleases = [];
    const sliderData = [];

    // Ambil data untuk slider
    $('.loop.owl-carousel .slide-item').each((i, el) => {
        const element = $(el);
        const link = element.find('.poster a').attr('href');
        const title = element.find('.title span a').text();
        const thumbnail = element.find('.poster img').attr('src');
        if (title && link) {
            sliderData.push({ title, link, thumbnail });
        }
    });

    // Ambil data untuk rilis terbaru
    $('.bixbox .listupd article.bs').each((i, el) => {
        const element = $(el);
        const linkElement = element.find('a');
        const titleElement = element.find('.tt');
        const seriesTitle = titleElement.clone().children().remove().end().text().trim();
        const link = linkElement.attr('href');
        const thumbnail = element.find('img').attr('src');
        const episode = element.find('.epx').text().trim();
        if (seriesTitle && link) {
            latestReleases.push({ seriesTitle, link, thumbnail, episode });
        }
    });

    return { type: 'homepage', slider: sliderData.slice(0, 5), latest: latestReleases };
}

async function scrapeSearchFeed(query) {
    const feedUrl = `${BASE_URL}/search/${encodeURIComponent(query)}/feed/rss2/`;
    const { data } = await axios.get(feedUrl);
    const parsed = await parseStringPromise(data);
    if (!parsed.rss.channel[0].item) return { type: 'search', query, results: [] };
    const results = await Promise.all(parsed.rss.channel[0].item.map(async item => {
        try {
            const animePageUrl = item.link[0];
            const pageResponse = await axios.get(animePageUrl);
            const $ = cheerio.load(pageResponse.data);
            const thumbnail = $('.thumb img').attr('src') || null;
            return { title: item.title[0], link: animePageUrl, seriesTitle: item.title[0], thumbnail: thumbnail };
        } catch (error) {
            return { title: item.title[0], link: item.link[0], seriesTitle: item.title[0], thumbnail: null };
        }
    }));
    return { type: 'search', query, results };
}

async function scrapeAnimePage(url) {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const episodes = [];
    $('.eplister ul li').each((i, el) => {
        const linkElement = $(el).find('a');
        episodes.push({ title: linkElement.find('.epl-title').text(), link: linkElement.attr('href') });
    });
    const thumbnail = $('.thumb img').attr('src');
    const episodeCount = episodes.length;
    return { type: 'animePage', episodes: episodes.reverse(), thumbnail, episodeCount }; // reverse() agar episode 1 di atas
}

async function scrapeEpisodePage(episodeUrl) {
    const { data } = await axios.get(episodeUrl);
    const $ = cheerio.load(data);
    const title = $('.entry-title').text().trim();
    const videoFrames = [];
    $('.player-embed iframe').each((i, el) => {
        const src = $(el).attr('src');
        if (src) videoFrames.push(src);
    });
    // Cari link download jika ada
    let downloadLink = $('.download-eps a').attr('href');
    return { type: 'episode', title, videoFrames: videoFrames.length > 0 ? videoFrames : [], downloadLink };
}
