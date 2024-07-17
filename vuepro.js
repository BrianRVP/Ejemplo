/* eslint-disable camelcase */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
/* eslint-disable one-var */
/* eslint-disable no-var */
/*
 *  vuePRO IPTV Player for Movian / M7 Media Center
 *
 *  Copyright (C) 2015-2018 lprot
 *  Copyright (C) 2024-2024 dajesusmodz
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var page = require('movian/page');
var service = require('movian/service');
var settings = require('movian/settings');
var http = require('movian/http');
var string = require('native/string');
var popup = require('native/popup');
var io = require('native/io');
var plugin = JSON.parse(Plugin.manifest);
var logo = Plugin.path + plugin.icon;
var DeanEdwardsUnpacker = require('./utils/Dean-Edwards-Unpacker').unpacker;

RichText = function(x) {
  this.str = x.toString();
};

RichText.prototype.toRichString = function(x) {
  return this.str;
};

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36';

function setPageHeader(page, title) {
  if (page.metadata) {
    page.metadata.title = new RichText(decodeURIComponent(title));
    page.metadata.logo = logo;
  }
  page.type = 'directory';
  page.contents = 'items';
  page.loading = false;
  page.model.contents = 'grid';
  page.metadata.background = Plugin.path + "bg.png"
}

var blue = '6699CC',
  orange = 'FFA500',
  red = 'EE0000',
  green = '008B45';

function coloredStr(str, color) {
  return '<font color="' + color + '">' + str + '</font>';
}

function trim(s) {
  if (s) return s.replace(/(\r\n|\n|\r)/gm, '').replace(/(^\s*)|(\s*$)/gi, '').replace(/[ ]{2,}/gi, ' ').replace(/\t/g, '');
  return '';
}

service.create(plugin.title, plugin.id + ':start', 'vuePRO', true, logo);

settings.globalSettings(plugin.id, plugin.title, logo, plugin.synopsis);
settings.createMultiOpt('selectRegion', 'Channel Region (May Be Geo-Restricted)', [
          ['United States', 'United States'],
          ['United Kingdom', 'United Kingdom'],
          ['France', 'France'],
          ['Canada', 'Canada'],
          ['Brazil', 'Brazil'],
          ['South Korea', 'South Korea'],
          ['Mexico', 'Mexico'],
          ['Chile', 'Chile'],
          ['Germany', 'Germany'],
          ['Switzerland', 'Switzerland'],
          ['Denmark', 'Denmark'],
          ['Sweden', 'Sweden'],
          ['Spain', 'Spain'],
          ['Austria', 'Austria'],
          ['Italy', 'Italy'],
          ['India', 'India'],
          ['Norway', 'Norway'],
          ['Off', 'Off', true],
        ], function(v) {
        service.selectRegion = v;
});
settings.createMultiOpt('updatechannel', 'Select Update Channel', [
  ['Stable', 'Stable'],
  ['Pre-Release', 'Pre-Release'],
], function(v) {
service.updatechannel = v;
});
//settings.createBool('disableEPG', 'Don\'t fetch EPG', true, function(v) {
  //service.disableEPG = v;
//});
//settings.createString('acestreamIp', 'IP address of AceStream Proxy. Enter IP only.', '192.168.0.93', function(v) {
  //service.acestreamIp = v;
//});
settings.createBool('disableMyFavorites', 'Hide My Favorites', false, function(v) {
  service.disableMyFavorites = v;
});
settings.createBool('debug', 'Enable Debug Logging', false, function(v) {
  service.debug = v;
});

var store = require('movian/store').create('favorites');
if (!store.list) {
  store.list = '[]';
}

var playlists = require('movian/store').create('playlists');
if (!playlists.list) {
  playlists.list = '[]';
}

function addOptionForAddingToMyFavorites(item, link, title, icon) {
  item.addOptAction('Add \'' + title + '\' to My Favorites', function() {
    var entry = JSON.stringify({
      link: encodeURIComponent(link),
      title: encodeURIComponent(title),
      icon: encodeURIComponent(icon),
    });
    store.list = JSON.stringify([entry].concat(eval(store.list)));
    popup.notify('\'' + title + '\' has been added to My Favorites.', 3);
  });
}

function addOptionForRemovingFromMyFavorites(page, item, title, pos) {
  item.addOptAction('Remove \'' + title + '\' from My Favorites', function() {
    var list = eval(store.list);
    popup.notify('\'' + title + '\' has been removed from My Favorites.', 3);
    list.splice(pos, 1);
    store.list = JSON.stringify(list);
    page.redirect(plugin.id + ':myfavs');
  });
}

var API = 'https://www.googleapis.com/youtube/v3',
  key = 'AIzaSyCSDI9_w8ROa1UoE2CNIUdDQnUhNbp9XR4';

new page.Route(plugin.id + ':youtube:(.*)', function(page, title) {
  page.loading = true;
  try {
    var doc = http.request(API + '/search', {
      args: {
        part: 'snippet',
        type: 'video',
        q: unescape(title),
        maxResults: 1,
        eventType: 'live',
        key: key,
      },
    }).toString();
    page.redirect('youtube:video:' + JSON.parse(doc).items[0].id.videoId);
  } catch (err) {
    page.metadata.title = unescape(title);
    page.error('Sorry, can\'t get the channel\'s link :(');
  }
  page.loading = false;
});

new page.Route(plugin.id + ':tivix:(.*):(.*):(.*)', function(page, url, title, icon) {
  setPageHeader(page, unescape(title));
  page.loading = true;
  var resp = http.request(unescape(url)).toString();
  var re = /Playerjs\([\S\s]+?file[\S\s]+?"([^"]+)/gm; // https://imgur.com/a/rQ0Yaiy
  var pageload = /content=\"http:\/\/tv.tivix.co([\S\s]*?)\" \/>/g;
  var authurl1regex = /\s+var\s+firstIpProtect\s+=\s+\'([\S\s]*?)\'\;/g;
  var authurl2regex = /\s+var\s+secondIpProtect\s+=\s+\'([\S\s]*?)\'\;/g;
  var authurl3regex = /\s+var\s+portProtect\s+=\s+\'([\S\s]*?)\'\;/g;
  var authurl1match = authurl1regex.exec(resp);
  var authurl2match = authurl2regex.exec(resp);
  var authurl3match = authurl3regex.exec(resp);
  var authurl1link = authurl1match[1];
  var authurl2link = authurl2match[1];
  var authurl3link = authurl3match[1];

  var pagematch = pageload.exec(resp);
  var headerreferer = pagematch[1];
  var originreferer = 'http://tv.tivix.co';
  var match = re.exec(resp);


  var authurl = fd2(match[1]);
  var hostref = '';
  if (/{v1}/.test(authurl)) {
    hostref = authurl1link;
  } else {
    hostref = authurl2link;
  }
  var re1 = /{v1}/g;
  var re2 = /{v2}/g;
  var re3 = /{v3}/g;
  var reqstv = '';
  var authurl1 = authurl.replace(re1, authurl1link);
  var authurl2 = authurl1.replace(re2, authurl2link);
  var authurl3 = authurl2.replace(re3, authurl3link);
  if (!match) {
    re = /skin" src="([\S\s]*?)"/g;
    match = re.exec(resp);
    // console.log(match);
  }
  if (!match) {
    re = /<span id="srces" style="display:none">([\S\s]*?)</g;
    match = re.exec(resp);
    // console.log(match);
  }
  while (match) {
    console.log(authurl3);
    console.log(originreferer + headerreferer + ' | ' + hostref + ':8081');
    console.log(match[1]);
    //
    reqstv = http.request(authurl3, {
      // не перенапровлять
      noFollow: true,
      // не выдовать ошибку при 404
      noFail: true,
      // дебаг вывод
      debug: true,
      // пост дата для запроса с
      postdata: {},
      headers: {
        'Origin': originreferer,
        'Referer': originreferer + headerreferer,
        'Host': hostref + ':8081',
        'User-Agent': 'Mozilla/5.0 (X11; HasCodingOs 1.0; Linux x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36',
      },
    });

    if (reqstv.statuscode == '200') {
      console.log('status 200');
    }
    //
    // io.httpInspectorCreate('.*' + match[1].replace('http://', '').replace('https://', '').split(/[/?#]/)[0].replace(/\./g, '\\.') + '.*', function(req) {
    io.httpInspectorCreate(authurl3, function(req) {
      req.setHeader('Origin', originreferer);
      req.setHeader('Referer', originreferer + headerreferer);
      req.setHeader('Host', hostref + ':8081');
      req.setHeader('User-Agent', 'Mozilla/5.0 (X11; HasCodingOs 1.0; Linux x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36');
    });
    console.log('Probing: ' + match[1]);
    console.log('OUT: ' + io.probe(authurl3).result);
    if (!authurl3.match(/m3u8/) && io.probe(authurl3).result) {
      match = re.exec(resp);
      continue;
    }
    var link = unescape(authurl3);
    // if (link.match(/rtmp/))
    //    link += ' swfUrl=http://tivix.co' + (resp.match(/data="(.*)"/) ? resp.match(/data="(.*)"/)[1] : '') + ' pageUrl=' + unescape(url);
    // log('Playing url: ' + url);
    playUrl(page, link, plugin.id + ':tivix:' + url + ':' + title, unescape(title), 0, icon);
    return;
  }
  console.log('NONE');

  // try to get youtube link
  match = resp.match(/\.com\/v\/([\S\s]*?)(\?|=)/);
  if (match) {
    page.redirect('youtube:video:' + match[1]);
    return;
  }
  if (resp.match('Канал удалён по требованию правообладателя')) {
    page.error('Канал удалён по требованию правообладателя =(');
  } else {
    page.error('Sorry, can\'t get the link :(');
  }
  page.loading = false;
});

new page.Route(plugin.id + ':acestream:(.*):(.*)', function(page, id, title) {
  playUrl(page, 'http://' + service.acestreamIp + ':6878/ace/manifest.m3u8?id=' + id.replace('//', ''), plugin.id + ':acestream:' + id + ':' + title, unescape(title));
});

function playUrl(page, url, canonicalUrl, title, mimetype, icon, subsscan, imdbid) {
  if (url) {
    console.log('playUrl: ' + url + ' | ' + canonicalUrl);
    if (url.substr(0, 2) == '//') {
      url = 'http:' + url;
    }
    page.type = 'video';
    page.source = 'videoparams:' + JSON.stringify({
      title: title,
      imdbid: imdbid ? imdbid : void (0),
      canonicalUrl: canonicalUrl,
      icon: icon ? unescape(icon) : void (0),
      sources: [{
        url: url.match(/m3u8/) ? 'hls:' + url : url,
        mimetype: mimetype ? mimetype : void (0),
      }],
      no_subtitle_scan: subsscan ? false : true,
      no_fs_scan: subsscan ? false : true,
    });
  } else {
    page.error('Sorry, can\'t get the link :(');
  }
  page.loading = false;
}

new page.Route(plugin.id + ':hls:(.*):(.*)', function(page, url, title) {
  page.loading = true;
  page.metadata.title = unescape(title);
  playUrl(page, 'http://' + unescape(url), plugin.id + ':hls:' + url + ':' + title, unescape(title));
});

new page.Route(plugin.id + ':m3u8:(.*):(.*)', function(page, url, title) {
  page.loading = true;
  page.metadata.title = unescape(title);
  var resp = http.request('http://' + unescape(url)).toString();
  var match = resp.match(/[^ "|\'|>]+m3u8[^ "|\'|<]*/g);
  for (var i in match) {
    var elem = match[i].replace(/\\\//g, '/').replace(/^\/\//g, 'http://');
    if (elem.match(/^http/)) {
      match = elem;
      break;
    }
  }

  io.httpInspectorCreate('.*' + match.replace('http://', '').replace('https://', '').split(/[/?#]/)[0].replace(/\./g, '\\.') + '.*', function(req) {
    req.setHeader('Referer', 'http://' + unescape(url));
    req.setHeader('User-Agent', UA);
  });

  playUrl(page, match, plugin.id + ':m3u8:' + url + ':' + title, unescape(title));
});

new page.Route(plugin.id + ':gledai:(.*):(.*):(.*)', function(page, channel, route, title) {
  page.loading = true;
  page.metadata.title = unescape(title);
  r = 'http://www.bg-gledai.me/new/geto2.php?my=' + unescape(channel);

  var resp = http.request(r, {
    headers: {
      'Host': 'www.bg-gledai.me',
      'Referer': 'http://' + unescape(route),
      'User-Agent': UA,
    },
  }).toString();
  var s = unescape(unescape(resp).match(/unescape\(\'(.*?)\'/)[1]);
  resp = http.request(s, {
    headers: {
      'Host': 'www.bg-gledai.me',
      'Referer': r,
      'User-Agent': UA,
    },
  }).toString();
  match = resp.match(/file>(.*?)</)[1].replace(/&amp;/g, '&');
  io.httpInspectorCreate('.*gledai.*', function(req) {
    req.setHeader('Origin', 'http://bg.gledai.me');
    req.setHeader('Referer', r);
    req.setHeader('User-Agent', UA);
  });
  playUrl(page, match, plugin.id + ':gledai:' + channel + ':' + route + ':' + title, unescape(title));
});

new page.Route(plugin.id + ':ovva:(.*):(.*)', function(page, url, title) {
  page.loading = true;
  page.metadata.title = unescape(title);
  var match = http.request('https://' + unescape(url)).toString();
  if (match.match(/data-timer="([\s\S]*?)"/)) {
    page.error('Трансляция будет доступна: ' + new Date(match.match(/data-timer="([\s\S]*?)"/)[1] * 1000));
    return;
  }
  var json = match.match(/ovva-player","([\s\S]*?)"/);
  if (json) {
    json = JSON.parse(Duktape.dec('base64', json[1]));
  }
  match = 0;
  if (json) {
    json = http.request(json.balancer).toString();
    log(json);
    match = json.match(/=([\s\S]*?$)/);
    if (match) match = match[1];
  }
  playUrl(page, match, plugin.id + ':ovva:' + url + ':' + title, unescape(title));
});

new page.Route(plugin.id + ':dailymotion:(.*):(.*)', function(page, url, title) {
  page.loading = true;
  page.metadata.title = unescape(title);
  var resp = http.request('http://www.dailymotion.com/embed/video/' + url).toString();
  var match = resp.match(/stream_chromecast_url":"([\S\s]*?)"/);
  if (match) match = match[1].replace(/\\\//g, '/');
  playUrl(page, match, plugin.id + ':dailymotion:' + url + ':' + title, unescape(title));
});

new page.Route(plugin.id + ':euronews:(.*):(.*)', function(page, country, title) {
  page.loading = true;
  page.metadata.title = unescape(title);
  if (country == 'en') {
    country = 'www';
  }
  var json = JSON.parse(http.request('http://' + country + '.euronews.com/api/watchlive.json'));
  json = JSON.parse(http.request(json.url));
  playUrl(page, json.primary, plugin.id + ':euronews:' + country + ':' + title, unescape(title));
});

new page.Route(plugin.id + ':ts:(.*):(.*)', function(page, url, title) {
  page.metadata.title = unescape(title);
  page.loading = true;
  playUrl(page, unescape(url), plugin.id + ':ts:' + url + ':' + title, unescape(title), 'video/mp2t');
});

// Favorites
new page.Route(plugin.id + ':favorites', function(page) {
  setPageHeader(page, 'My Favorites');
  fill_fav(page);
});

new page.Route(plugin.id + ':indexTivix:(.*):(.*)', function(page, url, title) {
  page.model.contents = 'grid';
  setPageHeader(page, decodeURIComponent(title));
  var url = prefixUrl = 'http://tv.tivix.co' + decodeURIComponent(url);
  var tryToSearch = true,
    fromPage = 1,
    n = 0;

  function loader() {
    if (!tryToSearch) return false;
    page.loading = true;
    var doc = http.request(url).toString();
    page.loading = false;
    // 1-title, 2-url, 3-icon
    var re = /<div class="all_tv" title="([\S\s]*?)">[\S\s]*?href="([\S\s]*?)"[\S\s]*?<img src="([\S\s]*?)"/g;
    var match = re.exec(doc);
    while (match) {
      var icon = 'http://tv.tivix.co' + match[3];
      var link = plugin.id + ':tivix:' + escape(match[2]) + ':' + escape(match[1]) + ':' + escape(icon);
      var item = page.appendItem(link, 'video', {
        title: match[1],
        icon: icon,
      });
      addOptionForAddingToMyFavorites(item, link, match[1], icon);
      n++;
      match = re.exec(doc);
    }
    page.metadata.title = new RichText(decodeURIComponent(title) + ' (' + n + ')');
    var next = doc.match(/">Вперед<\/a>/);
    if (!next) {
      return tryToSearch = false;
    }
    fromPage++;
    url = prefixUrl + 'page/' + fromPage;
    return true;
  }
  loader();
  page.paginator = loader;
  page.loading = false;
});

new page.Route(plugin.id + ':tivixStart', function(page) {
  page.model.contents = 'grid';
  setPageHeader(page, 'tv.tivix.co');
  page.loading = true;
  var doc = http.request('http://tv.tivix.co').toString();
  page.loading = false;
  var re = /<div class="menuuuuuu"([\S\s]*?)<\/div>/g;
  var menus = re.exec(doc);
  var re2 = /<a href="([\S\s]*?)"[\S\s]*?>([\S\s]*?)<\/a>/g;
  while (menus) {
    var submenus = re2.exec(menus[1]);
    while (submenus) {
      page.appendItem(plugin.id + ':indexTivix:' + encodeURIComponent(submenus[1]) + ':' + encodeURIComponent(submenus[2]), 'directory', {
        title: submenus[2],
      });
      submenus = re2.exec(menus[1]);
    }
    menus = re.exec(doc);
  }
  var packed = http.request('http://tv.tivix.co/templates/Default/js/tv-pjs.js?v=2', {
    headers: {
      'Referer': 'http://tv.tivix.co',
      'User-Agent': UA,
    }}).toString();
  var unpacked = DeanEdwardsUnpacker.unpack(packed);
  u = unpacked.match(/u:'([^']+)/)[1];
  v = JSON.parse(decode(u));
  v.file3_separator = '//';

  o = {
    y: 'xx???x=xx??x?=',
  };
});

var devId = 0;
if (!devId) {
  devId = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(t) {
    var e = 16 * Math.random() | 0,
      n = 'x' == t ? e : 3 & e | 8;
    return n.toString(16);
  });
}

new page.Route(plugin.id + ':playYoutv:(.*):(.*):(.*)', function(page, url, title, icon) {
  page.loading = true;
  var json = JSON.parse(http.request(unescape(url), {
    headers: {
      'Device-Uuid': devId,
      'Host': 'api.youtv.com.ua',
      'Origin': 'https://youtv.com.ua',
      'Referer': 'https://youtv.com.ua/',
      'User-Agent': UA,
      'X-Requested-With': 'XMLHttpRequest',
    },
    debug: service.debug,
  }));

  var link = 'https:' + json.playback_url;

  io.httpInspectorCreate('.*' + link.replace('http://', '').replace('https://', '').split(/[/?#]/)[0].replace(/\./g, '\\.') + '.*', function(req) {
    req.setHeader('Referer', 'https://youtv.com.ua/');
    req.setHeader('X-Requested-With', 'ShockwaveFlash/28.0.0.126');
    req.setHeader('User-Agent', UA);
  });
  playUrl(page, link, plugin.id + ':playYoutv:' + url + ':' + title, unescape(title), 0, icon);
});

new page.Route(plugin.id + ':youtvStart', function(page) {
  page.model.contents = 'grid';
  setPageHeader(page, 'Youtv.com.ua');
  page.loading = true;
  var doc = http.request('https://youtv.com.ua/api/start', {
    headers: {
      'Accept': 'application/vnd.youtv.v3+json',
      'Device-Uuid': devId,
      'Host': 'youtv.com.ua',
      'Referer': 'https://youtv.com.ua/',
      'User-Agent': UA,
      'X-Requested-With': 'XMLHttpRequest',
    },
    debug: service.debug,
  }).toString();
  log(doc);

  var json = JSON.parse(http.request('https://youtv.com.ua/api/playlist', {
    headers: {
      'Accept': 'application/vnd.youtv.v3+json',
      'Device-Uuid': devId,
      'Host': 'youtv.com.ua',
      'Origin': 'https://youtv.com.ua',
      'Referer': 'https://youtv.com.ua/',
      'User-Agent': UA,
      'X-Requested-With': 'XMLHttpRequest',
    },
    postdata: {},
    debug: service.debug,
  }));

  for (var i in json.data) {
    var genres = '',
      first = 1;
    for (var j in json.data[i].categories) {
      if (first) {
        genres += json.data[i].categories[j].name;
        first--;
      } else {
        genres += ', ' + json.data[i].categories[j].name;
      }
    }
    page.appendItem(plugin.id + ':playYoutv:' + escape(json.data[i].sources[0].stream.url) + ':' + escape(json.data[i].name) + ':' + escape(json.data[i].image), 'video', {
      title: new RichText(json.data[i].name),
      genre: genres,
      icon: json.data[i].image,
    });
    page.entries++;
  }
  page.metadata.title += ' (' + page.entries + ')';
  page.loading = false;
});

function addOptionToRemovePlaylist(page, item, title, pos) {
  item.addOptAction('Remove \'' + title + '\' playlist from the list', function() {
    var playlist = eval(playlists.list);
    popup.notify('\'' + title + '\' has been removed from the list.', 3);
    playlist.splice(pos, 1);
    playlists.list = JSON.stringify(playlist);
    page.flush();
    page.redirect(plugin.id + ':start');
  });
}

function showPlaylist(page) {
  var playlist = eval(playlists.list);
  
