/* eslint prefer-arrow-callback: 0, no-invalid-this: 0 */

'use strict';

let hbs = require('hbs');
const fs = require('fs');
const path = require('path');

hbs.registerPartials(__dirname + '/../views/partials');
hbs.registerPartials(__dirname + '/../views/partials/account-plugins');

const accountPluginPartialsDir = path.join(__dirname, '..', 'views', 'partials', 'account-plugins');
try {
    if (fs.existsSync(accountPluginPartialsDir)) {
        for (let file of fs.readdirSync(accountPluginPartialsDir)) {
            if (!file.endsWith('.hbs')) {
                continue;
            }
            let name = file.replace(/\.hbs$/i, '');
            let contents = fs.readFileSync(path.join(accountPluginPartialsDir, file), 'utf8');
            hbs.handlebars.registerPartial(name, contents);
            hbs.handlebars.registerPartial('account-plugins/' + name, contents);
        }
    }
} catch (err) {
    // best-effort only; if this fails, templates still render without plugins
}

/**
 * We need this helper to make sure that we consume flash messages only
 * when we are able to actually display these. Otherwise we might end up
 * in a situation where we consume a flash messages but then comes a redirect
 * and the message is never displayed
 */
hbs.registerHelper('flash_messages', function () {
    if (typeof this.flash !== 'function') {
        return '';
    }

    let messages = this.flash(); // eslint-disable-line no-invalid-this
    let response = [];

    // group messages by type
    Object.keys(messages).forEach((key) => {
        let el =
            '<div class="alert alert-' +
            key +
            ' alert-dismissible" role="alert"><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>';

        if (key === 'danger') {
            el += '<span class="glyphicon glyphicon-exclamation-sign" aria-hidden="true"></span> ';
        }

        let rows = [];

        messages[key].forEach((message) => {
            rows.push(hbs.handlebars.escapeExpression(message));
        });

        if (rows.length > 1) {
            el += '<p>' + rows.join('</p>\n<p>') + '</p>';
        } else {
            el += rows.join('');
        }

        el += '</div>';

        response.push(el);
    });

    return new hbs.handlebars.SafeString(response.join('\n'));
});

hbs.registerHelper('render_partial', function (partialName, context) {
    if (!partialName) {
        return '';
    }

    let candidates = [partialName];
    if (partialName.startsWith('account-plugins/')) {
        candidates.push(partialName.slice('account-plugins/'.length));
    } else {
        candidates.push('account-plugins/' + partialName);
    }

    let partial;
    for (let name of candidates) {
        partial = hbs.handlebars.partials[name];
        if (partial) {
            break;
        }
    }
    if (!partial) {
        return '';
    }

    let data = context || this; // eslint-disable-line no-invalid-this
    let renderer = partial;

    if (typeof renderer !== 'function') {
        renderer = hbs.handlebars.compile(renderer);
    }

    return new hbs.handlebars.SafeString(renderer(data));
});
