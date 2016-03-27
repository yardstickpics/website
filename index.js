'use strict';

const dev = 'development' === process.env.NODE_ENV;

if (!dev) {
    process.setgid('www-data');
    process.setuid('www-data');
}

const express = require('express');
const compress = require('compression');
const nunjucks = require('nunjucks');
const multer = require('multer');
const denodeify = require('denodeify');
const crypto = require('crypto');
const fs = require('fs');
const writeFile = denodeify(fs.writeFile);
const upload = multer({ dest: 'uploads/' });

const morgan = require('morgan');

const licenseOptions = [
    Object.freeze({key:"CC0", label:"CC0: Creative Commons Zero (recommended)", href:"https://creativecommons.org/publicdomain/zero/1.0/"}),
    Object.freeze({key:"Public Domain", label:"Public Domain", href:"https://wiki.creativecommons.org/wiki/Public_domain"}),
    Object.freeze({key:"CC BY 3.0", label:"CC BY: Creative Commons Attribution", href:"https://creativecommons.org/licenses/by/3.0/"}),
    Object.freeze({key:"CC BY-SA 3.0", label:"CC BY-SA: Creative Commons Attribution-ShareAlike", href:"https://creativecommons.org/licenses/by-sa/3.0/"}),
];

const sources = require('./metadata/sources.json').sources;
const licenseNames = require('./metadata/licenses.json');

const Browser = require('./src/browser');
const browser = new Browser('images.db');

const app = express();

app.use(compress());
app.use(morgan('combined'));
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

nunjucks.configure('views', {
    autoescape: true,
    express: app,
    noCache: dev,
});

app.get('/thanks', (req, res) => {
    res.render('thanks.html');
});

app.get('/image/', (req, res) => {
    res.redirect('/tags');
});

app.get('/image/:sha1', (req, res, next) => {
    browser.getImage(req.params.sha1).then(image => {
        return browser.getMetrics(image.sha1).then(metrics => {
            const download_url = `/downloads/${image.sha1.substr(0,2)}/${image.sha1.substr(2)}.${image.ext}`;

            res.render('image.html', {
                image,
                metrics,
                source: sources[image.from],
                license: licenseNames[image.lic],
                source_url: `https://github.com/yardstickpics/metadata/blob/master/${image.sha1.substr(0,2)}/${image.sha1.substr(2)}.json`,
                download_url: fs.existsSync(`public/${download_url}`) ? download_url : false,
            });
        });
    })
    .catch(next);
});

app.get('/sources', (req, res, next) => {
    res.render('sources.html', {sources: Object.keys(sources).map(id => ({id, source:sources[id]}))});
});

app.get('/tags', (req, res, next) => {
    browser.getAllTags().then(tags => {
        const img_tags = [];
        const content_tags = [];
        tags.forEach(t => {
            if (/^img:/.test(t.name)) img_tags.push(t); else content_tags.push(t);
        });
        res.render('tags.html', {img_tags, content_tags});
    })
    .catch(next);
});

app.get('/tags/:tag', (req, res, next) => {
    browser.getTag(req.params.tag).then(tag => {
        res.render('tag.html', {tag});
    })
    .catch(next);
});

app.get('/sets', (req, res) => {
    res.redirect('/sources');
});

app.post('/contribute', upload.any(), (req, res, next) => {
    const post = req.body;
    const files = req.files;
    new Promise((resolve, reject) => {
        let error = '';

        if (!post.urls && !files.length) {
            error = "Please select some images to share";
        }
        else if (!post.license) {
            error = "Please select a license for the images";
        }
        else if (!post.agree) {
            error = "Please check the checkbox confirming that you give these images under the selected license";
        }

        if (error) {
            return reject(error);
        }

        const created = Date.now();
        const submission = JSON.stringify({
            created,
            post,
            files,
            headers: req.headers,
            ips: req.ips,
        }, undefined, 1);

        const fileName = `${created}-${crypto.createHash('sha1').update(submission).digest('hex')}`;

        writeFile(`uploads/submissions/${fileName}.json`, submission)
            .then(resolve, reject);
    })
    .then(() => {
        res.redirect('/thanks');
    })
    .catch(error => {
        // Copy uploaded files to urls, so that re-submission doesn't lose them
        if (!post.urls) {
            post.urls = '';
        } else {
            if (!/\n$/.test(post.urls)) post.urls += '\n';
        }

        files.forEach(file => {
            post.urls += `${file.path}\n`;
        });

        res.render('contribute.html', {
            error,
            post,
            licenses: licenseOptions.map(l => l.key === post.license ? Object.assign({}, l, {selected:true}) : l),
        });
    })
    .catch(next);
});

app.get('/contribute', (req, res) => {
    res.render('contribute.html', {licenses: licenseOptions, post:{}});
});

app.use(express.static('public'));

app.listen(process.env.PORT || 3333);
