// Apple Music Animated Artwork Module
// This module scrapes the Apple Music web client token and uses it to fetch animated artwork.

const TOKEN_STORAGE_KEY = 'apple_music_web_token';

const getWebToken = () => {
    return AsyncStorage.getItem(TOKEN_STORAGE_KEY).then(cachedToken => {
        if (cachedToken) {
            return cachedToken;
        }

        console.log('Fetching new Apple Music Web Token...');
        return fetch('https://music.apple.com/us/browse')
            .then(response => response.text())
            .then(html => {
                const indexJsRegex = /crossorigin src="(\/assets\/index.+?\.js)"/;
                const match = html.match(indexJsRegex);

                if (!match || !match[1]) {
                    throw new Error('Could not find index.js in Apple Music HTML');
                }

                const jsUrl = 'https://music.apple.com' + match[1];
                return fetch(jsUrl);
            })
            .then(jsResponse => jsResponse.text())
            .then(jsContent => {
                const tokenRegex = /(eyJ(?:hbGc|0eXAi).+?)"/;
                const tokenMatch = jsContent.match(tokenRegex);

                if (!tokenMatch || !tokenMatch[1]) {
                    throw new Error('Could not find Bearer token in Apple Music JS');
                }

                const token = tokenMatch[1];
                return AsyncStorage.setItem(TOKEN_STORAGE_KEY, token).then(() => token);
            })
            .catch(error => {
                console.error('Error getting Apple Music Web Token:', error);
                return null;
            });
    });
};

const fetchWithToken = (url) => {
    return getWebToken().then(token => {
        if (!token) return 'ERROR';

        return fetch(url, {
            headers: {
                'Authorization': 'Bearer ' + token,
                'Origin': 'https://music.apple.com'
            }
        }).then(res => {
            if (res.status === 401) {
                console.log('Token expired, refreshing...');
                return AsyncStorage.removeItem(TOKEN_STORAGE_KEY)
                    .then(() => getWebToken())
                    .then(newToken => {
                        if (newToken) {
                            return fetch(url, {
                                headers: {
                                    'Authorization': 'Bearer ' + newToken,
                                    'Origin': 'https://music.apple.com'
                                }
                            });
                        }
                        return { status: 401 };
                    });
            }
            return res;
        });
    });
};

return {
    id: "apple-music-animated-scraper",
    name: "Apple Music Animated (Web Scraper)",
    version: "1.0.0",
    description: "Fetches animated album and artist artwork by scraping the Apple Music web client.",

    getAnimatedArtwork: (albumId, country, type) => {
        country = country || 'us';
        type = type || 'tall';
        const url = 'https://amp-api.music.apple.com/v1/catalog/' + country + '/albums/' + albumId + '?extend=editorialVideo';
        return fetchWithToken(url)
            .then(response => {
                if (response === 'ERROR' || !response.ok) return null;
                return response.json();
            })
            .then(json => {
                if (!json || !json.data || !json.data[0] || !json.data[0].attributes || !json.data[0].attributes.editorialVideo) {
                    return null;
                }
                const editorialVideo = json.data[0].attributes.editorialVideo;

                let videoData = null;
                if (type === 'square') {
                     videoData = 
                        editorialVideo.motionDetailSquare || 
                        editorialVideo.motionSquareVideo1x1 || 
                        editorialVideo.motionDetailTall || 
                        editorialVideo.motionArtistFullscreen16x9;
                } else {
                    videoData = 
                        editorialVideo.motionDetailTall || 
                        editorialVideo.motionArtistFullscreen16x9 || 
                        editorialVideo.motionDetailSquare;
                }

                return videoData && videoData.video ? videoData.video : null;
            })
            .catch(e => {
                console.error("Error fetching album artwork", e);
                return null;
            });
    },

    getAnimatedArtistArtwork: (artistId, country, type) => {
        country = country || 'us';
        type = type || 'tall';
        const url = 'https://amp-api.music.apple.com/v1/catalog/' + country + '/artists/' + artistId + '?extend=editorialVideo';
        return fetchWithToken(url)
            .then(response => {
                if (response === 'ERROR' || !response.ok) return null;
                return response.json();
            })
            .then(json => {
                if (!json || !json.data || !json.data[0] || !json.data[0].attributes || !json.data[0].attributes.editorialVideo) {
                    return null;
                }
                const editorialVideo = json.data[0].attributes.editorialVideo;

                let videoData = null;
                if (type === 'square') {
                     videoData = 
                        editorialVideo.motionArtistSquare1x1 || 
                        editorialVideo.motionSquareVideo1x1 ||
                        editorialVideo.motionArtistFullscreen16x9;
                } else {
                    videoData = 
                        editorialVideo.motionArtistFullscreen16x9 || 
                        editorialVideo.motionArtistSquare1x1;
                }

                return videoData && videoData.video ? videoData.video : null;
            })
            .catch(e => {
                console.error("Error fetching artist artwork", e);
                return null;
            });
    }
};
