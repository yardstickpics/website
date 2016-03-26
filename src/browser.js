'use strict';

const sqlite = require('sqlite3');

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
        this.byTagCache.set(tag, this.db.then(db => pget(db, `SELECT sha1 FROM images i
            JOIN image_tags it ON it.image_id = i.id
            JOIN tags t ON it.tag_id = t.id
            WHERE t.name = ?`, [tag]).then(images => {
                return {name:tag, images};
            })));
    }
    return this.byTagCache.get(tag);
};

Browser.prototype.getImage = function(sha1) {
    return this.db.then(db => pget(db, `SELECT * FROM images i
        WHERE i.sha1 >= ? ORDER BY sha1 ASC LIMIT 1`, [sha1]).then(images => {
            if (!images.length) throw Error("Not found");
            const img = Object.assign(images[0], JSON.parse(images[0].json));
            img.created_string = new Date(img.created*1000).toISOString();
            return img;
        }));
};

module.exports = Browser;
