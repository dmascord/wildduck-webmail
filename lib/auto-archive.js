'use strict';

const config = require('wild-config');
const apiClient = require('./api-client');

const DEFAULTS = {
    months: 3,
    base: 'Archives',
    pattern: '{base}/{year}/{month}',
    allFolders: false,
    includeBase: false
};

function getDefaults() {
    let cfg = (config && config.autoArchive) || {};
    return {
        months: typeof cfg.months === 'number' ? cfg.months : DEFAULTS.months,
        base: cfg.base || DEFAULTS.base,
        pattern: cfg.pattern || DEFAULTS.pattern,
        allFolders: !!cfg.allFolders,
        includeBase: !!cfg.includeBase
    };
}

function subtractMonths(ts, months) {
    let year = ts.getUTCFullYear();
    let month = ts.getUTCMonth() + 1 - months;
    while (month <= 0) {
        month += 12;
        year -= 1;
    }
    let day = Math.min(ts.getUTCDate(), new Date(Date.UTC(year, month, 0)).getUTCDate());
    return new Date(Date.UTC(year, month - 1, day, ts.getUTCHours(), ts.getUTCMinutes(), ts.getUTCSeconds(), ts.getUTCMilliseconds()));
}

function monthStart(ts) {
    return new Date(Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), 1, 0, 0, 0, 0));
}

function nextMonth(ts) {
    let year = ts.getUTCFullYear() + (ts.getUTCMonth() === 11 ? 1 : 0);
    let month = ts.getUTCMonth() === 11 ? 0 : ts.getUTCMonth() + 1;
    return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

function iso(ts) {
    return ts.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function buildArchivePath(basePath, pattern, ts) {
    let year = ts.getUTCFullYear();
    let month = String(ts.getUTCMonth() + 1).padStart(2, '0');
    let day = String(ts.getUTCDate()).padStart(2, '0');
    return pattern
        .replace('{base}', basePath)
        .replace('{year}', year)
        .replace('{month}', month)
        .replace('{day}', day);
}

function shouldArchiveMailbox(path, specialUse, basePath, includeBase) {
    if (String(path || '').toUpperCase() === 'INBOX') {
        return true;
    }
    if (specialUse) {
        return false;
    }
    if (!includeBase && (path === basePath || path.startsWith(basePath + '/'))) {
        return false;
    }
    return true;
}

function getUserSetting(meta, key, fallback) {
    if (!meta || typeof meta !== 'object') {
        return fallback;
    }
    return meta[key] !== undefined ? meta[key] : fallback;
}

function listMailboxes(user) {
    return new Promise((resolve, reject) => {
        apiClient.mailboxes.list(user, false, (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results || []);
        });
    });
}

function listOldestMessage(user, mailboxId) {
    return new Promise((resolve, reject) => {
        apiClient.messages.listWithParams(
            user,
            mailboxId,
            { limit: 1, order: 'asc' },
            (err, data) => {
                if (err) {
                    return reject(err);
                }
                let results = (data && data.results) || [];
                if (!results.length || !results[0].idate) {
                    return resolve(null);
                }
                let ts = new Date(results[0].idate);
                resolve(ts);
            }
        );
    });
}

function ensureMailbox(user, mailboxMap, path) {
    if (mailboxMap[path]) {
        return Promise.resolve(mailboxMap[path]);
    }
    return new Promise((resolve, reject) => {
        apiClient.mailboxes.create(user, { path }, (err, resp) => {
            if (err) {
                return reject(err);
            }
            if (!resp || !resp.id) {
                return reject(new Error('Failed to create mailbox ' + path));
            }
            mailboxMap[path] = resp.id;
            resolve(resp.id);
        });
    });
}

function moveMessages(user, sourceId, targetId, startTs, endTs) {
    let payload = {
        mailbox: sourceId,
        datestart: iso(startTs),
        dateend: iso(endTs),
        action: { moveTo: targetId }
    };
    return new Promise((resolve, reject) => {
        apiClient.messages.searchAction(user, payload, (err, resp) => {
            if (err) {
                return reject(err);
            }
            if (!resp || !resp.success) {
                return reject(new Error('Search move failed'));
            }
            resolve(true);
        });
    });
}

async function runAutoArchiveForUser(user, metaData) {
    let defaults = getDefaults();
    let enabled = getUserSetting(metaData, 'autoArchiveEnabled', true);
    if (enabled === false) {
        return { scheduled: 0 };
    }

    let months = parseInt(getUserSetting(metaData, 'autoArchiveMonths', defaults.months), 10);
    let basePath = getUserSetting(metaData, 'autoArchiveBase', defaults.base);
    let pattern = getUserSetting(metaData, 'autoArchivePattern', defaults.pattern);

    let cutoff = subtractMonths(new Date(), months);
    let mailboxes = await listMailboxes(user);

    let mailboxMap = {};
    let idToPath = {};
    let inboxId = null;

    for (let mb of mailboxes) {
        mailboxMap[mb.path] = mb.id;
        idToPath[mb.id] = mb.path;
        if (String(mb.path || '').toUpperCase() === 'INBOX') {
            inboxId = mb.id;
        }
    }

    if (!inboxId) {
        return { scheduled: 0 };
    }

    let sources = mailboxes.filter(mb => shouldArchiveMailbox(mb.path, mb.specialUse, basePath, defaults.includeBase));
    if (!defaults.allFolders) {
        sources = sources.filter(mb => String(mb.path || '').toUpperCase() === 'INBOX');
    }

    let scheduled = 0;
    for (let src of sources) {
        let oldest = await listOldestMessage(user, src.id);
        if (!oldest || oldest >= cutoff) {
            continue;
        }
        let cursor = monthStart(oldest);
        while (cursor < cutoff) {
            let end = nextMonth(cursor);
            if (end > cutoff) {
                end = cutoff;
            }
            let archivePath = buildArchivePath(basePath, pattern, cursor);
            let targetId = await ensureMailbox(user, mailboxMap, archivePath);
            await moveMessages(user, src.id, targetId, cursor, end);
            scheduled += 1;
            cursor = nextMonth(cursor);
        }
    }

    return { scheduled };
}

module.exports = {
    getDefaults,
    runAutoArchiveForUser
};
