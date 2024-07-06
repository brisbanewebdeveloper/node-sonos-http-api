/* eslint-disable no-console */
/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
function sonosController() {
  return {

    // Change here when using a remote host/port
    // - If the port is changed, you must amend the file "settings.json" as well to match up
    apiUrl: 'http://localhost:5005',

    hasTouchEvent: false,

    hasRestoredSettings: false,

    // To see if it is waiting for the response to play or stop
    transitioningPlayStop: false,

    speakers: [],
    selectedSpeakers: [],
    currentSpeaker: false,
    previousPlaybackState: '',

    settingVolume: false,
    previousVolume: 50,
    volume: 50,

    updateNowPlayingInterval: 250,
    // updateNowPlayingInterval: 15000,

    currentTrack: false,
    playlists: [],

    init() {
      if ('ontouchstart' in window) this.hasTouchEvent = true;
      if (navigator.maxTouchPoints > 0) this.hasTouchEvent = true;
      if (navigator.msMaxTouchPoints > 0) this.hasTouchEvent = true;

      this.fetchSpeakers(true);

      this.$watch('volume', (value, oldValue) => {
        this.previousVolume = parseInt(oldValue, 10);
      });

      // Update the current track info every 250ms
      // - This usually takes less than 10ms
      // - Maybe it can go faster like 100ms?
      // - Developer Tool dies after running it for awhile with 250ms
      setInterval(() => {
        this.updateNowPlaying();
        // this.updateArtwork();
        // eslint-disable-next-line no-underscore-dangle
        console.debug(document.querySelector('[x-data]')._x_dataStack[0]);
      }, this.updateNowPlayingInterval);

      // Update speaker info every 5 seconds
      // - I guess there is no environment the speaker situation changes every 5 seconds?
      setInterval(() => {
        this.fetchSpeakers();
      }, 2000);

      // Update playlists every 15 seconds because it sometimes takes time?
      setInterval(() => {
        this.fetchPlaylists();
      }, 15000);
    },

    // Save the current settings to enable to restore the settings when opening the page next time
    saveSettings() {
      localStorage.setItem('sonos-settings', JSON.stringify({
        currentSpeaker: this.currentSpeaker,
        volume: this.volume,
        currentTrack: this.currentTrack,
      }));
    },
    restoreSettings() {
      if (this.speakers.length === 0) return;

      const settings = localStorage.getItem('sonos-settings');

      if (!settings) return;

      const { currentSpeaker, volume, currentTrack } = JSON.parse(settings);

      // Check if the speaker is still available and restore only if the speaker still exists
      if (!this.speakers.find(speaker => speaker.name === currentSpeaker)) {
        this.currentSpeaker = this.speakers[0].name;
        return;
      }

      this.currentSpeaker = currentSpeaker;
      this.volume = volume;
      this.currentTrack = currentTrack || false;
    },

    getPlaybackStateClass() {
      let output = 'max-w mx-auto';

      if (!this.currentTrack) return output;
      output += ` playback-state-${this.currentTrack.playbackState.toLowerCase()}`;

      // Some Sonos Speakers do not return "this.currentTrack.playbackState"?
      // Refer the internal state of app in that case
      if (this.transitioningPlayStop) {
        output += ' playback-state-transitioning';
      }

      // Set the duration to scroll the title depending on the length
      const title = Math.max(
        document.getElementById('title').scrollWidth,
        document.getElementById('artist').scrollWidth,
      );
      let duration = 0;
      if (title > 300) {
        duration = title / 25;
        output += ' title-is-long';
      }
      document.documentElement.style.setProperty('--title-scroll-duration', `${duration}s`);

      return output;
    },

    fetchSpeakers(updateNowPlaying = false) {
      // Avoid while waiting for the operation (Play/Stop)
      if (this.transitioningPlayStop) return;

      fetch(`${this.apiUrl}/zones`)
        .then(response => response.json())
        .then((data) => {
          // Debug
          // this.speakers = data.map(zone => (console.debug(zone)));

          this.speakers = data.map(zone => ({
            id: zone.coordinator.roomName,
            name: zone.coordinator.roomName
          }));

          if (!this.hasRestoredSettings) {
            this.hasRestoredSettings = true;
            this.restoreSettings();
          }

          // Select the first speaker if not selected
          if (!this.currentSpeaker) {
            if (this.speakers.length === 0) {
              console.debug('Speakers not found');
            } else {
              this.currentSpeaker = this.speakers[0].name;
            }
          }

          // Get the truck info when specified
          if (updateNowPlaying) {
            this.updateNowPlaying(true);
            this.fetchPlaylists();
          }
        });
    },

    canUseGauge() {
      if (!this.currentTrack) return false;
      if (this.currentTrack.duration === 0) return false;
      return true;
    },

    setElapsedTime() {
      if (!this.currentSpeaker) return;

      fetch(`${this.apiUrl}/${this.currentSpeaker}/seek/${this.currentTrack.elapsedTime}`)
        .then(response => response.json())
        .then(data => console.debug('Time set:', data));
    },

    getVolume() {
      if (this.settingVolume) return this.previousVolume;

      if (this.currentTrack && this.currentTrack.volume) {
        return this.currentTrack.volume;
      }

      if (this.volume) {
        return this.volume;
      }

      return '?';
    },
    setVolume() {
      if (!this.currentSpeaker) return;

      this.settingVolume = false;

      const offset = this.volume - this.previousVolume;
      if (Math.abs(offset) > 1) {
        if (offset > 0) {
          this.volume = Math.min(this.previousVolume + 1, 100);
        } else {
          this.volume = Math.max(0, this.previousVolume - 1);
        }
      }

      fetch(`${this.apiUrl}/${this.currentSpeaker}/volume/${this.volume}`)
        .then(response => response.json())
        .then((data) => {
          console.debug('Volume set:', data);
          this.updateNowPlaying(true);
        });
    },

    canPlayMusic(action = 'play') {
      if (!this.currentTrack) return false;

      const {
        playbackState,
        trackNo,
        nextTrack,
      } = this.currentTrack;

      if (action === 'play') {
        if (this.currentTrack.playbackState === 'TRANSITIONING') return true;
        if (playbackState === 'PAUSED_PLAYBACK') return true;
        if (playbackState === 'STOPPED') return true;
        if (this.transitioningPlayStop === action) return true;
      } else if (action === 'stop') {
        if (playbackState === 'PLAYING') return true;
        if (this.transitioningPlayStop === action) return true;
      } else if (action === 'previous') {
        if (this.currentTrack.playbackState === 'TRANSITIONING') return true;
        return true;
      } else { // next
        if (this.currentTrack.playbackState === 'TRANSITIONING') return true;
        // It has next track
        if (nextTrack) return true;
      }

      return false;
    },

    playMusic(action = 'play') {
      if (!this.currentSpeaker) return;

      if (this.transitioningPlayStop || this.currentTrack.playbackState === 'TRANSITIONING') {
        console.debug('Play: Waiting for transitioning to finish - Skipping');
        return;
      }

      this.previousPlaybackState = this.currentTrack.playbackState;
      this.transitioningPlayStop = action;

      fetch(`${this.apiUrl}/${this.currentSpeaker}/${action}`)
        .then(response => response.json())
        .then((data) => {
          console.debug('Music playing:', data);
          this.transitioningPlayStop = false;
        });
    },

    nextMusic(action) {
      if (!this.currentSpeaker) return;

      fetch(`${this.apiUrl}/${this.currentSpeaker}/${action}`)
        .then(response => response.json())
        .then((data) => {
          console.debug(`Music ${action}:`, data);
        });
    },

    stopMusic() {
      if (!this.currentSpeaker) return;

      if (this.transitioningPlayStop) {
        console.debug('Stop: Waiting for transitioning to finish - Skipping');
        return;
      }

      this.previousPlaybackState = this.currentTrack.playbackState;
      this.transitioningPlayStop = 'stop';

      fetch(`${this.apiUrl}/${this.currentSpeaker}/pause`)
        .then(response => response.json())
        .then((data) => {
          console.debug('Music stopped:', data);
          this.transitioningPlayStop = false;
        });
    },

    shuffleMode() {
      let output = 'Shuf.';
      if (!this.currentSpeaker) return output;
      if (!this.currentTrack) return output;
      if (!this.currentTrack.shuffle) return output;
      output = 'X';
      return output;
    },
    setShuffle() {
      if (!this.currentSpeaker) return;

      fetch(`${this.apiUrl}/${this.currentSpeaker}/shuffle/toggle`)
        .then(response => response.json())
        .then((data) => {
          console.debug('Music shuffle:', data);
        });
    },

    repeatMode() {
      let output = 'R';
      if (!this.currentSpeaker) return output;
      if (!this.currentTrack) return output;
      if (this.currentTrack.repeat === 'none') return output;
      output = this.currentTrack.repeat;
      return output;
    },
    setRepeat() {
      if (!this.currentSpeaker) return;

      fetch(`${this.apiUrl}/${this.currentSpeaker}/repeat/toggle`)
        .then(response => response.json())
        .then((data) => {
          console.debug('Music repeat mode:', data);
        });
    },

    muteMode() {
      let output = 'M';
      if (!this.currentSpeaker) return output;
      if (!this.currentTrack) return output;
      if (!this.currentTrack.mute) return output;
      output = 'X';
      return output;
    },
    setMute() {
      if (!this.currentSpeaker) return;

      fetch(`${this.apiUrl}/${this.currentSpeaker}/togglemute`)
        .then(response => response.json())
        .then((data) => {
          console.debug('Music mute:', data);
        });
    },

    //
    // TODO There is a case "this.currentTrack.absoluteAlbumArtUri" takes time?
    //      If so, add a new endpoint in SONOS HTTP API to store the artwork image in a new directory "static/cache"
    //      and this frontend logic to fetch the image to display the artwork faster from the 2nd time
    //
    //                 updateArtwork() {
    //
    //                     if (!this.currentSpeaker) return;
    //                     if (!this.currentTrack) return;
    //                     if (!this.currentTrack.albumArtUri) return;
    //
    //                     if (!this.currentTrack.artwork) {
    //
    //                         const absoluteAlbumArtUri = encodeURIComponent(this.currentTrack.absoluteAlbumArtUri);
    //                         const uri = `${this.currentTrack.albumArtUri}?uri=${absoluteAlbumArtUri}`;
    //
    //                         fetch(uri)
    //                             .then(response => response.json())
    //                             .then(data => {
    //                                 console.debug('Artwork updated:', data);
    //                                 this.artwork = data.artworkUri;
    //                             });
    //
    //                         return;
    //                     }
    //
    //                     return this.artwork;
    //                 },

    updateNowPlaying(updateVolume = false) {
      if (!this.currentSpeaker) return;

      fetch(`${this.apiUrl}/${this.currentSpeaker}/state`)
        .then(response => response.json())
        .then((data) => {
          // console.debug('!!! data', data);

          // eslint-disable-next-line prefer-destructuring
          let absoluteAlbumArtUri = data.currentTrack.absoluteAlbumArtUri;
          // eslint-disable-next-line prefer-destructuring
          let albumArtUri = data.currentTrack.albumArtUri;
          // let artwork = false;
          if (!absoluteAlbumArtUri || absoluteAlbumArtUri.match(/\.mp3$/)) {
            absoluteAlbumArtUri = false;
            albumArtUri = false;
          }

          if (updateVolume) {
            this.volume = data.volume;
            this.previousVolume = this.volume;
          }

          this.currentTrack = {
            volume: data.currentTrack.volume,
            trackNo: data.trackNo,
            nextTrack: data.nextTrack,
            title: data.currentTrack.title,
            playbackState: data.playbackState,
            duration: data.currentTrack.duration,
            elapsedTime: data.elapsedTime,
            artwork: absoluteAlbumArtUri,
            mute: data.mute,
            repeat: data.playMode.repeat,
            shuffle: data.playMode.shuffle,
            artist: data.currentTrack.artist,
            // artwork: data.currentTrack.albumArtUri,
            absoluteAlbumArtUri,
            albumArtUri,
            data,
          };

          this.saveSettings();
        });
    },

    fetchPlaylists() {
      if (!this.currentSpeaker) return;

      fetch(`${this.apiUrl}/${this.currentSpeaker}/playlists`)
        .then(response => response.json())
        .then((data) => {
          this.playlists = data.map(playlist => ({
            id: playlist,
            name: playlist
          }));
        });
    },

    playPlaylist(playlistId) {
      if (!this.currentSpeaker) return;

      fetch(`${this.apiUrl}/${this.currentSpeaker}/playlist/${playlistId}`)
        .then(response => response.json())
        .then((data) => {
          console.debug('Playlist playing:', data);
        });
    },

    onClickPlayPlaylist(id) {
      this.playPlaylist(id);
      document.getElementById('playlists').close();
    }
  };
}
