'use strict';

const sqlite = require('sqlite3');
const yr = require('yr');

function pget(db, query, args) {
    if (!args) args = [];

    return new Promise((resolve, reject) => {
        db.all(query, args, function(err, data) {
            if (err) reject(err); else resolve(data);
        });
    });
}

function Browser(dbpath) {
    this.byTagCache = new Map();
    this.db = new Promise((resolve, reject) => {
        const db = new sqlite.Database(dbpath, err => {
            if (err) return reject(err);
            resolve(db);
        });
    });
}

Browser.prototype.getAllTags = function() {
    if (!this.allTagsPromise) {
        this.allTagsPromise = this.db.then(db => pget(db, `SELECT t.name, cnt.num FROM
            (SELECT count(*) as num, tag_id FROM image_tags GROUP BY tag_id HAVING count(*) > 1) as cnt
            JOIN tags t ON cnt.tag_id = t.id ORDER BY cnt.num DESC`));
    }
    return this.allTagsPromise;
};


Browser.prototype.getTag = function(tag) {
    if (!this.byTagCache.has(tag)) {
        this.byTagCache.set(tag, this.db.then(db => pget(db, `SELECT sha1,width,height,size,lic FROM images i
            JOIN image_tags it ON it.image_id = i.id
            JOIN tags t ON it.tag_id = t.id
            WHERE t.name = ? ORDER BY coalesce(width*height, size, 99999999)`, [tag]).then(images => {
                return {name:tag, images};
            })));
    }
    return this.byTagCache.get(tag);
};

Browser.prototype.getImage = function(sha1) {
    return this.db.then(db => pget(db, `SELECT * FROM images i
        WHERE i.sha1 >= ? ORDER BY sha1 ASC LIMIT 1`, [sha1]).then(images => {
            if (!images.length) throw Error("Not found");
            return new yr.Image(Object.assign(images[0], JSON.parse(images[0].json)));
        }));
};

Browser.prototype.getMetrics = function(sha1) {
    return this.db.then(db => pget(db, `SELECT im.size, im.value, m.*, a.json
        FROM analyses a
        JOIN image_metrics im ON a.id = im.analysis_id
        JOIN metrics m ON m.id = metric_id
        WHERE image_id = (SELECT id FROM images WHERE sha1 = ?)
        ORDER BY size, value`, [sha1]))
    .then(rows => {
        rows.forEach(row => {
            row.analysis = JSON.parse(row.json);
        });
        return rows;
    });
};

module.exports = Browser;
