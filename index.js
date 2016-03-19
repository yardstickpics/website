'use strict';

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


const licenses = [
    Object.freeze({key:"CC0", label:"CC0: Creative Commons Zero (recommended)", href:"https://creativecommons.org/publicdomain/zero/1.0/"}),
    Object.freeze({key:"Public Domain", label:"Public Domain", href:"https://wiki.creativecommons.org/wiki/Public_domain"}),
    Object.freeze({key:"CC BY-SA 3.0", label:"CC BY-SA: Creative Commons Attribution-ShareAlike", href:"https://creativecommons.org/licenses/by-sa/3.0/"}),
];

const app = express();

app.use(compress());
app.use(morgan('combined'));
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

nunjucks.configure('views', {
    autoescape: true,
    express: app,
    noCache: 'development' === process.env.NODE_ENV,
});

app.get('/thanks', (req, res) => {
    res.render('thanks.html');
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

        const submission = JSON.stringify({
            post,
            files,
            headers: req.headers,
            ips: req.ips,
        }, undefined, 1);

        const filename = crypto.createHash('sha1').update(submission).digest('hex');

        writeFile(`uploads/submissions/${filename}.json`, submission)
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
            licenses: licenses.map(l => l.key === post.license ? Object.assign({}, l, {selected:true}) : l),
        });
    })
    .catch(next);
});

app.get('/contribute', (req, res) => {
    res.render('contribute.html', {licenses, post:{}});
});

app.use(express.static('public'));

app.listen(process.env.PORT || 3333);
